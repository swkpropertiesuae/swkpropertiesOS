import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronDown } from 'lucide-react'
import { get } from '../lib/api'
import { cls } from '../lib/format'

interface Opt { id: number; label: string; sub?: string }
const cache = new Map<string, Opt[]>()

export function RefSelect({ entity, value, label, onChange, filter, disabled, invalid, placeholder = 'Search…', allowClear = true }: { entity: string; value: number | null | undefined; label?: string; onChange: (id: number | null, label?: string) => void; filter?: Record<string, any>; disabled?: boolean; invalid?: boolean; placeholder?: string; allowClear?: boolean }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [opts, setOpts] = useState<Opt[]>([])
  const [busy, setBusy] = useState(false)
  const [shown, setShown] = useState<string>(label ?? '')
  const [hi, setHi] = useState(0)
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number; maxHeight: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const timer = useRef<any>(null)
  const fkey = JSON.stringify(filter ?? {})

  // Outside click that respects both input wrapper and portaled listbox
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      const t = e.target as Node
      if (ref.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  // Position portaled listbox relative to input and flip upward if near bottom of screen
  useLayoutEffect(() => {
    if (!open || disabled) { setPos(null); return }
    const update = () => {
      const el = ref.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const spaceBelow = window.innerHeight - r.bottom - 12
      const spaceAbove = r.top - 12
      const flipUp = spaceBelow < 200 && spaceAbove > spaceBelow
      if (flipUp) {
        setPos({
          left: r.left,
          width: r.width,
          bottom: window.innerHeight - r.top + 4,
          maxHeight: Math.max(120, Math.min(256, spaceAbove - 4)),
        })
      } else {
        setPos({
          left: r.left,
          width: r.width,
          top: r.bottom + 4,
          maxHeight: Math.max(120, Math.min(256, spaceBelow - 4)),
        })
      }
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open, disabled])

  // resolve label for an id we only know numerically
  useEffect(() => {
    if (!value) { setShown(''); return }
    if (label) { setShown(label); return }
    let dead = false
    get<Opt[]>(`/api/e/${entity}/lookup`, { ids: String(value) }).then(r => { if (!dead && r[0]) setShown(r[0].label) }).catch(() => {})
    return () => { dead = true }
  }, [value, label, entity])

  useEffect(() => {
    if (!open) return
    clearTimeout(timer.current)
    const k = `${entity}|${fkey}|${text}`
    if (cache.has(k)) { setOpts(cache.get(k)!); return }
    setBusy(true)
    timer.current = setTimeout(() => {
      get<Opt[]>(`/api/e/${entity}/lookup`, { q: text, filter: filter && Object.keys(filter).length ? filter : undefined, limit: 25 }).then(r => { cache.set(k, r); if (cache.size > 300) cache.delete(cache.keys().next().value!); setOpts(r); setHi(0) }).catch(() => setOpts([])).finally(() => setBusy(false))
    }, text ? 180 : 0)
    return () => clearTimeout(timer.current)
  }, [open, text, entity, fkey])

  const pick = (o: Opt) => { onChange(o.id, o.label); setShown(o.label); setOpen(false); setText('') }
  const dropdown = open && !disabled && pos ? (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: pos.left,
        width: pos.width,
        top: pos.top,
        bottom: pos.bottom,
        maxHeight: pos.maxHeight,
        zIndex: 300,
      }}
      className="bg-card border border-line rounded-xl shadow-xl overflow-auto fade-in"
      role="listbox"
    >
      {busy && !opts.length && <div className="px-3 py-2 text-sm text-muted">Searching…</div>}
      {!busy && !opts.length && <div className="px-3 py-2 text-sm text-muted">No matches</div>}
      {opts.map((o, i) => (
        <div
          key={o.id}
          role="option"
          aria-selected={o.id === value}
          className={cls('px-3 py-2 text-[13.5px] cursor-pointer flex justify-between gap-2', i === hi ? 'bg-mint text-fold' : 'hover:bg-hover', o.id === value && 'font-bold')}
          onMouseEnter={() => setHi(i)}
          onMouseDown={e => { e.preventDefault(); pick(o) }}
        >
          <span className="truncate">{o.label}</span>
          {o.sub && <span className="text-xs text-muted flex-none">{o.sub}</span>}
        </div>
      ))}
    </div>
  ) : null

  return (
    <div className="ref-select relative" ref={ref}>
      <div className="relative">
        <input className={cls('input pr-14', invalid && 'invalid')} disabled={disabled} placeholder={shown ? '' : placeholder} value={open ? text : shown} title={shown}
          onFocus={() => { setOpen(true); setText('') }} onChange={e => { setText(e.target.value); setOpen(true) }}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, opts.length - 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, 0)) }
            else if (e.key === 'Enter' && open && opts[hi]) { e.preventDefault(); pick(opts[hi]) }
            else if (e.key === 'Escape') setOpen(false)
          }} autoComplete="off" role="combobox" aria-expanded={open} />
        <div className="ref-select-actions absolute top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          {allowClear && value && !disabled ? <button type="button" className="btn ghost icon sm" style={{ width: 22, minHeight: 22 }} onClick={() => { onChange(null); setShown('') }} aria-label="Clear"><X size={13} /></button> : null}
          <ChevronDown size={15} className="text-muted pointer-events-none" />
        </div>
      </div>
      {dropdown && typeof document !== 'undefined' ? createPortal(dropdown, document.body) : dropdown}
    </div>
  )
}
export const clearRefCache = () => cache.clear()
