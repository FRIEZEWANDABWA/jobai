import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { username, password } = await request.json();

        // The secure credentials you provided
        if (username === 'Frieze' && password === 'Hakuna@123') {
            const response = NextResponse.json({ success: true, message: 'Authenticated' });

            // Set a secure, HTTPOnly cookie that lasts for 30 days
            response.cookies.set({
                name: 'ai_executive_auth',
                value: 'frieze_verified_session',
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 60 * 60 * 24 * 30, // 30 Days
                path: '/',
            });

            return response;
        }

        return NextResponse.json({ success: false, error: 'Invalid executive credentials' }, { status: 401 });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
