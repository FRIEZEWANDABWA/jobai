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
            return NextResponse.json({ jobsFound: 0, highMatches: 0, applicationsSent: 0, conversionRate: 0 });
        }

        const userId = user.id;

        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const oneWeekAgoIso = oneWeekAgo.toISOString();

        // 1. Jobs found per week (total jobs inserted in last 7 days)
        const { count: jobsFound } = await supabase
            .from('jobs')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', oneWeekAgoIso);

        // 2. High matches per week (score >= 0.85 in last 7 days)
        const { count: highMatches } = await supabase
            .from('match_scores')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .gte('score', 0.85)
            .gte('calculated_at', oneWeekAgoIso);

        // 3. Applications sent per week
        const { count: applicationsSent } = await supabase
            .from('applications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('status', 'applied')
            .gte('applied_at', oneWeekAgoIso);

        // 4. Interview conversion rate
        const { count: totalApplications } = await supabase
            .from('applications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .in('status', ['applied', 'interviewing', 'rejected', 'offer']);

        const { count: interviews } = await supabase
            .from('applications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .in('status', ['interviewing', 'offer']);

        let conversionRate = 0;
        if (totalApplications && totalApplications > 0 && interviews) {
            conversionRate = (interviews / totalApplications) * 100;
        }

        return NextResponse.json({
            jobsFound: jobsFound || 0,
            highMatches: highMatches || 0,
            applicationsSent: applicationsSent || 0,
            conversionRate: conversionRate.toFixed(1)
        });
    } catch (error: any) {
        console.error('Fetch Velocity Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
