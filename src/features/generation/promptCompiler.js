import { normalizeGenerationInput } from './schema'

function resolveValue(primary, customValue) {
    if (primary === 'custom') {
        return customValue || 'Not specified'
    }

    return primary || customValue || 'Not specified'
}

export function buildGenerationPrompt(rawInput) {
    const input = normalizeGenerationInput(rawInput)

    const scene = resolveValue(input.options.scene, input.options.sceneCustom)
    const role = resolveValue(input.options.role, input.options.roleCustom)
    const selectedOptions = {
        scene,
        role,
        style: input.options.style || 'Friendly',
        length: input.options.length || 'Shorter',
        emoji: Boolean(input.options.emoji),
        language: input.language,
        variations: input.variations,
    }

    return {
        request: input,
        systemInstruction: [
            'You are an assistant specialized in writing practical reply drafts.',
            'Always output strict JSON in this shape: {"replies": ["..."]}.',
            'Never include markdown or code fences.',
            `Return exactly ${input.variations} replies.`,
            'Follow all selected options exactly.',
        ].join(' '),
        userPrompt: [
            `Selected Options JSON:\n${JSON.stringify(selectedOptions, null, 2)}`,
            `Original Message:\n${input.message}`,
            input.notes ? `Additional Notes:\n${input.notes}` : 'Additional Notes: None',
            'Make replies clear, context-aware, and directly usable.',
        ].join('\n\n'),
    }
}
