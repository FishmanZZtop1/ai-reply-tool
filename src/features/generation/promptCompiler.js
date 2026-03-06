import { normalizeGenerationInput } from './schema'

function resolveValue(primary, customValue) {
    if (primary === 'custom') {
        return customValue || 'Not specified'
    }

    return primary || customValue || 'Not specified'
}

export function buildGenerationPrompt(rawInput) {
    const input = normalizeGenerationInput(rawInput)
    const hasOriginalMessage = Boolean(input.message)
    const originalMessage = hasOriginalMessage
        ? input.message
        : '[No original message provided. Use Writer Intent Notes as the primary context.]'

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
            'You write the final message that will be sent from the writer to the recipient (the sender of the original message).',
            'Do not speak to the writer as an assistant and do not output helper/meta wording.',
            'Always output strict JSON in this shape: {"replies": ["..."]}.',
            'Never include markdown or code fences.',
            `Return exactly ${input.variations} replies.`,
            'Follow all selected options exactly.',
        ].join(' '),
        userPrompt: [
            `Selected Options JSON:\n${JSON.stringify(selectedOptions, null, 2)}`,
            `Original Message:\n${originalMessage}`,
            input.notes
                ? `Writer Intent Notes (internal guidance, not to be answered literally):\n${input.notes}`
                : 'Writer Intent Notes: None',
            'Critical perspective rules:',
            '- The reply is sent to the person who wrote the Original Message.',
            '- If Original Message is missing, use Writer Intent Notes as primary context.',
            '- Write as the writer/user, not as AI assistant.',
            '- Convert notes like "help me ask for leave" into a direct recipient-facing reply.',
            '- Never output meta lines like "I can help you..." / "我会帮你...".',
            'Make replies clear, context-aware, and directly usable.',
        ].join('\n\n'),
    }
}
