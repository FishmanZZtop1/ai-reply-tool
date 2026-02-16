import { corsHeaders } from '../_shared/cors.ts'
import { requireUser } from '../_shared/auth.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import { errorResponse, jsonResponse } from '../_shared/http.ts'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return errorResponse('Method not allowed.', 405, 'method_not_allowed')
  }

  try {
    const user = await requireUser(request)
    const admin = createAdminClient()

    const { error } = await admin.auth.admin.deleteUser(user.id)
    if (error) {
      return errorResponse(error.message, 500, 'delete_account_failed')
    }

    return jsonResponse({ ok: true })
  } catch (error) {
    if (error.message === 'unauthorized') {
      return errorResponse('Authentication required.', 401, 'auth_required')
    }

    return errorResponse(error.message || 'Unexpected error.', 500, 'internal_error')
  }
})
