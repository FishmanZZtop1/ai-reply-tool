import { useCallback, useMemo, useState } from 'react'
import { ApiError, apiGet, apiPost } from '../lib/apiClient'
import { buildGenerationPrompt } from '../features/generation/promptCompiler'
import { validateGenerationInput } from '../features/generation/schema'

const GENERATION_TIMEOUT_MS = 25000
const STATUS_POLL_INTERVAL_MS = 1800
const STATUS_POLL_ATTEMPTS = 16
const MAX_REGENERATE_ATTEMPTS = 1

function createIdempotencyKey() {
    const timestamp = Date.now().toString(36)

    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `gen_${timestamp}_${crypto.randomUUID()}`
    }

    const randomPart = Math.random().toString(36).slice(2, 12)
    return `gen_${timestamp}_${randomPart}`
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms)
    })
}

function mapReplies(payload) {
    const requestId = payload?.request_id || createIdempotencyKey()
    const replies = Array.isArray(payload?.replies) ? payload.replies : []

    return replies.map((text, index) => ({
        id: `${requestId}-${index}`,
        text,
    }))
}

async function pollGenerationStatus(idempotencyKey) {
    for (let attempt = 0; attempt < STATUS_POLL_ATTEMPTS; attempt += 1) {
        try {
            const statusPayload = await apiGet('generation-status', {
                timeoutMs: 10000,
                queryParams: {
                    idempotency_key: idempotencyKey,
                },
            })

            if (statusPayload?.status === 'success') {
                return { status: 'success', payload: statusPayload }
            }

            if (statusPayload?.status === 'failed') {
                return { status: 'failed', payload: statusPayload }
            }
        } catch (error) {
            if (error instanceof ApiError && error.status === 404) {
                // The request row may not be visible yet; keep polling.
            } else if (error instanceof ApiError && error.status === 401) {
                throw error
            }
        }

        await sleep(STATUS_POLL_INTERVAL_MS)
    }

    return { status: 'pending', payload: null }
}

async function requestGeneration(payload, idempotencyKey) {
    return apiPost('generate-reply', {
        ...payload,
        idempotency_key: idempotencyKey,
    }, {
        timeoutMs: GENERATION_TIMEOUT_MS,
    })
}

export function useGenerator({ onSuccess }) {
    const [results, setResults] = useState([])
    const [historyEntries, setHistoryEntries] = useState([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')

    const clearResults = useCallback(() => {
        setResults([])
        setError('')
    }, [])

    const commitGenerationSuccess = useCallback(async (payload, messageTitle) => {
        const mapped = mapReplies(payload)
        setResults(mapped)

        const requestId = payload?.request_id || ''
        const title = String(messageTitle || '').trim() || "Message You're Replying To"

        if (requestId) {
            setHistoryEntries((previous) => {
                const alreadyExists = previous.some((entry) => entry.requestId === requestId)
                if (alreadyExists) {
                    return previous
                }

                const nextEntry = {
                    requestId,
                    title,
                    replies: mapped,
                    createdAt: new Date().toISOString(),
                }
                return [nextEntry, ...previous].slice(0, 30)
            })
        }

        if (onSuccess) {
            await onSuccess(payload)
        }

        return payload
    }, [onSuccess])

    const generateReplies = useCallback(async (config) => {
        const { request, systemInstruction, userPrompt } = buildGenerationPrompt({
            message: config.message,
            notes: config.notes,
            options: {
                scene: config.scene,
                role: config.role,
                style: config.style === 'custom'
                    ? String(config.styleCustom || '').trim()
                    : config.style,
                length: config.length,
                emoji: config.emoji,
                sceneCustom: config.sceneCustom,
                roleCustom: config.roleCustom,
            },
            variations: config.variations,
            language: 'auto',
        })

        const validation = validateGenerationInput(request)
        if (!validation.ok) {
            setError(validation.reason)
            return null
        }

        setIsLoading(true)
        setError('')

        const generationPayload = {
            ...request,
            systemInstruction,
            userPrompt,
        }

        try {
            let regenerateAttempt = 0

            while (regenerateAttempt <= MAX_REGENERATE_ATTEMPTS) {
                const idempotencyKey = createIdempotencyKey()

                try {
                    const immediate = await requestGeneration(generationPayload, idempotencyKey)

                    if (immediate?.status === 'running') {
                        const polled = await pollGenerationStatus(idempotencyKey)
                        if (polled.status === 'success') {
                            return commitGenerationSuccess(polled.payload, request.message)
                        }

                        if (polled.status === 'failed') {
                            if (regenerateAttempt < MAX_REGENERATE_ATTEMPTS) {
                                regenerateAttempt += 1
                                continue
                            }

                            throw new ApiError(
                                polled.payload?.error || 'Generation failed.',
                                {
                                    status: 502,
                                    code: polled.payload?.code || 'generation_failed',
                                    details: polled.payload,
                                },
                            )
                        }

                        if (regenerateAttempt < MAX_REGENERATE_ATTEMPTS) {
                            regenerateAttempt += 1
                            continue
                        }

                        throw new ApiError('Generation timed out. Please regenerate.', {
                            status: 408,
                            code: 'generation_timeout_pending',
                        })
                    }

                    return commitGenerationSuccess(immediate, request.message)
                } catch (requestError) {
                    const isTimeout = requestError instanceof ApiError && requestError.code === 'request_timeout'

                    if (!isTimeout) {
                        throw requestError
                    }

                    const polled = await pollGenerationStatus(idempotencyKey)

                    if (polled.status === 'success') {
                        return commitGenerationSuccess(polled.payload, request.message)
                    }

                    if (polled.status === 'failed' && regenerateAttempt < MAX_REGENERATE_ATTEMPTS) {
                        regenerateAttempt += 1
                        continue
                    }

                    if (polled.status === 'pending' && regenerateAttempt < MAX_REGENERATE_ATTEMPTS) {
                        regenerateAttempt += 1
                        continue
                    }

                    if (polled.status === 'failed') {
                        throw new ApiError(
                            polled.payload?.error || 'Generation failed.',
                            {
                                status: 502,
                                code: polled.payload?.code || 'generation_failed',
                                details: polled.payload,
                            },
                        )
                    }

                    throw requestError
                }
            }

            throw new ApiError('Generation failed. Please retry.', {
                status: 500,
                code: 'generation_failed',
            })
        } catch (requestError) {
            setError(requestError.message)
            return null
        } finally {
            setIsLoading(false)
        }
    }, [commitGenerationSuccess])

    return useMemo(() => ({
        results,
        historyEntries,
        isLoading,
        error,
        clearResults,
        generateReplies,
    }), [clearResults, error, generateReplies, historyEntries, isLoading, results])
}
