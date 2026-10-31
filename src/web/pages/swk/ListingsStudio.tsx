/**
 * Listing Studio — portal-ready listing quality, Trakheesi compliance gate and syndication control.
 * Inspired by Property Finder "Expert" quality score, Bayut TruCheck™ and PropSpace syndication.
 * Data: /api/e/properties, /api/e/units, /api/e/mandates (Form A). Portal state & stats are indicative (Sample).
 */
import { useMemo, useState } from 'react'
import { permitStatus, permitUsable, type PermitStatus } from '@shared/uae-rules'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Bar as RBar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  AlertTriangle, ArrowUpRight, BadgeCheck, Bath, BedDouble, Camera, CheckCircle2, Clock, Copy, FileSignature, Globe2, LayoutGrid,
  ListChecks, Maximize2, QrCode, Rows3, ShieldAlert, ShieldCheck, Sparkles, Wand2, XCircle,
} from 'lucide-react'
import { get } from '../../lib/api'
import { useMeta } from '../../lib/meta'
import { Card, CHART, EmptyState, ModuleHeader, Pill, ProgressRing, Reveal, RevealItem, Segmented, StatTile, SWK, aed, num } from '../../swk/ui'
import { communityByName, type Community } from '../../swk/uae'
import { copyText, daysBetween, Drawer, hash, parseDate, SearchField, SelectField, useToasts } from './kit3/parts'

type Row = Record<string, any>
type List = { rows: Row[]; total: number }

const PHOTOS = ['marina-sky-penthouse-1', 'palm-garden-homes-1', 'hills-estate-golf-mansion-1', 'business-bay-executive-tower-2', 'creek-harbour-waterside-townhouse-1', 'jvc-boulevard-residences-2', 'arabian-ranches-courtyard-villa-2', 'villa-sanctuary-6', 'islands-2-1', 'river-cove-residences-1', 'raw-district-2-3', 'golf-fields-1']
const PORTALS = [
  { key: 'pf', name: 'Property Finder', color: '#c4492f' },
  { key: 'bayut', name: 'Bayut', color: SWK.oasis },
  { key: 'dubizzle', name: 'dubizzle', color: SWK.dune },
  { key: 'web', name: 'SWK website', color: SWK.navy },
] as const

type Check = { key: string; label: string; weight: number; earned: number; fix: string; icon: any }
type Listing = {
  p: Row; community?: Community; img: string; score: number; grade: 'Excellent' | 'Good' | 'Needs work'; checks: Check[]
  permit: boolean; permitState: PermitStatus; mandate?: Row; mandateDays?: number; days: number; ppsf: number; ppsfDelta?: number; units: Row[]; live: Record<string, boolean>
}

const gradeOf = (s: number): Listing['grade'] => (s >= 80 ? 'Excellent' : s >= 60 ? 'Good' : 'Needs work')
const gradeColor = (g: Listing['grade']) => (g === 'Excellent' ? SWK.oasis : g === 'Good' ? SWK.champ : SWK.dune)
const statusTone = (s?: string) => (s === 'Available' ? 'oasis' : s === 'Off-Plan' ? 'sky' : s === 'Under Offer' || s === 'Reserved' ? 'champ' : s === 'Withdrawn' ? 'dune' : 'grey') as any

/** Pick a deterministic marketing photo, preferring one matching the community. */
function photoFor(p: Row) {
  const t = `${p.title ?? ''} ${p.address ?? ''}`.toLowerCase()
  const match = t.includes('marina') ? 'marina-sky-penthouse-1' : t.includes('palm') ? 'palm-garden-homes-1' : t.includes('hills') ? 'hills-estate-golf-mansion-1'
    : t.includes('business bay') ? 'business-bay-executive-tower-2' : t.includes('creek') ? 'creek-harbour-waterside-townhouse-1' : t.includes('jvc') ? 'jvc-boulevard-residences-2'
    : t.includes('ranches') ? 'arabian-ranches-courtyard-villa-2' : undefined
  return `/media/properties/${match ?? PHOTOS[hash(p.id ?? p.title) % PHOTOS.length]}.webp`
}

