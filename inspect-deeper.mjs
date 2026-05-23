import * as cheerio from 'cheerio';
import fs from 'fs';

function inspectBrighter() {
    const html = fs.readFileSync('brighter.html', 'utf8');
    const $ = cheerio.load(html);
    
    const items = $('div.relative').toArray(); // often jobs are in a relative container
    console.log("Brighter relative divs:", items.length);
    
    // Let's just find an element containing "software", "developer", "manager" etc
    const jobElements = $('*').filter((i, el) => {
        const text = $(el).text().toLowerCase();
        return text.includes('software') || text.includes('developer');
    }).toArray();
    
    if (jobElements.length > 0) {
        // find deepest elements with that text
        console.log("Found text 'software/developer' in elements. E.g. class:", $(jobElements[jobElements.length-1]).attr('class'));
    }
}

function inspectAjira() {
    const html = fs.readFileSync('ajira.html', 'utf8');
    const $ = cheerio.load(html);
    
    const items = $('.flex-1').toArray();
    if (items.length > 0) {
        console.log("Ajira First Flex-1 item:");
        console.log($(items[0]).html().substring(0, 500));
        console.log("Ajira Parent of Flex-1:");
        console.log($(items[0]).parent().attr('class'));
    }
}

inspectBrighter();
inspectAjira();
