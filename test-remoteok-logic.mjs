import crypto from 'crypto';

function normalizeText(text) {
    if (!text) return '';
    let norm = text.toLowerCase().trim();
    norm = norm.replace(/\bsr\.?\b/g, 'senior');
    norm = norm.replace(/\bjr\.?\b/g, 'junior');
    norm = norm.replace(/[^\w\s]|_/g, '').replace(/\s+/g, ' ');
    return norm;
}

function generateDedupeHash(title, company, dateStr) {
    const normTitle = normalizeText(title);
    const normCompany = normalizeText(company);
    const normDate = dateStr ? new Date(dateStr).toISOString().split('T')[0] : '';

    const rawString = `${normTitle}|${normCompany}|${normDate}`;
    return crypto.createHash('sha256').update(rawString).digest('hex');
}

async function scrapeApiTest() {
    try {
        const response = await fetch('https://remoteok.com/api', {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'application/json'
            }
        });
        const data = await response.json();

        const items = Array.isArray(data) ? data.filter(item => item && item.id) : [];

        console.log("Total items found with ID:", items.length);

        if (items.length > 0) {
            const item = items[0];
            const title = item.position || item.role || item.title || 'Unknown Title';
            const company = item.company || 'RemoteOK';
            const url = item.url || `https://remoteok.com/remote-jobs/${item.id}`;
            const date = item.date || new Date().toISOString();

            console.log("First processed item:");
            console.log({ title, company, url, date });
            const hash = generateDedupeHash(title, company, date);
            console.log("Hash:", hash);
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

scrapeApiTest();
