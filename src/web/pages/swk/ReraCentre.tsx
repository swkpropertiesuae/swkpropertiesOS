import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowUpRight, BadgeCheck, CheckCircle2, FileCheck, FileSignature, Gavel, IdCard, Lock, Plus, Scale, ShieldCheck,
} from 'lucide-react'
import { get, put } from '../../lib/api'
import { fmtDate } from '../../lib/format'
import {
  Bar, Card, EmptyState, ModuleHeader, Pill, ProgressRing, Reveal, SWK, Segmented, StatTile, aed,
} from '../../swk/ui'
import { RERA_FORMS, UAE } from '../../swk/uae'

type TabKey = 'overview' | 'permits' | 'aml' | 'forms'

export default function ReraCentre() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<TabKey>('overview')
  const [notice, setNotice] = useState<string | null>(null)
  const compQ = useQuery({ queryKey: ['rera-comp'], queryFn: () => get<any>('/api/e/compliance_items', { pageSize: 200 }) })
  const propsQ = useQuery({ queryKey: ['rera-props'], queryFn: () => get<any>('/api/e/properties', { pageSize: 200 }) })
  const mandQ = useQuery({ queryKey: ['rera-mand'], queryFn: () => get<any>('/api/e/mandates', { pageSize: 200 }) })
  const agentsQ = useQuery({ queryKey: ['rera-agents'], queryFn: () => get<any>('/api/e/agents', { pageSize: 200 }) })
  const partiesQ = useQuery({ queryKey: ['rera-parties'], queryFn: () => get<any>('/api/e/parties', { pageSize: 500 }) })
  const jobsQ = useQuery({ queryKey: ['rera-jobs'], queryFn: () => get<any>('/api/e/jobs', { pageSize: 500 }) })
  const contractsQ = useQuery({ queryKey: ['rera-contracts'], queryFn: () => get<any>('/api/e/sales_contracts', { pageSize: 500 }) })
  const receiptsQ = useQuery({ queryKey: ['rera-receipts'], queryFn: () => get<any>('/api/e/receipts', { pageSize: 500 }) })

  const props: any[] = propsQ.data?.rows ?? []
  const mandates: any[] = mandQ.data?.rows ?? []
  const agents: any[] = agentsQ.data?.rows ?? []
  const items: any[] = compQ.data?.rows ?? []
  const parties: any[] = partiesQ.data?.rows ?? []
  const jobs: any[] = jobsQ.data?.rows ?? []
  const contracts: any[] = contractsQ.data?.rows ?? []
  const receipts: any[] = receiptsQ.data?.rows ?? []

  const metrics = useMemo(() => {
    const withPermit = props.filter(p => Boolean(p.rera_permit_no)).length
    const permitPct = props.length ? Math.round((withPermit / props.length) * 100) : 100
    const activeMandates = mandates.filter(m => /active/i.test(m.status || '')).length
    const validAgents = agents.filter(a => a.status === 'Active').length
    const activeItems = items.filter(i => /active|valid|verified/i.test(i.status || '')).length
    const screenedParties = parties.filter(p => p.sanctions_status === 'Clear' || p.kyc_status === 'Verified').length
    const cddPct = parties.length ? Math.round((screenedParties / parties.length) * 100) : 100
    const consentParties = parties.filter(p => p.marketing_consent !== 'Opted out').length
    const consentPct = parties.length ? Math.round((consentParties / parties.length) * 100) : 100
    const score = Math.round(permitPct * 0.4 + cddPct * 0.35 + (agents.length === 0 || validAgents === agents.length ? 100 : Math.round((validAgents / agents.length) * 100)) * 0.25)
    return { withPermit, missingPermit: props.length - withPermit, permitPct, activeMandates, validAgents, activeItems, totalItems: items.length, cddPct, consentPct, score }
  }, [props, mandates, agents, items, parties])

  const amlRows = useMemo(() => {
    return parties.map(p => {
      const partyJobs = jobs.filter(j => j.client_id === p.id || j.owner_id === p.id)
      const partyContracts = contracts.filter(c => c.buyer_id === p.id || c.seller_id === p.id)
      const partyReceipts = receipts.filter(r => r.party_id === p.id)
      const latestContract = partyContracts[0]
      const latestJob = partyJobs[0]
      const value = Number(latestContract?.sale_price ?? latestJob?.deal_value ?? 0)
      const method = latestContract?.payment_method || partyReceipts[0]?.method || 'Bank Transfer'
      const cashReceipts = partyReceipts.filter(r => /cash/i.test(r.method || '')).reduce((s, r) => s + Number(r.amount || 0), 0)
      const isCashHigh = (/cash/i.test(method) && value >= UAE.goAmlCashThreshold) || cashReceipts >= UAE.goAmlCashThreshold
      const roleLabels = [p.is_customer && 'Client', p.is_landlord && 'Landlord', p.is_tenant && 'Tenant', p.is_vendor && 'Vendor', p.is_broker && 'Co-Broker'].filter(Boolean).join(' · ') || 'Counterparty'
      const risk = p.risk_rating || (p.sanctions_status === 'Confirmed match' || p.sanctions_status === 'Potential match' || isCashHigh ? 'High' : p.sanctions_status === 'Clear' ? 'Low' : 'Medium')

      return {
        partyId: p.id,
        id: p.code || `KYC-${p.id}`,
        party: p.name,
        type: `${roleLabels}${p.trade_license ? ` · TL ${p.trade_license}` : ''}`,
        deal: latestContract?._labels?.property_id || latestJob?.deal_name || 'Onboarding / CDD File',
        value,
        method,
        sanctions: p.sanctions_status || 'Not screened',
        kyc: p.kyc_status || 'Pending',
        risk,
        rearRequired: isCashHigh,
      }
    })
  }, [parties, jobs, contracts, receipts])

  const screenPartyClear = async (partyId: number, name: string) => {
    const today = new Date().toISOString().slice(0, 10)
    await put(`/api/e/parties/${partyId}`, {
      sanctions_status: 'Clear',
      sanctions_screened_on: today,
      kyc_status: 'Verified',
      risk_rating: 'Low',
    })
    setNotice(`${name} marked KYC Verified & Sanctions Clear (${today}).`)
    setTimeout(() => setNotice(null), 3500)
    void qc.invalidateQueries({ queryKey: ['rera-parties'] })
  }

  return (
    <div className="grid gap-5 max-w-[1640px] mx-auto">
      <ModuleHeader
        eyebrow="DLD · RERA ORN 51517 · Ministry of Economy DNFBP · UAE PDPL"
        title="RERA & Regulatory Governance Centre"
        subtitle="Real-time oversight of Trakheesi advertising permits, Madmoun QR verification, Form A/B/F/I statutory contracts, broker BRN cards, DET trade licences, goAML REAR filings (cash ≥ AED 55,000) and UAE PDPL data privacy."
        icon={<Gavel size={24} />}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/compliance" className="swk-btn swk-btn-primary"><BadgeCheck size={16} />Company licences</Link>
            <Link to="/e/mandates" className="swk-btn swk-btn-ghost">Form A mandates <ArrowUpRight size={15} /></Link>
          </div>
        }
      />

      {notice && (
        <div className="px-4 py-2.5 rounded-xl bg-[#def1ef] border border-[#b4dfda] text-[#17625f] text-sm font-semibold flex items-center gap-2">
          <CheckCircle2 size={16} />{notice}
        </div>
      )}

      <Reveal className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatTile label="Office RERA compliance score" value={metrics.score} format={v => `${Math.round(v)}/100`} hint="ORN 51517 · DET Licence 1645802" icon={<ShieldCheck size={16} />} tone="navy" />
        <StatTile label="Trakheesi permit coverage" value={metrics.permitPct} format={v => `${Math.round(v)}%`} hint={`${metrics.withPermit} of ${props.length} listings permitted`} icon={<FileCheck size={16} />} tone="champ" />
        <StatTile label="Active Form A mandates" value={metrics.activeMandates} hint="Signed seller / landlord agreements" icon={<FileSignature size={16} />} to="/e/mandates" />
        <StatTile label="DLD registered brokers (BRN)" value={metrics.validAgents} hint="Active RERA broker cards" icon={<IdCard size={16} />} to="/e/agents" />
      </Reveal>

      <div>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'overview', label: 'Regulatory Overview & Licences' },
            { value: 'permits', label: 'Trakheesi & Madmoun Permits' },
            { value: 'aml', label: 'goAML / KYC & DNFBP Screening' },
            { value: 'forms', label: 'Statutory RERA Forms Library' },
          ]}
          layoutId="rera-tabs"
        />
      </div>

      {tab === 'overview' && (
        <Reveal className="grid gap-5 xl:grid-cols-12">
          <Card className="xl:col-span-4" title="Brokerage governance posture" subtitle="Live audit across DLD, DET, MOHRE, FTA & MoE">
            <div className="flex items-center gap-5 mb-4">
              <ProgressRing value={metrics.score} size={112} color={SWK.oasis} label={`${metrics.score}%`} sub="Compliant" />
              <div className="grid gap-1.5 flex-1 text-xs">
                <div className="swk-kv"><span>RERA ORN</span><b>51517</b></div>
                <div className="swk-kv"><span>DET Trade Licence</span><b>1645802</b></div>
                <div className="swk-kv"><span>DCCI Membership</span><b>697774</b></div>
                <div className="swk-kv"><span>Commercial Register</span><b>2911510</b></div>
              </div>
            </div>
            <div className="grid gap-2.5 text-xs">
              <div>
                <div className="flex justify-between mb-1"><span>Trakheesi ad permits</span><b>{metrics.permitPct}%</b></div>
                <Bar value={metrics.permitPct} max={100} color={SWK.oasis} />
              </div>
              <div>
                <div className="flex justify-between mb-1"><span>goAML CDD / Sanctions screening</span><b>{metrics.cddPct}%</b></div>
                <Bar value={metrics.cddPct} max={100} color={SWK.navy} />
              </div>
              <div>
                <div className="flex justify-between mb-1"><span>UAE PDPL marketing compliance</span><b>{metrics.consentPct}%</b></div>
                <Bar value={metrics.consentPct} max={100} color={SWK.champDeep} />
              </div>
            </div>
          </Card>

          <Card className="xl:col-span-8" title="Corporate licences & statutory registrations" subtitle="Synced with /compliance register" to="/compliance">
            <div className="overflow-x-auto max-h-[360px]">
              <table className="swk-table">
                <thead>
                  <tr><th>Registration / Licence</th><th>Authority</th><th>Reference no.</th><th>Expiry</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {items.map((it: any) => (
                    <tr key={it.id}>
                      <td className="font-semibold"><Link to={`/e/compliance_items/${it.id}`} className="hover:underline">{it.name}</Link></td>
                      <td className="text-xs text-muted">{it.authority || 'UAE Authority'}</td>
                      <td className="font-mono text-xs">{it.reference_no || '—'}</td>
                      <td className="whitespace-nowrap">{it.expiry_date ? fmtDate(it.expiry_date) : 'Continuous'}</td>
                      <td>
                        <Pill tone={/active/i.test(it.status || '') ? 'oasis' : 'champ'}>{it.status || 'To verify'}</Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </Reveal>
      )}

      {tab === 'permits' && (
        <Reveal className="grid gap-5">
          <Card title="Trakheesi listing permits & Madmoun QR audit" subtitle="Every public property advertisement in Dubai requires a valid Trakheesi permit and Madmoun QR code">
            {props.length === 0 ? (
              <EmptyState title="No properties in inventory yet" hint="Add properties to audit their Trakheesi permit numbers and Madmoun QR status." action={<Link to="/e/properties?new=1" className="swk-btn swk-btn-primary"><Plus size={15} /> Add property</Link>} />
            ) : (
              <div className="overflow-x-auto">
                <table className="swk-table">
                  <thead>
                    <tr><th>Property</th><th>Community</th><th>Type</th><th>Trakheesi permit</th><th>Madmoun QR</th><th>Portal gate</th></tr>
                  </thead>
                  <tbody>
                    {props.map((p: any) => {
                      const hasPermit = Boolean(p.rera_permit_no)
                      return (
                        <tr key={p.id}>
                          <td><Link to={`/e/properties/${p.id}`} className="font-semibold text-ink hover:underline">{p.title}</Link></td>
                          <td>{p.community_id || p.address || 'Dubai'}</td>
                          <td>{p.property_type}</td>
                          <td className="font-mono text-xs">{p.rera_permit_no || 'Missing'}</td>
                          <td>{hasPermit ? <Pill tone="oasis">QR Verified</Pill> : <Pill tone="dune">Blocked</Pill>}</td>
                          <td>{hasPermit ? <span className="text-xs font-semibold text-[#17625f]">Cleared for PF / Bayut / dubizzle</span> : <span className="text-xs font-semibold text-[#a33a22]">Syndication locked</span>}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </Reveal>
      )}

      {tab === 'aml' && (
        <Reveal className="grid gap-5 xl:grid-cols-12">
          <Card className="xl:col-span-8" title="DNFBP AML / KYC screening & goAML REAR queue" subtitle={`Cash or virtual-asset transactions ≥ ${aed(UAE.goAmlCashThreshold)} require a Real Estate Activity Report (REAR) on goAML`} actions={<Link to="/e/parties?new=1" className="swk-btn swk-btn-ghost !h-8 text-[12px]"><Plus size={14} /> Add party</Link>}>
            {amlRows.length === 0 ? (
              <EmptyState title="No counterparties in KYC / AML queue" hint="Add buyers, sellers, landlords or tenants in Contacts & Parties to screen against UAE / UN sanctions lists and track goAML REAR obligations." action={<Link to="/e/parties?new=1" className="swk-btn swk-btn-primary"><Plus size={15} /> Add counterparty</Link>} />
            ) : (
              <div className="overflow-x-auto">
                <table className="swk-table">
                  <thead>
                    <tr><th>Ref</th><th>Client / Entity</th><th>Deal & payment method</th><th className="num">Value</th><th>KYC & Sanctions</th><th>Risk</th><th>goAML action</th></tr>
                  </thead>
                  <tbody>
                    {amlRows.map(r => (
                      <tr key={r.id}>
                        <td className="font-mono text-xs"><Link to={`/e/parties/${r.partyId}`} className="hover:underline">{r.id}</Link></td>
                        <td><Link to={`/e/parties/${r.partyId}`} className="font-semibold hover:underline">{r.party}</Link><div className="text-xs text-muted">{r.type}</div></td>
                        <td><div>{r.deal}</div><div className="text-xs text-muted">{r.method}</div></td>
                        <td className="num font-semibold">{r.value ? aed(r.value, { compact: true }) : '—'}</td>
                        <td className="text-xs">KYC: <b>{r.kyc}</b> · Sanctions: <b>{r.sanctions}</b></td>
                        <td><Pill tone={r.risk === 'High' ? 'dune' : r.risk === 'Medium' ? 'champ' : 'oasis'}>{r.risk}</Pill></td>
                        <td>
                          <div className="flex items-center gap-1.5">
                            {r.rearRequired ? <Pill tone="dune">REAR XML Required</Pill> : r.sanctions === 'Clear' && r.kyc === 'Verified' ? <Pill tone="oasis">CDD Complete</Pill> : (
                              <button type="button" className="swk-btn swk-btn-gold !h-7 !px-2.5 text-[11.5px]" onClick={() => void screenPartyClear(r.partyId, r.party)}>
                                Verify & Clear
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="xl:col-span-4" title="UAE PDPL (Federal Decree-Law 45/2021)" subtitle="Personal data protection & DSAR controls" tone="champ">
            <div className="grid gap-3 text-[13px]">
              <div className="p-3.5 rounded-xl bg-white border border-[#e7e1d4]">
                <div className="font-semibold text-ink flex items-center gap-2"><Lock size={15} className="text-[#9a7a42]" />Explicit marketing consent</div>
                <div className="text-xs text-muted mt-1">All WhatsApp & email campaigns check party opt-in flags before dispatch.</div>
              </div>
              <div className="p-3.5 rounded-xl bg-white border border-[#e7e1d4]">
                <div className="font-semibold text-ink flex items-center gap-2"><Scale size={15} className="text-[#9a7a42]" />5-year AML retention rule</div>
                <div className="text-xs text-muted mt-1">Emirates ID, passport, UBO declarations and Form F contracts are retained for 5 years per Ministry of Economy DNFBP rules.</div>
              </div>
            </div>
          </Card>
        </Reveal>
      )}

      {tab === 'forms' && (
        <Reveal className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {RERA_FORMS.map(f => (
            <Card key={f.code} title={`${f.code} — ${f.stage}`} subtitle={f.name} actions={<Pill tone="champ">DLD Standard</Pill>}>
              <p className="text-xs text-muted m-0 mb-3">
                Mandatory Dubai Land Department / RERA contract stage. Digital e-signatures via Dubai Brokers App / UAE PASS must be archived in the Deal File before advancing pipeline stage.
              </p>
              <Link to="/studio" className="swk-btn swk-btn-ghost w-full">Open in Document Studio <ArrowUpRight size={14} /></Link>
            </Card>
          ))}
        </Reveal>
      )}
    </div>
  )
}
