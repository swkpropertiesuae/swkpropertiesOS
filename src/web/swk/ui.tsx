/**
 * SWK OS design primitives — "Midnight & Champagne".
 * Animated building blocks shared by the dashboard and every real-estate module.
 * All motion respects prefers-reduced-motion through motion's useReducedMotion.
 */
import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform, type HTMLMotionProps } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, TrendingDown, TrendingUp } from 'lucide-react'
import { cls } from '../lib/format'

export const SWK = {
  navy: '#14305c', midnight: '#0b1a33', ocean: '#1d4f86', sky: '#5b86c4', champ: '#c9a96e', champDeep: '#9a7a42',
  champSoft: '#f3ead8', sand: '#f6f2ea', oasis: '#1f7a7a', dune: '#c4492f', ink: '#0b1a33', muted: '#6b7488', line: '#e7e1d4',
}
/** Ordered chart palette — navy → champagne → oasis → ocean → dune → sky → deep gold */
export const CHART = [SWK.navy, SWK.champ, SWK.oasis, SWK.ocean, SWK.dune, SWK.sky, SWK.champDeep, '#8e9ab3']

export const aed = (n: number | null | undefined, opts: { compact?: boolean; decimals?: number } = {}) => {
  const v = Number(n ?? 0)
  if (opts.compact) {
    const a = Math.abs(v)
    if (a >= 1e9) return `AED ${(v / 1e9).toFixed(2)}B`
    if (a >= 1e6) return `AED ${(v / 1e6).toFixed(a >= 1e8 ? 0 : 2)}M`
    if (a >= 1e3) return `AED ${(v / 1e3).toFixed(0)}K`
  }
  return `AED ${v.toLocaleString('en-AE', { maximumFractionDigits: opts.decimals ?? 0, minimumFractionDigits: opts.decimals ?? 0 })}`
}
export const num = (n: number | null | undefined, d = 0) => Number(n ?? 0).toLocaleString('en-AE', { maximumFractionDigits: d, minimumFractionDigits: d })
export const pct = (n: number | null | undefined, d = 1) => `${Number(n ?? 0).toFixed(d)}%`

/** Counts up to `value` when scrolled into view. */
export function AnimatedNumber({ value, format = v => num(v), duration = 1.2, className }: { value: number; format?: (v: number) => string; duration?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const reduce = useReducedMotion()
  const mv = useMotionValue(0)
  const [text, setText] = useState(format(reduce ? value : 0))
  useEffect(() => mv.on('change', v => setText(format(v))), [mv, format])
  useEffect(() => {
    if (reduce) { setText(format(value)); return }
    if (!inView) return
    const c = animate(mv, value, { duration, ease: [0.16, 1, 0.3, 1] })
    return () => c.stop()
  }, [inView, value, reduce]) // eslint-disable-line react-hooks/exhaustive-deps
  return <span ref={ref} className={cls('tabular-nums', className)}>{text}</span>
}

/** Staggered entrance container + item. */
export const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } } }
export const rise = { hidden: { opacity: 0, y: 14, filter: 'blur(4px)' }, show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] } } }
export function Reveal({ children, className, as = 'div', ...rest }: { children: ReactNode; className?: string; as?: 'div' | 'section' | 'ul' } & HTMLMotionProps<'div'>) {
  const C: any = as === 'section' ? motion.section : as === 'ul' ? motion.ul : motion.div
  return <C variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-30px' }} className={className} {...rest}>{children}</C>
}
export function RevealItem({ children, className, ...rest }: { children: ReactNode; className?: string } & HTMLMotionProps<'div'>) {
  return <motion.div variants={rise} className={className} {...rest}>{children}</motion.div>
}

