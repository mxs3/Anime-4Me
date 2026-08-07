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
                    " " +
                    server.embed
                ).toLowerCase();
                // =========================
                // UQLOAD
                // =========================
                if (check.includes("uqload")) {
                    extracted = await uqloadExtractor(server.embed);
                }
                // =========================
                // MP4UPLOAD
                // =========================
                else if (check.includes("mp4upload")) {
                    extracted = await mp4uploadExtractor(server.embed);
                }
                // =========================
                // VADBAM
                // =========================
                else if (check.includes("vadbam")) {
                    extracted = await vadbamExtractor(server.embed);
                }
                // =========================
                // ANIME4UP
                // =========================
                else if (check.includes("anime4up")) {
                    extracted = await anime4upExtractor(server.embed);
                }
                // =========================
                // SHARE4MAX
                // =========================
                else if (check.includes("share4max")) {
                    extracted = await share4maxExtractor(server.embed);
                }
                /*
                 * لا نستخدم embed كرابط نهائي.
                 * لازم الـ Extractor يطلع رابط فيديو فعلي.
                 */
                if (!extracted?.url) {
                    console.log(
                        "No direct stream extracted:",
                        server.name
                    );
                    continue;
                }
                const finalUrl = extracted.url;
                /*
                 * فحص الرابط النهائي فقط.
                 * لو الرابط ميت لا يتم إضافته.
                 */
                const alive = await checkStream(
                    finalUrl,
                    extracted.headers
                );
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
                        extracted.headers ||
                        {
                            Referer: server.embed
                        },
                    subtitles: null
                });
                console.log(
                    "Stream extracted:",
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
// ============================================================
// CHECK STREAM
// ============================================================
async function checkStream(streamUrl, headers = {}) {
    try {
        const response = await fetchv2(
            streamUrl,
            {
                method: "HEAD",
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136.0.0.0 Safari/537.36",
                    ...headers
                }
            }
        );
        if (!response)
            return false;
        const status = response.status;
        if (
            status >= 200 &&
            status < 400
        ) {
            return true;
        }
        /*
         * بعض سيرفرات HLS لا تتعامل جيدًا
         * مع HEAD.
         */
        if (
            streamUrl.includes(".m3u8") ||
            streamUrl.includes(".m3u")
        ) {
            try {
                const testResponse = await fetchv2(
                    streamUrl,
                    {
                        headers: {
                            "User-Agent":
                                "Mozilla/5.0",
                            ...headers
                        }
                    }
                );
                if (
                    testResponse &&
                    testResponse.status >= 200 &&
                    testResponse.status < 400
                ) {
                    return true;
                }
            } catch (e) {}
        }
        return false;
    } catch (e) {
        /*
         * بعض الـ hosts تمنع HEAD.
         * نجرب GET فقط في هذه الحالة.
         */
        try {
            const response = await fetchv2(
                streamUrl,
                {
                    headers: {
                        "User-Agent":
                            "Mozilla/5.0",
                        ...headers
                    }
                }
            );
            return !!(
                response &&
                response.status >= 200 &&
                response.status < 400
            );
        } catch (error) {
            return false;
        }
    }
}
// ============================================================
// GENERIC VIDEO URL EXTRACTOR
// ============================================================
function extractVideoUrl(html) {
    if (!html)
        return null;
    const patterns = [
        // file: "..."
        /file\s*:\s*["']([^"']+)["']/i,
        // src: "..."
        /src\s*:\s*["']([^"']+)["']/i,
        // source: "..."
        /source\s*:\s*["']([^"']+)["']/i,
        // file = "..."
        /file\s*=\s*["']([^"']+)["']/i,
        // sources: [{file:"..."}]
        /sources\s*:\s*\[\s*\{\s*file\s*:\s*["']([^"']+)["']/i,
        // sources: ["..."]
        /sources\s*:\s*\[\s*["']([^"']+)["']/i,
        // player.src({src:"..."})
        /player\.src\s*\(\s*\{\s*src\s*:\s*["']([^"']+)["']/i,
        // video source
        /<source[^>]+src=["']([^"']+)["']/i
    ];
    for (const pattern of patterns) {
        const match = html.match(pattern);
        if (!match || !match[1])
            continue;
        const value = decodeHTMLEntities(
            match[1]
        ).trim();
        if (
            value.includes(".mp4") ||
            value.includes(".m3u8") ||
            value.includes(".m3u") ||
            value.startsWith("http")
        ) {
            return value;
        }
    }
    return null;
}
// ============================================================
// UQLOAD EXTRACTOR
// ============================================================
async function uqloadExtractor(url) {
    const headers = {
        Referer: url,
        Origin: "https://uqload.is",
        "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136.0.0.0 Safari/537.36"
    };
    try {
        const res =
            await fetchv2(url, headers);
        const html =
            await res.text();
        const videoUrl =
            extractVideoUrl(html);
        if (!videoUrl)
            return null;
        return {
            url: videoUrl,
            headers
        };
    } catch (error) {
        console.log(
            "UQLoad extractor error:",
            error
        );
        return null;
    }
}
// ============================================================
// MP4UPLOAD EXTRACTOR
// ============================================================
async function mp4uploadExtractor(url) {
    const headers = {
        Referer: "https://mp4upload.com",
        "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136.0.0.0 Safari/537.36"
    };
    try {
        const res =
            await fetchv2(url, headers);
        const html =
            await res.text();
        /*
         * نحاول كل الصيغ الممكنة:
         *
         * MP4
         * M3U8
         * player.src
         * file
         * source
         */
        let videoUrl =
            extractVideoUrl(html);
        /*
         * بعض صفحات MP4Upload تضع الرابط
         * داخل JavaScript بشكل مختلف.
         */
        if (!videoUrl) {
            const scripts =
                extractScriptTags(html);
            for (const script of scripts) {
                videoUrl =
                    extractVideoUrl(script);
                if (videoUrl)
                    break;
            }
        }
        if (!videoUrl)
            return null;
        return {
            url: videoUrl,
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
// ============================================================
// VADBAM EXTRACTOR
// ============================================================
async function vadbamExtractor(url) {
    const headers = {
        Referer: url,
        "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136.0.0.0 Safari/537.36"
    };
    try {
        const res =
            await fetchv2(url, headers);
        const html =
            await res.text();
        let videoUrl =
            extractVideoUrl(html);
        /*
         * البحث داخل جميع الـ scripts
         */
        if (!videoUrl) {
            const scripts =
                extractScriptTags(html);
            for (const script of scripts) {
                videoUrl =
                    extractVideoUrl(script);
                if (videoUrl)
                    break;
            }
        }
        if (!videoUrl)
            return null;
        return {
            url: videoUrl,
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
// ============================================================
// ANIME4UP EXTRACTOR
// ============================================================
async function anime4upExtractor(url) {
    const headers = {
        Referer: url,
        "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136.0.0.0 Safari/537.36"
    };
    try {
        const res =
            await fetchv2(url, headers);
        const html =
            await res.text();
        let videoUrl =
            extractVideoUrl(html);
        /*
         * Anime4up قد يستخدم iframe
         * أو JavaScript يحتوي على الرابط.
         */
        if (!videoUrl) {
            const scripts =
                extractScriptTags(html);
            for (const script of scripts) {
                videoUrl =
                    extractVideoUrl(script);
                if (videoUrl)
                    break;
            }
        }
        if (!videoUrl)
            return null;
        return {
            url: videoUrl,
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
// ============================================================
// SHARE4MAX EXTRACTOR
// ============================================================
async function share4maxExtractor(url) {
    const headers = {
        Referer: url,
        "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136.0.0.0 Safari/537.36"
    };
    try {
        const res =
            await fetchv2(url, headers);
        const html =
            await res.text();
        let videoUrl =
            extractVideoUrl(html);
        /*
         * البحث داخل scripts
         */
        if (!videoUrl) {
            const scripts =
                extractScriptTags(html);
            for (const script of scripts) {
                videoUrl =
                    extractVideoUrl(script);
                if (videoUrl)
                    break;
            }
        }
        if (!videoUrl)
            return null;
        return {
            url: videoUrl,
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
// ============================================================
// SCRIPT TAGS
// ============================================================
function extractScriptTags(html) {
    const scriptRegex =
        /<script[^>]*>([\s\S]*?)<\/script>/gi;
    const scripts = [];
    let match;
    while (
        (match = scriptRegex.exec(html)) !== null
    ) {
        scripts.push(match[1]);
    }
    return scripts;
}
// ============================================================
// HTML ENTITIES
// ============================================================
function decodeHTMLEntities(text) {
    if (!text)
        return text;
    text =
        text.replace(
            /&#(\d+);/g,
            (match, dec) =>
                String.fromCharCode(dec)
        );
    text =
        text.replace(
            /&#x([0-9a-f]+);/gi,
            (match, hex) =>
                String.fromCharCode(
                    parseInt(hex, 16)
                )
        );
    const entities = {
        "&quot;": '"',
        "&amp;": "&",
        "&apos;": "'",
        "&#39;": "'",
        "&lt;": "<",
        "&gt;": ">",
        "&nbsp;": " "
    };
    for (const entity in entities) {
        text =
            text.replace(
                new RegExp(entity, "g"),
                entities[entity]
            );
    }
    return text;
}
