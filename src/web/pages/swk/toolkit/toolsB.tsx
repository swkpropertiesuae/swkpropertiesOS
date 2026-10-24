/** Toolkit calculators e–h: Golden Visa, commission waterfall, tenant move-in, off-plan payment plan. */
import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Bar as RBar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { format as fmtD } from 'date-fns'
import { Award, BadgeCheck, CalendarClock, CircleAlert, Hourglass, Receipt } from 'lucide-react'
import { Field, Pill, Segmented, SWK, aed, num, pct } from '../../../swk/ui'
import { UAE, commissionWaterfall, leaseCosts, paymentPlan, visaEligibility } from '../../../swk/uae'
import { DateField, Donut, Hero, KV, Legend, LiveBar, MiniStat, Toggle, ToolLayout } from './parts'

const fmtM = (v: number) => aed(v, { compact: true })

// ---------------------------------------------------------------- e. Golden Visa
export function VisaTool() {
  const [value, setValue] = useState(2_200_000)
  const [owners, setOwners] = useState(1)
  const [mortgaged, setMortgaged] = useState(false)
  const [offPlan, setOffPlan] = useState(false)
  const v = visaEligibility({ value, jointOwners: Math.max(1, owners), mortgaged, offPlan })
  const tone = v.golden ? { bg: `linear-gradient(140deg, ${SWK.champ}, ${SWK.champDeep})`, ic: <Award size={30} />, fg: SWK.midnight } : v.investor ? { bg: `linear-gradient(140deg, ${SWK.navy}, ${SWK.midnight})`, ic: <BadgeCheck size={30} />, fg: '#fff' } : { bg: 'linear-gradient(140deg, #efe9dd, #e2d9c7)', ic: <Hourglass size={30} />, fg: SWK.ink }
  const notes = [...v.notes, 'Title deed (or Oqood + developer letter) and DLD valuation are required; application via ICP / GDRFA Dubai.', 'Family (spouse, children) and domestic staff can be sponsored on the Golden Visa.']
  const summary = () => [
    `*UAE residency visa check (property route)*`, `Property value: ${aed(value)}${owners > 1 ? ` · ${owners} owners → share ${aed(v.share)}` : ''}${mortgaged ? ' · mortgaged' : ''}${offPlan ? ' · off-plan' : ''}`,
    `*Result: ${v.tier}*`, v.golden ? 'Meets the AED 2M Golden Visa threshold ✅' : `Gap to AED 2M Golden Visa: ${aed(v.gap)}`,
    '', ...notes.map(n => `• ${n}`),
  ].join('\n')
  return (
    <ToolLayout title="Visa verdict" subtitle="AED 2M 10-year Golden Visa · AED 750k 2-year investor visa" summary={summary}
      inputs={<>
        <Field label="Property value (title deed / DLD valuation)" prefix="AED" value={value} onChange={setValue} step={50000} />
        <Field label="Number of joint owners" value={owners} onChange={v => setOwners(Math.max(1, Math.round(v)))} min={1} hint="Each owner's share must meet the threshold" />
        <Toggle label="Mortgaged" hint="Bank NOC required" checked={mortgaged} onChange={setMortgaged} />
        <Toggle label="Off-plan" hint="DLD-approved developer" checked={offPlan} onChange={setOffPlan} />
      </>}>
      <AnimatePresence mode="wait">
        <motion.div key={v.tier} initial={{ opacity: 0, scale: 0.94, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          className="relative overflow-hidden rounded-3xl p-6 flex items-center gap-5" style={{ background: tone.bg, color: tone.fg }} role="status">
          <motion.div initial={{ rotate: -20, scale: 0.6 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.1 }} className="w-16 h-16 rounded-2xl grid place-items-center flex-none" style={{ background: 'rgba(255,255,255,.18)' }}>{tone.ic}</motion.div>
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[.16em] font-semibold opacity-75">Verdict</div>
            <div className="font-display text-[28px] sm:text-[32px] font-semibold leading-tight">{v.tier}</div>
            <div className="text-[13px] opacity-80">Qualifying share {aed(v.share)}</div>
          </div>
        </motion.div>
      </AnimatePresence>
      <div>
        <div className="flex justify-between text-[12px] font-semibold text-muted mb-2"><span>Progress to AED 2M</span><span>{v.golden ? 'Threshold met' : `Gap ${aed(v.gap)}`}</span></div>
        <div className="relative">
          <LiveBar value={v.share} max={UAE.goldenVisaMin} color={v.golden ? SWK.champ : v.investor ? SWK.navy : SWK.muted} height={14} />
          <div className="absolute top-[-4px] bottom-[-4px] w-0.5" style={{ left: `${(UAE.investorVisaMin / UAE.goldenVisaMin) * 100}%`, background: SWK.ink }} />
        </div>
        <div className="relative h-5 text-[11px] text-muted mt-1">
          <span className="absolute left-0">AED 0</span>
          <span className="absolute -translate-x-1/2" style={{ left: '37.5%' }}>750k investor</span>
          <span className="absolute right-0">2M Golden</span>
        </div>
      </div>
      <ul className="space-y-2">
        {notes.map((n, i) => (
          <motion.li key={n} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }} className="flex gap-2 text-[13px] text-ink">
            <CircleAlert size={15} className="flex-none mt-0.5" color={SWK.champDeep} />{n}
          </motion.li>
        ))}
      </ul>
    </ToolLayout>
  )
}

