import { useState } from 'react'
import { Download, Smartphone, X } from 'lucide-react'
import { usePWAInstall } from '../hooks/usePWAInstall.ts'
import { downloadStarterApkInChunks } from '../utils/apkDownload.ts'

export function PWAInstallButton({
  variant = 'card',
}: {
  variant?: 'compact' | 'card'
}) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall()
  const [showGuide, setShowGuide] = useState(false)

  if (isInstalled) {
    return null
  }

  if (variant === 'compact') {
    return (
      <>
        <button
          type="button"
          onClick={() => {
            if (isInstallable) {
              void install()
            } else {
              setShowGuide(true)
            }
          }}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#1B3154] px-3 py-1.5 text-[11px] font-bold text-[#9FC2FF] transition-colors hover:bg-[#24406D] hover:text-white"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Install</span>
        </button>

        {showGuide && (
          <InstallGuideModal
            isIOS={isIOS}
            onClose={() => setShowGuide(false)}
          />
        )}
      </>
    )
  }

  return (
    <>
      <section className="rounded-[20px] border border-[#22324C] bg-[#111A2A] p-[17px]">
        <div className="flex items-center gap-3.5">
          <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[14px] bg-[#1B3154]">
            <Smartphone className="h-5 w-5 text-[#83AEFF]" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-semibold text-white">
              Install CHARLOK on your phone
            </h3>
            <p className="mt-1 text-[12px] leading-[16px] text-[#9BAAC2]">
              {isInstallable
                ? 'Install CHARLOK as an app on your home screen.'
                : 'Add CHARLOK to your phone home screen for quick app access.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (isInstallable) {
                void install()
              } else {
                setShowGuide(true)
              }
            }}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-[12px] bg-[#4F8CFF] px-3.5 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-[#3F7DF0]"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Install</span>
          </button>
        </div>
      </section>

      {showGuide && (
        <InstallGuideModal isIOS={isIOS} onClose={() => setShowGuide(false)} />
      )}
    </>
  )
}

function InstallGuideModal({
  isIOS,
  onClose,
}: {
  isIOS: boolean
  onClose: () => void
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5">
      <div className="w-full max-w-sm rounded-[24px] border border-[#22324C] bg-[#111A2A] p-6 text-left shadow-2xl">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[18px] font-bold text-white">
            {isIOS ? 'Install on iPhone / iPad' : 'Install on Android / Mobile'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close install guide"
            className="rounded-lg p-1 text-[#8392AB] hover:bg-[#1A2740] hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {isIOS ? (
          <ol className="mt-3 list-decimal space-y-2 pl-4 text-[13px] leading-relaxed text-[#D1DDF3]">
            <li>
              Tap the <strong>Share</strong> button in Safari&apos;s toolbar.
            </li>
            <li>
              Scroll down and tap <strong>Add to Home Screen</strong>.
            </li>
            <li>
              Tap <strong>Add</strong> to install CHARLOK on your home screen.
            </li>
          </ol>
        ) : (
          <ol className="mt-3 list-decimal space-y-2 pl-4 text-[13px] leading-relaxed text-[#D1DDF3]">
            <li>
              Open this app using AI Studio&apos;s <strong>Open in new tab</strong> button in <strong>Chrome</strong>.
            </li>
            <li>
              Tap the <strong>⋮ (3-dots menu)</strong> in the top-right corner.
            </li>
            <li>
              Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.
            </li>
          </ol>
        )}

        {!isIOS && (
          <div className="mt-4 border-t border-[#22324C] pt-4">
            <p className="text-[12px] text-[#9BAAC2]">
              Or download the Android APK / source project:
            </p>
            {apkError && (
              <p className="mt-1.5 text-[12px] text-[#FF8A9B]">{apkError}</p>
            )}
            {apkReady && (
              <div className="mt-2 rounded-[12px] border border-[#2B5D4A] bg-[#112A22] p-2.5 text-[12px] text-[#8DE6C2]">
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
            <div className="mt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void handleDownloadApk()}
                disabled={apkProgress !== null}
                className="flex h-10 w-full items-center justify-center rounded-[12px] bg-[#4F8CFF] text-[13px] font-semibold text-white hover:bg-[#3F7DF0] disabled:opacity-60"
              >
                {apkProgress !== null
                  ? `Downloading APK… ${apkProgress}%`
                  : 'Download Starter APK (54 MB)'}
              </button>
              <a
                href="/download/charlok-android-source.zip"
                download="charlok-android-source.zip"
                className="flex h-10 w-full items-center justify-center rounded-[12px] border border-[#22324C] bg-[#0D1524] text-[13px] font-semibold text-[#9FC2FF] hover:border-[#354E75]"
              >
                Download Android Source (.zip)
              </a>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-3 flex h-11 w-full items-center justify-center rounded-[14px] bg-[#1A2740] text-[14px] font-semibold text-[#EAF0FF] hover:bg-[#223252]"
        >
          Got it
        </button>
      </div>
    </div>
  )
}
