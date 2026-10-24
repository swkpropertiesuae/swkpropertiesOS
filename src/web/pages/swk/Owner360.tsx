import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Award, Building2, Check, Copy, DollarSign, FileBarChart, Home, KeyRound, Percent, ShieldCheck, TrendingUp, UserRoundCog, Wrench,
} from 'lucide-react'
import { get } from '../../lib/api'
import {
  AnimatedNumber, Bar, Card, ModuleHeader, Pill, ProgressRing, Reveal, SWK, StatTile, aed, num, pct,
} from '../../swk/ui'
import { COMMUNITIES, reraIncrease, visaEligibility, yieldCalc } from '../../swk/uae'

type PortfolioOwner = {
  id: number
  name: string
  nationality: string
  email: string
  phone: string
  units: {
    id: number
    title: string
    community: string
    beds: string
    areaSqft: number
    value: number
    annualRent: number
    indexRent: number
    serviceChargePerSqft: number
    status: 'Occupied' | 'Vacant'
    tenant?: string
    leaseEnd?: string
  }[]
  pendingMaintenance: { id: number; unit: string; issue: string; quoteAed: number; priority: string }[]
}

const PORTFOLIOS: PortfolioOwner[] = [
  {
    id: 1,
    name: 'Sheikh Rashid Al Nuaimi Family Office',
    nationality: 'UAE',
    email: 'office@alnuaimi-holdings.ae',
    phone: '+971 50 412 8890',
    units: [
      { id: 101, title: 'Palm Jumeirah Frond G · Signature Villa', community: 'Palm Jumeirah', beds: '3 BR', areaSqft: 5200, value: 14_500_000, annualRent: 820_000, indexRent: 920_000, serviceChargePerSqft: 24, status: 'Occupied', tenant: 'Claire Beaumont', leaseEnd: '2027-01-14' },
      { id: 102, title: 'Marina Crown Tower · 2BR Sea View', community: 'Dubai Marina', beds: '2 BR', areaSqft: 1420, value: 2_850_000, annualRent: 155_000, indexRent: 180_000, serviceChargePerSqft: 18, status: 'Occupied', tenant: 'Horizon Investments LLC', leaseEnd: '2026-12-19' },
      { id: 103, title: 'Downtown Address Residences · 1BR', community: 'Downtown Dubai', beds: '1 BR', areaSqft: 850, value: 1_950_000, annualRent: 115_000, indexRent: 135_000, serviceChargePerSqft: 21, status: 'Occupied', tenant: 'Elena Rostova', leaseEnd: '2027-02-28' },
    ],
    pendingMaintenance: [
      { id: 501, unit: 'Marina Crown Tower · 2BR', issue: 'Chiller actuator valve replacement (living room zone)', quoteAed: 1450, priority: 'Medium' },
      { id: 502, unit: 'Palm Jumeirah Frond G Villa', issue: 'Annual private pool heat-pump servicing & filter media', quoteAed: 3200, priority: 'Low' },
    ],
  },
  {
    id: 2,
    name: 'Caspian Crest Capital Ltd',
    nationality: 'United Kingdom',
    email: 'assets@caspiancrest.co.uk',
    phone: '+44 20 7946 0921',
    units: [
      { id: 201, title: 'Dubai Hills · Park Heights 3BR', community: 'Dubai Hills Estate', beds: '3 BR', areaSqft: 1850, value: 3_200_000, annualRent: 195_000, indexRent: 260_000, serviceChargePerSqft: 15, status: 'Occupied', tenant: 'Tariq Al Suwaidi', leaseEnd: '2026-11-30' },
      { id: 202, title: 'Business Bay · Bay Square 2BR', community: 'Business Bay', beds: '2 BR', areaSqft: 1250, value: 1_950_000, annualRent: 138_000, indexRent: 155_000, serviceChargePerSqft: 17, status: 'Occupied', tenant: 'Meridian Trading DMCC', leaseEnd: '2027-03-15' },
      { id: 203, title: 'JVC · District 12 Studio', community: 'Jumeirah Village Circle', beds: 'Studio', areaSqft: 420, value: 680_000, annualRent: 48_000, indexRent: 54_000, serviceChargePerSqft: 13, status: 'Vacant' },
    ],
    pendingMaintenance: [
      { id: 503, unit: 'Dubai Hills · Park Heights 3BR', issue: 'Balcony sliding door weatherseal & lock alignment', quoteAed: 680, priority: 'Low' },
    ],
  },
]