/** Listing quality engine (0–100). Weights sum to 100. */
function scoreListing(p: Row, community: Community | undefined, mandate: Row | undefined, today: Date) {
  const media = Array.isArray(p.media) ? p.media.length : 0
  const desc = String(p.description ?? '').trim().length
  const permitState = permitStatus(p.rera_permit_no, p.permit_expiry, today.toISOString().slice(0, 10))
  const permit = permitUsable(permitState)
  const deed = !!(p.title_deed_no || p.makani) || !!p.is_off_plan
  const price = Number(p.price || p.rent_annual || 0), area = Number(p.area_sqft || 0)
  const ppsf = Number(p.price_per_sqft) || (p.price && area ? p.price / area : 0)
  const delta = community && ppsf ? ((ppsf - community.ppsf) / community.ppsf) * 100 : undefined
  const listed = parseDate(p.listed_date) ?? today
  const days = Math.max(0, daysBetween(listed, today))
  const checks: Check[] = [
    { key: 'photos', label: 'Photo set (≥ 10 HD photos)', weight: 12, earned: media >= 10 ? 12 : media >= 5 ? 8 : media > 0 ? 4 : 0, fix: `Upload ${Math.max(0, 10 - media)} more HD photos (portals rank 10+ photo listings higher).`, icon: Camera },
    { key: 'desc', label: 'Description ≥ 300 characters', weight: 12, earned: desc >= 300 ? 12 : desc >= 80 ? 6 : 0, fix: `Description is ${desc} chars — use the AI copy helper to reach 300+.`, icon: ListChecks },
    { key: 'permit', label: 'Trakheesi / RERA advert permit', weight: 18, earned: permit ? 18 : 0, fix: 'Apply for or renew the Trakheesi permit (DLD) — ads without a valid permit and Madmoun QR are blocked.', icon: QrCode },
    { key: 'deed', label: p.is_off_plan ? 'Oqood / SPA reference' : 'Title deed or Makani no.', weight: 8, earned: deed ? 8 : 0, fix: 'Add the title deed number or Makani number for TruCheck-style verification.', icon: BadgeCheck },
    { key: 'basics', label: 'Price & area present', weight: 10, earned: price && area ? 10 : price || area ? 5 : 0, fix: 'Complete price and built-up area (sq ft).', icon: Maximize2 },
    { key: 'ppsf', label: 'AED/sq ft within ±20% of community', weight: 10, earned: delta === undefined ? 5 : Math.abs(delta) <= 20 ? 10 : Math.abs(delta) <= 35 ? 5 : 0, fix: delta === undefined ? 'Community not matched to DLD index — tag the community.' : `Priced ${delta > 0 ? '+' : ''}${delta.toFixed(0)}% vs ${community!.name} average — review with the owner.`, icon: Sparkles },
    { key: 'excl', label: 'Exclusive mandate', weight: 8, earned: p.is_exclusive || mandate?.exclusive ? 8 : 0, fix: 'Convert to an exclusive Form A — exclusives get the portal "Verified/Exclusive" badge.', icon: ShieldCheck },
    { key: 'mandate', label: 'Active Form A (listing agreement)', weight: 12, earned: mandate ? 12 : 0, fix: 'Sign a RERA Form A with the owner before advertising.', icon: FileSignature },
    { key: 'fresh', label: 'Fresh (listed ≤ 30 days)', weight: 10, earned: days <= 30 ? 10 : days <= 60 ? 5 : 0, fix: `Listed ${days} days ago — refresh photos/price and re-publish.`, icon: Clock },
  ]
  const score = checks.reduce((s, c) => s + c.earned, 0)
  return { checks, score, permit, permitState, days, ppsf, delta }
}

function useListings() {
  const props = useQuery({ queryKey: ['swk-ls', 'properties'], queryFn: () => get<List>('/api/e/properties', { pageSize: 500 }) })
  const units = useQuery({ queryKey: ['swk-ls', 'units'], queryFn: () => get<List>('/api/e/units', { pageSize: 500 }) })
  const mandates = useQuery({ queryKey: ['swk-ls', 'mandates'], queryFn: () => get<List>('/api/e/mandates', { pageSize: 500 }) })
  const leads = useQuery({ queryKey: ['swk-ls', 'leads'], queryFn: () => get<List>('/api/e/leads', { pageSize: 500 }) })
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }, [])
  const listings = useMemo<Listing[]>(() => (props.data?.rows ?? []).map(p => {
    const community = communityByName(p.community_id && isNaN(Number(p.community_id)) ? p.community_id : `${p.title ?? ''}`) ?? communityByName(p.address) ?? communityByName(p.sub_community)
    const ms = (mandates.data?.rows ?? []).filter(m => m.property_id === p.id)
    const mandate = ms.find(m => m.status === 'Active')
    const end = parseDate(mandate?.end_date)
    const s = scoreListing(p, community, mandate, today)
    const sellable = ['Available', 'Off-Plan', 'Under Offer'].includes(p.status) && p.active !== false
    const publish = mandate ? mandate.portal_publish !== false : true
    const live = Object.fromEntries(PORTALS.map(pt => [pt.key, pt.key === 'web' ? sellable : sellable && s.permit && publish && p.status !== 'Under Offer']))
    return { p, community, img: photoFor(p), score: s.score, grade: gradeOf(s.score), checks: s.checks, permit: s.permit, permitState: s.permitState, mandate, mandateDays: end ? daysBetween(today, end) : undefined, days: s.days, ppsf: s.ppsf, ppsfDelta: s.delta, units: (units.data?.rows ?? []).filter(u => u.property_id === p.id), live }
  }), [props.data, units.data, mandates.data, today])
  return { listings, mandates: mandates.data?.rows ?? [], leads: leads.data?.rows ?? [], loading: props.isLoading, error: props.error as Error | null, today }
}

