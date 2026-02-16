import { useEffect, useState } from 'react'

const CONSENT_STORAGE_KEY = 'aireply_cookie_consent_v1'

function getCookiePolicyUrl() {
    return import.meta.env.VITE_TERMLY_COOKIE_URL || '/cookie-policy.html'
}

export default function CookieConsentBanner() {
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        if (import.meta.env.VITE_TERMLY_WEBSITE_UUID) {
            return
        }

        try {
            const saved = window.localStorage.getItem(CONSENT_STORAGE_KEY)
            setVisible(!saved)
        } catch {
            setVisible(true)
        }
    }, [])

    const saveChoice = (choice) => {
        try {
            window.localStorage.setItem(CONSENT_STORAGE_KEY, choice)
        } catch {
            // Ignore storage failures; still hide to avoid blocking UI.
        }
        setVisible(false)
    }

    if (!visible) {
        return null
    }

    return (
        <div className="fixed bottom-4 left-4 right-4 z-[80] rounded-2xl border border-gray-200 bg-white/95 shadow-xl backdrop-blur px-4 py-4 sm:px-5">
            <div className="mx-auto max-w-6xl flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-gray-700 leading-relaxed">
                    We use cookies to improve your experience. You can accept or continue with essential cookies only.
                    <a
                        href={getCookiePolicyUrl()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-1 font-semibold text-pink-600 hover:text-pink-700"
                    >
                        Cookie Policy
                    </a>
                </p>
                <div className="flex items-center gap-2 sm:gap-3">
                    <button
                        type="button"
                        onClick={() => saveChoice('essential_only')}
                        className="h-10 px-4 rounded-xl border border-gray-200 bg-white text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors"
                    >
                        Essential Only
                    </button>
                    <button
                        type="button"
                        onClick={() => saveChoice('accepted')}
                        className="h-10 px-4 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white text-sm font-semibold shadow-sm hover:from-pink-600 hover:to-rose-600 transition-all"
                    >
                        Accept Cookies
                    </button>
                </div>
            </div>
        </div>
    )
}
