import { useState } from 'react'
import { ChevronDown, ChevronUp, History, Phone, ShieldAlert, Trash2 } from 'lucide-react'
import type { CallRecord } from '../types.ts'
import { Header } from './Header.tsx'

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}m ${secs}s`
}

function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function HistoryView({
  records,
  isAssistantActive,
  onDeleteRecord,
  onClearAll,
  onStartTestCall,
}: {
  records: CallRecord[]
  isAssistantActive: boolean
  onDeleteRecord: (id: string) => void
  onClearAll: () => void
  onStartTestCall: () => void
}) {
  const [expandedId, setExpandedId] = useState<string | null>(
    records[0]?.id ?? null,
  )

  return (
    <div className="flex flex-col gap-[18px]">
      <Header isAssistantActive={isAssistantActive} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold text-white">Recent conversations</h1>
          <p className="text-[12px] text-[#8392AB]">
            AI call summaries and transcripts from handled calls
          </p>
        </div>
        {records.length > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="rounded-[12px] border border-[#22324C] bg-[#111A2A] px-3 py-1.5 text-[11px] font-semibold text-[#9BAAC2] hover:border-[#354E75] hover:text-white"
          >
            Clear all
          </button>
        )}
      </div>

      {records.length === 0 ? (
        <section className="flex flex-col items-center rounded-[24px] border border-[#22324C] bg-[#111A2A] px-6 py-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-[16px] bg-[#1B3154]">
            <History className="h-7 w-7 text-[#83AEFF]" />
          </div>
          <h2 className="mt-4 text-[17px] font-semibold text-white">
            No calls handled yet
          </h2>
          <p className="mt-1.5 max-w-xs text-[13px] leading-relaxed text-[#9BAAC2]">
            Trigger an inbound call in the Calls tab to hear CHARLOK answer, talk with the caller, and save a summary here.
          </p>
          <button
            type="button"
            onClick={onStartTestCall}
            className="mt-5 flex h-11 items-center justify-center gap-2 rounded-[14px] bg-[#4F8CFF] px-5 text-[14px] font-semibold text-white hover:bg-[#3F7DF0]"
          >
            <Phone className="h-4 w-4" />
            <span>Open Calls</span>
          </button>
        </section>
      ) : (
        <div className="flex flex-col gap-3.5">
          {records.map((record) => {
            const isExpanded = expandedId === record.id
            const urgencyStyle =
              record.urgency === 'high'
                ? 'bg-[#3D1D24] text-[#FF8A9B]'
                : record.urgency === 'medium'
                  ? 'bg-[#382C16] text-[#F7B955]'
                  : 'bg-[#15243B] text-[#80AFFF]'

            return (
              <article
                key={record.id}
                className="rounded-[20px] border border-[#22324C] bg-[#111A2A] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-[16px] font-semibold text-white">
                        {record.callerName}
                      </h2>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${urgencyStyle}`}
                      >
                        {record.urgency}
                      </span>
                      {record.isSpamLikely && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#3A1B23] px-2.5 py-0.5 text-[10px] font-bold text-[#FF8A9B]">
                          <ShieldAlert className="h-3 w-3" />
                          Spam
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[12px] text-[#8392AB]">
                      {record.callerNumber} · {formatDateTime(record.startedAt)} ·{' '}
                      {record.outcome === 'declined'
                        ? 'Declined'
                        : formatDuration(record.durationSeconds)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteRecord(record.id)}
                    aria-label="Delete call record"
                    className="rounded-lg p-1.5 text-[#6E7E98] hover:bg-[#1B2A44] hover:text-[#FF8A9B]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-3 rounded-[14px] bg-[#0D1524] p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#80AFFF]">
                    {record.callerIntent}
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-[#D1DDF3]">
                    {record.summary}
                  </p>
                  <p className="mt-2 text-[12px] text-[#9BAAC2]">
                    <span className="font-semibold text-[#EAF0FF]">Next step:</span>{' '}
                    {record.recommendedAction}
                  </p>
                </div>

                {record.transcript.length > 0 && (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : record.id)
                      }
                      className="flex items-center gap-1.5 text-[12px] font-semibold text-[#80AFFF] hover:underline"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="h-4 w-4" />
                          <span>Hide transcript</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4" />
                          <span>
                            View transcript ({record.transcript.length} entries)
                          </span>
                        </>
                      )}
                    </button>

                    {isExpanded && (
                      <div className="mt-2.5 flex flex-col gap-2 rounded-[14px] border border-[#1E2D47] bg-[#080D18] p-3">
                        {record.transcript.map((item) => (
                          <div key={item.id} className="text-[12px] leading-relaxed">
                            <span
                              className={`font-semibold ${
                                item.speaker === 'assistant'
                                  ? 'text-[#75A5FF]'
                                  : item.speaker === 'caller'
                                    ? 'text-[#5CE0A8]'
                                    : 'text-[#8392AB]'
                              }`}
                            >
                              {item.speaker === 'assistant'
                                ? 'CHARLOK'
                                : item.speaker === 'caller'
                                  ? 'Caller'
                                  : 'System'}
                              :
                            </span>{' '}
                            <span className="text-[#D1DDF3]">{item.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
