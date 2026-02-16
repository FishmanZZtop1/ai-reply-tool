/**
 * Magnetic Button Component
 * 
 * Creates a "force field" effect where the button slightly follows
 * the cursor when it's near, and springs back when cursor leaves.
 */

import { motion, useMotionValue, useSpring } from 'framer-motion'
import { useRef } from 'react'
import { springs } from './config'

export function MagneticButton({ children, className, ...props }) {
    const ref = useRef(null)

    // Motion values for position
    const x = useMotionValue(0)
    const y = useMotionValue(0)

    // Apply spring physics to the motion values
    const springX = useSpring(x, { stiffness: 400, damping: 30 })
    const springY = useSpring(y, { stiffness: 400, damping: 30 })

    const handleMouseMove = (e) => {
        if (!ref.current) return

        const rect = ref.current.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2

        // Calculate distance from center (limited to 12px max displacement)
        const deltaX = (e.clientX - centerX) * 0.3
        const deltaY = (e.clientY - centerY) * 0.3

        x.set(Math.max(-12, Math.min(12, deltaX)))
        y.set(Math.max(-8, Math.min(8, deltaY)))
    }

    const handleMouseLeave = () => {
        x.set(0)
        y.set(0)
    }

    return (
        <motion.button
            ref={ref}
            className={className}
            style={{ x: springX, y: springY }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', ...springs.snappy }}
            {...props}
        >
            {children}
        </motion.button>
    )
}

/**
 * 3D Tilt Card Component
 * 
 * Card that tilts based on mouse position within the card,
 * with a sheen/highlight effect that follows the tilt.
 */
export function TiltCard({ children, className, ...props }) {
    const ref = useRef(null)

    const rotateX = useMotionValue(0)
    const rotateY = useMotionValue(0)
    const sheenX = useMotionValue(50)
    const sheenY = useMotionValue(50)

    const springRotateX = useSpring(rotateX, { stiffness: 300, damping: 30 })
    const springRotateY = useSpring(rotateY, { stiffness: 300, damping: 30 })
    const springSheenX = useSpring(sheenX, { stiffness: 200, damping: 25 })
    const springSheenY = useSpring(sheenY, { stiffness: 200, damping: 25 })

    const handleMouseMove = (e) => {
        if (!ref.current) return

        const rect = ref.current.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2

        // Calculate rotation (max 8 degrees)
        const percentX = (e.clientX - centerX) / (rect.width / 2)
        const percentY = (e.clientY - centerY) / (rect.height / 2)

        rotateY.set(percentX * 8)
        rotateX.set(-percentY * 8)

        // Sheen position (0-100%)
        sheenX.set(((e.clientX - rect.left) / rect.width) * 100)
        sheenY.set(((e.clientY - rect.top) / rect.height) * 100)
    }

    const handleMouseLeave = () => {
        rotateX.set(0)
        rotateY.set(0)
        sheenX.set(50)
        sheenY.set(50)
    }

    return (
        <motion.div
            ref={ref}
            className={className}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{
                rotateX: springRotateX,
                rotateY: springRotateY,
                transformStyle: 'preserve-3d',
                perspective: 1000
            }}
            whileHover={{ scale: 1.02, z: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            {...props}
        >
            {children}
            {/* Sheen overlay */}
            <motion.div
                className="absolute inset-0 pointer-events-none rounded-inherit"
                style={{
                    background: `radial-gradient(circle at ${springSheenX}% ${springSheenY}%, rgba(255,255,255,0.15) 0%, transparent 50%)`,
                    borderRadius: 'inherit'
                }}
            />
        </motion.div>
    )
}

/**
 * Animated Section Component
 * 
 * Reveals content when scrolled into view with stagger effect.
 */
import { useInView } from 'framer-motion'

export function AnimatedSection({ children, className, staggerDelay = 0.08 }) {
    const ref = useRef(null)
    const isInView = useInView(ref, { once: true, margin: '-100px' })

    return (
        <motion.section
            ref={ref}
            className={className}
            initial="hidden"
            animate={isInView ? 'visible' : 'hidden'}
            variants={{
                hidden: { opacity: 0 },
                visible: {
                    opacity: 1,
                    transition: {
                        staggerChildren: staggerDelay,
                        delayChildren: 0.1
                    }
                }
            }}
        >
            {children}
        </motion.section>
    )
}

export function AnimatedItem({ children, className }) {
    return (
        <motion.div
            className={className}
            variants={{
                hidden: {
                    opacity: 0,
                    y: 40,
                    scale: 0.95
                },
                visible: {
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    transition: {
                        type: 'spring',
                        stiffness: 200,
                        damping: 20
                    }
                }
            }}
        >
            {children}
        </motion.div>
    )
}
