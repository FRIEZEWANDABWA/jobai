import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { computeMatchScore, isScoringEngineV2 } from '@/lib/compute-match-score';
import { calculateTitleBoost } from '@/lib/title-boost';

function cosineSimilarity(vecA: number[] | string, vecB: number[] | string) {
    const a = typeof vecA === 'string' ? JSON.parse(vecA) : vecA;
    const b = typeof vecB === 'string' ? JSON.parse(vecB) : vecB;
    return a.reduce((sum: number, val: number, i: number) => sum + val * b[i], 0);
}

export async function GET() {
    try {
        const { data: profiles } = await supabase
            .from('user_profiles')
            .select('id, cv_embedding')
            .not('cv_embedding', 'is', null)
            .limit(1);

        const user = profiles?.[0];
        if (!user) return NextResponse.json({ error: 'No user' });

        const { data: settings } = await supabase.from('system_settings').select('key, value');

        const { data: jobs } = await supabase
            .from('jobs')
            .select('id, title, description, company, embedding')
            .not('embedding', 'is', null);

        if (!jobs) return NextResponse.json({ error: 'No jobs' });

        let updated = 0;
        let boosted = 0;

        for (const job of jobs) {
            const baseScore = cosineSimilarity(user.cv_embedding, job.embedding);
            const matchResult = computeMatchScore({
                title: job.title || '',
                description: job.description || '',
                company: job.company,
                baseSemantic: baseScore,
                settings: settings ?? undefined,
            });

            if (calculateTitleBoost(job.title || '', job.description || '') > 0) boosted++;

            const { error: upsertError } = await supabase.from('match_scores').upsert(
                { user_id: user.id, job_id: job.id, score: matchResult.score },
                { onConflict: 'user_id,job_id' }
            );
            if (upsertError) throw upsertError;

            if (matchResult.score_components) {
                const { error: compErr } = await supabase
                    .from('match_scores')
                    .update({ score_components: matchResult.score_components })
                    .eq('user_id', user.id)
                    .eq('job_id', job.id);
                if (compErr) {
                    console.warn(`score_components update skipped: ${compErr.message}`);
                }
            }

            updated++;
        }

        return NextResponse.json({
            success: true,
            totalJobs: jobs.length,
            updated,
            boosted,
            scoring_engine: isScoringEngineV2() ? 'v2' : 'v1',
            message: `Re-scored ${updated} jobs (${isScoringEngineV2() ? 'v2 multi-signal' : 'v1 semantic + title boost'}).`,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Internal Server Error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