// ---------------------------------------------------------------- f. commission waterfall
export function CommissionTool() {
  const [price, setPrice] = useState(3_500_000)
  const [pctC, setPctC] = useState(2)
  const [co, setCo] = useState(50)
  const [ref, setRef] = useState(0)
  const [split, setSplit] = useState(50)
  const [lead, setLead] = useState(5)
  const w = commissionWaterfall({ price, pct: pctC, coBrokerShare: co, referralPct: ref, agentSplit: split, leaderOverride: lead })
  const data = useMemo(() => {
    let run = 0
    return w.steps.map((s, i) => {
      if (i === 0) { run = s.value; return { label: s.label, base: 0, v: s.value, color: SWK.navy, raw: s.value } }
      if (i === w.steps.length - 1) return { label: s.label, base: 0, v: s.value, color: SWK.oasis, raw: s.value }
      run += s.value
      return { label: s.label, base: run, v: -s.value, color: [SWK.ocean, SWK.sky, SWK.champ, SWK.champDeep][i - 1], raw: s.value }
    })
  }, [w])
  const summary = () => [
    `*Commission waterfall*`, `Sale price ${aed(price)} @ ${pctC}%`,
    ...w.steps.map(s => `• ${s.label}: ${aed(s.value)}`), '',
    `*Tax invoice: ${aed(w.gross)} + VAT 5% ${aed(w.vat)} = ${aed(w.invoiceTotal)}*`,
  ].join('\n')
  return (
    <ToolLayout title="Commission split" subtitle="Form I co-broke, referral, agent split & leader override" summary={summary}
      inputs={<>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sale price" prefix="AED" value={price} onChange={setPrice} step={50000} />
          <Field label="Commission" suffix="%" value={pctC} onChange={setPctC} step={0.25} />
          <Field label="Co-broker share (Form I)" suffix="%" value={co} onChange={setCo} step={5} />
          <Field label="Referral" suffix="%" value={ref} onChange={setRef} step={5} />
          <Field label="Agent split" suffix="%" value={split} onChange={setSplit} step={5} />
          <Field label="Leader override" suffix="%" value={lead} onChange={setLead} step={1} />
        </div>
      </>}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniStat label="Gross" value={w.gross} format={fmtM} />
        <MiniStat label="Agent" value={w.agent} format={fmtM} accent={SWK.champDeep} />
        <MiniStat label="Co-broker" value={w.coBroker} format={fmtM} />
        <MiniStat label="SWK net" value={w.company} format={fmtM} accent={SWK.oasis} />
      </div>
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 6, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#efe9dc" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10.5, fill: SWK.muted }} axisLine={false} tickLine={false} interval={0} tickFormatter={(s: string) => s.split(' ')[0]} />
            <YAxis tick={{ fontSize: 11, fill: SWK.muted }} axisLine={false} tickLine={false} tickFormatter={v => `${Math.round(v / 1000)}k`} width={40} />
            <Tooltip cursor={{ fill: '#f6f2ea' }} formatter={(_v: any, k: any, item: any) => (k === 'base' ? [null, null] : [aed(item?.payload?.raw), item?.payload?.label])} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
            <RBar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} />
            <RBar dataKey="v" stackId="w" radius={[6, 6, 6, 6]} animationDuration={800}>
              {data.map(d => <Cell key={d.label} fill={d.color} />)}
            </RBar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="rounded-2xl border border-[#e6d7b8] p-4" style={{ background: 'linear-gradient(150deg, #fbf6ec, #f1e6cf)' }}>
        <div className="flex items-center gap-2 mb-2"><Receipt size={16} color={SWK.champDeep} /><b className="text-[14px] text-ink">Tax invoice (VAT 5%)</b><Pill tone="champ" className="ml-auto">FTA</Pill></div>
        <KV k="Commission (excl. VAT)" v={aed(w.gross, { decimals: 2 })} />
        <KV k="VAT @ 5%" v={aed(w.vat, { decimals: 2 })} />
        <KV k="Invoice total" v={aed(w.invoiceTotal, { decimals: 2 })} strong />
      </div>
    </ToolLayout>
  )
}

