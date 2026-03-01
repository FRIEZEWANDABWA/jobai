import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { calculateTitleBoost } from '@/lib/title-boost';

// One-time re-score of ALL existing match_scores with title boost
function cosineSimilarity(vecA: number[] | string, vecB: number[] | string) {
    const a = typeof vecA === 'string' ? JSON.parse(vecA) : vecA;
    const b = typeof vecB === 'string' ? JSON.parse(vecB) : vecB;
    return a.reduce((sum: number, val: number, i: number) => sum + val * b[i], 0);
}

export async function GET() {
    try {
        // Get user
        const { data: profiles } = await supabase
            .from('user_profiles')
            .select('id, cv_embedding')
            .not('cv_embedding', 'is', null)
            .limit(1);

        const user = profiles?.[0];
        if (!user) return NextResponse.json({ error: 'No user' });

        // Fetch all jobs with embeddings
        const { data: jobs } = await supabase
            .from('jobs')
            .select('id, title, description, embedding')
            .not('embedding', 'is', null);

        if (!jobs) return NextResponse.json({ error: 'No jobs' });

        let updated = 0;
        let boosted = 0;

        for (const job of jobs) {
            const baseScore = cosineSimilarity(user.cv_embedding, job.embedding);
            const titleBoost = calculateTitleBoost(job.title, job.description || '');
            const finalScore = Math.min(baseScore + titleBoost, 1.0);

            if (titleBoost > 0) boosted++;

            await supabase.from('match_scores').upsert({
                user_id: user.id,
                job_id: job.id,
                score: finalScore
            }, { onConflict: 'user_id,job_id' });

            updated++;
        }

        return NextResponse.json({
            success: true,
            totalJobs: jobs.length,
            updated,
            boosted,
            message: `Re-scored ${updated} jobs. ${boosted} received title boosts.`
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
