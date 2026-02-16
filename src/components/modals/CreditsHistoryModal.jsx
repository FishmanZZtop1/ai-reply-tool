/**
 * Credits History Modal
 * Displays a list of credit transactions (recharges and consumption).
 */

import { memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { modalBackdrop, modalContent, springs } from '../../motion/config'
import { X, ArrowUpRight, ArrowDownLeft, Calendar } from 'lucide-react'

const CreditsHistoryModal = memo(function CreditsHistoryModal({ isOpen, onClose, transactions = [], isLoading }) {
    const items = transactions.map((item) => ({
        id: item.id,
        type: item.amount >= 0 ? 'recharge' : 'consume',
        amount: item.amount,
        description: item.reason || 'Credit update',
        date: new Date(item.created_at).toLocaleDateString(),
        time: new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }))

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
                    {/* Backdrop */}
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
                        className="relative w-full max-w-md max-h-[80vh] flex flex-col rounded-3xl overflow-hidden"
                        style={{
                            background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.92) 100%)',
                            boxShadow: '0 25px 80px rgba(0,0,0,0.15)',
                            border: '1px solid rgba(255,255,255,0.6)'
                        }}
                        variants={modalContent}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between shrink-0">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Credits History</h2>
                                <p className="text-sm text-gray-500 mt-1">Track your usage and recharges</p>
                            </div>
                            <motion.button
                                onClick={onClose}
                                aria-label="Close credits history modal"
                                className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                            >
                                <X className="w-5 h-5" />
                            </motion.button>
                        </div>

                        {/* List - Scrollable */}
                        <div className="overflow-y-auto p-6 space-y-4">
                            {isLoading && (
                                <div className="text-sm text-gray-400">Loading history...</div>
                            )}
                            {!isLoading && items.length === 0 && (
                                <div className="text-sm text-gray-400">No transactions yet.</div>
                            )}
                            {items.map((tx, index) => (
                                <motion.div
                                    key={tx.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05, type: 'spring', ...springs.smooth }}
                                    className="flex items-center justify-between p-3 rounded-2xl hover:bg-white/50 transition-colors border border-transparent hover:border-gray-100"
                                >
                                    <div className="flex items-center gap-4">
                                        {/* Icon Box */}
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tx.type === 'recharge'
                                                ? 'bg-emerald-50 text-emerald-600'
                                                : 'bg-orange-50 text-orange-600'
                                            }`}>
                                            {tx.type === 'recharge' ? (
                                                <ArrowDownLeft className="w-5 h-5" />
                                            ) : (
                                                <ArrowUpRight className="w-5 h-5" />
                                            )}
                                        </div>

                                        {/* info */}
                                        <div>
                                            <div className="font-semibold text-gray-900 text-sm">
                                                {tx.description}
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                                                <Calendar className="w-3 h-3" />
                                                <span>{tx.date}</span>
                                                <span>•</span>
                                                <span>{tx.time}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Amount */}
                                    <div className={`font-bold ${tx.type === 'recharge'
                                            ? 'text-emerald-600'
                                            : 'text-gray-900'
                                        }`}>
                                        {tx.type === 'recharge' ? '+' : ''}{tx.amount}
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        {/* Footer Gradient overlay for scroll */}
                        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-white/80 to-transparent pointer-events-none" />
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
})

export default CreditsHistoryModal
