/**
 * Header Component - User Dropdown Menu
 */

import { memo, useRef, useState, useEffect } from 'react'
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion'
import { springs } from '../motion/config'
import { Coins, Ticket, Link2, LogOut, ChevronDown, UserX } from 'lucide-react'

function MagneticNavButton({ children, onClick }) {
    const ref = useRef(null)
    const x = useMotionValue(0)
    const y = useMotionValue(0)
    const springX = useSpring(x, { stiffness: 400, damping: 30 })
    const springY = useSpring(y, { stiffness: 400, damping: 30 })

    const handleMouseMove = (event) => {
        if (!ref.current) return
        const rect = ref.current.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2
        x.set((event.clientX - centerX) * 0.2)
        y.set((event.clientY - centerY) * 0.2)
    }

    const handleMouseLeave = () => {
        x.set(0)
        y.set(0)
    }

    return (
        <motion.button
            ref={ref}
            onClick={onClick}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{ x: springX, y: springY }}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-full transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
            {children}
        </motion.button>
    )
}

function UserDropdown({
    user,
    creditSummary,
    coupons,
    inviteCode,
    inviteLink,
    inviteRedeemed,
    inviteStatus,
    onLogout,
    onDeleteAccount,
    onPricingClick,
    onCreditsClick,
    onRedeemInvite,
}) {
    const [isOpen, setIsOpen] = useState(false)
    const [couponExpanded, setCouponExpanded] = useState(false)
    const [copiedLink, setCopiedLink] = useState(false)
    const [copiedCode, setCopiedCode] = useState(false)
    const [inviteCodeInput, setInviteCodeInput] = useState('')
    const [redeemLoading, setRedeemLoading] = useState(false)
    const [localRedeemStatus, setLocalRedeemStatus] = useState('')
    const dropdownRef = useRef(null)
    const buttonRef = useRef(null)

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                isOpen &&
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target) &&
                buttonRef.current &&
                !buttonRef.current.contains(event.target)
            ) {
                setIsOpen(false)
                setCouponExpanded(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isOpen])

    useEffect(() => {
        if (inviteStatus) {
            setLocalRedeemStatus(inviteStatus)
        }
    }, [inviteStatus])

    const handleCopyLink = async () => {
        if (!inviteLink) return
        try {
            await navigator.clipboard.writeText(inviteLink)
            setCopiedLink(true)
            setTimeout(() => setCopiedLink(false), 2000)
        } catch {
            setCopiedLink(false)
        }
    }

    const handleCopyInviteCode = async () => {
        if (!inviteCode) return
        try {
            await navigator.clipboard.writeText(inviteCode)
            setCopiedCode(true)
            setTimeout(() => setCopiedCode(false), 2000)
        } catch {
            setCopiedCode(false)
        }
    }

    const handleCouponClick = () => {
        setIsOpen(false)
        onPricingClick()
    }

    const handleCreditsClick = () => {
        setIsOpen(false)
        onCreditsClick()
    }

    const handleRedeemInvite = async () => {
        const code = inviteCodeInput.trim()
        if (!code || inviteRedeemed || redeemLoading) return

        setRedeemLoading(true)
        setLocalRedeemStatus('')

        const result = await onRedeemInvite?.(code)
        if (result?.ok) {
            setInviteCodeInput('')
        }
        setLocalRedeemStatus(result?.message || '')
        setRedeemLoading(false)
    }

    const membership = user.membership || { tier: 'free', expires: null }
    const timedCredits = creditSummary?.timedCredits ?? 0
    const permanentCredits = creditSummary?.permanentCredits ?? 0
    const totalCredits = creditSummary?.totalCredits ?? 0

    const getMembershipStyle = (tier) => {
        switch (tier) {
            case 'pro':
                return {
                    ring: 'ring-pink-500',
                    label: 'Pro Member',
                    badge: 'bg-gradient-to-r from-[#E413A2] to-[#FF789A] text-white shadow-sm',
                }
            case 'elite':
                return {
                    ring: 'ring-amber-500',
                    label: 'Elite Member',
                    badge: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm',
                }
            default:
                return {
                    ring: 'ring-white',
                    label: 'You are not a member yet',
                    badge: 'text-gray-400',
                }
        }
    }

    const memberStyle = getMembershipStyle(membership.tier)
    const isFree = membership.tier === 'free' || !membership.tier

    return (
        <div className="relative">
            <motion.button
                ref={buttonRef}
                onClick={() => setIsOpen(!isOpen)}
                aria-label="Open user menu"
                className="flex items-center gap-3 p-1.5 pr-2.5 rounded-full hover:bg-gray-100 transition-colors"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
            >
                <img
                    src={user.avatar}
                    alt={user.name}
                    loading="lazy"
                    decoding="async"
                    className={`w-9 h-9 rounded-full object-cover ring-2 ${memberStyle.ring} shadow-md transition-all`}
                />
                <div className="flex flex-col items-start hidden sm:flex">
                    <span className="text-sm font-semibold text-gray-700 leading-none mb-1">{user.name}</span>
                    {!isFree && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded leading-none ${memberStyle.badge}`}>
                            {memberStyle.label}
                        </span>
                    )}
                </div>
                <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                    className="ml-1"
                >
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                </motion.div>
            </motion.button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        ref={dropdownRef}
                        className="absolute right-0 top-full mt-2 w-80 rounded-2xl overflow-hidden z-50"
                        style={{
                            background: 'rgba(255,255,255,0.98)',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
                            border: '1px solid rgba(0,0,0,0.05)',
                        }}
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    >
                        <div className="p-4 border-b border-gray-100">
                            <div className="flex items-center gap-3">
                                <img
                                    src={user.avatar}
                                    alt={user.name}
                                    loading="lazy"
                                    decoding="async"
                                    className={`w-12 h-12 rounded-full object-cover ring-2 ${memberStyle.ring}`}
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-gray-900 truncate mb-1">{user.name}</div>
                                    <div className="flex items-center justify-between">
                                        <span className={`text-[10px] font-bold ${isFree ? '' : 'px-2 py-0.5 rounded'} ${memberStyle.badge}`}>
                                            {memberStyle.label}
                                        </span>
                                        {membership.expires && (
                                            <span className="text-[10px] text-gray-300">Exp: {membership.expires}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-2">
                            <motion.div
                                onClick={handleCreditsClick}
                                className="px-4 py-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 mb-2 cursor-pointer hover:shadow-sm transition-all"
                                whileHover={{ x: 4, scale: 1.01 }}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                        <Coins className="w-[18px] h-[18px] text-amber-600" strokeWidth={1.5} />
                                        <span className="text-sm font-medium text-amber-800">Credits</span>
                                    </div>
                                    <span className="text-lg font-bold text-amber-600">{totalCredits}</span>
                                </div>
                                <div className="ml-8 text-[11px] text-amber-700 space-y-1">
                                    <div className="flex justify-between">
                                        <span>Timed Credits (限时)</span>
                                        <span className="font-semibold">{timedCredits}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Permanent Credits (永久)</span>
                                        <span className="font-semibold">{permanentCredits}</span>
                                    </div>
                                </div>
                            </motion.div>

                            <div>
                                <motion.button
                                    onClick={() => setCouponExpanded(!couponExpanded)}
                                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-gray-50 text-left"
                                    whileHover={{ x: 4 }}
                                >
                                    <div className="flex items-center gap-3">
                                        <Ticket className="w-[18px] h-[18px] text-gray-500" strokeWidth={1.5} />
                                        <span className="text-sm font-medium text-gray-700">Coupons</span>
                                    </div>
                                    <motion.div animate={{ rotate: couponExpanded ? 180 : 0 }}>
                                        <ChevronDown className="w-4 h-4 text-gray-400" />
                                    </motion.div>
                                </motion.button>

                                <AnimatePresence>
                                    {couponExpanded && (
                                        <motion.div
                                            className="ml-10 space-y-1 pb-2"
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                                        >
                                            <div
                                                onClick={handleCouponClick}
                                                className="flex items-center justify-between px-4 py-2 rounded-lg bg-amber-50 cursor-pointer hover:bg-amber-100 transition-colors"
                                            >
                                                <span className="text-sm text-amber-700">10% Off</span>
                                                <span className="text-sm font-bold text-amber-600">x{coupons.discount90}</span>
                                            </div>
                                            <div
                                                onClick={handleCouponClick}
                                                className="flex items-center justify-between px-4 py-2 rounded-lg bg-orange-50 cursor-pointer hover:bg-orange-100 transition-colors"
                                            >
                                                <span className="text-sm text-orange-700">15% Off</span>
                                                <span className="text-sm font-bold text-orange-600">x{coupons.discount85}</span>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            <motion.div className="px-4 py-3 rounded-xl hover:bg-gray-50" whileHover={{ x: 4 }}>
                                <div className="flex items-center gap-3 mb-2">
                                    <Link2 className="w-[18px] h-[18px] text-gray-500" strokeWidth={1.5} />
                                    <span className="text-sm font-medium text-gray-700">Invite</span>
                                    <span className="text-xs text-[#E413A2] bg-pink-50 px-2 py-0.5 rounded-full">+200 permanent</span>
                                </div>

                                <div className="flex items-center gap-2 ml-[30px] mb-2">
                                    <input
                                        type="text"
                                        value={inviteCode || ''}
                                        readOnly
                                        className="flex-1 min-w-0 text-xs text-gray-700 bg-gray-100 px-3 py-2 rounded-lg h-8"
                                    />
                                    <motion.button
                                        onClick={handleCopyInviteCode}
                                        aria-label="Copy invite code"
                                        disabled={!inviteCode}
                                        className="flex items-center gap-1 px-3 h-8 text-xs font-medium text-white bg-gray-800 rounded-lg whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                    >
                                        {copiedCode ? '✓ Copied' : 'Copy Code'}
                                    </motion.button>
                                </div>

                                <div className="flex items-center gap-2 ml-[30px]">
                                    <input
                                        type="text"
                                        value={inviteLink}
                                        readOnly
                                        className="flex-1 min-w-0 text-xs text-gray-500 bg-gray-100 px-3 py-2 rounded-lg truncate h-8"
                                    />
                                    <motion.button
                                        onClick={handleCopyLink}
                                        aria-label="Copy invite link"
                                        disabled={!inviteLink}
                                        className="flex items-center gap-1 px-3 h-8 text-xs font-medium text-white bg-gradient-to-r from-[#E413A2] to-[#FF789A] rounded-lg whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                    >
                                        {copiedLink ? '✓ Copied' : 'Copy'}
                                    </motion.button>
                                </div>

                                <div className="ml-[30px] mt-2 flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={inviteCodeInput}
                                        onChange={(event) => setInviteCodeInput(event.target.value)}
                                        placeholder={inviteRedeemed ? 'Invite code already redeemed' : 'Enter invite code'}
                                        disabled={inviteRedeemed || redeemLoading}
                                        className="flex-1 h-8 rounded-lg border border-gray-200 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-pink-200 disabled:bg-gray-100 disabled:text-gray-400"
                                    />
                                    <button
                                        onClick={handleRedeemInvite}
                                        disabled={inviteRedeemed || redeemLoading || !inviteCodeInput.trim()}
                                        className="h-8 px-3 text-xs font-medium rounded-lg bg-gray-800 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {redeemLoading ? 'Applying...' : 'Apply'}
                                    </button>
                                </div>

                                <div className="mt-1 ml-[30px] text-[10px] text-[#E413A2] font-light italic opacity-90">
                                    Each account can redeem one invite code only.
                                </div>

                                {localRedeemStatus && (
                                    <div className="mt-1 ml-[30px] text-[10px] text-gray-500">{localRedeemStatus}</div>
                                )}
                            </motion.div>

                            <div className="my-2 border-t border-gray-100" />

                            <motion.button
                                onClick={() => {
                                    setIsOpen(false)
                                    onLogout()
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-50 text-left"
                                whileHover={{ x: 4 }}
                            >
                                <LogOut className="w-[18px] h-[18px] text-red-500" strokeWidth={1.5} />
                                <span className="text-sm font-medium text-red-600">Log Out</span>
                            </motion.button>

                            <motion.button
                                onClick={() => {
                                    setIsOpen(false)
                                    onDeleteAccount?.()
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-100 text-left"
                                whileHover={{ x: 4 }}
                            >
                                <UserX className="w-[18px] h-[18px] text-gray-500" strokeWidth={1.5} />
                                <span className="text-sm font-medium text-gray-500">注销账户</span>
                            </motion.button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

const Header = memo(function Header({
    creditSummary,
    isLoggedIn,
    user,
    coupons,
    inviteCode,
    inviteLink,
    inviteRedeemed,
    inviteStatus,
    onPricingClick,
    onLoginClick,
    onLogout,
    onDeleteAccount,
    onCreditsClick,
    onRedeemInvite,
}) {
    const scrollToFeatures = () => {
        const element = document.getElementById('features-section')
        if (element) {
            const yOffset = -100
            const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset
            window.scrollTo({ top: y, behavior: 'smooth' })
        }
    }

    return (
        <motion.header
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', ...springs.smooth }}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                height: '64px',
                zIndex: 1000,
                background: 'rgba(255, 255, 255, 0.85)',
                backdropFilter: 'blur(20px)',
                borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
            }}
            className="flex items-center justify-between px-8"
        >
            <div className="flex items-center gap-8">
                <motion.a
                    href="/"
                    className="flex items-center gap-2"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                >
                    <img src="/logo-text.svg" alt="AI Reply" className="h-8 w-auto" width="128" height="32" />
                    <span className="text-xl font-bold tracking-tight text-gray-900">AI Reply</span>
                </motion.a>

                <nav className="hidden sm:flex gap-1">
                    <MagneticNavButton onClick={scrollToFeatures}>About</MagneticNavButton>
                    <MagneticNavButton onClick={onPricingClick}>Pricing</MagneticNavButton>
                </nav>
            </div>

            <div className="flex items-center gap-4">
                {isLoggedIn && user ? (
                    <UserDropdown
                        user={user}
                        creditSummary={creditSummary}
                        coupons={coupons}
                        inviteCode={inviteCode}
                        inviteLink={inviteLink}
                        inviteRedeemed={inviteRedeemed}
                        inviteStatus={inviteStatus}
                        onLogout={onLogout}
                        onDeleteAccount={onDeleteAccount}
                        onPricingClick={onPricingClick}
                        onCreditsClick={onCreditsClick}
                        onRedeemInvite={onRedeemInvite}
                    />
                ) : (
                    <motion.button
                        onClick={onLoginClick}
                        className="px-5 py-2 text-sm font-semibold text-white rounded-full bg-gradient-to-r from-[#E413A2] to-[#FF789A]"
                        style={{ boxShadow: '0 4px 14px rgba(228, 19, 162, 0.3)' }}
                        whileHover={{
                            scale: 1.05,
                            boxShadow: '0 8px 24px rgba(228, 19, 162, 0.4)',
                        }}
                        whileTap={{ scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    >
                        Login
                    </motion.button>
                )}
            </div>
        </motion.header>
    )
})

export default Header
