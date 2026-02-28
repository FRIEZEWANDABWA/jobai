import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { job_id, status } = body;

        if (!job_id || !status) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        // Resolve user
        const { data: profiles } = await supabase
            .from('user_profiles')
            .select('id')
            .not('cv_embedding', 'is', null)
            .limit(1);

        const user = profiles?.[0];
        if (!user) {
            return NextResponse.json({ error: 'No user found' }, { status: 401 });
        }

        const payload: any = {
            user_id: user.id,
            job_id,
            status
        };

        // If applied status, log the time
        if (status === 'applied') {
            payload.applied_at = new Date().toISOString();
        }

        // Upsert the application status
        const { data, error } = await supabase
            .from('applications')
            .upsert(payload, { onConflict: 'user_id,job_id' })
            .select();

        if (error) throw error;

        return NextResponse.json({ success: true, application: data[0] });

    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 });
    }
}
