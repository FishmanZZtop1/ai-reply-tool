import { corsHeaders } from '../_shared/cors.ts'
import { requireUser } from '../_shared/auth.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import { errorResponse, jsonResponse } from '../_shared/http.ts'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'GET') {
    return errorResponse('Method not allowed.', 405, 'method_not_allowed')
  }

  try {
    const user = await requireUser(request)
    const admin = createAdminClient()

    const url = new URL(request.url)
    const limit = Math.min(Number.parseInt(url.searchParams.get('limit') || '30', 10) || 30, 100)
    const cursor = url.searchParams.get('cursor')

    let query = admin
      .from('credit_ledger')
      .select('id,amount,reason,metadata,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (cursor) {
      query = query.lt('created_at', cursor)
    }

    const { data, error } = await query

    if (error) {
      return errorResponse(error.message, 500, 'db_error')
    }

    const nextCursor = data?.length ? data[data.length - 1]?.created_at : null

    return jsonResponse({
      items: data ?? [],
      cursor: nextCursor,
    })
  } catch (error) {
    if (error.message === 'unauthorized') {
      return errorResponse('Authentication required.', 401, 'auth_required')
    }

    return errorResponse(error.message || 'Unexpected error.', 500, 'internal_error')
  }
})
