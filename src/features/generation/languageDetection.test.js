import { describe, expect, it } from 'vitest'
import { inferLanguageFromMessage } from '../../../supabase/functions/_shared/language.ts'

describe('inferLanguageFromMessage', () => {
    it('detects Chinese from message text', () => {
        expect(inferLanguageFromMessage('你今天有空吗？')).toBe('zh')
    })

    it('detects Japanese when kana is present', () => {
        expect(inferLanguageFromMessage('明日の会議は参加できますか？')).toBe('ja')
    })

    it('detects Korean from Hangul', () => {
        expect(inferLanguageFromMessage('내일 시간 괜찮아요?')).toBe('ko')
    })

    it('detects English from Latin text', () => {
        expect(inferLanguageFromMessage('Can we move this to next week?')).toBe('en')
    })

    it('prefers message language even when mixed content appears', () => {
        expect(inferLanguageFromMessage('Can we reschedule? 帮我请假')).toBe('zh')
    })

    it('falls back to English for empty input', () => {
        expect(inferLanguageFromMessage('   ')).toBe('en')
    })
})
