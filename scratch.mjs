import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data, error } = await supabase.from('job_sources').select('id, name, strategy, base_url, priority, parsing_config');
    if (error) {
        console.error('Error fetching job sources:', error);
        return;
    }
    console.log(JSON.stringify(data, null, 2));
}

main();