// ------------------------------------------------------------------ copy generator
type Tone = 'luxury' | 'investor' | 'family'
function buildCopy(l: Listing, tone: Tone) {
  const p = l.p
  const beds = Number(p.bedrooms || 0), baths = Number(p.bathrooms || 0), sqft = Number(p.area_sqft || 0)
  const where = l.community?.name ?? p.sub_community ?? 'Dubai'
  const type = String(p.property_type || 'Residence')
  const bedTxt = type === 'Studio' || !beds ? 'Studio' : `${beds}-Bedroom`
  const priceTxt = p.price ? aed(p.price) : p.rent_annual ? `${aed(p.rent_annual)} / year` : 'Price on request'
  const features = String(p.features ?? '').split(/[,;\n]/).map(s => s.trim()).filter(Boolean)
  const amen = String(p.amenities ?? '').split(/[,;\n]/).map(s => s.trim()).filter(Boolean)
  const hook = tone === 'luxury' ? `An exceptional ${bedTxt.toLowerCase()} ${type.toLowerCase()} in the heart of ${where}, curated for those who expect the finest of Dubai living.`
    : tone === 'investor' ? `A high-performing ${bedTxt.toLowerCase()} ${type.toLowerCase()} in ${where}${l.community ? `, a community averaging ${l.community.yieldPct}% gross rental yield` : ''}.`
      : `A bright, spacious ${bedTxt.toLowerCase()} ${type.toLowerCase()} in family-friendly ${where}, close to schools, parks and daily essentials.`
  const en = [
    `${bedTxt} ${type} | ${where} | ${p.is_off_plan ? 'Off-Plan' : 'Ready'}${p.is_exclusive ? ' | Exclusive with SWK' : ''}`,
    '',
    hook,
    '',
    `• ${sqft ? `${num(sqft)} sq ft built-up area` : 'Generous built-up area'}${beds ? ` · ${beds} bedrooms` : ''}${baths ? ` · ${baths} bathrooms` : ''}`,
    p.furnishing ? `• ${p.furnishing}${p.tenure ? ` · ${p.tenure}` : ''}` : p.tenure ? `• ${p.tenure} ownership` : '',
    ...features.slice(0, 4).map(f => `• ${f}`),
    amen.length ? `• Community amenities: ${amen.slice(0, 5).join(', ')}` : '',
    p.is_off_plan && p.payment_plan ? `• Payment plan: ${p.payment_plan}${p.completion_year ? ` · Handover ${p.completion_year}` : ''}` : '',
    tone === 'investor' && p.rent_annual && p.price ? `• Indicative gross yield: ${((p.rent_annual / p.price) * 100).toFixed(1)}%` : '',
    p.price && p.price >= 2_000_000 ? '• Eligible for the UAE 10-year Golden Visa (property value ≥ AED 2M, subject to ICP/GDRFA approval)' : '',
    '',
    `Price: ${priceTxt}`,
    `Trakheesi permit: ${p.rera_permit_no || '[PERMIT REQUIRED]'}${p.permit_expiry ? ` (valid until ${String(p.permit_expiry).slice(0, 10)})` : ''} · Ref: ${p.property_no ?? p.id}`,
    'SWK Properties · RERA ORN 51517 · Scan the Madmoun QR to verify this listing.',
  ].filter(x => x !== '').join('\n').replace(/\n\n\n+/g, '\n\n')
  const arType = ({ Apartment: 'شقة', Villa: 'فيلا', Townhouse: 'تاون هاوس', Studio: 'استوديو', Penthouse: 'بنتهاوس', Duplex: 'دوبلكس' } as Record<string, string>)[type] ?? 'عقار'
  const ar = [
    `${p.price ? 'للبيع' : 'للإيجار'}: ${arType}${beds ? ` ${beds} غرف نوم` : ''} في ${where}، دبي`,
    '',
    tone === 'investor' ? 'فرصة استثمارية مميزة بعائد إيجاري جذاب.' : tone === 'family' ? 'منزل عائلي واسع بالقرب من المدارس والحدائق.' : 'عنوان للفخامة وأسلوب الحياة الراقي في دبي.',
    sqft ? `• المساحة: ${num(sqft)} قدم مربع` : '',
    baths ? `• عدد الحمامات: ${baths}` : '',
    p.is_off_plan ? `• على الخارطة${p.payment_plan ? ` — خطة الدفع ${p.payment_plan}` : ''}` : '• جاهز للسكن',
    `• السعر: ${p.price ? `${num(p.price)} درهم` : p.rent_annual ? `${num(p.rent_annual)} درهم سنوياً` : 'عند الطلب'}`,
    `• رقم تصريح تراخيص: ${p.rera_permit_no || '[مطلوب]'}`,
    '',
    'إس دبليو كي العقارية · رقم المكتب (ORN) 51517 · امسح رمز مضمون للتحقق.',
  ].filter(Boolean).join('\n')
  return { en, ar }
}

