'use client'

import { useState, useRef, useCallback } from 'react'

interface EventRecord {
  num: number
  timeStr: string
  rawTime: number
  intervalSec: number | null
}

interface Stats {
  mean: number
  std: number
  min: number
  max: number
  q1: number | null
  q2: number | null
  q3: number | null
}

function formatTime(date: Date): string {
  let h = date.getHours()
  const m = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  const ap = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${String(h).padStart(2, '0')}:${m}:${s} ${ap}`
}

function quartile(sorted: number[], p: number): number {
  const n = sorted.length
  const pos = p * (n - 1)
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

function computeStats(intervals: number[], final: boolean): Stats | null {
  if (intervals.length < 2) return null
  const n = intervals.length
  const mean = intervals.reduce((a, b) => a + b, 0) / n
  const variance = intervals.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)
  const std = Math.sqrt(variance)
  const sorted = [...intervals].sort((a, b) => a - b)
  return {
    mean,
    std,
    min: sorted[0],
    max: sorted[n - 1],
    q1: final ? quartile(sorted, 0.25) : null,
    q2: final ? quartile(sorted, 0.5) : null,
    q3: final ? quartile(sorted, 0.75) : null,
  }
}

export default function InterArrivalSampler() {
  const [location, setLocation] = useState('')
  const [eventDesc, setEventDesc] = useState('')
  const [countInput, setCountInput] = useState('')
  const [setupError, setSetupError] = useState('')
  const [sessionSaved, setSessionSaved] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [records, setRecords] = useState<EventRecord[]>([])
  const [isDone, setIsDone] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  const intervals = records
    .filter(r => r.intervalSec !== null)
    .map(r => r.intervalSec as number)

  const stats = computeStats(intervals, isDone)

  const handleSave = useCallback(() => {
    if (!location.trim()) { setSetupError('Please enter the measurement location.'); return }
    if (!eventDesc.trim()) { setSetupError('Please describe the event.'); return }
    const count = parseInt(countInput, 10)
    if (!count || count < 1) { setSetupError('Please enter a valid number of observations.'); return }
    setTotalCount(count)
    setSessionSaved(true)
    setSetupError('')
  }, [location, eventDesc, countInput])

  const handleRecord = useCallback(() => {
    if (!sessionSaved || isDone) return
    const now = new Date()
    setRecords(prev => {
      const last = prev[prev.length - 1]
      const intervalSec = last ? (now.getTime() - last.rawTime) / 1000 : null
      const next: EventRecord = {
        num: prev.length + 1,
        timeStr: formatTime(now),
        rawTime: now.getTime(),
        intervalSec,
      }
      const updated = [...prev, next]
      if (updated.length >= totalCount) setIsDone(true)
      setTimeout(() => {
        if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
      }, 0)
      return updated
    })
  }, [sessionSaved, isDone, totalCount])

  const handleExport = useCallback(() => {
    const ivs = records
      .filter(r => r.intervalSec !== null)
      .map(r => r.intervalSec as number)
    const n = ivs.length
    const mean = ivs.reduce((a, b) => a + b, 0) / n
    const std = Math.sqrt(ivs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1))
    const sorted = [...ivs].sort((a, b) => a - b)
    const q = (p: number) => {
      const pos = p * (n - 1)
      const lo = Math.floor(pos), hi = Math.ceil(pos)
      return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
    }

    const lines: string[] = []
    lines.push('=== SESSION INFO ===')
    lines.push(location)
    lines.push(eventDesc)
    lines.push(String(totalCount))
    lines.push('')
    lines.push('=== RAW CLOCK TIMES & INTER-ARRIVAL TIMES ===')
    records.forEach((r, i) => {
      const iv = i === 0 ? '-' : `${(r.intervalSec as number).toFixed(2)} sec`
      lines.push(`Record #${r.num}  |  ${r.timeStr}  |  ${iv}`)
    })
    lines.push('')
    lines.push('=== INTER-ARRIVAL TIMES (seconds only) ===')
    ivs.forEach((v, i) => lines.push(`${i + 1}: ${v.toFixed(2)}`))
    lines.push('')
    lines.push('=== DESCRIPTIVE STATISTICS ===')
    lines.push(`n (intervals) : ${n}`)
    lines.push(`Mean          : ${mean.toFixed(4)} sec`)
    lines.push(`Std Dev       : ${std.toFixed(4)} sec`)
    lines.push(`Min           : ${sorted[0].toFixed(4)} sec`)
    lines.push(`Q1            : ${q(0.25).toFixed(4)} sec`)
    lines.push(`Q2 (Median)   : ${q(0.5).toFixed(4)} sec`)
    lines.push(`Q3            : ${q(0.75).toFixed(4)} sec`)
    lines.push(`Max           : ${sorted[n - 1].toFixed(4)} sec`)

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `set2_${location.replace(/\s+/g, '_')}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }, [records, location, eventDesc, totalCount])

  const remaining = totalCount - records.length

  const StatValue = ({ value, highlight }: { value: number | null; highlight?: boolean }) =>
    value === null ? (
      <span className="font-mono text-lg font-bold text-dim">—</span>
    ) : (
      <span className={`font-mono text-lg font-bold ${highlight ? 'text-neon' : 'text-text'}`}>
        {value.toFixed(4)}s
      </span>
    )

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      {/* 3-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-border">

        {/* ── Col 1: Setup & Record ── */}
        <div className="p-5 flex flex-col gap-5">
          {/* Setup */}
          <div>
            <p className="font-mono text-xs text-dim uppercase tracking-widest mb-4">Session Setup</p>
            <div className="space-y-3">
              <div>
                <label className="block font-mono text-xs text-muted mb-1.5">Where did you measure?</label>
                <input
                  type="text"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                  disabled={sessionSaved}
                  placeholder="e.g. Library entrance"
                  className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-border text-text text-sm font-sans placeholder:text-dim focus:outline-none focus:border-neon/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                />
              </div>
              <div>
                <label className="block font-mono text-xs text-muted mb-1.5">What counted as an "event"?</label>
                <input
                  type="text"
                  value={eventDesc}
                  onChange={e => setEventDesc(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                  disabled={sessionSaved}
                  placeholder="e.g. A person walking through the door"
                  className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-border text-text text-sm font-sans placeholder:text-dim focus:outline-none focus:border-neon/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                />
              </div>
              <div>
                <label className="block font-mono text-xs text-muted mb-1.5">How many observations?</label>
                <input
                  type="number"
                  value={countInput}
                  onChange={e => setCountInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                  disabled={sessionSaved}
                  placeholder="e.g. 100"
                  min={1}
                  className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-border text-text text-sm font-mono placeholder:text-dim focus:outline-none focus:border-neon/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                />
              </div>
              {setupError && <p className="font-mono text-xs text-neon-red">{setupError}</p>}
              <button
                onClick={handleSave}
                disabled={sessionSaved}
                className="px-4 py-2 rounded-lg bg-surface-2 border border-border text-text text-sm font-mono font-semibold hover:border-border-bright hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Save &amp; Start
              </button>
            </div>
          </div>

          {/* Record button */}
          <button
            onClick={handleRecord}
            disabled={!sessionSaved || isDone}
            className="w-full py-3 rounded-xl bg-neon/20 border border-neon/40 text-neon font-mono font-bold text-sm hover:bg-neon/30 active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            {isDone ? 'Session Complete' : 'Record Event'}
          </button>

          {/* Progress */}
          <div className="flex gap-4 font-mono text-xs text-muted">
            <span>Recorded: <span className="text-text font-bold">{records.length}</span></span>
            <span>Left: <span className="text-neon font-bold">{sessionSaved ? remaining : '—'}</span></span>
            <span>Total: <span className="text-text font-bold">{sessionSaved ? totalCount : '—'}</span></span>
          </div>
        </div>

        {/* ── Col 2: Stats & Export ── */}
        <div className="p-5 flex flex-col gap-5">
          <div>
            <p className="font-mono text-xs text-dim uppercase tracking-widest mb-4">Descriptive Statistics</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              {[
                { label: 'Mean',        value: stats?.mean ?? null },
                { label: 'Std Dev',     value: stats?.std ?? null },
                { label: 'Min',         value: stats?.min ?? null },
                { label: 'Max',         value: stats?.max ?? null },
                { label: 'Q1',          value: stats?.q1 ?? null,  highlight: isDone },
                { label: 'Q2 (Median)', value: stats?.q2 ?? null,  highlight: isDone },
                { label: 'Q3',          value: stats?.q3 ?? null,  highlight: isDone },
              ].map(({ label, value, highlight }) => (
                <div key={label} className="flex flex-col gap-1">
                  <span className="font-mono text-[10px] text-dim uppercase tracking-wider">{label}</span>
                  <StatValue value={value} highlight={highlight} />
                </div>
              ))}
            </div>
          </div>

          {isDone && (
            <button
              onClick={handleExport}
              className="mt-auto px-4 py-2.5 rounded-lg border border-neon-green/40 bg-neon-green/10 text-neon-green font-mono text-sm font-semibold hover:bg-neon-green/20 transition-all"
            >
              Export All Data
            </button>
          )}
        </div>

        {/* ── Col 3: Event Log ── */}
        <div className="p-5 flex flex-col min-h-0">
          <p className="font-mono text-xs text-dim uppercase tracking-widest mb-3 flex-shrink-0">Recorded Events</p>
          <div className="grid grid-cols-[28px_1fr_68px] gap-1 pb-2 mb-2 border-b border-border font-mono text-[10px] text-dim uppercase tracking-wider flex-shrink-0">
            <span>#</span>
            <span>Clock Time</span>
            <span className="text-right">Interval</span>
          </div>
          <div
            ref={listRef}
            className="flex-1 overflow-y-auto space-y-1.5 min-h-[160px] max-h-[340px] pr-1"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#7c6af7 #1e1e3a' }}
          >
            {records.length === 0 ? (
              <p className="font-mono text-xs text-dim pt-4 text-center">No events recorded yet</p>
            ) : (
              records.map(r => (
                <div
                  key={r.num}
                  className="grid grid-cols-[28px_1fr_68px] items-center gap-1 bg-surface-2 rounded-lg px-2 py-2 font-mono text-xs animate-[slide-up_0.2s_ease-out]"
                >
                  <span className="text-neon font-bold">#{r.num}</span>
                  <span className="text-muted">{r.timeStr}</span>
                  <span className={`text-right font-bold ${r.intervalSec === null ? 'text-dim' : 'text-neon-green'}`}>
                    {r.intervalSec !== null ? `${r.intervalSec.toFixed(2)}s` : '—'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
