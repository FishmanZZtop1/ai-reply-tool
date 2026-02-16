import { describe, expect, it } from 'vitest'
import { buildGenerationPrompt } from './promptCompiler'
import { normalizeGenerationInput, validateGenerationInput } from './schema'

describe('generation schema', () => {
    it('normalizes and clamps variations', () => {
        const normalized = normalizeGenerationInput({
            message: 'Hello',
            variations: 999,
            options: {},
        })

        expect(normalized.variations).toBe(5)
    })

    it('rejects empty message', () => {
        const normalized = normalizeGenerationInput({
            message: '   ',
            options: {},
            variations: 1,
        })

        expect(validateGenerationInput(normalized)).toEqual({
            ok: false,
            reason: 'Message is required.',
        })
    })
})

describe('prompt compiler', () => {
    it('builds prompt and enforces exact reply count in system instruction', () => {
        const payload = buildGenerationPrompt({
            message: 'Can you join tomorrow?',
            notes: 'I want to politely decline.',
            language: 'auto',
            variations: 3,
            options: {
                scene: '💼 Work Email',
                role: '👔 Boss / Manager',
                style: '📋 Professional',
                length: 'Shorter',
                emoji: false,
            },
        })

        expect(payload.systemInstruction).toContain('Return exactly 3 replies')
        expect(payload.userPrompt).toContain('"style": "📋 Professional"')
        expect(payload.userPrompt).toContain('Additional Notes')
    })

    it('uses custom scene and role values when selected', () => {
        const payload = buildGenerationPrompt({
            message: 'msg',
            notes: '',
            variations: 1,
            options: {
                scene: 'custom',
                sceneCustom: 'Conference follow-up',
                role: 'custom',
                roleCustom: 'Potential investor',
                style: '⚡ Direct',
                length: 'Longer',
                emoji: true,
            },
        })

        expect(payload.userPrompt).toContain('"scene": "Conference follow-up"')
        expect(payload.userPrompt).toContain('"role": "Potential investor"')
    })
})
