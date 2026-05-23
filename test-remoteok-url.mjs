import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data: sources } = await supabase.from('job_sources').select('*').eq('name', 'Remote OK').limit(1);
    const source = sources[0];

    console.log("Base URL in DB:", source.base_url);
    const response = await fetch(source.base_url, {
        headers: {
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'application/json'
        }
    });
    const data = await response.json();
    console.log("Is array?", Array.isArray(data));
    if (Array.isArray(data)) console.log("Length:", data.length);
}

main();
