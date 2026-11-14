import { useEffect, useState, type ReactNode } from 'react'
import { Download, History, Home, Phone, Settings, SlidersHorizontal } from 'lucide-react'
import { CallsView } from './components/CallsView.tsx'
import { Header } from './components/Header.tsx'
import { HistoryView } from './components/HistoryView.tsx'
import { OfflineIndicator } from './components/OfflineIndicator.tsx'
import { PWAInstallButton } from './components/PWAInstallButton.tsx'
import { SettingsView } from './components/SettingsView.tsx'
import type { AssistantSettings, CallRecord, NavTabId } from './types.ts'

const SETTINGS_STORAGE_KEY = 'charlok_assistant_settings_v1'
const HISTORY_STORAGE_KEY = 'charlok_call_history_v1'

const DEFAULT_SETTINGS: AssistantSettings = {
  ownerName: 'Mandeep',
  voiceName: 'Zephyr',
  language: 'auto',
  screeningMode: 'screen_message',
  pickupDelay: 'ring_3s',
  autoPickupEnabled: true,
  customGreeting: '',
}

const NAV_ITEMS: { id: NavTabId; label: string; icon: ReactNode }[] = [
  { id: 'home', label: 'Home', icon: <Home className="h-5 w-5" /> },
  { id: 'calls', label: 'Calls', icon: <Phone className="h-5 w-5" /> },
  { id: 'history', label: 'History', icon: <History className="h-5 w-5" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="h-5 w-5" /> },
]

function loadSettings(): AssistantSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AssistantSettings>) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function loadHistory(): CallRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as CallRecord[]) : []
  } catch {
    return []
  }
}

