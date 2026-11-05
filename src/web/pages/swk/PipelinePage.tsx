import { useCallback, useEffect, useMemo, useState, type DragEvent, type KeyboardEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, LayoutGroup, motion } from 'motion/react'
import {
  ArrowRight, ArrowUpRight, Building2, CalendarClock, CheckCircle2, Circle, Clock, Eye, FileSignature,
  GripVertical, HandCoins, KanbanSquare, Megaphone, Percent, RefreshCw, Scale, ShieldCheck, Target, Timer, Trophy, Users, Wallet,
} from 'lucide-react'
import { get, post, put } from '../../lib/api'
import { useMeta } from '../../lib/meta'
import { aed, Card, ModuleHeader, Pill, ProgressRing, Reveal, Segmented, StatTile, SWK, pct } from '../../swk/ui'
import { RERA_FORMS, UAE } from '../../swk/uae'
import { Avatar, cleanLabel, daysSince, daysUntil, Drawer, fmtD, MUTED, INK, SearchBox, useRows, type Row } from './brokerage/common'

// ------------------------------------------------------------------ stages (UAE sales journey)
const STAGES = [
  { key: 'Inquiry', label: '1. Lead & Qualify', prob: 0.05, hint: 'Platform lead · Form B / KYC', color: '#8e9ab3' },
  { key: 'Viewing', label: '2. Site Visit', prob: 0.15, hint: 'Live GPS viewing · Area brief', color: SWK.sky },
  { key: 'Offer', label: '3. Offer & Finance', prob: 0.3, hint: 'Cash / Mortgaged / Pre-Approved', color: SWK.ocean },
  { key: 'Negotiation', label: '4. Negotiation / A2A', prob: 0.45, hint: 'Seller / Landlord / Form I A2A', color: SWK.navy },
  { key: 'Contract', label: '5. Form F / SPA / Ejari', prob: 0.7, hint: 'Signed MOU / SPA · Legal deposit', color: SWK.champDeep },
  { key: 'DLD Process', label: '6. NOC & DLD / Oqood', prob: 0.85, hint: 'NOC · Bank Valuation · Trustee', color: SWK.champ },
  { key: 'Handover', label: '7. Legal Payment & Keys', prob: 0.95, hint: 'Escrow / Bank / USDT · Handover', color: '#2d8f8f' },
  { key: 'Closed', label: '8. Closed & 50/50 Split', prob: 1, hint: 'Title Deed / Ejari · 50-50 Payout', color: SWK.oasis },
] as const
type StageKey = typeof STAGES[number]['key']
const VALID = new Set<string>(STAGES.map(s => s.key))
const stageIdx = (k: string) => Math.max(0, STAGES.findIndex(s => s.key === k))

type DType = 'Off-plan' | 'Sale' | 'Lease'
const mapType = (t?: string, div?: string): DType => {
  if (div === 'Sales of Off-Plan Projects' || t === 'Off-Plan Sale') return 'Off-plan'
  if (div === 'Leasing' || (t && /lease|housing/i.test(t))) return 'Lease'
  return 'Sale'
}
const typeTone = (t: DType) => t === 'Sale' ? 'navy' : t === 'Lease' ? 'oasis' : 'champ'
const deptLabel = (t: DType) => t === 'Off-plan' ? 'Sales of Off-Plan Projects' : t === 'Lease' ? 'Leasing' : 'Secondary Projects'

type Deal = {
  id: string; recId?: number; jobNo?: string; name: string; client: string; property: string; value: number; pct: number; type: DType
  stage: StageKey; agent: string; stageSince?: string; dealDate?: string; targetClose?: string; actualClose?: string; cancelled?: boolean
  paymentMode?: string; buyerFinance?: string; isA2A?: boolean; a2aAgency?: string; a2aSharePct?: number
}
const commission = (d: Deal) => d.value * (d.pct / 100) * (1 + UAE.vat)
const gciNet = (d: Deal) => d.value * (d.pct / 100)
const computeSplit = (d: Deal) => {
  const grossExVat = gciNet(d)
  const a2aPct = d.isA2A ? (d.a2aSharePct || 50) : 0
  const a2aAmount = Math.round(grossExVat * (a2aPct / 100))
  const swkPool = grossExVat - a2aAmount
  const company50 = Math.round(swkPool * 0.5)
  const advisor50 = swkPool - company50
  return { grossExVat, a2aPct, a2aAmount, swkPool, company50, advisor50 }
}

