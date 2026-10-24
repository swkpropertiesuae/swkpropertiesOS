/**
 * Off-Plan Launches — curated Dubai off-plan catalogue (inspired by Reelly).
 * The project catalogue below is INDICATIVE sample data maintained in-file; SWK inventory flagged
 * is_off_plan=true is merged in from /api/e/properties.
 */
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowUpRight, Building, CalendarClock, ChevronLeft, ChevronRight, Copy, HandCoins, Landmark, Lock, MessageCircle, Rocket, ShieldCheck, Trophy } from 'lucide-react'
import { get } from '../../lib/api'
import { Bar, Card, EmptyState, Field, ModuleHeader, Pill, ProgressRing, Reveal, StatTile, SWK, aed, num } from '../../swk/ui'
import { COMMUNITIES, DEVELOPERS, UAE, communityByName, paymentPlan } from '../../swk/uae'
import { copyText, Drawer, hash, SamplePill, SelectField, useToasts } from './kit3/parts'

type Plan = { booking: number; construction: number; handover: number; post: number }
type Project = {
  id: string; project: string; developer: string; community: string; image: string; from: number; types: string[]; handoverQ: string; handover: Date
  plan: Plan; completion: number; escrow: string; reraNo: string; oqood: boolean; avail: number; total: number; commission: number; minPaidResale: number
  blurb: string; featured?: boolean; source: 'catalogue' | 'swk'; swkId?: number
}

const PHASE_COLORS = { booking: SWK.navy, construction: SWK.champ, handover: SWK.oasis, post: SWK.sky }
const q2date = (q: string) => { const [qq, y] = q.split(' '); const m = (Number(qq.slice(1)) - 1) * 3 + 2; return new Date(Number(y), m, 28) }
const img = (p: string) => (p.startsWith('/') ? p : `/media/properties/${p}.webp`)
const P = (b: number, c: number, h: number, po = 0): Plan => ({ booking: b, construction: c, handover: h, post: po })

