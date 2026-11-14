import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  Loader2,
  Mic,
  MicOff,
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOff,
  Send,
  Volume2,
} from 'lucide-react'
import {
  blobToBase64,
  getBestRecorderMimeType,
  speakText,
  stopSpeaking,
  warmupSpeech,
} from '../audio/liveAudio.ts'
import type {
  AssistantSettings,
  CallRecord,
  IncomingCallPreset,
  TranscriptEntry,
} from '../types.ts'
import { Header } from './Header.tsx'

const CALLER_PRESETS: IncomingCallPreset[] = [
  {
    id: 'courier',
    callerName: 'BlueDart Delivery',
    callerNumber: '+91 98765 43210',
    hint: 'Package delivery at gate',
  },
  {
    id: 'family',
    callerName: 'Simranjeet Singh',
    callerNumber: '+91 98140 11223',
    hint: 'Evening dinner plan',
  },
  {
    id: 'clinic',
    callerName: 'City Dental Clinic',
    callerNumber: '+1 (415) 890-2214',
    hint: 'Appointment confirmation',
  },
  {
    id: 'unknown',
    callerName: 'Unknown Caller',
    callerNumber: '+1 (800) 555-0199',
    hint: 'Possible telemarketer',
  },
]

type CallPhase = 'idle' | 'ringing' | 'connecting' | 'active' | 'summarizing'

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

