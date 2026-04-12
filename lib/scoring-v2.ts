/**
 * Production-safe multi-signal scorer (v2).
 * Title-first signal without hard rejection; thresholds align with system_settings.
 */

export type ScoringJobInput = {
    title: string;
    description: string;
    company?: string;
};

export type ScoreComponents = {
    semantic: number;
    title: number;
    org: number;
    experience: number;
    scope: number;
};

export type ScoreTier = "high" | "strong" | "watch" | "other";

export type TierThresholds = {
    /** High / notify band */
    notify: number;
    /** Strong band lower bound */
    dashboard: number;
    /** Watch band lower bound */
    watch: number;
};

export type ScoreResult = {
    finalScore: number;
    tier: ScoreTier;
    components: ScoreComponents;
};

const WEIGHT_SEMANTIC = 0.45;
const WEIGHT_TITLE = 0.3;
const WEIGHT_ORG = 0.1;
const WEIGHT_EXPERIENCE = 0.1;
const WEIGHT_SCOPE = 0.05;

/** Default watch floor when `watch_threshold` is not in DB */
export const DEFAULT_WATCH_THRESHOLD = 0.6;

const TIER_1_TITLES = [
    "it manager",
    "ict manager",
    "head of it",
    "head of ict",
    "it operations manager",
    "infrastructure manager",
    "technology manager",
    "digital transformation manager",
    "it service delivery manager",
    "it governance manager",
    "enterprise infrastructure manager",
    "platform operations manager",
    "information technology manager",
];

const TIER_2_TITLES = [
    "it officer",
    "ict officer",
    "it specialist",
    "ict specialist",
    "technical lead",
    "systems lead",
    "network lead",
    "infrastructure lead",
    "it supervisor",
    "it coordinator",
    "it service lead",
    "regional it",
    "country it",
    "cluster it",
];

/** Narrow IT roles only — broad terms require IT context */
const TIER_3_ROLE_TERMS = ["engineer", "administrator", "analyst"];

function hasItTitleContext(t: string): boolean {
    if (/\b(it|ict)\b/.test(t)) return true;
    return (
        t.includes("information technology") ||
        t.includes("enterprise technology") ||
        t.includes("systems administrator") ||
        t.includes("network engineer") ||
        t.includes("infrastructure") ||
        t.includes("technology analyst") ||
        t.includes("it analyst") ||
        t.includes("ict specialist") ||
        t.includes("cloud engineer") ||
        t.includes("devops")
    );
}

export function getTitleScore(title: string): number {
    const t = (title || "").toLowerCase().trim();
    if (!t) return 0.55;

    if (TIER_1_TITLES.some((k) => t.includes(k))) return 0.95;
    if (TIER_2_TITLES.some((k) => t.includes(k))) return 0.8;

    if (hasItTitleContext(t) && TIER_3_ROLE_TERMS.some((k) => t.includes(k))) {
        return 0.65;
    }

    return 0.55;
}

const GLOBAL_ORGS = ["unicef", "undp", "msf", "who", "world bank", "wfp", "unhcr", "unops"];

export function getOrgScore(company: string): number {
    const c = (company || "").toLowerCase();
    if (!c) return 0.6;
    if (GLOBAL_ORGS.some((org) => c.includes(org))) return 1.0;
    if (c.includes("bank") || c.includes("group")) return 0.75;
    return 0.6;
}

export function getExperienceScore(desc: string): number {
    const d = (desc || "").toLowerCase();
    if (/\b15\s*\+?\s*years?\b/.test(d) || d.includes("15 years")) return 0.7;
    if (/\b12\s*\+?\s*years?\b/.test(d) || d.includes("12 years")) return 0.8;
    if (/\b10\s*\+?\s*years?\b/.test(d) || d.includes("10 years")) return 0.9;
    if (/\b7\s*\+?\s*years?\b/.test(d) || d.includes("7 years")) return 0.95;
    if (/\b5\s*\+?\s*years?\b/.test(d) || d.includes("5 years")) return 1.0;
    return 0.85;
}