export default function Owner360() {
  const [selectedId, setSelectedId] = useState(PORTFOLIOS[0]!.id)
  const [decisions, setDecisions] = useState<Record<number, 'Approved' | 'Declined'>>({})
  const [copied, setCopied] = useState(false)
  const statementsQ = useQuery({ queryKey: ['owner-stmts'], queryFn: () => get<any>('/api/e/owner_statements', { pageSize: 50 }) })

  const owner = PORTFOLIOS.find(o => o.id === selectedId) ?? PORTFOLIOS[0]!

  const summary = useMemo(() => {
    const totalValue = owner.units.reduce((s, u) => s + u.value, 0)
    const grossRent = owner.units.filter(u => u.status === 'Occupied').reduce((s, u) => s + u.annualRent, 0)
    const totalArea = owner.units.reduce((s, u) => s + u.areaSqft, 0)
    const totalSc = owner.units.reduce((s, u) => s + u.areaSqft * u.serviceChargePerSqft, 0)
    const avgSc = totalArea ? totalSc / totalArea : 18
    const y = yieldCalc({ price: totalValue, annualRent: grossRent, areaSqft: totalArea, serviceChargePerSqft: avgSc })
    const occ = owner.units.length ? (owner.units.filter(u => u.status === 'Occupied').length / owner.units.length) * 100 : 0
    const visa = visaEligibility({ value: totalValue, mortgaged: false, offPlan: false })
    return { totalValue, grossRent, totalSc, y, occ, visa }
  }, [owner])

  const copyStatement = async () => {
    const text = `*SWK Properties — Owner 360 Portfolio Statement*\nLandlord: ${owner.name}\nPortfolio Value: ${aed(summary.totalValue)} (${owner.units.length} units, ${summary.occ.toFixed(0)}% occupied)\nGross Annual Rent: ${aed(summary.grossRent)} | Net Annual Income: ${aed(summary.y.netIncome)}\nGross Yield: ${summary.y.gross.toFixed(2)}% | *Net Yield: ${summary.y.net.toFixed(2)}%*\nResidency Eligibility: ${summary.visa.tier}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    } catch { /* ignore */ }
  }

  return (
    <div className="grid gap-5 max-w-[1640px] mx-auto">
      <ModuleHeader
        eyebrow="Landlords · Net Yield · Mollak Service Charges · Golden Visa"
        title="Owner 360 Portfolio Intelligence"
        subtitle="Dedicated landlord command view combining DLD comparable valuations, net yields after Mollak service charges, RERA Decree 43/2013 renewal uplift opportunities, maintenance quote approvals and Golden Visa qualification."
        icon={<UserRoundCog size={24} />}
        actions={
          <div className="flex items-center gap-2">
            <button type="button" className="swk-btn swk-btn-gold" onClick={copyStatement}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'Statement copied' : 'Share WhatsApp statement'}
            </button>
            <Link to="/e/owner_statements" className="swk-btn swk-btn-primary"><FileBarChart size={16} />Owner statements ({statementsQ.data?.total ?? 0})</Link>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-4 flex flex-col gap-3">
          {PORTFOLIOS.map(p => {
            const val = p.units.reduce((s, u) => s + u.value, 0)
            const active = p.id === owner.id
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedId(p.id)}
                className="text-start p-4 rounded-2xl border transition-all cursor-pointer"
                style={{
                  background: active ? 'linear-gradient(145deg,#14305c,#0b1a33)' : '#fff',
                  borderColor: active ? '#1d3a66' : 'var(--line)',
                  color: active ? '#fff' : 'var(--ink)',
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] uppercase tracking-wider" style={{ color: active ? '#dcc8a2' : 'var(--muted)' }}>{p.nationality} · {p.units.length} units</span>
                  <Pill tone={active ? 'champ' : 'navy'}>{aed(val, { compact: true })}</Pill>
                </div>
                <div className="font-display text-[17px] font-semibold mt-1">{p.name}</div>
                <div className="text-xs mt-1 opacity-75">{p.email} · {p.phone}</div>
              </button>
            )
          })}
        </div>

        <div className="lg:col-span-8 grid gap-3 grid-cols-2 sm:grid-cols-4">
          <StatTile label="Portfolio valuation" value={summary.totalValue} format={v => aed(v, { compact: true })} hint="DLD comparable mark-to-market" icon={<Building2 size={16} />} tone="navy" />
          <StatTile label="Net annual income" value={summary.y.netIncome} format={v => aed(v, { compact: true })} hint={`Gross ${aed(summary.grossRent, { compact: true })}`} icon={<DollarSign size={16} />} tone="champ" />
          <StatTile label="Net yield (after SC)" value={summary.y.net} format={v => `${v.toFixed(2)}%`} hint={`Gross ${summary.y.gross.toFixed(2)}%`} icon={<Percent size={16} />} />
          <StatTile label="Occupancy rate" value={summary.occ} format={v => `${v.toFixed(0)}%`} hint={summary.visa.tier} icon={<Award size={16} />} />
        </div>
      </div>

      <Reveal className="grid gap-5 xl:grid-cols-12">
        <Card className="xl:col-span-8" title="Unit performance, RERA renewal uplift & Hold-vs-Sell signal" subtitle="Compares current lease rent against the RERA index and community yield benchmark">
          <div className="overflow-x-auto">
            <table className="swk-table">
              <thead>
                <tr>
                  <th>Unit</th>
                  <th className="num">Market value</th>
                  <th className="num">Current rent</th>
                  <th className="num">Net yield</th>
                  <th>RERA renewal cap</th>
                  <th>Advisory signal</th>
                </tr>
              </thead>
              <tbody>
                {owner.units.map(u => {
                  const uy = yieldCalc({ price: u.value, annualRent: u.annualRent, areaSqft: u.areaSqft, serviceChargePerSqft: u.serviceChargePerSqft })
                  const rera = reraIncrease(u.annualRent, u.indexRent)
                  const comm = COMMUNITIES.find(c => c.name === u.community)
                  const signal = uy.net >= (comm?.yieldPct ?? 6) - 0.8 ? 'Hold & Re-let' : 'Candidate to Re-price / Sell'
                  return (
                    <tr key={u.id}>
                      <td>
                        <div className="font-semibold text-ink">{u.title}</div>
                        <div className="text-xs text-muted">{u.community} · {num(u.areaSqft)} sqft · SC AED {u.serviceChargePerSqft}/sqft</div>
                      </td>
                      <td className="num font-semibold">{aed(u.value, { compact: true })}</td>
                      <td className="num">{u.status === 'Occupied' ? aed(u.annualRent) : <Pill tone="dune">Vacant</Pill>}</td>
                      <td className="num font-semibold text-[#17625f]">{pct(uy.net, 2)}</td>
                      <td>
                        {rera.maxIncreasePct > 0 ? (
                          <Pill tone="champ">+{rera.maxIncreasePct}% ({aed(rera.maxRent)})</Pill>
                        ) : (
                          <Pill tone="grey">At market (0%)</Pill>
                        )}
                      </td>
                      <td>
                        <Pill tone={signal.startsWith('Hold') ? 'oasis' : 'navy'}>{signal}</Pill>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="xl:col-span-4 grid gap-4 content-start">
          <Card title="Owner repair approvals" subtitle="Quotes over AED 500 requiring landlord sign-off" tone="champ">
            <div className="grid gap-2.5">
              {owner.pendingMaintenance.map(m => {
                const dec = decisions[m.id]
                return (
                  <div key={m.id} className="p-3.5 rounded-xl bg-white border border-[#e7e1d4]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[13.5px] text-ink">{m.unit}</span>
                      <b className="text-ink">{aed(m.quoteAed)}</b>
                    </div>
                    <div className="text-xs text-muted mt-1">{m.issue}</div>
                    <div className="flex items-center justify-between gap-2 mt-2.5">
                      <Pill tone="grey">{m.priority} priority</Pill>
                      {dec ? (
                        <Pill tone={dec === 'Approved' ? 'oasis' : 'dune'}>{dec}</Pill>
                      ) : (
                        <div className="flex gap-1.5">
                          <button type="button" className="swk-btn swk-btn-primary" style={{ height: 28, padding: '0 10px', fontSize: 12 }} onClick={() => setDecisions(d => ({ ...d, [m.id]: 'Approved' }))}>Approve</button>
                          <button type="button" className="swk-btn swk-btn-ghost" style={{ height: 28, padding: '0 10px', fontSize: 12 }} onClick={() => setDecisions(d => ({ ...d, [m.id]: 'Declined' }))}>Decline</button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          <Card title="UAE Golden Visa status" subtitle="Assessed on combined DLD deed equity" tone="navy">
            <div className="flex items-center gap-4">
              <ProgressRing value={100} size={82} color={SWK.champ} label="10 YR" sub="Golden" />
              <div className="text-xs leading-relaxed">
                <div className="font-semibold text-white text-[14px]">{summary.visa.tier}</div>
                <div className="text-[#c8d3e6] mt-1">Portfolio equity of {aed(summary.totalValue, { compact: true })} exceeds the AED 2,000,000 DLD Golden Visa threshold.</div>
              </div>
            </div>
          </Card>
        </div>
      </Reveal>
    </div>
  )
}
