
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://wjtunfkhxqcwxzkacbp.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqdHVuZmtoeHFjd3p4Z2thY2JwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI1Njg4OCwiZXhwIjoyMDg3ODMyODg4fQ.fbZiNgA4kt65yoFrzNi8FDnlyRaOzb4QauZJ8nKtIiQ'
);

async function runAudit() {
    console.log('--- SYSTEM AUDIT START ---');
    const now = new Date();
    
    // 1. Audit Job Sources
    const { data: sources, error: sError } = await supabase.from('job_sources').select('*');
    if (sError) console.error('Error fetching sources:', sError);
    else {
        console.log(`\n[Job Sources] Total: ${sources.length}`);
        const tiers = { 1: 0, 2: 0, 3: 0, 4: 0 };
        const types = { html: 0, api: 0, rss: 0, google: 0 };
        let activeCount = 0;
        let overdueCount = 0;

        sources.forEach(s => {
            const tier = s.parsing_config?.priority_level || 1;
            tiers[tier] = (tiers[tier] || 0) + 1;
            types[s.type] = (types[s.type] || 0) + 1;
            if (s.active) activeCount++;
            
            const intervals = { 1: 55, 2: 350, 3: 710, 4: 1430 };
            const interval = intervals[tier] || 55;
            const diffMins = s.last_run_at ? (now.getTime() - new Date(s.last_run_at).getTime()) / (1000 * 60) : 99999;
            if (s.active && diffMins >= interval) overdueCount++;
        });

        console.log(`- Active: ${activeCount}`);
        console.log(`- Overdue (Active Only): ${overdueCount}`);
        console.log(`- Tiers: ${JSON.stringify(tiers)}`);
        console.log(`- Types: ${JSON.stringify(types)}`);
    }

    // 2. Audit System Settings
    const { data: settings, error: stError } = await supabase.from('system_settings').select('*');
    if (stError) console.error('Error fetching settings:', stError);
    else {
        console.log(`\n[System Settings]`);
        settings.forEach(s => console.log(`- ${s.key}: ${s.value}`));
    }

    // 3. Audit Recent Activity
    const { data: recentJobs, error: jError } = await supabase.from('jobs').select('count', { count: 'exact', head: true }).gt('created_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString());
    console.log(`\n[Recent Activity (24h)]`);
    console.log(`- New Jobs: ${recentJobs?.count || 0}`);

    const { data: recentMatches, error: mError } = await supabase.from('match_scores').select('count', { count: 'exact', head: true }).gt('calculated_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString());
    console.log(`- New AI Matches: ${recentMatches?.count || 0}`);

    // 4. Check for potential orphans or missing embeddings
    const { data: missingEmbeds } = await supabase.from('jobs').select('count', { count: 'exact', head: true }).is('embedding', null);
    console.log(`- Jobs missing embeddings: ${missingEmbeds?.count || 0}`);

    console.log('\n--- SYSTEM AUDIT END ---');
}

runAudit();
