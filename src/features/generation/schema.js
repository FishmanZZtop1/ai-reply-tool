export const GENERATION_LIMITS = {
    messageMin: 1,
    messageMax: 6000,
    notesMax: 1200,
    variationsMin: 1,
    variationsMax: 5,
    creditsPerRequest: 100,
}

export const generationRequestShape = {
    required: ['message', 'options', 'variations'],
}

export const generationResponseShape = {
    required: ['replies', 'credits_charged', 'remaining_credits', 'request_id'],
}

function cleanString(value, maxLength) {
    if (typeof value !== 'string') {
        return ''
    }

    const withoutControls = Array.from(value)
        .map((character) => {
            const code = character.charCodeAt(0)
            return (code < 32 || code === 127) ? ' ' : character
        })
        .join('')

    return withoutControls.trim().slice(0, maxLength)
}

export function normalizeGenerationInput(input) {
    const message = cleanString(input?.message, GENERATION_LIMITS.messageMax)
    const notes = cleanString(input?.notes ?? '', GENERATION_LIMITS.notesMax)

    const variationsRaw = Number.parseInt(input?.variations ?? 3, 10)
    const variations = Number.isFinite(variationsRaw)
        ? Math.min(GENERATION_LIMITS.variationsMax, Math.max(GENERATION_LIMITS.variationsMin, variationsRaw))
        : 3

    return {
        message,
        notes,
        options: {
            scene: cleanString(input?.options?.scene ?? '', 120),
            role: cleanString(input?.options?.role ?? '', 120),
            style: cleanString(input?.options?.style ?? '', 120),
            length: cleanString(input?.options?.length ?? 'Shorter', 40),
            emoji: Boolean(input?.options?.emoji),
            sceneCustom: cleanString(input?.options?.sceneCustom ?? '', 120),
            roleCustom: cleanString(input?.options?.roleCustom ?? '', 120),
        },
        language: cleanString(input?.language ?? 'auto', 20) || 'auto',
        variations,
    }
}

export function validateGenerationInput(normalizedInput) {
    if (!normalizedInput.message || normalizedInput.message.length < GENERATION_LIMITS.messageMin) {
        return { ok: false, reason: 'Message is required.' }
    }

    if (normalizedInput.message.length > GENERATION_LIMITS.messageMax) {
        return { ok: false, reason: `Message exceeds ${GENERATION_LIMITS.messageMax} characters.` }
    }

    if (normalizedInput.notes.length > GENERATION_LIMITS.notesMax) {
        return { ok: false, reason: `Notes exceed ${GENERATION_LIMITS.notesMax} characters.` }
    }

    return { ok: true }
}
