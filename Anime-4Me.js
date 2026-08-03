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
    console.log('Extracting details from: ' + url);

    const response = await soraFetch(url);
    const html = await response.text();

    const results = [];

    function clean(text) {
        return text
            ? text.replace(/<[^>]+>/g, '')
                 .replace(/\s+/g, ' ')
                 .trim()
            : '';
    }


    const titleMatch = html.match(
        /<h1 class="anime-details-title">([\s\S]*?)<\/h1>/
    );

    const imageMatch = html.match(
        /<div class="anime-thumbnail">[\s\S]*?<img[^>]+src="([^"]+)"/
    );

    const descriptionMatch = html.match(
        /<p class="anime-story">([\s\S]*?)<\/p>/
    );


    const genres = [];
    const genreMatch = html.match(
        /<ul class="anime-genres">([\s\S]*?)<\/ul>/
    );

    if (genreMatch) {
        const genreRegex = /<li><a[^>]*>(.*?)<\/a><\/li>/g;
        let g;

        while ((g = genreRegex.exec(genreMatch[1])) !== null) {
            genres.push(clean(g[1]));
        }
    }


    function getInfo(label) {
        const regex = new RegExp(
            `<span>${label}:<\\/span>\\s*(?:<a[^>]*>)?([\\s\\S]*?)(?:<\\/a>)?<\\/div>`
        );

        const match = html.match(regex);

        return match ? clean(match[1]) : '';
    }


    results.push({
        title: titleMatch ? clean(titleMatch[1]) : '',
        image: imageMatch ? imageMatch[1] : '',
        description: descriptionMatch ? clean(descriptionMatch[1]) : '',
        genres: genres.join(', '),

        type: getInfo('نوع الأنمي'),
        airdate: getInfo('بداية العرض'),
        episodes: getInfo('عدد الحلقات'),
        duration: getInfo('مدة الحلقة'),
        season: getInfo('الموسم'),
        source: getInfo('المصدر')
    });


    console.log(`Details: ${JSON.stringify(results)}`);

    return JSON.stringify(results);
}


async function extractEpisodes(url) {
    try {
        const response = await fetchv2(url);
        const html = await response.text();

        let episodes = [];

        // استخراج الحلقات الموجودة
        const episodeRegex = /<a href="([^"]+\/episode\/[^"]+)".*?[\s\S]*?الحلقة\s*(\d+)/g;

        let match;
        while ((match = episodeRegex.exec(html)) !== null) {
            episodes.push({
                number: parseInt(match[2]),
                href: match[1]
            });
        }

        // البحث عن صفحات الحلقات الإضافية
        const pagesRegex = /href="([^"]+\?ep_order=[^"]+)"/g;
        let pages = [];

        while ((match = pagesRegex.exec(html)) !== null) {
            pages.push(match[1]);
        }

        // إزالة التكرار
        pages = [...new Set(pages)];

        for (const page of pages) {
            const res = await fetchv2(page);
            const pageHtml = await res.text();

            while ((match = episodeRegex.exec(pageHtml)) !== null) {
                episodes.push({
                    number: parseInt(match[2]),
                    href: match[1]
                });
            }
        }


        // إزالة الحلقات المكررة
        episodes = episodes.filter((ep, index, self) =>
            index === self.findIndex(
                x => x.number === ep.number && x.href === ep.href
            )
        );


        // ترتيب من الحلقة 1 للأعلى
        episodes.sort((a,b)=>a.number-b.number);


        console.log("Total Episodes:", episodes.length);

        return JSON.stringify(episodes);

    } catch(e){
        console.log(e);
        return JSON.stringify([]);
    }
}
