/** Shared building blocks for the UAE Deal Toolkit calculators. */
import { useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { Check, Copy, Printer } from 'lucide-react'
import { AnimatedNumber, Card, SWK, aed } from '../../../swk/ui'

export const SIGNATURE = '\n— SWK Properties · RERA ORN 51517\n_Indicative figures; subject to DLD / bank / developer confirmation._'

export function Select({ label, value, onChange, options, hint }: { label: string; value: string; onChange: (v: string) => void; options: (string | { value: string; label: string })[]; hint?: ReactNode }) {
  return (
    <label className="swk-field">
      <span className="swk-field-label">{label}</span>
      <span className="swk-field-box">
        <select value={value} onChange={e => onChange(e.target.value)}>
          {options.map(o => typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </span>
      {hint && <span className="swk-field-hint">{hint}</span>}
    </label>
  )
}

export function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="swk-field">
      <span className="swk-field-label">{label}</span>
      <span className="swk-field-box"><input type="date" value={value} onChange={e => onChange(e.target.value)} /></span>
    </label>
  )
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="swk-toggle justify-between w-full rounded-xl border border-[#efe9dc] bg-[#fbf9f5] px-3 py-2.5">
      <span className="min-w-0"><span className="block">{label}</span>{hint && <span className="block text-[11.5px] text-muted font-normal">{hint}</span>}</span>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} aria-label={label} />
    </label>
  )
}

/** Copy (WhatsApp-ready) + print actions. */
export function ToolActions({ summary }: { summary: () => string }) {
  const [done, setDone] = useState(false)
  const copy = async () => {
    const text = summary() + SIGNATURE
    try { await navigator.clipboard.writeText(text) } catch {
      const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove()
    }
    setDone(true); setTimeout(() => setDone(false), 1800)
  }
  return (
    <div className="flex gap-2 swk-no-print">
      <motion.button type="button" whileTap={{ scale: 0.96 }} onClick={copy} className="swk-btn swk-btn-gold !h-9" aria-live="polite">
        {done ? <Check size={15} /> : <Copy size={15} />}{done ? 'Copied' : 'Copy summary'}
      </motion.button>
      <button type="button" onClick={() => window.print()} className="swk-btn swk-btn-ghost !h-9" aria-label="Print"><Printer size={15} /><span className="hidden sm:inline">Print</span></button>
    </div>
  )
}

/** Two-pane tool layout: inputs left, results right. */
export function ToolLayout({ title, subtitle, inputs, children, summary }: { title: string; subtitle: string; inputs: ReactNode; children: ReactNode; summary: () => string }) {
  return (
    <div className="grid gap-4 grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-start">
      <Card title="Inputs" subtitle={subtitle} className="lg:sticky lg:top-4">
        <div className="grid gap-3.5">{inputs}</div>
      </Card>
      <Card title={title} subtitle="Updates live as you type" actions={<ToolActions summary={summary} />}>
        <div className="space-y-5">{children}</div>
      </Card>
    </div>
  )
}

/** Big hero figure for the primary result. */
export function Hero({ label, value, format = v => aed(v), sub, tone = 'navy' }: { label: string; value: number; format?: (v: number) => string; sub?: ReactNode; tone?: 'navy' | 'champ' | 'oasis' | 'dune' }) {
  const bg = tone === 'navy' ? `linear-gradient(140deg, ${SWK.navy}, ${SWK.midnight})` : tone === 'champ' ? 'linear-gradient(140deg, #fbf6ec, #f1e6cf)' : tone === 'oasis' ? 'linear-gradient(140deg, #1f7a7a, #145252)' : 'linear-gradient(140deg, #c4492f, #8f3220)'
  const dark = tone !== 'champ'
  return (
    <motion.div layout className="relative overflow-hidden rounded-2xl p-5" style={{ background: bg, color: dark ? '#fff' : SWK.ink }}>
      <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full opacity-20" style={{ background: `radial-gradient(circle, ${SWK.champ}, transparent 70%)` }} />
      <div className="text-[11.5px] uppercase tracking-[.14em] font-semibold" style={{ color: dark ? '#c9d4e8' : SWK.muted }}>{label}</div>
      <div className="font-display text-[34px] sm:text-[40px] font-semibold leading-tight mt-1"><AnimatedNumber value={value} format={format} duration={0.8} /></div>
      {sub && <div className="text-[12.5px] mt-1" style={{ color: dark ? '#c9d4e8' : SWK.muted }}>{sub}</div>}
    </motion.div>
  )
}

