# Google Indexing Checklist

## Pre-launch checks

- `https://aireplytool.com/robots.txt` returns 200 and contains sitemap URL
- `https://aireplytool.com/sitemap.xml` returns 200 and valid XML
- Canonical tag points to `https://aireplytool.com/`
- `meta name="robots"` is `index,follow`
- No `noindex` header on production HTML
- GA tag installed (`G-6TTHQM1KXW`)

## GSC setup

1. Add property in Google Search Console for `https://aireplytool.com`
2. Verify ownership (recommended: DNS TXT in Cloudflare)
3. Submit sitemap: `https://aireplytool.com/sitemap.xml`
4. Use URL inspection on `/`
5. Request indexing

## Post-launch checks (24-72h)

- GSC Coverage: no blocked-by-robots/noindex issues
- Core Web Vitals report starts collecting data
- Search appearance shows indexed home page

