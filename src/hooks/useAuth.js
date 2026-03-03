import { useCallback, useEffect, useMemo, useState } from 'react'
import { onSessionChange, supabase, supabaseAnonKey, supabaseUrl } from '../lib/supabaseClient'
import { apiMultipartPost } from '../lib/apiClient'

function mapProvider(provider) {
    switch (provider) {
        case 'Google':
            return 'google'
        case 'GitHub':
            return 'github'
        case 'X':
            return 'x'
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
        const external = settings?.external || {}
        if (provider === 'x') {
            return Boolean(external.x ?? external.twitter)
        }
        return Boolean(external?.[provider])
    } catch {
        return null
    }
}

export function useAuth() {
    const [session, setSession] = useState(null)
    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [oauthProviders, setOauthProviders] = useState({
        google: null,
        github: null,
        x: null,
    })

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

    useEffect(() => {
        let mounted = true

        async function bootstrapOauthProviders() {
            const settingsGoogle = await isOAuthProviderEnabled('google')
            const settingsGithub = await isOAuthProviderEnabled('github')
            const settingsX = await isOAuthProviderEnabled('x')
            if (!mounted) {
                return
            }
            setOauthProviders({
                google: settingsGoogle === true,
                github: settingsGithub === true,
                x: settingsX === true,
            })
        }

        bootstrapOauthProviders()

        return () => {
            mounted = false
        }
    }, [])

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

        let providerEnabled = oauthProviders[provider]
        if (providerEnabled !== true) {
            providerEnabled = await isOAuthProviderEnabled(provider)
            if (providerEnabled !== null) {
                setOauthProviders((previous) => ({
                    ...previous,
                    [provider]: providerEnabled === true,
                }))
            }
        }

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
    }, [oauthProviders])

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

        return { ok: true, sentTo: email }
    }, [])

    const verifyEmailOtp = useCallback(async ({ email, token }) => {
        if (!supabase) {
            setError('Supabase is not configured.')
            return { ok: false, error: 'Supabase is not configured.' }
        }

        if (!email || !token) {
            const validationError = '请输入邮箱和验证码。'
            setError(validationError)
            return { ok: false, error: validationError }
        }

        setError('')

        const { error: verifyError } = await supabase.auth.verifyOtp({
            email: email.trim().toLowerCase(),
            token: token.trim(),
            type: 'email',
        })

        if (verifyError) {
            const mappedError = mapAuthErrorMessage(verifyError.message)
            setError(mappedError)
            return { ok: false, error: mappedError }
        }

        return { ok: true }
    }, [])

    const updateProfile = useCallback(async ({ displayName, avatarFile, avatarUrl }) => {
        if (!supabase || !user?.id) {
            const profileError = 'Not authenticated.'
            setError(profileError)
            return { ok: false, error: profileError }
        }

        setError('')

        const nextDisplayName = String(displayName || '').trim().slice(0, 60)
        let nextAvatarUrl = String(avatarUrl || '').trim().slice(0, 300)

        if (avatarFile instanceof File) {
            const formData = new FormData()
            formData.append('file', avatarFile)

            try {
                const uploadResult = await apiMultipartPost('upload-avatar', formData, {
                    timeoutMs: 60000,
                })

                if (uploadResult?.avatar_url) {
                    nextAvatarUrl = String(uploadResult.avatar_url)
                }
            } catch (uploadError) {
                const mappedError = mapAuthErrorMessage(uploadError.message)
                setError(mappedError)
                return { ok: false, error: mappedError }
            }
        }

        const { data, error: upsertError } = await supabase
            .from('profiles')
            .upsert({
                id: user.id,
                display_name: nextDisplayName || null,
                avatar_url: nextAvatarUrl || null,
            }, { onConflict: 'id' })
            .select('id, display_name, avatar_url, referral_code, created_at')
            .maybeSingle()

        if (upsertError) {
            const mappedError = mapAuthErrorMessage(upsertError.message)
            setError(mappedError)
            return { ok: false, error: mappedError }
        }

        if (data) {
            setProfile(data)
        }

        return { ok: true, profile: data ?? null }
    }, [user?.id])

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
        oauthProviders,
        isAuthenticated,
        signInWithOAuth,
        signInWithEmail,
        verifyEmailOtp,
        updateProfile,
        signOut,
    }), [error, isAuthenticated, loading, oauthProviders, profile, session, signInWithEmail, signInWithOAuth, signOut, updateProfile, user, verifyEmailOtp])
}
