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

        /*
         * استخراج السيرفرات من data-watch
         */
        const regex =
            /<li[^>]+data-watch=["']([^"']+)["'][^>]*>[\s\S]*?<a[^>]*>\s*([^<]+?)\s*<span[^>]*class=["']quality["']/gi;


        for (const match of html.matchAll(regex)) {

            const embed = match[1]?.trim();
            const name = match[2]?.trim();

            if (!embed || !name)
                continue;

            /*
             * Mega يتم تجاهله نهائياً
             */
            if (
                name.toLowerCase().includes("mega") ||
                embed.toLowerCase().includes("mega.nz")
            ) {
                continue;
            }

            servers.push({
                name: name,
                embed: embed
            });

        }


        /*
         * إزالة السيرفرات المكررة
         */
        const uniqueServers = [];
        const seen = new Set();


        for (const server of servers) {

            if (!seen.has(server.embed)) {

                seen.add(server.embed);
                uniqueServers.push(server);

            }

        }


        /*
         * استخراج كل سيرفر
         */
        for (const server of uniqueServers) {

            try {

                let extracted = null;

                const check = (
                    server.name +
                    " " +
                    server.embed
                ).toLowerCase();


                /*
                 * UQLOAD
                 */
                if (check.includes("uqload")) {

                    extracted =
                        await uqloadExtractor(
                            server.embed
                        );

                }


                /*
                 * MP4UPLOAD
                 */
                else if (check.includes("mp4upload")) {

                    extracted =
                        await mp4uploadExtractor(
                            server.embed
                        );

                }


                /*
                 * VADBAM
                 */
                else if (check.includes("vadbam")) {

                    extracted =
                        await vadbamExtractor(
                            server.embed
                        );

                }


                /*
                 * ANIME4UP
                 */
                else if (check.includes("anime4up")) {

                    extracted =
                        await anime4upExtractor(
                            server.embed
                        );

                }


                /*
                 * SHARE4MAX
                 */
                else if (check.includes("share4max")) {

                    extracted =
                        await share4maxExtractor(
                            server.embed
                        );

                }


                /*
                 * لو السيرفر غير معروف
                 * نحاول قراءة الصفحة مباشرة
                 */
                else {

                    extracted =
                        await genericStreamExtractor(
                            server.embed
                        );

                }


                /*
                 * الرابط المستخرج
                 */
                const finalUrl =
                    extracted?.url ||
                    null;


                /*
                 * لا نضيف السيرفر إذا لم نجد
                 * رابط فيديو فعلي
                 */
                if (!finalUrl) {

                    console.log(
                        "No stream extracted:",
                        server.name
                    );

                    continue;

                }


                /*
                 * فحص الرابط
                 */
                const alive =
                    await checkStream(
                        finalUrl,
                        extracted?.headers ||
                        {
                            Referer: server.embed
                        }
                    );


                /*
                 * فقط الروابط التي تعمل
                 */
                if (!alive) {

                    console.log(
                        "Dead stream skipped:",
                        server.name,
                        finalUrl
                    );

                    continue;

                }


                result.streams.push({

                    title: server.name,

                    streamUrl: finalUrl,

                    headers:
                        extracted?.headers ||
                        {
                            Referer: server.embed
                        },

                    subtitles: null

                });


                console.log(
                    "Stream added:",
                    server.name,
                    finalUrl
                );


            } catch (error) {

                console.log(
                    "Server skipped:",
                    server.name,
                    error
                );

            }

        }


        return JSON.stringify(result);


    } catch (error) {

        console.log(
            "extractStreamUrl error:",
            error
        );


        return JSON.stringify({
            streams: [],
            subtitles: null
        });

    }

}





/*
 * =========================================================
 * CHECK STREAM
 * =========================================================
 */

