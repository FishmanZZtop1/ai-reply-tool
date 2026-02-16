/**
 * Pricing Modal - Physics-based Animation
 * 
 * Features:
 * - Spring-based modal entrance with overshoot
 * - 3D tilt cards with sheen effect
 * - Smooth backdrop blur transition
 */

import { memo, useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion'
import { modalBackdrop, modalContent, springs } from '../../motion/config'

// 3D Tilt Card for pricing
function PricingCard({ children, className, isPopular, ...props }) {
    const ref = useRef(null)

    const rotateX = useMotionValue(0)
    const rotateY = useMotionValue(0)
    const sheenX = useMotionValue(50)
    const sheenY = useMotionValue(50)

    const springRotateX = useSpring(rotateX, { stiffness: 300, damping: 30 })
    const springRotateY = useSpring(rotateY, { stiffness: 300, damping: 30 })

    const handleMouseMove = (e) => {
        if (!ref.current) return
        const rect = ref.current.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2
        const percentX = (e.clientX - centerX) / (rect.width / 2)
        const percentY = (e.clientY - centerY) / (rect.height / 2)

        rotateY.set(percentX * 6)
        rotateX.set(-percentY * 6)
        sheenX.set(((e.clientX - rect.left) / rect.width) * 100)
        sheenY.set(((e.clientY - rect.top) / rect.height) * 100)
    }

    const handleMouseLeave = () => {
        rotateX.set(0)
        rotateY.set(0)
    }

    return (
        <motion.div
            ref={ref}
            className={`relative rounded-2xl p-6 cursor-pointer overflow-hidden ${className}`}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{
                rotateX: springRotateX,
                rotateY: springRotateY,
                transformStyle: 'preserve-3d',
                perspective: 1000
            }}
            whileHover={{
                scale: 1.03,
                boxShadow: isPopular
                    ? '0 30px 60px rgba(228, 19, 162, 0.3), 0 0 0 3px rgba(228, 19, 162, 0.3)'
                    : '0 25px 50px rgba(0, 0, 0, 0.15), 0 0 0 2px rgba(228, 19, 162, 0.2)'
            }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            {...props}
        >
            {children}
            {/* Sheen overlay */}
            <div
                className="absolute inset-0 pointer-events-none rounded-2xl opacity-0 hover:opacity-100 transition-opacity duration-300"
                style={{
                    background: `radial-gradient(circle at 50% 50%, rgba(255,255,255,0.2) 0%, transparent 60%)`
                }}
            />
        </motion.div>
    )
}

const PricingModal = memo(function PricingModal({ isOpen, onClose, onCheckout, checkoutLoadingPlan }) {
    const [monthlyType, setMonthlyType] = useState('subscription')
    const [countdown, setCountdown] = useState({ days: 14, hours: 23, minutes: 59, seconds: 59 })

    useEffect(() => {
        if (!isOpen) return

        const timer = setInterval(() => {
            setCountdown(prev => {
                let { days, hours, minutes, seconds } = prev
                seconds--
                if (seconds < 0) { seconds = 59; minutes-- }
                if (minutes < 0) { minutes = 59; hours-- }
                if (hours < 0) { hours = 23; days-- }
                if (days < 0) return prev
                return { days, hours, minutes, seconds }
            })
        }, 1000)

        return () => clearInterval(timer)
    }, [isOpen])

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
                    {/* Backdrop with blur */}
                    <motion.div
                        className="absolute inset-0 bg-black/30"
                        style={{ backdropFilter: 'blur(8px)' }}
                        variants={modalBackdrop}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        onClick={onClose}
                    />

                    {/* Modal Content */}
                    <motion.div
                        className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl p-8"
                        style={{
                            background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.9) 100%)',
                            boxShadow: '0 25px 80px rgba(0,0,0,0.15)',
                            border: '1px solid rgba(255,255,255,0.6)'
                        }}
                        variants={modalContent}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                    >
                        {/* Close Button */}
                        <motion.button
                            onClick={onClose}
                            aria-label="Close pricing modal"
                            className="absolute top-5 right-5 w-10 h-10 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                        </motion.button>

                        {/* Title */}
                        <motion.div
                            className="text-center mb-10"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1, type: 'spring', ...springs.smooth }}
                        >
                            <span className="text-xs font-bold uppercase tracking-widest text-[#E413A2] mb-3 block">Pricing</span>
                            <h2 className="text-3xl font-bold text-gray-900">Choose Your Plan</h2>
                        </motion.div>

                        {/* Plans Grid */}
                        <div className="grid md:grid-cols-3 gap-5">
                            {/* Plan 1: Credit Pack */}
                            <motion.div
                                initial={{ opacity: 0, y: 40 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.15, type: 'spring', ...springs.smooth }}
                            >
                                <PricingCard
                                    className="bg-white/80 border border-gray-100"
                                    style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}
                                >
                                    <div className="text-center mb-6">
                                        <div className="text-4xl mb-3">💎</div>
                                        <h3 className="text-xl font-bold text-gray-900 mb-1">Credit Pack</h3>
                                        <p className="text-gray-400 text-xs">First purchase bonus</p>
                                    </div>

                                    <div className="text-center mb-6">
                                        <div className="text-4xl font-bold bg-gradient-to-r from-[#E413A2] to-[#FF789A] bg-clip-text text-transparent">$1.99</div>
                                        <div className="text-sm text-gray-400 line-through mt-1">$8.8</div>
                                    </div>

                                    <ul className="space-y-3 mb-6 text-sm">
                                        <li className="flex items-start gap-2">
                                            <span className="text-emerald-500 mt-0.5">✓</span>
                                            <span className="text-gray-600">1500 credits + <span className="text-[#E413A2] font-semibold">500 bonus</span></span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-emerald-500 mt-0.5">✓</span>
                                            <span className="text-gray-600">Permanent credits never expire</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-emerald-500 mt-0.5">✓</span>
                                            <span className="text-gray-600">Stackable purchases</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-emerald-500 mt-0.5">✓</span>
                                            <span className="text-gray-600">10% off coupon after use</span>
                                        </li>
                                    </ul>

                                    <motion.button
                                        onClick={() => onCheckout?.('credit_pack_starter')}
                                        disabled={checkoutLoadingPlan === 'credit_pack_starter'}
                                        className="w-full py-3 rounded-xl font-semibold text-sm border border-gray-200 text-gray-700 disabled:opacity-60 disabled:cursor-not-allowed"
                                        whileHover={{
                                            scale: 1.02,
                                            borderColor: 'rgba(228, 19, 162, 0.5)',
                                            boxShadow: '0 8px 24px rgba(228, 19, 162, 0.15)'
                                        }}
                                        whileTap={{ scale: 0.98 }}
                                        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                                    >
                                        {checkoutLoadingPlan === 'credit_pack_starter' ? 'Redirecting...' : 'Buy Now'}
                                    </motion.button>
                                </PricingCard>
                            </motion.div>

                            {/* Plan 2: Monthly Member */}
                            <motion.div
                                initial={{ opacity: 0, y: 40 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2, type: 'spring', ...springs.smooth }}
                            >
                                <PricingCard
                                    isPopular
                                    className="bg-gradient-to-br from-pink-50/80 to-pink-100/80 border-2 border-pink-200"
                                    style={{ boxShadow: '0 8px 30px rgba(228, 19, 162, 0.15)' }}
                                >
                                    {/* Popular Badge - Corner Ribbon */}
                                    <div className="absolute -top-1 -left-1 z-10">
                                        <motion.div
                                            className="bg-gradient-to-r from-[#E413A2] to-[#FF789A] text-white text-xs font-bold px-4 py-1.5 rounded-br-xl rounded-tl-xl shadow-lg"
                                            animate={{ scale: [1, 1.02, 1] }}
                                            transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                                        >
                                            🔥 Most Popular
                                        </motion.div>
                                    </div>

                                    <div className="text-center mb-4 pt-2">
                                        <div className="text-4xl mb-3">👑</div>
                                        <h3 className="text-xl font-bold text-gray-900 mb-1">Monthly Pro</h3>
                                    </div>

                                    {/* Toggle */}
                                    <div className="flex justify-center mb-4">
                                        <div className="inline-flex p-1 bg-white/80 rounded-full shadow-sm">
                                            <motion.button
                                                onClick={() => setMonthlyType('subscription')}
                                                className={`px-4 py-2 rounded-full text-xs font-semibold ${monthlyType === 'subscription' ? 'bg-white text-gray-800 shadow-md' : 'text-gray-500'}`}
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                            >
                                                Auto-renew
                                            </motion.button>
                                            <motion.button
                                                onClick={() => setMonthlyType('single')}
                                                className={`px-4 py-2 rounded-full text-xs font-semibold ${monthlyType === 'single' ? 'bg-white text-gray-800 shadow-md' : 'text-gray-500'}`}
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                            >
                                                One-time
                                            </motion.button>
                                        </div>
                                    </div>

                                    <div className="text-center mb-6">
                                        <motion.div
                                            key={monthlyType}
                                            className="text-4xl font-bold bg-gradient-to-r from-[#E413A2] to-[#FF789A] bg-clip-text text-transparent"
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ type: 'spring', stiffness: 300 }}
                                        >
                                            ${monthlyType === 'subscription' ? '29.8' : '39.8'}
                                        </motion.div>
                                        <div className="text-xs text-gray-500 mt-1">
                                            {monthlyType === 'subscription' ? 'Cancel anytime' : '/month'}
                                        </div>
                                    </div>

                                    <ul className="space-y-3 mb-6 text-sm">
                                        <li className="flex items-start gap-2">
                                            <span className="text-emerald-500 mt-0.5">✓</span>
                                            <span className="text-gray-600"><span className="text-[#E413A2] font-semibold">2000 timed credits</span> daily</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-emerald-500 mt-0.5">✓</span>
                                            <span className="text-gray-600">Timed credits reset daily (not cumulative)</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-emerald-500 mt-0.5">✓</span>
                                            <span className="text-gray-600">Top-up & invite credits are permanent</span>
                                        </li>
                                    </ul>

                                    <motion.button
                                        onClick={() => onCheckout?.(monthlyType === 'subscription' ? 'monthly_pro_auto' : 'monthly_pro_once')}
                                        disabled={checkoutLoadingPlan === (monthlyType === 'subscription' ? 'monthly_pro_auto' : 'monthly_pro_once')}
                                        className="w-full py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-[#E413A2] to-[#FF789A] text-white disabled:opacity-60 disabled:cursor-not-allowed"
                                        whileHover={{
                                            scale: 1.02,
                                            boxShadow: '0 12px 32px rgba(228, 19, 162, 0.4)'
                                        }}
                                        whileTap={{ scale: 0.98 }}
                                        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                                        style={{ boxShadow: '0 8px 24px rgba(228, 19, 162, 0.3)' }}
                                    >
                                        {checkoutLoadingPlan === (monthlyType === 'subscription' ? 'monthly_pro_auto' : 'monthly_pro_once')
                                            ? 'Redirecting...'
                                            : 'Subscribe Now'}
                                    </motion.button>
                                </PricingCard>
                            </motion.div>

                            {/* Plan 3: Lifetime Member */}
                            <motion.div
                                initial={{ opacity: 0, y: 40 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.25, type: 'spring', ...springs.smooth }}
                            >
                                <PricingCard
                                    className="bg-gradient-to-br from-amber-50/80 to-orange-50/80 border border-amber-200"
                                    style={{ boxShadow: '0 4px 20px rgba(251,191,36,0.1)' }}
                                >
                                    {/* Urgency Banner */}
                                    <motion.div
                                        className="absolute top-0 left-0 right-0 py-2 text-center text-xs font-bold text-white rounded-t-2xl"
                                        style={{ background: 'linear-gradient(90deg, #EF4444 0%, #F97316 50%, #EF4444 100%)' }}
                                        animate={{
                                            backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
                                        }}
                                        transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
                                    >
                                        🔥 Flash Sale · {countdown.days}d {String(countdown.hours).padStart(2, '0')}:{String(countdown.minutes).padStart(2, '0')}:{String(countdown.seconds).padStart(2, '0')} left
                                    </motion.div>

                                    <div className="text-center mb-4 pt-8">
                                        <div className="text-4xl mb-3">🏆</div>
                                        <h3 className="text-xl font-bold text-gray-900 mb-1">Lifetime Pro</h3>
                                    </div>

                                    <div className="text-center mb-6">
                                        <div className="text-4xl font-bold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">$188</div>
                                        <div className="text-sm text-gray-400 line-through mt-1">$288</div>
                                    </div>

                                    <ul className="space-y-2.5 mb-6 text-sm">
                                        <li className="flex items-start gap-2">
                                            <span className="text-emerald-500 mt-0.5">✓</span>
                                            <span className="text-gray-600"><span className="text-amber-600 font-semibold">5000 timed credits</span> daily</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-emerald-500 mt-0.5">✓</span>
                                            <span className="text-gray-600">Timed credits reset daily (not cumulative)</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-emerald-500 mt-0.5">✓</span>
                                            <span className="text-gray-600">Top-up & invite credits are permanent</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-emerald-500 mt-0.5">✓</span>
                                            <span className="text-gray-600">Priority support</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-emerald-500 mt-0.5">✓</span>
                                            <span className="text-gray-600">Free access to new features</span>
                                        </li>
                                    </ul>

                                    <motion.button
                                        onClick={() => onCheckout?.('lifetime_pro')}
                                        disabled={checkoutLoadingPlan === 'lifetime_pro'}
                                        className="w-full py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-amber-500 to-orange-500 text-white disabled:opacity-60 disabled:cursor-not-allowed"
                                        whileHover={{
                                            scale: 1.02,
                                            boxShadow: '0 12px 32px rgba(251, 146, 60, 0.4)'
                                        }}
                                        whileTap={{ scale: 0.98 }}
                                        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                                        style={{ boxShadow: '0 8px 24px rgba(251, 146, 60, 0.3)' }}
                                    >
                                        {checkoutLoadingPlan === 'lifetime_pro' ? 'Redirecting...' : '🎉 Get Lifetime Access'}
                                    </motion.button>
                                </PricingCard>
                            </motion.div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
})

export default PricingModal
