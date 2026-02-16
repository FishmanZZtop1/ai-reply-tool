import { useState } from 'react'

export default function ResultSection({ results }) {
    const [copiedId, setCopiedId] = useState(null)

    const handleCopy = async (text, id) => {
        try {
            await navigator.clipboard.writeText(text)
            setCopiedId(id)
            setTimeout(() => setCopiedId(null), 2000)
        } catch (err) {
            console.error('Failed to copy:', err)
        }
    }

    const gradients = [
        'from-[--color-aurora-1] via-[--color-aurora-3] to-[--color-aurora-5]',
        'from-[--color-aurora-3] via-[--color-aurora-4] to-[--color-aurora-2]',
        'from-[--color-aurora-5] via-[--color-aurora-6] to-[--color-aurora-1]',
    ]

    return (
        <div className="mt-8 animate-[fade-in-up_0.5s_ease]">
            <div className="grid gap-4">
                {results.map((result, index) => (
                    <div
                        key={result.id}
                        className="glass rounded-[20px] p-6 relative overflow-hidden animate-[slide-in_0.4s_ease]"
                        style={{ animationDelay: `${index * 0.1}s` }}
                    >
                        {/* Top Gradient Border */}
                        <div className={`absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r ${gradients[index % gradients.length]}`} />

                        {/* Result Text */}
                        <p className="text-base leading-7 mb-4 text-white">
                            {result.text}
                        </p>

                        {/* Actions */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => handleCopy(result.text, result.id)}
                                aria-label="Copy generated reply"
                                className={`
                  flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all
                  ${copiedId === result.id
                                        ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white'
                                        : 'bg-white/10 border border-white/10 text-[--color-text-secondary] hover:bg-white/15 hover:text-white hover:-translate-y-0.5'
                                    }
                `}
                            >
                                {copiedId === result.id ? (
                                    <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                        Copied!
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                        </svg>
                                        Copy
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
