async function main() {
    const url = 'https://api.reliefweb.int/v1/jobs?appname=jobhunter&profile=full&preset=latest&query[value]=IT+OR+Information+Technology+OR+Infrastructure&filter[field]=theme.name&filter[value]=Information+and+Communications+Technology';
    const res = await fetch(url);
    console.log("Status:", res.status);
    if (!res.ok) {
        console.log("Text:", await res.text());
    } else {
        const data = await res.json();
        console.log("Found jobs:", data.data ? data.data.length : 0);
    }
}
main();
