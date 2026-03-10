import crypto from 'crypto';
import * as cheerio from 'cheerio';
import { Job } from '../types/job';

/**
 * Creates a unique SHA-256 hash for deduplication based on Title, Company, and Posted Date
 */
export function generateDedupeHash(title: string, company: string, dateStr?: string | null): string {
    const normTitle = title.trim().toLowerCase();
    const normCompany = company.trim().toLowerCase();
    // Ensure date uses a standard YYYY-MM-DD format if available, else omit
    const normDate = dateStr ? new Date(dateStr).toISOString().split('T')[0] : '';

    const rawString = `${normTitle}|${normCompany}|${normDate}`;
    return crypto.createHash('sha256').update(rawString).digest('hex');
}

/**
 * Main scraper dispatcher based on JobSource type.
 */
export async function scrapeSource(source: import('../types/source').JobSource, existingHashes: Set<string> = new Set()): Promise<Partial<Job>[]> {
    try {
        switch (source.type) {
            case 'api':
                return await scrapeApi(source, existingHashes);
            case 'rss':
                return await scrapeRss(source, existingHashes);
            case 'html':
                return await scrapeHtml(source, existingHashes);
            default:
                console.warn(`Unsupported source type: ${source.type} for source ${source.name}`);
                return [];
        }
    } catch (error) {
        console.error(`Error scraping source ${source.name}:`, error);
        return [];
    }
}

// 1. API Scraper Example (e.g., ReliefWeb API)
async function scrapeApi(source: import('../types/source').JobSource, existingHashes: Set<string>): Promise<Partial<Job>[]> {
    const response = await fetch(source.base_url);
    if (!response.ok) throw new Error(`API returned ${response.status}`);

    const data = await response.json();
    const config = source.parsing_config || {};
    const jobs: Partial<Job>[] = [];
    const items = data[config.resultsKey || 'data'] || [];

    for (const item of items) {
        const title = item[config.titleKey || 'title'] || 'Unknown Title';
        const company = item[config.companyKey || 'organization'] || source.name;
        const url = item[config.urlKey || 'url'] || '';
        const date = item[config.dateKey || 'date'] || null;

        const hash = generateDedupeHash(title, company, date);
        if (existingHashes.has(hash)) continue; // Skip existing
        existingHashes.add(hash);

        jobs.push({
            title,
            company,
            location: item[config.locationKey || 'location'] || null,
            description: item[config.descriptionKey || 'body'] || `Job at ${company}`,
            url,
            posted_date: date,
            dedupe_hash: hash,
            source_id: source.id
        });
    }

    return jobs;
}

// 2. RSS Scraper Example (Using generic fetch, would normally use 'rss-parser')
async function scrapeRss(source: import('../types/source').JobSource, existingHashes: Set<string>): Promise<Partial<Job>[]> {
    console.log(`Mock RSS Scrape for ${source.name}`);
    return [];
}

// 3. HTML Scraper Example (Using fetch and cheerio, with pagination logic)
async function scrapeHtml(source: import('../types/source').JobSource, existingHashes: Set<string>): Promise<Partial<Job>[]> {
    console.log(`HTML Scrape for ${source.name} via ${source.base_url}`);

    // If a PROXY_URL is set, we can route fetches through a headless service (e.g., BrightData / Browserbase)
    // to bypass JavaScript and advanced Cloudflare protections.
    const useProxy = !!process.env.PROXY_URL;
    
    // Default to a 5 page maximum if not provided
    const maxPages = source.parsing_config?.max_pages || 5; 
    const paginationParam = source.parsing_config?.pagination_param || 'page'; // default to ?page=2

    const jobs: Partial<Job>[] = [];
    let page = 1;

    try {
        while (page <= maxPages) {
            let pageUrl = source.base_url;
            
            if (page > 1) {
                if (paginationParam === 'path') {
                    // converts https://example.com/jobs -> https://example.com/jobs/page/2
                    pageUrl = pageUrl.replace(/\/$/, '') + '/page/' + page;
                } else {
                    const separator = pageUrl.includes('?') ? '&' : '?';
                    pageUrl += `${separator}${paginationParam}=${page}`;
                }
            }

            console.log(`Scraping page ${page}: ${pageUrl}`);
            const fetchUrl = useProxy ? `${process.env.PROXY_URL}?url=${encodeURIComponent(pageUrl)}` : pageUrl;

            const response = await fetch(fetchUrl, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 JobHunterAI/2.0",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.5"
                }
            });

            if (!response.ok) {
                console.error(`HTML scrape failed for ${source.name} with status ${response.status}`);
                break;
            }

            const html = await response.text();
            const $ = cheerio.load(html);
            const config = source.parsing_config || {};

            const itemSelector = config.item || 'article, .job, .job-listing, .card';
            const titleSelector = config.title || 'h2, h3, .title';
            const companySelector = config.company || '.company, .employer';
            const locationSelector = config.location || '.location';
            const linkSelector = config.url || 'h2 a, h3 a, h4 a, .title a, a.job-title, a[data-href]';
            const descSelector = config.description || '.description, .summary, .content, p';

            let newJobsOnPage = 0;
            let hitExistingJob = false;
            const nodes = $(itemSelector).toArray();

            if (nodes.length === 0) {
                console.log(`No parsable items found on page ${page} using selector '${itemSelector}'. Stopping.`);
                break;
            }

            for (const element of nodes) {
                const title = $(element).find(titleSelector).first().text().trim();
                const companyRaw = $(element).find(companySelector).first().text().trim() || source.name;
                const company = companyRaw.replace(/\s+/g, ' ');

                let url = $(element).find(linkSelector).first().attr('href') || '';
                if (!url) { 
                    url = $(element).attr('href') || source.base_url;
                }

                if (url.startsWith('/')) {
                    const baseUrlObj = new URL(source.base_url);
                    url = `${baseUrlObj.protocol}//${baseUrlObj.host}${url}`;
                }

                if (!title) continue;

                const location = $(element).find(locationSelector).first().text().trim() || null;
                
                let description = $(element).find(descSelector).text().trim() || $(element).text().trim();
                description = description.replace(/\s+/g, ' ').substring(0, 1500) || `${title} at ${company} in ${location || 'Kenya'}.`;

                // Calculate hash without date. If we use new Date() it creates duplicates across days
                const hash = generateDedupeHash(title, company, null); 

                if (existingHashes.has(hash)) {
                    hitExistingJob = true;
                    continue; 
                }

                existingHashes.add(hash);
                newJobsOnPage++;
                
                jobs.push({
                    title,
                    company,
                    location,
                    description,
                    url,
                    posted_date: new Date().toISOString(), // Fallback posted date if source lacks it
                    dedupe_hash: hash,
                    source_id: source.id
                });
            }

            // SMART PAGINATION: Stop scanning deeper pages if we are hitting jobs we already have
            if (hitExistingJob) {
                console.log(`Encountered existing job on page ${page}. Stopping pagination to save resources.`);
                break;
            }

            if (newJobsOnPage === 0) {
                console.log(`No new distinct jobs found on page ${page}. Stopping.`);
                break;
            }

            page++;
            // Be polite to the servers
            await new Promise(r => setTimeout(r, 1500));
        }

        return jobs;
    } catch (error) {
        console.error(`Exception while running HTML parsing on ${source.name}:`, error);
        return jobs; // Return whatever we gathered before error
    }
}
