-- 1. Update the check constraint to allow the 'google' type
ALTER TABLE public.job_sources 
DROP CONSTRAINT IF EXISTS job_sources_type_check;

ALTER TABLE public.job_sources 
ADD CONSTRAINT job_sources_type_check 
CHECK (type IN ('rss', 'api', 'html', 'google'));

-- 2. Insert the new Google SERP sources
INSERT INTO public.job_sources (name, base_url, type, category, parsing_config, active)
VALUES 
  ('Google SERP: LinkedIn Exec 1', 'https://www.google.com/search?q=site:linkedin.com/jobs+"IT+Manager"+Kenya&num=30&as_qdr=d', 'google', 'Google Jobs', '{"max_pages": 1, "priority_level": 2}', true),
  ('Google SERP: LinkedIn Exec 2', 'https://www.google.com/search?q=site:linkedin.com/jobs+"Head+of+IT"+Kenya&num=30&as_qdr=d', 'google', 'Google Jobs', '{"max_pages": 1, "priority_level": 2}', true),
  ('Google SERP: Multi-Board Exec', 'https://www.google.com/search?q=("IT+Manager"+OR+"Head+of+IT"+OR+"IT+Director")+Kenya+jobs&num=30&as_qdr=d', 'google', 'Google Jobs', '{"max_pages": 1, "priority_level": 2}', true),
  ('Google SERP: Corporate Kenya', 'https://www.google.com/search?q=("IT+Manager"+OR+"Head+of+IT"+OR+"IT+Director")+site:.co.ke+careers&num=30&as_qdr=d', 'google', 'Google Jobs', '{"max_pages": 1, "priority_level": 2}', true),
  ('Google SERP: Lever Jobs', 'https://www.google.com/search?q=("IT+Manager"+OR+"Head+of+IT")+Kenya+site:jobs.lever.co&num=30&as_qdr=d', 'google', 'Google Jobs', '{"max_pages": 1, "priority_level": 2}', true),
  ('Google SERP: NGO Leadership', 'https://www.google.com/search?q=("ICT+Manager"+OR+"IT+Manager")+Kenya+NGO&num=30&as_qdr=d', 'google', 'Google Jobs', '{"max_pages": 1, "priority_level": 2}', true);
