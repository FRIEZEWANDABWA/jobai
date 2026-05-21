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
        
        // 0. Stale Job Recovery
        const twentyMinsAgo = new Date(Date.now() - 20 * 60000).toISOString();
        await supabase
            .from('scrape_jobs')
            .update({ status: 'pending', worker_id: null, started_at: null })
            .eq('status', 'running')
            .lt('started_at', twentyMinsAgo);

        // 1. Claim Jobs (Atomic update via RPC with Strategy Buckets)
        const workerId = `worker-${Math.random().toString(36).substring(7)}`;
        let claimedJobs: any[] = [];
        
        // Try buckets in order of throughput capacity
        const buckets = [
            { strategies: ['api', 'rss'], limit: 20 },
            { strategies: ['html', 'ats_bamboohr', 'ats_zoho', 'ats_csod', 'ats_mci', 'ats_greenhouse', 'ats_lever'], limit: 10 },
            { strategies: ['proxy_html'], limit: 3 },
            { strategies: ['browser'], limit: 1 }
        ];

        for (const bucket of buckets) {
            const { data } = await supabase.rpc('claim_scrape_jobs', {
                p_worker_id: workerId,
                p_strategies: bucket.strategies,
                p_limit: bucket.limit
            });
            
            if (data && data.length > 0) {
                // Fetch the associated job_sources
                const sourceIds = data.map((j: any) => j.source_id);
                const { data: sources } = await supabase.from('job_sources').select('*').in('id', sourceIds);
                
                claimedJobs = data.map((j: any) => ({
                    ...j,
                    job_sources: sources?.find((s: any) => s.id === j.source_id)
                }));
                break; // Only process one bucket per worker run to prevent overlap
            }
        }

        if (claimedJobs.length === 0) {
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
            const queueWaitMs = new Date(job.started_at).getTime() - new Date(job.created_at).getTime();
            const queueWaitSecs = Math.floor(queueWaitMs / 1000);
            
            // Requeue if retrying, otherwise close
            const nextScheduledAt = newStatus === 'retrying' 
                ? new Date(Date.now() + (Math.pow(2, job.retry_count) * 60 * 1000)).toISOString() // Exponential backoff
                : job.scheduled_at;

            await supabase
                .from('scrape_jobs')
                .update({
                    status: newStatus,
                    completed_at: newStatus !== 'retrying' ? new Date().toISOString() : null,
                    last_error: errorMsg,
                    retry_count: newStatus === 'retrying' ? job.retry_count + 1 : job.retry_count,
                    scheduled_at: nextScheduledAt,
                    queue_wait_seconds: queueWaitSecs
                })
                .eq('id', job.id);

            // Update Source Health JSONB
            // @ts-ignore - Handle missing expected_job_volume typed field
            const expectedVolume = source.expected_job_volume || 'medium';
            const oldHealth = source.source_health || {
                consecutive_failures: 0,
                success_rate: 100,
                avg_response_ms: 0,
                last_success_at: null,
                last_checked_at: null,
                jobs_found_last_run: 0,
                last_error: null,
                last_status_code: null,
                status: 'healthy',
                consecutive_zero_runs: 0
            };
            
            const isSuccess = newStatus === 'completed';
            const newFailures = isSuccess ? 0 : (oldHealth.consecutive_failures || 0) + 1;
            
            let newZeroRuns = oldHealth.consecutive_zero_runs || 0;
            if (isSuccess) {
                if (jobsFound === 0) newZeroRuns++;
                else newZeroRuns = 0;
            }
            
            // Simple moving average for latency
            const newLatency = oldHealth.avg_response_ms === 0 ? latencyMs : Math.round((oldHealth.avg_response_ms + latencyMs) / 2);
            
            // Health degradation rule
            let sourceStatus = 'healthy';
            if (newFailures >= 5) sourceStatus = 'degraded';
            if (newFailures >= 10) sourceStatus = 'paused';
            
            // Zero-job threshold rules based on expected volume
            let zeroThreshold = 2; // Default for aggregators/high volume
            if (expectedVolume === 'low') zeroThreshold = 4;
            if (expectedVolume === 'very_low') zeroThreshold = 6;
            
            if (isSuccess && newZeroRuns >= zeroThreshold) {
                sourceStatus = 'degraded';
            }

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
                        consecutive_zero_runs: newZeroRuns,
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
