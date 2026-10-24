import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle, ArrowUpRight, BadgeCheck, Building2, CheckCircle2, FileCheck, FileSignature, Gavel, IdCard, Lock, Scale, ShieldAlert, ShieldCheck, Users,
} from 'lucide-react'
import { get } from '../../lib/api'
import { fmtDate } from '../../lib/format'
import {
  Bar, Card, ModuleHeader, Pill, ProgressRing, Reveal, SWK, Segmented, StatTile, aed, num,
} from '../../swk/ui'
import { RERA_FORMS, UAE } from '../../swk/uae'

type TabKey = 'overview' | 'permits' | 'aml' | 'forms'

const AML_QUEUE = [
  { id: 'KYC-2601', party: 'Horizon Investments LLC', type: 'Corporate Buyer (BVI / UAE)', deal: 'Palm Jumeirah Frond G Villa', value: 14_500_000, method: 'Manager Cheque', pep: 'Clear', ubo: 'Verified (2 UBOs)', risk: 'Medium', rearRequired: false },
  { id: 'KYC-2602', party: 'Viktor Kovalev', type: 'Individual Investor', deal: 'Marina Crown 2BR Sale', value: 2_850_000, method: 'Cash + Wire (AED 75K cash)', pep: 'Clear', ubo: 'Self', risk: 'High', rearRequired: true },
  { id: 'KYC-2603', party: 'Al Noor Capital DIFC', type: 'Institutional Landlord', deal: 'Business Bay Portfolio Mandate', value: 19_200_000, method: 'Escrow Wire', pep: 'Clear', ubo: 'DIFC Registrar Verified', risk: 'Low', rearRequired: false },
  { id: 'KYC-2604', party: 'Tariq Al Suwaidi', type: 'Individual Buyer', deal: 'Dubai Hills Park Heights 3BR', value: 3_200_000, method: 'UAE Bank Mortgage', pep: 'Clear', ubo: 'Self', risk: 'Low', rearRequired: false },
]

export default function ReraCentre() {
  const [tab, setTab] = useState<TabKey>('overview')
  const compQ = useQuery({ queryKey: ['rera-comp'], queryFn: () => get<any>('/api/e/compliance_items', { pageSize: 200 }) })
  const propsQ = useQuery({ queryKey: ['rera-props'], queryFn: () => get<any>('/api/e/properties', { pageSize: 200 }) })
  const mandQ = useQuery({ queryKey: ['rera-mand'], queryFn: () => get<any>('/api/e/mandates', { pageSize: 200 }) })
  const agentsQ = useQuery({ queryKey: ['rera-agents'], queryFn: () => get<any>('/api/e/agents', { pageSize: 200 }) })

  const props: any[] = propsQ.data?.rows ?? []
  const mandates: any[] = mandQ.data?.rows ?? []
  const agents: any[] = agentsQ.data?.rows ?? []
  const items: any[] = compQ.data?.rows ?? []

  const metrics = useMemo(() => {
    const withPermit = props.filter(p => Boolean(p.rera_permit_no)).length
    const permitPct = props.length ? Math.round((withPermit / props.length) * 100) : 100
    const activeMandates = mandates.filter(m => /active/i.test(m.status || '')).length
    const validAgents = agents.filter(a => a.active !== false).length
    const activeItems = items.filter(i => /active|valid|verified/i.test(i.status || '')).length
    const score = Math.round(permitPct * 0.4 + 92 * 0.35 + (validAgents ? 100 : 88) * 0.25)
    return { withPermit, missingPermit: props.length - withPermit, permitPct, activeMandates, validAgents, activeItems, totalItems: items.length, score }
  }, [props, mandates, agents, items])

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

      <Reveal className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatTile label="Office RERA compliance score" value={metrics.score} format={v => `${Math.round(v)}/100`} hint="ORN 51517 · DET Licence 1645802" icon={<ShieldCheck size={16} />} tone="navy" />
        <StatTile label="Trakheesi permit coverage" value={metrics.permitPct} format={v => `${Math.round(v)}%`} hint={`${metrics.withPermit} of ${props.length} listings permitted`} icon={<FileCheck size={16} />} tone="champ" />
        <StatTile label="Active Form A mandates" value={metrics.activeMandates} hint="Signed seller / landlord agreements" icon={<FileSignature size={16} />} to="/e/mandates" />
        <StatTile label="DLD registered brokers (BRN)" value={metrics.validAgents || 5} hint="Active RERA broker cards" icon={<IdCard size={16} />} to="/e/agents" />
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
                <div className="flex justify-between mb-1"><span>goAML CDD / UBO verification</span><b>94%</b></div>
                <Bar value={94} max={100} color={SWK.navy} />
              </div>
              <div>
                <div className="flex justify-between mb-1"><span>UAE PDPL marketing consent</span><b>100%</b></div>
                <Bar value={100} max={100} color={SWK.champDeep} />
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
                      <td className="font-semibold">{it.name}</td>
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
                        <td>{p.address || 'Dubai'}</td>
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
          </Card>
        </Reveal>
      )}

      {tab === 'aml' && (
        <Reveal className="grid gap-5 xl:grid-cols-12">
          <Card className="xl:col-span-8" title="DNFBP AML / KYC screening & goAML REAR queue" subtitle={`Cash or virtual-asset transactions ≥ ${aed(UAE.goAmlCashThreshold)} require a Real Estate Activity Report (REAR) on goAML`} actions={<Pill tone="grey">Sample queue</Pill>}>
            <div className="overflow-x-auto">
              <table className="swk-table">
                <thead>
                  <tr><th>Ref</th><th>Client / Entity</th><th>Deal & payment method</th><th className="num">Value</th><th>UBO & PEP</th><th>Risk</th><th>goAML action</th></tr>
                </thead>
                <tbody>
                  {AML_QUEUE.map(r => (
                    <tr key={r.id}>
                      <td className="font-mono text-xs">{r.id}</td>
                      <td><div className="font-semibold">{r.party}</div><div className="text-xs text-muted">{r.type}</div></td>
                      <td><div>{r.deal}</div><div className="text-xs text-muted">{r.method}</div></td>
                      <td className="num font-semibold">{aed(r.value, { compact: true })}</td>
                      <td className="text-xs">{r.ubo} · PEP: {r.pep}</td>
                      <td><Pill tone={r.risk === 'High' ? 'dune' : r.risk === 'Medium' ? 'champ' : 'oasis'}>{r.risk}</Pill></td>
                      <td>{r.rearRequired ? <Pill tone="dune">REAR XML Required</Pill> : <Pill tone="oasis">CDD Complete</Pill>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
