import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Activity, AlertTriangle, ArrowUpRight, BadgeCheck, Banknote, Briefcase, Building2, CheckCheck,
  CheckCircle2, ClipboardCheck, Clock, DatabaseBackup, Eye, FileCheck2, FileSignature, Gavel,
  Landmark, Layers, Lock, MapPinned, MessageSquare, PackageCheck, Percent, Plane, RefreshCw,
  Shield, ShieldAlert, ShieldCheck, Sparkles, Star, UserCheck, Users,
} from 'lucide-react'
import { get, post } from '../../lib/api'
import { Card, ModuleHeader, Pill, Reveal, Segmented, StatTile, SWK, aed } from '../../swk/ui'
import { SECONDARY_SALE_EXCEPTIONS } from '@shared/entities/enterprise'

type Row = Record<string, any>
type ListRes = { rows: Row[]; total: number }

const TABS = [
  { value: 'command', label: 'Command Centre & 35 Modules' },
  { value: 'accountability', label: 'Daily Accountability (4.01)' },
  { value: 'inventory', label: 'Inventory & Listing Gate (4.02)' },
  { value: 'noc', label: 'Developer NOC Centre (4.03)' },
  { value: 'transactions', label: 'Transactions & Exceptions (4.04/4.05)' },
  { value: 'commissions', label: 'Commissions & 3-Way Payout (4.08)' },
  { value: 'hr_pro', label: 'Visa/PRO & Broker Auth (4.06)' },
  { value: 'supervision', label: 'WhatsApp & Field Privacy (4.07)' },
  { value: 'risk_qa', label: 'Risk, DLP, Complaints & QA (4.09)' },
  { value: 'governance', label: 'Approvals, Separation & DR (4.10)' },
] as const

type TabKey = typeof TABS[number]['value']

