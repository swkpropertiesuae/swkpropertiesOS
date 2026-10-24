import { useCallback, useEffect, useMemo, useState, type DragEvent, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, LayoutGroup, motion } from 'motion/react'
import { ArrowUpRight, CalendarClock, CheckCircle2, Circle, Clock, Eye, FileSignature, GripVertical, HandCoins, KanbanSquare, Percent, Target, Timer, Trophy, Wallet } from 'lucide-react'
import { put } from '../../lib/api'
import { useMeta } from '../../lib/meta'
import { aed, Card, ModuleHeader, Pill, ProgressRing, Reveal, Segmented, StatTile, SWK, pct } from '../../swk/ui'
import { RERA_FORMS, UAE } from '../../swk/uae'
import { addDays, Avatar, cleanLabel, daysSince, daysUntil, Drawer, fmtD, MUTED, INK, SamplePill, SearchBox, useRows, type Row } from './brokerage/common'

// ------------------------------------------------------------------ stages (UAE sales journey)
const STAGES = [
  { key: 'Inquiry', label: 'Lead', prob: 0.05, hint: 'Enquiry qualified · Form B pending', color: '#8e9ab3' },
  { key: 'Viewing', label: 'Viewing', prob: 0.15, hint: 'Viewings booked / done', color: SWK.sky },
  { key: 'Offer', label: 'Offer', prob: 0.3, hint: 'Written offer submitted', color: SWK.ocean },
  { key: 'Negotiation', label: 'Negotiation', prob: 0.45, hint: 'Counter-offers in play', color: SWK.navy },
  { key: 'Contract', label: 'Form F / MOU', prob: 0.7, hint: 'MOU signed · 10% deposit', color: SWK.champDeep },
  { key: 'DLD Process', label: 'DLD Process', prob: 0.85, hint: 'NOC · mortgage · trustee', color: SWK.champ },
  { key: 'Handover', label: 'Handover', prob: 0.95, hint: 'Transfer booked / keys', color: '#2d8f8f' },
  { key: 'Closed', label: 'Closed', prob: 1, hint: 'Title deed / Ejari issued', color: SWK.oasis },
] as const
type StageKey = typeof STAGES[number]['key']
const VALID = new Set<string>(STAGES.map(s => s.key))
const stageIdx = (k: string) => Math.max(0, STAGES.findIndex(s => s.key === k))

type DType = 'Sale' | 'Lease' | 'Off-plan'
const mapType = (t?: string): DType => t === 'Off-Plan Sale' ? 'Off-plan' : (t && /lease|housing/i.test(t)) ? 'Lease' : 'Sale'
const typeTone = (t: DType) => t === 'Sale' ? 'navy' : t === 'Lease' ? 'oasis' : 'champ'

type Deal = {
  id: string; recId?: number; jobNo?: string; name: string; client: string; property: string; value: number; pct: number; type: DType
  stage: StageKey; agent: string; stageSince?: string; dealDate?: string; targetClose?: string; actualClose?: string; cancelled?: boolean; sample: boolean
}
const commission = (d: Deal) => d.value * (d.pct / 100) * (1 + UAE.vat)
const gciNet = (d: Deal) => d.value * (d.pct / 100)

