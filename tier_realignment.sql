-- ========================================================
-- JOBHUNTER AI: TIER RE-ALIGNMENT SCRIPT
-- This script properly categorizes the legacy 52 job sources
-- into Core, High, Medium, and Low tiers.
-- ========================================================

-- 1. CORE (Runs every 30-60 mins)
-- Highly active platforms, premium aggregators, or fast-moving IT boards
UPDATE public.job_sources
SET priority = 'core', crawl_frequency_minutes = 60
WHERE name IN (
    'Remote OK',
    'CareerJet IT Manager',
    'CareerJet IT',
    'MyJobMag Kenya',
    'BrighterMonday Kenya',
    'We Work Remotely'
);

-- 2. HIGH (Runs every 2 hours / 120 mins)
-- Major corporate careers, major NGOs, key UN bodies
UPDATE public.job_sources
SET priority = 'high', crawl_frequency_minutes = 120
WHERE name IN (
    'Corporate Staffing IT',
    'Fuzu Kenya',
    'UNICEF',
    'UNOPS',
    'UNDP Careers',
    'World Bank Careers',
    'African Development Bank',
    'Safal Group',
    'Equity Bank Careers',
    'KCB Careers',
    'NCBA Careers',
    'Safaricom', -- if it exists
    'Mastercard Foundation',
    'Bill & Melinda Gates Foundation',
    'Rockefeller Foundation'
);

-- 3. MEDIUM (Runs every 6 hours / 360 mins)
-- Standard aggregators, specialized boards with moderate traffic
UPDATE public.job_sources
SET priority = 'medium', crawl_frequency_minutes = 360
WHERE priority = 'medium' AND name NOT IN (
    'Remote OK', 'CareerJet IT Manager', 'CareerJet IT', 'MyJobMag Kenya', 'BrighterMonday Kenya', 'We Work Remotely',
    'Corporate Staffing IT', 'Fuzu Kenya', 'UNICEF', 'UNOPS', 'UNDP Careers', 'World Bank Careers', 'African Development Bank',
    'Safal Group', 'Equity Bank Careers', 'KCB Careers', 'NCBA Careers', 'Mastercard Foundation', 'Bill & Melinda Gates Foundation', 'Rockefeller Foundation'
) AND name NOT LIKE '%Embassy%' AND name NOT LIKE '%Commission%';

-- 4. LOW (Runs every 24 hours / 1440 mins)
-- Slow-moving sites like embassies or very specific legacy sources
UPDATE public.job_sources
SET priority = 'low', crawl_frequency_minutes = 1440
WHERE name LIKE '%Embassy%' OR name LIKE '%Commission%' OR name = 'UN Talent Kenya' OR name = 'kenya job';
