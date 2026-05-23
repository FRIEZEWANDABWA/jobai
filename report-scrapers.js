require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function generateReport() {
    const { data, error } = await supabase.from('job_sources').select('name, strategy, base_url, source_health, active').order('name');
    if (error) {
        console.error(error);
        return;
    }
    
    let working = [];
    let zeroJobs = [];
    let degraded = [];
    
    for (const source of data) {
        if (!source.active) continue;
        const health = source.source_health || {};
        const status = health.status || 'unknown';
        const found = health.jobs_found_last_run || 0;
        
        if (status === 'healthy' && found > 0) {
            working.push(source);
        } else if (status === 'healthy' && found === 0) {
            zeroJobs.push(source);
        } else if (status === 'degraded') {
            degraded.push(source);
        }
    }
    
    console.log(`\n=== 🟢 WORKING PERFECTLY (${working.length}) ===`);
    working.forEach(s => console.log(`- ${s.name} (${s.strategy}): Found ${s.source_health.jobs_found_last_run}`));
    
    console.log(`\n=== 🟡 WORKING BUT NO NEW JOBS (${zeroJobs.length}) ===`);
    zeroJobs.forEach(s => console.log(`- ${s.name} (${s.strategy})`));
    
    console.log(`\n=== 🔴 DEGRADED / BROKEN (${degraded.length}) ===`);
    degraded.forEach(s => {
        let reason = "Likely outdated CSS selectors or Site changed.";
        if (s.strategy === 'api') reason = "API Endpoint blocked or deprecated.";
        if (s.strategy === 'proxy_html' || s.strategy === 'browser') reason = "Requires Proxy URL or JS execution failed.";
        if (s.strategy.startsWith('ats_')) reason = "ATS Template might need updating or subdomain changed.";
        console.log(`- ${s.name} [${s.strategy}]: ${reason}`);
    });
}

generateReport();
