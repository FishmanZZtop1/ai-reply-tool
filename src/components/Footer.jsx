export default function Footer() {
    const privacyUrl = import.meta.env.VITE_TERMLY_PRIVACY_URL || '/privacy-policy.html'
    const termsUrl = import.meta.env.VITE_TERMLY_TERMS_URL || '/terms-of-service.html'
    const cookieUrl = import.meta.env.VITE_TERMLY_COOKIE_URL || '/cookie-policy.html'

    return (
        <footer className="bg-white/80 backdrop-blur-xl border-t border-gray-100 mt-auto">
            <div className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                    {/* Left Side: Brand & Copyright */}
                    <div className="flex flex-col items-center md:items-start gap-4">
                        <div className="flex items-center gap-3">
                            <img src="/logo-text.svg" alt="AI Reply Generator" className="h-8 w-auto" width="160" height="32" />
                            <span className="text-lg font-bold text-gray-900">AI Reply Generator</span>
                        </div>
                        <p className="text-sm text-gray-500">
                            Copyright © 2026 AI Reply. All rights reserved.
                        </p>
                    </div>

                    {/* Right Side: Links */}
                    <nav className="flex items-center justify-center md:justify-end gap-x-8 gap-y-4 flex-wrap">
                        <a
                            href={privacyUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm text-gray-500 hover:text-pink-600 transition-colors"
                        >
                            Privacy Policy
                        </a>
                        <a
                            href={termsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm text-gray-500 hover:text-pink-600 transition-colors"
                        >
                            Terms of Service
                        </a>
                        <a
                            href={cookieUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm text-gray-500 hover:text-pink-600 transition-colors"
                        >
                            Cookie Policy
                        </a>
                        <a
                            href="mailto:hello@aireplytool.com"
                            className="text-sm text-gray-500 hover:text-pink-600 transition-colors"
                        >
                            hello@aireplytool.com
                        </a>
                    </nav>
                </div>
            </div>
        </footer>
    )
}
