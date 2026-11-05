/**
 * Shared helpers for the brokerage modules (Pipeline, Agents, RERA Centre, Owner 360).
 * Owned by these four pages only — keeps data loading, date maths and the drawer consistent.
 */
import { useEffect, useRef, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { FlaskConical, X } from 'lucide-react'
import { get } from '../../../lib/api'
import { CHART } from '../../../swk/ui'

export type Row = Record<string, any> & { id: number; _labels?: Record<string, string>; _title?: string }

/** Loads every row of an entity (pageSize 500). Never throws — returns [] if the type is unknown or forbidden. */
export function useRows(entity: string, enabled = true) {
  return useQuery({
    queryKey: ['swk-rows', entity],
    enabled,
    retry: false,
    staleTime: 30_000,
    queryFn: async () => {
      try { const r = await get<{ rows: Row[] }>(`/api/e/${entity}`, { pageSize: 500 }); return r?.rows ?? [] } catch { return [] as Row[] }
    },
  })
}

export const DAY = 864e5
export const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }
export const toDate = (v: any): Date | null => { if (!v) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d }
export const daysUntil = (v: any) => { const d = toDate(v); return d ? Math.round((d.getTime() - today().getTime()) / DAY) : null }
export const daysSince = (v: any) => { const d = toDate(v); return d ? Math.max(0, Math.round((today().getTime() - d.getTime()) / DAY)) : null }
export const addDays = (n: number) => new Date(today().getTime() + n * DAY).toISOString().slice(0, 10)
export const fmtD = (v: any) => { const d = toDate(v); return d ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' }
export const fmtShort = (v: any) => { const d = toDate(v); return d ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—' }

/** "AGT0001 - Ahmed Al Mansoori" → "Ahmed Al Mansoori" */
export const cleanLabel = (s?: string | null) => (s ?? '').replace(/^[A-Z]{2,5}[-\d]*\d+\s*[-–]\s*/, '').trim()
export const initials = (s?: string | null) => cleanLabel(s).split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h) }
export const colorFor = (s: string) => CHART[hash(s) % 6]

/** Deterministic PRNG so sample data is stable between renders. */
export function seeded(seed: number) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }

export function Avatar({ name, size = 30, ring }: { name?: string | null; size?: number; ring?: string }) {
  const n = cleanLabel(name) || 'Unassigned'
  return (
    <span title={n} aria-label={n} className="inline-grid place-items-center rounded-full font-semibold text-white flex-none select-none"
      style={{ width: size, height: size, fontSize: size * 0.38, background: `linear-gradient(140deg, ${colorFor(n)}, #0b1a33)`, boxShadow: ring ? `0 0 0 2px #fff, 0 0 0 4px ${ring}` : '0 0 0 2px #fff' }}>
      {initials(n)}
    </span>
  )
}

export function SamplePill({ title = 'Indicative sample data — not from the database' }: { title?: string }) {
  return <span title={title} className="swk-pill swk-pill-champ" style={{ height: 20, fontSize: 10.5 }}><FlaskConical size={11} />Sample</span>
}

/** Accessible slide-in side drawer. */
export function Drawer({ open, onClose, title, subtitle, children, width = 460 }: { open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; width?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h); setTimeout(() => ref.current?.focus(), 50)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true">
          <motion.div className="absolute inset-0" style={{ background: 'rgba(11,26,51,.42)', backdropFilter: 'blur(3px)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside ref={ref} tabIndex={-1} className="absolute right-0 top-0 bottom-0 flex flex-col outline-none"
            style={{ width: `min(${width}px, 100vw)`, background: '#fbf9f4', borderLeft: '1px solid #e7e1d4', boxShadow: '-30px 0 60px -30px rgba(11,26,51,.45)' }}
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 320, damping: 34 }}>
            <header className="flex items-start justify-between gap-3 px-5 pt-5 pb-4" style={{ borderBottom: '1px solid #ece5d6' }}>
              <div className="min-w-0"><div className="font-display font-semibold text-[19px] leading-tight" style={{ color: '#0b1a33' }}>{title}</div>{subtitle && <div className="text-[12.5px] mt-1" style={{ color: '#6b7488' }}>{subtitle}</div>}</div>
              <button className="swk-btn swk-btn-ghost" style={{ width: 38, height: 38, padding: 0 }} onClick={onClose} aria-label="Close panel"><X size={16} /></button>
            </header>
            <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  )
}

export function SearchBox({ value, onChange, placeholder = 'Search…', label = 'Search' }: { value: string; onChange: (v: string) => void; placeholder?: string; label?: string }) {
  return (
    <label className="swk-field-box" style={{ height: 40, minWidth: 200 }}>
      <span className="sr-only">{label}</span>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} aria-label={label} style={{ fontSize: 13.5 }} />
    </label>
  )
}

export const INK = '#0b1a33', MUTED = '#6b7488'