const SCOPE_HINTS: { re: RegExp; add: number }[] = [
    { re: /\bbudget\b|\bcapex\b|\bopex\b/i, add: 0.1 },
    { re: /\bvendor(s)?\b|\bthird[- ]party\b/i, add: 0.1 },
    { re: /\bteam of\b|\bdirect reports?\b|\bpeople management\b|\bline management\b/i, add: 0.1 },
    { re: /\berp\b|\bsap\b|\bworkday\b|\boracle financials?\b/i, add: 0.1 },
    { re: /\bstakeholder(s)?\b|\bprogramme governance\b|\bportfolio\b/i, add: 0.1 },
];

export function getScopeScore(desc: string): number {
    const d = desc || "";
    let score = 0.4;
    for (const { re, add } of SCOPE_HINTS) {
        if (re.test(d)) score += add;
    }
    return Math.min(score, 1.0);
}

export function applySafeFloor(score: number, title: number, semantic: number): number {
    if (title > 0.9 && semantic > 0.55) {
        return Math.max(score, 0.8);
    }
    return score;
}

export function applyPromotion(job: ScoringJobInput, score: number): number {
    const t = (job.title || "").toLowerCase();
    const c = (job.company || "").toLowerCase();
    const globalHit = ["unicef", "msf", "undp"].some((org) => c.includes(org));
    if (globalHit && (t.includes("officer") || t.includes("specialist")) && score > 0.75) {
        return Math.min(score + 0.03, 1.0);
    }
    return score;
}

export function normalizeTierThresholds(raw: TierThresholds): TierThresholds {
    const notify = clamp01(raw.notify);
    let dashboard = clamp01(raw.dashboard);
    let watch = clamp01(raw.watch);

    if (dashboard > notify - 0.02) dashboard = Math.max(0, notify - 0.02);
    if (watch > dashboard - 0.02) watch = Math.max(0, dashboard - 0.02);
    if (watch < 0) watch = 0;

    return { notify, dashboard, watch };
}

function clamp01(n: number): number {
    if (Number.isNaN(n) || n < 0) return 0;
    if (n > 1) return 1;
    return n;
}

export function classifyTier(score: number, t: TierThresholds): ScoreTier {
    const th = normalizeTierThresholds(t);
    if (score >= th.notify) return "high";
    if (score >= th.dashboard) return "strong";
    if (score >= th.watch) return "watch";
    return "other";
}

export function parseTierThresholdsFromSettings(
    settings: { key: string; value: unknown }[] | null | undefined
): TierThresholds {
    const num = (key: string, def: number) => {
        const raw = settings?.find((s) => s.key === key)?.value;
        if (raw === undefined || raw === null) return def;
        if (typeof raw === "number") return raw;
        const s = String(raw).replace(/^"|"$/g, "");
        const v = parseFloat(s);
        return Number.isNaN(v) ? def : v;
    };

    return normalizeTierThresholds({
        notify: num("notify_threshold", 0.8),
        dashboard: num("dashboard_threshold", 0.7),
        watch: num("watch_threshold", DEFAULT_WATCH_THRESHOLD),
    });
}

export function scoreJobV2(
    job: ScoringJobInput,
    baseSemantic: number,
    thresholds: TierThresholds
): ScoreResult {
    const title = getTitleScore(job.title);
    const org = getOrgScore(job.company || "");
    const experience = getExperienceScore(job.description);
    const scope = getScopeScore(job.description);

    const sem = clamp01(baseSemantic);

    let score =
        sem * WEIGHT_SEMANTIC +
        title * WEIGHT_TITLE +
        org * WEIGHT_ORG +
        experience * WEIGHT_EXPERIENCE +
        scope * WEIGHT_SCOPE;

    score = applySafeFloor(score, title, sem);
    score = applyPromotion(job, score);

    const finalScore = Math.min(score, 1.0);
    const tier = classifyTier(finalScore, thresholds);

    return {
        finalScore,
        tier,
        components: {
            semantic: sem,
            title,
            org,
            experience,
            scope,
        },
    };
}
