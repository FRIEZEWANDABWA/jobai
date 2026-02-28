import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId'); // In production, get from session

    if (!userId) {
        return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    try {
        // Fetch jobs with their match scores for this user
        const { data: jobs, error } = await supabase
            .from('jobs')
            .select(`
         *,
         match_scores!inner(score)
       `)
            .eq('match_scores.user_id', userId)
            .order('match_scores(score)', { ascending: false });

        if (error) throw error;

        // Fetch system_settings
        const { data: settings } = await supabase.from('system_settings').select('key, value');
        const dashThreshold = parseFloat(settings?.find(s => s.key === 'dashboard_threshold')?.value || '0.70');
        const notifyThreshold = parseFloat(settings?.find(s => s.key === 'notify_threshold')?.value || '0.85');

        // Categorize
        const formattedJobs = jobs?.map(job => {
            // Handle array wrap from standard Supabase join notation
            const score = Array.isArray(job.match_scores) ? job.match_scores[0]?.score : (job.match_scores as any)?.score;
            return { ...job, match_score: score };
        }) || [];

        const highMatches = formattedJobs.filter(j => j.match_score >= notifyThreshold);
        const strongMatches = formattedJobs.filter(j => j.match_score >= dashThreshold && j.match_score < notifyThreshold);
        const otherJobs = formattedJobs.filter(j => j.match_score < dashThreshold);

        return NextResponse.json({ highMatches, strongMatches, otherJobs });
    } catch (error: any) {
        console.error('Fetch Jobs Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
