import * as cheerio from 'cheerio';

async function checkSite(url) {
    console.log(`\nChecking: ${url}`);
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        });
        const html = await res.text();
        const $ = cheerio.load(html);
        console.log(`Title: ${$('title').text()}`);
        console.log("Body length:", html.length);
        
        // BrighterMonday check
        if (url.includes('brightermonday')) {
             console.log("Listings:", $('.listings-item').length);
             console.log("Cards:", $('.card').length);
             console.log("Job listings:", $('[data-cy="job-card"]').length);
        }
        
        // AjiraZone check
        if (url.includes('ajirazone')) {
             console.log("Jobs:", $('.job-list-item').length);
             console.log("Job listing:", $('.job-listing').length);
        }
    } catch (e) {
        console.error("Error:", e.message);
    }
}

async function main() {
    await checkSite('https://www.brightermonday.co.ke/jobs');
    await checkSite('https://www.ajirazone.com/jobs?category=Information+Technology');
    await checkSite('https://carepay.bamboohr.com/careers');
}

main();
