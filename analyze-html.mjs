import * as cheerio from 'cheerio';
import fs from 'fs';

function findSelectors(file) {
    const html = fs.readFileSync(file, 'utf8');
    const $ = cheerio.load(html);
    
    console.log(`\n--- Inspecting ${file} ---`);
    const potentialCards = $('div[class*="job"], div[class*="card"], div[class*="list"], article, li[class*="job"]').toArray();
    
    // Group by class to find the most common repeating structures
    const classCounts = {};
    potentialCards.forEach(el => {
        const className = $(el).attr('class');
        if (className) {
            classCounts[className] = (classCounts[className] || 0) + 1;
        }
    });
    
    const sortedClasses = Object.entries(classCounts).sort((a,b) => b[1] - a[1]).slice(0, 5);
    console.log("Most common repeated classes containing 'job', 'card', 'list' or articles:");
    console.log(sortedClasses);
    
    // Test the top class to see what text it has
    if (sortedClasses.length > 0) {
        const topClass = sortedClasses[0][0].split(' ')[0]; // use first class name
        console.log(`\nTesting selector: .${topClass}`);
        const firstEl = $(`.${topClass}`).first();
        console.log("Text preview:", firstEl.text().replace(/\s+/g, ' ').substring(0, 150));
        console.log("Links found:", firstEl.find('a').length);
        if (firstEl.find('a').length > 0) {
             console.log("First link href:", firstEl.find('a').first().attr('href'));
             console.log("First link text:", firstEl.find('a').first().text().replace(/\s+/g, ' '));
        }
    }
}

findSelectors('brighter.html');
findSelectors('ajira.html');
findSelectors('carepay.html');
