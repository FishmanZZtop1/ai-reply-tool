import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
  throw new Error('Missing SUPABASE_URL, SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY')
}

export function createUserClient(request: Request) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: request.headers.get('Authorization') || '',
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

export function createAdminClient() {
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
