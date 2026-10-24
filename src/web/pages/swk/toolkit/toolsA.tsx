/** Toolkit calculators a–d: cost-to-close, mortgage pre-qualifier, RERA rent increase, yield & ROI. */
import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, BellRing, ShieldCheck } from 'lucide-react'
import { CHART, Field, Pill, SWK, aed, num, pct } from '../../../swk/ui'
import { COMMUNITIES, RENT_INDEX, RERA_BANDS, UAE, costToClose, mortgagePlan, reraIncrease, yieldCalc, type Residency } from '../../../swk/uae'
import { Donut, Gauge, Hero, KV, Legend, LiveBar, LiveRing, MiniStat, Select, Toggle, ToolLayout } from './parts'

const fmtM = (v: number) => aed(v, { compact: true })

// ---------------------------------------------------------------- a. cost to close
export function CostToCloseTool() {
  const [price, setPrice] = useState(2_500_000)
  const [mortgage, setMortgage] = useState(true)
  const [downPct, setDownPct] = useState(20)
  const [brokerPct, setBrokerPct] = useState(2)
  const [noc, setNoc] = useState(1500)
  const loan = mortgage ? price * (1 - Math.min(100, downPct) / 100) : 0
  const r = useMemo(() => costToClose({ price, loan, brokerPct: brokerPct / 100, nocFee: noc }), [price, loan, brokerPct, noc])
  const parts = r.lines.map((l, i) => ({ label: l.label, value: l.amount, color: CHART[i % CHART.length] }))
  const summary = () => [
    `*Buyer cost-to-close — Dubai*`, `Purchase price: ${aed(price)}`,
    mortgage ? `Mortgage: ${aed(loan)} (${100 - downPct}% LTV) · Down payment ${aed(r.downPayment)}` : 'Cash purchase',
    '', ...r.lines.map(l => `• ${l.label}: ${aed(l.amount)}`), '',
    `*Total fees: ${aed(r.fees)}* (${pct(r.feesPct)} of price)`, `*Total cash required: ${aed(r.cashRequired)}*`,
  ].join('\n')
  return (
    <ToolLayout title="Total cash to close" subtitle="DLD, trustee, agency, NOC and mortgage costs" summary={summary}
      inputs={<>
        <Field label="Purchase price" prefix="AED" value={price} onChange={setPrice} step={50000} />
        <Toggle label="Buying with a mortgage" hint="Adds DLD mortgage registration, valuation & arrangement fee" checked={mortgage} onChange={setMortgage} />
        {mortgage && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="grid grid-cols-2 gap-3">
          <Field label="Down payment" suffix="%" value={downPct} onChange={setDownPct} step={5} hint={`Loan ${fmtM(loan)}`} />
          <Field label="Loan amount" prefix="AED" value={Math.round(loan)} onChange={v => setDownPct(price ? Math.max(0, 100 - (v / price) * 100) : 0)} step={50000} />
        </motion.div>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Agency commission" suffix="% + VAT" value={brokerPct} onChange={setBrokerPct} step={0.25} hint="Form B" />
          <Field label="Developer NOC" prefix="AED" value={noc} onChange={setNoc} step={250} hint="AED 500 – 5,000" />
        </div>
      </>}>
      <Hero label="Total cash required" value={r.cashRequired} sub={<>Down payment {aed(r.downPayment)} + fees {aed(r.fees)}</>} />
      <div className="grid grid-cols-3 gap-3">
        <MiniStat label="Total fees" value={r.fees} />
        <MiniStat label="Fees % of price" value={r.feesPct} format={v => pct(v, 2)} accent={SWK.champDeep} />
        <MiniStat label="DLD 4%" value={price * UAE.dldTransferPct} />
      </div>
      <div className="flex flex-col sm:flex-row items-center gap-5">
        <Donut parts={parts} center={<div><div className="text-[10.5px] uppercase tracking-wider text-muted">Fees</div><div className="font-display text-[20px] font-semibold text-ink">{fmtM(r.fees)}</div></div>} />
        <Legend items={parts} />
      </div>
      <div className="rounded-2xl border border-[#efe9dc] p-3">
        <div className="text-[12px] font-semibold text-muted mb-2">Cash split</div>
        <div className="flex h-3 rounded-full overflow-hidden">
          <motion.div animate={{ width: `${(r.downPayment / r.cashRequired) * 100}%` }} transition={{ duration: 0.8 }} style={{ background: SWK.navy }} />
          <motion.div animate={{ width: `${(r.fees / r.cashRequired) * 100}%` }} transition={{ duration: 0.8 }} style={{ background: SWK.champ }} />
        </div>
        <div className="flex justify-between text-[12px] mt-1.5 text-muted"><span>Down payment {pct((r.downPayment / r.cashRequired) * 100, 0)}</span><span>Fees {pct((r.fees / r.cashRequired) * 100, 0)}</span></div>
      </div>
    </ToolLayout>
  )
}

// ---------------------------------------------------------------- b. mortgage pre-qualifier
export function MortgageTool() {
  const [price, setPrice] = useState(3_000_000)
  const [residency, setResidency] = useState<Residency>('expat')
  const [firstHome, setFirstHome] = useState(true)
  const [offPlan, setOffPlan] = useState(false)
  const [rate, setRate] = useState(4.25)
  const [years, setYears] = useState(25)
  const [income, setIncome] = useState(60_000)
  const [debts, setDebts] = useState(3_000)
  const p = useMemo(() => mortgagePlan({ price, residency, firstHome, offPlan, ratePct: rate, years: Math.min(25, years), income, debts }), [price, residency, firstHome, offPlan, rate, years, income, debts])
  const dbrPct = p.dbr * 100
  const color = dbrPct <= 40 ? SWK.oasis : dbrPct <= 50 ? SWK.champ : SWK.dune
  const summary = () => [
    `*Mortgage pre-qualification (CBUAE rules)*`, `Property: ${aed(price)} · ${residency === 'national' ? 'UAE national' : 'Expat'} · ${firstHome ? 'first home' : 'additional property'}${offPlan ? ' · off-plan' : ''}`,
    `Max LTV: ${pct(p.ltv * 100, 0)} → loan ${aed(p.loan)}, down payment ${aed(price - p.loan)}`,
    `Rate ${rate}% over ${p.years} yrs → *EMI ${aed(p.emi)}/month*`,
    `Debt burden ratio: ${pct(dbrPct)} (cap 50%) — ${p.dbrOk ? 'within limit ✅' : 'above limit ⚠️'}`,
    `Max affordable price on income: ${aed(p.maxPriceByDbr)}`, `Total interest over term: ${aed(p.totalInterest)}`,
  ].join('\n')
  return (
    <ToolLayout title="Pre-qualification" subtitle="CBUAE LTV caps, 25-year max tenure and 50% DBR" summary={summary}
      inputs={<>
        <Field label="Property price" prefix="AED" value={price} onChange={setPrice} step={50000} />
        <Select label="Residency" value={residency} onChange={v => setResidency(v as Residency)} options={[{ value: 'expat', label: 'Expat resident' }, { value: 'national', label: 'UAE national' }]} />
        <div className="grid sm:grid-cols-2 gap-3">
          <Toggle label="First home" checked={firstHome} onChange={setFirstHome} />
          <Toggle label="Off-plan" hint="Max 50% LTV" checked={offPlan} onChange={setOffPlan} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Interest rate" suffix="%" value={rate} onChange={setRate} step={0.05} />
          <Field label="Tenure" suffix="yrs" value={years} onChange={v => setYears(Math.min(25, Math.max(1, v)))} hint="Max 25 years" />
          <Field label="Monthly income" prefix="AED" value={income} onChange={setIncome} step={1000} />
          <Field label="Existing debts / mo" prefix="AED" value={debts} onChange={setDebts} step={500} hint="Cards: 5% of limit" />
        </div>
      </>}>
      <div className="grid sm:grid-cols-[1fr_auto] gap-4 items-center">
        <Hero label="Monthly instalment (EMI)" value={p.emi} sub={<>Loan {aed(p.loan)} · {p.years} years @ {rate}%</>} />
        <motion.div key={p.ltv} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }}
          className="rounded-2xl px-5 py-4 text-center border" style={{ background: SWK.champSoft, borderColor: '#e6d7b8' }}>
          <div className="text-[10.5px] uppercase tracking-wider font-semibold text-muted">Max LTV</div>
          <div className="font-display text-[34px] font-semibold text-ink leading-none mt-1">{pct(p.ltv * 100, 0)}</div>
          <div className="text-[11.5px] text-muted mt-1">min down {pct(100 - p.ltv * 100, 0)}</div>
        </motion.div>
      </div>
      <div className="grid sm:grid-cols-[auto_1fr] gap-5 items-center">
        <div className="flex flex-col items-center">
          <Gauge value={dbrPct} cap={50} color={color} label={pct(dbrPct)} sub="Debt burden ratio" />
          <Pill tone={dbrPct <= 40 ? 'oasis' : dbrPct <= 50 ? 'champ' : 'dune'} className="mt-1">{dbrPct <= 40 ? 'Comfortable' : dbrPct <= 50 ? 'Near the cap' : 'Exceeds 50% cap'}</Pill>
        </div>
        <div className="space-y-0.5">
          <KV k="Loan amount" v={aed(p.loan)} />
          <KV k="Down payment" v={aed(price - p.loan)} />
          <KV k="Max loan on income (DBR)" v={aed(p.loanByDbr)} />
          <KV k="Max affordable price" v={<span style={{ color: p.maxPriceByDbr >= price ? SWK.oasis : SWK.dune }}>{aed(p.maxPriceByDbr)}</span>} strong />
          <KV k="Total interest" v={aed(p.totalInterest)} />
        </div>
      </div>
      <div>
        <div className="text-[12px] font-semibold text-muted mb-1">Outstanding balance vs principal repaid</div>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={p.schedule} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="tk-bal" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={SWK.navy} stopOpacity={0.35} /><stop offset="100%" stopColor={SWK.navy} stopOpacity={0} /></linearGradient>
                <linearGradient id="tk-paid" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={SWK.champ} stopOpacity={0.4} /><stop offset="100%" stopColor={SWK.champ} stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid stroke="#efe9dc" vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: SWK.muted }} axisLine={false} tickLine={false} tickFormatter={v => `Y${v}`} />
              <YAxis tick={{ fontSize: 11, fill: SWK.muted }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1e6).toFixed(1)}M`} width={40} />
              <Tooltip formatter={(v: any, k: any) => [aed(Number(v)), k === 'balance' ? 'Balance' : 'Repaid']} labelFormatter={l => `Year ${l}`} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
              <Area type="monotone" dataKey="balance" stroke={SWK.navy} strokeWidth={2.2} fill="url(#tk-bal)" />
              <Area type="monotone" dataKey="paid" stroke={SWK.champDeep} strokeWidth={2.2} fill="url(#tk-paid)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </ToolLayout>
  )
}

// ---------------------------------------------------------------- c. RERA rent increase
const UNIT_TYPES = ['Studio', '1 BR', '2 BR', '3 BR']
export function RentIncreaseTool() {
  const [community, setCommunity] = useState('Dubai Marina')
  const [unit, setUnit] = useState('1 BR')
  const [index, setIndex] = useState(RENT_INDEX['Dubai Marina']['1 BR'])
  const [rent, setRent] = useState(80_000)
  const pick = (c: string, u: string) => { setCommunity(c); setUnit(u); setIndex(RENT_INDEX[c]?.[u] ?? index) }
  const r = reraIncrease(rent, index)
  const summary = () => [
    `*RERA rent increase check (Decree 43/2013)*`, `${unit} · ${community}`,
    `Current rent: ${aed(rent)} · RERA index average: ${aed(index)}`,
    `Rent is ${pct(r.below)} below index → band "${r.band.label}"`,
    `*Max permitted increase: ${r.maxIncreasePct}% → new rent up to ${aed(r.maxRent)}*`,
    `Reminder: 90-day written notice required before renewal (Law 26/2007 as amended).`,
  ].join('\n')
  return (
    <ToolLayout title="Permitted renewal rent" subtitle="Dubai Decree 43 of 2013 bands against the RERA index" summary={summary}
      inputs={<>
        <Select label="Community" value={community} onChange={c => pick(c, unit)} options={Object.keys(RENT_INDEX)} />
        <Select label="Unit type" value={unit} onChange={u => pick(community, u)} options={UNIT_TYPES} />
        <Field label="RERA index average (editable)" prefix="AED" value={index} onChange={setIndex} step={1000} hint="Pre-filled from indicative index — check the live DLD Rental Index calculator" />
        <Field label="Current annual rent" prefix="AED" value={rent} onChange={setRent} step={1000} />
      </>}>
      <div className="grid sm:grid-cols-2 gap-3">
        <Hero label="Max new annual rent" value={r.maxRent} sub={<>+{aed(r.maxIncrease)} · up to {r.maxIncreasePct}%</>} />
        <div className="rounded-2xl border border-[#efe9dc] bg-[#fbf9f5] p-4 flex flex-col justify-center gap-2">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-muted">Position vs index</div>
          <div className="font-display text-[26px] font-semibold text-ink">{rent >= index ? 'At / above index' : `${pct(r.below)} below`}</div>
          <LiveBar value={Math.min(rent, index)} max={index} color={SWK.champ} height={10} />
          <div className="flex justify-between text-[11.5px] text-muted"><span>Your rent {fmtM(rent)}</span><span>Index {fmtM(index)}</span></div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="swk-table">
          <thead><tr><th>Rent vs RERA index</th><th className="num">Max increase</th><th className="num">New rent cap</th></tr></thead>
          <tbody>
            {RERA_BANDS.map(b => {
              const on = b === r.band
              return (
                <tr key={b.label} className="relative" aria-current={on || undefined}>
                  <td className="relative">
                    {on && <motion.span layoutId="rera-band" className="absolute inset-y-1 -left-1 w-1 rounded-full" style={{ background: SWK.champ }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} />}
                    <span className={on ? 'font-semibold' : ''}>{b.label}</span> {on && <Pill tone="champ" className="ml-1">Your band</Pill>}
                  </td>
                  <td className="num" style={on ? { fontWeight: 700, color: SWK.navy } : undefined}>{b.increase}%</td>
                  <td className="num" style={on ? { fontWeight: 700, color: SWK.navy, background: SWK.champSoft } : { color: SWK.muted }}>{aed(rent * (1 + b.increase / 100))}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-start gap-3 rounded-2xl p-4" style={{ background: '#fbe4dd', color: '#7c2c1a' }}>
        <BellRing size={18} className="flex-none mt-0.5" />
        <div className="text-[13px]"><b>90-day written notice required before renewal</b> (Law 26/2007 as amended). Any increase must be notified at least 90 days before expiry; Ejari renewal follows the signed agreement. Disputes go to the Rental Dispute Settlement Centre (RDSC).</div>
      </div>
    </ToolLayout>
  )
}

// ---------------------------------------------------------------- d. yield & ROI
export function YieldTool() {
  const [community, setCommunity] = useState('Business Bay')
  const [price, setPrice] = useState(1_800_000)
  const [rent, setRent] = useState(130_000)
  const [area, setArea] = useState(1_100)
  const [sc, setSc] = useState(17)
  const [vac, setVac] = useState(3)
  const [maint, setMaint] = useState(3)
  const [mgmt, setMgmt] = useState(5)
  const pickCommunity = (n: string) => { setCommunity(n); const c = COMMUNITIES.find(x => x.name === n); if (c) setSc(c.serviceCharge) }
  const y = useMemo(() => yieldCalc({ price, annualRent: rent, areaSqft: area, serviceChargePerSqft: sc, vacancyWeeks: vac, maintenancePct: maint, mgmtFeePct: mgmt }), [price, rent, area, sc, vac, maint, mgmt])
  const bench = COMMUNITIES.find(c => c.name === community)
  const exp = [
    { label: 'Service charge', value: y.serviceCharge, color: SWK.navy },
    { label: `Vacancy (${vac} wks)`, value: y.vacancy, color: SWK.dune },
    { label: 'Maintenance', value: y.maint, color: SWK.champ },
    { label: 'Management fee', value: y.mgmt, color: SWK.oasis },
  ]
  const maxE = Math.max(...exp.map(e => e.value), 1)
  const summary = () => [
    `*Rental yield & ROI*${community !== 'Custom' ? ` — ${community}` : ''}`, `Price ${aed(price)} · Rent ${aed(rent)}/yr · ${num(area)} sq ft`,
    `Gross yield: *${pct(y.gross, 2)}* · Net yield: *${pct(y.net, 2)}* (after costs & acquisition fees)`,
    `Net annual income: ${aed(y.netIncome)}`, ...exp.map(e => `• ${e.label}: ${aed(e.value)}`),
    `Acquisition costs: ${aed(y.acquisition)} · Payback: ${Number.isFinite(y.paybackYears) ? `${y.paybackYears.toFixed(1)} years` : 'n/a'}`,
  ].join('\n')
  return (
    <ToolLayout title="Yield & return" subtitle="Gross vs net yield after service charges, vacancy & fees" summary={summary}
      inputs={<>
        <Select label="Community (pre-fills service charge)" value={community} onChange={pickCommunity} options={[...COMMUNITIES.map(c => c.name), 'Custom']} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Purchase price" prefix="AED" value={price} onChange={setPrice} step={50000} />
          <Field label="Annual rent" prefix="AED" value={rent} onChange={setRent} step={1000} />
          <Field label="Area (BUA)" suffix="sq ft" value={area} onChange={setArea} step={10} />
          <Field label="Service charge" suffix="AED/sq ft" value={sc} onChange={setSc} step={0.5} />
          <Field label="Vacancy" suffix="weeks" value={vac} onChange={setVac} />
          <Field label="Maintenance" suffix="% rent" value={maint} onChange={setMaint} step={0.5} />
        </div>
        <Field label="Property management fee" suffix="% rent" value={mgmt} onChange={setMgmt} step={0.5} />
      </>}>
      <div className="flex flex-wrap items-center justify-around gap-5">
        <div className="flex flex-col items-center gap-1"><LiveRing value={y.gross} max={10} color={SWK.navy} label={pct(y.gross, 2)} sub="Gross" size={136} /></div>
        <div className="flex flex-col items-center gap-1"><LiveRing value={Math.max(0, y.net)} max={10} color={SWK.oasis} label={pct(y.net, 2)} sub="Net" size={136} /></div>
        <div className="min-w-[180px] flex-1 space-y-2">
          <MiniStat label="Net annual income" value={y.netIncome} accent={y.netIncome >= 0 ? SWK.oasis : SWK.dune} />
          <MiniStat label="Payback period" value={Number.isFinite(y.paybackYears) ? y.paybackYears : 0} format={v => (Number.isFinite(y.paybackYears) ? `${v.toFixed(1)} yrs` : 'n/a')} />
        </div>
      </div>
      {bench && <div className="flex items-center gap-2 text-[12.5px] rounded-xl px-3 py-2" style={{ background: SWK.champSoft }}>
        {y.gross >= bench.yieldPct ? <ShieldCheck size={15} color={SWK.oasis} /> : <AlertTriangle size={15} color={SWK.dune} />}
        {community} index gross yield is {pct(bench.yieldPct)} — this deal is <b>{y.gross >= bench.yieldPct ? 'above' : 'below'}</b> the community benchmark.
      </div>}
      <div className="space-y-3">
        <div className="text-[12px] font-semibold text-muted">Annual expenses</div>
        {exp.map(e => (
          <div key={e.label} className="grid grid-cols-[130px_1fr_auto] gap-3 items-center text-[13px]">
            <span className="text-muted truncate">{e.label}</span><LiveBar value={e.value} max={maxE} color={e.color} height={10} /><b className="tabular-nums text-ink">{aed(e.value)}</b>
          </div>
        ))}
      </div>
      <div><KV k="Gross rent" v={aed(rent)} /><KV k="Total operating costs" v={aed(exp.reduce((s, e) => s + e.value, 0))} /><KV k="One-off acquisition costs (DLD, trustee, agency)" v={aed(y.acquisition)} /><KV k="Net income" v={aed(y.netIncome)} strong /></div>
    </ToolLayout>
  )
}
