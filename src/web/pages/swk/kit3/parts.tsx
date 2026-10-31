/**
 * Small shared parts for the Listing Studio, Off-Plan Launches and PDC Vault modules.
 * Drawer (side sheet), toast stack, select/search fields and the "Sample" data pill.
 */
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { CheckCircle2, Info, Search, X } from 'lucide-react'
import { SWK } from '../../../swk/ui'

/** Clearly labels indicative / sample data so it is never faked silently. */
export function SamplePill({ title = 'Indicative sample data — not stored in SWK OS', label = 'Sample' }: { title?: string; label?: string }) {
  return <span title={title} className="inline-flex items-center gap-1 h-[20px] px-2 rounded-full text-[10.5px] font-semibold uppercase tracking-wider" style={{ background: '#f4ead5', color: '#7d5f2c', border: '1px dashed #c9a96e' }}>{label}</span>
}

/** Right-hand side sheet with focus handling + Esc to close. */
export function Drawer({ open, onClose, title, eyebrow, children, width = 560, footer }: { open: boolean; onClose: () => void; title: ReactNode; eyebrow?: ReactNode; children: ReactNode; width?: number; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    const t = setTimeout(() => ref.current?.focus(), 50)
    return () => { window.removeEventListener('keydown', k); clearTimeout(t) }
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80]">
          <motion.div className="absolute inset-0" style={{ background: 'rgba(11,26,51,.42)', backdropFilter: 'blur(3px)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : 'Details'}
            className="absolute right-0 top-0 h-full flex flex-col outline-none"
            style={{ width: `min(${width}px, 100vw)`, background: SWK.sand, boxShadow: '-30px 0 60px -30px rgba(11,26,51,.5)' }}
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 320, damping: 34 }}>
            <header className="flex items-start justify-between gap-3 px-6 pt-5 pb-4" style={{ borderBottom: `1px solid ${SWK.line}`, background: '#fff' }}>
              <div className="min-w-0">
                {eyebrow && <div className="swk-eyebrow">{eyebrow}</div>}
                <h2 className="font-display text-[20px] font-semibold text-ink leading-tight">{title}</h2>
              </div>
              <button className="swk-btn swk-btn-ghost !h-9 !w-9 !p-0" onClick={onClose} aria-label="Close panel"><X size={16} /></button>
            </header>
            <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
            {footer && <footer className="px-6 py-4 flex gap-2 flex-wrap" style={{ borderTop: `1px solid ${SWK.line}`, background: '#fff' }}>{footer}</footer>}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  )
}

export type Toast = { id: number; text: ReactNode; tone?: 'ok' | 'info' | 'warn' }
/** Lightweight toast stack — `push(text)` then render `<Toasts />`. */
export function useToasts() {
  const [items, setItems] = useState<Toast[]>([])
  const push = useCallback((text: ReactNode, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random()
    setItems(s => [...s, { id, text, tone }])
    setTimeout(() => setItems(s => s.filter(t => t.id !== id)), 4200)
  }, [])
  const node = (
    <div className="fixed bottom-5 right-5 z-[90] flex flex-col gap-2 items-end pointer-events-none" aria-live="polite">
      <AnimatePresence>
        {items.map(t => (
          <motion.div key={t.id} layout initial={{ opacity: 0, y: 16, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, x: 40 }}
            className="pointer-events-auto flex items-start gap-2.5 max-w-[380px] rounded-2xl px-4 py-3 text-[13px] text-white"
            style={{ background: SWK.midnight, boxShadow: '0 18px 40px -18px rgba(11,26,51,.8)', borderLeft: `3px solid ${t.tone === 'warn' ? SWK.dune : t.tone === 'info' ? SWK.champ : SWK.oasis}` }}>
            {t.tone === 'info' || t.tone === 'warn' ? <Info size={16} className="flex-none mt-0.5" style={{ color: SWK.champ }} /> : <CheckCircle2 size={16} className="flex-none mt-0.5" style={{ color: '#6fd0c4' }} />}
            <div>{t.text}</div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
  return { push, node }
}

export function SelectField({ label, value, onChange, options, className }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; className?: string }) {
  return (
    <label className={`swk-field ${className ?? ''}`}>
      <span className="swk-field-label">{label}</span>
      <span className="swk-field-box"><select value={value} onChange={e => onChange(e.target.value)} aria-label={label}>{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></span>
    </label>
  )
}

export function SearchField({ value, onChange, placeholder = 'Search…', label = 'Search' }: { value: string; onChange: (v: string) => void; placeholder?: string; label?: string }) {
  return (
    <label className="swk-field">
      <span className="swk-field-label">{label}</span>
      <span className="swk-field-box"><span className="pl-3 text-muted"><Search size={15} /></span><input type="search" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} aria-label={label} /></span>
    </label>
  )
}

export async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true } catch {
    const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select()
    try { document.execCommand('copy'); return true } catch { return false } finally { ta.remove() }
  }
}

/** Deterministic string hash → stable pseudo-random choices for sample data. */
export const hash = (s: string | number) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) } return Math.abs(h) }
export const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 864e5)
export const parseDate = (v?: string | null) => (v ? new Date(`${String(v).slice(0, 10)}T00:00:00`) : null)
