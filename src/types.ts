export type NavTabId = 'home' | 'calls' | 'history' | 'settings'

export type VoiceName = 'Zephyr' | 'Kore' | 'Puck' | 'Charon' | 'Fenrir'

export type ScreeningMode = 'screen_message' | 'friendly_receptionist' | 'strict_spam'

export type PickupDelayMode = 'manual' | 'instant' | 'ring_3s'

export type LanguagePreference = 'auto' | 'english' | 'punjabi' | 'hindi'

export interface AssistantSettings {
  ownerName: string
  voiceName: VoiceName
  language: LanguagePreference
  screeningMode: ScreeningMode
  pickupDelay: PickupDelayMode
  autoPickupEnabled: boolean
  customGreeting: string
}

export interface TranscriptEntry {
  id: string
  speaker: 'caller' | 'assistant' | 'system'
  text: string
  timestamp: string
}

export type CallUrgency = 'low' | 'medium' | 'high'

export interface CallRecord {
  id: string
  callerName: string
  callerNumber: string
  startedAt: string
  durationSeconds: number
  outcome: 'answered_by_ai' | 'answered_by_owner' | 'declined'
  summary: string
  callerIntent: string
  urgency: CallUrgency
  recommendedAction: string
  isSpamLikely: boolean
  transcript: TranscriptEntry[]
}

export interface IncomingCallPreset {
  id: string
  callerName: string
  callerNumber: string
  hint: string
}