const RAW: Omit<Project, 'handover' | 'source'>[] = [
  { id: 'creek-vista', project: 'Creek Vista Heights', developer: 'Emaar Properties', community: 'Dubai Creek Harbour', image: img('river-cove-residences-1'), from: 1_650_000, types: ['1 BR', '2 BR', '3 BR'], handoverQ: 'Q4 2028', plan: P(10, 70, 20), completion: 18, escrow: 'Emirates NBD', reraNo: 'RERA-PRJ 3412', oqood: true, avail: 142, total: 388, commission: 5, minPaidResale: 40, featured: true, blurb: 'Waterfront towers facing the Ras Al Khor sanctuary with direct Creek Marina promenade access.' },
  { id: 'palm-crown', project: 'The Crown Residences', developer: 'Nakheel', community: 'Palm Jumeirah', image: img('palm-garden-homes-1'), from: 6_900_000, types: ['2 BR', '3 BR', '4 BR Penthouse'], handoverQ: 'Q2 2028', plan: P(20, 40, 40), completion: 34, escrow: 'Emirates Islamic', reraNo: 'RERA-PRJ 3188', oqood: true, avail: 38, total: 120, commission: 4, minPaidResale: 50, featured: true, blurb: 'Beachfront boutique residences on the crescent with private beach club and marina berths.' },
  { id: 'hills-greens', project: 'Golf Greens Villas', developer: 'Emaar Properties', community: 'Dubai Hills Estate', image: img('golf-fields-1'), from: 4_850_000, types: ['4 BR Villa', '5 BR Villa'], handoverQ: 'Q3 2027', plan: P(10, 70, 20), completion: 62, escrow: 'Emirates NBD', reraNo: 'RERA-PRJ 2954', oqood: true, avail: 21, total: 164, commission: 5, minPaidResale: 40, blurb: 'Golf-course frontage villas minutes from Dubai Hills Mall.' },
  { id: 'damac-islands', project: 'Lagoon Islands Phase 2', developer: 'DAMAC Properties', community: 'Dubai Land', image: img('islands-2-1'), from: 2_250_000, types: ['4 BR Townhouse', '5 BR Townhouse'], handoverQ: 'Q4 2029', plan: P(20, 55, 0, 25), completion: 6, escrow: 'Mashreq', reraNo: 'RERA-PRJ 3520', oqood: true, avail: 610, total: 900, commission: 6, minPaidResale: 30, featured: true, blurb: 'Tropical-island inspired townhouses around crystal lagoons with a 25% post-handover plan.' },
  { id: 'sobha-sanctuary', project: 'Sanctuary Hartland III', developer: 'Sobha Realty', community: 'Mohammed Bin Rashid City', image: img('villa-sanctuary-6'), from: 3_400_000, types: ['3 BR', '4 BR Villa'], handoverQ: 'Q1 2028', plan: P(10, 50, 40), completion: 41, escrow: 'Abu Dhabi Commercial Bank', reraNo: 'RERA-PRJ 3077', oqood: true, avail: 64, total: 210, commission: 5, minPaidResale: 40, blurb: 'Backward-integrated Sobha quality with lagoon and forest landscaping.' },
  { id: 'binghatti-bay', project: 'Binghatti Skyrise', developer: 'Binghatti', community: 'Business Bay', image: img('business-bay-executive-tower-2'), from: 1_150_000, types: ['Studio', '1 BR', '2 BR'], handoverQ: 'Q2 2027', plan: P(20, 50, 30), completion: 71, escrow: 'Emirates Islamic', reraNo: 'RERA-PRJ 2890', oqood: true, avail: 96, total: 640, commission: 6, minPaidResale: 30, blurb: 'Signature Binghatti façade on the Dubai Canal, strong short-let demand.' },
  { id: 'azizi-jvc', project: 'Azizi Vista Boulevard', developer: 'Azizi Developments', community: 'Jumeirah Village Circle', image: img('jvc-boulevard-residences-2'), from: 720_000, types: ['Studio', '1 BR', '2 BR'], handoverQ: 'Q4 2027', plan: P(10, 40, 10, 40), completion: 48, escrow: 'Dubai Islamic Bank', reraNo: 'RERA-PRJ 3005', oqood: true, avail: 210, total: 520, commission: 6, minPaidResale: 30, blurb: 'Entry-level investor stock in JVC with 40% post-handover over two years.' },
  { id: 'ellington-marina', project: 'Ellington Marina Edit', developer: 'Ellington Properties', community: 'Dubai Marina', image: img('marina-sky-penthouse-1'), from: 2_100_000, types: ['1 BR', '2 BR', '3 BR', 'Penthouse'], handoverQ: 'Q3 2028', plan: P(10, 60, 30), completion: 22, escrow: 'First Abu Dhabi Bank', reraNo: 'RERA-PRJ 3301', oqood: true, avail: 73, total: 190, commission: 5, minPaidResale: 40, blurb: 'Design-led boutique tower with full marina and Ain Dubai views.' },
  { id: 'danube-sports', project: 'Danube Oceanz Sky', developer: 'Danube Properties', community: 'Dubai Maritime City', image: img('raw-district-2-3'), from: 980_000, types: ['Studio', '1 BR', '2 BR'], handoverQ: 'Q1 2029', plan: P(10, 49, 0, 41), completion: 9, escrow: 'RAKBANK', reraNo: 'RERA-PRJ 3466', oqood: false, avail: 480, total: 720, commission: 6, minPaidResale: 30, blurb: 'Famous 1% monthly payment plan with resort-style amenities on every floor.' },
  { id: 'omniyat-canal', project: 'The Canal Opus Residences', developer: 'Omniyat', community: 'Business Bay', image: img('creek-harbour-waterside-townhouse-1'), from: 9_800_000, types: ['3 BR', '4 BR', 'Sky Villa'], handoverQ: 'Q4 2028', plan: P(20, 50, 30), completion: 27, escrow: 'Emirates NBD', reraNo: 'RERA-PRJ 3254', oqood: true, avail: 14, total: 48, commission: 4, minPaidResale: 50, blurb: 'Ultra-prime canal-front residences serviced by a luxury hotel operator.' },
  { id: 'meraas-arabian', project: 'Ranches Courtyard Collection', developer: 'Meraas', community: 'Arabian Ranches', image: img('arabian-ranches-courtyard-villa-2'), from: 5_300_000, types: ['4 BR Villa', '5 BR Villa'], handoverQ: 'Q2 2027', plan: P(10, 60, 30), completion: 79, escrow: 'Abu Dhabi Commercial Bank', reraNo: 'RERA-PRJ 2802', oqood: true, avail: 9, total: 96, commission: 4, minPaidResale: 40, blurb: 'Courtyard-plan family villas, near-complete with early handover potential.' },
]
const CATALOGUE: Project[] = RAW.map(p => ({ ...p, handover: q2date(p.handoverQ), source: 'catalogue' }))
const devLogo = (name: string) => DEVELOPERS.find(d => d.name === name)?.logo
const communityImg = (name: string) => communityByName(name)?.image

