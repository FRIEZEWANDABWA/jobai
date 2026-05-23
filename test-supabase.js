const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8').split('\n');
const env = {};
for (const line of envFile) {
    const [k, v] = line.split('=');
    if (k && v) env[k.trim()] = v.trim();
}

let url = env.NEXT_PUBLIC_SUPABASE_URL;
let key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(url, key);

async function test() {
    const { data, error } = await supabase.from('job_sources').select('*').limit(1);
    console.log('Error:', error);
    console.log('Data:', data);
}
test();
