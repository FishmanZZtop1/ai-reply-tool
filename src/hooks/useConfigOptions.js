import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiGet } from '../lib/apiClient'

const requiredScenes = ['👋 Opening Line']
const requiredStyles = ['🎧 Customer']

const fallbackOptions = {
    scenes: [
        '👋 Opening Line',
        '💼 Work Email',
        '💬 Social Chat',
        '🏠 Family',
        '🎧 Customer Service',
        '💕 Dating',
        '🎯 Job Interview',
    ],
    roles: ['👔 Boss / Manager', '🤝 Colleague', '😊 Friend', '👨‍👩‍👧 Family', '❤️ Partner', '💼 Client', '👤 Stranger'],
    styles: ['📋 Professional', '🤗 Friendly', '😂 Humorous', '⚡ Direct', '🌸 Subtle', '🎉 Enthusiastic', '🎧 Customer'],
}

function ensureRequiredOptions(list, required) {
    const normalized = Array.isArray(list) ? [...list] : []
    for (const option of required) {
        if (!normalized.includes(option)) {
            normalized.push(option)
        }
    }
    return normalized
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

            const scenes = data.options.scenes?.length ? data.options.scenes : fallbackOptions.scenes
            const roles = data.options.roles?.length ? data.options.roles : fallbackOptions.roles
            const styles = data.options.styles?.length ? data.options.styles : fallbackOptions.styles
            const sceneList = ensureRequiredOptions(scenes, requiredScenes)
            const openingLineIndex = sceneList.indexOf('👋 Opening Line')
            if (openingLineIndex > 0) {
                sceneList.splice(openingLineIndex, 1)
                sceneList.unshift('👋 Opening Line')
            }

            setCatalog({
                scenes: sceneList,
                roles,
                styles: ensureRequiredOptions(styles, requiredStyles),
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