// ---------------------------------------------------------------- g. tenant move-in
export function MoveInTool() {
  const [rent, setRent] = useState(120_000)
  const [furnished, setFurnished] = useState(false)
  const [villa, setVilla] = useState(false)
  const [cheques, setCheques] = useState('4')
  const [start, setStart] = useState(() => new Date().toISOString().slice(0, 10))
  const n = Number(cheques)
  const l = leaseCosts({ annualRent: rent, furnished, villa, cheques: n })
  const refundable = l.lines.filter(x => x.refundable).reduce((s, x) => s + x.amount, 0)
  const schedule = Array.from({ length: n }, (_, i) => { const d = new Date(start || Date.now()); d.setMonth(d.getMonth() + Math.round((12 / n) * i)); return { i: i + 1, d, amt: l.chequeAmount } })
  const colors = [SWK.oasis, SWK.champ, SWK.navy, SWK.sky, SWK.ocean]
  const summary = () => [
    `*Tenant move-in costs — Dubai*`, `Annual rent ${aed(rent)} · ${n} cheque${n > 1 ? 's' : ''} · ${villa ? 'villa' : 'apartment'}${furnished ? ' · furnished' : ''}`,
    ...l.lines.map(x => `• ${x.label}: ${aed(x.amount)}${x.refundable ? ' (refundable)' : ''}`), '',
    `*Move-in total: ${aed(l.moveIn)}* (refundable ${aed(refundable)})`,
    `PDC schedule: ${n} × ${aed(l.chequeAmount)} from ${fmtD(new Date(start || Date.now()), 'd MMM yyyy')}`,
    `DM housing fee (5%, via DEWA): ~${aed(l.housingFeeMonthly)}/month`,
  ].join('\n')
  return (
    <ToolLayout title="Move-in budget" subtitle="Deposit, agency, Ejari, DEWA and PDC cheques" summary={summary}
      inputs={<>
        <Field label="Annual rent" prefix="AED" value={rent} onChange={setRent} step={1000} />
        <div className="swk-field"><span className="swk-field-label">Number of cheques (PDCs)</span>
          <Segmented layoutId="tk-chq" value={cheques} onChange={setCheques} options={['1', '2', '4', '6', '12'].map(v => ({ value: v, label: v }))} /></div>
        <Toggle label="Furnished" hint="10% security deposit" checked={furnished} onChange={setFurnished} />
        <Toggle label="Villa / townhouse" hint="Higher DEWA deposit" checked={villa} onChange={setVilla} />
        <DateField label="Lease start" value={start} onChange={setStart} />
      </>}>
      <Hero label="Due at move-in" value={l.moveIn} sub={<>Refundable {aed(refundable)} · non-refundable {aed(l.moveIn - refundable)}</>} />
      <div className="flex flex-col sm:flex-row items-center gap-5">
        <Donut size={170} parts={[{ label: 'Refundable', value: refundable, color: SWK.oasis }, { label: 'Non-refundable', value: l.moveIn - refundable, color: SWK.champ }]}
          center={<div><div className="text-[10.5px] uppercase tracking-wider text-muted">Refundable</div><div className="font-display text-[20px] font-semibold text-ink">{pct((refundable / l.moveIn) * 100, 0)}</div></div>} />
        <Legend items={l.lines.map((x, i) => ({ label: `${x.label}${x.refundable ? ' ↺' : ''}`, value: x.amount, color: colors[i % colors.length] }))} />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <div className="text-[12px] font-semibold text-muted mb-2 flex items-center gap-1.5"><CalendarClock size={14} /> PDC cheque schedule</div>
          <ul className="max-h-[240px] overflow-y-auto pr-1">
            <AnimatePresence initial={false}>
              {schedule.map(s => (
                <motion.li key={`${n}-${s.i}`} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ delay: s.i * 0.03 }} className="swk-row !py-2">
                  <span className="swk-row-ic !w-8 !h-8 text-[12px] font-semibold">{s.i}</span>
                  <span className="flex-1 min-w-0"><span className="swk-row-t block">{fmtD(s.d, 'd MMM yyyy')}</span><span className="swk-row-s block">{s.i === 1 ? 'On signing' : 'Post-dated'}</span></span>
                  <b className="tabular-nums text-[13px]">{aed(s.amt)}</b>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
        <div>
          <div className="text-[12px] font-semibold text-muted mb-2">Running costs</div>
          <KV k="DM housing fee (5% of rent)" v={`${aed(l.housingFeeMonthly)}/mo`} />
          <KV k="Housing fee / year" v={aed(rent * UAE.housingFeePct)} />
          <KV k="Effective monthly rent" v={aed(rent / 12)} />
          <KV k="All-in monthly (rent + fee)" v={aed(rent / 12 + l.housingFeeMonthly)} strong />
        </div>
      </div>
    </ToolLayout>
  )
}

// ---------------------------------------------------------------- h. off-plan payment plan
const PHASE_COLOR: Record<string, string> = { Booking: SWK.navy, DLD: SWK.dune, Construction: SWK.champ, Handover: SWK.oasis, 'Post-handover': SWK.ocean }
export function PaymentPlanTool() {
  const today = new Date()
  const [price, setPrice] = useState(2_000_000)
  const [booking, setBooking] = useState(10)
  const [construction, setConstruction] = useState(50)
  const [handover, setHandover] = useState(20)
  const [post, setPost] = useState(20)
  const [ci, setCi] = useState(5)
  const [pi, setPi] = useState(4)
  const [start, setStart] = useState(today.toISOString().slice(0, 10))
  const [hand, setHand] = useState(new Date(today.getFullYear() + 3, today.getMonth(), 1).toISOString().slice(0, 10))
  const plan = useMemo(() => paymentPlan({
    price, bookingPct: booking, constructionPct: construction, handoverPct: handover, postHandoverPct: post,
    constructionInstalments: Math.max(1, Math.round(ci)), postInstalments: Math.max(0, Math.round(pi)),
    start: new Date(start || Date.now()), handover: new Date(hand || Date.now()),
  }), [price, booking, construction, handover, post, ci, pi, start, hand])
  const rows = [...plan.rows].sort((a, b) => a.date.getTime() - b.date.getTime())
  let cum = 0
  const cumData = rows.map(r => { cum += r.amount; return { d: fmtD(r.date, 'MMM yy'), cum: Math.round(cum), pctPaid: (cum / (price * 1.04)) * 100 } })
  const summary = () => [
    `*Off-plan payment plan*`, `Price ${aed(price)} · ${booking}/${construction}/${handover}/${post} (booking/construction/handover/post)`,
    `Handover ${fmtD(new Date(hand), 'MMM yyyy')}`, '',
    ...rows.map(r => `• ${fmtD(r.date, 'd MMM yyyy')} — ${r.label}: ${aed(r.amount)} (${r.pct.toFixed(1)}%)`), '',
    `Total incl. DLD 4% Oqood: ${aed(price * 1.04)}`, plan.valid ? '' : `⚠️ Plan totals ${plan.planPct}% — must equal 100%`,
  ].filter(Boolean).join('\n')
  return (
    <ToolLayout title="Payment schedule" subtitle="Developer plan with DLD Oqood registration" summary={summary}
      inputs={<>
        <Field label="Purchase price" prefix="AED" value={price} onChange={setPrice} step={50000} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Booking" suffix="%" value={booking} onChange={setBooking} />
          <Field label="Construction" suffix="%" value={construction} onChange={setConstruction} />
          <Field label="On handover" suffix="%" value={handover} onChange={setHandover} />
          <Field label="Post-handover" suffix="%" value={post} onChange={setPost} hint="Over 24 months" />
          <Field label="Construction instalments" value={ci} onChange={setCi} min={1} />
          <Field label="Post-handover instalments" value={pi} onChange={setPi} />
          <DateField label="Booking date" value={start} onChange={setStart} />
          <DateField label="Expected handover" value={hand} onChange={setHand} />
        </div>
        <motion.div layout className="rounded-xl px-3 py-2.5 text-[13px] font-semibold flex items-center justify-between" style={{ background: plan.valid ? '#def1ef' : '#fbe4dd', color: plan.valid ? SWK.oasis : '#a33a22' }} role="status">
          <span>{plan.valid ? 'Plan totals 100% ✓' : `Plan totals ${num(plan.planPct, 1)}% — must equal 100%`}</span>
          <span className="tabular-nums">{num(plan.planPct, 1)}%</span>
        </motion.div>
      </>}>
      <div className="flex h-4 rounded-full overflow-hidden" aria-label="Plan split">
        {[['Booking', booking], ['Construction', construction], ['Handover', handover], ['Post-handover', post]].map(([k, v]) => (
          <motion.div key={k as string} animate={{ width: `${(Number(v) / Math.max(100, plan.planPct)) * 100}%` }} transition={{ duration: 0.7 }} style={{ background: PHASE_COLOR[k as string] }} title={`${k} ${v}%`} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <MiniStat label="Before handover" value={price * (booking + construction) / 100} format={fmtM} />
        <MiniStat label="DLD Oqood 4%" value={price * 0.04} format={fmtM} accent={SWK.dune} />
        <MiniStat label="Total outlay" value={price * (plan.planPct / 100) + price * 0.04} format={fmtM} accent={SWK.navy} />
      </div>
      <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-5">
        <ol className="relative pl-6 max-h-[360px] overflow-y-auto pr-1" aria-label="Payment timeline">
          <span className="absolute left-[9px] top-1 bottom-1 w-0.5" style={{ background: '#e7e1d4' }} />
          <AnimatePresence initial={false}>
            {rows.map((r, i) => (
              <motion.li key={`${r.label}-${i}`} layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.025 }} className="relative pb-3">
                <span className="absolute -left-[21px] top-1 w-3.5 h-3.5 rounded-full border-2 border-white shadow" style={{ background: PHASE_COLOR[r.phase] }} />
                <div className="flex justify-between gap-2 text-[13px]"><b className="text-ink truncate">{r.label}</b><b className="tabular-nums whitespace-nowrap">{aed(r.amount)}</b></div>
                <div className="text-[11.5px] text-muted">{fmtD(r.date, 'd MMM yyyy')} · {r.pct.toFixed(1)}% · <span style={{ color: PHASE_COLOR[r.phase] }}>{r.phase}</span></div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
        <div>
          <div className="text-[12px] font-semibold text-muted mb-1">Cumulative paid (incl. DLD)</div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cumData} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#efe9dc" vertical={false} />
                <XAxis dataKey="d" tick={{ fontSize: 10.5, fill: SWK.muted }} axisLine={false} tickLine={false} minTickGap={16} />
                <YAxis tick={{ fontSize: 11, fill: SWK.muted }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1e6).toFixed(1)}M`} width={40} />
                <Tooltip formatter={(v: any) => [aed(Number(v)), 'Paid to date']} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                <Line type="stepAfter" dataKey="cum" stroke={SWK.navy} strokeWidth={2.4} dot={{ r: 3, fill: SWK.champ, stroke: SWK.navy }} animationDuration={900} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="swk-table min-w-[520px]">
          <thead><tr><th>Date</th><th>Milestone</th><th className="num">%</th><th className="num">Amount</th></tr></thead>
          <tbody>{rows.map((r, i) => (
            <tr key={i}><td className="whitespace-nowrap">{fmtD(r.date, 'd MMM yyyy')}</td><td><span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: PHASE_COLOR[r.phase] }} />{r.label}</td><td className="num">{r.pct.toFixed(1)}%</td><td className="num">{aed(r.amount)}</td></tr>
          ))}</tbody>
        </table>
      </div>
    </ToolLayout>
  )
}
