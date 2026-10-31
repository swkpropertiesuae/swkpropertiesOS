import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Activity, ArrowUpRight, BadgeCheck, Banknote, Briefcase, Building2, CheckCheck,
  ClipboardCheck, Clock, DatabaseBackup, Eye, FileCheck2, Layers, MapPinned,
  MessageSquare, Percent, Plane, RefreshCw, ShieldAlert, ShieldCheck, Star, UserCheck,
} from 'lucide-react'
import { get, post } from '../../lib/api'
import { Card, ModuleHeader, Pill, Reveal, Segmented, StatTile, SWK, aed } from '../../swk/ui'
import { SECONDARY_SALE_EXCEPTIONS } from '@shared/entities/enterprise'

type Row = Record<string, any>
type ListRes = { rows: Row[]; total: number }

const TABS = [
  { value: 'command', label: 'Company Overview' },
  { value: 'accountability', label: 'Daily Work Reports' },
  { value: 'inventory', label: 'New Properties & Permits' },
  { value: 'noc', label: 'Developer NOCs' },
  { value: 'transactions', label: 'Sales & Transfers' },
  { value: 'commissions', label: 'Commission Payouts' },
  { value: 'hr_pro', label: 'Visas & Agent Cards' },
  { value: 'supervision', label: 'WhatsApp & Field Visits' },
  { value: 'risk_qa', label: 'Compliance & Quality' },
  { value: 'governance', label: 'Approvals & Staff Handover' },
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
      setBanner({ tone: 'ok', text: `${label} completed and saved to the activity log.` })
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
        eyebrow="SWK Properties · Operations & Approvals"
        icon={<ShieldCheck size={22} />}
        title="Company Operations Centre"
        subtitle="Manage daily staff reports, property approvals, developer NOCs, sales progress, commission payouts, and team compliance in one simple place."
        actions={
          <>
            <Link to="/e/audit_events" className="swk-btn swk-btn-ghost"><Activity size={15} /> Activity Log</Link>
            <button className="swk-btn swk-btn-primary" onClick={() => qc.invalidateQueries()}><RefreshCw size={15} /> Refresh Data</button>
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
        <StatTile tone="navy" label="Active Modules" value={cmd?.modules_active ?? 35} icon={<Layers size={16} />} hint="All company tools live" />
        <StatTile label="Active Sales Pipeline" value={exec.active_pipeline_value ?? 0} format={v => aed(v, { compact: true })} icon={<Briefcase size={16} />} hint={`${sales.enterprise_transactions_open ?? 0} active sales`} to="/e/transactions" />
        <StatTile tone="champ" label="Collected Revenue" value={exec.collected_revenue_total ?? 0} format={v => aed(v, { compact: true })} icon={<Banknote size={16} />} hint="Confirmed bank receipts" to="/e/receipts" />
        <StatTile label="Approved Listings" value={inv.verified_mandates ?? 0} icon={<Building2 size={16} />} hint={`${inv.duplicate_conflicts_held ?? 0} duplicates held`} to="/e/listing_mandates" />
        <StatTile label="Approved NOCs" value={noc.nocs_verified_unlocked ?? 0} icon={<FileCheck2 size={16} />} hint={`${noc.nocs_fraud_or_unverified_held ?? 0} waiting for review`} to="/e/developer_requests" />
        <StatTile tone="champ" label="Pending Approvals" value={exec.pending_universal_approvals ?? 0} icon={<CheckCheck size={16} />} hint="Waiting for manager sign-off" to="/e/universal_approvals" />
        <StatTile label="Open Compliance Cases" value={exec.open_compliance_cases ?? 0} icon={<ShieldAlert size={16} />} hint="Needs compliance review" to="/e/compliance_cases" />
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
          TAB 1: COMPANY OVERVIEW
         ===================================================================== */}
      {tab === 'command' && (
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="How SWK Properties Works" subtitle="Simple rules built into every screen">
              <ul className="text-[12.5px] space-y-2 text-ink">
                <li><strong>1. One Clean Record:</strong> Every client, property, and deal lives in one place with full history.</li>
                <li><strong>2. Verified Documents First:</strong> Deals and listings only move forward when permits and papers are attached.</li>
                <li><strong>3. Two-Person Sign-Off:</strong> The person who submits a request cannot approve their own request.</li>
                <li><strong>4. Clear Connection Status:</strong> Shows clearly when WhatsApp, Email, and Voice are live or in test mode.</li>
                <li><strong>5. Fair Human Review:</strong> System alerts always go to a real person for review and can be appealed.</li>
                <li><strong>6. Work-Hours Privacy:</strong> Field visit check-ins only work during scheduled appointments.</li>
                <li><strong>7. Confirmed Payments:</strong> Commissions are paid only after customer invoices and bank receipts match.</li>
              </ul>
            </Card>

            <Card title="Department Summary" subtitle="Click any box to open the full list">
              <div className="grid grid-cols-2 gap-2.5 text-[12.5px]">
                <Link to="/e/daily_reports" className="p-2.5 rounded-xl bg-[#f7f4ec] hover:bg-[#efe9dc]">
                  <div className="text-muted">Daily Work Reports</div>
                  <div className="font-semibold text-[15px] text-ink">{hr.daily_reports_submitted_today ?? 0} submitted today</div>
                </Link>
                <Link to="/e/agent_authorisations" className="p-2.5 rounded-xl bg-[#f7f4ec] hover:bg-[#efe9dc]">
                  <div className="text-muted">Licensed Agents</div>
                  <div className="font-semibold text-[15px] text-ink">{hr.authorised_brokers ?? 0} active ({hr.expired_broker_credentials ?? 0} expired)</div>
                </Link>
                <Link to="/e/immigration_cases" className="p-2.5 rounded-xl bg-[#f7f4ec] hover:bg-[#efe9dc]">
                  <div className="text-muted">Staff Visas</div>
                  <div className="font-semibold text-[15px] text-ink">{hr.open_immigration_cases ?? 0} open ({hr.delayed_immigration_cases ?? 0} delayed)</div>
                </Link>
                <Link to="/e/commission_entitlements" className="p-2.5 rounded-xl bg-[#f7f4ec] hover:bg-[#efe9dc]">
                  <div className="text-muted">Ready to Pay</div>
                  <div className="font-semibold text-[15px] text-ink">{aed(fin.commission_payable_total ?? 0, { compact: true })}</div>
                </Link>
                <Link to="/e/communications" className="p-2.5 rounded-xl bg-[#f7f4ec] hover:bg-[#efe9dc]">
                  <div className="text-muted">WhatsApp Alerts</div>
                  <div className="font-semibold text-[15px] text-ink">{sales.whatsapp_diversion_flags ?? 0} flagged chats</div>
                </Link>
                <Link to="/e/dr_exercises" className="p-2.5 rounded-xl bg-[#f7f4ec] hover:bg-[#efe9dc]">
                  <div className="text-muted">Backup Checks</div>
                  <div className="font-semibold text-[15px] text-ink">{comp.verified_dr_exercises ?? 0} verified</div>
                </Link>
              </div>
            </Card>

            <Card title="Connected Channels" subtitle="Live connection status for messaging, phone, and portals">
              <div className="flex flex-col gap-2 text-[12.5px]">
                {[
                  { name: 'Company WhatsApp Business', mode: cmd?.integration_honesty?.whatsapp_mode || 'Test Mode', route: '/whatsapp' },
                  { name: 'Company Email Inbox', mode: cmd?.integration_honesty?.email_mode || 'Test Mode', route: '/email' },
                  { name: 'Phone Receptionist', mode: cmd?.integration_honesty?.voice_receptionist_enabled ? 'Live Active' : 'Standby / Manual', route: '/e/voice_calls' },
                  { name: 'Smart Assistant', mode: cmd?.integration_honesty?.ai_concierge_mode || 'Approval Required', route: '/ai' },
                  { name: 'Property Portals & Permits', mode: 'Permit Check Active', route: '/listings' },
                ].map(item => (
                  <Link key={item.name} to={item.route} className="flex items-center justify-between p-2 rounded-xl bg-[#f7f4ec] hover:bg-[#efe9dc]">
                    <span className="font-medium text-ink">{item.name}</span>
                    <Pill tone={item.mode.includes('Live') ? 'oasis' : 'champ'}>{item.mode}</Pill>
                  </Link>
                ))}
              </div>
            </Card>
          </div>

          <Card title="All Company Workspaces" subtitle="Quick links to every workspace across the company">
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {(cmd?.module_catalogue ?? []).map((m: any) => (
                <Link
                  key={m.code}
                  to={`/e/${m.entity}`}
                  className="p-3 rounded-2xl border border-[#e7e1d4] bg-white hover:border-[#c8a96b] transition flex flex-col justify-between gap-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#f3ead8] text-[#6e521c]">Module {m.code}</span>
                    <Pill tone="oasis">{m.status}</Pill>
                  </div>
                  <div className="font-semibold text-[13px] text-ink leading-snug">{m.name}</div>
                  <div className="text-[11px] text-muted flex items-center justify-between">
                    <span>Open workspace</span>
                    <ArrowUpRight size={13} />
                  </div>
                </Link>
              ))}
            </div>
          </Card>

          <Card title="Recent Activity Log" subtitle="Automatic log of recent approvals, updates, and reviews">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12.5px]">
                <thead>
                  <tr className="border-b border-[#e7e1d4] text-muted">
                    <th className="py-2 pr-3">Time</th>
                    <th className="py-2 pr-3">Area</th>
                    <th className="py-2 pr-3">Action</th>
                    <th className="py-2 pr-3">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {(audQ.data?.rows ?? []).slice(0, 12).map(a => (
                    <tr key={a.id} className="border-b border-[#f1ece2]">
                      <td className="py-2 pr-3 tabular-nums text-muted">{String(a.occurred_at || '').slice(0, 19).replace('T', ' ')}</td>
                      <td className="py-2 pr-3"><Pill tone="navy">{a.module_code}</Pill></td>
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
          TAB 2: DAILY WORK REPORTS
         ===================================================================== */}
      {tab === 'accountability' && (
        <Card
          title="Daily Staff Work Reports"
          subtitle="Automatically counts calls, tasks, viewings, and offers from the system alongside each team member's daily summary."
          actions={
            <div className="flex gap-2">
              <button
                className="swk-btn swk-btn-ghost"
                onClick={() => runAction('Missing report check', () => post('/api/daily-reports/scan-missing', {}))}
              >
                <Clock size={14} /> Check Missing Reports
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
                  <th className="py-2 pr-3">Staff Member</th>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Activity Recorded by System</th>
                  <th className="py-2 pr-3">Staff Summary & Next Steps</th>
                  <th className="py-2 pr-3">Status</th>
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
                      <div className="text-[11px] text-muted mt-0.5">Tomorrow: {r.next_day_priorities || '—'}</div>
                    </td>
                    <td className="py-3 pr-3">
                      <Pill tone={r.status === 'Approved by Manager' ? 'oasis' : r.status === 'Submitted (Frozen)' ? 'champ' : 'grey'}>{r.status}</Pill>
                      <div className="text-[11px] text-muted mt-1">Version {r.revision_no ?? 1}</div>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex flex-wrap gap-1.5">
                        {(r.status === 'Draft' || r.status === 'Returned for Clarification') && (
                          <button
                            className="swk-btn swk-btn-primary !py-1 !px-2.5 !text-xs"
                            onClick={() => runAction(`Submit ${r.report_no}`, () => post(`/api/daily-reports/${r.id}/submit`, {}))}
                          >
                            Submit Report
                          </button>
                        )}
                        {r.status === 'Submitted (Frozen)' && (
                          <>
                            <button
                              className="swk-btn swk-btn-primary !py-1 !px-2.5 !text-xs"
                              onClick={() => runAction(`Approve ${r.report_no}`, () => post(`/api/daily-reports/${r.id}/review`, { decision: 'approve', feedback: 'Verified daily summary against activity numbers.' }))}
                            >
                              Approve
                            </button>
                            <button
                              className="swk-btn swk-btn-ghost !py-1 !px-2.5 !text-xs"
                              onClick={() => runAction(`Return ${r.report_no}`, () => post(`/api/daily-reports/${r.id}/review`, { decision: 'return', feedback: 'Please add details for afternoon viewings.' }))}
                            >
                              Ask for Update
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
          TAB 3: NEW PROPERTIES & PERMITS
         ===================================================================== */}
      {tab === 'inventory' && (
        <div className="flex flex-col gap-6">
          <Card
            title="New Property Submissions"
            subtitle="Checks for duplicate units, verifies owner documents and Trakheesi permits, and requires manager sign-off before going live."
            actions={<Link to="/e/inventory_submissions?new=1" className="swk-btn swk-btn-primary"><Building2 size={14} /> Add New Property</Link>}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12.5px]">
                <thead>
                  <tr className="border-b border-[#e7e1d4] text-muted">
                    <th className="py-2 pr-3">Ref No.</th>
                    <th className="py-2 pr-3">Building & Unit</th>
                    <th className="py-2 pr-3">Owner & Permit</th>
                    <th className="py-2 pr-3">Duplicate Check</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Next Step</th>
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
                              onClick={() => runAction('Merge duplicate unit', () => post(`/api/inventory-submissions/${r.id}/resolve-conflict`, { resolution: 'merge', notes: 'Merged duplicate unit while keeping original agent credit.' }))}
                            >
                              Merge & Keep Agent Credit
                            </button>
                          )}
                          {r.status === 'Submitted' && (
                            <button
                              className="swk-btn swk-btn-ghost !py-1 !px-2.5 !text-xs"
                              onClick={() => runAction('Step 1: Property check', () => post(`/api/inventory-submissions/${r.id}/verify`, { stage: 'inventory' }))}
                            >
                              1. Check Property Details
                            </button>
                          )}
                          {r.status === 'Inventory Verified' && (
                            <button
                              className="swk-btn swk-btn-ghost !py-1 !px-2.5 !text-xs"
                              onClick={() => runAction('Step 2: Permit check', () => post(`/api/inventory-submissions/${r.id}/verify`, { stage: 'compliance' }))}
                            >
                              2. Check Permit
                            </button>
                          )}
                          {r.status === 'Compliance Verified' && (
                            <button
                              className="swk-btn swk-btn-primary !py-1 !px-2.5 !text-xs"
                              onClick={() => runAction('Step 3: Approve & publish', () => post(`/api/inventory-submissions/${r.id}/publish`, {}))}
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

          <Card title="Approved Owner Agreements & Permits" subtitle="Properties with verified Form A agreements and active advertising permits">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12.5px]">
                <thead>
                  <tr className="border-b border-[#e7e1d4] text-muted">
                    <th className="py-2 pr-3">Agreement No.</th>
                    <th className="py-2 pr-3">Property</th>
                    <th className="py-2 pr-3">Form A & Permit</th>
                    <th className="py-2 pr-3">Approved Price</th>
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
          TAB 4: DEVELOPER NOCs
         ===================================================================== */}
      {tab === 'noc' && (
        <Card
          title="Developer NOC Requests"
          subtitle="Track developer NOC applications, service-charge clearances, and uploaded NOC certificates required before property transfer."
          actions={<Link to="/e/developer_requests?new=1" className="swk-btn swk-btn-primary"><FileCheck2 size={14} /> New NOC Request</Link>}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-[#e7e1d4] text-muted">
                  <th className="py-2 pr-3">Request No.</th>
                  <th className="py-2 pr-3">Developer & Property</th>
                  <th className="py-2 pr-3">Application & Certificate</th>
                  <th className="py-2 pr-3">Ready for Transfer</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Actions</th>
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
                      <div>Portal Ref: {r.portal_application_ref || 'Pending'}</div>
                      <div className="text-[11px] text-muted">Certificate: {r.issued_noc_no || 'Not uploaded'} (Exp: {r.expiry_date || '—'})</div>
                    </td>
                    <td className="py-3 pr-3">
                      <Pill tone={r.closing_stage_unlocked ? 'oasis' : 'dune'}>
                        {r.closing_stage_unlocked ? 'Ready' : 'Waiting for NOC'}
                      </Pill>
                    </td>
                    <td className="py-3 pr-3"><Pill tone={r.status.includes('Verified') ? 'oasis' : r.status.includes('Held') ? 'dune' : 'champ'}>{r.status}</Pill></td>
                    <td className="py-3 pr-3">
                      <div className="flex flex-wrap gap-1.5">
                        {r.status === 'Draft' && (
                          <button
                            className="swk-btn swk-btn-ghost !py-1 !px-2.5 !text-xs"
                            onClick={() => runAction('Submit NOC application', () => post(`/api/developer-requests/${r.id}/submit`, { portalRef: r.portal_application_ref || `EMAAR-PORTAL-${r.id}`, senderEmail: 'noc@swkpropertiesuae.com' }))}
                          >
                            1. Submit to Developer
                          </button>
                        )}
                        {r.status === 'Submitted to Developer Portal' && (
                          <button
                            className="swk-btn swk-btn-ghost !py-1 !px-2.5 !text-xs"
                            onClick={() => runAction('Attach NOC certificate', () => post(`/api/developer-requests/${r.id}/upload-noc`, { nocNumber: `NOC-CERT-2026-${r.id}`, issueDate: '2026-10-26', expiryDate: '2027-01-26', docRef: 'VAULT-NOC-SIGNED.PDF' }))}
                          >
                            2. Attach NOC Certificate
                          </button>
                        )}
                        {r.status === 'NOC Uploaded – Pending Independent Review' && (
                          <>
                            <button
                              className="swk-btn swk-btn-primary !py-1 !px-2.5 !text-xs"
                              onClick={() => runAction('Approve NOC certificate', () => post(`/api/developer-requests/${r.id}/verify`, { decision: 'verify', notes: 'Checked developer portal reference, certificate number, and expiry date.' }))}
                            >
                              3. Approve NOC
                            </button>
                            <button
                              className="swk-btn swk-btn-ghost !py-1 !px-2.5 !text-xs"
                              onClick={() => runAction('Hold NOC for review', () => post(`/api/developer-requests/${r.id}/verify`, { decision: 'flag_fraud', notes: 'Held: Certificate number could not be confirmed on developer portal.' }))}
                            >
                              Hold for Check
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
          TAB 5: SALES & TRANSFERS
         ===================================================================== */}
      {tab === 'transactions' && (
        <Card
          title="Property Sales & Transfers"
          subtitle="Track every property sale from offer to transfer, including ID checks, signed agreements, developer NOCs, and special cases like Power of Attorney or mortgages."
          actions={<Link to="/e/transactions?new=1" className="swk-btn swk-btn-primary"><Briefcase size={14} /> New Property Sale</Link>}
        >
          <div className="mb-4 p-3 rounded-2xl bg-[#f7f4ec] text-[12px] text-ink">
            <strong>Supported Special Cases:</strong> {SECONDARY_SALE_EXCEPTIONS.slice(1).join(' · ')}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-[#e7e1d4] text-muted">
                  <th className="py-2 pr-3">Sale No.</th>
                  <th className="py-2 pr-3">Property & Value</th>
                  <th className="py-2 pr-3">Completed Checks</th>
                  <th className="py-2 pr-3">Special Case</th>
                  <th className="py-2 pr-3">Current Stage</th>
                  <th className="py-2 pr-3">Actions</th>
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
                        <Pill tone={t.kyc_cleared ? 'oasis' : 'grey'}>ID Check</Pill>
                        <Pill tone={t.forms_completed ? 'oasis' : 'grey'}>Forms</Pill>
                        <Pill tone={t.noc_verified ? 'oasis' : 'grey'}>NOC</Pill>
                        <Pill tone={t.transfer_evidence_verified ? 'oasis' : 'grey'}>Title Deed</Pill>
                        <Pill tone={t.financially_reconciled ? 'oasis' : 'grey'}>Paid</Pill>
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
                          onClick={() => runAction('Move to Form F Signed', () => post(`/api/enterprise-transactions/${t.id}/advance`, { targetStage: 'MOU / Form F Signed', payload: { kyc_cleared: true, forms_completed: true } }))}
                        >
                          Mark Form F Signed
                        </button>
                        {t.exception_state === 'None' ? (
                          <button
                            className="swk-btn swk-btn-ghost !py-1 !px-2.5 !text-xs"
                            onClick={() => runAction('Flag Power of Attorney check', () => post(`/api/enterprise-transactions/${t.id}/raise-exception`, { exceptionType: '3. Deal involves a power of attorney (POA)', notes: 'Seller signing with Power of Attorney; sent to Legal for review.' }))}
                          >
                            Flag POA Check
                          </button>
                        ) : !t.exception_resolved && (
                          <button
                            className="swk-btn swk-btn-primary !py-1 !px-2.5 !text-xs"
                            onClick={() => runAction('Clear special case', () => post(`/api/enterprise-transactions/${t.id}/resolve-exception`, { resolutionNotes: 'Power of Attorney verified by Legal team.', resumeStage: 'KYC & Compliance Cleared', patchFlags: { poa_verified_by_legal: true } }))}
                          >
                            Clear Special Case
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
          TAB 6: COMMISSION PAYOUTS
         ===================================================================== */}
      {tab === 'commissions' && (
        <Card
          title="Agent Commission Payouts"
          subtitle="Shows earned, collected, and paid commissions clearly. Protects against last-minute bank account changes and requires three separate steps (Request, Approve, Pay)."
          actions={<Link to="/e/commission_entitlements?new=1" className="swk-btn swk-btn-primary"><Percent size={14} /> New Commission Record</Link>}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-[#e7e1d4] text-muted">
                  <th className="py-2 pr-3">Ref No.</th>
                  <th className="py-2 pr-3">Agent & Bank IBAN</th>
                  <th className="py-2 pr-3">Amounts (Earned / Collected / Paid)</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Payout Steps</th>
                </tr>
              </thead>
              <tbody>
                {(cenQ.data?.rows ?? []).map(c => (
                  <tr key={c.id} className="border-b border-[#f1ece2]">
                    <td className="py-3 pr-3 font-semibold"><Link to={`/e/commission_entitlements/${c.id}`} className="underline">{c.entitlement_no}</Link></td>
                    <td className="py-3 pr-3">
                      <div className="font-medium text-ink">{c._labels?.agent_id}</div>
                      <div className="text-[11px] font-mono text-muted">{c.payee_iban || 'No IBAN'} {c.iban_changed_before_payout ? '🔒 Bank Change Hold' : ''}</div>
                    </td>
                    <td className="py-3 pr-3 tabular-nums">
                      <div>Earned: <strong>{aed(c.earned_amount || 0)}</strong> · Collected: <strong>{aed(c.collected_amount || 0)}</strong></div>
                      <div className="text-[11px] text-muted">Ready to Pay: {aed(c.payable_amount || 0)} · Paid: {aed(c.paid_amount || 0)}</div>
                    </td>
                    <td className="py-3 pr-3"><Pill tone={c.status === 'Paid & Reconciled' ? 'oasis' : c.status.includes('Frozen') ? 'dune' : 'champ'}>{c.status}</Pill></td>
                    <td className="py-3 pr-3">
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          className="swk-btn swk-btn-ghost !py-1 !px-2.5 !text-xs"
                          onClick={() => runAction('Step 1: Request Payout', () => post(`/api/commission-entitlements/${c.id}/initiate`, {}))}
                        >
                          1. Request Payout
                        </button>
                        <button
                          className="swk-btn swk-btn-ghost !py-1 !px-2.5 !text-xs"
                          onClick={() => runAction('Step 2: Approve Payout', () => post(`/api/commission-entitlements/${c.id}/approve`, {}))}
                        >
                          2. Manager Approve
                        </button>
                        <button
                          className="swk-btn swk-btn-primary !py-1 !px-2.5 !text-xs"
                          onClick={() => runAction('Step 3: Send Payment', () => post(`/api/commission-entitlements/${c.id}/execute`, { bankRef: `WPS-BATCH-${c.id}` }))}
                        >
                          3. Mark Paid
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
          TAB 7: VISAS & AGENT CARDS
         ===================================================================== */}
      {tab === 'hr_pro' && (
        <div className="flex flex-col gap-6">
          <Card
            title="Agent RERA Cards & Approvals"
            subtitle="Checks work visa status, RERA exam pass, and AML training before activating an agent for property deals."
            actions={<Link to="/e/agent_authorisations?new=1" className="swk-btn swk-btn-primary"><BadgeCheck size={14} /> New Agent Approval</Link>}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12.5px]">
                <thead>
                  <tr className="border-b border-[#e7e1d4] text-muted">
                    <th className="py-2 pr-3">Ref No.</th>
                    <th className="py-2 pr-3">Agent & BRN</th>
                    <th className="py-2 pr-3">Card Expiry</th>
                    <th className="py-2 pr-3">Completed Checks</th>
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
                          <Pill tone={a.work_auth_verified ? 'oasis' : 'grey'}>Work Visa</Pill>
                          <Pill tone={a.dld_exam_passed ? 'oasis' : 'grey'}>RERA Exam</Pill>
                          <Pill tone={a.aml_training_completed ? 'oasis' : 'grey'}>AML Training</Pill>
                        </div>
                      </td>
                      <td className="py-2.5 pr-3"><Pill tone={a.status === 'Authorised' ? 'oasis' : 'champ'}>{a.status}</Pill></td>
                      <td className="py-2.5 pr-3">
                        <div className="flex gap-1.5">
                          {a.status !== 'Authorised' && (
                            <>
                              <button
                                className="swk-btn swk-btn-ghost !py-1 !px-2.5 !text-xs"
                                onClick={() => runAction('HR Visa Check', () => post(`/api/agent-authorisations/${a.id}/activate`, { stage: 'hr' }))}
                              >
                                1. HR Confirm Visa
                              </button>
                              <button
                                className="swk-btn swk-btn-primary !py-1 !px-2.5 !text-xs"
                                onClick={() => runAction('Activate Agent', () => post(`/api/agent-authorisations/${a.id}/activate`, { stage: 'compliance' }))}
                              >
                                2. Activate Agent
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
            title="Staff Visas & Government Permits"
            subtitle="Track MOHRE work permits, medical tests, Emirates IDs, and residence visa stamping step by step."
            actions={<Link to="/e/immigration_cases?new=1" className="swk-btn swk-btn-primary"><Plane size={14} /> New Visa Case</Link>}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12.5px]">
                <thead>
                  <tr className="border-b border-[#e7e1d4] text-muted">
                    <th className="py-2 pr-3">Case No.</th>
                    <th className="py-2 pr-3">Staff Member & Type</th>
                    <th className="py-2 pr-3">Application No.</th>
                    <th className="py-2 pr-3">Government Approval</th>
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
                      <td className="py-2.5 pr-3">{p.official_approval_ref || 'Waiting'}</td>
                      <td className="py-2.5 pr-3"><Pill tone={p.status === 'Completed' || p.status === 'Officially Approved' ? 'oasis' : p.is_delayed ? 'dune' : 'champ'}>{p.status}</Pill></td>
                      <td className="py-2.5 pr-3">
                        <div className="flex gap-1.5">
                          <button
                            className="swk-btn swk-btn-ghost !py-1 !px-2.5 !text-xs"
                            onClick={() => runAction('Flag Visa Delay', () => post(`/api/immigration-cases/${p.id}/advance`, { step: 'escalate_delay' }))}
                          >
                            Flag Delay
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
          TAB 8: WHATSAPP & FIELD VISITS
         ===================================================================== */}
      {tab === 'supervision' && (
        <div className="flex flex-col gap-6">
          <Card
            title="Company WhatsApp & Chat Log"
            subtitle="Keeps client chats on official company lines and logs any manager review with a clear reason."
            actions={<Link to="/e/communications?new=1" className="swk-btn swk-btn-primary"><MessageSquare size={14} /> Log Client Chat</Link>}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12.5px]">
                <thead>
                  <tr className="border-b border-[#e7e1d4] text-muted">
                    <th className="py-2 pr-3">Ref No.</th>
                    <th className="py-2 pr-3">Client & Channel</th>
                    <th className="py-2 pr-3">Assigned Agent</th>
                    <th className="py-2 pr-3">Safety Check</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(comQ.data?.rows ?? []).map(c => (
                    <tr key={c.id} className="border-b border-[#f1ece2]">
                      <td className="py-2.5 pr-3 font-semibold"><Link to={`/e/communications/${c.id}`} className="underline">{c.comm_no}</Link></td>
                      <td className="py-2.5 pr-3">{c.customer_phone} · {c.channel}</td>
                      <td className="py-2.5 pr-3">{c._labels?.assigned_user_id}</td>
                      <td className="py-2.5 pr-3">
                        <Pill tone={c.diversion_flag ? 'dune' : 'oasis'}>{c.diversion_flag ? 'Personal Number Alert' : 'Clear'}</Pill>
                      </td>
                      <td className="py-2.5 pr-3"><Pill tone="navy">{c.status}</Pill></td>
                      <td className="py-2.5 pr-3">
                        <div className="flex gap-1.5">
                          <button
                            className="swk-btn swk-btn-ghost !py-1 !px-2.5 !text-xs"
                            onClick={() => runAction('Manager Quality Check', () => post(`/api/communications/${c.id}/supervise`, { actionType: 'Supervisor Quality Review', reason: 'Routine service quality check on company WhatsApp line.' }))}
                          >
                            Log Quality Check
                          </button>
                          <button
                            className="swk-btn swk-btn-ghost !py-1 !px-2.5 !text-xs"
                            onClick={() => runAction('Queue Retry', () => post(`/api/communications/${c.id}/outage`, { fallbackNote: 'Connection interrupted; queued message retry and followed up by phone.' }))}
                          >
                            Retry Message
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
            title="Scheduled Field Visits & Privacy Protection"
            subtitle="Checks attendance during scheduled client viewings only. Off-hours location checks are automatically blocked."
            actions={<Link to="/e/field_sessions?new=1" className="swk-btn swk-btn-primary"><MapPinned size={14} /> New Field Visit</Link>}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12.5px]">
                <thead>
                  <tr className="border-b border-[#e7e1d4] text-muted">
                    <th className="py-2 pr-3">Visit No.</th>
                    <th className="py-2 pr-3">Staff Member & Location</th>
                    <th className="py-2 pr-3">Scheduled Time</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Check-In</th>
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
                          onClick={() => runAction('Check appointment location', () => post(`/api/field-sessions/${f.id}/location`, {}))}
                        >
                          <Eye size={13} /> Verify Appointment Check-In
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-[11.5px] text-muted">
              Manager Chat Reviews Logged: <strong>{supLogQ.data?.total ?? 0}</strong> · Appointment Location Checks Logged: <strong>{locLogQ.data?.total ?? 0}</strong>
            </div>
          </Card>
        </div>
      )}

      {/* =====================================================================
          TAB 9: COMPLIANCE & QUALITY
         ===================================================================== */}
      {tab === 'risk_qa' && (
        <div className="flex flex-col gap-6">
          <Card
            title="Compliance Reviews & Customer Complaints"
            subtitle="Every alert or complaint is reviewed fairly by an independent officer, and staff can submit explanations or appeals."
            actions={<Link to="/e/compliance_cases?new=1" className="swk-btn swk-btn-primary"><ShieldAlert size={14} /> Open Review Case</Link>}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12.5px]">
                <thead>
                  <tr className="border-b border-[#e7e1d4] text-muted">
                    <th className="py-2 pr-3">Case No.</th>
                    <th className="py-2 pr-3">Summary & Type</th>
                    <th className="py-2 pr-3">Priority</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Actions</th>
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
                        {c.legal_hold ? <span className="ml-1.5 text-[11px] font-semibold text-[#9e3b24]">🔒 Protected Record</span> : null}
                      </td>
                      <td className="py-3 pr-3"><Pill tone={c.status.includes('Cleared') ? 'oasis' : 'navy'}>{c.status}</Pill></td>
                      <td className="py-3 pr-3">
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            className="swk-btn swk-btn-ghost !py-1 !px-2.5 !text-xs"
                            onClick={() => runAction('Save review decision', () => post(`/api/compliance-cases/${c.id}/decide`, { findings: 'Reviewed call logs, WhatsApp messages, and property documents.', remedyDecision: 'Closed and cleared after independent check.' }))}
                          >
                            Save Decision
                          </button>
                          <button
                            className="swk-btn swk-btn-ghost !py-1 !px-2.5 !text-xs"
                            onClick={() => runAction('Submit explanation', () => post(`/api/compliance-cases/${c.id}/appeal`, { appealNotes: 'Client call was completed on approved office phone line.' }))}
                          >
                            Add Explanation / Appeal
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
            title="Service Quality Reviews"
            subtitle="Helpful feedback on calls, chats, and listings with the option for agents to request a second look"
            actions={<Link to="/e/qa_reviews?new=1" className="swk-btn swk-btn-primary"><Star size={14} /> New Quality Review</Link>}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12.5px]">
                <thead>
                  <tr className="border-b border-[#e7e1d4] text-muted">
                    <th className="py-2 pr-3">Review No.</th>
                    <th className="py-2 pr-3">Agent & Channel</th>
                    <th className="py-2 pr-3">Scores (Accuracy / Service / Overall)</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Actions</th>
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
                            onClick={() => runAction('Request second review', () => post(`/api/qa-reviews/${q.id}/challenge`, { challengeReason: 'Please check follow-up time against client requested callback time.' }))}
                          >
                            Request Re-Check
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
          TAB 10: APPROVALS & STAFF HANDOVER
         ===================================================================== */}
      {tab === 'governance' && (
        <div className="flex flex-col gap-6">
          <Card
            title="Manager Approval Requests"
            subtitle="All two-person approval requests across deals, expenses, and exceptions."
            actions={<Link to="/e/universal_approvals?new=1" className="swk-btn swk-btn-primary"><CheckCheck size={14} /> New Approval Request</Link>}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12.5px]">
                <thead>
                  <tr className="border-b border-[#e7e1d4] text-muted">
                    <th className="py-2 pr-3">Request No.</th>
                    <th className="py-2 pr-3">Request & Category</th>
                    <th className="py-2 pr-3">Priority</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Actions</th>
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
                              onClick={() => runAction(`Approve ${a.approval_no}`, () => post(`/api/universal-approvals/${a.id}/decide`, { decision: 'approve', comments: 'Checked supporting documents and approved.' }))}
                            >
                              Approve
                            </button>
                            <button
                              className="swk-btn swk-btn-ghost !py-1 !px-2.5 !text-xs"
                              onClick={() => runAction(`Return ${a.approval_no}`, () => post(`/api/universal-approvals/${a.id}/decide`, { decision: 'return', comments: 'Please attach updated quote.' }))}
                            >
                              Ask for Details
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
              title="Hiring, Onboarding & Staff Handover"
              subtitle="Track new joiners or safely hand over a departing staff member's leads, WhatsApp chats, and tasks"
              actions={<Link to="/e/hr_lifecycle_cases?new=1" className="swk-btn swk-btn-ghost !py-1 !px-2.5 !text-xs"><UserCheck size={13} /> New HR Case</Link>}
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
              title="System Backups & Recovery Checks"
              subtitle="Regular backup restore tests to keep company data safe"
              actions={<Link to="/e/dr_exercises?new=1" className="swk-btn swk-btn-ghost !py-1 !px-2.5 !text-xs"><DatabaseBackup size={13} /> Log Backup Check</Link>}
            >
              <div className="space-y-2.5 text-[12.5px]">
                {(drxQ.data?.rows ?? []).map(d => (
                  <div key={d.id} className="p-3 rounded-xl bg-[#f7f4ec] flex items-center justify-between gap-2">
                    <div>
                      <Link to={`/e/dr_exercises/${d.id}`} className="font-semibold underline">{d.exercise_no}</Link> · {d.title}
                      <div className="text-[11px] text-muted">Restore time: {d.actual_rto_minutes} mins · {d.records_verified_count} records checked</div>
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
