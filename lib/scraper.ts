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
 * Note: These are simplified implementations. In production, 
 * html parsing typically requires 'cheerio' and mapping 'parsing_config',
 * and rss requires 'rss-parser'.
 */
export async function scrapeSource(source: import('../types/source').JobSource): Promise<Partial<Job>[]> {
    try {
        switch (source.type) {
            case 'api':
                return await scrapeApi(source);
            case 'rss':
                return await scrapeRss(source);
            case 'html':
                return await scrapeHtml(source);
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
async function scrapeApi(source: import('../types/source').JobSource): Promise<Partial<Job>[]> {
    const response = await fetch(source.base_url);
    if (!response.ok) throw new Error(`API returned ${response.status}`);

    const data = await response.json();
    // Assuming the API returns a 'data' array and the parsing config tells us the keys
    const config = source.parsing_config || {};

    const jobs: Partial<Job>[] = [];

    // Example generalized extraction based on config mapping
    const items = data[config.resultsKey || 'data'] || [];

    for (const item of items) {
        const title = item[config.titleKey || 'title'] || 'Unknown Title';
        const company = item[config.companyKey || 'organization'] || source.name;
        const url = item[config.urlKey || 'url'] || '';
        const date = item[config.dateKey || 'date'] || null;

        jobs.push({
            title,
            company,
            location: item[config.locationKey || 'location'] || null,
            description: item[config.descriptionKey || 'body'] || `Job at ${company}`,
            url,
            posted_date: date,
            dedupe_hash: generateDedupeHash(title, company, date),
            source_id: source.id
        });
    }

    return jobs;
}

// 2. RSS Scraper Example (Using generic fetch, would normally use 'rss-parser')
async function scrapeRss(source: import('../types/source').JobSource): Promise<Partial<Job>[]> {
    console.log(`Mock RSS Scrape for ${source.name}`);
    // Implementation goes here
    return [];
}

// 3. HTML Scraper Example (Using fetch and cheerio)
async function scrapeHtml(source: import('../types/source').JobSource): Promise<Partial<Job>[]> {
    console.log(`HTML Scrape for ${source.name} via ${source.base_url}`);

    try {
        const response = await fetch(source.base_url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 JobHunterAI/1.0",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5"
            }
        });

        if (!response.ok) {
            console.error(`HTML scrape failed for ${source.name} with status ${response.status}`);
            return [];
        }

        const html = await response.text();
        const $ = cheerio.load(html);
        const config = source.parsing_config || {};

        const itemSelector = config.item || 'article, .job, .job-listing, .card';
        const titleSelector = config.title || 'h2, h3, .title';
        const companySelector = config.company || '.company, .employer';
        const locationSelector = config.location || '.location';
        const linkSelector = config.url || 'a';
        const descSelector = config.description || '.description, .summary, .content, p';

        const jobs: Partial<Job>[] = [];

        $(itemSelector).each((_, element) => {
            const title = $(element).find(titleSelector).first().text().trim();
            const companyRaw = $(element).find(companySelector).first().text().trim() || source.name;
            const company = companyRaw.replace(/\s+/g, ' ');

            let url = $(element).find(linkSelector).first().attr('href') || '';
            if (!url) { // If linkSelector wasn't found deep inside, maybe the item IS the A tag
                url = $(element).attr('href') || source.base_url;
            }

            if (url.startsWith('/')) {
                const baseUrlObj = new URL(source.base_url);
                url = `${baseUrlObj.protocol}//${baseUrlObj.host}${url}`;
            }

            const location = $(element).find(locationSelector).first().text().trim() || null;

            if (title) {
                let description = $(element).find(descSelector).text().trim() || $(element).text().trim();
                description = description.replace(/\s+/g, ' ').substring(0, 1500) || `${title} at ${company} in ${location || 'Kenya'}.`;

                jobs.push({
                    title,
                    company,
                    location,
                    description,
                    url,
                    posted_date: new Date().toISOString(),
                    dedupe_hash: generateDedupeHash(title, company, new Date().toISOString()),
                    source_id: source.id
                });
            }
        });

        return jobs;
    } catch (error) {
        console.error(`Exception while running HTML parsing on ${source.name}:`, error);
        return [];
    }
}
