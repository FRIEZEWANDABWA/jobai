import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';
import fs from 'fs';

async function fetchWithBrowser(url, file) {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });
    const html = await page.content();
    fs.writeFileSync(file, html);
    console.log(`Saved fully rendered ${file}`);
    await browser.close();
}

async function main() {
    await fetchWithBrowser('https://www.ajirazone.com/jobs?category=Information+Technology', 'ajira-browser.html');
    await fetchWithBrowser('https://www.brightermonday.co.ke/jobs', 'brighter-browser.html');
    
    // Now let's analyze Ajira
    let html = fs.readFileSync('ajira-browser.html', 'utf8');
    let $ = cheerio.load(html);
    let jobLinks = $('a').toArray().filter(el => $(el).attr('href')?.includes('/jobs/'));
    console.log("Ajira Rendered Job Links:", jobLinks.length);
    if(jobLinks.length > 0) {
        console.log("First Ajira Link Parent Class:", $(jobLinks[0]).parent().attr('class'));
    }
}

main();