export function App() {
  const [selectedTab, setSelectedTab] = useState<NavTabId>('home')
  const [settings, setSettings] = useState<AssistantSettings>(loadSettings)
  const [callHistory, setCallHistory] = useState<CallRecord[]>(loadHistory)

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
    } catch {
      // Ignore storage errors
    }
  }, [settings])

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(callHistory))
    } catch {
      // Ignore storage errors
    }
  }, [callHistory])

  function updateSettings(patch: Partial<AssistantSettings>) {
    setSettings((prev) => ({ ...prev, ...patch }))
  }

  function saveCallRecord(record: CallRecord) {
    setCallHistory((prev) => [record, ...prev])
  }

  function deleteCallRecord(id: string) {
    setCallHistory((prev) => prev.filter((item) => item.id !== id))
  }

  function clearCallHistory() {
    setCallHistory([])
  }

  const workspaceFeatures = [
    {
      id: 'call-assistant',
      title: 'Call assistant',
      subtitle: 'Choose how CHARLOK handles incoming calls',
      status: settings.autoPickupEnabled ? 'Auto-pickup ON' : 'Manual answer',
      targetTab: 'calls' as NavTabId,
      icon: <Phone className="h-5 w-5 text-[#83AEFF]" />,
    },
    {
      id: 'recent-conversations',
      title: 'Recent conversations',
      subtitle: 'Review callers and conversation activity',
      status:
        callHistory.length > 0
          ? `${callHistory.length} ${callHistory.length === 1 ? 'call' : 'calls'}`
          : 'No calls yet',
      targetTab: 'history' as NavTabId,
      icon: <History className="h-5 w-5 text-[#83AEFF]" />,
    },
    {
      id: 'call-preferences',
      title: 'Call preferences',
      subtitle: 'Voice, availability and assistant behaviour',
      status: `${settings.voiceName} · ${settings.language.toUpperCase()}`,
      targetTab: 'settings' as NavTabId,
      icon: <SlidersHorizontal className="h-5 w-5 text-[#83AEFF]" />,
    },
    {
      id: 'android-apk',
      title: 'Download Android APK',
      subtitle: 'Get starter APK (54 MB) or Android source zip',
      status: 'APK / ZIP',
      targetTab: 'settings' as NavTabId,
      icon: <Download className="h-5 w-5 text-[#83AEFF]" />,
    },
  ]

  return (
    <div className="flex min-h-screen flex-col bg-[#080D18] text-[#F4F7FF]">
      <OfflineIndicator />
      <main className="mx-auto flex w-full max-w-[540px] flex-1 flex-col px-5 pb-28">
        {selectedTab === 'home' && (
          <div className="flex flex-col gap-[18px]">
            <Header isAssistantActive={settings.autoPickupEnabled} />

            <section className="w-full rounded-[28px] bg-gradient-to-br from-[#173B75] via-[#17243D] to-[#111A2A] p-[22px]">
              <p className="text-[11px] font-bold uppercase tracking-[1.4px] text-[#9FC2FF]">
                YOUR AI CALL ASSISTANT
              </p>
              <h1 className="mt-2.5 text-[27px] font-bold leading-[33px] text-white">
                Your calls.
                <br />
                Handled smarter.
              </h1>
              <p className="mt-2 text-[14px] leading-relaxed text-[#D1DDF3]">
                CHARLOK picks up incoming calls, talks naturally with callers, and saves summaries for you.
              </p>
              <button
                type="button"
                onClick={() => setSelectedTab('calls')}
                className="mt-[22px] flex h-[52px] w-full items-center justify-center gap-[9px] rounded-[16px] bg-[#4F8CFF] text-[14px] font-semibold text-white transition-colors hover:bg-[#3F7DF0] active:bg-[#3570DE]"
              >
                <Phone className="h-[18px] w-[18px]" />
                <span>Answer &amp; test inbound calls</span>
              </button>
            </section>

            <PWAInstallButton variant="card" />

            <h2 className="text-[19px] font-bold text-white">Your workspace</h2>

            <div className="flex flex-col gap-[18px]">
              {workspaceFeatures.map((feature) => (
                <button
                  key={feature.id}
                  type="button"
                  onClick={() => setSelectedTab(feature.targetTab)}
                  className="flex w-full items-center rounded-[20px] border border-[#22324C] bg-[#111A2A] p-[17px] text-left transition-colors hover:border-[#354E75] hover:bg-[#152035] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4F8CFF]"
                >
                  <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[14px] bg-[#1B3154]">
                    {feature.icon}
                  </div>
                  <div className="ml-3.5 min-w-0 flex-1 pr-3">
                    <div className="text-[15px] font-semibold leading-snug text-white">
                      {feature.title}
                    </div>
                    <div className="mt-1 text-[12px] leading-[16px] text-[#9BAAC2]">
                      {feature.subtitle}
                    </div>
                  </div>
                  <span className="shrink-0 text-[10px] font-bold text-[#80AFFF]">
                    {feature.status}
                  </span>
                </button>
              ))}
            </div>

            <footer className="pb-5">
              <p className="py-2 text-[12px] text-[#9FB0CA]">Privacy first</p>
              <p className="text-[12px] leading-[18px] text-[#8392AB]">
                Call access, microphone and contacts will only be requested when you enable the related feature.
              </p>
            </footer>
          </div>
        )}

        {selectedTab === 'calls' && (
          <CallsView
            settings={settings}
            onUpdateSettings={updateSettings}
            onSaveCallRecord={saveCallRecord}
            onOpenSettings={() => setSelectedTab('settings')}
          />
        )}

        {selectedTab === 'history' && (
          <HistoryView
            records={callHistory}
            isAssistantActive={settings.autoPickupEnabled}
            onDeleteRecord={deleteCallRecord}
            onClearAll={clearCallHistory}
            onStartTestCall={() => setSelectedTab('calls')}
          />
        )}

        {selectedTab === 'settings' && (
          <SettingsView
            settings={settings}
            onUpdateSettings={updateSettings}
          />
        )}
      </main>

      <nav
        aria-label="Primary navigation"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-[#1A2740]/80 bg-[#0D1524]"
      >
        <div className="mx-auto flex h-[72px] max-w-[540px] items-center justify-around px-2">
          {NAV_ITEMS.map((item) => {
            const isSelected = selectedTab === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedTab(item.id)}
                className="flex min-w-[68px] flex-col items-center justify-center gap-1 py-1.5 focus:outline-none"
                aria-current={isSelected ? 'page' : undefined}
              >
                <span
                  className={`flex h-8 w-16 items-center justify-center rounded-full transition-colors ${
                    isSelected
                      ? 'bg-[#1D3154] text-[#75A5FF]'
                      : 'text-[#8392AB] hover:text-[#AAB8D0]'
                  }`}
                >
                  {item.icon}
                </span>
                <span
                  className={`text-[12px] font-medium ${
                    isSelected ? 'text-white' : 'text-[#8392AB]'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

export default App
