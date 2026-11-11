import { useState, type ReactNode } from 'react'
import { Icon } from './Icon'
import { Rich } from '../lib/rich'
import type { AgentAnswer, AnswerAction, AnswerBlock, BpReading, SourceRef, Suggestion } from '../services/types'
import { monthDay, monthDayYear } from '../lib/format'
import { SourceSheet } from './SourceSheet'

export function AgentMark({ size = 28 }: { size?: 28 | 24 }) {
  return (
    <div className={`agent-mark ${size === 24 ? 'agent-mark--24' : ''}`} aria-hidden="true">
      <Icon name="spark" size={size === 24 ? 14 : 16} color="#FFFFFF" />
    </div>
  )
}

/** Agent line on a card (family home nudge). */
export function AgentNudge({ text }: { text: string }) {
  return (
    <div className="nudge">
      <AgentMark />
      <p className="p" style={{ marginTop: 3 }}>
        <span className="sr-only">Casanté agent: </span>
        <Rich text={text} />
      </p>
    </div>
  )
}

/** Inline agent remark (no bubble), e.g. "I'll check it against all 4 of Mom's medications". */
export function AgentInline({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14, lineHeight: 1.45 }}>
      <AgentMark size={24} />
      <span style={{ marginTop: 2 }}>{children}</span>
    </div>
  )
}

export function UserMessage({ text }: { text: string }) {
  return (
    <div className="msg-user">
      <span className="sr-only">You asked: </span>
      {text}
    </div>
  )
}

export function Typing() {
  return (
    <div className="msg-agent" role="status" aria-label="Casanté is looking through the records">
      <AgentMark />
      <div className="typing" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>
  )
}

/* ---------------- blocks ---------------- */

