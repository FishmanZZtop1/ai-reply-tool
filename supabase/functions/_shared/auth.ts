import type { User } from 'https://esm.sh/@supabase/supabase-js@2.57.4'
import { createUserClient } from './supabase.ts'

export async function requireUser(request: Request): Promise<User> {
  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization') || ''
  const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim()

  if (!bearerToken) {
    throw new Error('unauthorized')
  }

  const userClient = createUserClient(request)
  const { data, error } = await userClient.auth.getUser(bearerToken)

  if (error || !data?.user) {
    throw new Error('unauthorized')
  }

  return data.user
}
