function isHiraganaOrKatakana(char: string) {
  return /[\u3040-\u30FF\u31F0-\u31FF]/.test(char)
}

function isHangul(char: string) {
  return /[\uAC00-\uD7AF]/.test(char)
}

function isHan(char: string) {
  return /[\u4E00-\u9FFF]/.test(char)
}

function isCyrillic(char: string) {
  return /[\u0400-\u04FF]/.test(char)
}

function isArabic(char: string) {
  return /[\u0600-\u06FF]/.test(char)
}

function isDevanagari(char: string) {
  return /[\u0900-\u097F]/.test(char)
}

function isLatin(char: string) {
  return /[A-Za-z]/.test(char)
}

export function inferLanguageFromMessage(message: string) {
  const text = String(message || '').trim()
  if (!text) {
    return 'en'
  }

  let hasKana = false
  let hangulCount = 0
  let hanCount = 0
  let cyrillicCount = 0
  let arabicCount = 0
  let devanagariCount = 0
  let latinCount = 0

  for (const char of text) {
    if (isHiraganaOrKatakana(char)) {
      hasKana = true
      continue
    }

    if (isHangul(char)) {
      hangulCount += 1
      continue
    }

    if (isHan(char)) {
      hanCount += 1
      continue
    }

    if (isCyrillic(char)) {
      cyrillicCount += 1
      continue
    }

    if (isArabic(char)) {
      arabicCount += 1
      continue
    }

    if (isDevanagari(char)) {
      devanagariCount += 1
      continue
    }

    if (isLatin(char)) {
      latinCount += 1
    }
  }

  if (hasKana) return 'ja'
  if (hangulCount > 0) return 'ko'
  if (hanCount > 0) return 'zh'
  if (cyrillicCount > 0) return 'ru'
  if (arabicCount > 0) return 'ar'
  if (devanagariCount > 0) return 'hi'
  if (latinCount > 0) return 'en'

  return 'en'
}
