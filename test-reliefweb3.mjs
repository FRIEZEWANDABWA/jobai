async function main() {
    const url = 'https://api.reliefweb.int/v1/jobs?appname=rwint&profile=full&preset=latest&query[value]=IT+OR+Information+Technology+OR+Infrastructure&filter[field]=theme.name&filter[value]=Information+and+Communications+Technology';
    const res = await fetch(url);
    console.log("Status v1:", res.status, await res.text());

    const url2 = 'https://api.reliefweb.int/v2/jobs?appname=rwint&profile=full&preset=latest&query[value]=IT+OR+Information+Technology+OR+Infrastructure&filter[field]=theme.name&filter[value]=Information+and+Communications+Technology';
    const res2 = await fetch(url2);
    console.log("Status v2:", res2.status);
    if (!res2.ok) {
        console.log("Text:", await res2.text());
    } else {
        const data = await res2.json();
        console.log("Found:", data.data ? data.data.length : 0);
    }
}
main();
