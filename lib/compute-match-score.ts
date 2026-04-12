/**
 * Match scoring entry point.
 *
 * Env:
 * - SCORING_ENGINE=v2 — multi-signal scorer (`lib/scoring-v2.ts`); default is v1 (embedding + legacy title boost).
 * - SCORING_SHADOW=true — log JSON lines comparing v1 vs v2 (safe with v1 or v2 primary).
 *
 * Supabase: run `supabase/migrations/20260412120000_scoring_v2_score_components.sql` before relying on
 * persisted `score_components` when using v2.
 */
import { calculateTitleBoost } from "@/lib/title-boost";
import {
    classifyTier,
    parseTierThresholdsFromSettings,
    scoreJobV2,
    type ScoringJobInput,
    type ScoreTier,
} from "@/lib/scoring-v2";

export type SettingsRow = { key: string; value: unknown };

export function isScoringEngineV2(): boolean {
    return (process.env.SCORING_ENGINE || "").toLowerCase() === "v2";
}

export function isScoringShadowEnabled(): boolean {
    return (process.env.SCORING_SHADOW || "").toLowerCase() === "true";
}

export type ComputeMatchScoreResult = {
    score: number;
    /** Stored when v2 is active and DB supports `score_components` */
    score_components: Record<string, unknown> | null;
    tier: ScoreTier;
    legacyV1Score: number;
    engine: "v1" | "v2";
};

function jobInputFromParts(title: string, description: string, company?: string): ScoringJobInput {
    return {
        title: title || description.split("\n")[0] || "",
        description: description || "",
        company,
    };
}

/**
 * Single entry point for match cron + rescore: v1 (embedding + legacy title boost) or v2 (multi-signal).
 */
export function computeMatchScore(params: {
    title: string;
    description: string;
    company?: string;
    baseSemantic: number;
    settings?: SettingsRow[] | null;
}): ComputeMatchScoreResult {
    const thresholds = parseTierThresholdsFromSettings(params.settings ?? null);
    const job = jobInputFromParts(params.title, params.description, params.company);

    const legacyV1Score = Math.min(
        params.baseSemantic + calculateTitleBoost(job.title, job.description),
        1.0
    );

    const v2Result = scoreJobV2(job, params.baseSemantic, thresholds);

    if (isScoringShadowEnabled()) {
        console.log(
            JSON.stringify({
                scoring_shadow: true,
                engine: isScoringEngineV2() ? "v2" : "v1",
                title: job.title.slice(0, 120),
                base_semantic: Number(params.baseSemantic.toFixed(4)),
                v1_score: Number(legacyV1Score.toFixed(4)),
                v2_score: Number(v2Result.finalScore.toFixed(4)),
                v2_tier: v2Result.tier,
            })
        );
    }

    if (isScoringEngineV2()) {
        return {
            score: v2Result.finalScore,
            score_components: {
                ...v2Result.components,
                tier: v2Result.tier,
                engine: "v2",
            },
            tier: v2Result.tier,
            legacyV1Score: legacyV1Score,
            engine: "v2",
        };
    }

    return {
        score: legacyV1Score,
        score_components: null,
        tier: classifyTier(legacyV1Score, thresholds),
        legacyV1Score,
        engine: "v1",
    };
}
