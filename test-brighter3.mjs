import * as cheerio from 'cheerio';
import fs from 'fs';
const html = fs.readFileSync('brighter.html', 'utf8');
const $ = cheerio.load(html);
const links = $('a[data-cy="listing-title-link"]').toArray();
if (links.length > 0) {
    const parent1 = $(links[0]).parent();
    const parent2 = parent1.parent();
    const parent3 = parent2.parent();
    console.log("P1:", parent1.get(0).tagName, parent1.attr('class'));
    console.log("P2:", parent2.get(0).tagName, parent2.attr('class'));
    console.log("P3:", parent3.get(0).tagName, parent3.attr('class'));
}
