import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { AlertTriangle, BadgeCheck, CalendarClock, Crown, GraduationCap, Medal, PauseCircle, Plus, Trophy, Users, Wallet } from 'lucide-react'
import { aed, AnimatedNumber, Bar, Card, EmptyState, ModuleHeader, Pill, ProgressRing, Reveal, Segmented, StatTile, SWK, num, pct } from '../../swk/ui'
import { Avatar, daysUntil, fmtD, INK, MUTED, toDate, useRows, type Row } from './brokerage/common'

type Agent = {
  id: number; name: string; no: string; brn: string; card: string; expiry?: string; status: string; tier: string; spec: string; split: number
  deals: number; gci: number; viewings: number; leads: number; listings: number; conversion: number; activities: number
  rank: number; target: number; earned: number; pending: number; paid: number
}
const TIER_TARGET: Record<string, number> = { Standard: 180_000, Senior: 320_000, Partner: 500_000, Custom: 250_000 }
const quarterStart = () => { const d = new Date(); return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1) }
const qLabel = () => { const d = new Date(); return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}` }

function licence(expiry?: string, status?: string) {
  const d = daysUntil(expiry)
  if (status === 'Licence Expired' || (d !== null && d < 0)) return { label: 'Expired', tone: 'dune' as const, d }
  if (d === null) return { label: 'No expiry on file', tone: 'grey' as const, d }
  if (d <= 60) return { label: `Expiring · ${d}d`, tone: 'champ' as const, d }
  return { label: 'Valid', tone: 'oasis' as const, d }
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HOURS = Array.from({ length: 14 }, (_, i) => 8 + i)

export default function AgentsPage() {
  const agentsQ = useRows('agents'), jobsQ = useRows('jobs'), viewingsQ = useRows('viewings'), leadsQ = useRows('leads'), comQ = useRows('agent_commissions'), propsQ = useRows('properties'), actQ = useRows('activities'), empsQ = useRows('employees')
  const [sort, setSort] = useState<'gci' | 'deals' | 'viewings' | 'conversion'>('gci')

  const agents: Agent[] = useMemo(() => {
    const qs = quarterStart()
    const jobs = jobsQ.data ?? [], views = viewingsQ.data ?? [], leads = leadsQ.data ?? [], coms = comQ.data ?? [], props = propsQ.data ?? [], acts = actQ.data ?? [], emps = empsQ.data ?? []
    const empUserMap = new Map<number, number>(emps.map((e: Row) => [Number(e.id), Number(e.user_id)]))
    const list = (agentsQ.data ?? []).filter((a: Row) => a.status !== 'Resigned').map((a: Row): Agent => {
      const userId = empUserMap.get(Number(a.employee_id))
      const mine = jobs.filter(j => j.agent_id === a.id || j.buyer_agent_id === a.id)
      const closed = mine.filter(j => j.operational_status === 'Closed' || ['Completed', 'Title Deed Issued'].includes(j.job_status))
      const closedQ = closed.filter(j => (toDate(j.actual_close ?? j.deal_date) ?? new Date(0)) >= qs)
      const myComs = coms.filter(c => c.agent_id === a.id && c.status !== 'Cancelled')
      let gci = myComs.filter(c => (toDate(c.transaction_date) ?? new Date(0)) >= qs).reduce((s, c) => s + Number(c.gross_commission || 0), 0)
      if (!gci) gci = closedQ.reduce((s, j) => s + Number(j.deal_value || 0) * Number(j.commission_pct || 2) / 100, 0)
      const deals = closedQ.length
      const viewings = views.filter(v => v.agent_id === a.id).length
      const listings = props.filter(p => (p.agent_id === a.id || p.co_agent_id === a.id) && p.active !== false).length
      const splitPct = Number(a.commission_split_pct) || 50
      const earnedFromComs = myComs.reduce((s, c) => s + Number(c.agent_share || (Number(c.gross_commission || 0) * (Number(c.agent_split_pct || splitPct) / 100))), 0)
      const paid = myComs.filter(c => c.status === 'Paid').reduce((s, c) => s + Number(c.agent_share || (Number(c.gross_commission || 0) * (Number(c.agent_split_pct || splitPct) / 100))), 0)
      const pendingFromComs = myComs.filter(c => ['Pending', 'Approved'].includes(c.status)).reduce((s, c) => s + Number(c.agent_share || (Number(c.gross_commission || 0) * (Number(c.agent_split_pct || splitPct) / 100))), 0)
      const earned = earnedFromComs || Math.round(gci * (splitPct / 100))
      const pending = myComs.length ? pendingFromComs : Math.max(0, earned - paid)
      const myLeads = leads.filter(l => (userId && l.owner_id === userId) || l.owner_id === a.employee_id).length
      const myActs = acts.filter(ac => (userId && ac.owner_id === userId) || ac.owner_id === a.employee_id).length + viewings

      return {
        id: a.id, name: a.name, no: a.agent_no, brn: a.dld_broker_id ?? '—', card: a.rera_card_no ?? '—', expiry: a.dld_expiry, status: a.status, tier: a.commission_tier ?? 'Standard',
        spec: a.specialization ?? 'Residential', split: splitPct, deals, gci, viewings, leads: myLeads, listings,
        conversion: viewings ? (deals / viewings) * 100 : (mine.length ? (deals / mine.length) * 100 : 0),
        activities: myActs, rank: 0,
        target: TIER_TARGET[a.commission_tier ?? 'Standard'] ?? 200_000, earned, pending, paid,
      }
    })
    const byGci = [...list].sort((x, y) => y.gci - x.gci || y.deals - aDeals(x))
    byGci.forEach((a, i) => { a.rank = i + 1 })
    return list
  }, [agentsQ.data, jobsQ.data, viewingsQ.data, leadsQ.data, comQ.data, propsQ.data, actQ.data, empsQ.data])

  const sorted = [...agents].sort((a, b) => (b[sort] as number) - (a[sort] as number))
  const podium = [...agents].sort((a, b) => b.gci - a.gci).slice(0, 3)
  const totalGci = agents.reduce((s, a) => s + a.gci, 0)
  const totalDeals = agents.reduce((s, a) => s + a.deals, 0)
  const totalViewings = agents.reduce((s, a) => s + a.viewings, 0)
  const expired = agents.filter(a => licence(a.expiry, a.status).label === 'Expired')
  const expiring = agents.filter(a => licence(a.expiry, a.status).tone === 'champ')

  // Live heatmap from scheduled viewings and logged CRM activities
  const heat = useMemo(() => {
    const grid = DAYS.map(() => HOURS.map(() => 0))
    for (const v of viewingsQ.data ?? []) {
      const t = toDate(v.scheduled_at)
      if (!t) continue
      const di = (t.getDay() + 6) % 7, hi = t.getHours() - 8
      if (hi >= 0 && hi < HOURS.length) grid[di][hi] += 1
    }
    for (const ac of actQ.data ?? []) {
      const t = toDate(ac.start_at)
      if (!t) continue
      const di = (t.getDay() + 6) % 7, hi = t.getHours() - 8
      if (hi >= 0 && hi < HOURS.length) grid[di][hi] += 1
    }
    return grid
  }, [viewingsQ.data, actQ.data])
  const heatMax = Math.max(1, ...heat.flat())

  return (
    <div className="flex flex-col gap-5">
      <ModuleHeader eyebrow="People · Performance" icon={<Trophy size={22} />} title="Agent Leaderboard"
        subtitle={`${qLabel()} league table for DLD-registered brokers — live GCI, conversions, BRN licence health and commission wallets.`}
        actions={<>
          <Link to="/e/agent_commissions?new=1" className="swk-btn swk-btn-ghost"><Wallet size={15} />Log commission</Link>
          <Link to="/e/agents" className="swk-btn swk-btn-ghost"><Users size={15} />All agents</Link>
          <Link to="/e/agents?new=1" className="swk-btn swk-btn-primary"><Plus size={15} />New DLD agent</Link>
        </>} />

      <Reveal className="grid gap-4 grid-cols-2 xl:grid-cols-4">
        <StatTile tone="navy" label={`Team GCI · ${qLabel()}`} value={totalGci} format={v => aed(v, { compact: true })} icon={<Wallet size={16} />} hint="From commissions & closed deals" />
        <StatTile label="Deals closed" value={totalDeals} icon={<Medal size={16} />} hint={`${agents.length} active brokers`} />
        <StatTile label="Viewings conducted" value={totalViewings} icon={<CalendarClock size={16} />} hint="Accompanied client viewings" to="/e/viewings" />
        <StatTile tone="champ" label="BRN licence alerts" value={expired.length + expiring.length} icon={<BadgeCheck size={16} />} hint={expired.length ? `${expired.length} expired — listings paused` : 'All brokers valid'} />
      </Reveal>

      {agents.length === 0 && !agentsQ.isLoading ? (
        <EmptyState
          title="No DLD-registered agents recorded yet"
          hint="Add your RERA-certified brokers (with their BRN and DLD expiry date) to track GCI, commission splits, viewings and BRN compliance."
          action={<div className="flex gap-2 justify-center"><Link to="/e/employees?new=1" className="swk-btn swk-btn-ghost">1. Add HR employee</Link><Link to="/e/agents?new=1" className="swk-btn swk-btn-primary"><Plus size={15} /> 2. Register DLD agent</Link></div>}
        />
      ) : (
        <>
          {/* Podium */}
          <Reveal className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
            <Card title="Quarter podium" subtitle="Top three by gross commission income" tone="navy">
              <div className="flex items-end justify-center gap-3 sm:gap-6 pt-6 min-h-[300px]">
                {[podium[1], podium[0], podium[2]].map((a, i) => {
                  if (!a) return <div key={i} className="w-24" />
                  const place = a.rank, h = place === 1 ? 170 : place === 2 ? 125 : 95
                  const col = place === 1 ? SWK.champ : place === 2 ? '#cfd6e2' : '#c59a6a'
                  return (
                    <div key={a.id} className="flex flex-col items-center gap-2 w-[28%] max-w-[150px]">
                      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.5 + i * 0.15 }} className="flex flex-col items-center text-center">
                        {place === 1 && <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 2.6 }}><Crown size={22} color={SWK.champ} /></motion.div>}
                        <Avatar name={a.name} size={place === 1 ? 64 : 52} ring={col} />
                        <div className="mt-2 text-white font-semibold text-[13px] leading-tight">{a.name}</div>
                        <div className="text-[12px] font-display" style={{ color: SWK.champ }}>{aed(a.gci, { compact: true })}</div>
                      </motion.div>
                      <motion.div className="w-full rounded-t-2xl grid place-items-start justify-center pt-3 font-display font-semibold text-[28px]"
                        style={{ background: `linear-gradient(180deg, ${col}, rgba(255,255,255,.06))`, color: INK }}
                        initial={{ height: 0 }} whileInView={{ height: h }} viewport={{ once: true }} transition={{ type: 'spring', stiffness: 90, damping: 14, delay: 0.15 * i }}>
                        {place}
                      </motion.div>
                    </div>
                  )
                })}
              </div>
            </Card>

            <Card title="Targets vs actual" subtitle="Quarterly GCI target by commission tier">
              <div className="flex flex-col gap-3.5">
                {[...agents].sort((a, b) => b.gci / b.target - a.gci / a.target).map((a, i) => {
                  const p = (a.gci / a.target) * 100
                  return (
                    <div key={a.id}>
                      <div className="flex items-center gap-2 mb-1.5 text-[13px]">
                        <Avatar name={a.name} size={24} /><b className="truncate" style={{ color: INK }}>{a.name}</b><Pill tone="grey">{a.tier}</Pill>
                        <span className="ml-auto tabular-nums font-semibold" style={{ color: p >= 100 ? SWK.oasis : p >= 60 ? SWK.champDeep : SWK.dune }}>{pct(p, 0)}</span>
                      </div>
                      <Bar value={a.gci} max={Math.max(a.gci, a.target)} color={p >= 100 ? SWK.oasis : SWK.navy} delay={i * 0.08} />
                      <div className="text-[11px] mt-1 tabular-nums" style={{ color: MUTED }}>{aed(a.gci, { compact: true })} of {aed(a.target, { compact: true })}</div>
                    </div>
                  )
                })}
              </div>
            </Card>
          </Reveal>

          {/* Leaderboard */}
          <Reveal>
            <Card title="Full leaderboard" subtitle="Live performance across closed deals, GCI, viewings and active listings" actions={<Segmented layoutId="agent-sort" value={sort} onChange={setSort} options={[{ value: 'gci', label: 'GCI' }, { value: 'deals', label: 'Deals' }, { value: 'viewings', label: 'Viewings' }, { value: 'conversion', label: 'Conv.' }]} />}>
              <div className="overflow-x-auto -mx-2">
                <table className="swk-table min-w-[820px]">
                  <thead><tr><th>#</th><th>Agent</th><th className="num">Deals</th><th className="num">GCI</th><th className="num">Viewings</th><th className="num">Conversion</th><th className="num">Activities</th><th className="num">Listings</th><th>BRN</th></tr></thead>
                  <tbody>
                    {sorted.map((a, i) => {
                      const lic = licence(a.expiry, a.status)
                      return (
                        <motion.tr key={a.id} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                          <td><span className="inline-flex items-center gap-1.5 font-display font-semibold">{i + 1}</span></td>
                          <td><Link to={`/e/agents/${a.id}`} className="flex items-center gap-2.5 min-w-0 hover:underline"><Avatar name={a.name} size={30} /><span className="min-w-0"><b className="block truncate">{a.name}</b><span className="text-[11.5px]" style={{ color: MUTED }}>{a.spec}</span></span></Link></td>
                          <td className="num">{a.deals}</td><td className="num font-semibold">{aed(a.gci, { compact: true })}</td><td className="num">{a.viewings}</td>
                          <td className="num">{pct(a.conversion)}</td><td className="num">{a.activities}</td><td className="num">{a.listings}</td>
                          <td><Pill tone={lic.tone}>{lic.label}</Pill></td>
                        </motion.tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </Reveal>

          {/* Licence tracker + wallet */}
          <Reveal className="grid gap-4 lg:grid-cols-2">
            <Card title="BRN licence tracker" subtitle="RERA broker cards — an expired BRN means the broker's listings must be paused (no Trakheesi advertising)">
              {(expired.length > 0 || expiring.length > 0) && (
                <div className="mb-3 rounded-xl p-3 flex gap-2 text-[12.5px]" style={{ background: '#fbe4dd', color: '#a33a22' }}>
                  <AlertTriangle size={16} className="flex-none mt-0.5" />
                  <span>{expired.length} expired, {expiring.length} expiring within 60 days. Book DREI renewal and pause portal listings of expired brokers.</span>
                </div>
              )}
              <div className="grid sm:grid-cols-2 gap-3">
                {agents.map((a, i) => {
                  const lic = licence(a.expiry, a.status), paused = lic.label === 'Expired'
                  const cpdDue = lic.d !== null ? lic.d - 60 : null
                  return (
                    <motion.div key={a.id} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }} whileHover={{ y: -2 }}
                      className="rounded-2xl p-3.5 relative overflow-hidden" style={{ background: paused ? '#fdf1ed' : 'linear-gradient(150deg,#fbf6ec,#fff)', border: `1px solid ${paused ? '#f1c2b5' : '#ece2cc'}` }}>
                      <div className="flex items-center gap-2.5"><Avatar name={a.name} size={34} /><div className="min-w-0"><b className="block text-[13px] truncate" style={{ color: INK }}>{a.name}</b><span className="text-[11px]" style={{ color: MUTED }}>BRN {a.brn} · Card {a.card}</span></div></div>
                      <div className="flex items-center justify-between mt-2.5"><Pill tone={lic.tone}>{lic.label}</Pill><span className="text-[11.5px] tabular-nums" style={{ color: MUTED }}><CalendarClock size={11} className="inline" /> {fmtD(a.expiry)}</span></div>
                      {paused ? <div className="mt-2 text-[11.5px] font-semibold flex items-center gap-1" style={{ color: SWK.dune }}><PauseCircle size={13} />{a.listings} listings paused</div>
                        : <div className="mt-2 text-[11px] flex items-center gap-1" style={{ color: MUTED }}><GraduationCap size={12} />DREI renewal window {cpdDue !== null && cpdDue > 0 ? `in ${cpdDue}d` : 'open now'}</div>}
                    </motion.div>
                  )
                })}
              </div>
            </Card>

            <Card title="Commission wallets" subtitle="Agent share — earned, pending (Pending / Approved) and paid" actions={<Link to="/e/agent_commissions" className="swk-btn swk-btn-ghost !h-8 text-[12px]">Commission register</Link>}>
              <div className="flex flex-col gap-3">
                {[...agents].sort((a, b) => b.earned - a.earned).map((a, i) => (
                  <div key={a.id} className="flex items-center gap-3">
                    <ProgressRing value={a.earned ? (a.paid / a.earned) * 100 : 0} size={50} stroke={6} color={SWK.oasis} sub={undefined} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2"><b className="text-[13px] truncate" style={{ color: INK }}>{a.name}</b><span className="text-[11px]" style={{ color: MUTED }}>{a.split}% split</span></div>
                      <div className="flex h-2 rounded-full overflow-hidden mt-1.5" style={{ background: '#efe9dc' }}>
                        <motion.div style={{ background: SWK.oasis }} initial={{ width: 0 }} whileInView={{ width: `${a.earned ? (a.paid / a.earned) * 100 : 0}%` }} viewport={{ once: true }} transition={{ duration: 1, delay: i * 0.06 }} />
                        <motion.div style={{ background: SWK.champ }} initial={{ width: 0 }} whileInView={{ width: `${a.earned ? (a.pending / a.earned) * 100 : 0}%` }} viewport={{ once: true }} transition={{ duration: 1, delay: 0.2 + i * 0.06 }} />
                      </div>
                      <div className="flex gap-3 text-[11px] mt-1 tabular-nums" style={{ color: MUTED }}>
                        <span>Earned <b style={{ color: INK }}>{aed(a.earned, { compact: true })}</b></span>
                        <span style={{ color: SWK.champDeep }}>Pending {aed(a.pending, { compact: true })}</span>
                        <span style={{ color: SWK.oasis }}>Paid {aed(a.paid, { compact: true })}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </Reveal>
        </>
      )}

      {/* Heatmap */}
      <Reveal>
        <Card title="Team activity heatmap" subtitle="Viewings & CRM activities by weekday × hour (Gulf Standard Time)">
          <div className="overflow-x-auto">
            <div className="inline-grid gap-1 min-w-[640px] w-full" style={{ gridTemplateColumns: `44px repeat(${HOURS.length}, minmax(28px,1fr))` }} role="table" aria-label="Activity heatmap">
              <span />
              {HOURS.map(h => <span key={h} className="text-[10.5px] text-center" style={{ color: MUTED }}>{h}:00</span>)}
              {DAYS.map((d, di) => [
                <span key={d} className="text-[11.5px] font-semibold self-center" style={{ color: INK }}>{d}</span>,
                ...HOURS.map((h, hi) => {
                  const v = heat[di][hi], a = v / heatMax
                  return <motion.span key={`${d}${h}`} title={`${d} ${h}:00 — ${v} activities`} role="cell" aria-label={`${d} ${h}:00, ${v} activities`}
                    initial={{ opacity: 0, scale: 0.4 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: (di * HOURS.length + hi) * 0.004 }}
                    className="rounded-md h-7" style={{ background: v === 0 ? '#f3eee4' : `rgba(20,48,92,${0.18 + a * 0.82})` }} />
                }),
              ])}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3 text-[11px]" style={{ color: MUTED }}>Less {[0.1, 0.3, 0.5, 0.7, 0.95].map(x => <span key={x} className="w-5 h-3 rounded" style={{ background: `rgba(20,48,92,${x})` }} />)} More · Populated automatically as viewings and calls are scheduled.</div>
        </Card>
      </Reveal>
      <div className="text-[11.5px]" style={{ color: MUTED }}>Totals: <AnimatedNumber value={totalDeals} /> deals · {num(totalViewings)} viewings</div>
    </div>
  )
}

function aDeals(a: Agent) { return a.deals }
