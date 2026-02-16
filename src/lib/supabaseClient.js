import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = isSupabaseConfigured
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
        },
    })
    : null

export function assertSupabaseConfigured() {
    if (!isSupabaseConfigured) {
        throw new Error('Supabase is not configured. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
    }
}

export function onSessionChange(callback) {
    if (!supabase) {
        return () => { }
    }

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        callback(session)
    })

    return () => {
        data.subscription.unsubscribe()
    }
}