async function checkStream(streamUrl, headers = {}) {

    try {

        if (!streamUrl)
            return false;


        /*
         * بعض السيرفرات لا تقبل HEAD
         * لذلك نستخدم GET بشكل خفيف
         */
        let response;

        try {

            response =
                await fetchv2(
                    streamUrl,
                    {
                        method: "HEAD",
                        headers: {
                            "User-Agent":
                                "Mozilla/5.0",
                            ...headers
                        }
                    }
                );

        } catch (e) {

            response = null;

        }


        /*
         * إذا نجح HEAD
         */
        if (
            response &&
            response.status >= 200 &&
            response.status < 400
        ) {

            return true;

        }


        /*
         * محاولة ثانية بـ GET
         */
        try {

            response =
                await fetchv2(
                    streamUrl,
                    {
                        method: "GET",
                        headers: {
                            "User-Agent":
                                "Mozilla/5.0",
                            "Range": "bytes=0-1024",
                            ...headers
                        }
                    }
                );


            if (
                response &&
                response.status >= 200 &&
                response.status < 400
            ) {

                return true;

            }

        } catch (e) {}



        return false;


    } catch (e) {

        return false;

    }

}





/*
 * =========================================================
 * UQLOAD EXTRACTOR
 * =========================================================
 */

async function uqloadExtractor(url) {

    const headers = {

        "Referer": url,

        "Origin": "https://uqload.is",

        "User-Agent":
            "Mozilla/5.0"

    };


    try {

        const res =
            await fetchv2(
                url,
                headers
            );


        const html =
            await res.text();


        /*
         * HLS
         */
        const hls =
            html.match(
                /(?:file|src|source)\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i
            )
            ||
            html.match(
                /["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i
            );


        if (hls) {

            return {

                url: hls[1],

                headers

            };

        }


        /*
         * MP4
         */
        const mp4 =
            html.match(
                /(?:file|src|source)\s*:\s*["']([^"']+\.mp4[^"']*)["']/i
            )
            ||
            html.match(
                /["'](https?:\/\/[^"']+\.mp4[^"']*)["']/i
            );


        if (mp4) {

            return {

                url: mp4[1],

                headers

            };

        }


        return null;


    } catch (error) {

        console.log(
            "UQLoad extractor error:",
            error
        );

        return null;

    }

}





/*
 * =========================================================
 * MP4UPLOAD EXTRACTOR
 * =========================================================
 */

async function mp4uploadExtractor(url) {

    const headers = {

        "Referer":
            "https://mp4upload.com/",

        "User-Agent":
            "Mozilla/5.0"

    };


    try {

        const res =
            await fetchv2(
                url,
                headers
            );


        const html =
            await res.text();


        /*
         * player.src
         */
        let match =
            html.match(
                /player\.src\s*\(\s*\{\s*src\s*:\s*["']([^"']+)["']/i
            );


        /*
         * file:
         */
        if (!match) {

            match =
                html.match(
                    /file\s*:\s*["']([^"']+)["']/i
                );

        }


        /*
         * source:
         */
        if (!match) {

            match =
                html.match(
                    /source\s*:\s*["']([^"']+)["']/i
                );

        }


        /*
         * HLS
         */
        if (!match) {

            match =
                html.match(
                    /["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i
                );

        }


        /*
         * MP4
         */
        if (!match) {

            match =
                html.match(
                    /["'](https?:\/\/[^"']+\.mp4[^"']*)["']/i
                );

        }


        return {

            url:
                match
                    ? match[1]
                    : null,

            headers

        };


    } catch (error) {

        console.log(
            "MP4Upload extractor error:",
            error
        );

        return null;

    }

}





/*
 * =========================================================
 * VADBAM EXTRACTOR
 * =========================================================
 */

async function vadbamExtractor(url) {

    const headers = {

        "Referer": url,

        "User-Agent":
            "Mozilla/5.0"

    };


    try {

        const res =
            await fetchv2(
                url,
                headers
            );


        const html =
            await res.text();


        /*
         * HLS أولاً
         */
        let match =
            html.match(
                /(?:file|src|source)\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i
            );


        /*
         * sources [{file:"..."}]
         */
        if (!match) {

            match =
                html.match(
                    /sources\s*:\s*\[\s*\{\s*file\s*:\s*["']([^"']+)["']/i
                );

        }


        /*
         * MP4
         */
        if (!match) {

            match =
                html.match(
                    /(?:file|src|source)\s*:\s*["']([^"']+\.mp4[^"']*)["']/i
                );

        }


        /*
         * رابط مباشر داخل الصفحة
         */
        if (!match) {

            match =
                html.match(
                    /["'](https?:\/\/[^"']+\.(?:m3u8|mp4)[^"']*)["']/i
                );

        }


        return {

            url:
                match
                    ? match[1]
                    : null,

            headers

        };


    } catch (error) {

        console.log(
            "Vadbam extractor error:",
            error
        );

        return null;

    }

}





/*
 * =========================================================
 * ANIME4UP EXTRACTOR
 * =========================================================
 */

async function anime4upExtractor(url) {

    const headers = {

        "Referer": url,

        "User-Agent":
            "Mozilla/5.0"

    };


    try {

        const res =
            await fetchv2(
                url,
                headers
            );


        const html =
            await res.text();


        /*
         * HLS
         */
        let match =
            html.match(
                /(?:file|src|source)\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i
            );


        /*
         * sources
         */
        if (!match) {

            match =
                html.match(
                    /sources\s*:\s*\[\s*\{\s*file\s*:\s*["']([^"']+)["']/i
                );

        }


        /*
         * MP4
         */
        if (!match) {

            match =
                html.match(
                    /(?:file|src|source)\s*:\s*["']([^"']+\.mp4[^"']*)["']/i
                );

        }


        /*
         * رابط مباشر
         */
        if (!match) {

            match =
                html.match(
                    /["'](https?:\/\/[^"']+\.(?:m3u8|mp4)[^"']*)["']/i
                );

        }


        return {

            url:
                match
                    ? match[1]
                    : null,

            headers

        };


    } catch (error) {

        console.log(
            "Anime4up extractor error:",
            error
        );

        return null;

    }

}





/*
 * =========================================================
 * SHARE4MAX EXTRACTOR
 * =========================================================
 */

async function share4maxExtractor(url) {

    const headers = {

        "Referer":
            "https://share4max.com/",

        "User-Agent":
            "Mozilla/5.0"

    };


    try {

        const res =
            await fetchv2(
                url,
                headers
            );


        const html =
            await res.text();


        /*
         * HLS
         */
        let match =
            html.match(
                /(?:file|src|source)\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i
            );


        /*
         * sources
         */
        if (!match) {

            match =
                html.match(
                    /sources\s*:\s*\[\s*\{\s*file\s*:\s*["']([^"']+)["']/i
                );

        }


        /*
         * MP4
         */
        if (!match) {

            match =
                html.match(
                    /(?:file|src|source)\s*:\s*["']([^"']+\.mp4[^"']*)["']/i
                );

        }


        /*
         * رابط مباشر
         */
        if (!match) {

            match =
                html.match(
                    /["'](https?:\/\/[^"']+\.(?:m3u8|mp4)[^"']*)["']/i
                );

        }


        return {

            url:
                match
                    ? match[1]
                    : null,

            headers

        };


    } catch (error) {

        console.log(
            "Share4Max extractor error:",
            error
        );

        return null;

    }

}





/*
 * =========================================================
 * GENERIC EXTRACTOR
 * =========================================================
 *
 * يستخدم فقط مع أي سيرفر غير معروف.
 * يحاول استخراج HLS أو MP4 بدون تغيير بنية النظام.
 */

async function genericStreamExtractor(url) {

    const headers = {

        "Referer": url,

        "User-Agent":
            "Mozilla/5.0"

    };


    try {

        const res =
            await fetchv2(
                url,
                headers
            );


        const html =
            await res.text();


        /*
         * HLS
         */
        let match =
            html.match(
                /["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i
            );


        /*
         * MP4
         */
        if (!match) {

            match =
                html.match(
                    /["'](https?:\/\/[^"']+\.mp4[^"']*)["']/i
                );

        }


        /*
         * file:
         */
        if (!match) {

            match =
                html.match(
                    /(?:file|src|source)\s*:\s*["']([^"']+)["']/i
                );

        }


        return {

            url:
                match
                    ? match[1]
                    : null,

            headers

        };


    } catch (error) {

        console.log(
            "Generic extractor error:",
            error
        );

        return null;

    }

}
