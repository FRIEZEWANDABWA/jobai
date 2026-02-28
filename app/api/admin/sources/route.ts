import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET all sources
export async function GET() {
    try {
        const { data, error } = await supabase.from('job_sources').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST new source
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { data, error } = await supabase.from('job_sources').insert([body]).select();
        if (error) throw error;
        return NextResponse.json(data[0]);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
