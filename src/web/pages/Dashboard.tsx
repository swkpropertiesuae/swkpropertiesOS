import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'motion/react'
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  AlertTriangle, ArrowRight, ArrowUpRight, BadgeCheck, Bot, Building2, Calculator, CalendarCheck, CalendarDays, Clock, FileSignature, Gavel,
  HandCoins, Home, KanbanSquare, KeyRound, LineChart, Megaphone, Percent, Plus, Rocket, Sparkles, Trophy, UserPlus, Users, Wallet, Wrench,
} from 'lucide-react'
import { get } from '../lib/api'
import { useMeta } from '../lib/meta'
import { fmtDate, fmtDateTime } from '../lib/format'
import { ErrorBox } from '../ui/kit'
import { AnimatedNumber, Bar, CHART, Card, EmptyState, Pill, ProgressRing, Reveal, RevealItem, SWK, Sparkline, StatTile, aed, num, rise } from '../swk/ui'
import { COMMUNITIES } from '../swk/uae'

const PHOTOS = ['marina-sky-penthouse-1', 'palm-garden-homes-1', 'hills-estate-golf-mansion-1', 'business-bay-executive-tower-2', 'creek-harbour-waterside-townhouse-1', 'jvc-boulevard-residences-2', 'arabian-ranches-courtyard-villa-2', 'villa-sanctuary-6', 'islands-2-1', 'river-cove-residences-1']
const photoFor = (id: number) => `/media/properties/${PHOTOS[Math.abs(id) % PHOTOS.length]}.webp`

