/**
 * ContentPanel - Animated Input & Results
 */

import { memo, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDebouncedCallback } from '../hooks/useDebounce'
import { springs } from '../motion/config'

const ContentPanel = memo(function ContentPanel({
    config,
    onConfigChange,
    onGenerate,
    isLoading,
    results,
    errorMessage,
}) {
    const [currentPage, setCurrentPage] = useState(0)
    const [copiedId, setCopiedId] = useState(null)

    const handleMessageChange = useCallback((e) => {
        onConfigChange({ ...config, message: e.target.value })
    }, [config, onConfigChange])

    const handleNotesChange = useCallback((e) => {
        onConfigChange({ ...config, notes: e.target.value })
    }, [config, onConfigChange])

    // Debounced generate to prevent rapid clicks
    const handleGenerate = useDebouncedCallback(() => {
        onGenerate(config)
        setCurrentPage(0)
    }, 500)

    const handleCopy = useCallback(async (text, id) => {
        try {
            await navigator.clipboard.writeText(text)
            setCopiedId(id)
            setTimeout(() => setCopiedId(null), 2000)
        } catch {
            // Ignore clipboard failures in unsupported contexts.
        }
    }, [])

    const handlePrevPage = useCallback(() => {
        setCurrentPage(prev => Math.max(0, prev - 1))
    }, [])

    const handleNextPage = useCallback(() => {
        setCurrentPage(prev => Math.min(results.length - 1, prev + 1))
    }, [results.length])

    const currentResult = results[currentPage]

    const canGenerate = Boolean(config.message?.trim()) && !isLoading

    return (
        <motion.div
            className="space-y-5"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: 'spring', ...springs.smooth, delay: 0.1 }}
        >
            {/* Message Input */}
            <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-3">
                    Message You're Replying To
                </label>
                <motion.textarea
                    value={config.message || ''}
                    onChange={handleMessageChange}
                    placeholder="Paste or type the message you received..."
                    className="w-full h-28 p-4 resize-none text-sm rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-pink-200 focus:border-transparent transition-shadow"
                    whileFocus={{ boxShadow: '0 0 0 4px rgba(228, 19, 162, 0.1)' }}
                />
            </div>

            {/* Additional Notes */}
            <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-3">
                    Additional Notes (Optional)
                </label>
                <motion.textarea
                    value={config.notes || ''}
                    onChange={handleNotesChange}
                    placeholder="e.g. I want to politely decline, express gratitude, apologize..."
                    className="w-full h-20 p-4 resize-none text-sm rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-pink-200 focus:border-transparent transition-shadow"
                    whileFocus={{ boxShadow: '0 0 0 4px rgba(228, 19, 162, 0.1)' }}
                />
            </div>

            {/* Generate Button - Magnetic effect */}
            <motion.button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="w-full py-4 text-base font-semibold text-white rounded-xl bg-brand-gradient flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ boxShadow: '0 8px 24px rgba(228, 19, 162, 0.35)' }}
                whileHover={{
                    scale: 1.02,
                    y: -2,
                    boxShadow: '0 12px 32px rgba(228, 19, 162, 0.45)'
                }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
                {isLoading ? (
                    <motion.span
                        className="flex gap-1.5"
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ repeat: Infinity, duration: 1.2 }}
                    >
                        <motion.span
                            className="w-2 h-2 bg-white rounded-full"
                            animate={{ y: [0, -4, 0] }}
                            transition={{ repeat: Infinity, duration: 0.6, delay: 0 }}
                        />
                        <motion.span
                            className="w-2 h-2 bg-white rounded-full"
                            animate={{ y: [0, -4, 0] }}
                            transition={{ repeat: Infinity, duration: 0.6, delay: 0.1 }}
                        />
                        <motion.span
                            className="w-2 h-2 bg-white rounded-full"
                            animate={{ y: [0, -4, 0] }}
                            transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }}
                        />
                    </motion.span>
                ) : (
                    <>
                        <span>✦</span>
                        <span>Generate Reply Now</span>
                    </>
                )}
            </motion.button>

            {errorMessage && (
                <div
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3"
                >
                    {errorMessage}
                </div>
            )}

            {/* Results Section */}
            <AnimatePresence mode="wait">
                {results.length > 0 && (
                    <motion.div
                        className="pt-4 space-y-4"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ type: 'spring', ...springs.snappy }}
                    >
                        {/* Result Card */}
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentPage}
                                className="relative p-5 rounded-xl border-l-4 border-pink-500"
                                style={{
                                    background: 'rgba(255,255,255,0.8)',
                                    backdropFilter: 'blur(12px)',
                                    boxShadow: '0 4px 20px rgba(0,0,0,0.06)'
                                }}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ type: 'spring', ...springs.snappy }}
                            >
                                <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap pr-10">
                                    {currentResult?.text}
                                </p>

                                {/* Copy Button */}
                                <motion.button
                                    onClick={() => handleCopy(currentResult?.text, currentResult?.id)}
                                    aria-label="Copy generated reply"
                                    className="absolute top-4 right-4 p-2 rounded-lg text-gray-400 hover:text-pink-500 hover:bg-pink-50"
                                    title="Copy to clipboard"
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                                >
                                    <AnimatePresence mode="wait">
                                        {copiedId === currentResult?.id ? (
                                            <motion.svg
                                                key="check"
                                                className="w-4 h-4 text-emerald-500"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                exit={{ scale: 0 }}
                                            >
                                                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                                            </motion.svg>
                                        ) : (
                                            <motion.svg
                                                key="copy"
                                                className="w-4 h-4"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                exit={{ scale: 0 }}
                                            >
                                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                            </motion.svg>
                                        )}
                                    </AnimatePresence>
                                </motion.button>
                            </motion.div>
                        </AnimatePresence>

                        {/* Pagination */}
                        {results.length > 1 && (
                            <div className="flex items-center justify-center gap-4">
                                <motion.button
                                    onClick={handlePrevPage}
                                    disabled={currentPage === 0}
                                    aria-label="Show previous generated reply"
                                    className="w-10 h-10 rounded-full flex items-center justify-center text-gray-500 hover:text-pink-600 hover:bg-pink-50 disabled:opacity-30 disabled:cursor-not-allowed"
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                                >
                                    ←
                                </motion.button>

                                <span className="text-sm text-gray-500 font-medium min-w-[60px] text-center">
                                    {currentPage + 1} / {results.length}
                                </span>

                                <motion.button
                                    onClick={handleNextPage}
                                    disabled={currentPage === results.length - 1}
                                    aria-label="Show next generated reply"
                                    className="w-10 h-10 rounded-full flex items-center justify-center text-gray-500 hover:text-pink-600 hover:bg-pink-50 disabled:opacity-30 disabled:cursor-not-allowed"
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                                >
                                    →
                                </motion.button>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
})

export default ContentPanel
