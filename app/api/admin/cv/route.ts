import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { generateEmbedding } from '@/lib/openai';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { userId, cvText } = body;

        if (!userId || !cvText) {
            return NextResponse.json({ error: 'Missing userId or cvText' }, { status: 400 });
        }

        // 1. Generate Embedding from OpenAI
        const embedding = await generateEmbedding(cvText);

        // 2. Save CV Text and Embedding to user_profiles
        const { error } = await supabase
            .from('user_profiles')
            .update({
                cv_text: cvText,
                cv_embedding: embedding,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId);

        if (error) {
            console.error("Supabase Error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'CV uploaded and embedded successfully' });
    } catch (error: any) {
        console.error('CV Upload Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
