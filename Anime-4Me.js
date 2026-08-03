function searchResults(html) {
    const results = [];

    const itemBlocks = html.match(
        /<div class="anime-card-themex">[\s\S]*?<h3[\s\S]*?<\/h3>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g
    );

    if (!itemBlocks) return results;


    itemBlocks.forEach(block => {

        const hrefMatch = block.match(
            /<a href="([^"]+)"/
        );

        const titleMatch = block.match(
            /<h3[^>]*>\s*<a[^>]*>\s*(.*?)\s*<\/a>/
        );

        const imgMatch = block.match(
            /data-image="([^"]+)"/
        );


        if (hrefMatch && titleMatch && imgMatch) {

            const href = hrefMatch[1].trim();

            const title = decodeHTMLEntities(
                titleMatch[1].trim()
            );

            const image = imgMatch[1].trim();


            results.push({
                title,
                image,
                href
            });
        }
    });


    return results;
}


function decodeHTMLEntities(text) {
    return text
        .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
}