function planFromString(s?: string): Plan {
  switch (s) {
    case '50/50': return P(10, 40, 50)
    case '60/40': return P(10, 50, 40)
    case '70/30': return P(10, 60, 30)
    case '80/20': return P(10, 70, 20)
    case 'Post-handover 2y': return P(10, 50, 0, 40)
    case 'Post-handover 3y': return P(10, 40, 0, 50)
    case '100% on completion': return P(10, 0, 90)
    default: return P(10, 60, 30)
  }
}
const isPost = (p: Project) => p.plan.post > 0
const planLabel = (p: Plan) => p.post ? `${p.booking + p.construction}/${p.handover ? `${p.handover}/` : ''}${p.post} post-handover` : `${p.booking + p.construction}/${p.handover}`

function countdown(to: Date, now: Date) {
  const d = Math.max(0, Math.round((to.getTime() - now.getTime()) / 864e5))
  const y = Math.floor(d / 365), m = Math.floor((d % 365) / 30.4)
  return { days: d, text: d === 0 ? 'Handover due' : `${y ? `${y}y ` : ''}${m}m to handover` }
}

export default function OffPlanPage() {
  const props = useQuery({ queryKey: ['swk-op', 'properties'], queryFn: () => get<{ rows: any[] }>('/api/e/properties', { pageSize: 500 }) })
  const toasts = useToasts()
  const now = useMemo(() => new Date(), [])
  const swk: Project[] = useMemo(() => (props.data?.rows ?? []).filter(r => r.is_off_plan).map(r => {
    const c = communityByName(r.title) ?? communityByName(r.address)
    const year = Number(r.completion_year) || now.getFullYear() + 2
    const hq = `Q4 ${year < now.getFullYear() ? now.getFullYear() + 1 : year}`
    return {
      id: `swk-${r.id}`, project: r.title, developer: r._labels?.developer_ref ?? (isNaN(Number(r.developer_id)) && r.developer_id ? r.developer_id : 'SWK inventory'), community: c?.name ?? r.sub_community ?? 'Dubai',
      image: c?.image ?? img('golf-fields-1'), from: Number(r.price) || 0, types: [r.bedrooms ? `${r.bedrooms} BR ${r.property_type ?? ''}`.trim() : r.property_type ?? 'Unit'], handoverQ: hq, handover: q2date(hq),
      plan: planFromString(r.payment_plan), completion: 10 + (hash(r.id) % 60), escrow: 'Per SPA (DLD escrow)', reraNo: r.rera_permit_no ?? '—', oqood: true, avail: 1, total: 1, commission: 2, minPaidResale: 40,
      blurb: r.description ?? 'SWK exclusive off-plan resale / assignment.', source: 'swk' as const, swkId: r.id,
    }
  }), [props.data, now])
  const all = useMemo(() => [...swk, ...CATALOGUE], [swk])
  const featured = CATALOGUE.filter(p => p.featured)

  const [dev, setDev] = useState('all'); const [comm, setComm] = useState('all'); const [year, setYear] = useState('all')
  const maxBudget = Math.ceil(Math.max(...all.map(p => p.from)) / 500_000) * 500_000
  const [budget, setBudget] = useState(maxBudget); const [postOnly, setPostOnly] = useState(false)
  useEffect(() => setBudget(maxBudget), [maxBudget])
  const [open, setOpen] = useState<Project | null>(null)

  const list = all.filter(p => (dev === 'all' || p.developer === dev) && (comm === 'all' || p.community === comm) && (year === 'all' || String(p.handover.getFullYear()) === year) && p.from <= budget && (!postOnly || isPost(p)))
  const opt = (a: string[]) => [{ value: 'all', label: 'All' }, ...[...new Set(a)].sort().map(v => ({ value: v, label: v }))]
  const avgEntry = CATALOGUE.reduce((s, p) => s + p.from, 0) / CATALOGUE.length

  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader eyebrow="Primary market · Developers" icon={<Rocket size={22} />} title="Off-Plan Launches"
        subtitle="Curated Dubai launches with payment plans, escrow & Oqood status, construction progress and SWK commission at a glance."
        actions={<><SamplePill title="Project catalogue is an indicative sample maintained by SWK — verify with the developer's latest price list and DLD project status" label="Indicative catalogue" />{swk.length > 0 && <Pill tone="oasis">{swk.length} SWK off-plan listing{swk.length > 1 ? 's' : ''}</Pill>}</>} />

      <Spotlight items={featured} now={now} onOpen={setOpen} />

      <Reveal className="grid gap-4 grid-cols-2 xl:grid-cols-4">
        <StatTile label="Projects tracked" value={all.length} icon={<Building size={16} />} hint={`${new Set(all.map(p => p.developer)).size} developers`} tone="navy" />
        <StatTile label="Avg entry price" value={avgEntry} format={v => aed(v, { compact: true })} icon={<HandCoins size={16} />} hint="Catalogue launches" />
        <StatTile label="Post-handover plans" value={all.filter(isPost).length} icon={<CalendarClock size={16} />} hint="Pay after keys" />
        <StatTile label="Units available" value={all.reduce((s, p) => s + p.avail, 0)} icon={<Landmark size={16} />} hint="Across catalogue" tone="champ" />
      </Reveal>

      <Reveal>
        <Card title="Find a launch">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1.4fr_auto] items-end">
            <SelectField label="Developer" value={dev} onChange={setDev} options={opt(all.map(p => p.developer))} />
            <SelectField label="Community" value={comm} onChange={setComm} options={opt(all.map(p => p.community))} />
            <SelectField label="Handover year" value={year} onChange={setYear} options={opt(all.map(p => String(p.handover.getFullYear())))} />
            <label className="swk-field">
              <span className="swk-field-label">Budget — launch price up to <b className="text-ink">{aed(budget, { compact: true })}</b></span>
              <input type="range" min={500_000} max={maxBudget} step={250_000} value={budget} onChange={e => setBudget(Number(e.target.value))} aria-label="Maximum launch price" className="w-full h-11" style={{ accentColor: SWK.champDeep }} />
            </label>
            <label className="swk-toggle h-11"><input type="checkbox" checked={postOnly} onChange={e => setPostOnly(e.target.checked)} /> Post-handover only</label>
          </div>
        </Card>
      </Reveal>

      {props.isLoading && <div className="text-[12.5px] text-muted">Loading SWK off-plan inventory…</div>}
      {!list.length ? <EmptyState title="No launches match" hint="Widen your budget or clear filters." /> : (
        <motion.div layout className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">{list.map((p, i) => <ProjectCard key={p.id} p={p} i={i} now={now} onOpen={() => setOpen(p)} />)}</AnimatePresence>
        </motion.div>
      )}

      <DeveloperLeague projects={all} />

      <Drawer open={!!open} onClose={() => setOpen(null)} title={open?.project ?? ''} eyebrow={open ? `${open.developer} · ${open.community}` : ''} width={680}>
        {open && <ProjectDetail p={open} now={now} onToast={toasts.push} />}
      </Drawer>
      {toasts.node}
    </div>
  )
}