// ------------------------------------------------------------------ transfer checklists
type CheckItem = { key: string; label: string; at: number; form?: string }
const SALE_CHECKS: CheckItem[] = [
  { key: 'formA', label: 'Form A seller listing agreement + Seller requirements verified', at: 0, form: 'Form A' },
  { key: 'formB', label: 'Form B buyer agreement + Finance check (Cash / Mortgaged / Pre-Approved)', at: 1, form: 'Form B' },
  { key: 'formI', label: 'Form I Agent-to-Agent agreement (if 3rd-party A2A unit)', at: 2, form: 'Form I' },
  { key: 'offer', label: 'Written offer accepted by seller', at: 3 },
  { key: 'formF', label: 'Form F (MOU) signed by buyer & seller', at: 4, form: 'Form F' },
  { key: 'deposit', label: '10% security deposit via Legal Mode (Zero personal agent accounts)', at: 4 },
  { key: 'noc', label: 'Developer NOC issued after service-charge clearance', at: 5, form: 'NOC' },
  { key: 'mortgage', label: 'Bank final offer letter / seller mortgage clearance', at: 5 },
  { key: 'mgr', label: "Manager's cheques / Company Bank / VARA USDT settlement verified", at: 6 },
  { key: 'deed', label: 'Title deed issued at DLD Trustee + 50/50 Net Commission Split', at: 7, form: 'Title deed' },
]
const OFFPLAN_CHECKS: CheckItem[] = [
  { key: 'formB', label: 'Form B buyer agreement & KYC passport/EID collected', at: 1, form: 'Form B' },
  { key: 'eoi', label: 'EOI / Booking paid to Developer DLD Escrow or SWK Company Account', at: 2 },
  { key: 'spa', label: 'Reservation form & Developer SPA signed', at: 4 },
  { key: 'oqood', label: 'Oqood registered with DLD (4% + Admin fee)', at: 5 },
  { key: 'plan', label: 'Construction & handover payment plan scheduled', at: 5 },
  { key: 'commission', label: 'Developer tax invoice (+5% VAT) & 50/50 Advisor split logged', at: 6 },
  { key: 'handover', label: 'Completion handover & DLD title deed', at: 7, form: 'Title deed' },
]
const LEASE_CHECKS: CheckItem[] = [
  { key: 'formA', label: 'Landlord Form A permit & Bayut / Dubizzle ad live', at: 0, form: 'Form A' },
  { key: 'a2a', label: 'If no internal stock: 3rd-Party A2A partner matched (Form I)', at: 1, form: 'Form I' },
  { key: 'kyc', label: 'Tenant KYC: passport, UAE visa, Emirates ID verified', at: 2 },
  { key: 'contract', label: 'Unified Dubai Tenancy Contract signed', at: 4 },
  { key: 'pdc', label: 'Rent PDC cheques & security deposit to Landlord / Company Account', at: 4 },
  { key: 'ejari', label: 'Ejari certificate registered via Dubai REST', at: 5 },
  { key: 'dewa', label: 'DEWA activated & Move-in inspection completed', at: 6 },
  { key: 'keys', label: 'Key handover & 50/50 Net Commission Split after A2A share', at: 7 },
]
const checksFor = (t: DType) => t === 'Lease' ? LEASE_CHECKS : t === 'Off-plan' ? OFFPLAN_CHECKS : SALE_CHECKS

function useChecklist(deal: Deal | null) {
  const storeKey = deal ? `swk.pipeline.checks.${deal.id}` : ''
  const [state, setState] = useState<Record<string, boolean>>({})
  useEffect(() => {
    if (!deal) return
    const items = checksFor(deal.type), cur = stageIdx(deal.stage)
    let saved: Record<string, boolean> | null = null
    try { saved = JSON.parse(localStorage.getItem(storeKey) || 'null') } catch { /* ignore */ }
    setState(saved ?? Object.fromEntries(items.map(i => [i.key, i.at < cur || (cur === 7)])))
  }, [deal?.id, deal?.stage]) // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (k: string) => setState(s => { const n = { ...s, [k]: !s[k] }; try { localStorage.setItem(storeKey, JSON.stringify(n)) } catch { /* ignore */ } return n })
  return { state, toggle }
}

