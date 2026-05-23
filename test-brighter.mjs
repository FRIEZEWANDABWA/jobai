import * as cheerio from 'cheerio';
import fs from 'fs';
const html = fs.readFileSync('brighter.html', 'utf8');
const $ = cheerio.load(html);
$('a[href*="/listings/"]').each((i, el) => {
    console.log($(el).attr('href'), $(el).text().trim().replace(/\s+/g, ' '));
});