function BpTrend({ trend, current }: { trend: BpReading[]; current: BpReading }) {
  const sys = trend.map((r) => r.systolic)
  const dia = trend.map((r) => r.diastolic)
  const sMin = Math.min(...sys)
  const sSpan = Math.max(...sys) - sMin || 1
  const dMin = Math.min(...dia)
  const dSpan = Math.max(...dia) - dMin || 1
  const xs = trend.length === 1 ? [130] : trend.map((_, i) => 20 + (i * 220) / (trend.length - 1))
  const ys = (v: number) => 38 - ((v - sMin) / sSpan) * 24
  const yd = (v: number) => 48 - ((v - dMin) / dSpan) * 4
  const label = `Blood pressure at the last ${trend.length} visits: ${trend
    .map((r) => `${monthDay(r.takenAt)} ${r.systolic} over ${r.diastolic}`)
    .join(', ')}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 300 }}>
      <svg width="260" height="64" viewBox="0 0 260 64" role="img" aria-label={label}>
        <line x1="0" y1="56" x2="260" y2="56" stroke="#E4E4E4" strokeWidth="1" />
        <polyline points={trend.map((r, i) => `${xs[i]},${ys(r.systolic)}`).join(' ')} fill="none" stroke="#0C4668" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={trend.map((r, i) => `${xs[i]},${yd(r.diastolic)}`).join(' ')} fill="none" stroke="#23B5AF" strokeWidth="2.5" strokeDasharray="4 4" strokeLinecap="round" />
        {trend.map((r, i) => (
          <circle key={`s${r.id}`} cx={xs[i]} cy={ys(r.systolic)} r={r.id === current.id ? 5 : 4} fill="#0C4668" />
        ))}
        {trend.map((r, i) => (
          <circle key={`d${r.id}`} cx={xs[i]} cy={yd(r.diastolic)} r={r.id === current.id ? 4 : 3.5} fill="#23B5AF" />
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#535458', padding: '0 2px', gap: 6 }}>
        {trend.map((r) => (
          <span key={r.id} style={r.id === current.id ? { fontWeight: 600, color: '#0C4668' } : undefined}>
            {monthDay(r.takenAt)} · {r.systolic}/{r.diastolic}
          </span>
        ))}
      </div>
    </div>
  )
}

function Block({ block, first }: { block: AnswerBlock; first: boolean }) {
  const firstCls = first ? ' bubble--first' : ''
  switch (block.type) {
    case 'text':
      return block.style === 'tint' ? (
        <div className={`bubble bubble--tint${firstCls}`}>
          <Rich text={block.text} />
        </div>
      ) : (
        <div className={`block-card${firstCls}`} style={{ fontSize: 15, lineHeight: 1.5 }}>
          <div>
            <Rich text={block.text} />
          </div>
        </div>
      )

    case 'big-value':
      return (
        <div className={`block-card${firstCls}`} style={{ gap: 8 }}>
          <span className="big-value" style={{ fontSize: 40, lineHeight: 1 }}>
            {block.value}
          </span>
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5 }}>
            <Rich text={block.text} />
          </p>
        </div>
      )

    case 'bp-reading':
      return (
        <div className={`block-card${firstCls}`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="small muted">{block.label}</span>
            <span className="big-value" style={{ fontSize: 36, lineHeight: 1.1 }}>
              {block.reading.systolic}/{block.reading.diastolic}{' '}
              <span style={{ fontSize: 15, fontWeight: 400, color: '#535458', fontFamily: 'var(--font-body)' }}>{block.reading.unit}</span>
            </span>
          </div>
          <span style={{ fontSize: 14 }}>
            {monthDayYear(block.reading.takenAt)} · {block.reading.facility}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="small muted">{block.trendLabel}</span>
            <BpTrend trend={block.trend} current={block.reading} />
          </div>
        </div>
      )

    case 'timeline':
      return (
        <div className={`block-card${firstCls}`} style={{ gap: 14 }}>
          {block.entries.map((e, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {i > 0 && <div className="divider" />}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span className="eyebrow">{e.eyebrow}</span>
                <span className="h2" style={{ fontSize: 18 }}>
                  {e.place}
                </span>
                <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5 }}>{e.text}</p>
              </div>
              {e.quote && (
                <div style={{ background: '#F4F4F4', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 12, color: '#535458' }}>{e.quote.label}</span>
                  <span style={{ fontSize: 14 }}>{e.quote.text}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )

    case 'dose-log': {
      const takenCount = block.days.filter((d) => d.taken).length
      return (
        <div className={`block-card${firstCls}`} style={{ gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="big-value" style={{ fontSize: 30, lineHeight: 1.1 }}>
              {block.headline}
            </span>
            <span style={{ fontSize: 15 }}>{block.detail}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="small muted">{block.weekLabel}</span>
            <div
              role="img"
              aria-label={`${takenCount} of ${block.days.length} evening doses taken: ${block.days.map((d) => `${d.label} ${d.taken ? 'taken' : 'missed'}`).join(', ')}`}
              style={{ display: 'grid', gridTemplateColumns: `repeat(${block.days.length}, minmax(0, 1fr))`, gap: 4, textAlign: 'center', fontSize: 12, color: '#535458', maxWidth: 340 }}
            >
              {block.days.map((d, i) => (
                <div
                  key={i}
                  aria-hidden="true"
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, ...(d.latest ? { color: '#0C4668', fontWeight: 600 } : {}) }}
                >
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      background: d.taken ? '#0C4668' : '#FFFFFF',
                      border: d.taken ? 0 : '2px solid #E4E4E4',
                      boxShadow: d.latest ? '0 0 0 3px #A5D7C7' : undefined,
                    }}
                  />
                  {d.label}
                </div>
              ))}
            </div>
            <span className="small muted">{block.summary}</span>
          </div>
          <div className="divider" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 15 }}>
            <span>
              <Rich text={block.medication.title} />
            </span>
            {block.medication.lines.map((l) => (
              <span key={l} style={{ fontSize: 14, color: '#535458' }}>
                {l}
              </span>
            ))}
          </div>
        </div>
      )
    }

    case 'list':
      return (
        <div className={`block-card${firstCls}`} style={{ gap: 10 }}>
          {block.title && <span className="h2">{block.title}</span>}
          {block.items.map((it, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 1, fontSize: 15 }}>
              <span>
                <Rich text={it.primary} />
              </span>
              {it.secondary && <span className="small muted">{it.secondary}</span>}
            </div>
          ))}
        </div>
      )

    case 'note':
      return (
        <div className="note">
          <Rich text={block.text} />
        </div>
      )
  }
}

/* ---------------- sources and suggestions ---------------- */

export function SourceChips({ memberId, sources }: { memberId: string; sources: SourceRef[] }) {
  const [open, setOpen] = useState<SourceRef | null>(null)
  if (!sources.length) return null
  return (
    <>
      <div className="chips" aria-label="Sources">
        {sources.map((s) => (
          <button key={s.recordId} className="chip chip--source" onClick={() => setOpen(s)} aria-label={`Source: ${s.label}`}>
            <Icon name="doc" size={14} color="#0C4668" />
            {s.label}
          </button>
        ))}
      </div>
      {open && <SourceSheet memberId={memberId} source={open} onClose={() => setOpen(null)} />}
    </>
  )
}

export function SuggestionChips({ items, onPick, disabled }: { items: Suggestion[]; onPick: (s: Suggestion) => void; disabled?: boolean }) {
  if (!items.length) return null
  return (
    <div className="chips" aria-label="Suggested questions">
      {items.map((s) => (
        <button key={s.label} className="chip" onClick={() => onPick(s)} disabled={disabled}>
          {s.label}
        </button>
      ))}
    </div>
  )
}

/* ---------------- full answer ---------------- */

export function AgentAnswerView({
  answer,
  memberId,
  onAction,
}: {
  answer: AgentAnswer
  memberId: string
  onAction: (a: AnswerAction) => void
}) {
  const inline = answer.actions.filter((a) => a.style !== 'dock')
  return (
    <div className="msg-agent">
      <AgentMark />
      <div className="msg-agent__body">
        <span className="sr-only">Casanté answered:</span>
        {answer.blocks.map((b, i) => (
          <Block key={i} block={b} first={i === 0} />
        ))}
        <SourceChips memberId={memberId} sources={answer.sources} />
        {inline.length > 0 && (
          <div className="btn-row" style={{ flexWrap: 'wrap' }}>
            {inline.map((a) => (
              <button
                key={a.kind}
                className={`btn ${a.style === 'primary' ? 'btn--primary' : 'btn--ghost-outline btn--shrink'}`}
                onClick={() => onAction(a)}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
