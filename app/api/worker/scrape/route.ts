import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { scrapeSource } from '@/lib/scraper';
import { JobSource } from '@/types/source';

export async function POST(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const now = new Date().toISOString();
        
        // 1. Claim Jobs (Atomic update)
        // We claim up to 5 jobs at once to avoid Vercel timeouts (serverless max is typically 10s-60s)
        const workerId = `worker-${Math.random().toString(36).substring(7)}`;
        
        const { data: claimedJobs, error: claimError } = await supabase
            .from('scrape_jobs')
            .update({ 
                status: 'running', 
                started_at: now,
                worker_id: workerId 
            })
            .eq('status', 'pending')
            .lte('scheduled_at', now)
            .limit(5)
            .select('*, job_sources(*)');

        if (claimError) throw claimError;
        if (!claimedJobs || claimedJobs.length === 0) {
            return NextResponse.json({ message: 'No jobs to process' });
        }

        console.log(`Worker ${workerId} claimed ${claimedJobs.length} jobs.`);

        let totalIngested = 0;

        // 2. Process Jobs
        for (const job of claimedJobs) {
            const source = job.job_sources as JobSource;
            if (!source) continue;

            const startTime = Date.now();
            let newStatus = 'completed';
            let errorMsg = null;
            let jobsFound = 0;

            try {
                // Fetch existing hashes for deduplication
                const { data: existingJobs } = await supabase
                    .from('jobs')
                    .select('dedupe_hash')
                    .eq('source_id', source.id)
                    .order('created_at', { ascending: false })
                    .limit(500);

                const existingHashes = new Set(existingJobs?.map((j: { dedupe_hash: string }) => j.dedupe_hash) || []);

                // Execute the scraper strategy
                const scrapedJobs = await scrapeSource(source, existingHashes);

                if (scrapedJobs && scrapedJobs.length > 0) {
                    jobsFound = scrapedJobs.length;
                    
                    // Insert distinct jobs
                    for (const parsedJob of scrapedJobs) {
                        const { error: insertError } = await supabase
                            .from('jobs')
                            .insert(parsedJob);
                            
                        if (!insertError) totalIngested++;
                    }
                }
            } catch (err: any) {
                console.error(`Scrape failure for ${source.name}:`, err);
                errorMsg = err.message || 'Unknown error';
                
                // Retry logic
                if (job.retry_count < 3) {
                    newStatus = 'retrying';
                } else {
                    newStatus = 'failed';
                }
            }

            // 3. Update Job and Source Health Status
            const latencyMs = Date.now() - startTime;
            
            // Requeue if retrying, otherwise close
            const nextScheduledAt = newStatus === 'retrying' 
                ? new Date(Date.now() + (Math.pow(2, job.retry_count) * 60 * 1000)).toISOString() // Exponential backoff (1m, 2m, 4m)
                : job.scheduled_at;

            await supabase
                .from('scrape_jobs')
                .update({
                    status: newStatus,
                    completed_at: newStatus !== 'retrying' ? new Date().toISOString() : null,
                    last_error: errorMsg,
                    retry_count: newStatus === 'retrying' ? job.retry_count + 1 : job.retry_count,
                    scheduled_at: nextScheduledAt
                })
                .eq('id', job.id);

            // Update Source Health JSONB
            const oldHealth = source.source_health || {
                consecutive_failures: 0,
                success_rate: 100,
                avg_response_ms: 0,
                last_success_at: null,
                last_checked_at: null,
                jobs_found_last_run: 0,
                last_error: null,
                last_status_code: null,
                status: 'healthy' as const,
            };
            const isSuccess = newStatus === 'completed';
            const newFailures = isSuccess ? 0 : (oldHealth.consecutive_failures || 0) + 1;
            
            // Simple moving average for latency
            const newLatency = oldHealth.avg_response_ms === 0 ? latencyMs : Math.round((oldHealth.avg_response_ms + latencyMs) / 2);
            
            // Health degradation rule
            let sourceStatus = 'healthy';
            if (newFailures >= 5) sourceStatus = 'degraded';
            if (newFailures >= 10) sourceStatus = 'paused';

            await supabase
                .from('job_sources')
                .update({
                    last_run_at: new Date().toISOString(),
                    source_health: {
                        ...oldHealth,
                        last_checked_at: new Date().toISOString(),
                        last_success_at: isSuccess ? new Date().toISOString() : oldHealth.last_success_at,
                        jobs_found_last_run: jobsFound,
                        avg_response_ms: newLatency,
                        consecutive_failures: newFailures,
                        last_error: errorMsg,
                        status: sourceStatus
                    }
                })
                .eq('id', source.id);
        }

        return NextResponse.json({
            success: true,
            message: `Processed ${claimedJobs.length} jobs. ${totalIngested} new jobs added.`
        });
    } catch (error: any) {
        console.error('Worker Error:', error);
        return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