export default function PipelinePage() {
  const { can } = useMeta()
  const qc = useQueryClient()
  const [sp, setSp] = useSearchParams()
  const jobsQ = useRows('jobs')
  const offersQ = useRows('offers')
  const viewingsQ = useRows('viewings')

  const portalQ = useQuery({
    queryKey: ['swk-portals-status'],
    queryFn: () => get<any>('/api/swk-ops/portals/status'),
  })
  const a2aQ = useQuery({
    queryKey: ['swk-a2a-match'],
    queryFn: () => get<{ items: any[]; total: number }>('/api/swk-ops/a2a-match?only_a2a=1'),
  })

  const deptParam = sp.get('dept')
  const initialType: 'All' | DType = deptParam === 'offplan' ? 'Off-plan' : deptParam === 'secondary' ? 'Sale' : deptParam === 'leasing' ? 'Lease' : 'All'
  const [type, setType] = useState<'All' | DType>(initialType)
  useEffect(() => {
    if (deptParam === 'offplan') setType('Off-plan')
    else if (deptParam === 'secondary') setType('Sale')
    else if (deptParam === 'leasing') setType('Lease')
  }, [deptParam])

  const [agent, setAgent] = useState('all')
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<string | null>(null)
  const [syncingPortals, setSyncingPortals] = useState(false)
  const [toast, setToast] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3600); return () => clearTimeout(t) }, [toast])

  const realDeals: Deal[] = useMemo(() => (jobsQ.data ?? []).map((r: Row) => {
    const t = mapType(r.deal_type, r.department_division)
    const st = (VALID.has(r.operational_status) ? r.operational_status : r.job_status === 'Completed' || r.job_status === 'Title Deed Issued' ? 'Closed' : 'Inquiry') as StageKey
    return {
      id: `job-${r.id}`, recId: r.id, jobNo: r.job_no, name: r.deal_name || r._title || `Deal ${r.id}`, client: r._labels?.client_id ?? '—', property: r._labels?.property_id ?? '—',
      value: Number(r.deal_value) || 0, pct: Number(r.commission_pct) || (t === 'Lease' ? 5 : 2), type: t, stage: st, agent: cleanLabel(r._labels?.agent_id) || 'Unassigned',
      stageSince: r.updated_at, dealDate: r.deal_date, targetClose: r.target_close, actualClose: r.actual_close, cancelled: r.job_status === 'Cancelled',
      paymentMode: r.client_payment_mode || 'SWK Company Bank Account (Wire / IBAN)',
      buyerFinance: r.buyer_finance_type || 'Cash Buyer',
      isA2A: !!r.is_third_party_a2a || Number(r.third_party_commission_pct) > 0,
      a2aAgency: r.third_party_agency_name,
      a2aSharePct: Number(r.third_party_commission_pct) || 0,
    }
  }), [jobsQ.data])
  const all = useMemo(() => realDeals.filter(d => !d.cancelled), [realDeals])
  const agents = useMemo(() => [...new Set(all.map(d => d.agent))].sort(), [all])
  const filtered = useMemo(() => all.filter(d =>
    (type === 'All' || d.type === type) && (agent === 'all' || d.agent === agent) &&
    (!q || `${d.name} ${d.client} ${d.property} ${d.jobNo ?? ''}`.toLowerCase().includes(q.toLowerCase()))), [all, type, agent, q])

  // KPIs
  const open = filtered.filter(d => d.stage !== 'Closed')
  const closed = filtered.filter(d => d.stage === 'Closed')
  const pipelineValue = open.reduce((s, d) => s + d.value, 0)
  const weightedGci = open.reduce((s, d) => s + gciNet(d) * STAGES[stageIdx(d.stage)].prob, 0)
  const cycle = closed.map(d => d.actualClose && d.dealDate ? (new Date(d.actualClose).getTime() - new Date(d.dealDate).getTime()) / 864e5 : null).filter((x): x is number => x !== null && x >= 0)
  const avgDays = cycle.length ? cycle.reduce((a, b) => a + b, 0) / cycle.length : 0
  const cancelledCount = realDeals.filter(d => d.cancelled && (type === 'All' || d.type === type) && (agent === 'all' || d.agent === agent)).length
  const lost = cancelledCount + open.filter(d => (daysUntil(d.targetClose) ?? 1) < -30).length
  const winRate = closed.length + lost ? (closed.length / (closed.length + lost)) * 100 : 0
  const viewingsOpen = (viewingsQ.data ?? []).filter(v => ['Scheduled', 'Confirmed', 'Rescheduled'].includes(v.status)).length
  const offersLive = (offersQ.data ?? []).filter(o => ['Submitted', 'Under Review', 'Negotiating', 'Countered'].includes(o.status)).length

  const canEdit = can('sales', 'edit')
  const mut = useMutation({
    mutationFn: ({ recId, stage }: { recId: number; stage: StageKey }) =>
      put(`/api/e/jobs/${recId}`, { operational_status: stage, _audit_reason: `Pipeline stage advanced to ${stage}` }, { 'x-swk-audit-reason': encodeURIComponent(`Pipeline stage advanced to ${stage}`) }),
    onMutate: async ({ recId, stage }) => {
      await qc.cancelQueries({ queryKey: ['swk-rows', 'jobs'] })
      const prev = qc.getQueryData<Row[]>(['swk-rows', 'jobs'])
      qc.setQueryData<Row[]>(['swk-rows', 'jobs'], rows => (rows ?? []).map(r => r.id === recId ? { ...r, operational_status: stage, updated_at: new Date().toISOString() } : r))
      return { prev }
    },
    onError: (e: any, _v, ctx) => { if (ctx?.prev) qc.setQueryData(['swk-rows', 'jobs'], ctx.prev); setToast({ tone: 'err', text: `Move rolled back — ${e?.message ?? 'server rejected the change'}` }) },
    onSuccess: (_d, v) => setToast({ tone: 'ok', text: `Deal moved to ${STAGES[stageIdx(v.stage)].label} · logged in Audit Trail` }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['swk-rows', 'jobs'] }),
  })
  const move = useCallback((id: string, stage: StageKey) => {
    const d = all.find(x => x.id === id); if (!d || d.stage === stage) return
    if (!VALID.has(stage)) return
    if (!canEdit) { setToast({ tone: 'err', text: 'You do not have permission to edit deal files.' }); return }
    mut.mutate({ recId: d.recId!, stage })
  }, [all, canEdit, mut])

  const syncPortals = async () => {
    setSyncingPortals(true)
    try {
      const r = await post<{ syncedListings: number; portal: string }>('/api/swk-ops/portals/sync', { portal: 'Bayut & Dubizzle' })
      setToast({ tone: 'ok', text: `Synced ${r.syncedListings} active listings to ${r.portal}` })
      void qc.invalidateQueries({ queryKey: ['swk-portals-status'] })
    } catch (e: any) {
      setToast({ tone: 'err', text: e.message })
    } finally {
      setSyncingPortals(false)
    }
  }

  const onDrop = (e: DragEvent, stage: StageKey) => { e.preventDefault(); setOverCol(null); const id = e.dataTransfer.getData('text/plain'); if (id) move(id, stage) }
  const opened = all.find(d => d.id === openId) ?? null

  const switchDept = (next: 'All' | DType) => {
    setType(next)
    const nextSp = new URLSearchParams(sp)
    if (next === 'Off-plan') nextSp.set('dept', 'offplan')
    else if (next === 'Sale') nextSp.set('dept', 'secondary')
    else if (next === 'Lease') nextSp.set('dept', 'leasing')
    else nextSp.delete('dept')
    setSp(nextSp, { replace: true })
  }

  return (
    <div className="flex flex-col gap-5">
      <ModuleHeader
        eyebrow="3 Operational Departments · End-to-End UAE Real Estate Workflow"
        icon={<KanbanSquare size={22} />}
        title={
          type === 'Off-plan' ? 'Dept 1: Sales of Off-Plan Projects' :
          type === 'Sale' ? 'Dept 2: Secondary Projects (Ready Transfers)' :
          type === 'Lease' ? 'Dept 3: Leasing & Tenancy (Bayut / Dubizzle / A2A)' :
          'SWK 3-Department Deal Pipeline & Workflow'
        }
        subtitle="Inventory → Bayut & Dubizzle Promotion → Platform Leads → Calls/Follow-Ups → Site Visits → Conversion / Form F / Ejari (or Lost Reason) → Legal UAE Payment (Zero Personal Accounts) → Handover & 50–50% Net Commission Split."
        actions={<>
          <button type="button" className="swk-btn swk-btn-ghost" disabled={syncingPortals} onClick={() => void syncPortals()}>
            <RefreshCw size={15} className={syncingPortals ? 'animate-spin' : ''} /> {syncingPortals ? 'Syncing…' : 'Sync Bayut & Dubizzle Ads'}
          </button>
          <Link to="/withdrawals" className="swk-btn swk-btn-ghost"><Scale size={15} />Deal Withdrawals & Refunds</Link>
          <Link to="/e/jobs?new=1" className="swk-btn swk-btn-gold"><FileSignature size={15} />New Deal File</Link>
        </>}
      />

      {/* ================================================================ 3 DEPARTMENT SELECTOR CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {[
          { key: 'All' as const, title: 'All 3 Departments', sub: 'Complete SWK company-wide pipeline', count: all.length, badge: 'Unified View' },
          { key: 'Off-plan' as const, title: '1. Sales of Off-Plan Projects', sub: 'Developer inventory → EOI/SPA → Oqood → 50/50 Split', count: all.filter(d => d.type === 'Off-plan').length, badge: 'OFFPLAN' },
          { key: 'Sale' as const, title: '2. Secondary Projects', sub: 'Seller / 3rd-Party A2A → Cash/Mortgage → Form F → NOC → Title Deed', count: all.filter(d => d.type === 'Sale').length, badge: 'SECONDARY' },
          { key: 'Lease' as const, title: '3. Leasing Department', sub: 'Bayut & Dubizzle Ads → A2A Match → PDC Cheques → Ejari', count: all.filter(d => d.type === 'Lease').length, badge: 'LEASING' },
        ].map(tab => {
          const active = type === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => switchDept(tab.key)}
              className={`text-left p-4 rounded-2xl border transition-all ${active ? 'bg-[#0B1A33] text-white border-[#BE984C] shadow-lg' : 'bg-white text-ink border-[#efe9dc] hover:border-[#BE984C]'}`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded ${active ? 'bg-[#BE984C] text-[#0B1A33]' : 'bg-[#fbf9f5] text-muted'}`}>
                  {tab.badge}
                </span>
                <span className="font-mono font-extrabold text-lg">{tab.count} deals</span>
              </div>
              <div className="font-display font-bold text-base mt-2">{tab.title}</div>
              <div className={`text-xs mt-0.5 ${active ? 'text-white/75' : 'text-muted'}`}>{tab.sub}</div>
            </button>
          )
        })}
      </div>

      {/* ================================================================ STEP-BY-STEP LOGICAL UAE REAL ESTATE WORKFLOW BAR */}
      <Card
        title="SWK Step-by-Step UAE Real Estate Operational Sequence"
        subtitle="Click any step in the sequence to open or log records in that stage."
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2">
          {[
            { step: '1. Inventory', desc: 'Developer / Seller / A2A', to: '/e/properties' },
            { step: '2. Promote', desc: 'Bayut & Dubizzle Ads', to: '/listings' },
            { step: '3. Platform Leads', desc: 'Bayut / Dubizzle / WA', to: '/e/leads' },
            { step: '4. Calls & Follow-Up', desc: 'Qualify or Lost Reason', to: '/e/activities' },
            { step: '5. Site Visits', desc: 'Live GPS + Area Brief', to: '/e/viewings' },
            { step: '6. Form F / Ejari', desc: 'Cash / Mortgage / MOU', to: '/e/sales_contracts' },
            { step: '7. Legal Payment', desc: 'Bank / Escrow / USDT', to: '/e/receipts' },
            { step: '8. 50/50 Commission', desc: 'After 3rd-Party A2A', to: '/e/agent_commissions' },
          ].map((s, idx) => (
            <Link
              key={s.step}
              to={s.to}
              className="p-2.5 rounded-xl border border-[#efe9dc] bg-[#fbf9f5] hover:bg-white hover:border-[#BE984C] transition flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-xs font-extrabold text-ink">
                <span>{s.step}</span>
                {idx < 7 && <ArrowRight size={12} className="text-[#BE984C]" />}
              </div>
              <div className="text-[11px] text-muted mt-1">{s.desc}</div>
            </Link>
          ))}
        </div>
      </Card>

      <Reveal className="grid gap-4 grid-cols-2 xl:grid-cols-4">
        <StatTile tone="navy" label="Open pipeline value" value={pipelineValue} format={v => aed(v, { compact: true })} icon={<Wallet size={16} />} hint={`${open.length} open deals`} spark={STAGES.map(s => open.filter(d => d.stage === s.key).reduce((a, d) => a + d.value, 0))} />
        <StatTile label="Weighted forecast GCI" value={weightedGci} format={v => aed(v, { compact: true })} icon={<Target size={16} />} hint="50% SWK / 50% Advisor net pool" />
        <StatTile label="Avg days to close" value={avgDays} format={v => `${Math.round(v)} days`} icon={<Timer size={16} />} hint={`${closed.length} closed deals`} />
        <StatTile tone="champ" label="Win rate" value={winRate} format={v => pct(v, 0)} icon={<Trophy size={16} />} hint={<span className="flex gap-2"><span><Eye size={11} className="inline" /> {viewingsOpen} viewings</span><span><HandCoins size={11} className="inline" /> {offersLive} live offers</span></span>} />
      </Reveal>

      <div className="flex flex-wrap items-center gap-2.5">
        <Segmented layoutId="pipe-type" value={type} onChange={switchDept} options={(['All', 'Off-plan', 'Sale', 'Lease'] as const).map(v => ({ value: v, label: v === 'Sale' ? 'Secondary' : v }))} />
        <label className="swk-field-box" style={{ height: 40 }}>
          <span className="sr-only">Agent</span>
          <select aria-label="Filter by agent" value={agent} onChange={e => setAgent(e.target.value)} style={{ fontSize: 13.5, paddingRight: 12 }}>
            <option value="all">All Sales Advisors</option>{agents.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <SearchBox value={q} onChange={setQ} placeholder="Search deal, client, property…" label="Search deals" />
        <span className="text-[12.5px] ml-auto" style={{ color: MUTED }}>{jobsQ.isLoading ? 'Loading deal files…' : `${filtered.length} deal file${filtered.length === 1 ? '' : 's'} shown`}</span>
      </div>

      <LayoutGroup>
        <div className="flex gap-3.5 overflow-x-auto pb-3 -mx-1 px-1 snap-x" role="list" aria-label="Pipeline stages">
          {STAGES.map((s, si) => {
            const items = filtered.filter(d => d.stage === s.key)
            const total = items.reduce((a, d) => a + d.value, 0)
            const extra = s.key === 'Viewing' ? `${viewingsOpen} viewings booked` : s.key === 'Offer' ? `${offersLive} offers live` : null
            return (
              <motion.section key={s.key} role="listitem" aria-label={`${s.label} stage, ${items.length} deals`}
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: si * 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (overCol !== s.key) setOverCol(s.key) }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverCol(null) }}
                onDrop={e => onDrop(e, s.key)}
                className="snap-start flex-none flex flex-col rounded-[20px] transition-colors"
                style={{ width: 288, minHeight: 420, background: overCol === s.key ? '#f3ead8' : '#f1ece2', border: `1px ${overCol === s.key ? 'dashed' : 'solid'} ${overCol === s.key ? SWK.champ : '#e7e1d4'}` }}>
                <header className="px-3.5 pt-3.5 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                    <h3 className="font-display font-semibold text-[15px]" style={{ color: INK }}>{s.label}</h3>
                    <motion.span key={items.length} initial={{ scale: 1.4 }} animate={{ scale: 1 }} className="ml-auto text-[11.5px] font-semibold rounded-full px-2 py-0.5" style={{ background: '#fff', color: INK }}>{items.length}</motion.span>
                  </div>
                  <div className="text-[11.5px] mt-0.5" style={{ color: MUTED }}>{s.hint}</div>
                  <div className="flex items-baseline justify-between mt-2 text-[12px]">
                    <span className="font-semibold tabular-nums" style={{ color: INK }}>{aed(total, { compact: true })}</span>
                    <span className="tabular-nums" style={{ color: SWK.champDeep }} title="Weighted value = total × stage probability">{Math.round(s.prob * 100)}% · {aed(total * s.prob, { compact: true })}</span>
                  </div>
                  <div className="h-1 rounded-full mt-2 overflow-hidden" style={{ background: '#e4dccb' }}><motion.div className="h-full" style={{ background: s.color }} initial={{ width: 0 }} animate={{ width: `${s.prob * 100}%` }} transition={{ duration: 1, delay: 0.2 + si * 0.05 }} /></div>
                  {extra && <div className="mt-2 text-[11px] font-semibold" style={{ color: SWK.ocean }}>{extra}</div>}
                </header>
                <div className="flex-1 flex flex-col gap-2.5 px-2.5 pb-3">
                  <AnimatePresence initial={false}>
                    {items.map(d => <DealCard key={d.id} d={d} onOpen={() => setOpenId(d.id)} onMove={dir => { const ni = stageIdx(d.stage) + dir; if (ni >= 0 && ni < STAGES.length) move(d.id, STAGES[ni].key) }} />)}
                  </AnimatePresence>
                  {!items.length && <div className="text-center text-[12px] py-8 rounded-2xl" style={{ color: MUTED, border: '1px dashed #d9cfbb' }}>Drop a deal here</div>}
                </div>
              </motion.section>
            )
          })}
        </div>
      </LayoutGroup>

      {/* ================================================================ BAYUT & DUBIZZLE SYNDICATION + 3RD-PARTY A2A MATCHING DESK */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-5">
          <Card
            title={<span className="flex items-center gap-2"><Megaphone size={17} /> Bayut & Dubizzle Connected Portal Feed</span>}
            subtitle="Live portal ad syndication & incoming platform lead attribution."
            actions={
              <button type="button" className="btn green sm" disabled={syncingPortals} onClick={() => void syncPortals()}>
                <RefreshCw size={13} /> Sync Now
              </button>
            }
          >
            <div className="space-y-2.5">
              {(portalQ.data?.portals ?? []).map((p: any) => (
                <div key={p.key} className="p-3 rounded-xl border border-[#efe9dc] bg-[#fbf9f5] flex items-center justify-between">
                  <div>
                    <div className="font-bold text-sm text-ink">{p.name}</div>
                    <div className="text-xs text-muted">{p.account}</div>
                  </div>
                  <div className="text-right">
                    <Pill tone="oasis">{p.activeListings} Active Ads</Pill>
                    <div className="text-[11px] text-muted mt-0.5">{p.status}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="xl:col-span-7">
          <Card
            title={<span className="flex items-center gap-2"><Users size={17} /> 3rd-Party Agent (A2A) Inventory & Commission Split Desk</span>}
            subtitle="When internal inventory does not match a client’s requirement, source from verified 3rd-party agents (Form I) — A2A share is deducted first, then SWK & Sales Advisor split 50–50%."
            actions={
              <Link to="/e/properties?new=1" className="btn outline sm">
                <Building2 size={13} /> Add 3rd-Party A2A Unit
              </Link>
            }
          >
            {(a2aQ.data?.items ?? []).length === 0 ? (
              <div className="text-xs text-muted py-6 text-center">No 3rd-party A2A partner listings registered yet.</div>
            ) : (
              <div className="overflow-x-auto -mx-2">
                <table className="swk-table min-w-[580px]">
                  <thead>
                    <tr>
                      <th>Unit & Community</th>
                      <th>3rd-Party Agency / Agent (BRN)</th>
                      <th className="num">Gross Comm</th>
                      <th className="num">3rd-Party A2A</th>
                      <th className="num">SWK 50%</th>
                      <th className="num">Advisor 50%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(a2aQ.data?.items ?? []).map((item: any) => (
                      <tr key={item.id}>
                        <td>
                          <Link to={`/e/properties/${item.id}`} className="font-bold text-ink hover:underline block">{item.title}</Link>
                          <span className="text-xs text-muted">{item.department_division} · {item.community}</span>
                        </td>
                        <td>
                          <div className="font-semibold text-xs text-ink">{item.third_party_agency_name || 'External Partner Agency'}</div>
                          <div className="text-[11px] text-muted">{item.third_party_agent_name} {item.third_party_agent_brn ? `(${item.third_party_agent_brn})` : ''}</div>
                        </td>
                        <td className="num font-mono text-xs">{aed(item.commissionPreview?.grossCommissionAed)}</td>
                        <td className="num font-mono text-xs text-[#7E3039]">-{aed(item.commissionPreview?.thirdPartyAgentPayoutAed)} ({item.commissionPreview?.a2aPartnerSharePct}%)</td>
                        <td className="num font-mono font-bold text-xs text-[#0B1A33]">{aed(item.commissionPreview?.swkCompany50PctAed)}</td>
                        <td className="num font-mono font-bold text-xs text-[#174B3B]">{aed(item.commissionPreview?.salesAdvisor50PctAed)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>

      <TransferDrawer deal={opened} onClose={() => setOpenId(null)} onMove={st => opened && move(opened.id, st)} />

      <AnimatePresence>
        {toast && (
          <motion.div role="status" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] px-4 py-3 rounded-2xl text-[13px] font-semibold shadow-xl"
            style={{ background: toast.tone === 'ok' ? INK : SWK.dune, color: '#fff' }}>{toast.text}</motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function DealCard({ d, onOpen, onMove }: { d: Deal; onOpen: () => void; onMove: (dir: -1 | 1) => void }) {
  const inStage = daysSince(d.stageSince) ?? 0
  const due = daysUntil(d.targetClose)
  const [dragging, setDragging] = useState(false)
  const sp = computeSplit(d)
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() }
    if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); onMove(1) }
    if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); onMove(-1) }
  }
  return (
    <motion.div layout layoutId={d.id} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: dragging ? 0.45 : 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }} whileHover={{ y: -2 }}>
      <div draggable onDragStart={e => { e.dataTransfer.setData('text/plain', d.id); e.dataTransfer.effectAllowed = 'move'; setDragging(true) }} onDragEnd={() => setDragging(false)}
        role="button" tabIndex={0} aria-label={`${d.name}, ${aed(d.value)}. Press Enter for transfer checklist`} onClick={onOpen} onKeyDown={onKey}
        className="group relative rounded-2xl bg-white p-3 cursor-grab active:cursor-grabbing outline-none focus-visible:ring-2"
        style={{ border: '1px solid #e7e1d4', boxShadow: '0 10px 24px -20px rgba(11,26,51,.5)' }}>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              <Pill tone={typeTone(d.type) as any}>{d.type === 'Sale' ? 'Secondary' : d.type}</Pill>
              {d.isA2A && <Pill tone="champ">A2A Co-Broke</Pill>}
              {d.jobNo && <span className="text-[10.5px] font-semibold" style={{ color: MUTED }}>{d.jobNo}</span>}
            </div>
            <div className="font-semibold text-[13.5px] leading-snug" style={{ color: INK }}>{d.name}</div>
            <div className="text-[11.5px] truncate" style={{ color: MUTED }}>{d.client} · {d.property}</div>
          </div>
          <GripVertical size={15} className="opacity-30 group-hover:opacity-70 flex-none mt-1" aria-hidden />
        </div>
        <div className="flex items-end justify-between mt-2.5">
          <div>
            <div className="font-display font-semibold text-[16px] tabular-nums" style={{ color: INK }}>{aed(d.value, { compact: true })}</div>
            <div className="text-[11px] tabular-nums" style={{ color: SWK.champDeep }}>
              <Percent size={10} className="inline" /> 50/50 Split: {aed(sp.advisor50, { compact: true })} Advisor / {aed(sp.company50, { compact: true })} SWK
            </div>
          </div>
          <Avatar name={d.agent} size={28} />
        </div>
        <div className="flex items-center justify-between mt-2.5 pt-2 text-[11px]" style={{ borderTop: '1px dashed #ece5d6', color: MUTED }}>
          <span className="flex items-center gap-1"><Clock size={11} />{inStage}d in stage</span>
          {d.stage === 'Closed' ? <span className="flex items-center gap-1" style={{ color: SWK.oasis }}><CheckCircle2 size={11} />Closed</span> :
            due === null ? <span>{d.buyerFinance}</span> :
              <span className="flex items-center gap-1 font-semibold" style={{ color: due < 0 ? SWK.dune : due <= 7 ? SWK.champDeep : MUTED }}><CalendarClock size={11} />{due < 0 ? `${-due}d overdue` : `${due}d to close`}</span>}
        </div>
      </div>
    </motion.div>
  )
}

function TransferDrawer({ deal, onClose, onMove }: { deal: Deal | null; onClose: () => void; onMove: (s: StageKey) => void }) {
  const { state, toggle } = useChecklist(deal)
  const items = deal ? checksFor(deal.type) : []
  const done = items.filter(i => state[i.key]).length
  const progress = items.length ? (done / items.length) * 100 : 0
  const cur = deal ? stageIdx(deal.stage) : 0
  const sp = deal ? computeSplit(deal) : null
  const formStage: Record<string, number> = { 'Form A': 0, 'Form B': 1, 'Form I': 2, 'Form F': 4, NOC: 5, 'Title deed': 7 }
  return (
    <Drawer open={!!deal} onClose={onClose} width={520}
      title={deal?.name ?? ''} subtitle={deal && <>{deptLabel(deal.type)} · {deal.client} · {deal.property}</>}>
      {deal && sp && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-4 rounded-2xl p-4" style={{ background: 'linear-gradient(150deg,#14305c,#0b1a33)', color: '#d9e1ee' }}>
            <ProgressRing value={progress} size={86} color={SWK.champ} track="rgba(255,255,255,.12)" label={<span style={{ color: '#fff' }}>{Math.round(progress)}%</span>} />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] uppercase tracking-[.18em]" style={{ color: SWK.champ }}>{deptLabel(deal.type)}</div>
              <div className="font-display text-[20px] font-semibold text-white">{aed(deal.value)}</div>
              <div className="text-[12px]">Gross Commission {aed(commission(deal))} incl. VAT · {deal.agent}</div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#efe9dc] bg-[#fbf9f5] p-3.5 text-xs space-y-1.5">
            <div className="font-extrabold uppercase tracking-wider text-ink flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-[#174B3B]" /> Legal Payment & 50–50% Commission Waterfall
            </div>
            <div className="flex justify-between"><span>Buyer Finance Status:</span><strong>{deal.buyerFinance}</strong></div>
            <div className="flex justify-between"><span>Legal UAE Payment Channel:</span><strong>{deal.paymentMode}</strong></div>
            <div className="flex justify-between"><span>Gross Commission (Excl. 5% VAT):</span><strong>{aed(sp.grossExVat)}</strong></div>
            {deal.isA2A && (
              <div className="flex justify-between text-[#7E3039]">
                <span>Less 3rd-Party A2A Partner Share ({sp.a2aPct}%):</span>
                <strong>-{aed(sp.a2aAmount)}</strong>
              </div>
            )}
            <div className="flex justify-between pt-1 border-t border-[#efe9dc] font-bold text-[#0B1A33]">
              <span>SWK Company Share (50% of Net Pool):</span>
              <span>{aed(sp.company50)}</span>
            </div>
            <div className="flex justify-between font-bold text-[#174B3B]">
              <span>Sales Advisor Share (50% — Company Visa / Zero Basic):</span>
              <span>{aed(sp.advisor50)}</span>
            </div>
          </div>

          <label className="swk-field">
            <span className="swk-field-label">Stage</span>
            <span className="swk-field-box"><select value={deal.stage} onChange={e => onMove(e.target.value as StageKey)} aria-label="Move deal to stage">{STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}</select></span>
          </label>

          <div>
            <div className="text-[12px] font-semibold mb-2" style={{ color: MUTED }}>RERA forms timeline</div>
            <ol className="relative flex flex-col gap-0 pl-5" style={{ borderLeft: '2px solid #e7e1d4', marginLeft: 6 }}>
              {RERA_FORMS.map((f, i) => {
                const reached = (formStage[f.code] ?? 9) <= cur
                return (
                  <motion.li key={f.code} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="relative pb-3">
                    <span className="absolute -left-[27px] top-0.5 w-3.5 h-3.5 rounded-full grid place-items-center" style={{ background: reached ? SWK.oasis : '#fff', border: `2px solid ${reached ? SWK.oasis : '#d6ccb8'}` }} />
                    <div className="flex items-center gap-2"><b className="text-[13px]" style={{ color: INK }}>{f.code}</b><Pill tone={reached ? 'oasis' : 'grey'}>{f.stage}</Pill></div>
                    <div className="text-[12px]" style={{ color: MUTED }}>{f.name}</div>
                  </motion.li>
                )
              })}
            </ol>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2"><span className="text-[12px] font-semibold" style={{ color: MUTED }}>{deal.type === 'Lease' ? 'Ejari & move-in checklist' : deal.type === 'Off-plan' ? 'Off-plan / Oqood checklist' : 'DLD transfer checklist'}</span><span className="text-[12px] font-semibold" style={{ color: INK }}>{done}/{items.length}</span></div>
            <ul className="flex flex-col gap-1.5">
              {items.map(i => (
                <li key={i.key}>
                  <button onClick={() => toggle(i.key)} aria-pressed={!!state[i.key]} className="w-full flex items-center gap-2.5 text-left rounded-xl px-3 py-2.5 transition-colors"
                    style={{ background: state[i.key] ? '#e8f3f1' : '#fff', border: `1px solid ${state[i.key] ? '#bfe0db' : '#ece5d6'}` }}>
                    <motion.span key={String(!!state[i.key])} initial={{ scale: 0.6 }} animate={{ scale: 1 }}>{state[i.key] ? <CheckCircle2 size={17} color={SWK.oasis} /> : <Circle size={17} color="#c9bfa9" />}</motion.span>
                    <span className="text-[13px] flex-1" style={{ color: INK, textDecoration: state[i.key] ? 'line-through' : undefined, textDecorationColor: '#9bb' }}>{i.label}</span>
                    {i.form && <Pill tone="champ">{i.form}</Pill>}
                  </button>
                </li>
              ))}
            </ul>
            <p className="text-[11px] mt-2" style={{ color: MUTED }}>Target close {fmtD(deal.targetClose)}.</p>
          </div>

          <div className="flex gap-2">
            {deal.recId && <Link to={`/e/jobs/${deal.recId}`} className="swk-btn swk-btn-primary flex-1"><ArrowUpRight size={15} />Open Deal File {deal.jobNo}</Link>}
            <Link to="/withdrawals" className="swk-btn swk-btn-ghost"><Scale size={15} />Log Withdrawal</Link>
          </div>
        </div>
      )}
    </Drawer>
  )
}
