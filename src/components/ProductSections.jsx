/**
 * Product Sections - Scroll Reveal Animation
 * 
 * Features:
 * - Staggered reveal on scroll
 * - 3D tilt cards for testimonials
 * - Spring physics for all animations
 */

import { memo, useRef } from 'react'
import { motion, useInView, useMotionValue, useSpring } from 'framer-motion'
import { springs, staggerItem } from '../motion/config'

// Real avatars
const TESTIMONIALS = [
    {
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face',
        name: 'Alex Chen',
        role: 'Product Manager',
        text: "This tool is absolutely insane! Used to spend 30 mins crafting emails, now it's done in seconds. Total game changer for my workflow."
    },
    {
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face',
        name: 'Sarah Kim',
        role: 'Freelance Designer',
        text: "As a freelancer handling tons of client messages daily, this saves me hours every week. The tone matching is spot on!"
    },
    {
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
        name: 'Mike Johnson',
        role: 'Software Engineer',
        text: "My colleagues think I've become way more professional. Little do they know it's AI Reply doing the heavy lifting 😄"
    },
    {
        avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face',
        name: 'Lisa Wang',
        role: 'Teacher',
        text: "Replying to parents just got so much easier. The AI understands context perfectly and keeps the tone warm yet professional."
    },
    {
        avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face',
        name: 'David Lee',
        role: 'Restaurant Owner',
        text: "Customer inquiries used to stress me out. Now I handle them in minutes with perfectly crafted responses. Love it!"
    },
    {
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face',
        name: 'Emma Zhang',
        role: 'Healthcare Professional',
        text: "The empathy in generated responses is remarkable. Patients feel heard, and I save so much time. Brilliant tool!"
    }
]

const USE_CASES = [
    { emoji: '📧', text: 'Professional Emails' },
    { emoji: '💬', text: 'Customer Support' },
    { emoji: '📱', text: 'Social Media' },
    { emoji: '💕', text: 'Dating Apps' },
    { emoji: '👨‍👩‍👦', text: 'Family Messages' },
    { emoji: '💼', text: 'Job Applications' },
    { emoji: '🎓', text: 'Academic Writing' },
    { emoji: '🤝', text: 'Business Proposals' }
]

// 3D Tilt Testimonial Card
function TestimonialCard({ testimonial }) {
    const ref = useRef(null)

    const rotateX = useMotionValue(0)
    const rotateY = useMotionValue(0)

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
    }

    const handleMouseLeave = () => {
        rotateX.set(0)
        rotateY.set(0)
    }

    return (
        <motion.div
            ref={ref}
            className="relative p-6 rounded-2xl cursor-pointer overflow-hidden"
            style={{
                background: 'rgba(255,255,255,0.8)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.6)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
                rotateX: springRotateX,
                rotateY: springRotateY,
                transformStyle: 'preserve-3d',
                perspective: 1000
            }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            variants={staggerItem}
            whileHover={{
                scale: 1.02,
                boxShadow: '0 20px 50px rgba(0,0,0,0.12)'
            }}
            transition={{ type: 'spring', ...springs.snappy }}
        >
            <div className="flex items-center gap-3 mb-4">
                <img
                    src={testimonial.avatar}
                    alt={testimonial.name}
                    loading="lazy"
                    decoding="async"
                    width="48"
                    height="48"
                    className="w-12 h-12 rounded-full object-cover ring-2 ring-white shadow-md"
                />
                <div>
                    <div className="font-semibold text-gray-800">{testimonial.name}</div>
                    <div className="text-xs text-gray-400">{testimonial.role}</div>
                </div>
            </div>
            <p className="text-gray-600 text-sm leading-relaxed italic">
                "{testimonial.text}"
            </p>
            {/* Subtle sheen */}
            <div
                className="absolute inset-0 pointer-events-none rounded-2xl opacity-0 hover:opacity-100 transition-opacity"
                style={{
                    background: 'radial-gradient(circle at 50% 0%, rgba(255,255,255,0.3) 0%, transparent 50%)'
                }}
            />
        </motion.div>
    )
}

// Animated Section with scroll reveal
function AnimatedSection({ children, className }) {
    const ref = useRef(null)
    const isInView = useInView(ref, { once: true, margin: '-100px' })

    return (
        <motion.div
            ref={ref}
            className={className}
            initial="hidden"
            animate={isInView ? 'visible' : 'hidden'}
            variants={{
                hidden: { opacity: 0 },
                visible: {
                    opacity: 1,
                    transition: { staggerChildren: 0.08, delayChildren: 0.1 }
                }
            }}
        >
            {children}
        </motion.div>
    )
}