// ------------------------------------------------------------------ page
export default function ListingsStudio() {
  const { can } = useMeta()
  const { listings, mandates, leads, loading, error, today } = useListings()
  const toasts = useToasts()
  const [view, setView] = useState<'gallery' | 'table'>('gallery')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [type, setType] = useState('all')
  const [comm, setComm] = useState('all')
  const [stage, setStage] = useState<'all' | 'offplan' | 'ready'>('all')
  const [sort, setSort] = useState<'score' | 'newest' | 'price'>('score')
  const [panel, setPanel] = useState<{ id: number; tab: 'quality' | 'copy' } | null>(null)

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    const out = listings.filter(l => (status === 'all' || l.p.status === status) && (type === 'all' || l.p.property_type === type)
      && (comm === 'all' || (l.community?.name ?? 'Other') === comm) && (stage === 'all' || (stage === 'offplan' ? !!l.p.is_off_plan : !l.p.is_off_plan))
      && (!s || `${l.p.title} ${l.p.property_no} ${l.p.rera_permit_no ?? ''} ${l.community?.name ?? ''} ${l.p.building_name ?? ''}`.toLowerCase().includes(s)))
    return out.sort((a, b) => sort === 'score' ? b.score - a.score : sort === 'price' ? Number(b.p.price || 0) - Number(a.p.price || 0) : a.days - b.days)
  }, [listings, q, status, type, comm, stage, sort])

  const live = listings.filter(l => ['Available', 'Off-Plan', 'Under Offer'].includes(l.p.status) && l.p.active !== false)
  const avgScore = listings.length ? listings.reduce((s, l) => s + l.score, 0) / listings.length : 0
  const noPermit = listings.filter(l => !l.permit)
  const expiring = mandates.filter(m => m.status === 'Active' && m.end_date && (() => { const d = daysBetween(today, parseDate(m.end_date)!); return d >= 0 && d <= 14 })())
  const stale = live.filter(l => l.days > 30)
  const opt = (arr: string[]) => [{ value: 'all', label: 'All' }, ...[...new Set(arr)].filter(Boolean).sort().map(v => ({ value: v, label: v }))]
  const selected = panel ? listings.find(l => l.p.id === panel.id) : undefined

  const gradeMix = (['Excellent', 'Good', 'Needs work'] as const).map(g => ({ g, n: listings.filter(l => l.grade === g).length }))

  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader eyebrow="Marketing · Portals" icon={<Wand2 size={22} />} title="Listing Studio"
        subtitle="Score every listing like Property Finder & Bayut do, clear the Trakheesi gate, and syndicate with confidence."
        actions={<>
          <button className="swk-btn swk-btn-ghost" disabled={!listings.length} onClick={() => filtered[0] && setPanel({ id: filtered[0].p.id, tab: 'copy' })}><Sparkles size={16} /> AI listing copy</button>
          {can('properties', 'create') && <Link to="/e/properties?new=1" className="swk-btn swk-btn-primary"><Rows3 size={16} /> New listing</Link>}
        </>} />

      <Reveal className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
        <StatTile label="Live listings" value={live.length} icon={<Globe2 size={16} />} hint={`${listings.length} in inventory`} tone="navy" />
        <StatTile label="Avg quality score" value={avgScore} format={v => `${Math.round(v)}/100`} icon={<BadgeCheck size={16} />} hint={gradeOf(avgScore)} />
        <StatTile label="Missing Trakheesi" value={noPermit.length} icon={<QrCode size={16} />} hint={noPermit.length ? 'Blocked from portals' : 'All permitted'} />
        <StatTile label="Form A expiring ≤ 14d" value={expiring.length} icon={<FileSignature size={16} />} hint={`${mandates.filter(m => m.status === 'Active').length} active mandates`} to="/e/mandates" />
        <StatTile label="Stale (> 30 days)" value={stale.length} icon={<Clock size={16} />} hint="Refresh & re-publish" tone="champ" />
      </Reveal>

      <Reveal className="grid gap-4 lg:grid-cols-3">
        <Card title="Quality distribution" subtitle="Weighted engine: permit, Form A, media, copy, pricing, freshness">
          <div className="flex items-center gap-5">
            <ProgressRing value={avgScore} size={120} stroke={11} color={gradeColor(gradeOf(avgScore))} label={Math.round(avgScore)} sub="avg score" />
            <div className="flex-1 flex flex-col gap-3">
              {gradeMix.map((g, i) => (
                <div key={g.g}>
                  <div className="flex justify-between text-[12.5px] mb-1"><span className="font-semibold text-ink">{g.g}</span><span className="text-muted tabular-nums">{g.n}</span></div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: '#efe9dc' }}>
                    <motion.div className="h-full rounded-full" style={{ background: gradeColor(g.g) }} initial={{ width: 0 }} whileInView={{ width: `${listings.length ? (g.n / listings.length) * 100 : 0}%` }} viewport={{ once: true }} transition={{ duration: 1, delay: i * .12 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
        <Card title="Compliance gate" subtitle="Every ad needs a valid Trakheesi permit + Madmoun QR (DLD / RERA)" actions={<ShieldAlert size={18} style={{ color: noPermit.length ? SWK.dune : SWK.oasis }} />}>
          {noPermit.length ? (
            <div className="flex flex-col">
              {noPermit.slice(0, 4).map(l => (
                <Link key={l.p.id} to={`/e/properties/${l.p.id}`} className="swk-row">
                  <span className="swk-row-ic" style={{ background: '#fbe4dd', color: SWK.dune }}><XCircle size={17} /></span>
                  <span className="min-w-0 flex-1"><span className="swk-row-t block">{l.p.title}</span><span className="swk-row-s block">{l.permitState === 'Expired' ? 'Blocked from portals — Trakheesi permit expired' : 'Blocked from portals — Trakheesi permit required'}</span></span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-4 py-2">
              <motion.span className="swk-row-ic !w-14 !h-14 !rounded-2xl" style={{ background: '#def1ef', color: SWK.oasis }} initial={{ scale: .6, rotate: -20 }} whileInView={{ scale: 1, rotate: 0 }} viewport={{ once: true }} transition={{ type: 'spring', stiffness: 260, damping: 14 }}><ShieldCheck size={26} /></motion.span>
              <div><div className="font-display text-[17px] font-semibold text-ink">All listings permitted</div><div className="text-[12.5px] text-muted">{listings.length} adverts carry a Trakheesi permit number. Verify Madmoun QR on each portal before going live.</div></div>
            </div>
          )}
          <div className="mt-3 text-[11.5px] text-muted leading-relaxed">Advertising without a permit risks DLD fines and portal suspension. Permits are listing-specific and must match price, agent BRN and Form A.</div>
        </Card>
        <PortalPerformance listings={listings} leads={leads} />
      </Reveal>

      <Reveal className="grid gap-4">
        <RevealItem className="swk-card">
          <div className="swk-card-body flex flex-col gap-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[200px] flex-1"><SearchField value={q} onChange={setQ} placeholder="Title, permit no., community…" /></div>
              <SelectField label="Status" value={status} onChange={setStatus} options={opt(listings.map(l => l.p.status))} className="min-w-[140px]" />
              <SelectField label="Type" value={type} onChange={setType} options={opt(listings.map(l => l.p.property_type))} className="min-w-[140px]" />
              <SelectField label="Community" value={comm} onChange={setComm} options={opt(listings.map(l => l.community?.name ?? 'Other'))} className="min-w-[170px]" />
              <SelectField label="Sort" value={sort} onChange={v => setSort(v as any)} options={[{ value: 'score', label: 'Quality score' }, { value: 'newest', label: 'Newest' }, { value: 'price', label: 'Price' }]} className="min-w-[140px]" />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Segmented layoutId="ls-stage" value={stage} onChange={setStage} options={[{ value: 'all', label: 'All' }, { value: 'offplan', label: 'Off-plan' }, { value: 'ready', label: 'Ready' }]} />
              <div className="flex items-center gap-3">
                <span className="text-[12.5px] text-muted tabular-nums">{filtered.length} of {listings.length}</span>
                <Segmented layoutId="ls-view" value={view} onChange={setView} options={[{ value: 'gallery', label: <span className="inline-flex items-center gap-1.5"><LayoutGrid size={14} /> Gallery</span> }, { value: 'table', label: <span className="inline-flex items-center gap-1.5"><Rows3 size={14} /> Table</span> }]} />
              </div>
            </div>
          </div>
        </RevealItem>
      </Reveal>

      {loading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map(i => <div key={i} className="swk-card h-[420px] animate-pulse" />)}</div>
        : error ? <EmptyState title="Could not load listings" hint={error.message} />
          : !filtered.length ? <EmptyState title="No listings match" hint="Clear filters or add a property." />
            : view === 'gallery' ? (
              <motion.div layout className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                <AnimatePresence mode="popLayout">
                  {filtered.map((l, i) => <ListingCard key={l.p.id} l={l} i={i} onQuality={() => setPanel({ id: l.p.id, tab: 'quality' })} onCopy={() => setPanel({ id: l.p.id, tab: 'copy' })} />)}
                </AnimatePresence>
              </motion.div>
            ) : <ListingTable rows={filtered} onOpen={id => setPanel({ id, tab: 'quality' })} />}

      <Drawer open={!!selected} onClose={() => setPanel(null)} eyebrow={selected ? `${selected.p.property_no ?? ''} · ${selected.community?.name ?? 'Dubai'}` : ''} title={selected?.p.title ?? ''} width={620}
        footer={selected && <Link to={`/e/properties/${selected.p.id}`} className="swk-btn swk-btn-primary"><ArrowUpRight size={16} /> Open property record</Link>}>
        {selected && panel && (
          <div className="flex flex-col gap-5">
            <Segmented layoutId="ls-panel" value={panel.tab} onChange={t => setPanel({ ...panel, tab: t })} options={[{ value: 'quality', label: 'Quality & fixes' }, { value: 'copy', label: 'AI listing copy' }]} />
            {panel.tab === 'quality' ? <QualityPanel l={selected} /> : <CopyPanel l={selected} onCopied={m => toasts.push(m)} />}
          </div>
        )}
      </Drawer>
      {toasts.node}
    </div>
  )
}

function PortalChips({ l }: { l: Listing }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PORTALS.map(pt => {
        const on = l.live[pt.key]
        return (
          <span key={pt.key} className="inline-flex items-center gap-1.5 h-[24px] px-2 rounded-full text-[11px] font-semibold" style={{ background: on ? '#fff' : '#f2eee6', color: on ? SWK.ink : SWK.muted, border: `1px solid ${on ? SWK.line : 'transparent'}` }} title={`${pt.name}: ${on ? 'Live' : 'Paused'}`}>
            <span className="relative flex w-1.5 h-1.5">
              {on && <span className="absolute inset-0 rounded-full animate-ping" style={{ background: SWK.oasis, opacity: .5 }} />}
              <span className="relative w-1.5 h-1.5 rounded-full" style={{ background: on ? SWK.oasis : '#b9b2a3' }} />
            </span>
            {pt.name}
          </span>
        )
      })}
    </div>
  )
}

function ListingCard({ l, i, onQuality, onCopy }: { l: Listing; i: number; onQuality: () => void; onCopy: () => void }) {
  const p = l.p
  return (
    <motion.article layout initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: .95 }} transition={{ duration: .45, delay: Math.min(i, 8) * .04, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -4 }} className="swk-card overflow-hidden flex flex-col group">
      <div className="relative h-[200px] overflow-hidden">
        <motion.div className="absolute inset-0 bg-cover bg-center transition-transform duration-[1.2s] group-hover:scale-[1.06]" style={{ backgroundImage: `url(${l.img})` }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(11,26,51,.15) 0%, rgba(11,26,51,0) 40%, rgba(11,26,51,.78) 100%)' }} />
        <div className="absolute top-3 left-3 flex gap-1.5 flex-wrap">
          <Pill tone={statusTone(p.status)}>{p.status}</Pill>
          {p.is_off_plan && <Pill tone="sky">Off-plan</Pill>}
          {(p.is_exclusive || l.mandate?.exclusive) && <Pill tone="champ">Exclusive</Pill>}
        </div>
        <button onClick={onQuality} aria-label={`Quality score ${l.score}, open fixes`} className="absolute top-3 right-3 rounded-full p-1" style={{ background: 'rgba(255,255,255,.94)', boxShadow: '0 8px 20px -10px rgba(0,0,0,.5)' }}>
          <ProgressRing value={l.score} size={56} stroke={6} color={gradeColor(l.grade)} label={l.score} />
        </button>
        <div className="absolute bottom-3 left-4 right-4 text-white">
          <div className="font-display text-[22px] font-semibold leading-none">{p.price ? aed(p.price) : p.rent_annual ? `${aed(p.rent_annual)}/yr` : 'POA'}</div>
          <div className="text-[12px] opacity-80 mt-1">{l.ppsf ? `${aed(l.ppsf)}/sq ft` : ''}{l.ppsfDelta !== undefined ? ` · ${l.ppsfDelta > 0 ? '+' : ''}${l.ppsfDelta.toFixed(0)}% vs community` : ''}</div>
        </div>
      </div>
      <div className="p-4 flex flex-col gap-3 flex-1">
        <div>
          <Link to={`/e/properties/${p.id}`} className="font-display text-[16px] font-semibold text-ink leading-snug hover:underline decoration-[#c9a96e] underline-offset-4">{p.title}</Link>
          <div className="text-[12.5px] text-muted mt-0.5">{l.community?.name ?? p.address ?? 'Dubai'} · {p.property_type}{l.units.length ? ` · ${l.units.length} unit${l.units.length > 1 ? 's' : ''}` : ''}</div>
        </div>
        <div className="flex items-center gap-4 text-[12.5px] text-ink">
          <span className="inline-flex items-center gap-1.5"><BedDouble size={15} className="text-muted" />{p.bedrooms ?? '—'}</span>
          <span className="inline-flex items-center gap-1.5"><Bath size={15} className="text-muted" />{p.bathrooms ?? '—'}</span>
          <span className="inline-flex items-center gap-1.5"><Maximize2 size={14} className="text-muted" />{p.area_sqft ? `${num(p.area_sqft)} sq ft` : '—'}</span>
          <span className="ml-auto text-[11.5px] text-muted inline-flex items-center gap-1"><Clock size={12} />{l.days}d</span>
        </div>
        {l.permit ? (
          <div className="flex items-center gap-2 text-[11.5px] text-muted"><QrCode size={14} style={{ color: l.permitState === 'Valid' ? SWK.oasis : SWK.dune }} /> Trakheesi <b className="text-ink font-semibold">{p.rera_permit_no}</b>{l.permitState === 'Expiring' && <span> · expires {String(p.permit_expiry).slice(0, 10)}</span>}{l.permitState === 'No expiry' && <span> · add expiry date</span>}</div>
        ) : (
          <div className="flex items-start gap-2 rounded-xl px-3 py-2 text-[12px] font-medium" style={{ background: '#fbe4dd', color: '#a33a22' }}><AlertTriangle size={15} className="flex-none mt-px" /> {l.permitState === 'Expired' ? 'Blocked from portals — Trakheesi permit expired' : 'Blocked from portals — Trakheesi permit required'}</div>
        )}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-wider text-muted font-semibold">Syndication <Pill tone="grey" className="!h-[18px] !text-[10px]">Trakheesi & Form A</Pill></div>
          <PortalChips l={l} />
        </div>
        <div className="mt-auto pt-2 flex gap-2">
          <button className="swk-btn swk-btn-ghost !h-9 flex-1 text-[12.5px]" onClick={onQuality}><ListChecks size={15} /> {l.checks.filter(c => c.earned < c.weight).length} fixes</button>
          <button className="swk-btn swk-btn-gold !h-9 flex-1 text-[12.5px]" onClick={onCopy}><Sparkles size={15} /> AI copy</button>
          <Link to={`/e/properties/${p.id}`} className="swk-btn swk-btn-ghost !h-9 !w-9 !p-0" aria-label={`Open ${p.title}`}><ArrowUpRight size={16} /></Link>
        </div>
      </div>
    </motion.article>
  )
}