/** Page header used by every SWK module. */
export function ModuleHeader({ eyebrow, title, subtitle, actions, icon }: { eyebrow?: string; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; icon?: ReactNode }) {
  return (
    <motion.header className="swk-module-head" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
      <div className="flex items-start gap-4 min-w-0">
        {icon && <div className="swk-module-icon">{icon}</div>}
        <div className="min-w-0">
          {eyebrow && <div className="swk-eyebrow">{eyebrow}</div>}
          <h1 className="swk-module-title">{title}</h1>
          {subtitle && <p className="swk-module-sub">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </motion.header>
  )
}

/** Premium surface card with optional header. */
export function Card({ title, subtitle, actions, children, className, bodyClassName, tone = 'light', to }: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string; tone?: 'light' | 'navy' | 'champ'; to?: string }) {
  return (
    <motion.section variants={rise} className={cls('swk-card', tone !== 'light' && `swk-card-${tone}`, className)}>
      {(title || actions) && (
        <header className="swk-card-head">
          <div className="min-w-0"><h2 className="swk-card-title">{title}</h2>{subtitle && <p className="swk-card-sub">{subtitle}</p>}</div>
          <div className="flex items-center gap-1.5">{actions}{to && <Link to={to} className="swk-icon-link" aria-label="Open"><ArrowUpRight size={16} /></Link>}</div>
        </header>
      )}
      <div className={cls('swk-card-body', bodyClassName)}>{children}</div>
    </motion.section>
  )
}

/** KPI tile with count-up, delta chip and sparkline. */
export function StatTile({ label, value, format, delta, hint, spark, icon, to, tone = 'light', onClick }: { label: string; value: number; format?: (v: number) => string; delta?: number; hint?: ReactNode; spark?: number[]; icon?: ReactNode; to?: string; tone?: 'light' | 'navy' | 'champ'; onClick?: () => void }) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="swk-stat-label">{label}</span>
        {icon && <span className="swk-stat-icon">{icon}</span>}
      </div>
      <div className="swk-stat-value"><AnimatedNumber value={value} format={format} /></div>
      <div className="flex items-end justify-between gap-2 min-h-[28px]">
        <div className="flex items-center gap-2 flex-wrap text-[12px]">
          {delta !== undefined && <DeltaChip value={delta} />}
          {hint && <span className="swk-stat-hint">{hint}</span>}
        </div>
        {spark && spark.length > 1 && <Sparkline data={spark} color={tone === 'navy' ? SWK.champ : SWK.navy} />}
      </div>
    </>
  )
  const className = cls('swk-stat', tone !== 'light' && `swk-stat-${tone}`, (to || onClick) && 'swk-stat-link')
  if (to) return <motion.div variants={rise} whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 300, damping: 22 }}><Link to={to} className={className}>{body}</Link></motion.div>
  return <motion.div variants={rise} whileHover={onClick ? { y: -3 } : undefined} className={className} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}>{body}</motion.div>
}

export function DeltaChip({ value, suffix = '%' }: { value: number; suffix?: string }) {
  const up = value >= 0
  return <span className={cls('swk-delta', up ? 'up' : 'down')}>{up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{up ? '+' : ''}{value.toFixed(1)}{suffix}</span>
}

/** Tiny animated SVG sparkline. */
export function Sparkline({ data, color = SWK.navy, width = 92, height = 30 }: { data: number[]; color?: string; width?: number; height?: number }) {
  const min = Math.min(...data), max = Math.max(...data), span = max - min || 1
  const pts = data.map((v, i) => [(i / (data.length - 1)) * width, height - 3 - ((v - min) / span) * (height - 6)])
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const id = useRef(`sg${Math.random().toString(36).slice(2, 8)}`).current
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="flex-none">
      <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".28" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={`${d} L${width},${height} L0,${height} Z`} fill={`url(#${id})`} />
      <motion.path d={d} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.1, ease: 'easeOut' }} />
    </svg>
  )
}

/** Animated circular progress (occupancy, compliance, completion %). */
export function ProgressRing({ value, size = 92, stroke = 9, color = SWK.navy, track = '#ece5d6', label, sub }: { value: number; size?: number; stroke?: number; color?: string; track?: string; label?: ReactNode; sub?: ReactNode }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, value))
  return (
    <div className="relative grid place-items-center flex-none" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <motion.circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={c}
          initial={{ strokeDashoffset: c }} whileInView={{ strokeDashoffset: c * (1 - v / 100) }} viewport={{ once: true }} transition={{ duration: 1.3, ease: [0.16, 1, 0.3, 1] }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center leading-tight">
        <div><div className="font-display font-semibold text-ink" style={{ fontSize: size * 0.22 }}>{label ?? `${Math.round(v)}%`}</div>{sub && <div className="text-[10.5px] text-muted uppercase tracking-wider">{sub}</div>}</div>
      </div>
    </div>
  )
}

