import { useState } from 'react'
import { downloadStarterApkInChunks } from '../utils/apkDownload.ts'
import type {
  AssistantSettings,
  LanguagePreference,
  PickupDelayMode,
  ScreeningMode,
  VoiceName,
} from '../types.ts'
import { Header } from './Header.tsx'

const VOICES: { id: VoiceName; desc: string }[] = [
  { id: 'Zephyr', desc: 'Balanced & natural' },
  { id: 'Kore', desc: 'Warm & clear' },
  { id: 'Puck', desc: 'Friendly & upbeat' },
  { id: 'Charon', desc: 'Calm & deep' },
  { id: 'Fenrir', desc: 'Crisp & direct' },
]

const LANGUAGES: { id: LanguagePreference; label: string }[] = [
  { id: 'auto', label: 'Auto (English / Punjabi / Hindi)' },
  { id: 'punjabi', label: 'Punjabi' },
  { id: 'english', label: 'English' },
  { id: 'hindi', label: 'Hindi' },
]

const SCREENING_MODES: { id: ScreeningMode; title: string; desc: string }[] = [
  {
    id: 'screen_message',
    title: 'Screen & Take Message',
    desc: 'Greets caller, asks reason & urgency, and takes a message.',
  },
  {
    id: 'friendly_receptionist',
    title: 'Friendly Receptionist',
    desc: 'Warm assistant that chats naturally and schedules callbacks.',
  },
  {
    id: 'strict_spam',
    title: 'Strict Spam Filter',
    desc: 'Verifies identity & company before passing any message along.',
  },
]

const PICKUP_MODES: { id: PickupDelayMode; label: string }[] = [
  { id: 'ring_3s', label: 'Auto-pickup (3s ring)' },
  { id: 'instant', label: 'Instant AI pickup' },
  { id: 'manual', label: 'Manual answer button' },
]

