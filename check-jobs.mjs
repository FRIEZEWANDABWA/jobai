import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data, error } = await supabase.from('jobs').select('title, company, created_at, dedupe_hash').eq('source_id', 'c95e1e07-6c84-48db-bdad-fae97b8304ab').order('created_at', { ascending: false }).limit(5);
    if (error) {
        console.error(error);
        return;
    }
    console.log("Latest RemoteOK jobs in DB:");
    console.log(data);
}

main();
