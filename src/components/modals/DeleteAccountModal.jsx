import { memo, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { modalBackdrop, modalContent, springs } from '../../motion/config'

const REASONS = [
    { value: 'no_longer_need', label: 'I no longer need this tool.' },
    { value: 'better_alternative', label: 'Found a better alternative.' },
    { value: 'too_expensive', label: "It's too expensive / Not worth the price." },
    { value: 'too_robotic', label: 'Responses feel too robotic / Not context-aware enough.' },
    { value: 'other', label: 'Other (Please specify...)' },
]

const DeleteAccountModal = memo(function DeleteAccountModal({
    isOpen,
    onClose,
    onConfirm,
    loading = false,
    errorMessage = '',
}) {
    const [reason, setReason] = useState('')
    const [reasonDetail, setReasonDetail] = useState('')

    useEffect(() => {
        if (!isOpen) {
            return
        }

        setReason('')
        setReasonDetail('')
    }, [isOpen])

    const canDelete = useMemo(() => {
        if (!reason) {
            return false
        }

        if (reason === 'other') {
            return reasonDetail.trim().length > 0
        }

        return true
    }, [reason, reasonDetail])

    const handleSubmit = async (event) => {
        event.preventDefault()
        if (!canDelete || loading) {
            return
        }

        await onConfirm?.({
            reason,
            reasonDetail: reasonDetail.trim(),
        })
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
                    <motion.div
                        className="absolute inset-0 bg-black/35"
                        style={{ backdropFilter: 'blur(8px)' }}
                        variants={modalBackdrop}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        onClick={loading ? undefined : onClose}
                    />

                    <motion.div
                        className="relative w-full max-w-xl rounded-3xl p-7"
                        style={{
                            background: 'linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.95) 100%)',
                            boxShadow: '0 25px 80px rgba(0,0,0,0.15)',
                            border: '1px solid rgba(255,255,255,0.6)',
                        }}
                        variants={modalContent}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                    >
                        <motion.button
                            onClick={onClose}
                            aria-label="Close delete account modal"
                            disabled={loading}
                            className="absolute top-5 right-5 w-10 h-10 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                        </motion.button>

                        <motion.div
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.05, type: 'spring', ...springs.smooth }}
                            className="pr-12"
                        >
                            <h2 className="text-2xl font-bold text-gray-900">Delete Account</h2>
                            <p className="text-sm text-gray-500 mt-1">Tell us why you are leaving. This action is permanent and cannot be undone.</p>
                        </motion.div>

                        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
                            <fieldset className="space-y-2" aria-label="Delete account reason">
                                {REASONS.map((option) => (
                                    <label
                                        key={option.value}
                                        className={`flex items-start gap-3 rounded-xl border px-3 py-2 cursor-pointer transition-colors ${reason === option.value
                                                ? 'border-[#E413A2] bg-pink-50'
                                                : 'border-gray-200 bg-white hover:bg-gray-50'
                                            }`}
                                    >
                                        <input
                                            type="radio"
                                            name="delete-reason"
                                            value={option.value}
                                            checked={reason === option.value}
                                            onChange={() => setReason(option.value)}
                                            className="mt-1 h-4 w-4 accent-[#E413A2]"
                                        />
                                        <span className="text-sm text-gray-800 leading-6">{option.label}</span>
                                    </label>
                                ))}
                            </fieldset>

                            {reason === 'other' && (
                                <label className="block">
                                    <span className="text-xs font-medium text-gray-600">Please specify</span>
                                    <textarea
                                        value={reasonDetail}
                                        onChange={(event) => setReasonDetail(event.target.value.slice(0, 500))}
                                        placeholder="Share your reason..."
                                        rows={3}
                                        className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-200 resize-none"
                                    />
                                </label>
                            )}

                            {errorMessage && (
                                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs px-3 py-2">
                                    {errorMessage}
                                </div>
                            )}

                            <div className="flex items-center justify-end gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    disabled={loading}
                                    className="h-10 px-4 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={!canDelete || loading}
                                    className="h-10 px-4 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                                >
                                    {loading ? 'Deleting...' : 'Permanently Delete Account (永久注销账户)'}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
})

export default DeleteAccountModal