const ProductSections = memo(function ProductSections() {
    const featuresRef = useRef(null)
    const featuresInView = useInView(featuresRef, { once: true, margin: '-100px' })

    const useCasesRef = useRef(null)
    const useCasesInView = useInView(useCasesRef, { once: true, margin: '-100px' })

    const statsRef = useRef(null)
    const statsInView = useInView(statsRef, { once: true, margin: '-100px' })

    return (
        <section className="py-20 space-y-28">
            {/* Features Grid */}
            <div id="features-section" ref={featuresRef}>
                <motion.h2
                    className="text-3xl sm:text-4xl font-bold text-center mb-12 text-gray-900"
                    initial={{ opacity: 0, y: 20 }}
                    animate={featuresInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ type: 'spring', ...springs.smooth }}
                >
                    <span className="bg-gradient-to-r from-[#E413A2] to-[#FF789A] bg-clip-text text-transparent">
                        Powerful Features
                    </span>
                </motion.h2>

                <motion.div
                    className="grid md:grid-cols-3 gap-6"
                    initial="hidden"
                    animate={featuresInView ? 'visible' : 'hidden'}
                    variants={{
                        hidden: {},
                        visible: { transition: { staggerChildren: 0.1 } }
                    }}
                >
                    {[
                        { icon: '🎯', title: 'Context-Aware', desc: 'AI understands the full context of your conversation' },
                        { icon: '⚡', title: 'Lightning Fast', desc: 'Generate multiple reply options in seconds' },
                        { icon: '🎨', title: 'Customizable Tone', desc: 'Match your personal style perfectly' }
                    ].map((feature, i) => (
                        <motion.div
                            key={i}
                            className="p-6 text-center rounded-2xl cursor-pointer"
                            style={{
                                background: 'rgba(255,255,255,0.7)',
                                backdropFilter: 'blur(16px)',
                                border: '1px solid rgba(255,255,255,0.5)',
                                boxShadow: '0 4px 20px rgba(0,0,0,0.04)'
                            }}
                            variants={staggerItem}
                            whileHover={{
                                y: -8,
                                boxShadow: '0 20px 50px rgba(228, 19, 162, 0.15)'
                            }}
                            transition={{ type: 'spring', ...springs.snappy }}
                        >
                            <motion.div
                                className="text-5xl mb-4"
                                whileHover={{ scale: 1.2, rotate: 10 }}
                                transition={{ type: 'spring', stiffness: 300 }}
                            >
                                {feature.icon}
                            </motion.div>
                            <h3 className="text-lg font-bold text-gray-900 mb-2">{feature.title}</h3>
                            <p className="text-gray-500 text-sm">{feature.desc}</p>
                        </motion.div>
                    ))}
                </motion.div>
            </div>

            {/* Use Cases */}
            <div ref={useCasesRef}>
                <motion.h2
                    className="text-3xl sm:text-4xl font-bold text-center mb-12 text-gray-900"
                    initial={{ opacity: 0, y: 20 }}
                    animate={useCasesInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ type: 'spring', ...springs.smooth }}
                >
                    Perfect For
                </motion.h2>

                <motion.div
                    className="flex flex-wrap justify-center gap-3 mb-16"
                    initial="hidden"
                    animate={useCasesInView ? 'visible' : 'hidden'}
                    variants={{
                        hidden: {},
                        visible: { transition: { staggerChildren: 0.05 } }
                    }}
                >
                    {USE_CASES.map((useCase, i) => (
                        <motion.span
                            key={i}
                            className="px-5 py-2.5 rounded-full text-sm font-medium cursor-pointer"
                            style={{
                                background: 'rgba(255,255,255,0.7)',
                                backdropFilter: 'blur(12px)',
                                border: '1px solid rgba(255,255,255,0.5)',
                                boxShadow: '0 2px 10px rgba(0,0,0,0.04)'
                            }}
                            variants={staggerItem}
                            whileHover={{
                                y: -3,
                                scale: 1.05,
                                boxShadow: '0 10px 30px rgba(228, 19, 162, 0.15)',
                                background: 'rgba(228, 19, 162, 0.1)'
                            }}
                            transition={{ type: 'spring', ...springs.snappy }}
                        >
                            <span className="mr-2">{useCase.emoji}</span>
                            <span className="text-gray-700">{useCase.text}</span>
                        </motion.span>
                    ))}
                </motion.div>

                {/* Testimonials */}
                <AnimatedSection className="grid md:grid-cols-3 gap-5">
                    {TESTIMONIALS.map((testimonial, i) => (
                        <TestimonialCard key={i} testimonial={testimonial} />
                    ))}
                </AnimatedSection>
            </div>

            {/* Stats */}
            <motion.div
                ref={statsRef}
                className="p-10 rounded-3xl"
                style={{
                    background: 'linear-gradient(135deg, rgba(228,19,162,0.03) 0%, rgba(251,146,60,0.03) 100%)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(228,19,162,0.15)'
                }}
                initial={{ opacity: 0, y: 40 }}
                animate={statsInView ? { opacity: 1, y: 0 } : {}}
                transition={{ type: 'spring', ...springs.smooth }}
            >
                <div className="grid grid-cols-3 gap-8 text-center">
                    {[
                        { number: '10M+', label: 'Replies Generated' },
                        { number: '98%', label: 'Satisfaction Rate' },
                        { number: '150+', label: 'Languages Supported' }
                    ].map((stat, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={statsInView ? { opacity: 1, scale: 1 } : {}}
                            transition={{ delay: 0.1 * i, type: 'spring', ...springs.bouncy }}
                        >
                            <div className="text-4xl font-bold bg-gradient-to-r from-[#E413A2] to-[#FF789A] bg-clip-text text-transparent mb-2">
                                {stat.number}
                            </div>
                            <div className="text-gray-500 text-sm">{stat.label}</div>
                        </motion.div>
                    ))}
                </div>
            </motion.div>
        </section>
    )
})

export default ProductSections