// ------------------------------------------------------------------ indicative sample deals (labelled in UI)
const SAMPLE: Omit<Deal, 'id' | 'sample'>[] = [
  { name: 'Emaar Beachfront 2BR resale', client: 'Mr. Rajesh Menon', property: 'Beach Vista T2 · 1804', value: 3_450_000, pct: 2, type: 'Sale', stage: 'Inquiry', agent: 'Sarah Williams', stageSince: addDays(-3), dealDate: addDays(-3), targetClose: addDays(75) },
  { name: 'JVC studio investor', client: 'Ms. Elena Petrova', property: 'Binghatti Corner · 412', value: 720_000, pct: 2, type: 'Sale', stage: 'Inquiry', agent: 'Omar Khalid', stageSince: addDays(-6), dealDate: addDays(-6), targetClose: addDays(60) },
  { name: 'Dubai Hills villa lease', client: 'The Carter Family', property: 'Sidra 3 · Villa 27', value: 340_000, pct: 5, type: 'Lease', stage: 'Viewing', agent: 'Fatima Al Hashimi', stageSince: addDays(-4), dealDate: addDays(-9), targetClose: addDays(18) },
  { name: 'Creek Harbour off-plan 1BR', client: 'Mr. Wei Zhang', property: 'Creek Waters 2 · 2207', value: 1_680_000, pct: 4, type: 'Off-plan', stage: 'Viewing', agent: 'Mohammed Al Qubaisi', stageSince: addDays(-2), dealDate: addDays(-5), targetClose: addDays(30) },
  { name: 'Business Bay office lease', client: 'Nova Fintech FZ-LLC', property: 'Bay Square 11 · Office 604', value: 260_000, pct: 5, type: 'Lease', stage: 'Offer', agent: 'Omar Khalid', stageSince: addDays(-5), dealDate: addDays(-20), targetClose: addDays(14) },
  { name: 'Palm Jumeirah signature villa', client: 'Al Falasi Family Office', property: 'Frond N · Villa 12', value: 28_500_000, pct: 2, type: 'Sale', stage: 'Negotiation', agent: 'Ahmed Al Mansoori', stageSince: addDays(-11), dealDate: addDays(-41), targetClose: addDays(40) },
  { name: 'Sobha Hartland II 3BR', client: 'Dr. Priya Nair', property: 'Sobha Orbis · 1502', value: 4_150_000, pct: 4, type: 'Off-plan', stage: 'Contract', agent: 'Sarah Williams', stageSince: addDays(-7), dealDate: addDays(-35), targetClose: addDays(21) },
  { name: 'Marina Gate 2BR transfer', client: 'Mr. James O’Connor', property: 'Marina Gate 1 · 3304', value: 3_100_000, pct: 2, type: 'Sale', stage: 'DLD Process', agent: 'Ahmed Al Mansoori', stageSince: addDays(-9), dealDate: addDays(-52), targetClose: addDays(6) },
  { name: 'Downtown 1BR mortgage buyer', client: 'Ms. Aisha Rahman', property: 'Burj Royale · 2011', value: 2_050_000, pct: 2, type: 'Sale', stage: 'Handover', agent: 'Fatima Al Hashimi', stageSince: addDays(-2), dealDate: addDays(-58), targetClose: addDays(3) },
  { name: 'Arabian Ranches 4BR sale', client: 'Mr. & Mrs. Schneider', property: 'Saheel · Villa 88', value: 6_200_000, pct: 2, type: 'Sale', stage: 'Closed', agent: 'Mohammed Al Qubaisi', stageSince: addDays(-6), dealDate: addDays(-64), targetClose: addDays(-8), actualClose: addDays(-6) },
  { name: 'JLT 1BR annual lease', client: 'Mr. Karan Shah', property: 'Lake City Tower · 905', value: 92_000, pct: 5, type: 'Lease', stage: 'Closed', agent: 'Omar Khalid', stageSince: addDays(-12), dealDate: addDays(-30), targetClose: addDays(-14), actualClose: addDays(-12) },
  { name: 'City Walk 2BR (buyer withdrew)', client: 'Mr. Lucas Moreau', property: 'City Walk B8 · 402', value: 3_300_000, pct: 2, type: 'Sale', stage: 'Negotiation', agent: 'Sarah Williams', dealDate: addDays(-50), cancelled: true },
]

