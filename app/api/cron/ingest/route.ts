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
        // 1. Fetch active Job Sources that are due for a run
        const now = new Date();
        const { data: allSources, error: sourceError } = await supabase
            .from('job_sources')
            .select('*')
            .eq('active', true);

        if (sourceError) throw sourceError;
        if (!allSources || allSources.length === 0) return NextResponse.json({ message: 'No active sources' });

        // Allow manual 'force' trigger to scan everything regardless of due status
        const body = await request.json().catch(() => ({}));
        const forceAll = body?.force === true;

        // 2. Filter sources by Priority Tier based on required frequencies
        const dueIntervals: Record<number, number> = {
            1: 55,   // ~1 hour
            2: 350,  // ~6 hours
            3: 710,  // ~12 hours
            4: 1430  // ~24 hours
        };

        const sourcesToRun = allSources.filter(source => {
            if (forceAll) return true;

            const priority = source.parsing_config?.priority_level || 1;
            if (!source.last_run_at) return true;

            const diffMins = (now.getTime() - new Date(source.last_run_at).getTime()) / (1000 * 60);
            const interval = dueIntervals[priority] || 55;

            return diffMins >= interval;
        }).sort((a, b) => {
            // 1. Strict Tier 1 Priority: Tier 1 always gets first dibs if it's due
            const priorityA = a.parsing_config?.priority_level || 1;
            const priorityB = b.parsing_config?.priority_level || 1;

            if (priorityA === 1 && priorityB !== 1) return -1;
            if (priorityA !== 1 && priorityB === 1) return 1;

            // 2. Ratio-Based Priority for same-tier or non-Tier-1 sources
            const intervalA = dueIntervals[priorityA] || 55;
            const intervalB = dueIntervals[priorityB] || 55;

            const diffA = a.last_run_at ? (now.getTime() - new Date(a.last_run_at).getTime()) / (1000 * 60) : 99999;
            const diffB = b.last_run_at ? (now.getTime() - new Date(b.last_run_at).getTime()) / (1000 * 60) : 99999;

            const ratioA = diffA / intervalA;
            const ratioB = diffB / intervalB;

            return ratioB - ratioA;
        });

        if (sourcesToRun.length === 0) {
            return NextResponse.json({ message: 'Everything is up to date.' });
        }

        // 3. Batching Logic: We process up to 15 standard sources AND 1 Google source at once.
        // This ensures Tier 1 sources are cleared quickly while slow Google sources don't block them.
        const googleSources = sourcesToRun.filter(s => s.type === 'google');
        const standardSources = sourcesToRun.filter(s => s.type !== 'google');

        const selectedBatch = [
            ...standardSources.slice(0, 15),
            ...googleSources.slice(0, 1)
        ];

        console.log(`Starting ingestion batch for ${selectedBatch.length} sources (Force: ${forceAll})`);
        console.log(`  - Standards: ${standardSources.slice(0, 15).length}, Google: ${googleSources.slice(0, 1).length}`);
        let totalIngested = 0;

        const processSource = async (source: any) => {
            try {
                console.log(`Processing: ${source.name} (Type: ${source.type})`);
                const { data: existingJobs } = await supabase
                    .from('jobs')
                    .select('dedupe_hash')
                    .eq('source_id', source.id)
                    .order('created_at', { ascending: false })
                    .limit(500);

                const existingHashes = new Set(existingJobs?.map((j: { dedupe_hash: string }) => j.dedupe_hash) || []);

                const timeoutMs = source.type === 'google' ? 30000 : 15000;
                
                const jobs = await Promise.race([
                    scrapeSource(source, existingHashes),
                    new Promise<Partial<any>[]>((_, reject) => 
                        setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
                    )
                ]);

                if (jobs && jobs.length > 0) {
                    for (const job of jobs) {
                        const { error } = await supabase
                            .from('jobs')
                            .insert(job)
                            .select();

                        if (!error) totalIngested++;
                    }
                } else if (!jobs) {
                    console.warn(`Scraper for ${source.name} returned null/undefined. Selector issue?`);
                }
            } catch (err: any) {
                const isTimeout = err.message?.includes('Timeout');
                console.error(`${isTimeout ? '⏳ TIMEOUT' : '❌ ERROR'} processing ${source.name}:`, err.message);
            } finally {
                await supabase.from('job_sources')
                    .update({ last_run_at: new Date().toISOString() })
                    .eq('id', source.id);
            }
        };

        const googleSrcs = selectedBatch.filter(s => s.type === 'google');
        const standardSrcs = selectedBatch.filter(s => s.type !== 'google');

        // Process standard sources in parallel chunks of 5 to stay under Vercel limits
        for (let i = 0; i < standardSrcs.length; i += 5) {
            const chunk = standardSrcs.slice(i, i + 5);
            await Promise.all(chunk.map(s => processSource(s)));
        }

        // Google is heavy, so we do it serially
        if (googleSrcs.length > 0) {
            await processSource(googleSrcs[0]);
        }

        // 4. AUTO-CLEANUP: Run cleanup only once per day
        const todayStr = new Date().toISOString().split('T')[0];
        const { data: settings } = await supabase.from('system_settings').select('key, value').eq('key', 'last_cleanup_date').single();

        let cleaned = 0;
        let activeCleaned = 0;

        if (!settings || settings.value !== todayStr) {
            console.log(`Running daily cleanup for ${todayStr}...`);
            // Cleanup logic remains as is...
            const fiveDaysAgo = new Date();
            fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
            const { data: staleApps } = await supabase.from('applications').select('job_id').eq('status', 'rejected').lt('applied_at', fiveDaysAgo.toISOString());

            if (staleApps && staleApps.length > 0) {
                const staleJobIds = staleApps.map(a => a.job_id);
                const { error } = await supabase.from('jobs').delete().in('id', staleJobIds);
                if (!error) cleaned = staleJobIds.length;
            }

            const fourDaysAgo = new Date();
            fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
            const { data: oldJobs } = await supabase.from('jobs').select('id, applications(id)').lt('created_at', fourDaysAgo.toISOString());
            if (oldJobs) {
                const unappliedJobIds = oldJobs.filter(j => !j.applications || (Array.isArray(j.applications) && j.applications.length === 0)).map(j => j.id);
                if (unappliedJobIds.length > 0) {
                    const { error } = await supabase.from('jobs').delete().in('id', unappliedJobIds);
                    if (!error) activeCleaned = unappliedJobIds.length;
                }
            }

            if (settings) {
                await supabase.from('system_settings').update({ value: todayStr }).eq('key', 'last_cleanup_date');
            } else {
                await supabase.from('system_settings').insert({ key: 'last_cleanup_date', value: todayStr });
            }
        }

        return NextResponse.json({
            success: true,
            message: `Batch complete. Processed ${selectedBatch.length} sources. ${totalIngested} new jobs added. Cleanup: ${cleaned + activeCleaned} total.`
        });
    } catch (error: any) {
        console.error('Ingestion Error:', error);
        return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
