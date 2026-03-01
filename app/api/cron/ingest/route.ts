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
            if (priority === 2 && diffMins >= 110) return true; // ~2 hours
            if (priority === 3 && diffMins >= 170) return true; // ~3 hours

            return false;
        });

        console.log(`Starting ingestion of ${sourcesToRun.length} sources (out of ${sources.length} active)`);
        let totalIngested = 0;

        // 3. Iterate and scrape
        for (const source of sourcesToRun) {
            const jobs = await scrapeSource(source);
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

        return NextResponse.json({ success: true, message: `Ingestion complete. ${totalIngested} new jobs added.` });
    } catch (error: any) {
        console.error('Ingestion Error:', error);
        return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
