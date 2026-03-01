import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const cronSecret = process.env.CRON_SECRET;
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://jobmakerai.vercel.app';

        // 1. Manually trigger Ingest
        const ingestRes = await fetch(`${baseUrl}/api/cron/ingest`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${cronSecret}` }
        });
        const ingestData = await ingestRes.json();

        // 2. Delay slightly for DB propagation
        await new Promise(r => setTimeout(r, 2000));

        // 3. Manually trigger Match
        const matchRes = await fetch(`${baseUrl}/api/cron/match`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${cronSecret}` }
        });
        const matchData = await matchRes.json();

        return NextResponse.json({ success: true, ingestData, matchData });
    } catch (error: any) {
        console.error('Trigger Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
