import { memo, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { modalBackdrop, modalContent, springs } from '../../motion/config'

const ProfileEditModal = memo(function ProfileEditModal({
    isOpen,
    onClose,
    onSave,
    loading,
    errorMessage,
    userId,
    email,
    initialDisplayName,
    initialAvatarUrl,
    defaultAvatarUrl,
}) {
    const [displayName, setDisplayName] = useState('')
    const [avatarUrl, setAvatarUrl] = useState('')
    const [avatarFile, setAvatarFile] = useState(null)
    const [avatarPreviewUrl, setAvatarPreviewUrl] = useState('')

    useEffect(() => {
        if (!isOpen) {
            return
        }
        setDisplayName(initialDisplayName || '')
        setAvatarUrl(initialAvatarUrl || '')
        setAvatarFile(null)
        setAvatarPreviewUrl('')
    }, [initialAvatarUrl, initialDisplayName, isOpen])

    useEffect(() => {
        return () => {
            if (avatarPreviewUrl) {
                URL.revokeObjectURL(avatarPreviewUrl)
            }
        }
    }, [avatarPreviewUrl])

    const previewAvatar = useMemo(() => {
        if (avatarPreviewUrl) {
            return avatarPreviewUrl
        }

        const candidate = avatarUrl.trim()
        if (!candidate) {
            return defaultAvatarUrl
        }
        return candidate
    }, [avatarPreviewUrl, avatarUrl, defaultAvatarUrl])

    const handleAvatarFileChange = (event) => {
        const nextFile = event.target.files?.[0] || null
        if (!nextFile) {
            return
        }

        if (!nextFile.type.startsWith('image/')) {
            return
        }

        if (avatarPreviewUrl) {
            URL.revokeObjectURL(avatarPreviewUrl)
        }

        setAvatarFile(nextFile)
        setAvatarPreviewUrl(URL.createObjectURL(nextFile))
    }

    const handleSubmit = async (event) => {
        event.preventDefault()
        await onSave?.({
            displayName: displayName.trim(),
            avatarFile,
            avatarUrl: avatarUrl.trim(),
        })
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div
                        className="absolute inset-0 bg-black/30"
                        style={{ backdropFilter: 'blur(8px)' }}
                        variants={modalBackdrop}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        onClick={onClose}
                    />

                    <motion.div
                        className="relative w-full max-w-lg rounded-3xl p-7"
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
                            aria-label="Close edit profile modal"
                            className="absolute top-5 right-5 w-10 h-10 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100"
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
                        >
                            <h2 className="text-2xl font-bold text-gray-900">Edit Profile</h2>
                            <p className="text-sm text-gray-500 mt-1">Update your public avatar and display ID.</p>
                        </motion.div>

                        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
                            <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50/70 p-3">
                                <img
                                    src={previewAvatar}
                                    alt="Profile preview"
                                    className="w-14 h-14 rounded-full object-cover ring-2 ring-white shadow"
                                    loading="lazy"
                                    decoding="async"
                                />
                                <div className="min-w-0">
                                    <div className="text-sm font-semibold text-gray-900 truncate">{displayName || email || 'User'}</div>
                                    <div className="text-xs text-gray-500 truncate">{email || userId || ''}</div>
                                </div>
                            </div>

                            <label className="block">
                                <span className="text-xs font-medium text-gray-600">Display ID</span>
                                <input
                                    type="text"
                                    value={displayName}
                                    onChange={(event) => setDisplayName(event.target.value.slice(0, 60))}
                                    placeholder="e.g. ian_reply"
                                    className="mt-1 w-full h-11 rounded-xl border border-gray-200 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-pink-200"
                                />
                            </label>

                            <div className="block">
                                <span className="text-xs font-medium text-gray-600">Avatar 图片头像</span>
                                <div className="mt-1 rounded-xl border border-gray-200 px-3 py-3 bg-white">
                                    <input
                                        id="profile-avatar-upload"
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleAvatarFileChange}
                                    />
                                    <div className="flex items-center justify-between gap-2">
                                        <label
                                            htmlFor="profile-avatar-upload"
                                            className="h-9 px-3 inline-flex items-center rounded-lg bg-gray-900 text-white text-xs font-semibold cursor-pointer"
                                        >
                                            上传图片
                                        </label>
                                        {avatarFile && (
                                            <button
                                                type="button"
                                                className="h-9 px-3 rounded-lg border border-gray-200 text-xs font-medium text-gray-600"
                                                onClick={() => {
                                                    if (avatarPreviewUrl) {
                                                        URL.revokeObjectURL(avatarPreviewUrl)
                                                    }
                                                    setAvatarFile(null)
                                                    setAvatarPreviewUrl('')
                                                }}
                                            >
                                                清除
                                            </button>
                                        )}
                                    </div>
                                    <div className="mt-2 text-xs text-gray-500 truncate">
                                        {avatarFile ? avatarFile.name : '支持 PNG / JPG / WEBP，建议小于 5MB'}
                                    </div>
                                </div>
                            </div>

                            {errorMessage && (
                                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs px-3 py-2">
                                    {errorMessage}
                                </div>
                            )}

                            <div className="flex items-center justify-end gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="h-10 px-4 rounded-xl border border-gray-200 text-sm font-medium text-gray-700"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="h-10 px-4 rounded-xl bg-gray-900 text-sm font-semibold text-white disabled:opacity-60"
                                >
                                    {loading ? 'Saving...' : 'Save Profile'}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
})

export default ProfileEditModal
