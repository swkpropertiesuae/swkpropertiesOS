/**
 * Market Pulse — DLD Daily Transactions, 24-Area Stock-Market Intelligence,
 * Site-Visit Area Companion (15-Year Outlook + Closing Keywords), Real Estate News & Live Mortgage Calculator.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import {
  Area, AreaChart, Bar as RBar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, ResponsiveContainer,
  Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from 'recharts'
import {
  Activity, ArrowUpRight, Building2, Calculator, Check, Compass, Copy, Flame, Gauge, GraduationCap, Hospital,
  Landmark, LineChart as LineIc, MapPin, Newspaper, Percent, RefreshCw, Sparkles, Train, TrendingUp, X,
} from 'lucide-react'
import { get, post } from '../../lib/api'
import { cls } from '../../lib/format'
import { useToast } from '../../lib/toast'
import { AnimatedNumber, Card, CHART, DeltaChip, EmptyState, ModuleHeader, PhotoCard, Pill, ProgressRing, Reveal, RevealItem, Segmented, StatTile, SWK, aed, num, pct } from '../../swk/ui'
import { COMMUNITIES, QUARTERS, communityByName, mortgagePlan, type Community, type Residency } from '../../swk/uae'

type Prop = { id: number; title?: string; address?: string; community_id?: string; community?: string; price?: number; list_price?: number; area_sqft?: number; price_per_sqft?: number; status?: string; property_type?: string; bedrooms?: number; building_name?: string; _labels?: Record<string, string>; _title?: string }
type Metric = 'ppsf' | 'yield' | 'tx'

const yoy = (c: Community) => (c.ppsf / c.ppsfLY - 1) * 100
const avg = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0)
const fmtPpsf = (v: number) => `AED ${num(v)}`
const fmtPct1 = (v: number) => pct(v, 1)
const fmtInt = (v: number) => num(v)

function seriesFor(c: Community, m: Metric) {
  return c.trend.map((p, i) => {
    if (m === 'ppsf') return p
    if (m === 'yield') return +(c.yieldPct * (1 + ((c.ppsf - p) / c.ppsf) * 0.42)).toFixed(2)
    const wiggle = Math.sin((i + c.name.length) * 1.7) * 0.05
    return Math.round(c.transactionsQ * (0.68 + (0.32 * i) / (c.trend.length - 1) + wiggle))
  })
}

function matchCommunity(p: Prop) {
  return communityByName(p.community) || communityByName(p._labels?.community_ref) || communityByName(p.community_id) || communityByName(p.address) || communityByName(p.title) || communityByName(p._labels?.community_id)
}

export default function MarketPage() {
  const qc = useQueryClient()
  const toast = useToast()
  const { data, isLoading } = useQuery({ queryKey: ['market-props'], queryFn: () => get<{ rows: Prop[] }>('/api/e/properties?pageSize=500') })
  const pulseQ = useQuery({
    queryKey: ['swk-market-pulse'],
    queryFn: () => get<{ areas: any[]; dldTransactions: any[]; news: any[]; mortgageBanks: any[]; lastUpdated: string }>('/api/swk-ops/market-pulse'),
  })

  const props = data?.rows ?? []
  const [open, setOpen] = useState<Community | null>(null)
  const [companionCode, setCompanionCode] = useState<string>('PALM')
  const [segFilter, setSegFilter] = useState<string>('All')
  const [syncingDld, setSyncingDld] = useState(false)

  // Quick Mortgage State
  const [mPrice, setMPrice] = useState(2500000)
  const [mResidency, setMResidency] = useState<Residency>('expat')
  const [mRate, setMRate] = useState(3.89)
  const [mYears, setMYears] = useState(25)
  const [mIncome, setMIncome] = useState(45000)

  const mPlan = useMemo(() => mortgagePlan({
    price: mPrice,
    residency: mResidency,
    firstHome: true,
    offPlan: false,
    ratePct: mRate,
    years: mYears,
    income: mIncome,
    debts: 0,
  }), [mPrice, mResidency, mRate, mYears, mIncome])

  const companionArea = useMemo(() => {
    const list = pulseQ.data?.areas ?? []
    return list.find((a: any) => a.code === companionCode) ?? list[0] ?? null
  }, [pulseQ.data, companionCode])

  const filteredCommunities = useMemo(() => {
    if (segFilter === 'All') return COMMUNITIES
    return COMMUNITIES.filter(c => c.segment === segFilter)
  }, [segFilter])

  const syncDldNow = async () => {
    setSyncingDld(true)
    try {
      const r = await post<{ insertedCount: number; date: string }>('/api/swk-ops/dld-sync', {})
      toast.ok(`DLD Open Data Synced for ${r.date} (${r.insertedCount} new daily transfers added)`)
      void qc.invalidateQueries({ queryKey: ['swk-market-pulse'] })
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSyncingDld(false)
    }
  }

  const kpi = useMemo(() => {
    const tx = COMMUNITIES.reduce((s, c) => s + c.transactionsQ, 0)
    return {
      ppsf: avg(COMMUNITIES.map(c => c.ppsf)),
      ppsfYoY: (avg(COMMUNITIES.map(c => c.ppsf)) / avg(COMMUNITIES.map(c => c.ppsfLY)) - 1) * 100,
      yieldPct: avg(COMMUNITIES.map(c => c.yieldPct)),
      tx,
      offPlan: COMMUNITIES.reduce((s, c) => s + c.offPlanShare * c.transactionsQ, 0) / tx,
      ppsfSpark: QUARTERS.map((_, i) => avg(COMMUNITIES.map(c => c.trend[i]))),
      yieldSpark: QUARTERS.map((_, i) => avg(COMMUNITIES.map(c => seriesFor(c, 'yield')[i]))),
      txSpark: QUARTERS.map((_, i) => COMMUNITIES.reduce((s, c) => s + seriesFor(c, 'tx')[i], 0)),
    }
  }, [])

  return (
    <div className="space-y-6 pb-10">
      <ModuleHeader
        eyebrow="Market Intelligence · 24 Dubai Areas · Daily DLD Feed · Field Companion"
        icon={<Activity size={22} />}
        title={<>Market <span className="swk-shimmer-text">Pulse</span> & Site-Visit Companion</>}
        subtitle="Stock-market style Dubai area intelligence across all 24 corridors — live daily DLD transactions, 15-year future masterplan outlook (2026–2041), field-visit client closing keywords, real estate news alerts, and live UAE mortgage rates."
        actions={<>
          <button type="button" className="swk-btn swk-btn-primary" disabled={syncingDld} onClick={() => void syncDldNow()}>
            <RefreshCw size={15} className={syncingDld ? 'animate-spin' : ''} /> {syncingDld ? 'Syncing DLD…' : 'Sync Daily DLD Feed'}
          </button>
          <Link to="/toolkit" className="swk-btn swk-btn-ghost"><Calculator size={16} /> Full Deal & Mortgage Toolkit</Link>
        </>}
      />

      <Reveal className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile tone="navy" label="Avg price / sq ft (24 Areas)" value={kpi.ppsf} format={fmtPpsf} delta={kpi.ppsfYoY} hint="YoY · All 24 Dubai corridors" spark={kpi.ppsfSpark} icon={<Landmark size={16} />} />
        <StatTile label="Avg gross rental yield" value={kpi.yieldPct} format={v => pct(v, 2)} hint="RERA index rents" spark={kpi.yieldSpark} icon={<Percent size={16} />} />
        <StatTile label="Quarterly DLD volume" value={kpi.tx} format={fmtInt} delta={(kpi.txSpark[8] / kpi.txSpark[4] - 1) * 100} hint="Across 24 communities" spark={kpi.txSpark} icon={<Activity size={16} />} />
        <StatTile tone="champ" label="Off-plan share" value={kpi.offPlan} format={fmtPct1} hint="Oqood vs Ready Title Deed" icon={<Building2 size={16} />} />
      </Reveal>

      <Ticker onPick={c => { setOpen(c); if (c.code) setCompanionCode(c.code) }} />

      {/* ================================================================ SITE-VISIT AREA COMPANION (STOCK MARKET + 15-YEAR OUTLOOK + CLOSING KEYWORDS) */}
      {companionArea && (
        <Reveal>
          <Card
            title={
              <span className="flex items-center gap-2 flex-wrap">
                <Compass size={18} className="text-[#BE984C]" />
                <span>Site-Visit Area Companion — Stock-Market Brief & 15-Year Outlook (2026–2041)</span>
                <Pill tone="champ">{companionArea.ticker}</Pill>
              </span>
            }
            subtitle="Designed for Sales Advisors on live client site visits: instant stock-market metrics, what’s nearby, ongoing projects, 15-year future forecast, and top closing keywords to excite the client."
            actions={
              <select
                className="input !h-9 !text-xs font-bold min-w-[220px]"
                value={companionCode}
                onChange={e => setCompanionCode(e.target.value)}
                aria-label="Select Dubai area for site visit brief"
              >
                {(pulseQ.data?.areas ?? []).map((a: any) => (
                  <option key={a.code} value={a.code}>
                    {a.ticker} — {a.name} (AED {a.ppsf}/sqft · +{a.yoyPct}%)
                  </option>
                ))}
              </select>
            }
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left 5 cols: Stock Ticker Card + 15-Year Forecast */}
              <div className="lg:col-span-5 space-y-4">
                <div className="rounded-2xl p-4 text-white" style={{ background: 'linear-gradient(135deg, #0B1A33 0%, #174B3B 100%)' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[11px] uppercase tracking-widest text-[#E8D4A2] font-bold">{companionArea.ticker} · {companionArea.segment} Index</div>
                      <div className="font-display text-2xl font-bold mt-0.5">{companionArea.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-2xl font-extrabold text-[#E8D4A2]">AED {num(companionArea.ppsf)}<span className="text-xs font-normal">/sqft</span></div>
                      <div className="text-xs font-bold text-emerald-300">▲ +{companionArea.yoyPct}% YoY · Yield {companionArea.yieldPct}%</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-white/15 text-xs">
                    <div>
                      <div className="text-white/60">Last Year</div>
                      <div className="font-bold">AED {num(companionArea.ppsfLY)}/sqft</div>
                    </div>
                    <div>
                      <div className="text-white/60">Service Charge</div>
                      <div className="font-bold">AED {companionArea.serviceCharge}/sqft</div>
                    </div>
                    <div>
                      <div className="text-white/60">Qtr Volume</div>
                      <div className="font-bold">{num(companionArea.transactionsQ)} deals</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#efe9dc] bg-[#fbf9f5] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-extrabold uppercase tracking-wider text-ink flex items-center gap-1.5">
                      <TrendingUp size={14} className="text-[#174B3B]" /> 15-Year Future Trajectory (2026 → 2041)
                    </div>
                    <Pill tone="oasis">Dubai 2040 Aligned</Pill>
                  </div>
                  <p className="text-xs text-muted mb-3">{companionArea.future15YearOutlook}</p>
                  <div className="space-y-2">
                    {(companionArea.forecast15Y ?? []).map((f: any) => (
                      <div key={f.year} className="flex items-center justify-between gap-2 text-xs p-2 rounded-xl bg-white border border-[#efe9dc]">
                        <span className="font-mono font-extrabold text-[#0B1A33] bg-[#E8D4A2]/40 px-2 py-0.5 rounded">{f.year}</span>
                        <span className="flex-1 text-muted truncate" title={f.catalyst}>{f.catalyst}</span>
                        <span className="font-mono font-extrabold text-[#174B3B]">AED {num(f.projectedPpsf)}/sqft</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right 7 cols: Top Closing Keywords, Pitch Script, Nearby & Ongoing Projects */}
              <div className="lg:col-span-7 space-y-4">
                <div className="rounded-2xl border-2 border-[#BE984C]/50 bg-[#BE984C]/10 p-4">
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                    <div className="text-xs font-extrabold uppercase tracking-wider text-ink flex items-center gap-1.5">
                      <Flame size={15} className="text-[#7E3039]" /> Top Closing Keywords to Say on Field Visit
                    </div>
                    <span className="text-[11px] text-muted">Tap any keyword to copy for client WhatsApp / pitch</span>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {(companionArea.closingKeywords ?? []).map((kw: string) => (
                      <button
                        key={kw}
                        type="button"
                        onClick={() => { void navigator.clipboard?.writeText(kw); toast.ok(`Copied keyword: "${kw}"`) }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold bg-[#0B1A33] text-[#E8D4A2] hover:opacity-90 transition"
                      >
                        <Sparkles size={11} /> {kw} <Copy size={10} />
                      </button>
                    ))}
                  </div>
                  <div className="space-y-2 mt-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-muted">Verbatim Site-Visit Pitch Lines (What to Tell the Client):</div>
                    {(companionArea.fieldVisitPitchScript ?? []).map((line: string, idx: number) => (
                      <div key={idx} className="p-2.5 rounded-xl bg-white border border-[#efe9dc] text-xs font-medium text-ink flex items-start justify-between gap-2">
                        <span><strong className="text-[#7E3039]">#{idx + 1}:</strong> “{line}”</span>
                        <button
                          type="button"
                          onClick={() => { void navigator.clipboard?.writeText(line); toast.ok('Pitch phrase copied to clipboard') }}
                          className="text-muted hover:text-ink flex-none"
                          title="Copy pitch line"
                        >
                          <Copy size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-[#efe9dc] bg-white p-3.5 text-xs space-y-2">
                    <div className="font-extrabold uppercase tracking-wider text-ink flex items-center gap-1.5">
                      <MapPin size={14} className="text-[#174B3B]" /> What’s Nearby ({companionArea.name})
                    </div>
                    <div className="flex items-start gap-1.5"><Train size={13} className="text-muted flex-none mt-0.5" /> <span><strong>Metro / Transit:</strong> {companionArea.nearby?.metro}</span></div>
                    <div className="flex items-start gap-1.5"><Landmark size={13} className="text-muted flex-none mt-0.5" /> <span><strong>Landmarks:</strong> {(companionArea.nearby?.landmarks ?? []).join(' · ')}</span></div>
                    <div className="flex items-start gap-1.5"><GraduationCap size={13} className="text-muted flex-none mt-0.5" /> <span><strong>Schools:</strong> {(companionArea.nearby?.schools ?? []).join(' · ')}</span></div>
                    <div className="flex items-start gap-1.5"><Hospital size={13} className="text-muted flex-none mt-0.5" /> <span><strong>Hospitals:</strong> {(companionArea.nearby?.hospitals ?? []).join(' · ')}</span></div>
                  </div>
                  <div className="rounded-2xl border border-[#efe9dc] bg-white p-3.5 text-xs space-y-2">
                    <div className="font-extrabold uppercase tracking-wider text-ink flex items-center gap-1.5">
                      <Building2 size={14} className="text-[#BE984C]" /> Ongoing Flagship Projects & Catalysts
                    </div>
                    <ul className="list-disc pl-4 space-y-1 text-ink font-medium">
                      {(companionArea.ongoingProjects ?? []).map((proj: string) => (
                        <li key={proj}>{proj}</li>
                      ))}
                    </ul>
                    <div className="pt-1 text-muted">
                      <strong>Beach / Park Access:</strong> {companionArea.nearby?.beachOrParkMins}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </Reveal>
      )}

      {/* ================================================================ DAILY DLD TRANSACTIONS FEED + DUBAI REAL ESTATE NEWS */}
      <Reveal className="grid gap-4 grid-cols-1 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <Card
            title={<span className="flex items-center gap-2"><Landmark size={17} /> Daily DLD Transactions Feed (Dubai Land Department Open Data)</span>}
            subtitle="Live daily sales & Oqood registrations synced from DLD open-data feeds across Dubai."
            actions={
              <Link to="/e/dld_market_transactions" className="swk-btn swk-btn-ghost !h-8 !text-xs">
                Full DLD Log <ArrowUpRight size={13} />
              </Link>
            }
          >
            <div className="overflow-x-auto -mx-2 max-h-[360px]">
              <table className="swk-table min-w-[640px]">
                <thead>
                  <tr>
                    <th>Date / Ref</th>
                    <th>Area & Project</th>
                    <th>Type</th>
                    <th className="num">Sq Ft</th>
                    <th className="num">Trans Value</th>
                    <th className="num">AED / Sqft</th>
                  </tr>
                </thead>
                <tbody>
                  {(pulseQ.data?.dldTransactions ?? []).slice(0, 12).map((t: any) => (
                    <tr key={t.id}>
                      <td>
                        <div className="font-mono text-xs font-bold text-ink">{t.trans_date}</div>
                        <div className="text-[11px] text-muted">{t.trans_no}</div>
                      </td>
                      <td>
                        <div className="font-semibold text-ink">{t.area_name}</div>
                        <div className="text-xs text-muted">{t.project_name}</div>
                      </td>
                      <td>
                        <Pill tone={t.is_offplan ? 'champ' : 'oasis'}>{t.is_offplan ? 'Off-Plan Oqood' : 'Ready Title Deed'}</Pill>
                        <div className="text-[11px] text-muted mt-0.5">{t.bedrooms} · {t.property_type}</div>
                      </td>
                      <td className="num font-mono text-xs">{num(t.area_sqft)}</td>
                      <td className="num font-bold text-ink">{aed(t.actual_worth, { compact: true })}</td>
                      <td className="num font-mono font-bold text-[#174B3B]">AED {num(t.price_per_sqft)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="xl:col-span-5">
          <Card
            title={<span className="flex items-center gap-2"><Newspaper size={17} /> Dubai Real Estate News & Staff Alerts</span>}
            subtitle="Every regulatory, infrastructure, and market update with client pitch talking points."
            actions={
              <Link to="/e/real_estate_news" className="swk-btn swk-btn-ghost !h-8 !text-xs">
                All News <ArrowUpRight size={13} />
              </Link>
            }
          >
            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
              {(pulseQ.data?.news ?? []).map((n: any) => (
                <div key={n.id} className="p-3 rounded-2xl border border-[#efe9dc] bg-[#fbf9f5] space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Pill tone={n.impact_level?.includes('High') ? 'champ' : 'navy'}>{n.category}</Pill>
                    <span className="text-[11px] text-muted">{n.published_date} · {n.source_name}</span>
                  </div>
                  <div className="font-bold text-sm text-ink">{n.headline}</div>
                  <p className="text-xs text-muted">{n.summary}</p>
                  {n.client_pitch_talking_point && (
                    <div className="p-2 rounded-xl bg-white border border-[#efe9dc] text-xs text-[#174B3B] font-semibold">
                      💡 <strong>Tell Client:</strong> {n.client_pitch_talking_point}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </Reveal>

      {/* ================================================================ UAE MORTGAGE CALCULATOR & LIVE BANK RATE UPDATES */}
      <Reveal>
        <Card
          title={<span className="flex items-center gap-2"><Calculator size={17} /> UAE Mortgage Calculator & Live Bank Rate Updates (CBUAE Compliant)</span>}
          subtitle="Instant monthly EMI, LTV cap, and 50% DBR eligibility check alongside live 2026 UAE bank home-finance rates."
          actions={<Link to="/toolkit" className="swk-btn swk-btn-ghost !h-8 !text-xs">Open Full Toolkit <ArrowUpRight size={13} /></Link>}
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-5 space-y-3 p-4 rounded-2xl bg-[#fbf9f5] border border-[#efe9dc]">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Property Price (AED)</label>
                  <input className="input" type="number" step="50000" value={mPrice} onChange={e => setMPrice(Number(e.target.value))} />
                </div>
                <div>
                  <label className="label">Buyer Status</label>
                  <select className="input" value={mResidency} onChange={e => setMResidency(e.target.value as Residency)}>
                    <option value="expat">UAE Expat / Non-Resident (Max 80% LTV)</option>
                    <option value="national">UAE National (Max 85% LTV)</option>
                  </select>
                </div>
                <div>
                  <label className="label">Interest Rate (% p.a.)</label>
                  <input className="input" type="number" step="0.05" value={mRate} onChange={e => setMRate(Number(e.target.value))} />
                </div>
                <div>
                  <label className="label">Tenure (Years, Max 25)</label>
                  <input className="input" type="number" min="5" max="25" value={mYears} onChange={e => setMYears(Number(e.target.value))} />
                </div>
                <div className="col-span-2">
                  <label className="label">Client Monthly Income (AED) — for CBUAE 50% DBR Check</label>
                  <input className="input" type="number" step="5000" value={mIncome} onChange={e => setMIncome(Number(e.target.value))} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#efe9dc] text-center">
                <div className="p-2.5 rounded-xl bg-white border border-[#efe9dc]">
                  <div className="text-[11px] text-muted">Max Loan ({Math.round(mPlan.appliedLtv * 100)}% LTV)</div>
                  <div className="font-display font-bold text-sm text-ink">{aed(mPlan.loan, { compact: true })}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-white border border-[#efe9dc]">
                  <div className="text-[11px] text-muted">Monthly EMI</div>
                  <div className="font-display font-extrabold text-sm text-[#174B3B]">{aed(mPlan.emi)}/mo</div>
                </div>
                <div className="p-2.5 rounded-xl bg-white border border-[#efe9dc]">
                  <div className="text-[11px] text-muted">CBUAE DBR Ratio</div>
                  <div className={`font-display font-bold text-sm ${mPlan.dbrOk ? 'text-[#174B3B]' : 'text-[#7E3039]'}`}>
                    {pct(mPlan.dbr * 100, 1)} {mPlan.dbrOk ? '✓ OK' : '⚠ >50%'}
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 overflow-x-auto">
              <table className="swk-table min-w-[560px]">
                <thead>
                  <tr>
                    <th>UAE Bank</th>
                    <th className="num">3Y Fixed</th>
                    <th className="num">5Y Fixed</th>
                    <th className="num">Pre-Approval</th>
                    <th>Key Offer & Highlight</th>
                    <th>Apply Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {(pulseQ.data?.mortgageBanks ?? []).map((b: any) => (
                    <tr key={b.bank}>
                      <td className="font-bold text-ink">{b.bank}</td>
                      <td className="num font-mono font-bold text-[#174B3B]">{b.fixedRate3Y}%</td>
                      <td className="num font-mono">{b.fixedRate5Y}%</td>
                      <td className="num text-xs">{b.preApprovalDays} days</td>
                      <td className="text-xs text-muted max-w-[240px]">{b.highlight}</td>
                      <td>
                        <button type="button" className="btn outline sm" onClick={() => setMRate(b.fixedRate3Y)}>
                          Use {b.fixedRate3Y}%
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      </Reveal>

      <TrendCard />

      <section aria-labelledby="explorer-h" className="space-y-3">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <div className="swk-eyebrow">All 24 Dubai Corridors</div>
            <h2 id="explorer-h" className="font-display text-[22px] font-semibold text-ink">Tap any of the 24 Dubai communities for its Site-Visit Brief, Rent Index & SWK Stock</h2>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {(['All', 'Prime', 'Upper-mid', 'Mid', 'Value'] as const).map(seg => (
              <button
                key={seg}
                type="button"
                onClick={() => setSegFilter(seg)}
                className={`px-3 py-1 rounded-full text-xs font-bold border transition ${segFilter === seg ? 'bg-[#0B1A33] text-white border-[#0B1A33]' : 'bg-white text-ink border-[#efe9dc]'}`}
              >
                {seg}
              </button>
            ))}
          </div>
        </div>
        <Reveal className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          {filteredCommunities.map(c => {
            const ours = props.filter(p => matchCommunity(p)?.id === c.id).length
            return (
              <motion.button key={c.id} type="button" onClick={() => { setOpen(c); if (c.code) setCompanionCode(c.code) }} whileTap={{ scale: 0.98 }}
                className="text-left block w-full rounded-[20px] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#c9a96e]/50"
                aria-label={`Open ${c.name} market detail`}>
                <PhotoCard src={c.image} title={`${c.name} (${c.ticker ?? c.code})`}
                  subtitle={`${aed(c.ppsf)}/sq ft · ${pct(c.yieldPct)} gross · SC AED ${c.serviceCharge}/sq ft`}
                  badge={<><Pill tone={c.segment === 'Prime' ? 'champ' : c.segment === 'Value' ? 'oasis' : 'navy'}>{c.segment}</Pill>{ours > 0 && <Pill tone="grey">{ours} SWK</Pill>}</>}
                  footer={<div className="flex items-center gap-2 text-[12px]"><DeltaChip value={yoy(c)} /><span className="text-[#d6deeb]">{num(c.transactionsQ)} deals / qtr</span></div>} />
              </motion.button>
            )
          })}
        </Reveal>
      </section>

      <Reveal className="grid gap-4 grid-cols-1 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <ScatterCard onPick={c => { setOpen(c); if (c.code) setCompanionCode(c.code) }} />
        <Card title="Rental yield league (Top 12)" subtitle="Gross yield on RERA index rents">
          <div className="space-y-3">
            {[...COMMUNITIES].sort((a, b) => b.yieldPct - a.yieldPct).slice(0, 12).map((c, i) => (
              <div key={c.id} className="grid grid-cols-[minmax(0,155px)_1fr_auto] items-center gap-3">
                <button type="button" onClick={() => { setOpen(c); if (c.code) setCompanionCode(c.code) }} className="text-[13px] font-semibold text-ink truncate text-left hover:underline">{c.name}</button>
                <div className="h-2.5 rounded-full overflow-hidden" style={{ background: '#efe9dc' }}>
                  <motion.div className="h-full rounded-full" style={{ background: i < 3 ? SWK.oasis : SWK.navy }} initial={{ width: 0 }} whileInView={{ width: `${(c.yieldPct / 8.5) * 100}%` }} viewport={{ once: true }} transition={{ duration: 1, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }} />
                </div>
                <span className="text-[13px] font-semibold tabular-nums text-ink">{pct(c.yieldPct)}</span>
              </div>
            ))}
          </div>
        </Card>
      </Reveal>

      <PortfolioCard props={props} loading={isLoading} />

      <p className="text-[12px] text-muted flex items-start gap-2 px-1">
        <Gauge size={14} className="flex-none mt-0.5" />
        Figures compiled from DLD open data & RERA rental index feeds; use the “Sync Daily DLD Feed” button above to pull today’s latest DLD transactions.
      </p>

      <AnimatePresence>{open && <CommunityDrawer key={open.id} c={open} companion={pulseQ.data?.areas?.find((a: any) => a.code === open.code)} props={props} onClose={() => setOpen(null)} />}</AnimatePresence>
    </div>
  )
}

// ---------------------------------------------------------------- ticker
function Ticker({ onPick }: { onPick: (c: Community) => void }) {
  const items = [...COMMUNITIES, ...COMMUNITIES]
  return (
    <RevealItem className="swk-card overflow-hidden !p-0" >
      <div className="flex items-stretch">
        <div className="flex-none flex items-center gap-2 px-4 text-[11px] font-semibold uppercase tracking-[.14em] text-white" style={{ background: `linear-gradient(135deg, ${SWK.navy}, ${SWK.midnight})` }}>
          <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full rounded-full opacity-70 animate-ping" style={{ background: SWK.champ }} /><span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: SWK.champ }} /></span>
          DLD 24-Area Ticker
        </div>
        <div className="relative overflow-hidden flex-1" style={{ maskImage: 'linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)', WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)' }}>
          <div className="swk-ticker" aria-label="Community price ticker">
            {items.map((c, i) => (
              <button key={`${c.id}-${i}`} type="button" onClick={() => onPick(c)} tabIndex={i >= COMMUNITIES.length ? -1 : 0} aria-hidden={i >= COMMUNITIES.length || undefined}
                className="flex items-center gap-2.5 px-5 py-3 whitespace-nowrap border-r border-[#efe9dc] hover:bg-[#fbf8f2] transition-colors">
                <span className="font-mono text-[11px] font-bold text-[#BE984C]">{c.ticker}</span>
                <span className="text-[13px] font-semibold text-ink">{c.name}</span>
                <span className="text-[13px] tabular-nums text-muted">AED {num(c.ppsf)}/sqft</span>
                <DeltaChip value={yoy(c)} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </RevealItem>
  )
}

// ---------------------------------------------------------------- trend chart
const METRIC_META: Record<Metric, { label: string; fmt: (v: number) => string; axis: (v: number) => string }> = {
  ppsf: { label: 'Price / sq ft', fmt: v => `AED ${num(v)}`, axis: v => `${(v / 1000).toFixed(1)}k` },
  yield: { label: 'Gross yield', fmt: v => pct(v, 2), axis: v => `${v.toFixed(1)}%` },
  tx: { label: 'Transactions', fmt: v => num(v), axis: v => num(v) },
}
function TrendCard() {
  const [metric, setMetric] = useState<Metric>('ppsf')
  const [sel, setSel] = useState<string[]>(['palm-jumeirah', 'downtown-dubai', 'dubai-hills-estate', 'jvc', 'dubai-south'])
  const chosen = COMMUNITIES.filter(c => sel.includes(c.id))
  const rows = QUARTERS.map((q, i) => Object.fromEntries([['q', q], ...chosen.map(c => [c.id, seriesFor(c, metric)[i]])]))
  const colorOf = (id: string) => CHART[COMMUNITIES.findIndex(c => c.id === id) % CHART.length]
  const toggle = (id: string) => setSel(s => (s.includes(id) ? (s.length > 1 ? s.filter(x => x !== id) : s) : [...s, id]))
  const m = METRIC_META[metric]
  return (
    <Reveal>
      <Card title={<span className="flex items-center gap-2"><LineIc size={17} /> {m.label} trend</span>} subtitle={`${QUARTERS[0]} → ${QUARTERS[QUARTERS.length - 1]} · select any of the 24 Dubai communities to compare`}
        actions={<Segmented layoutId="mk-metric" value={metric} onChange={setMetric} options={[{ value: 'ppsf', label: 'Price/sqft' }, { value: 'yield', label: 'Yield' }, { value: 'tx', label: 'Transactions' }]} />}>
        <div className="flex flex-wrap gap-1.5 mb-4" role="group" aria-label="Communities">
          {COMMUNITIES.map(c => {
            const on = sel.includes(c.id)
            return (
              <motion.button key={c.id} type="button" layout onClick={() => toggle(c.id)} aria-pressed={on} whileTap={{ scale: 0.95 }}
                className={cls('inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11.5px] font-semibold border transition-colors', on ? 'text-white' : 'text-ink bg-white border-[#e7e1d4] hover:border-[#c9a96e]')}
                style={on ? { background: colorOf(c.id), borderColor: colorOf(c.id) } : undefined}>
                {on ? <Check size={12} /> : <span className="w-2 h-2 rounded-full" style={{ background: colorOf(c.id) }} />}{c.name}
              </motion.button>
            )
          })}
        </div>
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                {COMMUNITIES.map(c => (
                  <linearGradient key={c.id} id={`mk-g-${c.id}`} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={colorOf(c.id)} stopOpacity={0.28} /><stop offset="100%" stopColor={colorOf(c.id)} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid stroke="#efe9dc" vertical={false} />
              <XAxis dataKey="q" tick={{ fontSize: 11, fill: SWK.muted }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={m.axis} tick={{ fontSize: 11, fill: SWK.muted }} axisLine={false} tickLine={false} width={48} domain={['auto', 'auto']} />
              <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${SWK.line}`, fontSize: 12 }} formatter={(v: any, k: any) => [m.fmt(Number(v)), COMMUNITIES.find(c => c.id === k)?.name ?? k]} />
              {chosen.map(c => (
                <Area key={`${c.id}-${metric}`} type="monotone" dataKey={c.id} stroke={colorOf(c.id)} strokeWidth={2.4} fill={`url(#mk-g-${c.id})`} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} animationDuration={900} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </Reveal>
  )
}

// ---------------------------------------------------------------- scatter
function ScatterCard({ onPick }: { onPick: (c: Community) => void }) {
  const pts = COMMUNITIES.map((c, i) => ({ x: c.ppsf, y: c.yieldPct, z: c.transactionsQ, name: c.name, id: c.id, color: CHART[i % CHART.length] }))
  const ax = avg(pts.map(p => p.x)), ay = avg(pts.map(p => p.y))
  return (
    <Card title="Where investors get value (24 Corridors)" subtitle="x = price per sq ft · y = gross yield · bubble = quarterly transactions"
      actions={<Pill tone="oasis">Top-left = High Yield</Pill>}>
      <div className="h-[340px] relative">
        <div className="absolute left-14 top-2 text-[11px] font-semibold uppercase tracking-wider pointer-events-none" style={{ color: SWK.oasis }}>High yield · lower entry</div>
        <div className="absolute right-3 bottom-10 text-[11px] font-semibold uppercase tracking-wider pointer-events-none" style={{ color: SWK.champDeep }}>Prime · capital growth</div>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 22, right: 20, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="#efe9dc" />
            <XAxis type="number" dataKey="x" name="Price/sqft" tickFormatter={v => `${(v / 1000).toFixed(1)}k`} tick={{ fontSize: 11, fill: SWK.muted }} domain={[900, 5100]} />
            <YAxis type="number" dataKey="y" name="Yield" tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: SWK.muted }} domain={[4.5, 8.6]} width={44} />
            <ZAxis type="number" dataKey="z" range={[120, 900]} />
            <ReferenceLine x={ax} stroke={SWK.champ} strokeDasharray="4 4" />
            <ReferenceLine y={ay} stroke={SWK.champ} strokeDasharray="4 4" />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ payload }: any) => {
              const p = payload?.[0]?.payload; if (!p) return null
              return <div className="rounded-xl border border-[#e7e1d4] bg-white px-3 py-2 text-[12px] shadow-lg"><b className="text-ink">{p.name}</b><div className="text-muted">AED {num(p.x)}/sqft · {pct(p.y)} · {num(p.z)} deals</div></div>
            }} />
            <Scatter data={pts} onClick={(d: any) => { const c = COMMUNITIES.find(x => x.id === (d?.id ?? d?.payload?.id)); if (c) onPick(c) }} animationDuration={900} style={{ cursor: 'pointer' }}>
              {pts.map(p => <Cell key={p.id} fill={p.color} fillOpacity={0.78} stroke="#fff" strokeWidth={2} />)}
              <LabelList dataKey="name" position="top" style={{ fontSize: 10, fill: SWK.ink, fontWeight: 600 }} />
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------- portfolio vs market (CMA-lite)
function PortfolioCard({ props, loading }: { props: Prop[]; loading: boolean }) {
  const real = props.filter(p => (Number(p.price) > 0 || Number(p.list_price) > 0) && Number(p.area_sqft) > 0)
  const rows = real.map(p => {
    const c = matchCommunity(p)
    const pr = Number(p.price) || Number(p.list_price) || 0
    const ppsf = Number(p.price_per_sqft) || pr / Number(p.area_sqft)
    const diff = c ? (ppsf / c.ppsf - 1) * 100 : null
    return { p, c, pr, ppsf, diff }
  }).sort((a, b) => (a.diff ?? 999) - (b.diff ?? 999))
  const tracked = rows.filter(r => r.diff !== null)
  const verdict = (d: number) => (d < -5 ? { t: 'Below market', tone: 'oasis' as const } : d > 5 ? { t: 'Premium', tone: 'champ' as const } : { t: 'At market', tone: 'navy' as const })
  return (
    <Reveal>
      <Card title="SWK portfolio vs market" subtitle="Each listing's AED/sq ft against its community average — a CMA-lite pricing check before you advise the seller (Form A)."
        actions={<Link to="/e/properties" className="swk-icon-link" aria-label="Open properties"><ArrowUpRight size={16} /></Link>}>
        {loading ? <div className="h-40 grid place-items-center text-muted text-sm">Loading SWK inventory…</div> : rows.length === 0 ? <EmptyState title="No priced listings yet" hint="Add price and area to properties to benchmark them against DLD community medians." action={<Link to="/e/properties?new=1" className="swk-btn swk-btn-primary">Add property</Link>} /> : (
          <>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {(['Below market', 'At market', 'Premium'] as const).map(k => {
                const n = tracked.filter(r => verdict(r.diff!).t === k).length
                return (
                  <div key={k} className="rounded-2xl border border-[#efe9dc] bg-[#fbf9f5] p-3">
                    <div className="text-[11px] uppercase tracking-wider font-semibold text-muted">{k}</div>
                    <div className="font-display text-[24px] font-semibold text-ink"><AnimatedNumber value={n} /></div>
                  </div>
                )
              })}
            </div>
            <div className="overflow-x-auto -mx-2">
              <table className="swk-table min-w-[760px]">
                <thead><tr><th>Listing</th><th>Community</th><th className="num">Price</th><th className="num">AED / sq ft</th><th className="num">Market avg</th><th style={{ width: 180 }}>Position</th><th>Advice</th></tr></thead>
                <tbody>
                  {rows.map(({ p, c, pr, ppsf, diff }, i) => {
                    const v = diff !== null ? verdict(diff) : null
                    return (
                      <motion.tr key={p.id} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.04 }}>
                        <td className="max-w-[240px]">
                          <Link to={`/e/properties/${p.id}`} className="font-semibold text-ink hover:underline block truncate">{p.title ?? p._title}</Link>
                          <span className="text-[11.5px] text-muted">{num(p.area_sqft)} sq ft</span>
                        </td>
                        <td>{c ? c.name : <span className="text-muted">{p.community || p.community_id || p.address?.split(',').pop()?.trim() || '—'}</span>}</td>
                        <td className="num">{aed(pr, { compact: true })}</td>
                        <td className="num font-semibold">{num(ppsf)}</td>
                        <td className="num text-muted">{c ? num(c.ppsf) : '—'}</td>
                        <td>{diff !== null ? <PositionBar diff={diff} /> : <span className="text-[12px] text-muted">Not in index</span>}</td>
                        <td>{v ? <div className="flex flex-col gap-0.5"><Pill tone={v.tone}>{v.t} {diff! > 0 ? '+' : ''}{diff!.toFixed(1)}%</Pill>
                          <span className="text-[11px] text-muted whitespace-nowrap">Guide {aed(c!.ppsf * Number(p.area_sqft) * 0.97, { compact: true })} – {aed(c!.ppsf * Number(p.area_sqft) * 1.03, { compact: true })}</span></div> : <Pill tone="grey">Add comps</Pill>}</td>
                      </motion.tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </Reveal>
  )
}
function PositionBar({ diff }: { diff: number }) {
  const clamp = Math.max(-50, Math.min(50, diff))
  const color = diff < -5 ? SWK.oasis : diff > 5 ? SWK.champDeep : SWK.navy
  return (
    <div className="relative h-2.5 rounded-full" style={{ background: '#efe9dc' }} aria-label={`${diff.toFixed(1)}% vs market`}>
      <div className="absolute top-[-3px] bottom-[-3px] w-px left-1/2" style={{ background: SWK.muted }} />
      <motion.div className="absolute top-0 bottom-0 rounded-full" style={{ background: color, [clamp < 0 ? 'right' : 'left']: '50%' }}
        initial={{ width: 0 }} whileInView={{ width: `${Math.abs(clamp)}%` }} viewport={{ once: true }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} />
    </div>
  )
}

// ---------------------------------------------------------------- detail drawer
function CommunityDrawer({ c, companion, props, onClose }: { c: Community; companion?: any; props: Prop[]; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [onClose])
  const ours = props.filter(p => matchCommunity(p)?.id === c.id)
  const rent = [{ k: 'Studio', v: c.rentStudio }, { k: '1 BR', v: c.rent1 }, { k: '2 BR', v: c.rent2 }, { k: '3 BR', v: c.rent3 }]
  return (
    <>
      <motion.div className="fixed inset-0 z-[80] bg-[#0b1a33]/45 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.aside role="dialog" aria-modal="true" aria-label={`${c.name} market detail`}
        className="fixed right-0 top-0 bottom-0 z-[81] w-full sm:w-[560px] bg-[#f6f2ea] shadow-2xl overflow-y-auto"
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 260, damping: 32 }}>
        <div className="relative h-[220px]">
          <motion.div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${c.image})` }} initial={{ scale: 1.12 }} animate={{ scale: 1 }} transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }} />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(11,26,51,.1), rgba(11,26,51,.9))' }} />
          <button type="button" onClick={onClose} autoFocus className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/90 grid place-items-center text-ink hover:bg-white" aria-label="Close"><X size={18} /></button>
          <div className="absolute left-5 right-5 bottom-4 text-white">
            <div className="flex gap-1.5 mb-2"><Pill tone="champ">{c.ticker ?? c.segment}</Pill><Pill tone="grey"><MapPin size={11} /> {c.lat.toFixed(3)}, {c.lng.toFixed(3)}</Pill></div>
            <div className="font-display text-[28px] font-semibold leading-tight">{c.name}</div>
          </div>
        </div>
        <motion.div className="p-5 space-y-4" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.15 } } }} initial="hidden" animate="show">
          <motion.div variants={drawerItem} className="grid grid-cols-3 gap-3">
            {[
              { l: 'AED / sq ft', v: <AnimatedNumber value={c.ppsf} />, s: <DeltaChip value={yoy(c)} /> },
              { l: 'Gross yield', v: <AnimatedNumber value={c.yieldPct} format={v => pct(v, 1)} />, s: <span className="text-[11px] text-muted">index rents</span> },
              { l: 'Service charge', v: <AnimatedNumber value={c.serviceCharge} format={v => `AED ${v.toFixed(0)}`} />, s: <span className="text-[11px] text-muted">per sq ft / yr</span> },
            ].map(x => (
              <div key={x.l} className="rounded-2xl bg-white border border-[#efe9dc] p-3">
                <div className="text-[10.5px] uppercase tracking-wider font-semibold text-muted">{x.l}</div>
                <div className="font-display text-[20px] font-semibold text-ink">{x.v}</div>
                <div className="mt-1">{x.s}</div>
              </div>
            ))}
          </motion.div>

          {companion && (
            <motion.div variants={drawerItem} className="rounded-2xl bg-white border border-[#efe9dc] p-4 space-y-2.5">
              <div className="font-bold text-sm text-ink flex items-center gap-1.5">
                <Flame size={15} className="text-[#7E3039]" /> Site-Visit Closing Keywords & 15-Year Outlook
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(companion.closingKeywords ?? []).map((kw: string) => (
                  <span key={kw} className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#0B1A33] text-[#E8D4A2]">{kw}</span>
                ))}
              </div>
              <p className="text-xs text-muted">{companion.future15YearOutlook}</p>
              <div className="space-y-1.5 pt-1">
                {(companion.fieldVisitPitchScript ?? []).map((line: string, i: number) => (
                  <div key={i} className="p-2 rounded-xl bg-[#fbf9f5] border border-[#efe9dc] text-xs font-medium text-ink">
                    “{line}”
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          <motion.div variants={drawerItem} className="rounded-2xl bg-white border border-[#efe9dc] p-4">
            <div className="flex items-center justify-between mb-2"><b className="text-[14px] text-ink">RERA rent index (annual)</b><Pill tone="navy">Indicative</Pill></div>
            <div className="h-[190px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rent} margin={{ top: 18, right: 4, left: 0, bottom: 0 }}>
                  <defs><linearGradient id="mk-rent" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={SWK.navy} /><stop offset="100%" stopColor={SWK.ocean} /></linearGradient></defs>
                  <CartesianGrid stroke="#f1ece2" vertical={false} />
                  <XAxis dataKey="k" tick={{ fontSize: 11, fill: SWK.muted }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip cursor={{ fill: '#f6f2ea' }} formatter={(v: any) => [aed(Number(v)), 'Avg rent']} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                  <RBar dataKey="v" fill="url(#mk-rent)" radius={[8, 8, 0, 0]} animationDuration={900}>
                    <LabelList dataKey="v" position="top" formatter={(v: any) => `${Math.round(Number(v) / 1000)}k`} style={{ fontSize: 11, fill: SWK.ink, fontWeight: 600 }} />
                  </RBar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <motion.div variants={drawerItem} className="rounded-2xl bg-white border border-[#efe9dc] p-4 flex items-center gap-4">
            <ProgressRing value={c.offPlanShare} size={96} color={SWK.champ} sub="off-plan" />
            <div className="min-w-0 flex-1 text-[13px]">
              <div className="swk-kv"><span>Quarterly transactions</span><b>{num(c.transactionsQ)}</b></div>
              <div className="swk-kv"><span>AED / sq ft last year</span><b>{num(c.ppsfLY)}</b></div>
              <div className="swk-kv"><span>1BR service charge (≈750 sq ft)</span><b>{aed(c.serviceCharge * 750)}</b></div>
            </div>
          </motion.div>

          <motion.div variants={drawerItem} className="rounded-2xl bg-white border border-[#efe9dc] p-4">
            <div className="flex items-center justify-between mb-1"><b className="text-[14px] text-ink">SWK listings in {c.name}</b><Pill tone={ours.length ? 'oasis' : 'grey'}>{ours.length}</Pill></div>
            {ours.length === 0 ? <p className="text-[12.5px] text-muted py-3">No SWK inventory matched yet — a mandate opportunity. Raise a Form A or source a 3rd-party A2A partner in this community.</p> : ours.map(p => {
              const pr = Number(p.price) || Number(p.list_price) || 0
              const ppsf = Number(p.price_per_sqft) || (pr && Number(p.area_sqft) ? pr / Number(p.area_sqft) : 0)
              const d = ppsf ? (ppsf / c.ppsf - 1) * 100 : null
              return (
                <Link key={p.id} to={`/e/properties/${p.id}`} className="swk-row hover:bg-[#fbf8f2] rounded-xl px-1 -mx-1">
                  <span className="swk-row-ic"><Building2 size={17} /></span>
                  <span className="min-w-0 flex-1"><span className="swk-row-t block">{p.title ?? p._title}</span><span className="swk-row-s block">{aed(pr, { compact: true })} · {num(p.area_sqft)} sq ft · {p.status ?? '—'}</span></span>
                  {d !== null && <Pill tone={d < -5 ? 'oasis' : d > 5 ? 'champ' : 'navy'}>{d > 0 ? '+' : ''}{d.toFixed(0)}%</Pill>}
                </Link>
              )
            })}
          </motion.div>
        </motion.div>
      </motion.aside>
    </>
  )
}
const drawerItem = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as any } } }
