import { PWAInstallButton } from './PWAInstallButton.tsx'

export function Header({ isAssistantActive }: { isAssistantActive: boolean }) {
  return (
    <header className="flex w-full items-center gap-2 pt-3.5">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#4F8CFF] to-[#63D5FF]">
        <span className="text-[23px] font-black leading-none text-white">C</span>
      </div>
      <div className="ml-1 min-w-0 flex-1">
        <div className="text-[19px] font-extrabold leading-tight tracking-[1.2px] text-white">
          CHARLOK
        </div>
        <div className="text-[9px] font-medium uppercase leading-tight tracking-[1.6px] text-[#8193B0]">
          AI CALL ASSISTANT
        </div>
      </div>
      <PWAInstallButton variant="compact" />
      <div
        className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-[10px] font-bold tracking-wider ${
          isAssistantActive
            ? 'bg-[#123328] text-[#5CE0A8]'
            : 'bg-[#15243B] text-[#9FC2FF]'
        }`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            isAssistantActive ? 'bg-[#5CE0A8]' : 'bg-[#9FC2FF]'
          }`}
        />
        <span>{isAssistantActive ? 'ACTIVE' : 'READY'}</span>
      </div>
    </header>
  )
}
