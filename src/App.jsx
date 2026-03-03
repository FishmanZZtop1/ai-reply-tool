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
const ProfileEditModal = lazy(() => import('./components/modals/ProfileEditModal'))

const PENDING_INVITE_STORAGE_KEY = 'ai_reply_pending_invite_code'
const SIGNUP_NOTICE_STORAGE_KEY_PREFIX = 'ai_reply_signup_notice_seen_'
const PENDING_GENERATION_STORAGE_KEY = 'ai_reply_pending_generation_draft_v1'
const PENDING_GENERATION_TTL_MS = 1000 * 60 * 60

function sanitizeInviteCode(rawValue) {
    if (!rawValue) return ''
    return String(rawValue).trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32)
}

function buildDefaultAvatar(userId = 'guest') {
    return `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(userId)}`
}

function sanitizePendingGenerationConfig(rawConfig) {
    if (!rawConfig || typeof rawConfig !== 'object') {
        return null
    }

    const sanitizeText = (value, maxLength) => (
        typeof value === 'string'
            ? value.slice(0, maxLength)
            : ''
    )
    const sanitizeChoice = (value) => sanitizeText(value, 120)
    const normalizeLength = rawConfig.length === 'Longer' ? 'Longer' : 'Shorter'
    const normalizeVariations = ['1', '3', '5'].includes(String(rawConfig.variations))
        ? String(rawConfig.variations)
        : '3'

    return {
        scene: sanitizeChoice(rawConfig.scene),
        role: sanitizeChoice(rawConfig.role),
        style: sanitizeChoice(rawConfig.style),
        styleCustom: sanitizeChoice(rawConfig.styleCustom),
        length: normalizeLength,
        variations: normalizeVariations,
        emoji: Boolean(rawConfig.emoji),
        message: sanitizeText(rawConfig.message, GENERATION_LIMITS.messageMax),
        notes: sanitizeText(rawConfig.notes, GENERATION_LIMITS.notesMax),
        sceneCustom: sanitizeChoice(rawConfig.sceneCustom),
        roleCustom: sanitizeChoice(rawConfig.roleCustom),
    }
}

function savePendingGenerationConfig(config) {
    if (typeof window === 'undefined' || !window.sessionStorage) {
        return false
    }

    const sanitized = sanitizePendingGenerationConfig(config)
    if (!sanitized) {
        return false
    }

    try {
        window.sessionStorage.setItem(PENDING_GENERATION_STORAGE_KEY, JSON.stringify({
            saved_at: Date.now(),
            config: sanitized,
        }))
        return true
    } catch {
        return false
    }
}

function readPendingGenerationConfig() {
    if (typeof window === 'undefined' || !window.sessionStorage) {
        return null
    }

    try {
        const raw = window.sessionStorage.getItem(PENDING_GENERATION_STORAGE_KEY)
        if (!raw) {
            return null
        }

        const parsed = JSON.parse(raw)
        const savedAt = Number(parsed?.saved_at || 0)
        if (!savedAt || Date.now() - savedAt > PENDING_GENERATION_TTL_MS) {
            window.sessionStorage.removeItem(PENDING_GENERATION_STORAGE_KEY)
            return null
        }

        return sanitizePendingGenerationConfig(parsed?.config)
    } catch {
        window.sessionStorage.removeItem(PENDING_GENERATION_STORAGE_KEY)
        return null
    }
}

function clearPendingGenerationConfig() {
    if (typeof window === 'undefined' || !window.sessionStorage) {
        return
    }

    window.sessionStorage.removeItem(PENDING_GENERATION_STORAGE_KEY)
}

