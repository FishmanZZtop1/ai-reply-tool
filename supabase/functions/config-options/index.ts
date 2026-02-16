import { corsHeaders } from '../_shared/cors.ts'
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
    const admin = createAdminClient()

    const { data, error } = await admin
      .from('option_catalog')
      .select('category,label,sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (error) {
      return errorResponse(error.message, 500, 'db_error')
    }

    const grouped = {
      scenes: [] as string[],
      roles: [] as string[],
      styles: [] as string[],
    }

    for (const row of data ?? []) {
      if (row.category === 'scene') {
        grouped.scenes.push(row.label)
      }
      if (row.category === 'role') {
        grouped.roles.push(row.label)
      }
      if (row.category === 'style') {
        grouped.styles.push(row.label)
      }
    }

    return jsonResponse({ options: grouped })
  } catch (error) {
    return errorResponse(error.message || 'Unexpected error.', 500, 'internal_error')
  }
})
