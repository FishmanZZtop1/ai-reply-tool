import { useCallback, useMemo, useState } from 'react'
import { apiPost } from '../lib/apiClient'
import { buildGenerationPrompt } from '../features/generation/promptCompiler'
import { validateGenerationInput } from '../features/generation/schema'

export function useGenerator({ onSuccess }) {
    const [results, setResults] = useState([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')

    const clearResults = useCallback(() => {
        setResults([])
        setError('')
    }, [])

    const generateReplies = useCallback(async (config) => {
        const { request, systemInstruction, userPrompt } = buildGenerationPrompt({
            message: config.message,
            notes: config.notes,
            options: {
                scene: config.scene,
                role: config.role,
                style: config.style,
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

        try {
            const data = await apiPost('generate-reply', {
                ...request,
                systemInstruction,
                userPrompt,
            })

            const mapped = (data?.replies ?? []).map((text, index) => ({
                id: `${data.request_id}-${index}`,
                text,
            }))

            setResults(mapped)

            if (onSuccess) {
                await onSuccess(data)
            }

            return data
        } catch (requestError) {
            setError(requestError.message)
            return null
        } finally {
            setIsLoading(false)
        }
    }, [onSuccess])

    return useMemo(() => ({
        results,
        isLoading,
        error,
        clearResults,
        generateReplies,
    }), [clearResults, error, generateReplies, isLoading, results])
}