function nowTimeLabel(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function CallsView({
  settings,
  onUpdateSettings,
  onSaveCallRecord,
  onOpenSettings,
}: {
  settings: AssistantSettings
  onUpdateSettings: (patch: Partial<AssistantSettings>) => void
  onSaveCallRecord: (record: CallRecord) => void
  onOpenSettings: () => void
}) {
  const [phase, setPhase] = useState<CallPhase>('idle')
  const [callerName, setCallerName] = useState('BlueDart Delivery')
  const [callerNumber, setCallerNumber] = useState('+91 98765 43210')
  const [ringCountdown, setRingCountdown] = useState<number | null>(null)
  const [callSeconds, setCallSeconds] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [micAvailable, setMicAvailable] = useState(true)
  const [isListening, setIsListening] = useState(false)
  const [isCallerSpeaking, setIsCallerSpeaking] = useState(false)
  const [isProcessingVoice, setIsProcessingVoice] = useState(false)
  const [assistantSpeaking, setAssistantSpeaking] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [callerInput, setCallerInput] = useState('')
  const [sendingTextTurn, setSendingTextTurn] = useState(false)

  // Refs for clean timers, audio recording, and avoiding stale closures
  const ringAudioCtxRef = useRef<AudioContext | null>(null)
  const ringIntervalRef = useRef<number | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const vadTimerRef = useRef<number | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const speechDetectedRef = useRef(false)
  const speechStartMsRef = useRef(0)
  const lastVoiceMsRef = useRef(0)

  const phaseRef = useRef<CallPhase>('idle')
  const isMutedRef = useRef(false)
  const assistantSpeakingRef = useRef(false)
  const isProcessingVoiceRef = useRef(false)
  const transcriptRef = useRef<TranscriptEntry[]>([])
  const callStartedAtRef = useRef('')
  const callSecondsRef = useRef(0)
  const settingsRef = useRef(settings)
  const callerNameRef = useRef(callerName)
  const callerNumberRef = useRef(callerNumber)
  const transcriptEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  useEffect(() => {
    isMutedRef.current = isMuted
    if (isMuted) {
      stopActiveRecording(false)
    } else if (
      phaseRef.current === 'active' &&
      !assistantSpeakingRef.current &&
      !isProcessingVoiceRef.current
    ) {
      startRecordingSegment()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMuted])

  useEffect(() => {
    assistantSpeakingRef.current = assistantSpeaking
  }, [assistantSpeaking])

  useEffect(() => {
    isProcessingVoiceRef.current = isProcessingVoice
  }, [isProcessingVoice])

  useEffect(() => {
    transcriptRef.current = transcript
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcript])

  useEffect(() => {
    callSecondsRef.current = callSeconds
  }, [callSeconds])

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  useEffect(() => {
    callerNameRef.current = callerName
  }, [callerName])

  useEffect(() => {
    callerNumberRef.current = callerNumber
  }, [callerNumber])

  // Call duration timer while active
  useEffect(() => {
    if (phase !== 'active') return
    const timer = window.setInterval(() => {
      setCallSeconds((prev) => prev + 1)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [phase])

  // Cleanup everything on unmount
  useEffect(() => {
    return () => {
      stopRingtone()
      cleanupCallAudio()
    }
  }, [])

  function stopRingtone() {
    if (ringIntervalRef.current !== null) {
      window.clearInterval(ringIntervalRef.current)
      ringIntervalRef.current = null
    }
    if (ringAudioCtxRef.current && ringAudioCtxRef.current.state !== 'closed') {
      void ringAudioCtxRef.current.close()
    }
    ringAudioCtxRef.current = null
  }

  function startRingtone() {
    stopRingtone()
    try {
      const ctx = new AudioContext()
      ringAudioCtxRef.current = ctx
      const playBurst = () => {
        if (ctx.state === 'closed') return
        const now = ctx.currentTime
        const osc1 = ctx.createOscillator()
        const osc2 = ctx.createOscillator()
        const gain = ctx.createGain()
        osc1.frequency.value = 440
        osc2.frequency.value = 480
        gain.gain.setValueAtTime(0.001, now)
        gain.gain.exponentialRampToValueAtTime(0.05, now + 0.04)
        gain.gain.setValueAtTime(0.05, now + 0.7)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8)
        osc1.connect(gain)
        osc2.connect(gain)
        gain.connect(ctx.destination)
        osc1.start(now)
        osc2.start(now)
        osc1.stop(now + 0.85)
        osc2.stop(now + 0.85)
      }
      playBurst()
      ringIntervalRef.current = window.setInterval(playBurst, 2000)
    } catch {
      // AudioContext blocked or unavailable
    }
  }

  function stopActiveRecording(submitAudio: boolean) {
    if (vadTimerRef.current !== null) {
      window.clearInterval(vadTimerRef.current)
      vadTimerRef.current = null
    }
    setIsListening(false)
    setIsCallerSpeaking(false)

    const recorder = recorderRef.current
    if (!recorder) return
    recorderRef.current = null

    if (!submitAudio) {
      recorder.ondataavailable = null
      recorder.onstop = null
    }

    if (recorder.state !== 'inactive') {
      try {
        recorder.stop()
      } catch {
        // Ignore recorder stop errors
      }
    }
  }

  function cleanupCallAudio() {
    stopSpeaking()
    stopActiveRecording(false)
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop())
      mediaStreamRef.current = null
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      void audioCtxRef.current.close()
    }
    audioCtxRef.current = null
    setAssistantSpeaking(false)
    setIsProcessingVoice(false)
  }

  function appendTranscript(
    speaker: TranscriptEntry['speaker'],
    text: string,
  ) {
    const cleaned = text.trim()
    if (!cleaned) return
    setTranscript((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        speaker,
        text: cleaned,
        timestamp: nowTimeLabel(),
      },
    ])
  }

  function speakAssistantReply(text: string, resumeListeningAfter = true) {
    if (!text.trim()) {
      if (resumeListeningAfter && phaseRef.current === 'active' && !isMutedRef.current) {
        startRecordingSegment()
      }
      return
    }

    stopActiveRecording(false)
    assistantSpeakingRef.current = true
    setAssistantSpeaking(true)

    speakText(
      text,
      settingsRef.current.voiceName,
      settingsRef.current.language,
      () => {
        assistantSpeakingRef.current = true
        setAssistantSpeaking(true)
      },
      () => {
        assistantSpeakingRef.current = false
        setAssistantSpeaking(false)
        if (
          resumeListeningAfter &&
          phaseRef.current === 'active' &&
          !isMutedRef.current &&
          !isProcessingVoiceRef.current
        ) {
          startRecordingSegment()
        }
      },
    )
  }

  function triggerInboundCall() {
    warmupSpeech()
    setErrorMessage(null)
    setTranscript([])
    setCallSeconds(0)
    setIsMuted(false)
    setPhase('ringing')
    startRingtone()
  }

  // Handle auto-pickup countdown while ringing
  useEffect(() => {
    if (phase !== 'ringing') {
      setRingCountdown(null)
      return
    }
    if (!settings.autoPickupEnabled || settings.pickupDelay === 'manual') {
      setRingCountdown(null)
      return
    }
    if (settings.pickupDelay === 'instant') {
      const timer = window.setTimeout(() => {
        void answerWithCharlok()
      }, 450)
      return () => window.clearTimeout(timer)
    }

    setRingCountdown(3)
    const interval = window.setInterval(() => {
      setRingCountdown((prev) => {
        if (prev === null) return null
        if (prev <= 1) {
          window.clearInterval(interval)
          void answerWithCharlok()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => window.clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, settings.autoPickupEnabled, settings.pickupDelay])

  async function submitRecordedAudio(blob: Blob) {
    if (blob.size < 1200 || phaseRef.current !== 'active') {
      if (phaseRef.current === 'active' && !isMutedRef.current && !assistantSpeakingRef.current) {
        startRecordingSegment()
      }
      return
    }

    isProcessingVoiceRef.current = true
    setIsProcessingVoice(true)
    setErrorMessage(null)

    try {
      const audioBase64 = await blobToBase64(blob)
      const response = await fetch('/api/calls/voice-turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callerName: callerNameRef.current,
          callerNumber: callerNumberRef.current,
          audioBase64,
          audioMimeType: blob.type || 'audio/webm',
          history: transcriptRef.current,
          settings: settingsRef.current,
        }),
      })

      const data = (await response.json()) as {
        callerTranscript?: string
        replyText?: string
        error?: string
      }

      if (!response.ok || data.error) {
        setErrorMessage(data.error || 'Could not process caller voice.')
        isProcessingVoiceRef.current = false
        setIsProcessingVoice(false)
        return
      }

      if (!data.callerTranscript) {
        // Silence or background noise — resume listening quietly
        isProcessingVoiceRef.current = false
        setIsProcessingVoice(false)
        if (phaseRef.current === 'active' && !isMutedRef.current) {
          startRecordingSegment()
        }
        return
      }

      appendTranscript('caller', data.callerTranscript)
      if (data.replyText) {
        appendTranscript('assistant', data.replyText)
      }

      isProcessingVoiceRef.current = false
      setIsProcessingVoice(false)

      if (data.replyText) {
        speakAssistantReply(data.replyText, true)
      } else if (phaseRef.current === 'active' && !isMutedRef.current) {
        startRecordingSegment()
      }
    } catch (err) {
      isProcessingVoiceRef.current = false
      setIsProcessingVoice(false)
      setErrorMessage(
        err instanceof Error ? err.message : 'Network error sending voice audio.',
      )
    }
  }

  function startRecordingSegment() {
    const stream = mediaStreamRef.current
    if (
      !stream ||
      phaseRef.current !== 'active' ||
      isMutedRef.current ||
      assistantSpeakingRef.current ||
      isProcessingVoiceRef.current ||
      recorderRef.current
    ) {
      return
    }

    try {
      const mimeType = getBestRecorderMimeType()
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)

      chunksRef.current = []
      speechDetectedRef.current = false
      speechStartMsRef.current = 0
      lastVoiceMsRef.current = 0
      const segmentStartMs = Date.now()

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      recorder.onstop = () => {
        const hadSpeech = speechDetectedRef.current
        const recordedMime = recorder.mimeType || mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: recordedMime })
        chunksRef.current = []
        if (hadSpeech && phaseRef.current === 'active') {
          void submitRecordedAudio(blob)
        } else if (
          phaseRef.current === 'active' &&
          !isMutedRef.current &&
          !assistantSpeakingRef.current &&
          !isProcessingVoiceRef.current
        ) {
          startRecordingSegment()
        }
      }

      recorder.start(250)
      recorderRef.current = recorder
      setIsListening(true)
      setIsCallerSpeaking(false)

      // Monitor microphone volume for automatic voice activity detection
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioContext()
      }
      const ctx = audioCtxRef.current
      if (ctx.state === 'suspended') {
        void ctx.resume()
      }

      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 1024
      source.connect(analyser)
      const timeData = new Uint8Array(analyser.fftSize)

      vadTimerRef.current = window.setInterval(() => {
        if (
          phaseRef.current !== 'active' ||
          isMutedRef.current ||
          !recorderRef.current
        ) {
          return
        }

        analyser.getByteTimeDomainData(timeData)
        let sumSq = 0
        for (let i = 0; i < timeData.length; i++) {
          const centered = (timeData[i] - 128) / 128
          sumSq += centered * centered
        }
        const rms = Math.sqrt(sumSq / timeData.length)
        const now = Date.now()

        if (rms > 0.028) {
          if (!speechDetectedRef.current) {
            speechDetectedRef.current = true
            speechStartMsRef.current = now
            setIsCallerSpeaking(true)
          }
          lastVoiceMsRef.current = now
        } else if (
          speechDetectedRef.current &&
          now - lastVoiceMsRef.current > 1250 &&
          now - speechStartMsRef.current > 500
        ) {
          // Caller finished speaking — stop segment & send to Gemini
          stopActiveRecording(true)
        } else if (!speechDetectedRef.current && now - segmentStartMs > 12000) {
          // Periodically recycle silent buffer to keep memory tiny
          stopActiveRecording(false)
          startRecordingSegment()
        } else if (
          speechDetectedRef.current &&
          now - speechStartMsRef.current > 14000
        ) {
          stopActiveRecording(true)
        }
      }, 120)
    } catch {
      setMicAvailable(false)
    }
  }

  async function initMicrophone(): Promise<boolean> {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setMicAvailable(false)
        return false
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      mediaStreamRef.current = stream
      setMicAvailable(true)
      return true
    } catch {
      setMicAvailable(false)
      return false
    }
  }

  async function answerWithCharlok() {
    stopRingtone()
    warmupSpeech()
    setErrorMessage(null)
    setPhase('connecting')
    callStartedAtRef.current = new Date().toISOString()

    try {
      const [greetRes, hasMic] = await Promise.all([
        fetch('/api/calls/greet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callerName: callerNameRef.current,
            callerNumber: callerNumberRef.current,
            settings: settingsRef.current,
          }),
        }),
        initMicrophone(),
      ])

      const data = (await greetRes.json()) as {
        replyText?: string
        error?: string
      }

      if (!greetRes.ok || data.error) {
        setPhase('active')
        setErrorMessage(
          data.error || 'Could not start AI call assistant.',
        )
        return
      }

      phaseRef.current = 'active'
      setPhase('active')

      appendTranscript(
        'system',
        `Call picked up by CHARLOK (${settingsRef.current.voiceName} voice)`,
      )

      if (!hasMic) {
        appendTranscript(
          'system',
          'Microphone unavailable or denied — you can type caller messages below and hear CHARLOK speak.',
        )
      }

      const greeting =
        data.replyText ||
        `Hello, this is CHARLOK, ${settingsRef.current.ownerName || 'the user'}'s AI call assistant. How can I help you?`
      appendTranscript('assistant', greeting)
      speakAssistantReply(greeting, hasMic)
    } catch (err) {
      setPhase('active')
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to connect inbound call.',
      )
    }
  }

  async function sendCallerTextMessage(e: React.FormEvent) {
    e.preventDefault()
    const text = callerInput.trim()
    if (!text || sendingTextTurn) return

    warmupSpeech()
    stopActiveRecording(false)
    setCallerInput('')
    setErrorMessage(null)
    appendTranscript('caller', text)
    setSendingTextTurn(true)

    try {
      const response = await fetch('/api/calls/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callerName: callerNameRef.current,
          callerNumber: callerNumberRef.current,
          callerMessage: text,
          history: transcriptRef.current,
          settings: settingsRef.current,
        }),
      })
      const data = (await response.json()) as {
        replyText?: string
        error?: string
      }
      if (!response.ok || data.error) {
        setErrorMessage(data.error || 'CHARLOK could not reply right now.')
        return
      }
      if (data.replyText) {
        appendTranscript('assistant', data.replyText)
        speakAssistantReply(data.replyText, micAvailable && !isMutedRef.current)
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Network error sending caller message.',
      )
    } finally {
      setSendingTextTurn(false)
    }
  }

  async function hangUpCall() {
    stopRingtone()
    const currentTranscript = [...transcriptRef.current]
    const duration = callSecondsRef.current
    const startedAt = callStartedAtRef.current || new Date().toISOString()

    cleanupCallAudio()
    setPhase('summarizing')

    let summary = 'Call answered by CHARLOK.'
    let callerIntent = 'Inbound call'
    let urgency: CallRecord['urgency'] = 'low'
    let recommendedAction = 'Review the conversation transcript.'
    let isSpamLikely = false

    try {
      const res = await fetch('/api/calls/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callerName,
          callerNumber,
          transcript: currentTranscript,
        }),
      })
      if (res.ok) {
        const data = (await res.json()) as Partial<CallRecord>
        summary = data.summary || summary
        callerIntent = data.callerIntent || callerIntent
        if (
          data.urgency === 'high' ||
          data.urgency === 'medium' ||
          data.urgency === 'low'
        ) {
          urgency = data.urgency
        }
        recommendedAction = data.recommendedAction || recommendedAction
        isSpamLikely = Boolean(data.isSpamLikely)
      }
    } catch {
      // Save call with default summary if summarization fails
    }

    onSaveCallRecord({
      id: `call-${Date.now()}`,
      callerName: callerName.trim() || 'Unknown Caller',
      callerNumber: callerNumber.trim() || 'Unknown number',
      startedAt,
      durationSeconds: duration,
      outcome: 'answered_by_ai',
      summary,
      callerIntent,
      urgency,
      recommendedAction,
      isSpamLikely,
      transcript: currentTranscript,
    })

    setPhase('idle')
  }

  function declineRingingCall() {
    stopRingtone()
    cleanupCallAudio()
    onSaveCallRecord({
      id: `call-${Date.now()}`,
      callerName: callerName.trim() || 'Unknown Caller',
      callerNumber: callerNumber.trim() || 'Unknown number',
      startedAt: new Date().toISOString(),
      durationSeconds: 0,
      outcome: 'declined',
      summary: 'Inbound call was declined before pickup.',
      callerIntent: 'Unanswered',
      urgency: 'low',
      recommendedAction: 'Call back if you recognize this caller.',
      isSpamLikely: false,
      transcript: [],
    })
    setPhase('idle')
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <Header isAssistantActive={settings.autoPickupEnabled} />

      {errorMessage && (
        <div className="flex items-start gap-3 rounded-[18px] border border-[#5B2731] bg-[#241319] p-4 text-[13px] text-[#FFB4BF]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#FF7B8E]" />
          <div className="flex-1 leading-relaxed">{errorMessage}</div>
        </div>
      )}

      {phase === 'idle' && (
        <>
          <section className="rounded-[24px] border border-[#22324C] bg-gradient-to-br from-[#173B75]/60 via-[#111A2A] to-[#111A2A] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[1.4px] text-[#9FC2FF]">
                  INBOUND CALL HANDLER
                </p>
                <h1 className="mt-1 text-[20px] font-bold text-white">
                  Auto-answer with CHARLOK
                </h1>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.autoPickupEnabled}
                onClick={() =>
                  onUpdateSettings({
                    autoPickupEnabled: !settings.autoPickupEnabled,
                  })
                }
                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                  settings.autoPickupEnabled ? 'bg-[#4F8CFF]' : 'bg-[#22324C]'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                    settings.autoPickupEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-[#9BAAC2]">
              {settings.autoPickupEnabled
                ? `CHARLOK is active using the ${settings.voiceName} voice (${
                    settings.pickupDelay === 'instant'
                      ? 'instant pickup'
                      : settings.pickupDelay === 'ring_3s'
                        ? 'auto-pickup after 3s'
                        : 'manual answer button'
                  }).`
                : 'Enable auto-pickup or tap Answer AI on any incoming call below.'}
            </p>
            <button
              type="button"
              onClick={onOpenSettings}
              className="mt-3 text-[12px] font-semibold text-[#80AFFF] hover:underline"
            >
              Customize voice, language &amp; greeting →
            </button>
          </section>

          <section className="rounded-[24px] border border-[#22324C] bg-[#111A2A] p-5">
            <h2 className="text-[16px] font-bold text-white">
              Test an inbound call
            </h2>
            <p className="mt-1 text-[12px] text-[#9BAAC2]">
              Choose a caller or enter a custom number, then tap Receive Inbound Call to hear CHARLOK pick up and talk.
            </p>

            <div className="mt-3.5 grid grid-cols-2 gap-2.5">
              {CALLER_PRESETS.map((preset) => {
                const selected =
                  callerName === preset.callerName &&
                  callerNumber === preset.callerNumber
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setCallerName(preset.callerName)
                      setCallerNumber(preset.callerNumber)
                    }}
                    className={`rounded-[16px] border p-3 text-left transition-colors ${
                      selected
                        ? 'border-[#4F8CFF] bg-[#172C50]'
                        : 'border-[#22324C] bg-[#0D1524] hover:border-[#354E75]'
                    }`}
                  >
                    <div className="truncate text-[13px] font-semibold text-white">
                      {preset.callerName}
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-[#8392AB]">
                      {preset.hint}
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label
                  htmlFor="caller-name"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-[#8392AB]"
                >
                  Caller Name
                </label>
                <input
                  id="caller-name"
                  type="text"
                  value={callerName}
                  onChange={(e) => setCallerName(e.target.value)}
                  placeholder="Caller name"
                  className="mt-1.5 w-full rounded-[14px] border border-[#22324C] bg-[#080D18] px-3.5 py-2.5 text-[14px] text-white placeholder-[#5C6B84] focus:border-[#4F8CFF] focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="caller-number"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-[#8392AB]"
                >
                  Phone Number
                </label>
                <input
                  id="caller-number"
                  type="text"
                  value={callerNumber}
                  onChange={(e) => setCallerNumber(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="mt-1.5 w-full rounded-[14px] border border-[#22324C] bg-[#080D18] px-3.5 py-2.5 text-[14px] text-white placeholder-[#5C6B84] focus:border-[#4F8CFF] focus:outline-none"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={triggerInboundCall}
              className="mt-5 flex h-[52px] w-full items-center justify-center gap-2.5 rounded-[16px] bg-[#4F8CFF] text-[15px] font-semibold text-white transition-colors hover:bg-[#3F7DF0] active:bg-[#3570DE]"
            >
              <PhoneIncoming className="h-5 w-5" />
              <span>Receive Inbound Call</span>
            </button>
          </section>
        </>
      )}

      {phase === 'ringing' && (
        <section className="flex flex-col items-center rounded-[28px] border border-[#2B4675] bg-gradient-to-b from-[#162E59] via-[#111A2A] to-[#0D1524] px-6 py-9 text-center">
          <div className="relative flex h-24 w-24 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-[#4F8CFF]/25" />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#4F8CFF] to-[#63D5FF]">
              <PhoneCall className="h-9 w-9 text-white" />
            </div>
          </div>

          <p className="mt-6 text-[11px] font-bold uppercase tracking-[1.6px] text-[#9FC2FF]">
            INCOMING CALL
          </p>
          <h2 className="mt-2 text-[24px] font-bold text-white">
            {callerName || 'Unknown Caller'}
          </h2>
          <p className="mt-1 text-[14px] text-[#9BAAC2]">
            {callerNumber || 'Private number'}
          </p>

          {ringCountdown !== null && ringCountdown > 0 && (
            <div className="mt-4 rounded-full bg-[#15243B] px-4 py-1.5 text-[12px] font-semibold text-[#9FC2FF]">
              CHARLOK auto-picking up in {ringCountdown}s…
            </div>
          )}

          <div className="mt-8 grid w-full grid-cols-2 gap-3">
            <button
              type="button"
              onClick={declineRingingCall}
              className="flex h-[52px] items-center justify-center gap-2 rounded-[16px] bg-[#3A1B23] text-[14px] font-semibold text-[#FF8A9B] transition-colors hover:bg-[#4D222D]"
            >
              <PhoneOff className="h-5 w-5" />
              <span>Decline</span>
            </button>
            <button
              type="button"
              onClick={() => void answerWithCharlok()}
              className="flex h-[52px] items-center justify-center gap-2 rounded-[16px] bg-[#1F9D68] text-[14px] font-semibold text-white transition-colors hover:bg-[#198759]"
            >
              <Phone className="h-5 w-5" />
              <span>Answer AI</span>
            </button>
          </div>
        </section>
      )}

      {(phase === 'connecting' ||
        phase === 'active' ||
        phase === 'summarizing') && (
        <section className="flex flex-col rounded-[28px] border border-[#22324C] bg-[#111A2A] p-5">
          <div className="flex items-center justify-between gap-3 border-b border-[#1E2D47] pb-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#5CE0A8]" />
                <span className="text-[11px] font-bold uppercase tracking-[1.3px] text-[#5CE0A8]">
                  {phase === 'connecting'
                    ? 'PICKING UP CALL…'
                    : phase === 'summarizing'
                      ? 'SAVING CALL SUMMARY…'
                      : `CHARLOK ON CALL · ${formatDuration(callSeconds)}`}
                </span>
              </div>
              <h2 className="mt-1 truncate text-[20px] font-bold text-white">
                {callerName || 'Unknown Caller'}
              </h2>
              <p className="text-[12px] text-[#8392AB]">{callerNumber}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="rounded-full bg-[#1B3154] px-3 py-1 text-[11px] font-semibold text-[#9FC2FF]">
                {settings.voiceName}
              </span>
              {assistantSpeaking && (
                <span className="flex items-center gap-1 text-[11px] font-medium text-[#63D5FF]">
                  <Volume2 className="h-3.5 w-3.5" />
                  CHARLOK speaking
                </span>
              )}
              {!assistantSpeaking && isProcessingVoice && (
                <span className="flex items-center gap-1 text-[11px] font-medium text-[#9FC2FF]">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Thinking…
                </span>
              )}
              {!assistantSpeaking && !isProcessingVoice && isCallerSpeaking && (
                <span className="text-[11px] font-medium text-[#5CE0A8]">
                  Hearing caller…
                </span>
              )}
              {!assistantSpeaking &&
                !isProcessingVoice &&
                !isCallerSpeaking &&
                isListening && (
                  <span className="text-[11px] font-medium text-[#8392AB]">
                    Listening…
                  </span>
                )}
            </div>
          </div>

          <div className="mt-4 flex h-[250px] flex-col gap-2.5 overflow-y-auto rounded-[18px] border border-[#1B2A44] bg-[#080D18] p-3.5">
            {transcript.length === 0 ? (
              <div className="m-auto flex flex-col items-center gap-2 text-center text-[13px] text-[#8392AB]">
                <Loader2 className="h-5 w-5 animate-spin text-[#4F8CFF]" />
                <span>CHARLOK is picking up the call…</span>
              </div>
            ) : (
              transcript.map((entry) => {
                if (entry.speaker === 'system') {
                  return (
                    <div
                      key={entry.id}
                      className="mx-auto max-w-[90%] rounded-full bg-[#15243B] px-3 py-1 text-center text-[11px] text-[#9FC2FF]"
                    >
                      {entry.text}
                    </div>
                  )
                }
                const isAssistant = entry.speaker === 'assistant'
                return (
                  <div
                    key={entry.id}
                    className={`flex flex-col ${
                      isAssistant ? 'items-start' : 'items-end'
                    }`}
                  >
                    <span className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#8193B0]">
                      {isAssistant ? 'CHARLOK' : 'Caller'} · {entry.timestamp}
                    </span>
                    <div
                      className={`max-w-[85%] rounded-[16px] px-3.5 py-2.5 text-[13px] leading-relaxed ${
                        isAssistant
                          ? 'bg-[#172C50] text-[#EAF0FF]'
                          : 'bg-[#1D2636] text-[#D1DDF3]'
                      }`}
                    >
                      {entry.text}
                    </div>
                  </div>
                )
              })
            )}
            <div ref={transcriptEndRef} />
          </div>

          <form onSubmit={sendCallerTextMessage} className="mt-3 flex gap-2">
            <input
              type="text"
              value={callerInput}
              onChange={(e) => setCallerInput(e.target.value)}
              disabled={phase !== 'active' || sendingTextTurn}
              placeholder={
                micAvailable
                  ? 'Speak on mic or type caller message…'
                  : 'Type what the caller says…'
              }
              className="min-w-0 flex-1 rounded-[14px] border border-[#22324C] bg-[#080D18] px-3.5 py-2.5 text-[13px] text-white placeholder-[#687892] focus:border-[#4F8CFF] focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!callerInput.trim() || phase !== 'active' || sendingTextTurn}
              aria-label="Send caller message"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#4F8CFF] text-white transition-colors hover:bg-[#3F7DF0] disabled:opacity-40"
            >
              {sendingTextTurn ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </form>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setIsMuted((m) => !m)}
              disabled={!micAvailable || phase !== 'active'}
              className={`flex h-12 items-center justify-center gap-2 rounded-[16px] text-[14px] font-semibold transition-colors disabled:opacity-40 ${
                isMuted
                  ? 'bg-[#2C2538] text-[#F7B955]'
                  : 'bg-[#1A2740] text-[#EAF0FF] hover:bg-[#223252]'
              }`}
            >
              {isMuted ? (
                <>
                  <MicOff className="h-4 w-4" />
                  <span>Mic Muted</span>
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4" />
                  <span>Mute Mic</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => void hangUpCall()}
              disabled={phase === 'summarizing'}
              className="flex h-12 items-center justify-center gap-2 rounded-[16px] bg-[#D93F4C] text-[14px] font-semibold text-white transition-colors hover:bg-[#C13440] disabled:opacity-60"
            >
              {phase === 'summarizing' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving…</span>
                </>
              ) : (
                <>
                  <PhoneOff className="h-4 w-4" />
                  <span>End Call</span>
                </>
              )}
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
