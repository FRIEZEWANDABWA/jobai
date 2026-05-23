import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

function normalizeText(text) {
    if (!text) return '';
    let norm = text.toLowerCase().trim();
    norm = norm.replace(/\bsr\.?\b/g, 'senior');
    norm = norm.replace(/\bjr\.?\b/g, 'junior');
    norm = norm.replace(/[^\w\s]|_/g, '').replace(/\s+/g, ' ');
    return norm;
}

function generateDedupeHash(title, company, dateStr) {
    const normTitle = normalizeText(title);
    const normCompany = normalizeText(company);
    const normDate = dateStr ? new Date(dateStr).toISOString().split('T')[0] : '';
    const rawString = `${normTitle}|${normCompany}|${normDate}`;
    return crypto.createHash('sha256').update(rawString).digest('hex');
}

async function scrapeApiTest() {
    try {
        const { data: sources } = await supabase.from('job_sources').select('*').eq('name', 'Remote OK').limit(1);
        const source = sources[0];

        const { data: existingJobs } = await supabase
            .from('jobs')
            .select('dedupe_hash')
            .eq('source_id', source.id)
            .order('created_at', { ascending: false })
            .limit(500);

        const existingHashes = new Set(
            existingJobs?.map((j) => j.dedupe_hash) || []
        );

        console.log("Existing hashes count:", existingHashes.size);

        const response = await fetch(source.base_url, {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'application/json'
            }
        });
        const data = await response.json();

        const items = Array.isArray(data)
                ? data.filter((item) => item && item.id)
                : [];
        
        console.log("Fetched items:", items.length);

        const jobs = [];

        for (const item of items) {
                const title =
                    item.position ||
                    item.role ||
                    item.title ||
                    'Unknown Title';

                const company =
                    item.company ||
                    'RemoteOK';

                const url =
                    item.url ||
                    `https://remoteok.com/remote-jobs/${item.id}`;

                const date =
                    item.date ||
                    new Date().toISOString();

                const hash = generateDedupeHash(title, company, date);

                if (existingHashes.has(hash)) {
                    continue;
                }

                existingHashes.add(hash);

                jobs.push({
                    title,
                    company,
                    location:
                        item.location ||
                        'Remote',

                    description:
                        item.description ||
                        `${title} at ${company}`,

                    url,
                    posted_date: date,
                    dedupe_hash: hash,
                    source_id: source.id
                });
        }
        
        console.log("Jobs to insert:", jobs.length);
        if (jobs.length > 0) {
           console.log("First job to insert:", jobs[0].title, jobs[0].company, jobs[0].dedupe_hash);
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

scrapeApiTest();
