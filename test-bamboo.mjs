import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testBambooHR() {
    const baseUrl = 'https://carepay.bamboohr.com/careers';
    const match = baseUrl.match(/https:\/\/([^.]+)\.bamboohr\.com/);
    if (!match) {
        console.error("No subdomain match");
        return;
    }
    const subdomain = match[1];
    const apiUrl = `https://${subdomain}.bamboohr.com/careers/list`; // Try standard JSON endpoint

    console.log(`Fetching from API: ${apiUrl}`);
    const res = await fetch(apiUrl, { headers: { 'Accept': 'application/json' }});
    
    if (res.ok) {
        const text = await res.text();
        try {
            const data = JSON.parse(text);
            console.log("JSON Success! Data length:", data?.result?.length || data?.length || Object.keys(data).length);
        } catch(e) {
            console.log("Not JSON. Starts with:", text.substring(0, 100));
        }
    } else {
        console.log(`Failed with status ${res.status}`);
    }
}

testBambooHR();
