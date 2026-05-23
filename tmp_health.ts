
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function healthCheck() {
    console.log('--- SYSTEM HEALTH CHECK (Last 24h) ---');
    const now = new Date();
    
    // 1. Check sources
    const { data: sources } = await supabase
        .from('job_sources')
        .select('name, last_run_at, parsing_config, active')
        .eq('active', true);

    if (sources) {
        const t1 = sources.filter(s => (s.parsing_config?.priority_level || 1) === 1);
        const t1UpdatedLastHour = t1.filter(s => {
            if (!s.last_run_at) return false;
            const diff = (now.getTime() - new Date(s.last_run_at).getTime()) / (1000 * 60);
            return diff <= 120; // Within 2 hours (accounting for potential delay)
        });
        console.log(`Tier 1 Status: ${t1UpdatedLastHour.length}/${t1.length} recently updated.`);
    }

    // 2. Check jobs
    const { data: jobCount } = await supabase
        .from('jobs')
        .select('count', { count: 'exact', head: true })
        .gt('created_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString());
    
    console.log(`Jobs ingested (24h): ${jobCount?.count || 0}`);

    // 3. Check matches
    const { data: matchCount } = await supabase
        .from('match_scores')
        .select('count', { count: 'exact', head: true })
        .gt('calculated_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString());
    
    console.log(`AI Matches processed (24h): ${matchCount?.count || 0}`);

    console.log('--- END CHECK ---');
}

healthCheck();
