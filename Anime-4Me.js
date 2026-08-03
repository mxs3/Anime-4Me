async function searchResults(keyword) {
    const results = [];

    const response = await soraFetch(
        `https://4i.a8x1c7v.shop/?s=${encodeURIComponent(keyword)}`
    );

    const html = await response.text();


    const regex = /<div class="anime-card-themex">[\s\S]*?<img class="img-responsive imgInit"[\s\S]*?data-image="([^"]+)"[\s\S]*?<a href="([^"]+)"[\s\S]*?<h3[^>]*>[\s\S]*?>([\s\S]*?)<\/a>[\s\S]*?<\/h3>/gu;


    let match;

    while ((match = regex.exec(html)) !== null) {

        const image = match[1].trim();

        const href = match[2].trim();

        const title = decodeHTMLEntities(
            match[3]
            .replace(/<[^>]*>/g, "")
            .replace(/\s+/g, " ")
            .trim()
        );


        if (title && href) {
            results.push({
                title,
                image,
                href
            });
        }
    }


    console.log(`Search Results: ${JSON.stringify(results)}`);

    return JSON.stringify(results);
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

async function extractDetails(url) {
    const response = await soraFetch(url);
    const html = await response.text();

    const details = {
        title: "",
        image: "",
        description: "",
        type: "",
        episodes: []
    };

    // العنوان
    let titleMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/s);
    if (!titleMatch) {
        titleMatch = html.match(/<h3[^>]*>حلقات\s+(.*?)<\/h3>/s);
    }

    if (titleMatch) {
        details.title = titleMatch[1]
            .replace(/<[^>]+>/g, "")
            .trim();
    }

    // الصورة
    let imageMatch = html.match(/data-image="([^"]+)"/);

    if (!imageMatch) {
        imageMatch = html.match(/<img[^>]+src="([^"]+)"/);
    }

    if (imageMatch) {
        details.image = imageMatch[1].trim();
    }

    // الوصف
    let descMatch = html.match(/data-content="([^"]+)"/);

    if (descMatch) {
        details.description = decodeHTMLEntities(
            descMatch[1]
                .replace(/\\n/g, " ")
                .trim()
        );
    }

    // النوع
    let typeMatch = html.match(/anime-card-type[\s\S]*?<a[^>]*>(.*?)<\/a>/);

    if (!typeMatch) {
        typeMatch = html.match(/anime-card-type[^>]*>\s*([^<]+)/);
    }

    if (typeMatch) {
        details.type = typeMatch[1]
            .replace(/<[^>]+>/g, "")
            .trim();
    }

    console.log(details);

    return details;
}


async function extractEpisodes(url) {
    const response = await soraFetch(url);
    const html = await response.text();

    const episodes = [];

    const regex = /<div class="ep_num">[\s\S]*?<a href="([^"]+)">[\s\S]*?(الحلقة\s*\d+)[\s\S]*?<\/a>[\s\S]*?data-image="([^"]+)"/g;

    let match;

    while ((match = regex.exec(html)) !== null) {

        episodes.push({
            title: match[2].trim(),
            href: match[1].trim(),
            image: match[3].trim()
        });
    }


    // طريقة احتياطية لو تغير ترتيب الصورة
    if (episodes.length === 0) {

        const fallback = /<div class="ep_num">[\s\S]*?<a href="([^"]+)">([\s\S]*?)<\/a>/g;

        let ep;

        while ((ep = fallback.exec(html)) !== null) {

            episodes.push({
                title: ep[2]
                    .replace(/<[^>]+>/g, "")
                    .trim(),
                href: ep[1].trim(),
                image: ""
            });
        }
    }


    console.log(`Episodes: ${episodes.length}`);

    return episodes;
}
