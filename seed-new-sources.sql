-- ========================================================
-- JOBHUNTER AI: SEED NEW SOURCES
-- Run this in the Supabase SQL Editor after URL fix
-- ========================================================

-- 1. CarePay (BambooHR ATS)
INSERT INTO public.job_sources (name, base_url, type, category, source_kind, strategy, priority, risk_level, active)
VALUES (
    'CarePay',
    'https://carepay.bamboohr.com/careers',
    'html',
    'Corporate',
    'ats',
    'ats_bamboohr',
    'high',
    'low',
    true
)
ON CONFLICT DO NOTHING;

-- 2. AjiraZone IT Jobs
INSERT INTO public.job_sources (name, base_url, type, category, source_kind, strategy, priority, risk_level, active, parsing_config)
VALUES (
    'AjiraZone IT',
    'https://www.ajirazone.com/jobs?category=Information+Technology',
    'html',
    'Tech',
    'aggregator',
    'html',
    'high',
    'low',
    true,
    '{"item": ".job-card, .job-listing, article", "title": "h2 a, h3 a, .job-title a", "company": ".company, .employer", "location": ".location", "url": "h2 a, h3 a, .job-title a", "max_pages": 7, "pagination_param": "page"}'::jsonb
)
ON CONFLICT DO NOTHING;
