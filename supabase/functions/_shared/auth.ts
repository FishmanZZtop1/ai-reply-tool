import type { User } from 'https://esm.sh/@supabase/supabase-js@2.57.4'
import { createUserClient } from './supabase.ts'

export async function requireUser(request: Request): Promise<User> {
  const userClient = createUserClient(request)
  const { data, error } = await userClient.auth.getUser()

  if (error || !data?.user) {
    throw new Error('unauthorized')
  }

  return data.user
}
