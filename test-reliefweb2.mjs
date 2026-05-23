async function main() {
    const url = 'https://api.reliefweb.int/v2/jobs?appname=jobhunter&profile=full&preset=latest&query[value]=IT+OR+Information+Technology+OR+Infrastructure&filter[field]=theme.name&filter[value]=Information+and+Communications+Technology';
    const res = await fetch(url);
    console.log("Status:", res.status);
    if (!res.ok) {
        console.log("Text:", await res.text());
    } else {
        const data = await res.json();
        console.log("Keys:", Object.keys(data));
        if (data.data) {
            console.log("Found jobs:", data.data.length);
            console.log("Sample:", JSON.stringify(data.data[0], null, 2));
        }
    }
}
main();
