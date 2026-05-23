const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8').split('\n');
const env = {};
for (const line of envFile) {
    const [k, v] = line.split('=');
    if (k && v) env[k.trim()] = v.trim();
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
    console.log("Updating CORE...");
    await supabase.from('job_sources').update({ priority: 'core', crawl_frequency_minutes: 60 })
        .in('name', ['Remote OK', 'CareerJet IT Manager', 'CareerJet IT', 'MyJobMag Kenya', 'BrighterMonday Kenya', 'We Work Remotely']);
        
    console.log("Updating HIGH...");
    await supabase.from('job_sources').update({ priority: 'high', crawl_frequency_minutes: 120 })
        .in('name', ['Corporate Staffing IT', 'Fuzu Kenya', 'UNICEF', 'UNOPS', 'UNDP Careers', 'World Bank Careers', 'African Development Bank', 'Safal Group', 'Equity Bank Careers', 'KCB Careers', 'NCBA Careers', 'Mastercard Foundation', 'Bill & Melinda Gates Foundation', 'Rockefeller Foundation']);
        
    console.log("Updating LOW...");
    await supabase.from('job_sources').update({ priority: 'low', crawl_frequency_minutes: 1440 })
        .in('name', ['U.S. Embassy Kenya', 'German Embassy Nairobi', 'High Commission of Canada in Kenya', 'Netherlands Embassy in Kenya', 'British High Commission Kenya', 'UN Talent Kenya', 'kenya job']);

    console.log("Done!");
}
run();