/** Horizontal animated bar (used for funnels, budgets, plan progress). */
export function Bar({ value, max = 100, color = SWK.navy, height = 8, delay = 0 }: { value: number; max?: number; color?: string; height?: number; delay?: number }) {
  const w = max ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height, background: '#efe9dc' }}>
      <motion.div className="h-full rounded-full" style={{ background: color }} initial={{ width: 0 }} whileInView={{ width: `${w}%` }} viewport={{ once: true }} transition={{ duration: 1, delay, ease: [0.16, 1, 0.3, 1] }} />
    </div>
  )
}

export function Pill({ children, tone = 'navy', className }: { children: ReactNode; tone?: 'navy' | 'champ' | 'oasis' | 'dune' | 'grey' | 'sky'; className?: string }) {
  return <span className={cls('swk-pill', `swk-pill-${tone}`, className)}>{children}</span>
}

/** Segmented control (tabs) with sliding champagne indicator. */
export function Segmented<T extends string>({ value, onChange, options, layoutId = 'seg' }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; layoutId?: string }) {
  return (
    <div className="swk-seg" role="tablist">
      {options.map(o => (
        <button key={o.value} role="tab" aria-selected={value === o.value} className={cls('swk-seg-btn', value === o.value && 'active')} onClick={() => onChange(o.value)}>
          {value === o.value && <motion.span layoutId={layoutId} className="swk-seg-ind" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
          <span className="relative z-[1]">{o.label}</span>
        </button>
      ))}
    </div>
  )
}

/** Labelled numeric input used by the calculators. */
export function Field({ label, value, onChange, suffix, prefix, step = 1, min = 0, hint }: { label: string; value: number; onChange: (v: number) => void; suffix?: string; prefix?: string; step?: number; min?: number; hint?: ReactNode }) {
  return (
    <label className="swk-field">
      <span className="swk-field-label">{label}</span>
      <span className="swk-field-box">
        {prefix && <span className="swk-field-affix">{prefix}</span>}
        <input type="number" inputMode="decimal" step={step} min={min} value={Number.isFinite(value) ? value : 0} onChange={e => onChange(Number(e.target.value))} />
        {suffix && <span className="swk-field-affix">{suffix}</span>}
      </span>
      {hint && <span className="swk-field-hint">{hint}</span>}
    </label>
  )
}

/** Empty / placeholder state with brand mark. */
export function EmptyState({ title, hint, action }: { title: string; hint?: ReactNode; action?: ReactNode }) {
  return <div className="swk-empty"><img src="/brand/swk-logo-ink.png" alt="" aria-hidden /><b>{title}</b>{hint && <p>{hint}</p>}{action}</div>
}

/** Parallax-free tilt-on-hover photo card for properties/communities. */
export function PhotoCard({ src, title, subtitle, badge, footer, to }: { src: string; title: ReactNode; subtitle?: ReactNode; badge?: ReactNode; footer?: ReactNode; to?: string }) {
  const x = useMotionValue(0), y = useMotionValue(0)
  const rx = useTransform(y, [-0.5, 0.5], [4, -4]), ry = useTransform(x, [-0.5, 0.5], [-4, 4])
  const inner = (
    <motion.div className="swk-photo" style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      onMouseMove={e => { const r = e.currentTarget.getBoundingClientRect(); x.set((e.clientX - r.left) / r.width - 0.5); y.set((e.clientY - r.top) / r.height - 0.5) }}
      onMouseLeave={() => { x.set(0); y.set(0) }}>
      <div className="swk-photo-img" style={{ backgroundImage: `url(${src})` }} />
      <div className="swk-photo-shade" />
      {badge && <div className="absolute top-3 left-3 flex gap-1.5 flex-wrap">{badge}</div>}
      <div className="swk-photo-text"><div className="swk-photo-title">{title}</div>{subtitle && <div className="swk-photo-sub">{subtitle}</div>}{footer && <div className="mt-2">{footer}</div>}</div>
    </motion.div>
  )
  return <motion.div variants={rise}>{to ? <Link to={to} className="block">{inner}</Link> : inner}</motion.div>
}
