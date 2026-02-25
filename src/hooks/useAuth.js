import { useCallback, useEffect, useMemo, useState } from 'react'
import { onSessionChange, supabase, supabaseAnonKey, supabaseUrl } from '../lib/supabaseClient'

function mapProvider(provider) {
    switch (provider) {
        case 'Google':
            return 'google'
        case 'GitHub':
            return 'github'
        default:
            return null
    }
}

function mapAuthErrorMessage(message) {
    const normalized = String(message || '').toLowerCase()
    if (normalized.includes('provider is not enabled')) {
        return '该登录方式暂未启用，请先使用邮箱登录，或联系管理员开启该登录方式。'
    }
    if (normalized.includes('redirect_to is not allowed')) {
        return '登录回调地址未配置，请联系管理员检查 Supabase URL 白名单。'
    }
    if (!message) {
        return '登录失败，请稍后重试。'
    }
    return message
}

async function isOAuthProviderEnabled(provider) {
    if (!supabaseUrl || !supabaseAnonKey) {
        return null
    }

    try {
        const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
            headers: {
                apikey: supabaseAnonKey,
            },
        })

        if (!response.ok) {
            return null
        }

        const settings = await response.json()
        return Boolean(settings?.external?.[provider])
    } catch {
        return null
    }
}

export function useAuth() {
    const [session, setSession] = useState(null)
    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const user = session?.user ?? null
    const isAuthenticated = Boolean(user)

    const fetchProfile = useCallback(async (userId) => {
        if (!supabase || !userId) {
            setProfile(null)
            return
        }

        const { data, error: profileError } = await supabase
            .from('profiles')
            .select('id, display_name, avatar_url, referral_code, created_at')
            .eq('id', userId)
            .maybeSingle()

        if (profileError) {
            setError(profileError.message)
            return
        }

        setProfile(data ?? null)
    }, [])

    useEffect(() => {
        let mounted = true

        async function bootstrap() {
            if (!supabase) {
                setLoading(false)
                return
            }

            const { data, error: sessionError } = await supabase.auth.getSession()

            if (!mounted) {
                return
            }

            if (sessionError) {
                setError(sessionError.message)
                setLoading(false)
                return
            }

            setSession(data.session ?? null)
            if (data.session?.user?.id) {
                await fetchProfile(data.session.user.id)
            }
            setLoading(false)
        }

        bootstrap()

        const unsubscribe = onSessionChange((nextSession) => {
            setSession(nextSession ?? null)
            if (nextSession?.user?.id) {
                fetchProfile(nextSession.user.id)
            } else {
                setProfile(null)
            }
        })

        return () => {
            mounted = false
            unsubscribe()
        }
    }, [fetchProfile])

    const signInWithOAuth = useCallback(async (providerName) => {
        if (!supabase) {
            setError('Supabase is not configured.')
            return
        }

        const provider = mapProvider(providerName)
        if (!provider) {
            setError('Unsupported login provider.')
            return
        }

        setError('')

        const providerEnabled = await isOAuthProviderEnabled(provider)
        if (providerEnabled !== true) {
            const disabledMessage = providerEnabled === false
                ? `${providerName} 登录暂未启用，请先使用邮箱登录。`
                : `${providerName} 登录暂时不可用，请先使用邮箱登录。`
            setError(disabledMessage)
            return { ok: false, error: disabledMessage }
        }

        const { data, error: authError } = await supabase.auth.signInWithOAuth({
            provider,
            options: {
                redirectTo: import.meta.env.VITE_APP_URL || window.location.origin,
                skipBrowserRedirect: true,
            },
        })

        if (authError) {
            setError(mapAuthErrorMessage(authError.message))
            return { ok: false, error: mapAuthErrorMessage(authError.message) }
        }

        if (!data?.url) {
            const fallbackError = '登录服务响应异常，请稍后重试。'
            setError(fallbackError)
            return { ok: false, error: fallbackError }
        }

        window.location.assign(data.url)
        return { ok: true }
    }, [])

    const signInWithEmail = useCallback(async (email) => {
        if (!supabase) {
            setError('Supabase is not configured.')
            return { ok: false }
        }

        setError('')

        const { error: otpError } = await supabase.auth.signInWithOtp({
            email,
            options: {
                emailRedirectTo: import.meta.env.VITE_APP_URL || window.location.origin,
            },
        })

        if (otpError) {
            const mappedError = mapAuthErrorMessage(otpError.message)
            setError(mappedError)
            return { ok: false, error: mappedError }
        }

        return { ok: true }
    }, [])

    const signOut = useCallback(async () => {
        if (!supabase) {
            return
        }

        setError('')
        const { error: signOutError } = await supabase.auth.signOut()
        if (signOutError) {
            setError(signOutError.message)
        }
    }, [])

    return useMemo(() => ({
        session,
        user,
        profile,
        loading,
        error,
        isAuthenticated,
        signInWithOAuth,
        signInWithEmail,
        signOut,
    }), [error, isAuthenticated, loading, profile, session, signInWithEmail, signInWithOAuth, signOut, user])
}
