import { useCallback, useEffect, useMemo, useRef, useState, Suspense, lazy } from 'react'
import { LazyMotion, MotionConfig, domAnimation, motion } from 'framer-motion'
import Header from './components/Header'
import Generator from './components/Generator'
import Footer from './components/Footer'
import CookieConsentBanner from './components/CookieConsentBanner'
import ErrorBoundary from './components/ErrorBoundary'
import FAQSection from './components/FAQSection'
import SimpleBackground from './components/SimpleBackground'
import { CustomCursor } from './motion/Cursor'
import { springs } from './motion/config'
import { useAuth } from './hooks/useAuth'
import { useWallet } from './hooks/useWallet'
import { useGenerator } from './hooks/useGenerator'
import { useConfigOptions } from './hooks/useConfigOptions'
import { ApiError, apiPost } from './lib/apiClient'
import { isSupabaseConfigured } from './lib/supabaseClient'
import { GENERATION_LIMITS } from './features/generation/schema'

const ProductSections = lazy(() => import('./components/ProductSections'))
const PricingModal = lazy(() => import('./components/modals/PricingModal'))
const LoginModal = lazy(() => import('./components/modals/LoginModal'))
const CreditsHistoryModal = lazy(() => import('./components/modals/CreditsHistoryModal'))

function App() {
    const [showPricingModal, setShowPricingModal] = useState(false)
    const [showLoginModal, setShowLoginModal] = useState(false)
    const [showCreditsModal, setShowCreditsModal] = useState(false)
    const [checkoutLoadingPlan, setCheckoutLoadingPlan] = useState('')
    const [checkoutError, setCheckoutError] = useState('')
    const [inviteStatus, setInviteStatus] = useState('')
    const [deleteAccountLoading, setDeleteAccountLoading] = useState(false)

    const marketingTrackedRef = useRef(false)

    const auth = useAuth()
    const wallet = useWallet({ enabled: auth.isAuthenticated })
    const generator = useGenerator({ onSuccess: wallet.refreshWallet })
    const configOptions = useConfigOptions()
    const {
        timedCredits,
        permanentCredits,
        totalCredits,
        dailyCreditQuota,
        referralCode,
        inviteRedeemed,
        coupons,
        transactions,
        ledgerLoading,
        error: walletError,
        fetchLedger,
    } = wallet

    useEffect(() => {
        if (auth.isAuthenticated) {
            setShowLoginModal(false)
        }
    }, [auth.isAuthenticated])

    useEffect(() => {
        if (!showCreditsModal || !auth.isAuthenticated) {
            return
        }

        fetchLedger()
    }, [auth.isAuthenticated, fetchLedger, showCreditsModal])

    useEffect(() => {
        if (!auth.isAuthenticated || marketingTrackedRef.current) {
            return
        }

        marketingTrackedRef.current = true
        apiPost('marketing-dispatch', { event: 'signup' }).catch(() => {
            // Non-blocking marketing event.
        })
    }, [auth.isAuthenticated])

    const handleGenerate = useCallback(async (config) => {
        if (!auth.isAuthenticated) {
            setShowLoginModal(true)
            return
        }

        if ((totalCredits ?? 0) < GENERATION_LIMITS.creditsPerRequest) {
            setShowPricingModal(true)
            return
        }

        const response = await generator.generateReplies(config)
        if (!response) {
            return
        }

        if (response.remaining_credits < GENERATION_LIMITS.creditsPerRequest) {
            setShowPricingModal(true)
        }
    }, [auth.isAuthenticated, generator, totalCredits])

    const handleCheckout = useCallback(async (planCode) => {
        if (!auth.isAuthenticated) {
            setShowLoginModal(true)
            setShowPricingModal(false)
            return
        }

        setCheckoutError('')
        setCheckoutLoadingPlan(planCode)

        try {
            const response = await apiPost('create-checkout', {
                plan_code: planCode,
            })

            if (response?.checkout_url) {
                window.location.assign(response.checkout_url)
                return
            }

            setCheckoutError('Failed to create checkout URL.')
        } catch (error) {
            if (error instanceof ApiError && error.status === 401) {
                setShowLoginModal(true)
            }
            setCheckoutError(error.message)
        } finally {
            setCheckoutLoadingPlan('')
        }
    }, [auth.isAuthenticated])

    const handleRedeemInvite = useCallback(async (inviteCode) => {
        if (!auth.isAuthenticated) {
            setShowLoginModal(true)
            return { ok: false, message: 'Please log in first.' }
        }

        try {
            await apiPost('redeem-invite-code', {
                invite_code: inviteCode,
            })

            setInviteStatus('Invite code redeemed successfully.')
            wallet.refreshWallet()
            return { ok: true, message: 'Invite code redeemed successfully.' }
        } catch (error) {
            setInviteStatus(error.message)
            return { ok: false, message: error.message }
        }
    }, [auth.isAuthenticated, wallet, setShowLoginModal])

    const handleDeleteAccount = useCallback(async () => {
        if (deleteAccountLoading) return

        const confirmed = window.confirm('This will permanently delete your account and data. Continue?')
        if (!confirmed) {
            return
        }

        setDeleteAccountLoading(true)
        try {
            await apiPost('delete-account', {})
            await auth.signOut()
            window.location.reload()
        } catch (error) {
            setCheckoutError(error.message || 'Failed to delete account.')
        } finally {
            setDeleteAccountLoading(false)
        }
    }, [auth, deleteAccountLoading])

    const displayName = auth.profile?.display_name || auth.user?.user_metadata?.full_name || auth.user?.email || 'User'
    const avatarUrl = auth.profile?.avatar_url || auth.user?.user_metadata?.avatar_url || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face'

    const user = useMemo(() => {
        if (!auth.user) {
            return null
        }

        const expiresAt = wallet.wallet?.subscription_expires_at
            ? new Date(wallet.wallet.subscription_expires_at).toISOString().slice(0, 10)
            : null

        return {
            name: displayName,
            avatar: avatarUrl,
            id: auth.user.id,
            membership: {
                tier: wallet.wallet?.tier || 'free',
                expires: expiresAt,
            },
        }
    }, [auth.user, avatarUrl, displayName, wallet.wallet?.subscription_expires_at, wallet.wallet?.tier])

    const inviteLink = user
        ? `https://aireplytool.com/?ref=${referralCode || auth.user.id.slice(0, 8)}`
        : ''

    const globalError = checkoutError || auth.error || walletError

    return (
        <LazyMotion features={domAnimation}>
            <MotionConfig reducedMotion="user">
                <>
                    <CustomCursor />

                    <Header
                        creditSummary={{
                            timedCredits,
                            permanentCredits,
                            totalCredits,
                            dailyCreditQuota,
                        }}
                        isLoggedIn={auth.isAuthenticated}
                        user={user}
                        coupons={coupons}
                        inviteCode={referralCode || auth.user?.id?.slice(0, 8) || ''}
                        inviteLink={inviteLink}
                        inviteRedeemed={inviteRedeemed}
                        inviteStatus={inviteStatus}
                        onPricingClick={() => setShowPricingModal(true)}
                        onLoginClick={() => setShowLoginModal(true)}
                        onLogout={auth.signOut}
                        onDeleteAccount={handleDeleteAccount}
                        onCreditsClick={() => setShowCreditsModal(true)}
                        onRedeemInvite={handleRedeemInvite}
                    />

                    <SimpleBackground />

                    <div className="min-h-screen relative">
                        <main className="pt-28 px-4 sm:px-6 lg:px-8 max-w-[1100px] mx-auto relative z-10">
                            {!isSupabaseConfigured && (
                                <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 px-4 py-3 text-sm">
                                    Supabase is not configured. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
                                </div>
                            )}

                            {!!globalError && (
                                <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
                                    {globalError}
                                </div>
                            )}

                            <motion.div
                                className="text-center mb-12"
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ type: 'spring', ...springs.smooth }}
                            >
                                <motion.span
                                    className="label-aurora mb-4 inline-block"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1, type: 'spring', ...springs.snappy }}
                                >
                                    AI Reply
                                </motion.span>
                                <motion.h1
                                    className="heading-aurora text-5xl sm:text-6xl lg:text-7xl font-bold mb-5"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.15, type: 'spring', ...springs.smooth }}
                                >
                                    The Best Free AI Reply Generator
                                </motion.h1>
                                <motion.p
                                    className="text-gray-500 text-lg max-w-xl mx-auto"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2, type: 'spring', ...springs.smooth }}
                                >
                                    Paste your message, choose a tone, and let AI write the perfect response for you. From awkward emails to Tinder matches, we've got you covered.
                                </motion.p>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 40 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.25, type: 'spring', ...springs.smooth }}
                            >
                                <Generator
                                    onGenerate={handleGenerate}
                                    results={generator.results}
                                    isLoading={generator.isLoading}
                                    optionCatalog={configOptions.catalog}
                                    errorMessage={generator.error}
                                />
                            </motion.div>

                            <Suspense fallback={<div className="h-96 flex items-center justify-center"><div className="w-8 h-8 rounded-full border-2 border-pink-500 border-t-transparent animate-spin"></div></div>}>
                                <ProductSections />
                            </Suspense>

                            <section className="mt-32 max-w-4xl mx-auto text-gray-700 space-y-12 px-4">
                                <div className="text-center mb-16">
                                    <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6">Why Use Our AI Reply Generator?</h2>
                                    <p className="text-lg leading-relaxed text-gray-500 max-w-2xl mx-auto">
                                        Communication is hard. Whether you are facing a flooded inbox or a tricky text message, finding the right words takes time and mental energy. Our AI Reply Generator uses advanced language models to understand the context of your incoming message and craft a response that sounds exactly like you, only better.
                                    </p>
                                </div>
                            </section>

                            <FAQSection />
                        </main>

                        <Footer />
                        <CookieConsentBanner />
                    </div>

                    <ErrorBoundary>
                        <Suspense fallback={null}>
                            {showPricingModal && (
                                <PricingModal
                                    isOpen={showPricingModal}
                                    onClose={() => {
                                        setShowPricingModal(false)
                                        setCheckoutError('')
                                    }}
                                    onCheckout={handleCheckout}
                                    checkoutLoadingPlan={checkoutLoadingPlan}
                                />
                            )}
                            {showLoginModal && (
                                <LoginModal
                                    isOpen={showLoginModal}
                                    onClose={() => setShowLoginModal(false)}
                                    onOAuthLogin={auth.signInWithOAuth}
                                    onEmailLogin={auth.signInWithEmail}
                                    errorMessage={auth.error}
                                />
                            )}
                            {showCreditsModal && (
                                <CreditsHistoryModal
                                    isOpen={showCreditsModal}
                                    onClose={() => setShowCreditsModal(false)}
                                    transactions={transactions}
                                    isLoading={ledgerLoading}
                                />
                            )}
                        </Suspense>
                    </ErrorBoundary>
                </>
            </MotionConfig>
        </LazyMotion>
    )
}

export default App
