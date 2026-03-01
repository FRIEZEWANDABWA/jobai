// ============================================================
// TITLE INTELLIGENCE BOOSTER
// Applies score bonuses based on job title and keyword matching
// ============================================================

// TIER 1 – Direct Match (Highest boost: +0.12)
const TIER_1_TITLES = [
    // Executive / Strategic Level
    'head of it', 'group head of it', 'director of it', 'it director',
    'director, information technology', 'director information technology',
    'regional it director', 'global it director',
    'chief information officer', 'cio', 'deputy cio',
    'vp information technology', 'vp technology',
    'chief technology officer', 'cto',
    'country it lead', 'technology director',
    // Senior Operational Leadership
    'it operations director', 'director, it service', 'director it service',
    'head of it operations', 'head of ict', 'ict director', 'ict manager',
    'infrastructure director', 'head of infrastructure',
    'it infrastructure manager', 'enterprise infrastructure manager',
    'infrastructure & operations manager', 'infrastructure and operations manager',
    'technology operations manager',
    'it service delivery director', 'head of service delivery',
    // Senior IT General Leadership
    'senior it manager', 'senior ict manager', 'senior information technology manager',
    'senior technology manager', 'senior it operations manager',
    'senior it service manager', 'senior it service delivery manager',
    'senior it lead', 'senior technology lead',
    'senior it consultant',
    // Senior Infrastructure
    'senior infrastructure manager', 'senior it infrastructure manager',
    'senior infrastructure engineer', 'senior systems infrastructure engineer',
    'senior enterprise infrastructure engineer', 'senior infrastructure architect',
    'senior cloud infrastructure engineer', 'senior platform engineer',
    'senior data center engineer', 'senior it operations engineer',
    // Senior Network
    'senior network engineer', 'senior network architect',
    'senior network operations engineer', 'senior network infrastructure engineer',
    'senior network security engineer', 'senior network & systems engineer',
    'lead network engineer', 'principal network engineer', 'regional network engineer',
    // Senior Systems / Enterprise
    'senior systems engineer', 'senior systems administrator',
    'senior enterprise systems engineer', 'senior it systems lead',
    'senior applications & infrastructure engineer', 'senior it technical lead',
    'senior systems architect',
    // Banking / Corporate
    'senior manager, it infrastructure', 'senior manager it infrastructure',
    'senior manager, technology operations', 'senior manager technology operations',
    'senior manager, enterprise systems', 'senior manager enterprise systems',
    'senior manager, it service delivery', 'senior manager it service delivery',
    'senior manager, core systems', 'senior manager core systems',
    'senior manager, digital infrastructure', 'senior manager digital infrastructure',
    'head of it infrastructure', 'manager, it infrastructure', 'manager it infrastructure',
    'head of technology operations', 'manager, it governance', 'manager it governance',
    'head of core systems', 'enterprise architecture manager',
    'technology risk manager', 'it service management lead',
    'head of systems & networks', 'head of systems and networks',
];

// TIER 2 – Strong Alignment (Moderate boost: +0.08)
const TIER_2_TITLES = [
    'digital transformation director', 'head of digital transformation',
    'it governance manager', 'it risk & compliance manager', 'it risk and compliance manager',
    'enterprise systems manager', 'head of enterprise systems',
    'applications & infrastructure manager', 'applications and infrastructure manager',
    'cloud operations manager', 'cloud infrastructure manager',
    'it program manager', 'technology program manager',
    'it portfolio manager', 'ict programme lead',
    'regional technology manager', 'it business partner',
    // UN / NGO Variants
    'ict specialist', 'ict manager', 'chief, ict', 'chief ict',
    'head of ict section', 'information systems officer',
    'senior information systems officer', 'ict operations lead',
    'technology advisor', 'digital solutions lead', 'it systems lead',
    'infrastructure specialist',
    // UN / NGO Senior Variants
    'senior ict specialist', 'senior ict officer',
    'senior technology specialist', 'ict infrastructure specialist',
    'information systems specialist',
];

// TIER 3 – Corporate Language Variants (Light boost: +0.05)
const TIER_3_TITLES = [
    'technology lead', 'technology operations lead',
    'head of technology', 'director, technology services', 'director technology services',
    'technology services manager', 'enterprise technology manager',
    'information services director',
    'it & facilities director', 'it and facilities director',
    'it & digital manager', 'it and digital manager',
    // Conditional (Big Org)
    'senior it officer', 'senior systems administrator',
    'senior it support engineer', 'senior network administrator',
    'senior it support lead',
];

// Keywords that boost score when found in description
const BOOST_KEYWORDS = [
    'enterprise infrastructure', 'hybrid cloud', 'multi-site environment',
    'itil', 'iso 27001', 'it governance', 'disaster recovery', 'business continuity',
    'service delivery', 'stakeholder management', 'budget ownership',
    'vendor management', 'regional oversight', 'group-level responsibility',
    'sd-wan', 'cybersecurity', 'erp', 'sap', 'digital transformation',
    'cloud migration', 'data center', 'network architecture',
    'it strategy', 'it roadmap', 'it budget',
];

/**
 * Calculate a title-based score boost for a job.
 * @param title - The job title
 * @param description - The job description
 * @returns A boost value between 0 and 0.15
 */
export function calculateTitleBoost(title: string, description: string): number {
    const lowerTitle = title.toLowerCase().trim();
    const lowerDesc = description.toLowerCase();
    let boost = 0;

    // Check Tier 1 titles first (highest priority)
    for (const t of TIER_1_TITLES) {
        if (lowerTitle.includes(t)) {
            boost = 0.12;
            break;
        }
    }

    // Check Tier 2 if no Tier 1 match
    if (boost === 0) {
        for (const t of TIER_2_TITLES) {
            if (lowerTitle.includes(t)) {
                boost = 0.08;
                break;
            }
        }
    }

    // Check Tier 3 if no Tier 1/2 match
    if (boost === 0) {
        for (const t of TIER_3_TITLES) {
            if (lowerTitle.includes(t)) {
                boost = 0.05;
                break;
            }
        }
    }

    // Keyword boost from description (up to +0.06)
    let keywordHits = 0;
    for (const keyword of BOOST_KEYWORDS) {
        if (lowerDesc.includes(keyword)) {
            keywordHits++;
        }
    }
    const keywordBoost = Math.min(keywordHits * 0.015, 0.06);

    // Total boost capped at 0.15
    return Math.min(boost + keywordBoost, 0.15);
}
