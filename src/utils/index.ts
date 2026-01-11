


export function createPageUrl(pageName: string) {
    // Split page name and query string
    const [page, queryString] = pageName.split('?');
    const pagePath = '/' + page.toLowerCase().replace(/ /g, '-');
    // Preserve query string as-is (don't lowercase IDs)
    return queryString ? `${pagePath}?${queryString}` : pagePath;
}