// ------------------------------------------------------------------ transfer checklists
type CheckItem = { key: string; label: string; at: number; form?: string }
const SALE_CHECKS: CheckItem[] = [
  { key: 'formA', label: 'Form A listing agreement on file (seller ↔ SWK)', at: 0, form: 'Form A' },
  { key: 'formB', label: 'Form B buyer agreement signed', at: 1, form: 'Form B' },
  { key: 'offer', label: 'Written offer accepted by seller', at: 3 },
  { key: 'formF', label: 'Form F (MOU) signed by buyer & seller', at: 4, form: 'Form F' },
  { key: 'deposit', label: '10% security deposit cheque held by SWK', at: 4 },
  { key: 'noc', label: 'Developer NOC issued', at: 5, form: 'NOC' },
  { key: 'mortgage', label: 'Mortgage pre-approval / seller liability clearance letter', at: 5 },
  { key: 'trustee', label: 'Registration trustee appointment booked', at: 5 },
  { key: 'mgr', label: "Manager's cheques prepared (seller, DLD 4%, agency)", at: 6 },
  { key: 'deed', label: 'Title deed issued by DLD', at: 7, form: 'Title deed' },
]
const OFFPLAN_CHECKS: CheckItem[] = [
  { key: 'formB', label: 'Form B buyer agreement signed', at: 1, form: 'Form B' },
  { key: 'eoi', label: 'EOI / booking deposit paid to developer escrow', at: 2 },
  { key: 'spa', label: 'Reservation form & SPA signed', at: 4 },
  { key: 'oqood', label: 'Oqood registered with DLD (4%)', at: 5 },
  { key: 'plan', label: 'Payment plan instalments scheduled', at: 5 },
  { key: 'commission', label: 'Developer commission invoice raised (+5% VAT)', at: 6 },
  { key: 'handover', label: 'Handover / title deed on completion', at: 7, form: 'Title deed' },
]
const LEASE_CHECKS: CheckItem[] = [
  { key: 'formA', label: 'Form A landlord listing agreement', at: 0, form: 'Form A' },
  { key: 'formB', label: 'Form B tenant agreement signed', at: 1, form: 'Form B' },
  { key: 'kyc', label: 'Tenant KYC: passport, visa, Emirates ID', at: 2 },
  { key: 'contract', label: 'Tenancy contract signed (unified Dubai contract)', at: 4 },
  { key: 'pdc', label: 'Rent PDC cheques & security deposit collected', at: 4 },
  { key: 'ejari', label: 'Ejari registered', at: 5 },
  { key: 'dewa', label: 'DEWA activated in tenant’s name', at: 6 },
  { key: 'keys', label: 'Move-in inspection & key handover', at: 7 },
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

// ------------------------------------------------------------------ page
export default function PipelinePage() {
  const { can } = useMeta()
  const qc = useQueryClient()
  const jobsQ = useRows('jobs')
  const offersQ = useRows('offers')
  const viewingsQ = useRows('viewings')

  const [type, setType] = useState<'All' | DType>('All')
  const [agent, setAgent] = useState('all')
  const [q, setQ] = useState('')
  const [showSample, setShowSample] = useState(true)
  const [sampleStages, setSampleStages] = useState<Record<string, StageKey>>({})
  const [openId, setOpenId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<string | null>(null)
  const [toast, setToast] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3600); return () => clearTimeout(t) }, [toast])

  const realDeals: Deal[] = useMemo(() => (jobsQ.data ?? []).map((r: Row) => {
    const t = mapType(r.deal_type)
    const st = (VALID.has(r.operational_status) ? r.operational_status : r.job_status === 'Completed' || r.job_status === 'Title Deed Issued' ? 'Closed' : 'Inquiry') as StageKey
    return {
      id: `job-${r.id}`, recId: r.id, jobNo: r.job_no, name: r.deal_name || r._title || `Deal ${r.id}`, client: r._labels?.client_id ?? '—', property: r._labels?.property_id ?? '—',
      value: Number(r.deal_value) || 0, pct: Number(r.commission_pct) || (t === 'Lease' ? 5 : 2), type: t, stage: st, agent: cleanLabel(r._labels?.agent_id) || 'Unassigned',
      stageSince: r.updated_at, dealDate: r.deal_date, targetClose: r.target_close, actualClose: r.actual_close, cancelled: r.job_status === 'Cancelled', sample: false,
    }
  }), [jobsQ.data])
  const sampleDeals: Deal[] = useMemo(() => SAMPLE.map((s, i) => ({ ...s, id: `sample-${i}`, sample: true, stage: sampleStages[`sample-${i}`] ?? s.stage })), [sampleStages])
  const all = useMemo(() => [...realDeals, ...(showSample ? sampleDeals : [])].filter(d => !d.cancelled), [realDeals, sampleDeals, showSample])
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
  const cancelledCount = [...realDeals, ...(showSample ? sampleDeals : [])].filter(d => d.cancelled && (type === 'All' || d.type === type) && (agent === 'all' || d.agent === agent)).length
  // won ÷ (won + cancelled + stale deals > 30 days past target close)
  const lost = cancelledCount + open.filter(d => (daysUntil(d.targetClose) ?? 1) < -30).length
  const winRate = closed.length + lost ? (closed.length / (closed.length + lost)) * 100 : 0
  const viewingsOpen = (viewingsQ.data ?? []).filter(v => ['Scheduled', 'Confirmed', 'Rescheduled'].includes(v.status)).length
  const offersLive = (offersQ.data ?? []).filter(o => ['Submitted', 'Under Review', 'Negotiating', 'Countered'].includes(o.status)).length

  // ------------------------------------------------ move (optimistic + rollback)
  const canEdit = can('sales', 'edit')
  const mut = useMutation({
    mutationFn: ({ recId, stage }: { recId: number; stage: StageKey }) => put(`/api/e/jobs/${recId}`, { operational_status: stage }),
    onMutate: async ({ recId, stage }) => {
      await qc.cancelQueries({ queryKey: ['swk-rows', 'jobs'] })
      const prev = qc.getQueryData<Row[]>(['swk-rows', 'jobs'])
      qc.setQueryData<Row[]>(['swk-rows', 'jobs'], rows => (rows ?? []).map(r => r.id === recId ? { ...r, operational_status: stage, updated_at: new Date().toISOString() } : r))
      return { prev }
    },
    onError: (e: any, _v, ctx) => { if (ctx?.prev) qc.setQueryData(['swk-rows', 'jobs'], ctx.prev); setToast({ tone: 'err', text: `Move rolled back — ${e?.message ?? 'server rejected the change'}` }) },
    onSuccess: (_d, v) => setToast({ tone: 'ok', text: `Deal moved to ${STAGES[stageIdx(v.stage)].label} · saved to deal file` }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['swk-rows', 'jobs'] }),
  })
  const move = useCallback((id: string, stage: StageKey) => {
    const d = all.find(x => x.id === id); if (!d || d.stage === stage) return
    if (d.sample) { setSampleStages(s => ({ ...s, [id]: stage })); return }
    if (!VALID.has(stage)) return
    if (!canEdit) { setToast({ tone: 'err', text: 'You do not have permission to edit deal files.' }); return }
    mut.mutate({ recId: d.recId!, stage })
  }, [all, canEdit, mut])

  const onDrop = (e: DragEvent, stage: StageKey) => { e.preventDefault(); setOverCol(null); const id = e.dataTransfer.getData('text/plain'); if (id) move(id, stage) }
  const opened = all.find(d => d.id === openId) ?? null

  return (
    <div className="flex flex-col gap-5">
      <ModuleHeader eyebrow="Sales · Deal Pipeline" icon={<KanbanSquare size={22} />} title="Deal Pipeline"
        subtitle="Every live deal file on the Dubai sales journey — from enquiry to DLD transfer. Drag cards between stages; changes save to the deal file instantly."
        actions={<>
          <label className="swk-toggle"><input type="checkbox" checked={showSample} onChange={e => setShowSample(e.target.checked)} />Blend sample deals</label>
          <Link to="/e/jobs/new" className="swk-btn swk-btn-gold"><FileSignature size={15} />New deal file</Link>
        </>} />

      <Reveal className="grid gap-4 grid-cols-2 xl:grid-cols-4">
        <StatTile tone="navy" label="Open pipeline value" value={pipelineValue} format={v => aed(v, { compact: true })} icon={<Wallet size={16} />} hint={`${open.length} open deals`} spark={STAGES.map(s => open.filter(d => d.stage === s.key).reduce((a, d) => a + d.value, 0))} />
        <StatTile label="Weighted forecast GCI" value={weightedGci} format={v => aed(v, { compact: true })} icon={<Target size={16} />} hint="stage probability × commission (ex-VAT)" />
        <StatTile label="Avg days to close" value={avgDays} format={v => `${Math.round(v)} days`} icon={<Timer size={16} />} hint={`${closed.length} closed deals`} />
        <StatTile tone="champ" label="Win rate" value={winRate} format={v => pct(v, 0)} icon={<Trophy size={16} />} hint={<span className="flex gap-2"><span><Eye size={11} className="inline" /> {viewingsOpen} viewings</span><span><HandCoins size={11} className="inline" /> {offersLive} live offers</span></span>} />
      </Reveal>

      <div className="flex flex-wrap items-center gap-2.5">
        <Segmented layoutId="pipe-type" value={type} onChange={setType} options={(['All', 'Sale', 'Lease', 'Off-plan'] as const).map(v => ({ value: v, label: v }))} />
        <label className="swk-field-box" style={{ height: 40 }}>
          <span className="sr-only">Agent</span>
          <select aria-label="Filter by agent" value={agent} onChange={e => setAgent(e.target.value)} style={{ fontSize: 13.5, paddingRight: 12 }}>
            <option value="all">All agents</option>{agents.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <SearchBox value={q} onChange={setQ} placeholder="Search deal, client, property…" label="Search deals" />
        <span className="text-[12.5px] ml-auto" style={{ color: MUTED }}>{jobsQ.isLoading ? 'Loading deal files…' : `${realDeals.length} deal files from the database${showSample ? ` · ${sampleDeals.length} sample` : ''}`}</span>
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
      <p className="text-[11.5px] -mt-2" style={{ color: MUTED }}>Tip: focus a card and press <kbd>Alt</kbd> + <kbd>←</kbd>/<kbd>→</kbd> to move it between stages. Commission shown incl. 5% VAT.</p>

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
              <Pill tone={typeTone(d.type) as any}>{d.type}</Pill>
              {d.sample ? <SamplePill /> : d.jobNo && <span className="text-[10.5px] font-semibold" style={{ color: MUTED }}>{d.jobNo}</span>}
            </div>
            <div className="font-semibold text-[13.5px] leading-snug" style={{ color: INK }}>{d.name}</div>
            <div className="text-[11.5px] truncate" style={{ color: MUTED }}>{d.client} · {d.property}</div>
          </div>
          <GripVertical size={15} className="opacity-30 group-hover:opacity-70 flex-none mt-1" aria-hidden />
        </div>
        <div className="flex items-end justify-between mt-2.5">
          <div>
            <div className="font-display font-semibold text-[16px] tabular-nums" style={{ color: INK }}>{aed(d.value, { compact: true })}</div>
            <div className="text-[11px] tabular-nums" style={{ color: SWK.champDeep }}><Percent size={10} className="inline" /> {d.pct}% · {aed(commission(d), { compact: true })} incl. VAT</div>
          </div>
          <Avatar name={d.agent} size={28} />
        </div>
        <div className="flex items-center justify-between mt-2.5 pt-2 text-[11px]" style={{ borderTop: '1px dashed #ece5d6', color: MUTED }}>
          <span className="flex items-center gap-1"><Clock size={11} />{inStage}d in stage</span>
          {d.stage === 'Closed' ? <span className="flex items-center gap-1" style={{ color: SWK.oasis }}><CheckCircle2 size={11} />Closed</span> :
            due === null ? <span>No target date</span> :
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
  const formStage: Record<string, number> = { 'Form A': 0, 'Form B': 1, 'Form I': 2, 'Form F': 4, NOC: 5, 'Title deed': 7 }
  return (
    <Drawer open={!!deal} onClose={onClose} width={500}
      title={deal?.name ?? ''} subtitle={deal && <>{deal.client} · {deal.property}</>}>
      {deal && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-4 rounded-2xl p-4" style={{ background: 'linear-gradient(150deg,#14305c,#0b1a33)', color: '#d9e1ee' }}>
            <ProgressRing value={progress} size={86} color={SWK.champ} track="rgba(255,255,255,.12)" label={<span style={{ color: '#fff' }}>{Math.round(progress)}%</span>} />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] uppercase tracking-[.18em]" style={{ color: SWK.champ }}>Transfer checklist</div>
              <div className="font-display text-[20px] font-semibold text-white">{aed(deal.value)}</div>
              <div className="text-[12px]">Commission {aed(commission(deal))} incl. VAT · {deal.agent}</div>
              {deal.sample && <div className="mt-1"><SamplePill /></div>}
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
            <p className="text-[11px] mt-2" style={{ color: MUTED }}>Checklist ticks are kept on this device. Target close {fmtD(deal.targetClose)}.</p>
          </div>

          {deal.recId ? <Link to={`/e/jobs/${deal.recId}`} className="swk-btn swk-btn-primary"><ArrowUpRight size={15} />Open deal file {deal.jobNo}</Link>
            : <div className="text-[12px] rounded-xl p-3" style={{ background: '#f3ead8', color: '#7d5f2c' }}>This is a sample deal used to demonstrate the pipeline — it has no deal file.</div>}
        </div>
      )}
    </Drawer>
  )
}
