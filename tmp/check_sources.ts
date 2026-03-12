
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkSources() {
    const { data: sources, error } = await supabase
        .from('job_sources')
        .select('name, last_run_at, parsing_config')
        .eq('active', true);

    if (error) {
        console.error('Error fetching sources:', error);
        return;
    }

    const now = new Date();
    console.log(`Current Time: ${now.toISOString()}`);
    console.log('--- Overdue Sources (Tier 1) ---');
    
    const overdueTier1 = sources?.filter(s => {
        const priority = s.parsing_config?.priority_level || 1;
        if (priority !== 1) return false;
        if (!s.last_run_at) return true;
        const diffMins = (now.getTime() - new Date(s.last_run_at).getTime()) / (1000 * 60);
        return diffMins >= 55;
    });

    overdueTier1?.forEach(s => {
        console.log(`- ${s.name}: Last run ${s.last_run_at || 'Never'}`);
    });

    console.log(`Total active Tier 1 sources: ${sources?.filter(s => (s.parsing_config?.priority_level || 1) === 1).length}`);
    console.log(`Total Tier 1 overdue: ${overdueTier1?.length}`);
    console.log(`Total active sources: ${sources?.length}`);
}

checkSources();
