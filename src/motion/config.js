/**
 * Motion Configuration - Physics-based Animation System
 * 
 * Core Philosophy:
 * - All motion uses spring physics, never bezier curves
 * - Every state change must have a transition
 * - Even 1px border highlight should breathe
 */

// Global Spring Configurations
export const springs = {
    // Snappy - for micro-interactions (buttons, chips)
    snappy: { stiffness: 400, damping: 30 },

    // Bouncy - for emphasis and delight
    bouncy: { stiffness: 300, damping: 20 },

    // Smooth - for larger elements (cards, modals)
    smooth: { stiffness: 200, damping: 25 },

    // Gentle - for subtle background effects
    gentle: { stiffness: 100, damping: 20 },

    // Quick - for fast responses
    quick: { stiffness: 500, damping: 35 },
}

// Animation Variants
export const fadeInUp = {
    hidden: {
        opacity: 0,
        y: 30,
        scale: 0.95
    },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { type: 'spring', ...springs.smooth }
    }
}

export const fadeInScale = {
    hidden: {
        opacity: 0,
        scale: 0.9
    },
    visible: {
        opacity: 1,
        scale: 1,
        transition: { type: 'spring', ...springs.bouncy }
    }
}

export const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.08,
            delayChildren: 0.1
        }
    }
}

export const staggerItem = {
    hidden: {
        opacity: 0,
        y: 20,
        scale: 0.95
    },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { type: 'spring', ...springs.snappy }
    }
}

// Modal Animations
export const modalBackdrop = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { duration: 0.3, ease: 'easeOut' }
    },
    exit: {
        opacity: 0,
        transition: { duration: 0.2, ease: 'easeIn' }
    }
}

export const modalContent = {
    hidden: {
        opacity: 0,
        y: 100,
        scale: 0.9
    },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: {
            type: 'spring',
            stiffness: 300,
            damping: 25,
            mass: 0.8
        }
    },
    exit: {
        opacity: 0,
        y: 50,
        scale: 0.95,
        transition: { duration: 0.2, ease: 'easeIn' }
    }
}

// Chip/Button Hover States
export const chipVariants = {
    initial: {
        scale: 1,
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
    },
    hover: {
        scale: 1.05,
        y: -2,
        boxShadow: '0 8px 24px rgba(228, 19, 162, 0.2)',
        transition: { type: 'spring', ...springs.snappy }
    },
    tap: {
        scale: 0.95,
        transition: { type: 'spring', ...springs.quick }
    },
    selected: {
        scale: 1.02,
        boxShadow: '0 6px 20px rgba(228, 19, 162, 0.4)',
        transition: { type: 'spring', ...springs.bouncy }
    }
}

// Card Tilt Configuration
export const tiltConfig = {
    maxTilt: 8,           // Maximum tilt angle in degrees
    perspective: 1000,     // Perspective for 3D effect
    scale: 1.02,          // Scale on hover
    transitionSpeed: 300  // Transition speed in ms
}

// Scroll reveal configuration
export const scrollReveal = {
    hidden: {
        opacity: 0,
        y: 60
    },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            type: 'spring',
            stiffness: 100,
            damping: 15,
            mass: 0.5
        }
    }
}
