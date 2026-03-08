import type { User } from 'https://esm.sh/@supabase/supabase-js@2.57.4'
import { createAdminClient } from './supabase.ts'

function extractBearerToken(request: Request): string {
  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization') || ''
  const authToken = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (authToken) {
    return authToken
  }

  const supabaseAuthHeader = request.headers.get('x-supabase-auth') || request.headers.get('x-supabase-access-token') || ''
  const supabaseAuthToken = supabaseAuthHeader.replace(/^Bearer\s+/i, '').trim()
  if (supabaseAuthToken) {
    return supabaseAuthToken
  }

  const cookie = request.headers.get('cookie') || ''
  const cookieToken = cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('sb-access-token='))
    ?.replace('sb-access-token=', '')
  if (cookieToken) {
    try {
      return decodeURIComponent(cookieToken)
    } catch {
      return cookieToken
    }
  }

  return ''
}

export async function requireUser(request: Request): Promise<User> {
  const bearerToken = extractBearerToken(request)

  if (!bearerToken) {
    throw new Error('unauthorized')
  }

  const adminClient = createAdminClient()
  const { data, error } = await adminClient.auth.getUser(bearerToken)

  if (error || !data?.user) {
    throw new Error('unauthorized')
  }

  return data.user
}