function ListingTable({ rows, onOpen }: { rows: Listing[]; onOpen: (id: number) => void }) {
  return (
    <Reveal>
      <RevealItem className="swk-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="swk-table min-w-[980px]">
            <thead><tr><th>Listing</th><th>Community</th><th>Status</th><th className="num">Price</th><th className="num">AED/sq ft</th><th>Trakheesi</th><th>Form A</th><th>Portals</th><th className="num">Days</th><th>Score</th></tr></thead>
            <tbody>
              {rows.map(l => (
                <tr key={l.p.id}>
                  <td><div className="flex items-center gap-3"><span className="w-12 h-9 rounded-lg bg-cover bg-center flex-none" style={{ backgroundImage: `url(${l.img})` }} /><span className="min-w-0"><Link to={`/e/properties/${l.p.id}`} className="font-semibold hover:underline block truncate max-w-[240px]">{l.p.title}</Link><span className="text-[11.5px] text-muted">{l.p.property_no} · {l.p.property_type}</span></span></div></td>
                  <td>{l.community?.name ?? '—'}</td>
                  <td><Pill tone={statusTone(l.p.status)}>{l.p.status}</Pill></td>
                  <td className="num">{l.p.price ? aed(l.p.price, { compact: true }) : '—'}</td>
                  <td className="num">{l.ppsf ? num(l.ppsf) : '—'}{l.ppsfDelta !== undefined && <span className="block text-[11px]" style={{ color: Math.abs(l.ppsfDelta) <= 20 ? SWK.oasis : SWK.dune }}>{l.ppsfDelta > 0 ? '+' : ''}{l.ppsfDelta.toFixed(0)}%</span>}</td>
                  <td>{l.permit ? <span className="inline-flex items-center gap-1 text-[12.5px]"><CheckCircle2 size={14} style={{ color: SWK.oasis }} />{l.p.rera_permit_no}</span> : <Pill tone="dune">{l.permitState === 'Expired' ? 'Expired' : 'Blocked'}</Pill>}</td>
                  <td>{l.mandate ? <span className="text-[12.5px]">{l.mandate.mandate_no}<span className="block text-[11px]" style={{ color: (l.mandateDays ?? 99) <= 14 ? SWK.dune : SWK.muted }}>{l.mandateDays !== undefined ? `${l.mandateDays}d left` : ''}</span></span> : <Pill tone="grey">None</Pill>}</td>
                  <td><span className="tabular-nums text-[12.5px]">{Object.values(l.live).filter(Boolean).length}/4 live</span></td>
                  <td className="num">{l.days}</td>
                  <td><button onClick={() => onOpen(l.p.id)} className="flex items-center gap-2" aria-label={`Open quality fixes for ${l.p.title}`}><ProgressRing value={l.score} size={40} stroke={5} color={gradeColor(l.grade)} label={l.score} /><span className="text-[12px] font-semibold" style={{ color: gradeColor(l.grade) }}>{l.grade}</span></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </RevealItem>
    </Reveal>
  )
}

function QualityPanel({ l }: { l: Listing }) {
  const missing = l.checks.filter(c => c.earned < c.weight)
  return (
    <div className="flex flex-col gap-5">
      <div className="swk-card"><div className="swk-card-body flex items-center gap-5">
        <ProgressRing value={l.score} size={128} stroke={12} color={gradeColor(l.grade)} label={l.score} sub={l.grade} />
        <div className="flex-1 min-w-0">
          <div className="font-display text-[18px] font-semibold text-ink">{l.grade === 'Excellent' ? 'Portal-ready' : l.grade === 'Good' ? 'Almost there' : 'Needs work before publishing'}</div>
          <p className="text-[12.5px] text-muted mt-1">{missing.length ? `Fix ${missing.length} item${missing.length > 1 ? 's' : ''} to gain up to ${missing.reduce((s, c) => s + c.weight - c.earned, 0)} points.` : 'Every quality check passes.'}</p>
          {!l.permit && <div className="mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-[12px] font-medium" style={{ background: '#fbe4dd', color: '#a33a22' }}><AlertTriangle size={15} className="flex-none mt-px" /> {l.permitState === 'Expired' ? 'Blocked from portals — Trakheesi permit expired' : 'Blocked from portals — Trakheesi permit required'}</div>}
        </div>
      </div></div>
      <div className="flex flex-col gap-2">
        {l.checks.map((c, i) => {
          const ok = c.earned >= c.weight, part = c.earned > 0 && !ok
          const Icon = c.icon
          return (
            <motion.div key={c.key} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * .04 }} className="rounded-2xl bg-white px-4 py-3 flex items-start gap-3" style={{ border: `1px solid ${SWK.line}` }}>
              <span className="swk-row-ic !w-9 !h-9" style={{ background: ok ? '#def1ef' : part ? '#f4ead5' : '#fbe4dd', color: ok ? SWK.oasis : part ? SWK.champDeep : SWK.dune }}><Icon size={16} /></span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2"><span className="text-[13.5px] font-semibold text-ink">{c.label}</span><span className="text-[12px] tabular-nums font-semibold" style={{ color: ok ? SWK.oasis : part ? SWK.champDeep : SWK.dune }}>{c.earned}/{c.weight}</span></div>
                {!ok && <div className="text-[12px] text-muted mt-0.5">{c.fix}</div>}
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

function CopyPanel({ l, onCopied }: { l: Listing; onCopied: (m: string) => void }) {
  const [tone, setTone] = useState<Tone>('luxury')
  const copy = useMemo(() => buildCopy(l, tone), [l, tone])
  const doCopy = async (t: string, what: string) => { if (await copyText(t)) onCopied(`${what} copied to clipboard`) }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Segmented layoutId="ls-tone" value={tone} onChange={setTone} options={[{ value: 'luxury', label: 'Luxury' }, { value: 'investor', label: 'Investor' }, { value: 'family', label: 'Family' }]} />
        <Pill tone="champ">Bilingual EN + AR</Pill>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={tone} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="flex flex-col gap-4">
          <div className="rounded-2xl bg-white p-4" style={{ border: `1px solid ${SWK.line}` }}>
            <div className="flex items-center justify-between mb-2"><span className="swk-eyebrow">English · {copy.en.length} chars</span><button className="swk-btn swk-btn-ghost !h-8 text-[12px]" onClick={() => doCopy(copy.en, 'English description')}><Copy size={14} /> Copy</button></div>
            <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-ink">{copy.en}</pre>
          </div>
          <div className="rounded-2xl bg-white p-4" style={{ border: `1px solid ${SWK.line}` }}>
            <div className="flex items-center justify-between mb-2"><span className="swk-eyebrow">العربية · Arabic-ready</span><button className="swk-btn swk-btn-ghost !h-8 text-[12px]" onClick={() => doCopy(copy.ar, 'Arabic description')}><Copy size={14} /> Copy</button></div>
            <pre dir="rtl" lang="ar" className="whitespace-pre-wrap font-sans text-[13.5px] leading-loose text-ink text-right">{copy.ar}</pre>
          </div>
        </motion.div>
      </AnimatePresence>
      <button className="swk-btn swk-btn-gold" onClick={() => doCopy(`${copy.en}\n\n---\n\n${copy.ar}`, 'Bilingual description')}><Copy size={15} /> Copy both (EN + AR)</button>
      <p className="text-[11.5px] text-muted">Review before publishing: RERA advertising rules require accurate price, permit number, agent BRN and no misleading claims (e.g. guaranteed returns).</p>
    </div>
  )
}

function PortalPerformance({ listings, leads }: { listings: Listing[]; leads: Row[] }) {
  const stats = useMemo(() => {
    return PORTALS.map(pt => {
      const syndicated = listings.filter(l => l.live[pt.key]).length
      const matchedLeads = leads.filter(ld => {
        const src = `${ld.source ?? ''} ${ld.notes ?? ''}`.toLowerCase()
        if (pt.key === 'pf') return src.includes('property finder') || src.includes('pf') || (ld.source === 'Portal enquiry' && !src.includes('bayut') && !src.includes('dubizzle'))
        if (pt.key === 'bayut') return src.includes('bayut')
        if (pt.key === 'dubizzle') return src.includes('dubizzle')
        return ld.source === 'Website' || src.includes('website')
      }).length
      return { portal: pt.name, syndicated, leads: matchedLeads }
    })
  }, [listings, leads])
  return (
    <Card title="Portal syndication & leads" subtitle="Live syndicated listings vs inbound leads by channel">
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stats} margin={{ top: 6, right: 4, left: -18, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#efe9dc" />
            <XAxis dataKey="portal" tick={{ fontSize: 10.5, fill: SWK.muted }} axisLine={false} tickLine={false} interval={0} tickFormatter={(v: string) => v.split(' ')[0]} />
            <YAxis tick={{ fontSize: 10, fill: SWK.muted }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip cursor={{ fill: 'rgba(201,169,110,.08)' }} contentStyle={{ borderRadius: 12, border: `1px solid ${SWK.line}`, fontSize: 12 }} formatter={(v: any) => num(Number(v))} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
            <RBar dataKey="syndicated" name="Live Listings" fill={CHART[0]} radius={[6, 6, 0, 0]} animationDuration={1100} />
            <RBar dataKey="leads" name="Leads" fill={CHART[1]} radius={[6, 6, 0, 0]} animationDuration={1300} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 text-[11.5px] text-muted">Active feeds: {stats.map(s => `${s.portal.split(' ')[0]} (${s.syndicated} live · ${s.leads} leads)`).join(' · ')}</div>
    </Card>
  )
}
