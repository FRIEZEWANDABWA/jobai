import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { generateEmbedding } from '@/lib/openai';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { cvText, email } = body;

        if (!cvText || !email) {
            return NextResponse.json({ error: 'Missing cvText or email' }, { status: 400 });
        }

        // 1. Try to find the user in auth, or create them
        let { data: usersData } = await supabase.auth.admin.listUsers();
        let targetUser = usersData.users?.find(u => u.email === email);

        if (!targetUser) {
            const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
                email: email,
                email_confirm: true,
                password: crypto.randomUUID() + 'A1!'
            });
            if (createError) throw createError;
            targetUser = newUser.user;

            // Allow the Postgres trigger time to create the user_profile record
            await new Promise(r => setTimeout(r, 2000));
        }

        // 2. Generate Embedding from OpenAI
        const embedding = await generateEmbedding(cvText);

        // 3. Save CV Text and Embedding to user_profiles
        const { error } = await supabase
            .from('user_profiles')
            .update({
                cv_text: cvText,
                cv_embedding: embedding,
                updated_at: new Date().toISOString()
            })
            .eq('id', targetUser.id);

        if (error) {
            console.error("Supabase Error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'CV uploaded, Embedded, and User Armed successfully', userId: targetUser.id });
    } catch (error: any) {
        console.error('CV Upload Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
