function searchResults(html) {
    const results = [];
    const baseUrl = "https://4i.a8x1c7v.shop/";

    const filmListRegex = /<div class="anime-card-themex">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g;
    const items = html.match(filmListRegex) || [];

    items.forEach((itemHtml) => {
        const titleMatch = itemHtml.match(/<h3>\s*<a[^>]*>([^<]+)<\/a>\s*<\/h3>/);
        const hrefMatch = itemHtml.match(/<a[^>]*href="([^"]+)"[^>]*class="overlay"[^>]*>/);
        const imgMatch = itemHtml.match(/<img[^>]*data-image="([^"]+)"[^>]*>/);

        const title = titleMatch ? titleMatch[1].trim() : '';
        let href = hrefMatch ? hrefMatch[1] : '';
        const image = imgMatch ? imgMatch[1] : '';

        if (href && !href.startsWith("https")) {
            href = href.startsWith("/") ? baseUrl + href.slice(1) : baseUrl + href;
        }

        if (title && href) {
            results.push({
                title: title,
                image: image,
                href: href
            });
        }
    });

    return results;
}
