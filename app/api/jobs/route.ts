import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
    try {
        // 1. Resolve the primary system user (The Executive)
        const { data: profiles } = await supabase
            .from('user_profiles')
            .select('id')
            .not('cv_embedding', 'is', null)
            .limit(1);

        const user = profiles?.[0];

        if (!user) {
            return NextResponse.json({ highMatches: [], strongMatches: [], otherJobs: [] });
        }

        const userId = user.id;

        // Fetch jobs with their match scores for this user
        // Join with applications to see status ('applied', 'rejected', etc)
        const { data: jobs, error } = await supabase
            .from('jobs')
            .select(`
         *,
         match_scores!inner(score),
         applications(status)
       `)
            .eq('match_scores.user_id', userId);

        if (error) throw error;

        // Fetch system_settings
        const { data: settings } = await supabase.from('system_settings').select('key, value');
        const dashThreshold = parseFloat(settings?.find(s => s.key === 'dashboard_threshold')?.value || '0.70');
        const notifyThreshold = parseFloat(settings?.find(s => s.key === 'notify_threshold')?.value || '0.85');

        // Categorize and filter out archived/rejected jobs
        const formattedJobs = jobs?.map(job => {
            const score = Array.isArray(job.match_scores) ? job.match_scores[0]?.score : (job.match_scores as any)?.score;

            // Extract the user's application status on this specific job
            let status = null;
            if (job.applications && Array.isArray(job.applications) && job.applications.length > 0) {
                status = job.applications[0].status;
            } else if (job.applications && (job.applications as any).status) {
                status = (job.applications as any).status;
            }

            return { ...job, match_score: score, status };
        }).filter(j => j.status !== 'rejected') // Do not show explicitly archived jobs in active feeds
            .sort((a, b) => b.match_score - a.match_score) || [];

        const unappliedJobs = formattedJobs.filter(j => !['applied', 'interviewing', 'offer'].includes(j.status));
        const appliedJobs = formattedJobs.filter(j => ['applied', 'interviewing', 'offer'].includes(j.status));

        const highMatches = unappliedJobs.filter(j => j.match_score >= notifyThreshold);
        const strongMatches = unappliedJobs.filter(j => j.match_score >= dashThreshold && j.match_score < notifyThreshold);
        const otherJobs = unappliedJobs.filter(j => j.match_score < dashThreshold);

        return NextResponse.json({ highMatches, strongMatches, otherJobs, appliedJobs });
    } catch (error: any) {
        console.error('Fetch Jobs Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
