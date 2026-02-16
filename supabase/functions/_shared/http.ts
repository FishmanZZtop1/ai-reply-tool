import { corsHeaders } from './cors.ts'

export function jsonResponse(payload: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  })
}

export function errorResponse(message: string, status = 400, code = 'bad_request', details: unknown = null) {
  return jsonResponse({
    error: message,
    code,
    details,
  }, status)
}

export async function readJsonBody<T>(request: Request): Promise<T> {
  try {
    return await request.json() as T
  } catch (_error) {
    throw new Error('invalid_json')
  }
}

export function getClientIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for') || ''
  if (!forwarded) {
    return 'unknown'
  }

  return forwarded.split(',')[0]?.trim() || 'unknown'
}
