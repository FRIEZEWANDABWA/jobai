import * as cheerio from 'cheerio';
import fs from 'fs';

async function checkSite(url, file) {
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const html = await res.text();
        fs.writeFileSync(file, html);
        console.log(`Saved ${file}`);
    } catch (e) {
        console.error(e);
    }
}

async function main() {
    await checkSite('https://www.brightermonday.co.ke/jobs', 'brighter.html');
    await checkSite('https://www.ajirazone.com/jobs?category=Information+Technology', 'ajira.html');
    await checkSite('https://carepay.bamboohr.com/careers', 'carepay.html');
}

main();