function Spotlight({ items, now, onOpen }: { items: Project[]; now: Date; onOpen: (p: Project) => void }) {
  const [i, setI] = useState(0); const [paused, setPaused] = useState(false)
  useEffect(() => { if (paused || items.length < 2) return; const t = setInterval(() => setI(v => (v + 1) % items.length), 6000); return () => clearInterval(t) }, [paused, items.length])
  const p = items[i]; if (!p) return null
  const logo = devLogo(p.developer)
  return (
    <section aria-roledescription="carousel" aria-label="Featured launches" className="relative overflow-hidden rounded-[26px] min-h-[340px] md:min-h-[380px]" style={{ background: SWK.midnight }}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <AnimatePresence mode="popLayout">
        <motion.div key={p.id} className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${p.image})` }} initial={{ opacity: 0, scale: 1.12 }} animate={{ opacity: 1, scale: 1.02 }} exit={{ opacity: 0 }} transition={{ opacity: { duration: .8 }, scale: { duration: 7, ease: 'linear' } }} />
      </AnimatePresence>
      <div className="absolute inset-0" style={{ background: 'linear-gradient(100deg, rgba(11,26,51,.94) 0%, rgba(11,26,51,.7) 45%, rgba(11,26,51,.1) 100%)' }} />
      <div className="relative z-[1] p-6 md:p-10 flex flex-col md:flex-row gap-6 md:items-end justify-between min-h-[340px] md:min-h-[380px]">
        <AnimatePresence mode="wait">
          <motion.div key={p.id} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: .5, ease: [0.16, 1, 0.3, 1] }} className="max-w-[620px] text-white flex flex-col gap-3 mt-auto">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="swk-pill" style={{ background: 'rgba(201,169,110,.2)', color: '#ecdcb9' }}>Featured launch</span>
              <span className="swk-pill" style={{ background: 'rgba(255,255,255,.12)', color: '#fff' }}>{p.handoverQ} handover</span>
              {logo && <span className="h-7 px-2 rounded-lg bg-white/95 grid place-items-center"><img src={logo} alt={p.developer} className="h-5 object-contain" /></span>}
            </div>
            <h2 className="font-display text-[30px] md:text-[42px] font-semibold leading-[1.05] !text-white" style={{ color: '#fff' }}>{p.project}</h2>
            <p className="text-[14px] text-white/75">{p.blurb}</p>
            <div className="flex flex-wrap gap-6 mt-1">
              <div><div className="text-[11px] uppercase tracking-wider text-white/55">From</div><div className="font-display text-[22px] font-semibold" style={{ color: '#ecdcb9' }}>{aed(p.from, { compact: true })}</div></div>
              <div><div className="text-[11px] uppercase tracking-wider text-white/55">Payment plan</div><div className="font-display text-[22px] font-semibold">{planLabel(p.plan)}</div></div>
              <div><div className="text-[11px] uppercase tracking-wider text-white/55">Community</div><div className="font-display text-[22px] font-semibold">{p.community}</div></div>
            </div>
            <div className="flex gap-2 mt-2"><button className="swk-btn swk-btn-gold" onClick={() => onOpen(p)}>View payment plan <ArrowUpRight size={16} /></button></div>
          </motion.div>
        </AnimatePresence>
        <div className="flex md:flex-col items-center gap-4">
          <div className="rounded-full p-2" style={{ background: 'rgba(255,255,255,.95)' }}><ProgressRing key={p.id} value={p.completion} size={96} color={SWK.oasis} sub="built" /></div>
          <div className="text-white/80 text-[12px] text-center">{countdown(p.handover, now).text}</div>
        </div>
      </div>
      <div className="absolute z-[2] bottom-4 right-5 flex items-center gap-2">
        <button className="w-8 h-8 rounded-full grid place-items-center text-white" style={{ background: 'rgba(255,255,255,.14)' }} onClick={() => setI(v => (v - 1 + items.length) % items.length)} aria-label="Previous launch"><ChevronLeft size={16} /></button>
        {items.map((it, k) => (
          <button key={it.id} onClick={() => setI(k)} aria-label={`Show ${it.project}`} aria-current={k === i} className="h-1.5 rounded-full overflow-hidden" style={{ width: k === i ? 34 : 12, background: 'rgba(255,255,255,.3)', transition: 'width .3s' }}>
            {k === i && <motion.span key={`${it.id}-${paused}`} className="block h-full" style={{ background: SWK.champ }} initial={{ width: paused ? '100%' : 0 }} animate={{ width: '100%' }} transition={{ duration: paused ? 0 : 6, ease: 'linear' }} />}
          </button>
        ))}
        <button className="w-8 h-8 rounded-full grid place-items-center text-white" style={{ background: 'rgba(255,255,255,.14)' }} onClick={() => setI(v => (v + 1) % items.length)} aria-label="Next launch"><ChevronRight size={16} /></button>
      </div>
    </section>
  )
}

function PlanBar({ plan, height = 10 }: { plan: Plan; height?: number }) {
  const segs = (['booking', 'construction', 'handover', 'post'] as const).filter(k => plan[k] > 0)
  return (
    <div>
      <div className="flex w-full rounded-full overflow-hidden gap-[2px]" style={{ height }} role="img" aria-label={`Payment plan ${segs.map(k => `${k} ${plan[k]}%`).join(', ')}`}>
        {segs.map((k, i) => <motion.div key={k} style={{ background: PHASE_COLORS[k] }} initial={{ width: 0 }} whileInView={{ width: `${plan[k]}%` }} viewport={{ once: true }} transition={{ duration: .9, delay: i * .12, ease: [0.16, 1, 0.3, 1] }} />)}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-[10.5px] text-muted">
        {segs.map(k => <span key={k} className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: PHASE_COLORS[k] }} />{k === 'post' ? 'Post-handover' : k[0].toUpperCase() + k.slice(1)} {plan[k]}%</span>)}
      </div>
    </div>
  )
}

function ProjectCard({ p, i, now, onOpen }: { p: Project; i: number; now: Date; onOpen: () => void }) {
  const logo = devLogo(p.developer); const cd = countdown(p.handover, now)
  return (
    <motion.article layout initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: .95 }} transition={{ duration: .45, delay: Math.min(i, 8) * .04 }} whileHover={{ y: -4 }} className="swk-card overflow-hidden flex flex-col group">
      <button onClick={onOpen} className="relative h-[180px] overflow-hidden text-left" aria-label={`Open ${p.project}`}>
        <div className="absolute inset-0 bg-cover bg-center transition-transform duration-[1.2s] group-hover:scale-[1.06]" style={{ backgroundImage: `url(${p.image || communityImg(p.community)})` }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(11,26,51,0) 35%, rgba(11,26,51,.82) 100%)' }} />
        <div className="absolute top-3 left-3 flex gap-1.5 flex-wrap">
          {p.source === 'swk' ? <Pill tone="oasis">SWK inventory</Pill> : <SamplePill label="Indicative" />}
          {isPost(p) && <Pill tone="sky">Post-handover</Pill>}
          {!p.oqood && <Pill tone="dune">Oqood pending</Pill>}
        </div>
        {logo && <span className="absolute top-3 right-3 h-8 px-2 rounded-lg bg-white/95 grid place-items-center"><img src={logo} alt={p.developer} className="h-5 max-w-[80px] object-contain" /></span>}
        <div className="absolute bottom-3 left-4 right-4 text-white">
          <div className="font-display text-[19px] font-semibold leading-tight">{p.project}</div>
          <div className="text-[12px] opacity-80">{p.developer} · {p.community}</div>
        </div>
      </button>
      <div className="p-4 flex flex-col gap-3.5 flex-1">
        <div className="flex items-center gap-4">
          <ProgressRing value={p.completion} size={70} stroke={7} color={SWK.oasis} sub="built" />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-muted">Launch price from</div>
            <div className="font-display text-[20px] font-semibold text-ink">{aed(p.from, { compact: true })}</div>
            <div className="text-[12px] text-muted truncate">{p.types.join(' · ')}</div>
          </div>
        </div>
        <PlanBar plan={p.plan} />
        <div>
          <div className="flex justify-between text-[12px] mb-1"><span className="text-muted">Availability</span><span className="font-semibold text-ink tabular-nums">{num(p.avail)} / {num(p.total)} units</span></div>
          <Bar value={p.avail} max={p.total} color={p.avail / p.total < 0.15 ? SWK.dune : SWK.champ} delay={.1} />
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: SWK.navy }}><CalendarClock size={14} /> {p.handoverQ} · {cd.text}</span>
          <span className="text-[11.5px] text-muted">{p.commission}% comm.</span>
        </div>
        <div className="flex gap-2">
          <button className="swk-btn swk-btn-primary !h-9 flex-1 text-[12.5px]" onClick={onOpen}>Payment plan & details</button>
          {p.swkId && <Link to={`/e/properties/${p.swkId}`} className="swk-btn swk-btn-ghost !h-9 !w-9 !p-0" aria-label="Open property record"><ArrowUpRight size={16} /></Link>}
        </div>
      </div>
    </motion.article>
  )
}

function ProjectDetail({ p, now, onToast }: { p: Project; now: Date; onToast: (m: string) => void }) {
  const [price, setPrice] = useState(p.from)
  const [split, setSplit] = useState(50)
  const plan = useMemo(() => paymentPlan({
    price, bookingPct: p.plan.booking, constructionPct: p.plan.construction, handoverPct: p.plan.handover, postHandoverPct: p.plan.post,
    constructionInstalments: p.plan.construction ? Math.min(8, Math.max(2, Math.round(p.plan.construction / 10))) : 0, postInstalments: p.plan.post ? 4 : 0,
    start: now, handover: p.handover > now ? p.handover : new Date(now.getTime() + 180 * 864e5),
  }), [price, p, now])
  const gross = price * p.commission / 100
  const minPaid = price * p.minPaidResale / 100
  const phaseColor = (ph: string) => ph === 'Booking' ? PHASE_COLORS.booking : ph === 'Construction' ? PHASE_COLORS.construction : ph === 'Handover' ? PHASE_COLORS.handover : ph === 'Post-handover' ? PHASE_COLORS.post : SWK.champDeep
  const wa = [
    `*${p.project}* by ${p.developer}`, `📍 ${p.community}, Dubai`, `🏠 ${p.types.join(', ')}`, `💰 From ${aed(p.from)}`, `🗓 Handover ${p.handoverQ} · ${p.completion}% built`,
    `💳 Payment plan ${planLabel(p.plan)}`, `🏦 Escrow: ${p.escrow} · ${p.reraNo}`, '', `Unit at ${aed(price)}: ${plan.rows.slice(0, 2).map(r => `${r.label} ${aed(r.amount)}`).join(' + ')}`,
    '', 'SWK Properties · RERA ORN 51517', 'Prices & availability subject to developer confirmation.',
  ].join('\n')
  return (
    <div className="flex flex-col gap-5">
      <div className="relative h-[170px] rounded-2xl overflow-hidden bg-cover bg-center" style={{ backgroundImage: `url(${p.image})` }}>
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 30%, rgba(11,26,51,.85))' }} />
        <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between text-white">
          <div><div className="text-[12px] opacity-75">{p.blurb}</div></div>
          {p.source === 'catalogue' && <SamplePill label="Indicative" />}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-6">
        <div className="swk-kv"><span>Handover</span><b>{p.handoverQ}</b></div>
        <div className="swk-kv"><span>Construction</span><b>{p.completion}%</b></div>
        <div className="swk-kv"><span>RERA project</span><b>{p.reraNo}</b></div>
        <div className="swk-kv"><span>Escrow bank</span><b>{p.escrow}</b></div>
        <div className="swk-kv"><span>Units left</span><b>{p.avail} / {p.total}</b></div>
        <div className="swk-kv"><span>Oqood</span><b style={{ color: p.oqood ? SWK.oasis : SWK.dune }}>{p.oqood ? 'Available' : 'Pending'}</b></div>
      </div>

      <div className="swk-card"><div className="swk-card-body flex flex-col gap-4">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]"><Field label="Unit price" prefix="AED" value={price} onChange={setPrice} step={10000} hint={`Launch from ${aed(p.from)}`} /></div>
          <div className="text-right"><div className="text-[11px] uppercase tracking-wider text-muted">Total incl. 4% Oqood</div><div className="font-display text-[20px] font-semibold text-ink">{aed(price * 1.04)}</div></div>
        </div>
        <PlanBar plan={p.plan} height={12} />
        <div className="max-h-[300px] overflow-y-auto rounded-xl" style={{ border: `1px solid ${SWK.line}` }}>
          <table className="swk-table">
            <thead><tr><th>Milestone</th><th>Date</th><th className="num">%</th><th className="num">Amount</th></tr></thead>
            <tbody>
              {plan.rows.map((r, k) => (
                <motion.tr key={`${r.label}-${k}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: k * .03 }}>
                  <td><span className="inline-flex items-center gap-2"><span className="w-2 h-2 rounded-full flex-none" style={{ background: phaseColor(r.phase) }} />{r.label}</span></td>
                  <td className="text-muted text-[12.5px]">{r.date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</td>
                  <td className="num">{r.pct.toFixed(1)}</td>
                  <td className="num font-semibold">{aed(r.amount)}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div></div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white p-4" style={{ border: `1px solid ${SWK.line}` }}>
          <div className="flex items-center gap-2 font-semibold text-ink text-[13.5px]"><ShieldCheck size={16} style={{ color: SWK.oasis }} /> Escrow & Oqood</div>
          <p className="text-[12px] text-muted mt-1.5 leading-relaxed">All instalments must be paid into the project escrow account at {p.escrow} (Dubai Law 8 of 2007) — never to the developer or SWK directly. The SPA is registered on the DLD interim register (Oqood) for a 4% fee; buyers receive an Oqood certificate until the title deed is issued at handover.</p>
        </div>
        <div className="rounded-2xl bg-white p-4" style={{ border: `1px solid ${SWK.line}` }}>
          <div className="flex items-center gap-2 font-semibold text-ink text-[13.5px]"><Lock size={16} style={{ color: SWK.dune }} /> Anti-flipping / resale</div>
          <p className="text-[12px] text-muted mt-1.5 leading-relaxed">{p.developer} issues a resale / assignment NOC only after <b className="text-ink">{p.minPaidResale}%</b> of the price is paid (≈ {aed(minPaid)} on this unit). Assignment fees typically apply (1–4%); the new buyer pays DLD Oqood transfer.</p>
        </div>
      </div>

      <div className="rounded-2xl p-4 text-white" style={{ background: `linear-gradient(135deg, ${SWK.navy}, ${SWK.midnight})` }}>
        <div className="flex items-center justify-between gap-2"><span className="swk-eyebrow" style={{ color: '#ecdcb9' }}>SWK commission estimate</span><span className="text-[11px] text-white/60">{p.commission}% developer-paid</span></div>
        <div className="font-display text-[28px] font-semibold mt-1" style={{ color: '#ecdcb9' }}>{aed(gross)}</div>
        <div className="text-[12px] text-white/70">+ VAT {aed(gross * UAE.vat)} · invoice {aed(gross * (1 + UAE.vat))}</div>
        <label className="block mt-3 text-[12px] text-white/80">Agent split {split}% → agent {aed(gross * split / 100)} · SWK net {aed(gross * (100 - split) / 100)}
          <input type="range" min={30} max={80} step={5} value={split} onChange={e => setSplit(Number(e.target.value))} className="w-full mt-1" style={{ accentColor: SWK.champ }} aria-label="Agent split percent" />
        </label>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button className="swk-btn swk-btn-gold" onClick={async () => { if (await copyText(wa)) onToast('WhatsApp brochure text copied') }}><Copy size={15} /> Copy brochure text</button>
        <a className="swk-btn swk-btn-primary" href={`https://wa.me/?text=${encodeURIComponent(wa)}`} target="_blank" rel="noreferrer"><MessageCircle size={15} /> Share via WhatsApp</a>
      </div>
    </div>
  )
}

