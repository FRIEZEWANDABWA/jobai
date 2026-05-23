async function main() {
    try {
        const response = await fetch('https://remoteok.com/api', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            }
        });
        if (!response.ok) {
            console.error(`API returned ${response.status}`);
            return;
        }
        const data = await response.json();
        
        console.log("Is Array?", Array.isArray(data));
        if (Array.isArray(data)) {
            console.log("Length:", data.length);
            console.log("First item:", JSON.stringify(data[0], null, 2));
            console.log("Second item:", JSON.stringify(data[1], null, 2));
        } else {
            console.log("Keys:", Object.keys(data));
        }
    } catch (e) {
        console.error(e);
    }
}

main();
