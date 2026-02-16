/**
 * Custom Cursor Component
 * 
 * A custom cursor with Lerp (linear interpolation) delay.
 * The cursor slowly catches up to the mouse position,
 * creating an organic, fluid feel.
 */

import { motion, useMotionValue, useSpring } from 'framer-motion'
import { useEffect, useState } from 'react'

export function CustomCursor() {
    const [isVisible, setIsVisible] = useState(false)
    const [isHovering, setIsHovering] = useState(false)
    const [reducedMotion, setReducedMotion] = useState(false)

    // Raw mouse position
    const mouseX = useMotionValue(0)
    const mouseY = useMotionValue(0)

    // Smoothed position with spring physics (the "lag" effect)
    const springConfig = { stiffness: 150, damping: 15, mass: 0.1 }
    const cursorX = useSpring(mouseX, springConfig)
    const cursorY = useSpring(mouseY, springConfig)

    // Slower trail for the glow effect
    const trailConfig = { stiffness: 80, damping: 20, mass: 0.2 }
    const trailX = useSpring(mouseX, trailConfig)
    const trailY = useSpring(mouseY, trailConfig)

    useEffect(() => {
        const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
        const updateMotionPreference = () => setReducedMotion(motionQuery.matches)
        updateMotionPreference()

        const handleMouseMove = (e) => {
            mouseX.set(e.clientX)
            mouseY.set(e.clientY)
            setIsVisible(true)
        }

        const handleMouseEnter = () => setIsVisible(true)
        const handleMouseLeave = () => setIsVisible(false)

        // Detect hoverable elements
        const handleElementHover = (e) => {
            const target = e.target
            const isInteractive =
                target.tagName === 'BUTTON' ||
                target.tagName === 'A' ||
                target.closest('button') ||
                target.closest('a') ||
                target.classList.contains('cursor-pointer')

            setIsHovering(isInteractive)
        }

        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('mouseenter', handleMouseEnter)
        window.addEventListener('mouseleave', handleMouseLeave)
        document.addEventListener('mouseover', handleElementHover)
        motionQuery.addEventListener('change', updateMotionPreference)

        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseenter', handleMouseEnter)
            window.removeEventListener('mouseleave', handleMouseLeave)
            document.removeEventListener('mouseover', handleElementHover)
            motionQuery.removeEventListener('change', updateMotionPreference)
        }
    }, [mouseX, mouseY])

    // Don't render on touch devices
    if ((typeof window !== 'undefined' && 'ontouchstart' in window) || reducedMotion) {
        return null
    }

    return (
        <>
            {/* Main cursor dot - Pink */}
            <motion.div
                className="fixed top-0 left-0 pointer-events-none z-[9999]"
                style={{
                    x: cursorX,
                    y: cursorY,
                    translateX: '-50%',
                    translateY: '-50%'
                }}
                animate={{
                    scale: isHovering ? 1.5 : 1,
                    opacity: isVisible ? 1 : 0
                }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            >
                <div
                    className="w-3 h-3 rounded-full"
                    style={{
                        background: '#FFFFFF',
                        boxShadow: '0 0 12px rgba(255, 255, 255, 0.8), 0 2px 8px rgba(0, 0, 0, 0.15)'
                    }}
                />
            </motion.div>

            {/* Trailing glow */}
            <motion.div
                className="fixed top-0 left-0 pointer-events-none z-[9998]"
                style={{
                    x: trailX,
                    y: trailY,
                    translateX: '-50%',
                    translateY: '-50%'
                }}
                animate={{
                    scale: isHovering ? 2 : 1,
                    opacity: isVisible ? 0.3 : 0
                }}
                transition={{ type: 'spring', stiffness: 200, damping: 25 }}
            >
                <div
                    className="w-8 h-8 rounded-full"
                    style={{
                        background: 'radial-gradient(circle, rgba(255,255,255,0.5) 0%, transparent 70%)'
                    }}
                />
            </motion.div>
        </>
    )
}
