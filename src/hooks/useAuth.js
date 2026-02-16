import { useCallback, useEffect, useMemo, useState } from 'react'
import { onSessionChange, supabase } from '../lib/supabaseClient'

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

        const { error: authError } = await supabase.auth.signInWithOAuth({
            provider,
            options: {
                redirectTo: import.meta.env.VITE_APP_URL || window.location.origin,
            },
        })

        if (authError) {
            setError(authError.message)
        }
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
            setError(otpError.message)
            return { ok: false, error: otpError.message }
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
