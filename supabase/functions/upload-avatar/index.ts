import { corsHeaders } from '../_shared/cors.ts'
import { requireUser } from '../_shared/auth.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import { errorResponse, jsonResponse } from '../_shared/http.ts'

const AVATAR_BUCKET = 'avatars'
const MAX_FILE_BYTES = 5 * 1024 * 1024
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']

function resolveExtension(file: File) {
  const byMimeType: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/avif': 'avif',
  }

  if (byMimeType[file.type]) {
    return byMimeType[file.type]
  }

  const rawName = file.name || ''
  const rawExtension = rawName.split('.').pop()?.toLowerCase() || ''
  if (rawExtension.match(/^[a-z0-9]{2,5}$/)) {
    return rawExtension
  }

  return 'jpg'
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return errorResponse('Method not allowed.', 405, 'method_not_allowed')
  }

  try {
    const user = await requireUser(request)
    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return errorResponse('Image file is required.', 400, 'validation_error')
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return errorResponse('Unsupported image type.', 400, 'validation_error')
    }

    if (file.size > MAX_FILE_BYTES) {
      return errorResponse('Image exceeds 5MB limit.', 400, 'validation_error')
    }

    const admin = createAdminClient()

    const { data: existingBucket } = await admin.storage.getBucket(AVATAR_BUCKET)
    if (!existingBucket) {
      const { error: createBucketError } = await admin.storage.createBucket(AVATAR_BUCKET, {
        public: true,
        fileSizeLimit: `${MAX_FILE_BYTES}`,
        allowedMimeTypes: ALLOWED_MIME_TYPES,
      })

      if (createBucketError && !String(createBucketError.message).toLowerCase().includes('already')) {
        return errorResponse(createBucketError.message, 500, 'storage_bucket_error')
      }
    }

    const extension = resolveExtension(file)
    const objectPath = `${user.id}/${crypto.randomUUID()}.${extension}`

    const { error: uploadError } = await admin.storage
      .from(AVATAR_BUCKET)
      .upload(objectPath, file, {
        upsert: false,
        contentType: file.type || 'application/octet-stream',
      })

    if (uploadError) {
      return errorResponse(uploadError.message, 500, 'storage_upload_error')
    }

    const { data: publicData } = admin.storage.from(AVATAR_BUCKET).getPublicUrl(objectPath)

    return jsonResponse({
      avatar_url: publicData.publicUrl,
      path: objectPath,
    })
  } catch (error) {
    if (error.message === 'unauthorized') {
      return errorResponse('Authentication required.', 401, 'auth_required')
    }

    return errorResponse(error.message || 'Unexpected error.', 500, 'internal_error')
  }
})
