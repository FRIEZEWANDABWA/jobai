import * as cheerio from 'cheerio';
import fs from 'fs';
const html = fs.readFileSync('brighter.html', 'utf8');
const $ = cheerio.load(html);
const links = $('a[href*="/listings/"]').toArray();
if (links.length > 0) {
    const parent = $(links[0]).closest('div[class*="flex"]');
    console.log("Parent class:", parent.attr('class'));
    console.log("Parent HTML:", parent.html().substring(0, 500));
}
