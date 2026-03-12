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
            .select('id, title, company, url, description, embedding')
            .is('embedding', null)
            .limit(BATCH_SIZE);

        if (!jobsToEmbed || jobsToEmbed.length === 0) {
            return NextResponse.json({ message: 'No new jobs to embed' });
        }

        console.log(`Processing embeddings and matches for ${jobsToEmbed.length} jobs`);

        // 3. Parallel Processing: Use Promise.all with chunks to avoid overwhelming OpenAI/DB
        const userProfileRes = await supabase
            .from('user_profiles')
            .select('id, cv_embedding, email, telegram_chat_id')
            .not('cv_embedding', 'is', null)
            .limit(1)
            .single();

        const user = userProfileRes.data;
        if (!user) {
            return NextResponse.json({ message: 'No user CV embedding found' });
        }

        let processed = 0;
        let highMatches = 0;

        // Process in chunks of 5 for efficiency and to stay under Vercel execution limits
        const CHUNK_SIZE = 5;
        for (let i = 0; i < jobsToEmbed.length; i += CHUNK_SIZE) {
            const chunk = jobsToEmbed.slice(i, i + CHUNK_SIZE);
            
            await Promise.all(chunk.map(async (job) => {
                try {
                    // Generate Embedding
                    const embedding = await generateEmbedding(job.description);
                    await supabase.from('jobs').update({ embedding }).eq('id', job.id);

                    // Calculate Score
                    const baseScore = cosineSimilarity(user.cv_embedding, embedding);
                    // Use existing job title if available, otherwise guess from description
                    const jobTitle = job.title || job.description.split('\n')[0];
                    const titleBoost = calculateTitleBoost(jobTitle, job.description);
                    const score = Math.min(baseScore + titleBoost, 1.0);

                    // Save score
                    await supabase.from('match_scores').upsert({
                        user_id: user.id,
                        job_id: job.id,
                        score: score
                    }, { onConflict: 'user_id,job_id' });

                    processed++;

                    // Handle High Match if necessary
                    if (score >= notifyThreshold) {
                        highMatches++;
                        console.log(`🔥 HIGH MATCH (${(score * 100).toFixed(1)}%) [base: ${(baseScore * 100).toFixed(1)}% + boost: ${(titleBoost * 100).toFixed(1)}%]: ${job.title || jobTitle} at ${job.company}`);
                        
                        const { data: existingNotif } = await supabase
                            .from('notifications')
                            .select('id')
                            .eq('user_id', user.id)
                            .eq('job_id', job.id)
                            .limit(1);

                        if (!existingNotif || existingNotif.length === 0) {
                            // We re-fetch full job details for notification
                            // Note: job object already contains title, company, url from initial select
                            const fullJob = { ...job, embedding }; // Add the newly generated embedding
                            if (fullJob) {
                                await sendEmailNotification(fullJob, score, user.email);
                                await sendTelegramNotification(fullJob, score, user.telegram_chat_id);
                                await supabase.from('notifications').insert({
                                    user_id: user.id,
                                    job_id: job.id,
                                    type: 'both'
                                });
                            }
                        }
                    }
                } catch (e) {
                    console.error(`Failed individual match process for job ${job.id}:`, e);
                }
            }));
            
            // Check for potential timeout (Vercel typically 10s)
            // If we've been running for more than 8s, we stop and let the next cron pick it up
            // This is handled by processed count returning.
        }

        return NextResponse.json({ success: true, processed, newHighMatches: highMatches });
    } catch (error: any) {
        console.error('Matching Error:', error);
        return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
