import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { generateEmbedding } from '@/lib/openai';
import { sendEmailNotification, sendTelegramNotification } from '@/lib/notifier';
import { calculateTitleBoost } from '@/lib/title-boost';

// Basic vector dot product assuming normalized embeddings for cosine similarity
function cosineSimilarity(vecA: number[] | string, vecB: number[] | string) {
    const a = typeof vecA === 'string' ? JSON.parse(vecA) : vecA;
    const b = typeof vecB === 'string' ? JSON.parse(vecB) : vecB;
    return a.reduce((sum: number, val: number, i: number) => sum + val * b[i], 0);
}

export async function POST(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        // 1. Fetch system thresholds
        const { data: settings } = await supabase.from('system_settings').select('key, value');
        const notifyThreshold = parseFloat(settings?.find(s => s.key === 'notify_threshold')?.value || '0.80');

        // 2. Fetch jobs where `embedding IS NULL`
        // Rate Limiting (Lightweight): Process max 50 at a time to avoid OpenAI burst overages
        const BATCH_SIZE = 50;
        const { data: jobsToEmbed } = await supabase
            .from('jobs')
            .select('id, description, embedding')
            .is('embedding', null)
            .limit(BATCH_SIZE);

        if (!jobsToEmbed || jobsToEmbed.length === 0) {
            return NextResponse.json({ message: 'No new jobs to embed' });
        }

        console.log(`Processing embeddings for ${jobsToEmbed.length} jobs`);

        // 3. Generate embeddings safely
        for (const job of jobsToEmbed) {
            // Prevent OpenAI Cost Leaks explicitly
            if (!job.embedding) {
                try {
                    // Optional delay for rate limiting can go here
                    const embedding = await generateEmbedding(job.description);
                    await supabase.from('jobs').update({ embedding }).eq('id', job.id);
                } catch (e) {
                    console.error(`Failed embedding for job: ${job.id}`, e);
                }
            }
        }

        // 4. Fetch the primary user profile (assuming single admin setup for now)
        const { data: profiles } = await supabase
            .from('user_profiles')
            .select('id, cv_embedding, email, telegram_chat_id')
            .not('cv_embedding', 'is', null)
            .limit(1);

        const user = profiles?.[0];
        if (!user) {
            return NextResponse.json({ message: 'No user CV embedding found' });
        }

        // 5. Compute matches for newly embedded jobs
        // In production, you might do this inside PG via an Edge function.
        // For this tier, we fetch the jobs and do it in Next.js Serverless.
        const { data: recentJobs } = await supabase
            .from('jobs')
            .select('id, title, company, url, description, embedding')
            .in('id', jobsToEmbed.map(j => j.id));

        let highMatches = 0;

        for (const job of recentJobs || []) {
            if (!job.embedding) continue;

            const baseScore = cosineSimilarity(user.cv_embedding, job.embedding);
            const titleBoost = calculateTitleBoost(job.title, job.description || '');
            const score = Math.min(baseScore + titleBoost, 1.0);

            // Save score
            await supabase.from('match_scores').upsert({
                user_id: user.id,
                job_id: job.id,
                score: score
            }, { onConflict: 'user_id,job_id' });

            // Prepare notification if high match
            if (score >= notifyThreshold) {
                highMatches++;
                console.log(`🔥 HIGH MATCH (${(score * 100).toFixed(1)}%) [base: ${(baseScore * 100).toFixed(1)}% + boost: ${(titleBoost * 100).toFixed(1)}%]: ${job.title} at ${job.company}`);

                // Check if we already notified for this job to prevent spam
                const { data: existingNotif } = await supabase
                    .from('notifications')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('job_id', job.id)
                    .limit(1);

                if (!existingNotif || existingNotif.length === 0) {
                    const emailSent = await sendEmailNotification(job, score, user.email);
                    const telegramSent = await sendTelegramNotification(job, score, user.telegram_chat_id);

                    await supabase.from('notifications').insert({
                        user_id: user.id,
                        job_id: job.id,
                        type: 'both' // Simplified for logging
                    });
                }
            }
        }

        return NextResponse.json({ success: true, processed: jobsToEmbed.length, newHighMatches: highMatches });
    } catch (error: any) {
        console.error('Matching Error:', error);
        return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