export default function EnterpriseMasterOsPage() {
  const [tab, setTab] = useState<TabKey>('command')
  const [banner, setBanner] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const qc = useQueryClient()

  const cmdQ = useQuery({ queryKey: ['ent-cmd'], queryFn: () => get<any>('/api/enterprise/command-centre') })
  const dailyQ = useQuery({ queryKey: ['ent-daily'], queryFn: () => get<ListRes>('/api/e/daily_reports', { pageSize: 50 }) })
  const invQ = useQuery({ queryKey: ['ent-inv'], queryFn: () => get<ListRes>('/api/e/inventory_submissions', { pageSize: 50 }) })
  const lmdQ = useQuery({ queryKey: ['ent-lmd'], queryFn: () => get<ListRes>('/api/e/listing_mandates', { pageSize: 50 }) })
  const nocQ = useQuery({ queryKey: ['ent-noc'], queryFn: () => get<ListRes>('/api/e/developer_requests', { pageSize: 50 }) })
  const txnQ = useQuery({ queryKey: ['ent-txn'], queryFn: () => get<ListRes>('/api/e/transactions', { pageSize: 50 }) })
  const cenQ = useQuery({ queryKey: ['ent-cen'], queryFn: () => get<ListRes>('/api/e/commission_entitlements', { pageSize: 50 }) })
  const proQ = useQuery({ queryKey: ['ent-pro'], queryFn: () => get<ListRes>('/api/e/immigration_cases', { pageSize: 50 }) })
  const autQ = useQuery({ queryKey: ['ent-aut'], queryFn: () => get<ListRes>('/api/e/agent_authorisations', { pageSize: 50 }) })
  const comQ = useQuery({ queryKey: ['ent-com'], queryFn: () => get<ListRes>('/api/e/communications', { pageSize: 50 }) })
  const supLogQ = useQuery({ queryKey: ['ent-suplog'], queryFn: () => get<ListRes>('/api/e/supervisor_access_logs', { pageSize: 30 }) })
  const fldQ = useQuery({ queryKey: ['ent-fld'], queryFn: () => get<ListRes>('/api/e/field_sessions', { pageSize: 50 }) })
  const locLogQ = useQuery({ queryKey: ['ent-loclog'], queryFn: () => get<ListRes>('/api/e/location_access_logs', { pageSize: 30 }) })
  const casQ = useQuery({ queryKey: ['ent-cas'], queryFn: () => get<ListRes>('/api/e/compliance_cases', { pageSize: 50 }) })
  const qaQ = useQuery({ queryKey: ['ent-qa'], queryFn: () => get<ListRes>('/api/e/qa_reviews', { pageSize: 50 }) })
  const aprQ = useQuery({ queryKey: ['ent-apr'], queryFn: () => get<ListRes>('/api/e/universal_approvals', { pageSize: 50 }) })
  const hrlQ = useQuery({ queryKey: ['ent-hrl'], queryFn: () => get<ListRes>('/api/e/hr_lifecycle_cases', { pageSize: 50 }) })
  const drxQ = useQuery({ queryKey: ['ent-drx'], queryFn: () => get<ListRes>('/api/e/dr_exercises', { pageSize: 50 }) })
  const audQ = useQuery({ queryKey: ['ent-aud'], queryFn: () => get<ListRes>('/api/e/audit_events', { pageSize: 40 }) })

  async function runAction(label: string, fn: () => Promise<any>) {
    try {
      setBanner(null)
      await fn()
      setBanner({ tone: 'ok', text: `${label} completed and recorded in the immutable enterprise audit log.` })
      await qc.invalidateQueries()
    } catch (e: any) {
      setBanner({ tone: 'err', text: e?.message || String(e) })
      await qc.invalidateQueries()
    }
  }

  const cmd = cmdQ.data
  const exec = cmd?.departments?.executive ?? {}
  const sales = cmd?.departments?.sales_and_leasing ?? {}
  const inv = cmd?.departments?.inventory_and_listings ?? {}
  const noc = cmd?.departments?.developer_noc_and_conveyancing ?? {}
  const hr = cmd?.departments?.hr_pro_and_accountability ?? {}
  const fin = cmd?.departments?.finance_and_commissions ?? {}
  const comp = cmd?.departments?.compliance_risk_and_qa ?? {}

  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader
        eyebrow="Master Specification v1.0 · 35 Modules · 10 Workflows · 20 Canonical Aggregates"
        icon={<ShieldCheck size={22} />}
        title="Enterprise Operating Model & Command Centre"
        subtitle="Evidence-backed workflow transitions, strict separation of duties, ethical staff supervision, and end-to-end commercial-to-finance reconciliation."
        actions={
          <>
            <Link to="/e/audit_events" className="swk-btn swk-btn-ghost"><Activity size={15} /> Immutable Audit Log</Link>
            <button className="swk-btn swk-btn-primary" onClick={() => qc.invalidateQueries()}><RefreshCw size={15} /> Refresh Telemetry</button>
          </>
        }
      />

      {banner && (
        <div
          role="alert"
          className="px-4 py-3 rounded-2xl text-[13px] font-semibold flex items-center justify-between gap-3"
          style={{
            background: banner.tone === 'ok' ? '#def1ef' : '#fbe4dd',
            color: banner.tone === 'ok' ? SWK.oasis : SWK.dune,
            border: `1px solid ${banner.tone === 'ok' ? '#9fd5cf' : '#f3b8a6'}`,
          }}
        >
          <span>{banner.text}</span>
          <button className="text-xs underline" onClick={() => setBanner(null)}>Dismiss</button>
        </div>
      )}

      <Reveal className="grid gap-4 grid-cols-2 md:grid-cols-4 xl:grid-cols-7">
        <StatTile tone="navy" label="Enterprise Modules" value={cmd?.modules_active ?? 35} icon={<Layers size={16} />} hint="3.01 – 3.35 Active" />
        <StatTile label="Active Pipeline" value={exec.active_pipeline_value ?? 0} format={v => aed(v, { compact: true })} icon={<Briefcase size={16} />} hint={`${sales.enterprise_transactions_open ?? 0} open transactions`} to="/e/transactions" />
        <StatTile tone="champ" label="Collected Revenue" value={exec.collected_revenue_total ?? 0} format={v => aed(v, { compact: true })} icon={<Banknote size={16} />} hint="Reconciled bank receipts" to="/e/receipts" />
        <StatTile label="Verified Listings" value={inv.verified_mandates ?? 0} icon={<Building2 size={16} />} hint={`${inv.duplicate_conflicts_held ?? 0} duplicate holds`} to="/e/listing_mandates" />
        <StatTile label="NOCs Unlocked" value={noc.nocs_verified_unlocked ?? 0} icon={<FileCheck2 size={16} />} hint={`${noc.nocs_fraud_or_unverified_held ?? 0} held before close`} to="/e/developer_requests" />
        <StatTile tone="champ" label="Four-Eyes Queue" value={exec.pending_universal_approvals ?? 0} icon={<CheckCheck size={16} />} hint="Maker-checker approvals" to="/e/universal_approvals" />
        <StatTile label="Open Risk & DLP Cases" value={exec.open_compliance_cases ?? 0} icon={<ShieldAlert size={16} />} hint="Human review required" to="/e/compliance_cases" />
      </Reveal>

      <div className="overflow-x-auto pb-1">
        <Segmented
          layoutId="ent-os-tabs"
          value={tab}
          onChange={v => setTab(v as TabKey)}
          options={TABS.map(t => ({ value: t.value, label: t.label }))}
        />
      </div>

      {/* =====================================================================
          TAB 1: CEO & DEPARTMENT COMMAND CENTRE + 35-MODULE CATALOGUE
         ===================================================================== */}
      {tab === 'command' && (
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="7 Non-Negotiable Operating Principles" subtitle="Enforced in domain hooks, state machines & RBAC">
              <ul className="text-[12.5px] space-y-2 text-ink">
                <li><strong>1. Canonical Aggregate:</strong> One authoritative record per business object with full ownership history.</li>
                <li><strong>2. Evidence-Backed Transitions:</strong> No stage advances without verified documents, permits, or receipts.</li>
                <li><strong>3. Separation of Duties:</strong> Maker ≠ Checker across listings, NOCs, PRO, QA, and 3-way payouts.</li>
                <li><strong>4. Integration Honesty:</strong> Live vs simulated vs manual status explicitly surfaced.</li>
                <li><strong>5. Fair Anomaly Review:</strong> Automated flags create leads for independent human review — never auto-guilt.</li>
                <li><strong>6. Proportionate Monitoring:</strong> Work-hours field presence only; off-hours GPS access is blocked & logged.</li>
                <li><strong>7. Financial Reconciliation:</strong> Every commercial outcome reconciles to tax invoices & bank receipts.</li>
              </ul>
            </Card>

            <Card title="Department Command KPIs (Section 8)" subtitle="Click any metric to drill down into underlying source records">
              <div className="grid grid-cols-2 gap-2.5 text-[12.5px]">
                <Link to="/e/daily_reports" className="p-2.5 rounded-xl bg-[#f7f4ec] hover:bg-[#efe9dc]">
                  <div className="text-muted">Daily Reports Today</div>
                  <div className="font-semibold text-[15px] text-ink">{hr.daily_reports_submitted_today ?? 0} submitted</div>
                </Link>
                <Link to="/e/agent_authorisations" className="p-2.5 rounded-xl bg-[#f7f4ec] hover:bg-[#efe9dc]">
                  <div className="text-muted">Authorised Brokers</div>
                  <div className="font-semibold text-[15px] text-ink">{hr.authorised_brokers ?? 0} active ({hr.expired_broker_credentials ?? 0} expired)</div>
                </Link>
                <Link to="/e/immigration_cases" className="p-2.5 rounded-xl bg-[#f7f4ec] hover:bg-[#efe9dc]">
                  <div className="text-muted">Visa / PRO Cases</div>
                  <div className="font-semibold text-[15px] text-ink">{hr.open_immigration_cases ?? 0} open ({hr.delayed_immigration_cases ?? 0} delayed)</div>
                </Link>
                <Link to="/e/commission_entitlements" className="p-2.5 rounded-xl bg-[#f7f4ec] hover:bg-[#efe9dc]">
                  <div className="text-muted">Payable Commissions</div>
                  <div className="font-semibold text-[15px] text-ink">{aed(fin.commission_payable_total ?? 0, { compact: true })}</div>
                </Link>
                <Link to="/e/communications" className="p-2.5 rounded-xl bg-[#f7f4ec] hover:bg-[#efe9dc]">
                  <div className="text-muted">WhatsApp Supervision</div>
                  <div className="font-semibold text-[15px] text-ink">{sales.whatsapp_diversion_flags ?? 0} diversion flags</div>
                </Link>
                <Link to="/e/dr_exercises" className="p-2.5 rounded-xl bg-[#f7f4ec] hover:bg-[#efe9dc]">
                  <div className="text-muted">Verified DR Drills</div>
                  <div className="font-semibold text-[15px] text-ink">{comp.verified_dr_exercises ?? 0} passed RTO/RPO</div>
                </Link>
              </div>
            </Card>

            <Card title="Integration Honesty Status (Principle 4)" subtitle="Distinguishes live credentials from simulated/manual modes">
              <div className="flex flex-col gap-2 text-[12.5px]">
                {[
                  { name: 'Company WhatsApp Business (3.09)', mode: cmd?.integration_honesty?.whatsapp_mode || 'Simulated / Sandbox', route: '/whatsapp' },
                  { name: 'Outbound & Inbound Email (3.09)', mode: cmd?.integration_honesty?.email_mode || 'Simulated / Sandbox', route: '/email' },
                  { name: 'AI Voice Receptionist (3.22)', mode: cmd?.integration_honesty?.voice_receptionist_enabled ? 'Live Webhook Active' : 'Standby / Manual', route: '/e/voice_calls' },
                  { name: 'AI Functional Agents (3.34)', mode: cmd?.integration_honesty?.ai_concierge_mode || 'Approval-Gated', route: '/ai' },
                  { name: 'DLD / Trakheesi / Portal Feeds (3.12)', mode: 'Evidence-Backed Verification Gate', route: '/listings' },
                ].map(item => (
                  <Link key={item.name} to={item.route} className="flex items-center justify-between p-2 rounded-xl bg-[#f7f4ec] hover:bg-[#efe9dc]">
                    <span className="font-medium text-ink">{item.name}</span>
                    <Pill tone={item.mode.includes('Live') ? 'oasis' : 'champ'}>{item.mode}</Pill>
                  </Link>
                ))}
              </div>
            </Card>
          </div>

          <Card title="All 35 Enterprise Modules (Section 3.01 – 3.35)" subtitle="Complete module catalogue mapped to canonical entities and specialized workspaces">
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {(cmd?.module_catalogue ?? []).map((m: any) => (
                <Link
                  key={m.code}
                  to={`/e/${m.entity}`}
                  className="p-3 rounded-2xl border border-[#e7e1d4] bg-white hover:border-[#c8a96b] transition flex flex-col justify-between gap-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#f3ead8] text-[#6e521c]">{m.code}</span>
                    <Pill tone="oasis">{m.status}</Pill>
                  </div>
                  <div className="font-semibold text-[13px] text-ink leading-snug">{m.name}</div>
                  <div className="text-[11px] text-muted flex items-center justify-between">
                    <span>/e/{m.entity}</span>
                    <ArrowUpRight size={13} />
                  </div>
                </Link>
              ))}
            </div>
          </Card>

          <Card title="Recent Immutable Enterprise Audit Events" subtitle="Every state transition, supervisory access, and control gate across 4.01–4.10">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12.5px]">
                <thead>
                  <tr className="border-b border-[#e7e1d4] text-muted">
                    <th className="py-2 pr-3">Timestamp</th>
                    <th className="py-2 pr-3">Module</th>
                    <th className="py-2 pr-3">Workflow</th>
                    <th className="py-2 pr-3">Event Type</th>
                    <th className="py-2 pr-3">Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {(audQ.data?.rows ?? []).slice(0, 12).map(a => (
                    <tr key={a.id} className="border-b border-[#f1ece2]">
                      <td className="py-2 pr-3 tabular-nums text-muted">{String(a.occurred_at || '').slice(0, 19).replace('T', ' ')}</td>
                      <td className="py-2 pr-3"><Pill tone="navy">{a.module_code}</Pill></td>
                      <td className="py-2 pr-3"><Pill tone="champ">{a.workflow_code}</Pill></td>
                      <td className="py-2 pr-3 font-mono text-[11.5px]">{a.event_type}</td>
                      <td className="py-2 pr-3 text-ink">{a.summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* =====================================================================
          TAB 2: 3.06 & 4.01 DAILY STAFF ACCOUNTABILITY
         ===================================================================== */}
      {tab === 'accountability' && (
        <Card
          title="3.06 / 4.01 Daily Staff Accountability & Reporting"
          subtitle="System-populated CRM/call/viewing counts are immutable and separate from employee narrative. Submitted reports freeze automatically."
          actions={
            <div className="flex gap-2">
              <button
                className="swk-btn swk-btn-ghost"
                onClick={() => runAction('Missing report scan', () => post('/api/daily-reports/scan-missing', {}))}
              >
                <Clock size={14} /> Scan Missing Reports (Create Manager Tasks)
              </button>
              <Link to="/e/daily_reports?new=1" className="swk-btn swk-btn-primary"><ClipboardCheck size={14} /> New Daily Report</Link>
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-[#e7e1d4] text-muted">
                  <th className="py-2 pr-3">Report No.</th>
                  <th className="py-2 pr-3">Employee</th>
                  <th className="py-2 pr-3">Date & Type</th>
                  <th className="py-2 pr-3">System Evidence (Immutable)</th>
                  <th className="py-2 pr-3">Employee Narrative</th>
                  <th className="py-2 pr-3">Status & Version</th>
                  <th className="py-2 pr-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(dailyQ.data?.rows ?? []).map(r => (
                  <tr key={r.id} className="border-b border-[#f1ece2] align-top">
                    <td className="py-3 pr-3 font-semibold"><Link to={`/e/daily_reports/${r.id}`} className="underline">{r.report_no}</Link></td>
                    <td className="py-3 pr-3">{r._labels?.employee_id || `#${r.employee_id}`}</td>
                    <td className="py-3 pr-3">
                      <div>{r.report_date}</div>
                      <div className="text-[11px] text-muted">{r.day_type}</div>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex flex-wrap gap-1.5">
                        <Pill tone="navy">Calls: {r.sys_calls_count ?? 0}</Pill>
                        <Pill tone="navy">Tasks: {r.sys_tasks_completed ?? 0}</Pill>
                        <Pill tone="navy">Leads: {r.sys_leads_contacted ?? 0}</Pill>
                        <Pill tone="navy">Viewings: {r.sys_viewings_completed ?? 0}</Pill>
                        <Pill tone="navy">Offers: {r.sys_offers_logged ?? 0}</Pill>
                      </div>
                    </td>
                    <td className="py-3 pr-3 max-w-xs">
                      <div className="font-medium text-ink line-clamp-2">{r.outcomes_narrative || '—'}</div>
                      <div className="text-[11px] text-muted mt-0.5">Next: {r.next_day_priorities || '—'}</div>
                    </td>
                    <td className="py-3 pr-3">
                      <Pill tone={r.status === 'Approved by Manager' ? 'oasis' : r.status === 'Submitted (Frozen)' ? 'champ' : 'grey'}>{r.status}</Pill>
                      <div className="text-[11px] text-muted mt-1">Sub v{r.revision_no ?? 1} · Rev v{r.review_version ?? 0}</div>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex flex-wrap gap-1.5">
                        {(r.status === 'Draft' || r.status === 'Returned for Clarification') && (
                          <button
                            className="swk-btn swk-btn-primary !py-1 !px-2.5 !text-xs"
                            onClick={() => runAction(`Submit ${r.report_no}`, () => post(`/api/daily-reports/${r.id}/submit`, {}))}
                          >
                            Freeze & Submit
                          </button>
                        )}
                        {r.status === 'Submitted (Frozen)' && (
                          <>
                            <button
                              className="swk-btn swk-btn-primary !py-1 !px-2.5 !text-xs"
                              onClick={() => runAction(`Approve ${r.report_no}`, () => post(`/api/daily-reports/${r.id}/review`, { decision: 'approve', feedback: 'Verified system snapshot against daily narrative outcomes.' }))}
                            >
                              Manager Approve
                            </button>
                            <button
                              className="swk-btn swk-btn-ghost !py-1 !px-2.5 !text-xs"
                              onClick={() => runAction(`Return ${r.report_no}`, () => post(`/api/daily-reports/${r.id}/review`, { decision: 'return', feedback: 'Please attach viewing reference numbers for afternoon appointments.' }))}
                            >
                              Return
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* =====================================================================
          TAB 3: 3.07, 3.12 & 4.02 INVENTORY ACQUISITION & LISTING GATE
         ===================================================================== */}
      {tab === 'inventory' && (
        <div className="flex flex-col gap-6">
          <Card
            title="3.07 / 4.02 Daily Inventory Acquisition Queue & Duplicate Detection (7.01 / 7.07)"
            subtitle="Requires duplicate building+unit check, independent inventory check, compliance Trakheesi check, and second-person manager publication approval."
            actions={<Link to="/e/inventory_submissions?new=1" className="swk-btn swk-btn-primary"><Building2 size={14} /> Submit Sourced Unit</Link>}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12.5px]">
                <thead>
                  <tr className="border-b border-[#e7e1d4] text-muted">
                    <th className="py-2 pr-3">Submission</th>
                    <th className="py-2 pr-3">Building & Unit</th>
                    <th className="py-2 pr-3">Owner & Permit</th>
                    <th className="py-2 pr-3">Conflict Check (7.01)</th>
                    <th className="py-2 pr-3">Workflow Stage</th>
                    <th className="py-2 pr-3">Gate Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(invQ.data?.rows ?? []).map(r => (
                    <tr key={r.id} className="border-b border-[#f1ece2]">
                      <td className="py-3 pr-3 font-semibold"><Link to={`/e/inventory_submissions/${r.id}`} className="underline">{r.submission_no}</Link></td>
                      <td className="py-3 pr-3">
                        <div className="font-medium text-ink">{r.building_name} · Unit {r.unit_no}</div>
                        <div className="text-[11px] text-muted">{r.property_type} · {r.purpose} · {aed(r.asking_price || r.asking_rent || 0)}</div>
                      </td>
                      <td className="py-3 pr-3">
                        <div>{r.owner_name} {r.owner_contact_verified ? '✓' : '⚠️'}</div>
                        <div className="text-[11px] text-muted">Permit: {r.trakheesi_permit_no || 'Missing'} (Exp: {r.permit_expiry_date || '—'})</div>
                      </td>
                      <td className="py-3 pr-3">
                        <Pill tone={r.conflict_status === 'Clear' || r.conflict_status === 'Merged Preserving Attribution' ? 'oasis' : 'dune'}>
                          {r.conflict_status}
                        </Pill>
                      </td>
                      <td className="py-3 pr-3"><Pill tone={r.status === 'Published to Stock' ? 'oasis' : 'champ'}>{r.status}</Pill></td>
                      <td className="py-3 pr-3">
                        <div className="flex flex-wrap gap-1.5">
                          {r.status === 'Duplicate / Conflict Hold' && (
                            <button
                              className="swk-btn swk-btn-ghost !py-1 !px-2.5 !text-xs"
                              onClick={() => runAction('Resolve duplicate conflict', () => post(`/api/inventory-submissions/${r.id}/resolve-conflict`, { resolution: 'merge', notes: 'Merged duplicate submission preserving original sourcing broker attribution.' }))}
                            >
                              Merge & Preserve Attribution
                            </button>
                          )}
                          {r.status === 'Submitted' && (
                            <button
                              className="swk-btn swk-btn-ghost !py-1 !px-2.5 !text-xs"
                              onClick={() => runAction('Step 1: Inventory verification', () => post(`/api/inventory-submissions/${r.id}/verify`, { stage: 'inventory' }))}
                            >
                              1. Verify Inventory
                            </button>
                          )}
                          {r.status === 'Inventory Verified' && (
                            <button
                              className="swk-btn swk-btn-ghost !py-1 !px-2.5 !text-xs"
                              onClick={() => runAction('Step 2: Compliance Trakheesi verification', () => post(`/api/inventory-submissions/${r.id}/verify`, { stage: 'compliance' }))}
                            >
                              2. Verify Trakheesi
                            </button>
                          )}
                          {r.status === 'Compliance Verified' && (
                            <button
                              className="swk-btn swk-btn-primary !py-1 !px-2.5 !text-xs"
                              onClick={() => runAction('Step 3: Second-person publish', () => post(`/api/inventory-submissions/${r.id}/publish`, {}))}
                            >
                              3. Approve & Publish
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="3.12 Verified Listing Mandates & Audited Price History" subtitle="Second-person approved mandates with Form A and Trakheesi validation">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12.5px]">
                <thead>
                  <tr className="border-b border-[#e7e1d4] text-muted">
                    <th className="py-2 pr-3">Mandate No.</th>
                    <th className="py-2 pr-3">Property</th>
                    <th className="py-2 pr-3">Form A & Trakheesi</th>
                    <th className="py-2 pr-3">Authorised Price</th>
                    <th className="py-2 pr-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(lmdQ.data?.rows ?? []).map(m => (
                    <tr key={m.id} className="border-b border-[#f1ece2]">
                      <td className="py-2.5 pr-3 font-semibold"><Link to={`/e/listing_mandates/${m.id}`} className="underline">{m.listing_mandate_no}</Link></td>
                      <td className="py-2.5 pr-3">{m._labels?.property_id || `#${m.property_id}`}</td>
                      <td className="py-2.5 pr-3">Form A: {m.form_a_ref} · Permit: {m.trakheesi_permit_no}</td>
                      <td className="py-2.5 pr-3 font-semibold">{aed(m.authorized_price || 0)}</td>
                      <td className="py-2.5 pr-3"><Pill tone="oasis">{m.status}</Pill></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* =====================================================================
          TAB 4: 3.08 & 4.03 DEVELOPER NOC & CLEARANCE CENTRE
         ===================================================================== */}
      {tab === 'noc' && (
        <Card
          title="3.08 / 4.03 Transaction-Specific Developer NOC & Clearance Centre"
          subtitle="Inventory verification never triggers an NOC. Requires a qualifying transaction, service-charge clearance, portal ref, and independent reviewer verification before unlocking closing."
          actions={<Link to="/e/developer_requests?new=1" className="swk-btn swk-btn-primary"><FileCheck2 size={14} /> New Developer NOC Request</Link>}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-[#e7e1d4] text-muted">
                  <th className="py-2 pr-3">NOC No.</th>
                  <th className="py-2 pr-3">Developer & Property</th>
                  <th className="py-2 pr-3">Portal Ref & Certificate</th>
                  <th className="py-2 pr-3">Closing Gate</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Workflow Actions</th>
                </tr>
              </thead>
              <tbody>
                {(nocQ.data?.rows ?? []).map(r => (
                  <tr key={r.id} className="border-b border-[#f1ece2]">
                    <td className="py-3 pr-3 font-semibold"><Link to={`/e/developer_requests/${r.id}`} className="underline">{r.request_no}</Link></td>
                    <td className="py-3 pr-3">
                      <div className="font-medium text-ink">{r._labels?.developer_id} · {r._labels?.property_id}</div>
                      <div className="text-[11px] text-muted">{r.transaction_type}</div>
                    </td>
                    <td className="py-3 pr-3">
                      <div>Portal: {r.portal_application_ref || 'Pending'}</div>
                      <div className="text-[11px] text-muted">NOC Cert: {r.issued_noc_no || 'Not uploaded'} (Exp: {r.expiry_date || '—'})</div>
                    </td>
                    <td className="py-3 pr-3">
                      <Pill tone={r.closing_stage_unlocked ? 'oasis' : 'dune'}>
                        {r.closing_stage_unlocked ? 'Unlocked' : 'Locked'}
                      </Pill>
                    </td>
                    <td className="py-3 pr-3"><Pill tone={r.status.includes('Verified') ? 'oasis' : r.status.includes('Held') ? 'dune' : 'champ'}>{r.status}</Pill></td>
                    <td className="py-3 pr-3">
                      <div className="flex flex-wrap gap-1.5">
                        {r.status === 'Draft' && (
                          <button
                            className="swk-btn swk-btn-ghost !py-1 !px-2.5 !text-xs"
                            onClick={() => runAction('Submit NOC to developer portal', () => post(`/api/developer-requests/${r.id}/submit`, { portalRef: r.portal_application_ref || `EMAAR-PORTAL-${r.id}`, senderEmail: 'noc@swkpropertiesuae.com' }))}
                          >
                            1. Submit to Portal
                          </button>
                        )}
                        {r.status === 'Submitted to Developer Portal' && (
                          <button
                            className="swk-btn swk-btn-ghost !py-1 !px-2.5 !text-xs"
                            onClick={() => runAction('Upload issued NOC certificate', () => post(`/api/developer-requests/${r.id}/upload-noc`, { nocNumber: `NOC-CERT-2026-${r.id}`, issueDate: '2026-10-26', expiryDate: '2027-01-26', docRef: 'VAULT-NOC-SIGNED.PDF' }))}
                          >
                            2. Upload NOC PDF
                          </button>
                        )}
                        {r.status === 'NOC Uploaded – Pending Independent Review' && (
                          <>
                            <button
                              className="swk-btn swk-btn-primary !py-1 !px-2.5 !text-xs"
                              onClick={() => runAction('Independent NOC verification', () => post(`/api/developer-requests/${r.id}/verify`, { decision: 'verify', notes: 'Independently verified developer portal reference, certificate number, and future expiry date.' }))}
                            >
                              3. Verify & Unlock Closing
                            </button>
                            <button
                              className="swk-btn swk-btn-ghost !py-1 !px-2.5 !text-xs"
                              onClick={() => runAction('Hold unverified NOC (7.05)', () => post(`/api/developer-requests/${r.id}/verify`, { decision: 'flag_fraud', notes: 'Held under 7.05: Unable to corroborate certificate number on developer portal.' }))}
                            >
                              Hold / Flag Fraud (7.05)
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* =====================================================================
          TAB 5: 3.13, 3.14, 4.04 & 4.05 ENTERPRISE TRANSACTIONS & 11 EXCEPTIONS
         ===================================================================== */}
      {tab === 'transactions' && (
        <Card
          title="3.13 / 3.14 / 4.04 / 4.05 Enterprise Transactions & 11 Exception Workflows"
          subtitle="Enforces KYC, RERA Forms, verified Developer NOC, external Title Deed/Oqood evidence, and Tax Invoice + Bank Receipt reconciliation before closing."
          actions={<Link to="/e/transactions?new=1" className="swk-btn swk-btn-primary"><Briefcase size={14} /> New Enterprise Transaction</Link>}
        >
          <div className="mb-4 p-3 rounded-2xl bg-[#f7f4ec] text-[12px] text-ink">
            <strong>Supported Secondary Sale Exception States (3.13):</strong> {SECONDARY_SALE_EXCEPTIONS.slice(1).join(' · ')}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-[#e7e1d4] text-muted">
                  <th className="py-2 pr-3">Transaction</th>
                  <th className="py-2 pr-3">Property & Value</th>
                  <th className="py-2 pr-3">Evidence Gates</th>
                  <th className="py-2 pr-3">Exception State (3.13)</th>
                  <th className="py-2 pr-3">Stage</th>
                  <th className="py-2 pr-3">Controls</th>
                </tr>
              </thead>
              <tbody>
                {(txnQ.data?.rows ?? []).map(t => (
                  <tr key={t.id} className="border-b border-[#f1ece2]">
                    <td className="py-3 pr-3 font-semibold"><Link to={`/e/transactions/${t.id}`} className="underline">{t.transaction_no}</Link></td>
                    <td className="py-3 pr-3">
                      <div className="font-medium text-ink">{t._labels?.property_id}</div>
                      <div className="text-[11px] text-muted">{t.transaction_category} · {aed(t.deal_value || 0)}</div>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex flex-wrap gap-1">
                        <Pill tone={t.kyc_cleared ? 'oasis' : 'grey'}>KYC</Pill>
                        <Pill tone={t.forms_completed ? 'oasis' : 'grey'}>Forms</Pill>
                        <Pill tone={t.noc_verified ? 'oasis' : 'grey'}>NOC</Pill>
                        <Pill tone={t.transfer_evidence_verified ? 'oasis' : 'grey'}>Deed/Oqood</Pill>
                        <Pill tone={t.financially_reconciled ? 'oasis' : 'grey'}>Reconciled</Pill>
                      </div>
                    </td>
                    <td className="py-3 pr-3">
                      <Pill tone={t.exception_state === 'None' || t.exception_resolved ? 'oasis' : 'dune'}>{t.exception_state}</Pill>
                    </td>
                    <td className="py-3 pr-3"><Pill tone={t.stage === 'Closed' ? 'oasis' : 'champ'}>{t.stage}</Pill></td>
                    <td className="py-3 pr-3">
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          className="swk-btn swk-btn-ghost !py-1 !px-2.5 !text-xs"
                          onClick={() => runAction('Advance stage', () => post(`/api/enterprise-transactions/${t.id}/advance`, { targetStage: 'MOU / Form F Signed', payload: { kyc_cleared: true, forms_completed: true } }))}
                        >
                          Advance to Form F
                        </button>
                        {t.exception_state === 'None' ? (
                          <button
                            className="swk-btn swk-btn-ghost !py-1 !px-2.5 !text-xs"
                            onClick={() => runAction('Raise exception', () => post(`/api/enterprise-transactions/${t.id}/raise-exception`, { exceptionType: '3. Deal involves a power of attorney (POA)', notes: 'Seller executing via Dubai Courts notarised POA; routed to Legal for verification.' }))}
                          >
                            Raise POA Exception
                          </button>
                        ) : !t.exception_resolved && (
                          <button
                            className="swk-btn swk-btn-primary !py-1 !px-2.5 !text-xs"
                            onClick={() => runAction('Resolve exception', () => post(`/api/enterprise-transactions/${t.id}/resolve-exception`, { resolutionNotes: 'Dubai Courts POA verified by Legal Counsel; valid within 2-year statutory window.', resumeStage: 'KYC & Compliance Cleared', patchFlags: { poa_verified_by_legal: true } }))}
                          >
                            Resolve Exception
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* =====================================================================
          TAB 6: 3.17, 3.32 & 4.08 COMMISSIONS, IBAN SWAP & 3-WAY PAYOUTS
         ===================================================================== */}
      {tab === 'commissions' && (
        <Card
          title="3.17 / 3.32 / 4.08 Commissions, IBAN Swap Freeze (7.06), Clawback (7.10) & 3-Way Payouts"
          subtitle="Tracks Earned, Invoiced, Collected, Payable, and Paid balances separately. Enforces Initiator ≠ Approver ≠ Payer and blocks self-approval or manager collusion (7.11)."
          actions={<Link to="/e/commission_entitlements?new=1" className="swk-btn swk-btn-primary"><Percent size={14} /> New Commission Entitlement</Link>}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-[#e7e1d4] text-muted">
                  <th className="py-2 pr-3">Entitlement</th>
                  <th className="py-2 pr-3">Broker & IBAN</th>
                  <th className="py-2 pr-3">Earned / Collected / Payable / Paid</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">3-Way Payout & Security Actions</th>
                </tr>
              </thead>
              <tbody>
                {(cenQ.data?.rows ?? []).map(c => (
                  <tr key={c.id} className="border-b border-[#f1ece2]">
                    <td className="py-3 pr-3 font-semibold"><Link to={`/e/commission_entitlements/${c.id}`} className="underline">{c.entitlement_no}</Link></td>
                    <td className="py-3 pr-3">
                      <div className="font-medium text-ink">{c._labels?.agent_id}</div>
                      <div className="text-[11px] font-mono text-muted">{c.payee_iban || 'No IBAN'} {c.iban_changed_before_payout ? '🔒 Frozen' : ''}</div>
                    </td>
                    <td className="py-3 pr-3 tabular-nums">
                      <div>Earned: <strong>{aed(c.earned_amount || 0)}</strong> · Collected: <strong>{aed(c.collected_amount || 0)}</strong></div>
                      <div className="text-[11px] text-muted">Payable: {aed(c.payable_amount || 0)} · Paid: {aed(c.paid_amount || 0)} · Clawback: {aed(c.clawback_amount || 0)}</div>
                    </td>
                    <td className="py-3 pr-3"><Pill tone={c.status === 'Paid & Reconciled' ? 'oasis' : c.status.includes('Frozen') ? 'dune' : 'champ'}>{c.status}</Pill></td>
                    <td className="py-3 pr-3">
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          className="swk-btn swk-btn-ghost !py-1 !px-2.5 !text-xs"
                          onClick={() => runAction('1. Initiate Payout', () => post(`/api/commission-entitlements/${c.id}/initiate`, {}))}
                        >
                          1. Initiate
                        </button>
                        <button
                          className="swk-btn swk-btn-ghost !py-1 !px-2.5 !text-xs"
                          onClick={() => runAction('2. Approve Payout', () => post(`/api/commission-entitlements/${c.id}/approve`, {}))}
                        >
                          2. Approve
                        </button>
                        <button
                          className="swk-btn swk-btn-primary !py-1 !px-2.5 !text-xs"
                          onClick={() => runAction('3. Execute Payout', () => post(`/api/commission-entitlements/${c.id}/execute`, { bankRef: `WPS-BATCH-${c.id}` }))}
                        >
                          3. Execute
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* =====================================================================
          TAB 7: 3.03, 3.04 & 4.06 VISA/PRO & BROKER AUTHORISATION
         ===================================================================== */}
      {tab === 'hr_pro' && (
        <div className="flex flex-col gap-6">
          <Card
            title="3.04 / 4.06 Broker Licensing & Regulated Duty Activation (7.08 / 10.6)"
            subtitle="Requires independent HR work-authorisation verification + Compliance RERA BRN validation before regulated brokerage duties are enabled."
            actions={<Link to="/e/agent_authorisations?new=1" className="swk-btn swk-btn-primary"><BadgeCheck size={14} /> New Broker Authorisation</Link>}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12.5px]">
                <thead>
                  <tr className="border-b border-[#e7e1d4] text-muted">
                    <th className="py-2 pr-3">Auth No.</th>
                    <th className="py-2 pr-3">Broker & BRN</th>
                    <th className="py-2 pr-3">RERA Expiry</th>
                    <th className="py-2 pr-3">Readiness Gates</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(autQ.data?.rows ?? []).map(a => (
                    <tr key={a.id} className="border-b border-[#f1ece2]">
                      <td className="py-2.5 pr-3 font-semibold"><Link to={`/e/agent_authorisations/${a.id}`} className="underline">{a.auth_no}</Link></td>
                      <td className="py-2.5 pr-3">{a._labels?.agent_id} · BRN: <strong>{a.brn_number}</strong></td>
                      <td className="py-2.5 pr-3">{a.rera_expiry_date}</td>
                      <td className="py-2.5 pr-3">
                        <div className="flex gap-1">
                          <Pill tone={a.work_auth_verified ? 'oasis' : 'grey'}>Work Auth</Pill>
                          <Pill tone={a.dld_exam_passed ? 'oasis' : 'grey'}>RERA Exam</Pill>
                          <Pill tone={a.aml_training_completed ? 'oasis' : 'grey'}>AML</Pill>
                        </div>
                      </td>
                      <td className="py-2.5 pr-3"><Pill tone={a.status === 'Authorised' ? 'oasis' : 'champ'}>{a.status}</Pill></td>
                      <td className="py-2.5 pr-3">
                        <div className="flex gap-1.5">
                          {a.status !== 'Authorised' && (
                            <>
                              <button
                                className="swk-btn swk-btn-ghost !py-1 !px-2.5 !text-xs"
                                onClick={() => runAction('HR Verify Work Auth', () => post(`/api/agent-authorisations/${a.id}/activate`, { stage: 'hr' }))}
                              >
                                1. HR Verify
                              </button>
                              <button
                                className="swk-btn swk-btn-primary !py-1 !px-2.5 !text-xs"
                                onClick={() => runAction('Compliance Activate Broker', () => post(`/api/agent-authorisations/${a.id}/activate`, { stage: 'compliance' }))}
                              >
                                2. Compliance Activate
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card
            title="3.03 Visa, Immigration & PRO Workflow (7.09)"
            subtitle="Separates PRO application submission, official government approval, and HR internal completion. Never assumes approval when delayed."
            actions={<Link to="/e/immigration_cases?new=1" className="swk-btn swk-btn-primary"><Plane size={14} /> New PRO Case</Link>}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12.5px]">
                <thead>
                  <tr className="border-b border-[#e7e1d4] text-muted">
                    <th className="py-2 pr-3">Case No.</th>
                    <th className="py-2 pr-3">Employee & Type</th>
                    <th className="py-2 pr-3">MOHRE / ICP Ref</th>
                    <th className="py-2 pr-3">Official Approval</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(proQ.data?.rows ?? []).map(p => (
                    <tr key={p.id} className="border-b border-[#f1ece2]">
                      <td className="py-2.5 pr-3 font-semibold"><Link to={`/e/immigration_cases/${p.id}`} className="underline">{p.case_no}</Link></td>
                      <td className="py-2.5 pr-3">{p._labels?.employee_id} · {p.case_type}</td>
                      <td className="py-2.5 pr-3">{p.application_ref || '—'}</td>
                      <td className="py-2.5 pr-3">{p.official_approval_ref || 'Pending'}</td>
                      <td className="py-2.5 pr-3"><Pill tone={p.status === 'Completed' || p.status === 'Officially Approved' ? 'oasis' : p.is_delayed ? 'dune' : 'champ'}>{p.status}</Pill></td>
                      <td className="py-2.5 pr-3">
                        <div className="flex gap-1.5">
                          <button
                            className="swk-btn swk-btn-ghost !py-1 !px-2.5 !text-xs"
                            onClick={() => runAction('Escalate Visa Delay (7.09)', () => post(`/api/immigration-cases/${p.id}/advance`, { step: 'escalate_delay' }))}
                          >
                            Escalate Delay (7.09)
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* =====================================================================
          TAB 8: 3.09, 3.10 & 4.07 WHATSAPP SUPERVISION & FIELD PRESENCE PRIVACY
         ===================================================================== */}
      {tab === 'supervision' && (
        <div className="flex flex-col gap-6">
          <Card
            title="3.09 / 4.07 Supervised Company WhatsApp & Diversion Detection (7.04 / 7.14)"
            subtitle="All supervisory views and ownership handoffs require a documented business reason and create an immutable Supervisor Access Log (Gate 10.5)."
            actions={<Link to="/e/communications?new=1" className="swk-btn swk-btn-primary"><MessageSquare size={14} /> Log Supervised Thread</Link>}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12.5px]">
                <thead>
                  <tr className="border-b border-[#e7e1d4] text-muted">
                    <th className="py-2 pr-3">Comm No.</th>
                    <th className="py-2 pr-3">Customer & Channel</th>
                    <th className="py-2 pr-3">Assigned Staff</th>
                    <th className="py-2 pr-3">Diversion Check (7.04)</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Supervisory Controls</th>
                  </tr>
                </thead>
                <tbody>
                  {(comQ.data?.rows ?? []).map(c => (
                    <tr key={c.id} className="border-b border-[#f1ece2]">
                      <td className="py-2.5 pr-3 font-semibold"><Link to={`/e/communications/${c.id}`} className="underline">{c.comm_no}</Link></td>
                      <td className="py-2.5 pr-3">{c.customer_phone} · {c.channel}</td>
                      <td className="py-2.5 pr-3">{c._labels?.assigned_user_id}</td>
                      <td className="py-2.5 pr-3">
                        <Pill tone={c.diversion_flag ? 'dune' : 'oasis'}>{c.diversion_flag ? 'Diversion Flagged' : 'Clean'}</Pill>
                      </td>
                      <td className="py-2.5 pr-3"><Pill tone="navy">{c.status}</Pill></td>
                      <td className="py-2.5 pr-3">
                        <div className="flex gap-1.5">
                          <button
                            className="swk-btn swk-btn-ghost !py-1 !px-2.5 !text-xs"
                            onClick={() => runAction('Supervisor Quality Review', () => post(`/api/communications/${c.id}/supervise`, { actionType: 'Supervisor Quality Review', reason: 'Routine SLA & commitment quality audit on company WABA line.' }))}
                          >
                            Log Supervised Audit
                          </button>
                          <button
                            className="swk-btn swk-btn-ghost !py-1 !px-2.5 !text-xs"
                            onClick={() => runAction('Outage Fallback (7.14)', () => post(`/api/communications/${c.id}/outage`, { fallbackNote: 'Meta Cloud API transient outage; queued retry and called client via recorded desk line.' }))}
                          >
                            Queue Outage Retry
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card
            title="3.10 Work-Hours Field Presence & Off-Hours Privacy Protection (7.03 / 10.5)"
            subtitle="Duty-based location sharing tied to scheduled appointments. Off-hours GPS lookup is automatically blocked and flagged for security review."
            actions={<Link to="/e/field_sessions?new=1" className="swk-btn swk-btn-primary"><MapPinned size={14} /> New Field Session</Link>}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12.5px]">
                <thead>
                  <tr className="border-b border-[#e7e1d4] text-muted">
                    <th className="py-2 pr-3">Session No.</th>
                    <th className="py-2 pr-3">Employee & Location</th>
                    <th className="py-2 pr-3">Scheduled Window</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Location Access Gate</th>
                  </tr>
                </thead>
                <tbody>
                  {(fldQ.data?.rows ?? []).map(f => (
                    <tr key={f.id} className="border-b border-[#f1ece2]">
                      <td className="py-2.5 pr-3 font-semibold"><Link to={`/e/field_sessions/${f.id}`} className="underline">{f.session_no}</Link></td>
                      <td className="py-2.5 pr-3">{f._labels?.employee_id} · {f.assigned_location}</td>
                      <td className="py-2.5 pr-3 tabular-nums">{String(f.scheduled_start || '').replace('T', ' ')} → {String(f.scheduled_end || '').replace('T', ' ')}</td>
                      <td className="py-2.5 pr-3"><Pill tone={f.status === 'Active (On Duty)' ? 'oasis' : 'champ'}>{f.status}</Pill></td>
                      <td className="py-2.5 pr-3">
                        <button
                          className="swk-btn swk-btn-ghost !py-1 !px-2.5 !text-xs"
                          onClick={() => runAction('Verify duty location', () => post(`/api/field-sessions/${f.id}/location`, {}))}
                        >
                          <Eye size={13} /> Check Duty Location (Logged)
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-[11.5px] text-muted">
              Supervisor Access Logs recorded: <strong>{supLogQ.data?.total ?? 0}</strong> · Location Access Privacy Logs recorded: <strong>{locLogQ.data?.total ?? 0}</strong>
            </div>
          </Card>
        </div>
      )}

      {/* =====================================================================
          TAB 9: 3.20, 3.29, 3.30, 3.33 & 4.09 RISK, DLP, COMPLAINTS & QA
         ===================================================================== */}
      {tab === 'risk_qa' && (
        <div className="flex flex-col gap-6">
          <Card
            title="3.20 / 3.29 / 3.30 / 4.09 Independent Compliance, Fraud, DLP & Client Complaint Register"
            subtitle="Automated flags are leads for independent human review only — never automatic proof of misconduct. Implicated managers are blocked from investigating or deciding."
            actions={<Link to="/e/compliance_cases?new=1" className="swk-btn swk-btn-primary"><ShieldAlert size={14} /> Open Compliance Case</Link>}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12.5px]">
                <thead>
                  <tr className="border-b border-[#e7e1d4] text-muted">
                    <th className="py-2 pr-3">Case No.</th>
                    <th className="py-2 pr-3">Headline & Category</th>
                    <th className="py-2 pr-3">Severity & Hold</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Independent Review & Appeal (7.16)</th>
                  </tr>
                </thead>
                <tbody>
                  {(casQ.data?.rows ?? []).map(c => (
                    <tr key={c.id} className="border-b border-[#f1ece2]">
                      <td className="py-3 pr-3 font-semibold"><Link to={`/e/compliance_cases/${c.id}`} className="underline">{c.case_no}</Link></td>
                      <td className="py-3 pr-3">
                        <div className="font-medium text-ink">{c.title}</div>
                        <div className="text-[11px] text-muted">{c.case_category} · Source: {c.source_type}</div>
                      </td>
                      <td className="py-3 pr-3">
                        <Pill tone={c.severity === 'Critical' || c.severity === 'High' ? 'dune' : 'champ'}>{c.severity}</Pill>
                        {c.legal_hold ? <span className="ml-1.5 text-[11px] font-semibold text-[#9e3b24]">🔒 Legal Hold</span> : null}
                      </td>
                      <td className="py-3 pr-3"><Pill tone={c.status.includes('Cleared') ? 'oasis' : 'navy'}>{c.status}</Pill></td>
                      <td className="py-3 pr-3">
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            className="swk-btn swk-btn-ghost !py-1 !px-2.5 !text-xs"
                            onClick={() => runAction('Decide case', () => post(`/api/compliance-cases/${c.id}/decide`, { findings: 'Independent review of call recordings, WABA logs and DLD documents completed.', remedyDecision: 'Compliance verified; record retained under standard audit schedule.' }))}
                          >
                            Record Decision
                          </button>
                          <button
                            className="swk-btn swk-btn-ghost !py-1 !px-2.5 !text-xs"
                            onClick={() => runAction('Submit appeal (7.16)', () => post(`/api/compliance-cases/${c.id}/appeal`, { appealNotes: 'Submitting counter-evidence: client call was conducted on approved office landline.' }))}
                          >
                            Appeal Flag (7.16)
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card
            title="3.33 Quality Assurance & Broker Right to Challenge"
            subtitle="Structured scoring of sales conversations and listings with broker challenge & independent manager sign-off"
            actions={<Link to="/e/qa_reviews?new=1" className="swk-btn swk-btn-primary"><Star size={14} /> New QA Review</Link>}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12.5px]">
                <thead>
                  <tr className="border-b border-[#e7e1d4] text-muted">
                    <th className="py-2 pr-3">QA No.</th>
                    <th className="py-2 pr-3">Broker & Channel</th>
                    <th className="py-2 pr-3">Scores (Accuracy / Etiquette / Overall)</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Challenge Controls</th>
                  </tr>
                </thead>
                <tbody>
                  {(qaQ.data?.rows ?? []).map(q => (
                    <tr key={q.id} className="border-b border-[#f1ece2]">
                      <td className="py-2.5 pr-3 font-semibold"><Link to={`/e/qa_reviews/${q.id}`} className="underline">{q.qa_no}</Link></td>
                      <td className="py-2.5 pr-3">{q._labels?.agent_id} · {q.channel}</td>
                      <td className="py-2.5 pr-3 tabular-nums">{q.accuracy_score}% / {q.etiquette_score}% / <strong>{q.overall_score}%</strong></td>
                      <td className="py-2.5 pr-3"><Pill tone="oasis">{q.status}</Pill></td>
                      <td className="py-2.5 pr-3">
                        {!q.broker_challenged && (
                          <button
                            className="swk-btn swk-btn-ghost !py-1 !px-2.5 !text-xs"
                            onClick={() => runAction('Challenge QA Review', () => post(`/api/qa-reviews/${q.id}/challenge`, { challengeReason: 'Requesting review of follow-up timestamp against client timezone request.' }))}
                          >
                            Broker Challenge
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* =====================================================================
          TAB 10: 3.01, 3.25, 3.26, 3.27, 3.35 & 4.10 APPROVALS, SEPARATION & DR
         ===================================================================== */}
      {tab === 'governance' && (
        <div className="flex flex-col gap-6">
          <Card
            title="3.27 Universal Task & Four-Eyes Approval Engine"
            subtitle="Enforces maker-checker separation (requester ≠ step 1 approver ≠ step 2 four-eyes approver) and delegated authority rules."
            actions={<Link to="/e/universal_approvals?new=1" className="swk-btn swk-btn-primary"><CheckCheck size={14} /> New Approval Request</Link>}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12.5px]">
                <thead>
                  <tr className="border-b border-[#e7e1d4] text-muted">
                    <th className="py-2 pr-3">Approval No.</th>
                    <th className="py-2 pr-3">Title & Workflow</th>
                    <th className="py-2 pr-3">Risk & Mode</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Decision Controls</th>
                  </tr>
                </thead>
                <tbody>
                  {(aprQ.data?.rows ?? []).map(a => (
                    <tr key={a.id} className="border-b border-[#f1ece2]">
                      <td className="py-2.5 pr-3 font-semibold"><Link to={`/e/universal_approvals/${a.id}`} className="underline">{a.approval_no}</Link></td>
                      <td className="py-2.5 pr-3">
                        <div className="font-medium text-ink">{a.title}</div>
                        <div className="text-[11px] text-muted">{a.workflow_type}</div>
                      </td>
                      <td className="py-2.5 pr-3"><Pill tone="champ">{a.risk_level}</Pill></td>
                      <td className="py-2.5 pr-3"><Pill tone={a.status === 'Approved' ? 'oasis' : 'navy'}>{a.status}</Pill></td>
                      <td className="py-2.5 pr-3">
                        {a.status !== 'Approved' && a.status !== 'Rejected' && (
                          <div className="flex gap-1.5">
                            <button
                              className="swk-btn swk-btn-primary !py-1 !px-2.5 !text-xs"
                              onClick={() => runAction(`Approve ${a.approval_no}`, () => post(`/api/universal-approvals/${a.id}/decide`, { decision: 'approve', comments: 'Verified supporting mandate and budget allocation.' }))}
                            >
                              Approve Step
                            </button>
                            <button
                              className="swk-btn swk-btn-ghost !py-1 !px-2.5 !text-xs"
                              onClick={() => runAction(`Return ${a.approval_no}`, () => post(`/api/universal-approvals/${a.id}/decide`, { decision: 'return', comments: 'Please attach updated comparative quote.' }))}
                            >
                              Return
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card
              title="3.26 / 4.10 HR Lifecycle & Emergency Separation"
              subtitle="Revokes sessions, disables accounts, preserves customer history, and reassigns leads, WhatsApp, viewings & NOC tasks"
              actions={<Link to="/e/hr_lifecycle_cases?new=1" className="swk-btn swk-btn-ghost !py-1 !px-2.5 !text-xs"><UserCheck size={13} /> New Case</Link>}
            >
              <div className="space-y-2.5 text-[12.5px]">
                {(hrlQ.data?.rows ?? []).map(h => (
                  <div key={h.id} className="p-3 rounded-xl bg-[#f7f4ec] flex items-center justify-between gap-2">
                    <div>
                      <Link to={`/e/hr_lifecycle_cases/${h.id}`} className="font-semibold underline">{h.lifecycle_no}</Link> · {h.candidate_or_subject_name}
                      <div className="text-[11px] text-muted">{h.case_type} · Status: {h.status}</div>
                    </div>
                    <Pill tone={h.accounts_disabled ? 'dune' : 'oasis'}>{h.status}</Pill>
                  </div>
                ))}
              </div>
            </Card>

            <Card
              title="3.35 Infrastructure, Backup Restore & DR Drills (7.15)"
              subtitle="Verified RTO/RPO backup restoration and failover exercises"
              actions={<Link to="/e/dr_exercises?new=1" className="swk-btn swk-btn-ghost !py-1 !px-2.5 !text-xs"><DatabaseBackup size={13} /> Log DR Drill</Link>}
            >
              <div className="space-y-2.5 text-[12.5px]">
                {(drxQ.data?.rows ?? []).map(d => (
                  <div key={d.id} className="p-3 rounded-xl bg-[#f7f4ec] flex items-center justify-between gap-2">
                    <div>
                      <Link to={`/e/dr_exercises/${d.id}`} className="font-semibold underline">{d.exercise_no}</Link> · {d.title}
                      <div className="text-[11px] text-muted">RTO: {d.actual_rto_minutes}/{d.target_rto_minutes}m · RPO: {d.actual_rpo_minutes}/{d.target_rpo_minutes}m · {d.records_verified_count} records verified</div>
                    </div>
                    <Pill tone="oasis">{d.status}</Pill>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