export function SettingsView({
  settings,
  onUpdateSettings,
}: {
  settings: AssistantSettings
  onUpdateSettings: (patch: Partial<AssistantSettings>) => void
}) {
  const [apkProgress, setApkProgress] = useState<number | null>(null)
  const [apkError, setApkError] = useState<string | null>(null)
  const [apkReady, setApkReady] = useState<{
    url: string
    filename: string
  } | null>(null)

  async function handleDownloadApk() {
    if (apkProgress !== null) return
    setApkError(null)
    if (apkReady) {
      URL.revokeObjectURL(apkReady.url)
      setApkReady(null)
    }
    setApkProgress(0)
    try {
      const result = await downloadStarterApkInChunks((pct) =>
        setApkProgress(pct),
      )
      setApkReady(result)
    } catch (err) {
      setApkError(
        err instanceof Error ? err.message : 'Could not download APK.',
      )
    } finally {
      setApkProgress(null)
    }
  }
  return (
    <div className="flex flex-col gap-[18px]">
      <Header isAssistantActive={settings.autoPickupEnabled} />

      <div>
        <h1 className="text-[20px] font-bold text-white">Call preferences</h1>
        <p className="text-[12px] text-[#8392AB]">
          Configure voice, language, and how CHARLOK answers your calls
        </p>
      </div>

      <section className="space-y-4 rounded-[22px] border border-[#22324C] bg-[#111A2A] p-5">
        <div>
          <label
            htmlFor="owner-name"
            className="block text-[11px] font-semibold uppercase tracking-wider text-[#8392AB]"
          >
            Your Name (Answering For)
          </label>
          <input
            id="owner-name"
            type="text"
            value={settings.ownerName}
            onChange={(e) => onUpdateSettings({ ownerName: e.target.value })}
            placeholder="e.g. Mandeep"
            className="mt-1.5 w-full rounded-[14px] border border-[#22324C] bg-[#080D18] px-3.5 py-2.5 text-[14px] text-white placeholder-[#5C6B84] focus:border-[#4F8CFF] focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#8392AB]">
            Assistant Voice
          </label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {VOICES.map((voice) => {
              const selected = settings.voiceName === voice.id
              return (
                <button
                  key={voice.id}
                  type="button"
                  onClick={() => onUpdateSettings({ voiceName: voice.id })}
                  className={`rounded-[14px] border p-3 text-left transition-colors ${
                    selected
                      ? 'border-[#4F8CFF] bg-[#172C50]'
                      : 'border-[#22324C] bg-[#0D1524] hover:border-[#354E75]'
                  }`}
                >
                  <div className="text-[13px] font-semibold text-white">
                    {voice.id}
                  </div>
                  <div className="text-[11px] text-[#8392AB]">{voice.desc}</div>
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label
            htmlFor="language-pref"
            className="block text-[11px] font-semibold uppercase tracking-wider text-[#8392AB]"
          >
            Spoken Language
          </label>
          <select
            id="language-pref"
            value={settings.language}
            onChange={(e) =>
              onUpdateSettings({
                language: e.target.value as LanguagePreference,
              })
            }
            className="mt-1.5 w-full rounded-[14px] border border-[#22324C] bg-[#080D18] px-3.5 py-2.5 text-[14px] text-white focus:border-[#4F8CFF] focus:outline-none"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#8392AB]">
            Inbound Pickup Timing
          </label>
          <div className="mt-2 flex flex-col gap-2">
            {PICKUP_MODES.map((mode) => {
              const selected = settings.pickupDelay === mode.id
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() =>
                    onUpdateSettings({
                      pickupDelay: mode.id,
                      autoPickupEnabled: mode.id !== 'manual',
                    })
                  }
                  className={`flex items-center justify-between rounded-[14px] border px-3.5 py-2.5 text-left text-[13px] font-medium transition-colors ${
                    selected
                      ? 'border-[#4F8CFF] bg-[#172C50] text-white'
                      : 'border-[#22324C] bg-[#0D1524] text-[#9BAAC2] hover:border-[#354E75]'
                  }`}
                >
                  <span>{mode.label}</span>
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      selected ? 'bg-[#4F8CFF]' : 'bg-[#22324C]'
                    }`}
                  />
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#8392AB]">
            Screening Behaviour
          </label>
          <div className="mt-2 flex flex-col gap-2">
            {SCREENING_MODES.map((mode) => {
              const selected = settings.screeningMode === mode.id
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => onUpdateSettings({ screeningMode: mode.id })}
                  className={`rounded-[14px] border p-3 text-left transition-colors ${
                    selected
                      ? 'border-[#4F8CFF] bg-[#172C50]'
                      : 'border-[#22324C] bg-[#0D1524] hover:border-[#354E75]'
                  }`}
                >
                  <div className="text-[13px] font-semibold text-white">
                    {mode.title}
                  </div>
                  <div className="mt-0.5 text-[11px] text-[#8392AB]">
                    {mode.desc}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label
            htmlFor="custom-greeting"
            className="block text-[11px] font-semibold uppercase tracking-wider text-[#8392AB]"
          >
            Custom Greeting (Optional)
          </label>
          <textarea
            id="custom-greeting"
            rows={2}
            value={settings.customGreeting}
            onChange={(e) =>
              onUpdateSettings({ customGreeting: e.target.value })
            }
            placeholder="e.g. Sat Sri Akal! Main CHARLOK bol reha haan, daso kinna naal gall karni hai?"
            className="mt-1.5 w-full rounded-[14px] border border-[#22324C] bg-[#080D18] px-3.5 py-2.5 text-[13px] text-white placeholder-[#5C6B84] focus:border-[#4F8CFF] focus:outline-none"
          />
        </div>
      </section>

      <section className="rounded-[20px] border border-[#22324C] bg-[#0D1524] p-4">
        <p className="text-[12px] font-semibold text-[#9FC2FF]">
          Android APK &amp; Mobile SIM call auto-pickup
        </p>
        <p className="mt-1 text-[12px] leading-[18px] text-[#9BAAC2]">
          Download the starter Android APK directly to your phone (transferred in safe chunks), or download the updated Android project (.zip with GitHub Actions workflow +{' '}
          <code className="text-[#EAF0FF]">CharlokCallScreeningService</code> auto-pickup) to build a fresh APK.
        </p>
        {apkError && (
          <p className="mt-2 text-[12px] text-[#FF8A9B]">{apkError}</p>
        )}
        {apkReady && (
          <div className="mt-2.5 rounded-[12px] border border-[#2B5D4A] bg-[#112A22] p-3 text-[12px] text-[#8DE6C2]">
            APK ready! Check your Downloads folder or tap below to save:
            <a
              href={apkReady.url}
              download={apkReady.filename}
              className="mt-1.5 block font-semibold text-white underline"
            >
              Save {apkReady.filename}
            </a>
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleDownloadApk()}
            disabled={apkProgress !== null}
            className="inline-flex items-center justify-center rounded-[12px] bg-[#4F8CFF] px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-[#3F7DF0] disabled:opacity-60"
          >
            {apkProgress !== null
              ? `Downloading APK… ${apkProgress}%`
              : 'Download Starter APK (54 MB)'}
          </button>
          <a
            href="/download/charlok-android-source.zip"
            download="charlok-android-source.zip"
            className="inline-flex items-center justify-center rounded-[12px] border border-[#22324C] bg-[#111A2A] px-3.5 py-2 text-[12px] font-semibold text-[#9FC2FF] hover:border-[#354E75]"
          >
            Download Android Source (.zip)
          </a>
        </div>
      </section>

      <footer className="pb-4">
        <p className="py-1 text-[12px] text-[#9FB0CA]">Privacy first</p>
        <p className="text-[12px] leading-[18px] text-[#8392AB]">
          Call access, microphone and contacts will only be requested when you enable the related feature.
        </p>
      </footer>
    </div>
  )
}
