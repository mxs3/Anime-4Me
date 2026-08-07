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
        const episodes = [];

        if (url.includes('movies')) {
            episodes.push({
                number: 1,
                href: url
            });
            return JSON.stringify(episodes);
        }

        async function getHtml(pageUrl) {
            const response = await fetchv2(pageUrl);
            return typeof response === 'object'
                ? await response.text()
                : await response;
        }

        const firstHtml = await getHtml(url);

        let pages = 1;

        // استخراج عدد صفحات الحلقات
        const maxPagesMatch = firstHtml.match(/data-max-pages=["'](\d+)["']/);

        if (maxPagesMatch) {
            pages = Number(maxPagesMatch[1]);
        } else {
            const pageLinks = [...firstHtml.matchAll(/\/page\/(\d+)\//g)]
                .map(m => Number(m[1]));

            if (pageLinks.length) {
                pages = Math.max(...pageLinks);
            }
        }

        // دالة استخراج الحلقات من الصفحة
        function extractFromHtml(html) {

            const regex = /<div class="ep_num">[\s\S]*?<a href="([^"]+)"[^>]*>\s*([^<]+?)\s*<\/a>/g;

            for (const match of html.matchAll(regex)) {

                const href = match[1];
                const title = match[2].trim();

                // استخراج رقم الحلقة حتى لو كانت خاصة
                const numberMatch = title.match(/(\d+)/);

                if (numberMatch) {

                    episodes.push({
                        number: Number(numberMatch[1]),
                        title: title,
                        href: href
                    });

                }
            }
        }

        // الصفحة الأولى
        extractFromHtml(firstHtml);


        // باقي الصفحات
        for (let i = 2; i <= pages; i++) {

            const pageUrl = url.replace(/\/$/, '') + `/page/${i}/`;

            const html = await getHtml(pageUrl);

            extractFromHtml(html);
        }


        // حذف التكرار
        const unique = [];
        const seen = new Set();

        for (const ep of episodes) {

            if (!seen.has(ep.href)) {
                seen.add(ep.href);
                unique.push(ep);
            }

        }


        // ترتيب الحلقات
        unique.sort((a, b) => {

            if (a.number !== b.number) {
                return a.number - b.number;
            }

            return a.href.localeCompare(b.href);

        });


        return JSON.stringify(unique);


    } catch (error) {

        console.error("extractEpisodes failed:", error);

        return JSON.stringify([]);

    }
}

async function extractStreamUrl(url) {

    const result = {
        streams: [],
        subtitles: null
    };

    try {

        const response = await fetchv2(url);
        const html = typeof response === "object"
            ? await response.text()
            : await response;


        const servers = [];

        const regex = /<li[^>]+data-watch=["']([^"']+)["'][^>]*>[\s\S]*?<a>[\s\S]*?([^<]+?)\s*<span[^>]*class=["']quality["']/gi;


        for (const match of html.matchAll(regex)) {

            servers.push({
                name: match[2].trim(),
                embed: match[1].trim()
            });

        }


        const uniqueServers = [];
        const seen = new Set();


        for (const server of servers) {

            if (!seen.has(server.embed)) {

                seen.add(server.embed);
                uniqueServers.push(server);

            }

        }



        for (const server of uniqueServers) {

            try {

                let extracted = null;

                const check = (
                    server.name +
                    server.embed
                ).toLowerCase();



                if (check.includes("uqload")) {

                    extracted = await uqloadExtractor(server.embed);

                }

                else if (check.includes("mp4upload")) {

                    extracted = await mp4uploadExtractor(server.embed);

                }

                else if (check.includes("vadbam")) {

                    extracted = await vadbamExtractor(server.embed);

                }

                else if (check.includes("anime4up")) {

                    extracted = await anime4upExtractor(server.embed);

                }

                else if (check.includes("share4max")) {

                    extracted = await share4maxExtractor(server.embed);

                }



                const finalUrl =
                    extracted?.url ||
                    server.embed;



                const alive =
                    await checkStream(finalUrl);



                if (alive) {


                    result.streams.push({

                        title: server.name,

                        streamUrl: finalUrl,

                        headers:
                            extracted?.headers ||
                            {
                                Referer: server.embed
                            },

                        subtitles:null

                    });


                }


            } catch(error) {

                console.log(
                    "Server skipped:",
                    server.name,
                    error
                );

            }


        }



        return JSON.stringify(result);



    } catch(error) {

        console.log(
            "extractStreamUrl error:",
            error
        );


        return JSON.stringify({
            streams:[],
            subtitles:null
        });

    }

}





// فحص الرابط قبل إضافته
async function checkStream(streamUrl) {

    try {


        const response = await fetchv2(
            streamUrl,
            {
                method:"HEAD",
                headers:{
                    "User-Agent":
                    "Mozilla/5.0"
                }
            }
        );


        if (!response)
            return false;



        const status =
            response.status;



        if (
            status >= 200 &&
            status < 400
        ) {

            return true;

        }



        return false;



    } catch(e) {


        return false;


    }

}





async function uqloadExtractor(url){

    const headers={
        Referer:url
    };


    const res =
        await fetchv2(url,headers);

    const html =
        await res.text();


    const match =
        html.match(/sources:\s*\[\s*"([^"]+\.mp4)/i)
        ||
        html.match(/file:\s*"([^"]+\.mp4)/i);



    return {

        url:
        match ? match[1] : null,

        headers

    };

}





async function mp4uploadExtractor(url){

    const headers={
        Referer:"https://mp4upload.com"
    };


    const res =
        await fetchv2(url,headers);


    const html =
        await res.text();


    const match =
        html.match(/player\.src\(\{\s*src:\s*"([^"]+)/i)
        ||
        html.match(/file:\s*"([^"]+\.mp4)/i);



    return {

        url:
        match ? match[1] : null,

        headers

    };

}





async function vadbamExtractor(url){

    const headers={
        Referer:url
    };


    const res =
        await fetchv2(url,headers);


    const html =
        await res.text();



    const match =
        html.match(/file:\s*"([^"]+\.mp4)/i)
        ||
        html.match(/sources:\s*\[\{file:"([^"]+)/i);



    return {

        url:
        match ? match[1] : null,

        headers

    };

}





async function anime4upExtractor(url){

    const headers={
        Referer:url
    };


    const res =
        await fetchv2(url,headers);


    const html =
        await res.text();



    const match =
        html.match(/file:\s*"([^"]+\.m3u8)/i)
        ||
        html.match(/source:\s*"([^"]+)/i);



    return {

        url:
        match ? match[1] : null,

        headers

    };

}





async function share4maxExtractor(url){

    const headers={
        Referer:url
    };


    const res =
        await fetchv2(url,headers);


    const html =
        await res.text();



    const match =
        html.match(/file:\s*"([^"]+\.m3u8)/i)
        ||
        html.match(/sources:\s*\[\{file:"([^"]+)/i);



    return {

        url:
        match ? match[1] : null,

        headers

    };

}
