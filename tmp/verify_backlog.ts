
import { createClient } from '@supabase/supabase-js';

// Hardcoded for verification as dotenv failed
const supabase = createClient(
    'https://wjtunfkhxqcwxzkacbp.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqdHVuZmtoeHFjd3p4Z2thY2JwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI1Njg4OCwiZXhwIjoyMDg3ODMyODg4fQ.fbZiNgA4kt65yoFrzNi8FDnlyRaOzb4QauZJ8nKtIiQ'
);

async function checkSources() {
    const { data: sources, error } = await supabase
        .from('job_sources')
        .select('name, last_run_at, parsing_config, type')
        .eq('active', true);

    if (error) {
        console.error('Error fetching sources:', error);
        return;
    }

    const now = new Date();
    console.log(`Current Time (UTC): ${now.toISOString()}`);
    
    const overdueTier1 = sources?.filter(s => {
        const priority = s.parsing_config?.priority_level || 1;
        if (priority !== 1) return false;
        if (!s.last_run_at) return true;
        const diffMins = (now.getTime() - new Date(s.last_run_at).getTime()) / (1000 * 60);
        return diffMins >= 55;
    });

    console.log('\n--- OVERDUE TIER 1 SOURCES ---');
    overdueTier1?.forEach(s => {
        console.log(`- ${s.name}: Last run ${s.last_run_at || 'Never'}`);
    });

    const standardOverdue = sources?.filter(s => s.type !== 'google' && (s.parsing_config?.priority_level || 1) !== 1);
    const googleOverdue = sources?.filter(s => s.type === 'google');

    console.log(`\n--- STATISTICS ---`);
    console.log(`Total Tier 1 overdue: ${overdueTier1?.length}`);
    console.log(`Total Google sources: ${googleOverdue?.length}`);
    console.log(`Total active sources: ${sources?.length}`);
    
    // Simulating new batching logic
    const batchSize = 15;
    const googleBatch = 1;
    
    console.log(`\n--- NEW BATCHING SIMULATION ---`);
    const dueStandard = sources?.filter(s => s.type !== 'google' && (
         !s.last_run_at || 
         (now.getTime() - new Date(s.last_run_at).getTime()) / (1000 * 60) >= (s.parsing_config?.priority_level === 1 ? 55 : 350)
    )).sort((a,b) => (a.parsing_config?.priority_level || 1) - (b.parsing_config?.priority_level || 1));
    
    console.log(`Standard sources due: ${dueStandard?.length}`);
    console.log(`Next batch would process: ${dueStandard?.slice(0, batchSize).map(s => s.name).join(', ')}`);
}

checkSources();
