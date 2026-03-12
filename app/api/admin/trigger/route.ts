import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const cronSecret = process.env.CRON_SECRET;
        const url = new URL(request.url);
        const baseUrl = `${url.protocol}//${url.host}`;

        // 1. Manually trigger Ingest with "force" to scan everything regardless of due status
        const ingestRes = await fetch(`${baseUrl}/api/cron/ingest`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${cronSecret}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ force: true })
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
