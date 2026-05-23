import * as cheerio from 'cheerio';
import fs from 'fs';

function extractJobs(file) {
    const html = fs.readFileSync(file, 'utf8');
    const $ = cheerio.load(html);
    console.log(`\n--- Extracting from ${file} ---`);
    
    // Find any anchor tags that look like job links
    const jobLinks = $('a').toArray().filter(el => {
        const href = $(el).attr('href') || '';
        return href.includes('/listings/') || href.includes('/jobs/') || href.includes('job-');
    });
    
    console.log(`Found ${jobLinks.length} potential job links.`);
    if (jobLinks.length > 0) {
        // Look at the parent elements of these links to find the job card class
        const parents = {};
        jobLinks.slice(0, 20).forEach(el => {
            const parentClass = $(el).parent().attr('class') || $(el).parent().parent().attr('class');
            if (parentClass) {
                parents[parentClass] = (parents[parentClass] || 0) + 1;
            }
        });
        console.log("Common parent classes:", Object.entries(parents).sort((a,b)=>b[1]-a[1]).slice(0, 3));
        
        console.log("First job link text:", $(jobLinks[0]).text().trim());
        console.log("First job link href:", $(jobLinks[0]).attr('href'));
        console.log("First job link parent HTML:", $(jobLinks[0]).parent().html().substring(0, 200));
    } else {
        // If no typical job links, let's just print the first 10 links
        const allLinks = $('a').toArray().slice(0, 10).map(el => $(el).attr('href'));
        console.log("First 10 links:", allLinks);
    }
}

extractJobs('brighter.html');
extractJobs('ajira.html');