export function MiniStat({ label, value, format = v => aed(v), accent }: { label: string; value: number; format?: (v: number) => string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-[#efe9dc] bg-[#fbf9f5] p-3 min-w-0">
      <div className="text-[10.5px] uppercase tracking-wider font-semibold text-muted truncate">{label}</div>
      <div className="font-display text-[19px] font-semibold truncate" style={{ color: accent ?? SWK.ink }}><AnimatedNumber value={value} format={format} duration={0.7} /></div>
    </div>
  )
}

/** Animated donut that re-animates on every value change. */
export function Donut({ parts, size = 190, stroke = 22, center }: { parts: { label: string; value: number; color: string }[]; size?: number; stroke?: number; center?: ReactNode }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r
  const total = parts.reduce((s, p) => s + Math.max(0, p.value), 0) || 1
  let off = 0
  return (
    <div className="relative flex-none" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={parts.map(p => `${p.label} ${Math.round((p.value / total) * 100)}%`).join(', ')}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#efe9dc" strokeWidth={stroke} fill="none" />
        {parts.map(p => {
          const len = (Math.max(0, p.value) / total) * c
          const el = <motion.circle key={p.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={p.color} strokeWidth={stroke}
            initial={{ strokeDasharray: `0 ${c}`, strokeDashoffset: -off }} animate={{ strokeDasharray: `${Math.max(0, len - 1.5)} ${c}`, strokeDashoffset: -off }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} />
          off += len
          return el
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center px-6">{center}</div>
    </div>
  )
}

/** Live ring (re-animates on change). */
export function LiveRing({ value, max = 100, size = 120, stroke = 11, color = SWK.navy, label, sub }: { value: number; max?: number; size?: number; stroke?: number; color?: string; label: ReactNode; sub?: ReactNode }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, v = Math.max(0, Math.min(1, value / max))
  return (
    <div className="relative grid place-items-center flex-none" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#ece5d6" strokeWidth={stroke} fill="none" />
        <motion.circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={c}
          initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - v) }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center leading-tight">
        <div><div className="font-display font-semibold text-ink" style={{ fontSize: size * 0.2 }}>{label}</div>{sub && <div className="text-[10.5px] text-muted uppercase tracking-wider">{sub}</div>}</div>
      </div>
    </div>
  )
}

/** Live horizontal bar (re-animates on change). */
export function LiveBar({ value, max, color = SWK.navy, height = 8 }: { value: number; max: number; color?: string; height?: number }) {
  const w = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height, background: '#efe9dc' }}>
      <motion.div className="h-full rounded-full" style={{ background: color }} initial={{ width: 0 }} animate={{ width: `${w}%` }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} />
    </div>
  )
}

/** Semicircle gauge (DBR etc.). */
export function Gauge({ value, cap, max = 100, color, label, sub }: { value: number; cap: number; max?: number; color: string; label: ReactNode; sub?: ReactNode }) {
  const w = 240, h = 140, r = 100, cx = w / 2, cy = 120
  const arc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`
  const v = Math.max(0, Math.min(1, value / max)), capA = Math.PI * (1 - cap / max)
  return (
    <div className="relative" style={{ width: w, maxWidth: '100%' }}>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label={`Gauge ${Math.round(value)} of cap ${cap}`}>
        <path d={arc} stroke="#ece5d6" strokeWidth={18} fill="none" strokeLinecap="round" />
        <motion.path d={arc} stroke={color} strokeWidth={18} fill="none" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: Math.max(0.001, v) }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} />
        <line x1={cx + (r - 16) * Math.cos(capA)} y1={cy - (r - 16) * Math.sin(capA)} x2={cx + (r + 16) * Math.cos(capA)} y2={cy - (r + 16) * Math.sin(capA)} stroke={SWK.ink} strokeWidth={2.5} strokeDasharray="3 2" />
        <text x={cx + (r + 22) * Math.cos(capA)} y={cy - (r + 22) * Math.sin(capA)} fontSize="10" fill={SWK.muted} textAnchor="middle">{cap}% cap</text>
      </svg>
      <div className="absolute inset-x-0 bottom-1 text-center leading-tight">
        <div className="font-display text-[28px] font-semibold text-ink">{label}</div>
        {sub && <div className="text-[11px] uppercase tracking-wider text-muted">{sub}</div>}
      </div>
    </div>
  )
}

export function Legend({ items }: { items: { label: string; value: number; color: string; fmt?: (v: number) => string }[] }) {
  return (
    <ul className="space-y-1.5 min-w-0 flex-1">
      {items.map(i => (
        <li key={i.label} className="flex items-center gap-2 text-[13px] min-w-0">
          <span className="w-2.5 h-2.5 rounded-full flex-none" style={{ background: i.color }} />
          <span className="text-muted truncate flex-1">{i.label}</span>
          <b className="text-ink tabular-nums font-semibold whitespace-nowrap">{(i.fmt ?? aed)(i.value)}</b>
        </li>
      ))}
    </ul>
  )
}

export const KV = ({ k, v, strong }: { k: ReactNode; v: ReactNode; strong?: boolean }) => (
  <div className="swk-kv"><span>{k}</span><b style={strong ? { fontSize: 15 } : undefined}>{v}</b></div>
)
