/**
 * Login Modal - Supabase OAuth + Email OTP
 */

import { memo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { modalBackdrop, modalContent, springs, staggerItem } from '../../motion/config'

const LoginModal = memo(function LoginModal({
    isOpen,
    onClose,
    onOAuthLogin,
    onEmailLogin,
    errorMessage,
}) {
    const [email, setEmail] = useState('')
    const [emailStatus, setEmailStatus] = useState('idle')
    const [localError, setLocalError] = useState('')

    const socialButtons = [
        {
            name: 'Google',
            icon: (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
            ),
        },
        {
            name: 'GitHub',
            icon: (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
            ),
        },
    ]

    const handleSendMagicLink = async (event) => {
        event.preventDefault()

        const trimmedEmail = email.trim().toLowerCase()
        if (!trimmedEmail) {
            setLocalError('Please enter your email address.')
            return
        }

        setLocalError('')
        setEmailStatus('loading')

        const result = await onEmailLogin?.(trimmedEmail)
        if (result?.ok) {
            setEmailStatus('sent')
            return
        }

        setEmailStatus('idle')
        setLocalError(result?.error || 'Failed to send sign-in email.')
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div
                        className="absolute inset-0 bg-black/30"
                        style={{ backdropFilter: 'blur(8px)' }}
                        variants={modalBackdrop}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        onClick={onClose}
                    />

                    <motion.div
                        className="relative w-full max-w-md rounded-3xl p-8"
                        style={{
                            background: 'linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.95) 100%)',
                            boxShadow: '0 25px 80px rgba(0,0,0,0.15)',
                            border: '1px solid rgba(255,255,255,0.6)',
                        }}
                        variants={modalContent}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                    >
                        <motion.button
                            onClick={onClose}
                            aria-label="Close login modal"
                            className="absolute top-5 right-5 w-10 h-10 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                        </motion.button>

                        <motion.div
                            className="text-center mb-8"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1, type: 'spring', ...springs.smooth }}
                        >
                            <img src="/logo-text.svg" alt="AI Reply" className="h-12 w-auto mx-auto mb-4" />
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome!</h2>
                            <p className="text-gray-500 text-sm">
                                Sign in to continue with AI Reply
                            </p>
                        </motion.div>

                        <motion.div
                            className="mb-6 p-4 rounded-xl text-center"
                            style={{
                                background: 'linear-gradient(135deg, rgba(228,19,162,0.05) 0%, rgba(255,120,154,0.05) 100%)',
                                border: '1px solid rgba(228,19,162,0.2)',
                            }}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.2, type: 'spring', ...springs.bouncy }}
                        >
                            <div className="flex items-center justify-center gap-2 mb-1">
                                <span className="text-2xl">🎁</span>
                                <span className="font-bold text-[#E413A2]">New User Bonus</span>
                            </div>
                            <p className="text-sm text-gray-600">
                                Get <span className="font-bold text-[#E413A2]">500 free credits</span> when you sign up
                            </p>
                        </motion.div>

                        <motion.div
                            className="space-y-3"
                            initial="hidden"
                            animate="visible"
                            variants={{
                                hidden: {},
                                visible: {
                                    transition: { staggerChildren: 0.08, delayChildren: 0.3 },
                                },
                            }}
                        >
                            {socialButtons.map((button) => (
                                <motion.button
                                    key={button.name}
                                    onClick={() => onOAuthLogin?.(button.name)}
                                    className="w-full py-3 px-4 rounded-xl font-semibold text-sm border border-gray-200 text-gray-700 flex items-center justify-center gap-3 bg-white"
                                    variants={staggerItem}
                                    whileHover={{
                                        scale: 1.02,
                                        borderColor: 'rgba(228, 19, 162, 0.3)',
                                        boxShadow: '0 8px 24px rgba(228, 19, 162, 0.1)',
                                    }}
                                    whileTap={{ scale: 0.98 }}
                                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                                >
                                    {button.icon}
                                    Continue with {button.name}
                                </motion.button>
                            ))}
                        </motion.div>

                        <div className="my-5 flex items-center gap-3 text-xs text-gray-400">
                            <div className="h-px bg-gray-200 flex-1" />
                            <span>or email magic link</span>
                            <div className="h-px bg-gray-200 flex-1" />
                        </div>

                        <form className="space-y-3" onSubmit={handleSendMagicLink}>
                            <input
                                type="email"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                placeholder="name@company.com"
                                className="w-full h-11 rounded-xl border border-gray-200 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-pink-200"
                                autoComplete="email"
                            />
                            <button
                                type="submit"
                                disabled={emailStatus === 'loading'}
                                className="w-full h-11 rounded-xl bg-gray-900 text-white text-sm font-semibold disabled:opacity-60"
                            >
                                {emailStatus === 'loading' ? 'Sending...' : emailStatus === 'sent' ? 'Magic Link Sent' : 'Send Magic Link'}
                            </button>
                        </form>

                        {(localError || errorMessage) && (
                            <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs px-3 py-2">
                                {localError || errorMessage}
                            </div>
                        )}

                        {emailStatus === 'sent' && (
                            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs px-3 py-2">
                                Check your inbox for the sign-in link.
                            </div>
                        )}

                        <motion.div
                            className="mt-6 text-center text-xs text-gray-400"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5 }}
                        >
                            By continuing, you agree to our Terms of Service and Privacy Policy
                        </motion.div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
})

export default LoginModal
