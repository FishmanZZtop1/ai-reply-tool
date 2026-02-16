export function initTermlyCookieBanner() {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return
    }

    const websiteUUID = import.meta.env.VITE_TERMLY_WEBSITE_UUID
    if (!websiteUUID) {
        return
    }

    const scriptId = 'termly-cookie-banner'
    if (document.getElementById(scriptId)) {
        return
    }

    const script = document.createElement('script')
    script.id = scriptId
    script.src = `https://app.termly.io/resource-blocker/${websiteUUID}?autoBlock=off`
    script.async = true
    script.type = 'text/javascript'
    script.setAttribute('data-termly-cookie', 'true')
    document.head.appendChild(script)
}
