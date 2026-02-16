import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiGet } from '../lib/apiClient'

const fallbackOptions = {
    scenes: ['💼 Work Email', '💬 Social Chat', '🏠 Family', '🎧 Customer Service', '💕 Dating', '🎯 Job Interview'],
    roles: ['👔 Boss / Manager', '🤝 Colleague', '😊 Friend', '👨‍👩‍👧 Family', '❤️ Partner', '💼 Client', '👤 Stranger'],
    styles: ['📋 Professional', '🤗 Friendly', '😂 Humorous', '⚡ Direct', '🌸 Subtle', '🎉 Enthusiastic'],
}

export function useConfigOptions() {
    const [catalog, setCatalog] = useState(fallbackOptions)
    const [loading, setLoading] = useState(false)

    const fetchCatalog = useCallback(async () => {
        setLoading(true)

        try {
            const data = await apiGet('config-options', { auth: false })
            if (!data?.options) {
                return
            }

            setCatalog({
                scenes: data.options.scenes?.length ? data.options.scenes : fallbackOptions.scenes,
                roles: data.options.roles?.length ? data.options.roles : fallbackOptions.roles,
                styles: data.options.styles?.length ? data.options.styles : fallbackOptions.styles,
            })
        } catch {
            setCatalog(fallbackOptions)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchCatalog()
    }, [fetchCatalog])

    return useMemo(() => ({
        catalog,
        loading,
        refetch: fetchCatalog,
    }), [catalog, fetchCatalog, loading])
}