function DeveloperLeague({ projects }: { projects: Project[] }) {
  const rows = Object.values(projects.reduce<Record<string, { dev: string; n: number; comp: number; avail: number; from: number }>>((acc, p) => {
    const r = acc[p.developer] ??= { dev: p.developer, n: 0, comp: 0, avail: 0, from: Infinity }
    r.n++; r.comp += p.completion; r.avail += p.avail; r.from = Math.min(r.from, p.from); return acc
  }, {})).map(r => ({ ...r, comp: r.comp / r.n })).sort((a, b) => b.n - a.n || b.comp - a.comp)
  const maxN = Math.max(...rows.map(r => r.n), 1)
  return (
    <Reveal>
      <Card title={<span className="inline-flex items-center gap-2"><Trophy size={18} style={{ color: SWK.champDeep }} /> Developer league</span>} subtitle="Ranked by active launches, then average construction progress" actions={<SamplePill label="Indicative" />}>
        <div className="grid gap-x-8 md:grid-cols-2">
          {rows.map((r, k) => {
            const logo = devLogo(r.dev)
            return (
              <motion.div key={r.dev} className="swk-row" initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: k * .05 }}>
                <span className="w-7 text-center font-display font-semibold" style={{ color: k < 3 ? SWK.champDeep : SWK.muted }}>{k + 1}</span>
                <span className="swk-row-ic !bg-white" style={{ border: `1px solid ${SWK.line}` }}>{logo ? <img src={logo} alt="" className="w-7 h-7 object-contain" /> : <Building size={16} />}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between gap-2"><span className="swk-row-t">{r.dev}</span><span className="text-[12px] text-muted tabular-nums">{r.n} project{r.n > 1 ? 's' : ''} · {Math.round(r.comp)}% avg</span></div>
                  <div className="mt-1.5 flex items-center gap-2"><div className="flex-1"><Bar value={r.n} max={maxN} color={SWK.navy} height={6} delay={k * .05} /></div><div className="w-20"><Bar value={r.comp} color={SWK.oasis} height={6} delay={k * .05} /></div></div>
                  <div className="swk-row-s mt-1">{num(r.avail)} units available · from {aed(r.from, { compact: true })}</div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </Card>
    </Reveal>
  )
}

void COMMUNITIES