function App() {
    const [showPricingModal, setShowPricingModal] = useState(false)
    const [showLoginModal, setShowLoginModal] = useState(false)
    const [showCreditsModal, setShowCreditsModal] = useState(false)
    const [showProfileModal, setShowProfileModal] = useState(false)
    const [checkoutLoadingPlan, setCheckoutLoadingPlan] = useState('')
    const [checkoutError, setCheckoutError] = useState('')
    const [inviteStatus, setInviteStatus] = useState('')
    const [noticeMessage, setNoticeMessage] = useState('')
    const [deleteAccountLoading, setDeleteAccountLoading] = useState(false)
    const [profileUpdateLoading, setProfileUpdateLoading] = useState(false)
    const [profileUpdateError, setProfileUpdateError] = useState('')

    const marketingTrackedRef = useRef(false)
    const inviteAutoAppliedRef = useRef(false)
    const pendingAutoGenerateInFlightRef = useRef(false)

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
        walletLoading,
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

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const inviteFromQuery = sanitizeInviteCode(params.get('ref') || params.get('invite') || '')
        if (!inviteFromQuery) {
            return
        }

        localStorage.setItem(PENDING_INVITE_STORAGE_KEY, inviteFromQuery)
        setNoticeMessage(`Invite code detected: ${inviteFromQuery}`)

        params.delete('ref')
        params.delete('invite')
        const nextQuery = params.toString()
        const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash || ''}`
        window.history.replaceState({}, '', nextUrl)
    }, [])

    useEffect(() => {
        if (!noticeMessage) {
            return
        }

        const timer = setTimeout(() => {
            setNoticeMessage('')
        }, 4500)

        return () => clearTimeout(timer)
    }, [noticeMessage])

    useEffect(() => {
        if (!auth.isAuthenticated || !auth.user?.id || !wallet.wallet || inviteAutoAppliedRef.current) {
            return
        }

        const pendingInviteCode = sanitizeInviteCode(localStorage.getItem(PENDING_INVITE_STORAGE_KEY))
        if (!pendingInviteCode || wallet.inviteRedeemed) {
            return
        }

        const ownCode = sanitizeInviteCode(wallet.referralCode || '')
        if (ownCode && pendingInviteCode.toLowerCase() === ownCode.toLowerCase()) {
            localStorage.removeItem(PENDING_INVITE_STORAGE_KEY)
            setNoticeMessage('Self invite is not allowed. Please use another invite code.')
            return
        }

        inviteAutoAppliedRef.current = true
        apiPost('redeem-invite-code', { invite_code: pendingInviteCode })
            .then(() => {
                localStorage.removeItem(PENDING_INVITE_STORAGE_KEY)
                setInviteStatus('Invite code redeemed successfully.')
                setNoticeMessage(`Invite applied: +200 permanent credits to inviter.`)
                wallet.refreshWallet()
            })
            .catch((error) => {
                const message = error?.message || 'Failed to redeem invite code.'
                setInviteStatus(message)
                setNoticeMessage(message)
                if (
                    message.toLowerCase().includes('already') ||
                    message.toLowerCase().includes('not found') ||
                    message.toLowerCase().includes('self')
                ) {
                    localStorage.removeItem(PENDING_INVITE_STORAGE_KEY)
                }
            })
            .finally(() => {
                inviteAutoAppliedRef.current = false
            })
    }, [auth.isAuthenticated, auth.user?.id, wallet, wallet.wallet, wallet.inviteRedeemed, wallet.referralCode])

    useEffect(() => {
        if (!auth.isAuthenticated || !auth.user?.id || !wallet.wallet) {
            return
        }

        const seenKey = `${SIGNUP_NOTICE_STORAGE_KEY_PREFIX}${auth.user.id}`
        const alreadySeen = localStorage.getItem(seenKey)
        if (alreadySeen) {
            return
        }

        const joinedAt = auth.user.created_at ? new Date(auth.user.created_at).getTime() : 0
        const joinedRecently = joinedAt > 0 && Date.now() - joinedAt < 1000 * 60 * 60 * 24
        const gotInitialBonus = (wallet.permanentCredits ?? 0) >= 500
        if (joinedRecently && gotInitialBonus) {
            localStorage.setItem(seenKey, '1')
            setNoticeMessage('Welcome! 500 free permanent credits have been added.')
        }
    }, [auth.isAuthenticated, auth.user?.created_at, auth.user?.id, wallet.permanentCredits, wallet.wallet])

    const executeGenerate = useCallback(async (config, trigger = 'manual') => {
        if (!auth.isAuthenticated) {
            return { ok: false, reason: 'unauthorized' }
        }

        if ((totalCredits ?? 0) < GENERATION_LIMITS.creditsPerRequest) {
            setShowPricingModal(true)
            if (trigger === 'resume') {
                setNoticeMessage('Login successful, but you need more credits to generate this reply.')
            }
            return { ok: false, reason: 'insufficient_credits' }
        }

        const response = await generator.generateReplies(config)
        if (!response) {
            return { ok: false, reason: 'generation_failed' }
        }

        if (trigger === 'resume') {
            setNoticeMessage('Login successful. Your saved draft was generated automatically.')
        }

        if (response.remaining_credits < GENERATION_LIMITS.creditsPerRequest) {
            setShowPricingModal(true)
        }
        return { ok: true, reason: '' }
    }, [auth.isAuthenticated, generator, totalCredits])

    const handleGenerate = useCallback(async (config) => {
        if (!auth.isAuthenticated) {
            const saved = savePendingGenerationConfig(config)
            setShowLoginModal(true)
            setNoticeMessage(saved
                ? 'Please log in to continue. Your current draft is saved and will generate automatically after login.'
                : 'Please log in to continue.')
            return
        }

        await executeGenerate(config, 'manual')
    }, [auth.isAuthenticated, executeGenerate])

    useEffect(() => {
        if (!auth.isAuthenticated) {
            pendingAutoGenerateInFlightRef.current = false
            return
        }

        if (pendingAutoGenerateInFlightRef.current) {
            return
        }

        if (walletLoading || !wallet.wallet) {
            return
        }

        const pendingConfig = readPendingGenerationConfig()
        if (!pendingConfig) {
            return
        }

        pendingAutoGenerateInFlightRef.current = true
        ;(async () => {
            const result = await executeGenerate(pendingConfig, 'resume')
            if (result.reason !== 'unauthorized') {
                clearPendingGenerationConfig()
            }
        })().finally(() => {
            pendingAutoGenerateInFlightRef.current = false
        })
    }, [auth.isAuthenticated, executeGenerate, wallet.wallet, walletLoading])

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
            setNoticeMessage('Invite code redeemed successfully.')
            wallet.refreshWallet()
            return { ok: true, message: 'Invite code redeemed successfully.' }
        } catch (error) {
            setInviteStatus(error.message)
            setNoticeMessage(error.message)
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

    const handleProfileSave = useCallback(async ({ displayName, avatarFile, avatarUrl }) => {
        setProfileUpdateError('')
        setProfileUpdateLoading(true)

        try {
            const result = await auth.updateProfile({
                displayName,
                avatarFile,
                avatarUrl,
            })

            if (!result?.ok) {
                setProfileUpdateError(result?.error || 'Failed to update profile.')
                return
            }

            setShowProfileModal(false)
            setNoticeMessage('Profile updated successfully.')
        } catch (error) {
            setProfileUpdateError(error.message || 'Failed to update profile.')
        } finally {
            setProfileUpdateLoading(false)
        }
    }, [auth])

    const displayName = auth.profile?.display_name
        || auth.user?.user_metadata?.full_name
        || auth.user?.user_metadata?.name
        || auth.user?.user_metadata?.preferred_username
        || auth.user?.user_metadata?.user_name
        || auth.user?.email
        || 'User'
    const avatarUrl = auth.profile?.avatar_url
        || auth.user?.user_metadata?.avatar_url
        || auth.user?.user_metadata?.picture
        || buildDefaultAvatar(auth.user?.id)

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
            email: auth.user.email || '',
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
                        onEditProfile={() => {
                            setProfileUpdateError('')
                            setShowProfileModal(true)
                        }}
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

                            {!!noticeMessage && (
                                <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 px-4 py-3 text-sm">
                                    {noticeMessage}
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
                                    historyEntries={generator.historyEntries}
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
                                    onEmailOtpVerify={auth.verifyEmailOtp}
                                    errorMessage={auth.error}
                                    oauthProviders={auth.oauthProviders}
                                />
                            )}
                            {showCreditsModal && (
                                <CreditsHistoryModal
                                    isOpen={showCreditsModal}
                                    onClose={() => setShowCreditsModal(false)}
                                    transactions={transactions}
                                    isLoading={ledgerLoading}
                                    creditSummary={{
                                        totalCredits,
                                        permanentCredits,
                                        timedCredits,
                                    }}
                                />
                            )}
                            {showProfileModal && (
                                <ProfileEditModal
                                    isOpen={showProfileModal}
                                    onClose={() => {
                                        setShowProfileModal(false)
                                        setProfileUpdateError('')
                                    }}
                                    onSave={handleProfileSave}
                                    loading={profileUpdateLoading}
                                    errorMessage={profileUpdateError}
                                    userId={auth.user?.id || ''}
                                    email={auth.user?.email || ''}
                                    initialDisplayName={auth.profile?.display_name || ''}
                                    initialAvatarUrl={auth.profile?.avatar_url || ''}
                                    defaultAvatarUrl={buildDefaultAvatar(auth.user?.id)}
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
