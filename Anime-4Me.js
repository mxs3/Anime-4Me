function searchResults(html) {
    const results = [];
    const baseUrl = 'https://4i.a8x1c7v.shop';
    
    // نمط للبحث عن بطاقات النتائج
    const cardRegex = /<div class="anime-card-themex">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;
    const cards = html.match(cardRegex) || [];
    
    if (cards.length > 0) {
        cards.forEach((cardHtml) => {
            // استخراج العنوان
            const titleMatch = cardHtml.match(/<h3>\s*<a[^>]*>([^<]+)<\/a>\s*<\/h3>/);
            let title = titleMatch ? titleMatch[1].trim() : '';
            
            // استخراج الرابط
            const hrefMatch = cardHtml.match(/<a[^>]*href="([^"]+)"[^>]*class="overlay"[^>]*>/);
            let href = hrefMatch ? hrefMatch[1] : '';
            
            // استخراج الصورة
            const imgMatch = cardHtml.match(/<img[^>]*data-image="([^"]+)"[^>]*>/);
            let image = imgMatch ? imgMatch[1] : '';
            
            // تنظيف الرابط
            if (href && !href.startsWith('http')) {
                href = href.startsWith('/') ? baseUrl + href : baseUrl + '/' + href;
            }
            
            // إضافة النتيجة
            if (title && href) {
                results.push({
                    title: title,
                    image: image || '',
                    href: href
                });
            }
        });
    }
    
    // طريقة بديلة إذا لم تظهر البطاقات
    if (results.length === 0) {
        const altRegex = /<a[^>]*href="([^"]*\/anime\/[^"]+)"[^>]*>([^<]+)<\/a>/g;
        let match;
        while ((match = altRegex.exec(html)) !== null) {
            const href = match[1];
            const title = match[2].trim();
            if (href && title && !title.includes('بحث') && !title.includes('المزيد')) {
                results.push({
                    title: title,
                    image: '',
                    href: href.startsWith('http') ? href : baseUrl + href
                });
            }
        }
    }
    
    return results;
}
