import { assertSupabaseConfigured, supabase } from './supabaseClient'

export class ApiError extends Error {
    constructor(message, { status = 500, code = 'api_error', details = null } = {}) {
        super(message)
        this.name = 'ApiError'
        this.status = status
        this.code = code
        this.details = details
    }
}

function buildFunctionUrl(path, queryParams) {
    const baseUrl = import.meta.env.VITE_SUPABASE_URL
    const normalizedPath = path.replace(/^\/+/, '')
    const url = new URL(`${baseUrl}/functions/v1/${normalizedPath}`)

    if (queryParams) {
        for (const [key, value] of Object.entries(queryParams)) {
            if (value === undefined || value === null || value === '') {
                continue
            }
            url.searchParams.set(key, String(value))
        }
    }

    return url.toString()
}

async function getAccessToken() {
    if (!supabase) {
        return null
    }

    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
}

async function request(path, { method = 'GET', body, auth = true, queryParams, timeoutMs = 15000 } = {}) {
    assertSupabaseConfigured()

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
        const headers = {
            'Content-Type': 'application/json',
        }

        if (auth) {
            const token = await getAccessToken()
            if (!token) {
                throw new ApiError('Authentication required.', {
                    status: 401,
                    code: 'auth_required',
                })
            }
            headers.Authorization = `Bearer ${token}`
        }

        const response = await fetch(buildFunctionUrl(path, queryParams), {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal,
        })

        const contentType = response.headers.get('content-type') || ''
        const payload = contentType.includes('application/json')
            ? await response.json()
            : null

        if (!response.ok) {
            throw new ApiError(
                payload?.error || payload?.message || `Request failed with status ${response.status}`,
                {
                    status: response.status,
                    code: payload?.code || 'request_failed',
                    details: payload?.details || null,
                },
            )
        }

        return payload
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new ApiError('Request timed out.', {
                status: 408,
                code: 'request_timeout',
            })
        }

        if (error instanceof ApiError) {
            throw error
        }

        throw new ApiError(error.message || 'Unknown network error.', {
            status: 500,
            code: 'network_error',
        })
    } finally {
        clearTimeout(timeout)
    }
}

export function apiGet(path, options = {}) {
    return request(path, { ...options, method: 'GET' })
}

export function apiPost(path, body, options = {}) {
    return request(path, { ...options, method: 'POST', body })
}