function dubaiHour() { return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dubai', hour: '2-digit', hour12: false }).format(new Date())) }
function greeting() { const h = dubaiHour(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening' }
const STAGE_PROB: Record<string, number> = { Inquiry: 0.1, Closed: 1, Lead: 0.1, Viewing: 0.2, Offer: 0.4, Negotiation: 0.55, Contract: 0.75, 'DLD Process': 0.9, Handover: 0.95 }

export function Dashboard() {
  const { me, can } = useMeta()
  const nav = useNavigate()
  const reduce = useReducedMotion()
  const q = useQuery({ queryKey: ['dashboard'], queryFn: () => get<any>('/api/dashboard'), refetchInterval: 120000 })
  const props = useQuery({ queryKey: ['dash-props'], queryFn: () => get<any>('/api/e/properties', { pageSize: 12, sort: 'listed_date', dir: 'desc' }), enabled: can('properties', 'view') })
  const units = useQuery({ queryKey: ['dash-units'], queryFn: () => get<any>('/api/e/units', { pageSize: 500 }), enabled: can('properties', 'view') })
  const brief = useQuery({ queryKey: ['ai-brief'], queryFn: () => get<{ output: string; started_at: string; name: string }>('/api/ai/brief'), retry: false, enabled: can('ai', 'view') })

  const d = q.data ?? {}, k = d.kpis ?? {}, ch = d.charts ?? {}, ls = d.lists ?? {}
  const unitRows: any[] = units.data?.rows ?? []
  const occupied = unitRows.filter(u => /leased|occupied|rented|sold/i.test(u.status ?? '')).length
  const occupancy = unitRows.length ? (occupied / unitRows.length) * 100 : 0
  const funnel: any[] = ch.pipeline_funnel ?? []
  const funnelMax = Math.max(1, ...funnel.map(s => Number(s.count) || 0))
  const pipelineTotal = funnel.filter(f => f.stage !== 'Closed').reduce((s, f) => s + (Number(f.value) || 0), 0)
  const weighted = funnel.filter(f => f.stage !== 'Closed').reduce((s, f) => s + (Number(f.value) || 0) * (STAGE_PROB[f.stage] ?? 0.3), 0)
  const trend: any[] = ch.revenue_trend ?? []
  const agenda = useMemo(() => [
    ...(ls.upcoming_viewings ?? []).map((v: any) => ({ id: `v${v.id}`, kind: 'Viewing', at: v.scheduled_at, title: v.property_title || 'Property viewing', sub: [v.contact, v.agent].filter(Boolean).join(' · '), to: `/e/viewings/${v.id}`, Icon: CalendarCheck })),
    ...(ls.target_closes ?? []).map((j: any) => ({ id: `j${j.id}`, kind: 'Target close', at: j.target_close, title: j.property || j.job_no, sub: j.client, to: `/e/jobs/${j.id}`, Icon: FileSignature })),
    ...(ls.renewals ?? []).map((l: any) => ({ id: `l${l.id}`, kind: 'Lease renewal', at: l.end_date, title: l.unit_title || 'Lease', sub: l.tenant, to: `/e/leases/${l.id}`, Icon: KeyRound })),
  ].sort((a, b) => String(a.at ?? '').localeCompare(String(b.at ?? ''))).slice(0, 7), [ls])

  if (q.error) return <ErrorBox error={q.error} onRetry={() => void q.refetch()} />
  if (!q.data) return <DashboardSkeleton />

  const firstName = (me?.name || '').split(' ')[0] || 'there'
  const summary = [
    k.viewings_week !== undefined && `${k.viewings_week} viewing${k.viewings_week === 1 ? '' : 's'} this week`,
    k.offers_pending !== undefined && `${k.offers_pending} offer${k.offers_pending === 1 ? '' : 's'} awaiting a decision`,
    k.leads_today !== undefined && `${k.leads_today} new lead${k.leads_today === 1 ? '' : 's'} today`,
  ].filter(Boolean).join(' · ')

  return (
    <div className="grid gap-5 max-w-[1680px] mx-auto">
      {/* ------------------------------------------------------------ hero */}
      <motion.section className="relative overflow-hidden rounded-[26px] text-white" style={{ background: 'linear-gradient(120deg, #0b1a33 0%, #14305c 55%, #1d4f86 120%)' }}
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>
        <div className="absolute inset-0 opacity-[.22] bg-cover bg-center mix-blend-luminosity" style={{ backgroundImage: 'url(/media/hero/dubai-skyline-hero.webp)', backgroundPosition: 'center 40%' }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(11,26,51,.96) 0%, rgba(11,26,51,.78) 45%, rgba(11,26,51,.25) 100%)' }} />
        {!reduce && <motion.div className="absolute -top-24 right-[12%] w-[420px] h-[420px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(201,169,110,.28), transparent 65%)' }} animate={{ x: [0, -30, 0], y: [0, 20, 0] }} transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }} />}
        <img src="/brand/skyline-front.svg" alt="" aria-hidden className="absolute bottom-0 left-0 w-full h-[70px] opacity-[.18] pointer-events-none" />
        <div className="relative grid gap-6 lg:grid-cols-[1.4fr_1fr] items-end p-6 sm:p-8">
          <div>
            <div className="text-[11px] font-semibold tracking-[.26em] uppercase text-[#dcc8a2]">{new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dubai', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}</div>
            <h1 className="m-0 mt-2 font-display font-medium text-white text-[30px] sm:text-[40px] leading-[1.05]">{greeting()}, <span className="swk-shimmer-text font-semibold">{firstName}</span></h1>
            <p className="mt-3 mb-0 text-[15px] text-[#c3cde0] max-w-[620px]">{summary || 'Here is what is happening across your listings, deals and leases today.'}</p>
            <div className="flex flex-wrap gap-2 mt-5">
              {can('crm', 'create') && <Link to="/e/leads?new=1" className="swk-btn swk-btn-gold"><UserPlus size={16} />New lead</Link>}
              {can('mandates', 'create') && <Link to="/e/viewings?new=1" className="swk-btn" style={{ color: '#fff', background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.18)' }}><CalendarCheck size={16} />Book viewing</Link>}
              <Link to="/toolkit" className="swk-btn" style={{ color: '#fff', background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.18)' }}><Calculator size={16} />Deal toolkit</Link>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { l: 'Pipeline', v: pipelineTotal, f: (x: number) => aed(x, { compact: true }) },
              { l: 'Weighted GCI', v: weighted * 0.02, f: (x: number) => aed(x, { compact: true }) },
              { l: 'Occupancy', v: occupancy, f: (x: number) => `${x.toFixed(0)}%` },
            ].map((s, i) => (
              <motion.div key={s.l} className="swk-glass px-4 py-3.5" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 + i * 0.08, duration: 0.6 }}>
                <div className="text-[10.5px] uppercase tracking-[.16em] text-[#a9b8d2]">{s.l}</div>
                <div className="font-display text-[20px] sm:text-[24px] font-semibold text-white mt-1"><AnimatedNumber value={s.v} format={s.f} /></div>
              </motion.div>))}
          </div>
        </div>
      </motion.section>

      {/* ------------------------------------------------------------ KPI strip */}
      <Reveal className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Leads today" value={Number(k.leads_today ?? 0)} hint={`${k.leads_qualified ?? 0} qualified`} icon={<UserPlus size={16} />} to="/e/leads" spark={[2, 3, 2, 4, 3, 5, Number(k.leads_today ?? 0) + 3]} />
        <StatTile label="Viewings · 7 days" value={Number(k.viewings_week ?? 0)} hint={`${k.viewings_missed ?? 0} no-shows (30d)`} icon={<CalendarCheck size={16} />} to="/e/viewings" />
        <StatTile label="Offers pending" value={Number(k.offers_pending ?? 0)} hint="Awaiting seller / landlord" icon={<HandCoins size={16} />} to="/e/offers" />
        <StatTile label="Live listings" value={Number(k.properties_available ?? 0)} hint={`${k.properties_reserved ?? 0} under offer`} icon={<Building2 size={16} />} to="/listings" />
        <StatTile label="Commission received" value={Number(k.received_month ?? 0)} format={v => aed(v, { compact: true })} hint="This month" icon={<Percent size={16} />} to="/e/receipts" tone="champ" />
        <StatTile label="Rent arrears" value={Number(k.arrears_aed ?? 0)} format={v => aed(v, { compact: true })} hint={`${k.arrears_count ?? 0} cheques overdue`} icon={<Wallet size={16} />} to="/pdc" tone="navy" />
      </Reveal>

      {/* ------------------------------------------------------------ attention */}
      {d.alerts?.length > 0 && (
        <Reveal className="grid gap-2">
          {d.alerts.slice(0, 4).map((a: any, i: number) => (
            <RevealItem key={i}>
              <Link to={a.link} className="flex items-center gap-3 px-4 py-3 rounded-2xl border text-[13.5px] transition-colors hover:brightness-[.98]" style={{ background: a.level === 'danger' ? '#fbeae5' : a.level === 'warn' ? '#fbf3e2' : '#eef2f9', borderColor: a.level === 'danger' ? '#f0c6ba' : a.level === 'warn' ? '#ecdcb6' : '#d8e1f0', color: SWK.ink }}>
                <AlertTriangle size={17} color={a.level === 'danger' ? SWK.dune : a.level === 'warn' ? SWK.champDeep : SWK.ocean} /><span className="flex-1" dir="auto">{a.text}</span><ArrowRight size={15} />
              </Link>
            </RevealItem>))}
        </Reveal>)}

      {/* ------------------------------------------------------------ pipeline + agenda */}
      <Reveal className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-8" title="Sales pipeline" subtitle="Deals by stage · count and value (AED)" to="/pipeline"
          actions={<Pill tone="champ">Weighted {aed(weighted, { compact: true })}</Pill>}>
          {funnel.every(s => !Number(s.count)) ? <EmptyState title="No deals in the pipeline yet" hint="Open a deal file and it will move through these stages." action={can('sales', 'create') && <Link to="/e/jobs?new=1" className="swk-btn swk-btn-primary mt-2"><Plus size={16} />Open a deal</Link>} /> : (
            <div className="grid gap-3 pt-1">
              {funnel.map((s, i) => (
                <div key={s.stage} className="grid grid-cols-[120px_1fr_auto] sm:grid-cols-[150px_1fr_150px] items-center gap-3">
                  <div className="text-[13px] font-semibold text-ink truncate">{s.stage}</div>
                  <div className="relative h-9 rounded-xl bg-[#f3eee4] overflow-hidden">
                    <motion.div className="absolute inset-y-0 left-0 rounded-xl flex items-center px-3 text-[12px] font-semibold text-white" style={{ background: `linear-gradient(90deg, ${CHART[i % 2 ? 3 : 0]}, ${i % 2 ? SWK.sky : SWK.ocean})` }}
                      initial={{ width: 0 }} whileInView={{ width: `${Math.max(8, (Number(s.count) / funnelMax) * 100)}%` }} viewport={{ once: true }} transition={{ duration: 1, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}>
                      {Number(s.count) > 0 && `${s.count} deal${Number(s.count) === 1 ? '' : 's'}`}
                    </motion.div>
                  </div>
                  <div className="text-right text-[13px] font-semibold text-ink tabular-nums">{aed(Number(s.value), { compact: true })}<div className="text-[11px] font-medium text-muted">{Math.round((STAGE_PROB[s.stage] ?? 0.3) * 100)}% likely</div></div>
                </div>))}
            </div>)}
        </Card>

        <Card className="xl:col-span-4" title="Today & upcoming" subtitle="Viewings, target closes and renewals" to="/calendar">
          {agenda.length === 0 ? <EmptyState title="Nothing scheduled" hint="Viewings, transfer dates and renewals will appear here." /> : (
            <ol className="relative m-0 p-0 list-none">
              <span className="absolute left-[18px] top-2 bottom-2 w-px bg-gradient-to-b from-[#c9a96e] to-transparent" />
              {agenda.map((a, i) => (
                <motion.li key={a.id} className="relative" initial={{ opacity: 0, x: -8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}>
                  <Link to={a.to} className="flex items-start gap-3 py-2.5 group">
                    <span className="relative z-[1] w-9 h-9 rounded-xl grid place-items-center flex-none bg-white border border-[#e7e1d4] text-[#14305c] group-hover:border-[#c9a96e] transition-colors"><a.Icon size={16} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2"><span className="text-[11px] font-semibold uppercase tracking-wider text-[#9a7a42]">{a.kind}</span><span className="text-[11.5px] text-muted">{a.kind === 'Viewing' ? fmtDateTime(a.at) : fmtDate(a.at)}</span></span>
                      <span className="block text-[13.5px] font-semibold text-ink truncate">{a.title}</span>
                      {a.sub && <span className="block text-[12px] text-muted truncate">{a.sub}</span>}
                    </span>
                  </Link>
                </motion.li>))}
            </ol>)}
        </Card>
      </Reveal>

      {/* ------------------------------------------------------------ revenue + portfolio + market */}
      <Reveal className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-5" title="Commission & revenue" subtitle="By deal month (AED)" to={can('reports', 'view') ? '/reports' : undefined}>
          <div style={{ height: 250 }}>
            {trend.every(r => !Number(r.revenue) && !Number(r.profit)) ? <EmptyState title="No revenue posted yet" hint="Commission invoices will build this trend." /> : (
              <ResponsiveContainer><AreaChart data={trend} margin={{ top: 10, right: 6, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={SWK.navy} stopOpacity={0.35} /><stop offset="100%" stopColor={SWK.navy} stopOpacity={0} /></linearGradient>
                  <linearGradient id="gPro" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={SWK.champ} stopOpacity={0.45} /><stop offset="100%" stopColor={SWK.champ} stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 4" stroke="#ece6da" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={v => aed(v, { compact: true }).replace('AED ', '')} width={52} />
                <Tooltip formatter={(v: any) => aed(Number(v))} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke={SWK.navy} strokeWidth={2.4} fill="url(#gRev)" />
                <Area type="monotone" dataKey="profit" name="Net" stroke={SWK.champDeep} strokeWidth={2.4} fill="url(#gPro)" />
              </AreaChart></ResponsiveContainer>)}
          </div>
        </Card>

        <Card className="xl:col-span-3" title="Portfolio" subtitle="Units and listing status" to="/e/units">
          <div className="flex items-center gap-4">
            <ProgressRing value={occupancy} size={108} label={`${occupancy.toFixed(0)}%`} sub="occupied" color={SWK.oasis} />
            <div className="grid gap-1.5 text-[13px] flex-1 min-w-0">
              <div className="swk-kv"><span>Units managed</span><b>{num(unitRows.length)}</b></div>
              <div className="swk-kv"><span>Vacant</span><b>{num(k.vacant_units ?? unitRows.length - occupied)}</b></div>
              <div className="swk-kv"><span>Renewals · 90d</span><b>{num(k.renewals_due ?? 0)}</b></div>
            </div>
          </div>
          {(ch.properties_status ?? []).length > 0 && (
            <div className="flex items-center gap-3 mt-3">
              <div style={{ width: 96, height: 96 }} className="flex-none"><ResponsiveContainer><PieChart><Pie data={ch.properties_status} dataKey="value" nameKey="name" innerRadius={30} outerRadius={46} paddingAngle={3} cornerRadius={4} stroke="none">{ch.properties_status.map((_: any, i: number) => <Cell key={i} fill={CHART[i % CHART.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
              <ul className="m-0 p-0 list-none grid gap-1 text-[12.5px] flex-1 min-w-0">{ch.properties_status.map((s: any, i: number) => <li key={s.name} className="flex items-center gap-2"><i className="w-2.5 h-2.5 rounded-full flex-none" style={{ background: CHART[i % CHART.length] }} /><span className="truncate flex-1 text-body">{s.name}</span><b className="text-ink">{s.value}</b></li>)}</ul>
            </div>)}
        </Card>

        <Card className="xl:col-span-4" title="Market pulse" subtitle="Price per sq ft · year on year" to="/market" actions={<Pill tone="grey">Indicative</Pill>}>
          <div className="grid gap-0.5">
            {COMMUNITIES.slice(0, 5).map(c => {
              const yoy = ((c.ppsf - c.ppsfLY) / c.ppsfLY) * 100
              return (
                <Link key={c.id} to="/market" className="flex items-center gap-3 py-2 rounded-xl hover:bg-[#faf6ee] px-1 -mx-1 transition-colors">
                  <span className="w-10 h-10 rounded-xl bg-cover bg-center flex-none" style={{ backgroundImage: `url(${c.image.replace('.webp', '-640.webp')}), url(${c.image})` }} />
                  <span className="min-w-0 flex-1"><span className="block text-[13.5px] font-semibold text-ink truncate">{c.name}</span><span className="block text-[12px] text-muted">AED {num(c.ppsf)}/sqft · {c.yieldPct}% yield</span></span>
                  <Sparkline data={c.trend} width={70} height={26} color={SWK.oasis} />
                  <span className="text-[12px] font-semibold text-[#157a52] w-[52px] text-right">+{yoy.toFixed(1)}%</span>
                </Link>)
            })}
          </div>
        </Card>
      </Reveal>

      {/* ------------------------------------------------------------ featured listings */}
      {(props.data?.rows ?? []).length > 0 && (
        <section>
          <div className="flex items-end justify-between gap-3 mb-3">
            <div><div className="swk-eyebrow">Inventory</div><h2 className="m-0 text-[20px] font-semibold text-ink">Latest listings</h2></div>
            <Link to="/listings" className="swk-btn swk-btn-ghost">Listing Studio <ArrowUpRight size={15} /></Link>
          </div>
          <Reveal className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {props.data.rows.slice(0, 4).map((p: any) => (
              <motion.div key={p.id} variants={rise} whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 300, damping: 24 }}>
                <Link to={`/e/properties/${p.id}`} className="block swk-card group">
                  <div className="relative h-[170px] overflow-hidden">
                    <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-[1.06]" style={{ backgroundImage: `url(${photoFor(p.id)})` }} />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0b1a33]/70 to-transparent" />
                    <div className="absolute top-3 left-3 flex gap-1.5">{p.is_off_plan ? <Pill tone="champ">Off-plan</Pill> : <Pill tone="navy">Ready</Pill>}{p.is_exclusive && <Pill tone="oasis">Exclusive</Pill>}</div>
                    <div className="absolute bottom-3 left-3 right-3 text-white font-display text-[19px] font-semibold">{p.price ? aed(p.price) : p.rent_annual ? `${aed(p.rent_annual)}/yr` : 'Price on request'}</div>
                  </div>
                  <div className="p-4">
                    <div className="text-[14px] font-semibold text-ink truncate">{p.title}</div>
                    <div className="text-[12.5px] text-muted truncate">{p.address || p.property_type}</div>
                    <div className="flex items-center gap-3 mt-2.5 text-[12.5px] text-body">
                      <span>{p.bedrooms ? `${p.bedrooms} BR` : 'Studio'}</span><span className="w-1 h-1 rounded-full bg-[#d4c7ad]" /><span>{num(p.area_sqft)} sqft</span>
                      {p.rera_permit_no ? <span className="ml-auto inline-flex items-center gap-1 text-[#17625f] font-semibold"><BadgeCheck size={14} />Permit</span> : <span className="ml-auto text-[#a33a22] font-semibold">No permit</span>}
                    </div>
                  </div>
                </Link>
              </motion.div>))}
          </Reveal>
        </section>)}

      {/* ------------------------------------------------------------ work queues */}
      <Reveal className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card title="Lead queue" subtitle="Respond within 15 minutes to win the lead" to="/e/leads" actions={can('crm', 'create') && <Link to="/e/leads?new=1" className="swk-icon-link" aria-label="New lead"><Plus size={16} /></Link>}>
          {(ls.lead_queue ?? []).length === 0 ? <EmptyState title="Inbox zero" hint="New portal, WhatsApp and website enquiries land here." /> : ls.lead_queue.slice(0, 6).map((l: any) => (
            <Link key={l.id} to={`/e/leads/${l.id}`} className="swk-row hover:bg-[#faf6ee] rounded-xl px-1 -mx-1">
              <span className="swk-row-ic"><Users size={16} /></span>
              <span className="min-w-0 flex-1"><span className="swk-row-t block">{l.contact_name || l.company}</span><span className="swk-row-s block">{[l.source, l.phone].filter(Boolean).join(' · ')}</span></span>
              <span className="text-right"><span className="block text-[12.5px] font-semibold text-ink">{l.est_value ? aed(l.est_value, { compact: true }) : '—'}</span><Pill tone={/new/i.test(l.status) ? 'dune' : 'navy'}>{l.status}</Pill></span>
            </Link>))}
        </Card>

        <Card title="Offers awaiting decision" subtitle="Purchase and lease offers" to="/e/offers">
          {(ls.offers_pipeline ?? []).length === 0 ? <EmptyState title="No pending offers" hint="Submitted and negotiating offers appear here." /> : ls.offers_pipeline.slice(0, 6).map((o: any) => (
            <Link key={o.id} to={`/e/offers/${o.id}`} className="swk-row hover:bg-[#faf6ee] rounded-xl px-1 -mx-1">
              <span className="swk-row-ic"><HandCoins size={16} /></span>
              <span className="min-w-0 flex-1"><span className="swk-row-t block">{o.property_title}</span><span className="swk-row-s block">{o.buyer} · {fmtDate(o.offer_date)}</span></span>
              <span className="text-right"><span className="block text-[12.5px] font-semibold text-ink">{aed(o.offer_price, { compact: true })}</span><Pill tone="champ">{o.status}</Pill></span>
            </Link>))}
        </Card>

        <Card title="Compliance watch" subtitle="RERA, DLD and licence health" to="/rera" tone="champ">
          {[
            { l: 'Mandates (Form A) expiring · 14d', v: Number(k.mandates_expiring ?? 0), to: '/e/mandates', Icon: FileSignature },
            { l: 'Stale listings · 21+ days', v: Number(k.stale_listings ?? 0), to: '/listings', Icon: Megaphone },
            { l: 'Licence & document issues', v: Number(k.compliance_issues ?? 0), to: '/compliance', Icon: Gavel },
            { l: 'Open maintenance', v: Number(k.maintenance_open ?? 0), to: '/e/maintenance', Icon: Wrench },
          ].map(r => (
            <Link key={r.l} to={r.to} className="swk-row">
              <span className="swk-row-ic" style={{ background: '#fff' }}><r.Icon size={16} /></span>
              <span className="swk-row-t flex-1">{r.l}</span>
              <span className="font-display text-[18px] font-semibold" style={{ color: r.v > 0 ? SWK.dune : SWK.oasis }}>{r.v}</span>
            </Link>))}
          <div className="mt-3"><div className="flex justify-between text-[12px] mb-1.5"><span className="text-muted">Mandates active</span><b className="text-ink">{k.mandates_active ?? 0}</b></div><Bar value={Number(k.mandates_active ?? 0) - Number(k.mandates_expiring ?? 0)} max={Math.max(1, Number(k.mandates_active ?? 0))} color={SWK.oasis} /></div>
        </Card>
      </Reveal>

      {/* ------------------------------------------------------------ AI brief */}
      {brief.data?.output && (
        <Reveal>
          <Card title={<span className="inline-flex items-center gap-2"><Bot size={18} />{brief.data.name} · today’s briefing</span>} subtitle={String(brief.data.started_at).replace('T', ' ').slice(0, 16)} to="/ai" tone="navy">
            <div dir="auto" className="text-[13.5px] whitespace-pre-line leading-relaxed text-[#d9e1ee] max-h-[220px] overflow-auto">{brief.data.output}</div>
          </Card>
        </Reveal>)}

      {/* ------------------------------------------------------------ module launcher */}
      <section>
        <div className="mb-3"><div className="swk-eyebrow">SWK OS suite</div><h2 className="m-0 text-[20px] font-semibold text-ink">Jump into a workspace</h2></div>
        <Reveal className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          {[
            { l: 'Deal Pipeline', s: 'Drag deals to MOU & transfer', to: '/pipeline', I: KanbanSquare },
            { l: 'Market Pulse', s: 'Prices, yields, supply', to: '/market', I: LineChart },
            { l: 'Off-Plan', s: 'Launches & payment plans', to: '/offplan', I: Rocket },
            { l: 'PDC Vault', s: 'Cheques & deposits', to: '/pdc', I: Wallet },
            { l: 'Owner 360', s: 'Landlord portfolios', to: '/owners', I: Home },
            { l: 'Leaderboard', s: 'Agent GCI & licences', to: '/agents', I: Trophy },
            { l: 'RERA Centre', s: 'BRN, Trakheesi, AML', to: '/rera', I: Gavel },
            { l: 'Deal Toolkit', s: 'DLD fees, mortgage, RERA', to: '/toolkit', I: Calculator },
            { l: 'Listing Studio', s: 'Quality & portals', to: '/listings', I: Megaphone },
            { l: 'Calendar', s: 'Viewings & transfers', to: '/calendar', I: CalendarDays },
            { l: 'AI Concierge', s: 'Briefings & approvals', to: '/ai', I: Sparkles },
            { l: 'Activity', s: 'Calls & follow-ups', to: '/e/activities', I: Clock },
          ].map(m => (
            <motion.div key={m.to} variants={rise} whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 320, damping: 22 }}>
              <Link to={m.to} className="group flex flex-col gap-3 h-full p-4 rounded-[18px] bg-white border border-[#e7e1d4] hover:border-[#dccaa6] hover:shadow-[0_18px_36px_-24px_rgba(11,26,51,.45)] transition-all">
                <span className="w-10 h-10 rounded-xl grid place-items-center text-[#c9a96e] transition-transform group-hover:rotate-[-6deg] group-hover:scale-110" style={{ background: 'linear-gradient(145deg,#1b3a6b,#0b1a33)' }}><m.I size={18} /></span>
                <span><span className="block text-[14px] font-semibold text-ink">{m.l}</span><span className="block text-[12px] text-muted">{m.s}</span></span>
              </Link>
            </motion.div>))}
        </Reveal>
      </section>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-5 max-w-[1680px] mx-auto" aria-busy="true" aria-label="Loading dashboard">
      <div className="h-[230px] rounded-[26px] animate-pulse" style={{ background: 'linear-gradient(120deg,#0b1a33,#14305c)' }} />
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }, (_, i) => <div key={i} className="h-[118px] rounded-[18px] bg-white border border-[#e7e1d4] animate-pulse" />)}</div>
      <div className="grid gap-4 xl:grid-cols-12"><div className="xl:col-span-8 h-[320px] rounded-[20px] bg-white border border-[#e7e1d4] animate-pulse" /><div className="xl:col-span-4 h-[320px] rounded-[20px] bg-white border border-[#e7e1d4] animate-pulse" /></div>
    </div>
  )
}
