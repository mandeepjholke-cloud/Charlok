import type { LanguagePreference, VoiceName } from '../types.ts'

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      const commaIdx = result.indexOf(',')
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result)
    }
    reader.onerror = () => reject(new Error('Failed to encode audio recording'))
    reader.readAsDataURL(blob)
  })
}

export function getBestRecorderMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ]
  for (const mime of candidates) {
    if (
      typeof MediaRecorder !== 'undefined' &&
      MediaRecorder.isTypeSupported(mime)
    ) {
      return mime
    }
  }
  return ''
}

function getVoicePitchAndRate(voiceName: VoiceName): {
  pitch: number
  rate: number
} {
  switch (voiceName) {
    case 'Charon':
      return { pitch: 0.85, rate: 0.96 }
    case 'Fenrir':
      return { pitch: 0.92, rate: 1.04 }
    case 'Puck':
      return { pitch: 1.08, rate: 1.04 }
    case 'Kore':
      return { pitch: 1.04, rate: 0.99 }
    case 'Zephyr':
    default:
      return { pitch: 1.0, rate: 1.0 }
  }
}

function detectSpeechLang(
  text: string,
  preference: LanguagePreference,
): string {
  if (/[\u0A00-\u0A7F]/.test(text)) return 'pa-IN'
  if (/[\u0900-\u097F]/.test(text)) return 'hi-IN'
  if (preference === 'punjabi') return 'pa-IN'
  if (preference === 'hindi') return 'hi-IN'
  if (preference === 'english') return 'en-US'
  // Heuristic for Roman Hindi/Punjabi words so Indian-accented voice sounds natural
  if (
    /\b(namaste|sat sri akal|haanji|kya|kaise|bol|haan|nahi|theek|shukriya|dhanyavaad|ji|aap)\b/i.test(
      text,
    )
  ) {
    return 'en-IN'
  }
  return 'en-US'
}

export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
}

export function warmupSpeech(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.getVoices()
  }
}

export function speakText(
  text: string,
  voiceName: VoiceName,
  languagePreference: LanguagePreference,
  onStart?: () => void,
  onEnd?: () => void,
): void {
  if (
    typeof window === 'undefined' ||
    !('speechSynthesis' in window) ||
    !text.trim()
  ) {
    onEnd?.()
    return
  }

  window.speechSynthesis.cancel()

  const utterance = new SpeechSynthesisUtterance(text)
  const lang = detectSpeechLang(text, languagePreference)
  utterance.lang = lang

  const { pitch, rate } = getVoicePitchAndRate(voiceName)
  utterance.pitch = pitch
  utterance.rate = rate

  const voices = window.speechSynthesis.getVoices()
  if (voices.length > 0) {
    const langPrefix = lang.split('-')[0].toLowerCase()
    const match =
      voices.find((v) => v.lang.toLowerCase() === lang.toLowerCase()) ||
      voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix)) ||
      voices.find((v) => v.lang.toLowerCase().startsWith('en'))
    if (match) {
      utterance.voice = match
    }
  }

  let settled = false
  const finish = () => {
    if (settled) return
    settled = true
    onEnd?.()
  }

  utterance.onstart = () => {
    onStart?.()
  }
  utterance.onend = finish
  utterance.onerror = finish

  onStart?.()
  window.speechSynthesis.speak(utterance)

  // Safety timeout in case a mobile browser fails to fire onend
  const fallbackMs = Math.min(18000, Math.max(3500, text.length * 95))
  window.setTimeout(finish, fallbackMs)
}
