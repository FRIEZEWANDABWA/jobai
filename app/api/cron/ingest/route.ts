import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { scrapeSource } from '@/lib/scraper';

export async function POST(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        // 1. Fetch active Job Sources
        const { data: sources, error: sourceError } = await supabase
            .from('job_sources')
            .select('*')
            .eq('active', true);

        if (sourceError) throw sourceError;
        if (!sources || sources.length === 0) return NextResponse.json({ message: 'No active sources' });

        // 2. Filter sources by Priority Tier (Tier 1: Hourly, Tier 2: 2hrs, Tier 3: 3hrs)
        const now = new Date();
        const sourcesToRun = sources.filter(source => {
            const priority = source.parsing_config?.priority_level || 1;
            if (!source.last_run_at) return true; // Never run before

            const diffMins = (now.getTime() - new Date(source.last_run_at).getTime()) / (1000 * 60);

            if (priority === 1 && diffMins >= 50) return true; // ~1 hour
            if (priority === 2 && diffMins >= 350) return true; // ~6 hours
            if (priority === 3 && diffMins >= 710) return true; // ~12 hours
            if (priority === 4 && diffMins >= 1430) return true; // ~24 hours

            return false;
        });

        console.log(`Starting ingestion of ${sourcesToRun.length} sources (out of ${sources.length} active)`);
        let totalIngested = 0;

        // 3. Iterate and scrape
        for (const source of sourcesToRun) {
            // Fetch recent hashes to prevent scraping beyond what's known
            const { data: existingJobs } = await supabase
                .from('jobs')
                .select('dedupe_hash')
                .eq('source_id', source.id)
                .order('created_at', { ascending: false })
                .limit(1000);
            
            const existingHashes = new Set(existingJobs?.map((j: { dedupe_hash: string }) => j.dedupe_hash) || []);

            const jobs = await scrapeSource(source, existingHashes);
            if (jobs.length > 0) {
                // 3. Upsert to / insert ignoring duplicates using raw SQL if needed,
                // or rely on unique constraints in supabase
                for (const job of jobs) {
                    const { error } = await supabase
                        .from('jobs')
                        .insert(job)
                        // Or .upsert() if updates to existing URL/hash are acceptable
                        .select();

                    // Postgres unique violation error code is typically 23505
                    // If error is duplicate do not throw, just log/skip
                    if (error && error.code !== '23505') {
                        console.error(`Error inserting job ${job.title}:`, error);
                    } else if (!error) {
                        totalIngested++;
                    }
                }
            }

            // Update last run time regardless of whether new jobs were found
            await supabase.from('job_sources').update({ last_run_at: new Date().toISOString() }).eq('id', source.id);
        }
        // 4. AUTO-CLEANUP: Run cleanup only once per day
        const todayStr = new Date().toISOString().split('T')[0];
        const { data: settings } = await supabase.from('system_settings').select('key, value').eq('key', 'last_cleanup_date').single();

        let cleaned = 0;
        let activeCleaned = 0;

        if (!settings || settings.value !== todayStr) {
            console.log(`Running daily cleanup for ${todayStr}...`);

            // Delete archived jobs older than 5 days
            const fiveDaysAgo = new Date();
            fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
            const fiveDaysAgoIso = fiveDaysAgo.toISOString();

            // Find archived (rejected) applications older than 5 days
            const { data: staleApps } = await supabase
                .from('applications')
                .select('job_id')
                .eq('status', 'rejected')
                .lt('applied_at', fiveDaysAgoIso);

            if (staleApps && staleApps.length > 0) {
                const staleJobIds = staleApps.map(a => a.job_id);

                // Thanks to ON DELETE CASCADE on the DB, deleting the job automatically cleans relations
                const { error } = await supabase.from('jobs').delete().in('id', staleJobIds);

                if (!error) {
                    cleaned = staleJobIds.length;
                    console.log(`🧹 Auto-cleaned ${cleaned} archived jobs older than 5 days`);
                } else {
                    console.error('Error auto-cleaning archived jobs:', error);
                }
            }

            // 5. AUTO-CLEANUP ACTIVE JOBS: Delete unapplied jobs older than 4 days
            const fourDaysAgo = new Date();
            fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
            const fourDaysAgoIso = fourDaysAgo.toISOString();

            const { data: oldJobs } = await supabase
                .from('jobs')
                .select(`
                    id,
                    applications ( id )
                `)
                .lt('created_at', fourDaysAgoIso);

            if (oldJobs && oldJobs.length > 0) {
                const unappliedOldJobs = oldJobs.filter(j => !j.applications || (Array.isArray(j.applications) && j.applications.length === 0));

                if (unappliedOldJobs.length > 0) {
                    const unappliedJobIds = unappliedOldJobs.map(j => j.id);
                    const { error } = await supabase.from('jobs').delete().in('id', unappliedJobIds);

                    if (!error) {
                        activeCleaned = unappliedJobIds.length;
                        console.log(`🧹 Auto-cleaned ${activeCleaned} active unapplied jobs older than 4 days`);
                    } else {
                        console.error('Error auto-cleaning active jobs:', error);
                    }
                }
            }

            // Update the last cleanup date
            if (settings) {
                await supabase.from('system_settings').update({ value: todayStr }).eq('key', 'last_cleanup_date');
            } else {
                await supabase.from('system_settings').insert({ key: 'last_cleanup_date', value: todayStr });
            }
        } else {
            console.log(`Daily cleanup already ran for ${todayStr}, skipping.`);
        }

        return NextResponse.json({ success: true, message: `Ingestion complete. ${totalIngested} new jobs added. ${cleaned} stale archived jobs cleaned. ${activeCleaned} stale active jobs cleaned.` });
    } catch (error: any) {
        console.error('Ingestion Error:', error);
        return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
