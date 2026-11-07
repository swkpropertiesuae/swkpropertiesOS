import { q } from '../db'
import { getSetting } from '../settings'
import { addDays, bad, daysBetween, nowIso, todayStr } from '../util'
import { notify, notifyLeadership, notifyRole } from '../notify'
import type { Hooks, HookArgs } from '../hooks'

export interface Check { key: string; label: string; status: 'ok' | 'warn' | 'fail' | 'info'; detail: string; link?: string }
export interface Finding { rule: string; severity: 'Warning' | 'Blocker'; message: string }
export interface ServiceInfo { code: string; label: string; requires: string[]; note: string }

export const SERVICES: ServiceInfo[] = [
  { code: 'SALES_BROKERAGE', label: 'Sales brokerage (DLD registered)', requires: ['SALES_BROKERAGE'], note: 'Requires valid DLD brokerage licence and RERA registration' },
  { code: 'LEASING_BROKERAGE', label: 'Leasing brokerage', requires: ['LEASING_BROKERAGE'], note: 'Requires valid DLD brokerage licence and RERA registration' },
  { code: 'PROPERTY_MANAGEMENT', label: 'Property management', requires: ['PROPERTY_MANAGEMENT'], note: 'Requires property management licence and RERA registration' },
  { code: 'ESCROW_MANAGEMENT', label: 'Escrow account management', requires: ['ESCROW_MANAGEMENT'], note: 'Requires DLD-approved escrow account and trust account' },
  { code: 'VALUATION', label: 'Property valuation', requires: ['VALUATION'], note: 'Requires RERA-registered valuer' },
]
const SERVICE = Object.fromEntries(SERVICES.map(s => [s.code, s]))
const DEAL_TYPE_SERVICE: Record<string, string> = {
  'Sale': 'SALES_BROKERAGE', 'Lease': 'LEASING_BROKERAGE', 'Off-Plan Sale': 'SALES_BROKERAGE',
  'Commercial Lease': 'LEASING_BROKERAGE', 'Staff Housing': 'LEASING_BROKERAGE', 'Bulk Deal': 'SALES_BROKERAGE',
}

export function licensedCodes(): Set<string> {
  const out = new Set<string>()
  for (const r of q.all<{ covers: string | null }>(`SELECT covers FROM licence_activities WHERE status = 'Active' AND deleted_at IS NULL`)) for (const c of String(r.covers ?? '').split(',')) if (c.trim()) out.add(c.trim().toUpperCase())
  return out
}
export function missingFor(service: string): string[] {
  const s = SERVICE[service]; if (!s) return []
  const have = licensedCodes()
  return s.requires.filter(c => !have.has(c))
}

const advisory = () => getSetting('compliance_mode') === 'advisory'
const level = (f: Finding): Finding => (advisory() && f.severity === 'Blocker' ? { ...f, severity: 'Warning' } : f)

export function syncFindings(entity: string, id: number, label: string, rules: string[], found: Finding[]) {
  const now = nowIso()
  const keep = new Set(found.map(f => f.rule))
  for (const f of found) {
    const ex = q.get(`SELECT id, status FROM compliance_exceptions WHERE link_entity = ? AND link_id = ? AND rule = ? AND status <> 'Resolved' AND deleted_at IS NULL`, entity, id, f.rule)
    if (ex) q.run(`UPDATE compliance_exceptions SET message = ?, severity = ?, link_label = ?, updated_at = ? WHERE id = ?`, f.message, f.severity, label, now, ex.id)
    else q.run(`INSERT INTO compliance_exceptions(rule, severity, message, link_entity, link_id, link_label, status, detected_at, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`, f.rule, f.severity, f.message, entity, id, label, 'Open', now, now, now)
  }
  for (const r of rules) if (!keep.has(r)) q.run(`UPDATE compliance_exceptions SET status = 'Resolved', updated_at = ? WHERE link_entity = ? AND link_id = ? AND rule = ? AND status <> 'Resolved' AND deleted_at IS NULL`, now, entity, id, r)
}
const blockers = (fs: Finding[]) => fs.filter(f => f.severity === 'Blocker')
export function assertNoBlockers(fs: Finding[]) {
  const b = blockers(fs)
  if (b.length) throw bad(`Compliance: ${b.map(x => x.message).join(' ')}`)
}

export function tradeLicenceItem() { return q.get(`SELECT * FROM compliance_items WHERE type = 'Trade licence' AND deleted_at IS NULL ORDER BY expiry_date DESC LIMIT 1`) }
export function dldBrokerageItem() { return q.get(`SELECT * FROM compliance_items WHERE type IN ('DLD Brokerage Licence', 'Office registration (ORN)') AND deleted_at IS NULL ORDER BY expiry_date DESC LIMIT 1`) }
export function reraRegistrationItem() { return q.get(`SELECT * FROM compliance_items WHERE type IN ('RERA Registration', 'Real estate broker registration (RERA)') AND deleted_at IS NULL ORDER BY expiry_date DESC LIMIT 1`) }
export function escrowAccountItem() { return q.get(`SELECT * FROM compliance_items WHERE type IN ('Escrow Account', 'Property management licence') AND deleted_at IS NULL ORDER BY expiry_date DESC LIMIT 1`) }

function licenceFinding(): Finding | null {
  const it = tradeLicenceItem(), exp = it?.expiry_date || getSetting('licence_expiry_date')
  if (exp && exp < todayStr() && it?.status !== 'Not applicable') return { rule: 'LICENCE_EXPIRED', severity: 'Blocker', message: `The trade licence expired on ${exp}. Renew it with DED before trading.` }
  return null
}

function dldFinding(): Finding | null {
  const it = dldBrokerageItem(), exp = it?.expiry_date
  if (exp && exp < todayStr() && it?.status !== 'Not applicable') return { rule: 'DLD_EXPIRED', severity: 'Blocker', message: `The DLD brokerage licence expired on ${exp}. Renew with DLD before conducting brokerage activities.` }
  return null
}

function reraFinding(): Finding | null {
  const it = reraRegistrationItem(), exp = it?.expiry_date
  if (exp && exp < todayStr() && it?.status !== 'Not applicable') return { rule: 'RERA_EXPIRED', severity: 'Blocker', message: `The RERA registration expired on ${exp}. Renew with RERA before conducting brokerage activities.` }
  return null
}

function escrowFinding(): Finding | null {
  const it = escrowAccountItem(), exp = it?.expiry_date
  if (exp && exp < todayStr() && it?.status !== 'Not applicable') return { rule: 'ESCROW_EXPIRED', severity: 'Blocker', message: `The escrow account approval expired on ${exp}. Renew with DLD.` }
  return null
}

function sanctionsFinding(partyId: number | null | undefined, newParty: boolean): Finding | null {
  if (!partyId) return null
  const p = q.get(`SELECT name, sanctions_status s, sanctions_screened_on d FROM parties WHERE id = ?`, partyId)
  if (!p) return null
  if (p.s === 'Confirmed match') return { rule: 'SANCTIONS', severity: 'Blocker', message: `${p.name} is a confirmed sanctions match. Do not deal – freeze and report as required under the UAE targeted financial sanctions regime.` }
  if (p.s === 'Potential match') return { rule: 'SANCTIONS', severity: 'Warning', message: `${p.name} is a potential sanctions match – hold the transaction until compliance clears or confirms it.` }
  if (newParty && (!p.s || p.s === 'Not screened')) return { rule: 'SANCTIONS', severity: 'Warning', message: `${p.name} has not been screened against the UAE / UN sanctions lists.` }
  const days = Number(getSetting('sanctions_review_days')) || 365
  if (newParty && p.d && daysBetween(p.d, todayStr()) > days) return { rule: 'SANCTIONS', severity: 'Warning', message: `${p.name} was last screened on ${p.d} – re-screen (review cycle ${days} days).` }
  return null
}

function scopeFinding(service: string | undefined): Finding | null {
  const mode = getSetting('activity_scope_mode')
  if (!service || mode === 'off') return null
  const miss = missingFor(service)
  if (!miss.length) return null
  const s = SERVICE[service]
  return { rule: 'SCOPE', severity: mode === 'block' ? 'Blocker' : 'Warning', message: `${s.label} is outside the licensed activities (${miss.map(c => SERVICE[c]?.label ?? c).join(', ')} not covered). ${s.note}` }
}

function agentDldFinding(agentId: number | null | undefined, isNew: boolean): Finding | null {
  if (!agentId || !isNew) return null
  const a = q.get(`SELECT name, dld_broker_id, dld_expiry, status FROM agents WHERE id = ?`, agentId)
  if (!a) return null
  if (a.status === 'Licence Expired' || (a.dld_expiry && a.dld_expiry < todayStr())) return { rule: 'AGENT_DLD_EXPIRED', severity: 'Blocker', message: `Agent ${a.name} (RERA ${a.dld_broker_id}) has an expired DLD licence. Cannot assign to new deals.` }
  if (!a.dld_broker_id) return { rule: 'AGENT_NO_DLD', severity: 'Warning', message: `Agent ${a.name} does not have a DLD broker ID recorded.` }
  return null
}

function ejariFinding(leaseId: number | null | undefined, isNew: boolean): Finding | null {
  if (!leaseId || !isNew) return null
  const l = q.get(`SELECT ejari_no, ejari_date, status FROM leases WHERE id = ?`, leaseId)
  if (!l) return null
  if (l.status === 'Ejari Registered' && !l.ejari_no) return { rule: 'EJARI_MISSING', severity: 'Blocker', message: `Lease marked as Ejari Registered but no Ejari number recorded.` }
  return null
}

const CFG: Record<string, { party?: string; service?: (r: any) => string | undefined; watch?: string[]; label: (r: any) => string }> = {
  jobs: { party: 'client_id', service: r => DEAL_TYPE_SERVICE[r.deal_type], watch: ['deal_type'], label: r => r.job_no },
  mandates: { party: 'owner_id', service: r => r.mandate_type?.includes('Sale') ? 'SALES_BROKERAGE' : 'LEASING_BROKERAGE', watch: ['mandate_type'], label: r => r.mandate_no },
  leases: { party: 'tenant_id', service: () => 'LEASING_BROKERAGE', watch: [], label: r => r.lease_no },
  agents: { watch: [], label: r => r.agent_no },
}

export const COMPLIANCE_KEYS = new Set(Object.keys(CFG))

function evaluate(key: string, rec: any, old: any, isNew: boolean): { found: Finding[]; rules: string[] } {
  const c = CFG[key], out: Finding[] = [], rules: string[] = []
  const changed = (f: string) => isNew || !old || old[f] !== rec[f]
  
  if (isNew) { rules.push('LICENCE_EXPIRED'); const l = licenceFinding(); if (l) out.push(l) }
  if (isNew) { rules.push('DLD_EXPIRED'); const d = dldFinding(); if (d) out.push(d) }
  if (isNew) { rules.push('RERA_EXPIRED'); const r = reraFinding(); if (r) out.push(r) }
  if (isNew) { rules.push('ESCROW_EXPIRED'); const e = escrowFinding(); if (e) out.push(e) }
  
  if (c.service && (isNew || (c.watch ?? []).some(changed))) { rules.push('SCOPE'); const s = scopeFinding(c.service(rec)); if (s) out.push(s) }
  if (c.party && changed(c.party)) { rules.push('SANCTIONS'); const s = sanctionsFinding(rec[c.party], isNew); if (s) out.push(s) }
  if (key === 'agents') { rules.push('AGENT_DLD'); const a = agentDldFinding(rec.agent_id ?? rec.id, isNew); if (a) out.push(a) }
  if (key === 'leases') { rules.push('EJARI'); const e = ejariFinding(rec.lease_id ?? rec.id, isNew); if (e) out.push(e) }
  return { found: out.map(level), rules }
}

export function withCompliance(key: string, h: Hooks): Hooks {
  const c = CFG[key]
  const pending = new WeakMap<object, { found: Finding[]; rules: string[] }>()
  return {
    ...h,
    beforeSave(a: HookArgs) {
      h.beforeSave?.(a)
      const r = evaluate(key, a.rec, a.old, a.isNew)
      assertNoBlockers(r.found)
      pending.set(a.rec, r)
    },
    afterSave(a: HookArgs) {
      h.afterSave?.(a)
      const r = pending.get(a.rec)
      if (r) { syncFindings(key, a.rec.id, c.label(a.rec), r.rules, r.found); pending.delete(a.rec) }
    },
  }
}

export function complianceDaily() {
  const today = todayStr()
  q.run(`UPDATE compliance_items SET status = 'Expired', updated_at = ? WHERE status = 'Active' AND expiry_date < ? AND deleted_at IS NULL`, nowIso(), today)
  q.run(`UPDATE compliance_filings SET status = 'Overdue', updated_at = ? WHERE status = 'Upcoming' AND due_date < ? AND deleted_at IS NULL`, nowIso(), today)
  
  for (const it of q.all(`SELECT id, name, expiry_date, renewal_lead_days FROM compliance_items WHERE deleted_at IS NULL AND status IN ('Active','Expired') AND expiry_date IS NOT NULL`)) {
    const left = daysBetween(today, it.expiry_date)
    if ((left <= (it.renewal_lead_days ?? 60) && [60, 30, 14, 7, 3, 2, 1, 0].includes(left)) || (left < 0 && left % 7 === 0))
      notifyRole('compliance', left < 0 ? `${it.name} EXPIRED ${-left} days ago` : `${it.name} expires in ${left} days`, `Expiry ${it.expiry_date}`, `/e/compliance_items/${it.id}`, 'alert', `lic-${it.id}-${today}`)
  }
  
  for (const f of q.all(`SELECT id, type, period, due_date FROM compliance_filings WHERE deleted_at IS NULL AND status IN ('Upcoming','Overdue')`)) {
    const left = daysBetween(today, f.due_date)
    if ([30, 14, 7, 3, 1, 0].includes(left) || (left < 0 && left % 7 === 0)) notifyRole('compliance', left < 0 ? `OVERDUE: ${f.type} ${f.period}` : `${f.type} ${f.period} due in ${left} days`, `Due ${f.due_date}`, `/e/compliance_filings/${f.id}`, 'alert', `fil-${f.id}-${today}`)
  }
  
  for (const a of q.all(`SELECT id, name, dld_broker_id, dld_expiry FROM agents WHERE deleted_at IS NULL AND status = 'Active' AND dld_expiry IS NOT NULL AND dld_expiry <= ?`, addDays(today, 60))) {
    const left = daysBetween(today, a.dld_expiry)
    notifyRole('compliance', left < 0 ? `Agent ${a.name} DLD licence EXPIRED ${-left} days ago` : `Agent ${a.name} DLD licence expires in ${left} days`, `RERA ${a.dld_broker_id} · Expiry ${a.dld_expiry}`, `/e/agents/${a.id}`, left < 0 ? 'alert' : 'warning', `agent-dld-${a.id}-${today}`)
  }
  
  for (const l of q.all(`SELECT l.id, u.unit_no, l.end_date, l.ejari_no FROM leases l JOIN units u ON u.id = l.unit_id WHERE l.deleted_at IS NULL AND l.status IN ('Active','Ejari Registered') AND l.end_date BETWEEN ? AND ?`, today, addDays(today, 90))) {
    const left = daysBetween(today, l.end_date)
    notifyRole('compliance', `Lease expiring in ${left} days`, `Unit ${l.unit_no} · Ejari ${l.ejari_no || 'N/A'} · Ends ${l.end_date}`, `/e/leases/${l.id}`, left <= 30 ? 'alert' : 'warning', `lease-exp-${l.id}-${today}`)
  }

  checkEmployeeAndDocumentExpiries(false)
  notifyEmployeeTargets('auto', false)
}

function expiryMilestoneBucket(left: number, expiryDate: string, today: string, force: boolean): string {
  if (force) return `manual-${Date.now()}`
  if ([60, 45, 30, 21, 14, 7, 5, 3, 2, 1, 0].includes(left)) return `day-${left}-${today}`
  if (left < 0) return `expired-w${Math.floor(-left / 7)}-${expiryDate}`
  if (left <= 7) return `d${left}-${today}`
  if (left <= 14) return `w14-${expiryDate}`
  if (left <= 30) return `w30-${expiryDate}`
  return `w60-${expiryDate}`
}

/**
 * Checks all active/probation/on-leave employees' Visa, Emirates ID, Passport,
 * Work Permit / Labour Card, and Health Insurance Card expiry dates, as well as
 * all uploaded documents in the Document Vault (`attachments`) with an `expiry_date`.
 */
export function checkEmployeeAndDocumentExpiries(force = false): {
  employee_alerts: number
  document_alerts: number
  items: Array<{ kind: 'employee' | 'document'; label: string; doc_type: string; expiry_date: string; days_left: number; status: 'expired' | 'expiring'; link: string }>
} {
  const today = todayStr()
  const cutoff = addDays(today, 60)
  let employeeAlerts = 0
  let documentAlerts = 0
  const items: Array<{ kind: 'employee' | 'document'; label: string; doc_type: string; expiry_date: string; days_left: number; status: 'expired' | 'expiring'; link: string }> = []

  const emps = q.all<{
    id: number
    emp_no: string | null
    name: string
    user_id: number | null
    passport_no: string | null
    passport_expiry: string | null
    emirates_id: string | null
    eid_expiry: string | null
    visa_no: string | null
    visa_expiry: string | null
    labour_card_no: string | null
    work_permit_no: string | null
    work_permit_expiry: string | null
    health_card_expiry: string | null
  }>(`
    SELECT id, emp_no, name, user_id,
           passport_no, passport_expiry,
           emirates_id, eid_expiry,
           visa_no, visa_expiry,
           labour_card_no, work_permit_no, work_permit_expiry,
           health_card_expiry
    FROM employees
    WHERE deleted_at IS NULL AND status IN ('Active', 'On leave', 'Probation')
  `)

  for (const emp of emps) {
    const docs = [
      { key: 'visa', label: 'Residence Visa', date: emp.visa_expiry, ref: emp.visa_no },
      { key: 'eid', label: 'Emirates ID', date: emp.eid_expiry, ref: emp.emirates_id },
      { key: 'passport', label: 'Passport', date: emp.passport_expiry, ref: emp.passport_no },
      { key: 'work_permit', label: 'Work Permit / Labour Card', date: emp.work_permit_expiry, ref: emp.work_permit_no || emp.labour_card_no },
      { key: 'health_card', label: 'Health Insurance Card', date: emp.health_card_expiry, ref: null },
    ]
    for (const d of docs) {
      if (!d.date || !/^\d{4}-\d{2}-\d{2}$/.test(d.date) || d.date > cutoff) continue
      const left = daysBetween(today, d.date)
      const isExpired = left < 0
      const severity = isExpired || left <= 14 ? 'alert' : 'warning'
      const title = isExpired
        ? `Employee ${d.label} EXPIRED: ${emp.name}`
        : `Employee ${d.label} expires in ${left} day${left === 1 ? '' : 's'}: ${emp.name}`
      const body = `${d.label}${d.ref ? ` (${d.ref})` : ''} · ${isExpired ? `Expired ${-left} day${-left === 1 ? '' : 's'} ago (${d.date})` : `Expiry ${d.date}`}`
      const link = `/e/employees/${emp.id}`
      const bucket = expiryMilestoneBucket(left, d.date, today, force)
      const dedupeBase = `emp-doc-${emp.id}-${d.key}-${bucket}`

      notifyRole('hr', title, body, link, severity, dedupeBase)
      notifyRole('compliance', title, body, link, severity, `${dedupeBase}:comp`)
      notifyLeadership(title, body, link, severity, `${dedupeBase}:lead`)
      if (emp.user_id) {
        notify(
          emp.user_id,
          isExpired ? `Your ${d.label} EXPIRED ${-left} day${-left === 1 ? '' : 's'} ago` : `Your ${d.label} expires in ${left} day${left === 1 ? '' : 's'}`,
          `${d.label}${d.ref ? ` (${d.ref})` : ''} · Expiry ${d.date} — please submit renewal documents to HR.`,
          link,
          severity,
          `${dedupeBase}:self`,
        )
      }
      employeeAlerts++
      items.push({
        kind: 'employee',
        label: emp.name,
        doc_type: d.label,
        expiry_date: d.date,
        days_left: left,
        status: isExpired ? 'expired' : 'expiring',
        link,
      })
    }
  }

  const atts = q.all<{
    id: number
    file_name: string
    category: string | null
    link_entity: string | null
    link_id: number | null
    link_label: string | null
    expiry_date: string
    emp_name: string | null
    emp_user_id: number | null
  }>(`
    SELECT a.id, a.file_name, a.category, a.link_entity, a.link_id, a.link_label, a.expiry_date,
           e.name AS emp_name, e.user_id AS emp_user_id
    FROM attachments a
    LEFT JOIN employees e ON a.link_entity = 'employees' AND e.id = a.link_id
    WHERE a.deleted_at IS NULL AND a.expiry_date IS NOT NULL AND a.expiry_date <> '' AND a.expiry_date <= ?
  `, cutoff)

  for (const att of atts) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(att.expiry_date)) continue
    const left = daysBetween(today, att.expiry_date)
    const isExpired = left < 0
    const severity = isExpired || left <= 14 ? 'alert' : 'warning'
    const ownerLabel = att.emp_name || att.link_label || 'Company Vault'
    const title = isExpired
      ? `Document EXPIRED: ${att.file_name} (${ownerLabel})`
      : `Document expires in ${left} day${left === 1 ? '' : 's'}: ${att.file_name}`
    const body = `${att.category || 'Document'} · ${ownerLabel} · ${isExpired ? `Expired ${-left} day${-left === 1 ? '' : 's'} ago (${att.expiry_date})` : `Expiry ${att.expiry_date}`}`
    const link = att.link_entity && att.link_id ? `/e/${att.link_entity}/${att.link_id}` : '/documents'
    const bucket = expiryMilestoneBucket(left, att.expiry_date, today, force)
    const dedupeBase = `att-exp-${att.id}-${bucket}`

    notifyRole('hr', title, body, link, severity, dedupeBase)
    notifyRole('compliance', title, body, link, severity, `${dedupeBase}:comp`)
    notifyLeadership(title, body, link, severity, `${dedupeBase}:lead`)
    if (att.emp_user_id) {
      notify(att.emp_user_id, title, body, link, severity, `${dedupeBase}:self`)
    }
    documentAlerts++
    items.push({
      kind: 'document',
      label: `${att.file_name} (${ownerLabel})`,
      doc_type: att.category || 'Uploaded Document',
      expiry_date: att.expiry_date,
      days_left: left,
      status: isExpired ? 'expired' : 'expiring',
      link,
    })
  }

  return { employee_alerts: employeeAlerts, document_alerts: documentAlerts, items }
}

export const TIER_MONTHLY_TARGETS: Record<string, number> = {
  '50/50 Standard (Company Visa)': 60_000,
  Standard: 60_000,
  Senior: 106_667,
  Partner: 166_667,
  Custom: 83_333,
}

export interface AgentTargetSummary {
  agent_id: number
  agent_no: string
  name: string
  user_id: number | null
  tier: string
  monthly_target: number
  achieved_gci: number
  deals_closed: number
  attainment_pct: number
  remaining_gci: number
  surplus_gci: number
  status: 'exceeded' | 'on_track' | 'below_target'
}

export function computeMonthlyTargetSummaries(today = todayStr()): {
  period: string
  month_label: string
  agents: AgentTargetSummary[]
  totals: { target: number; achieved: number; remaining: number; surplus: number; attainment_pct: number; exceeded_count: number; below_count: number }
} {
  const ym = today.slice(0, 7)
  const dt = new Date(`${ym}-01T00:00:00Z`)
  const monthLabel = dt.toLocaleDateString('en-AE', { month: 'long', year: 'numeric', timeZone: 'UTC' })

  const activeAgents = q.all<{
    id: number
    agent_no: string | null
    name: string
    email: string | null
    employee_id: number | null
    commission_tier: string | null
    monthly_target: number | null
    emp_user_id: number | null
    emp_email: string | null
  }>(`
    SELECT a.id, a.agent_no, a.name, a.email, a.employee_id, a.commission_tier, a.monthly_target,
           e.user_id AS emp_user_id, e.email AS emp_email
    FROM agents a
    LEFT JOIN employees e ON e.id = a.employee_id
    WHERE a.deleted_at IS NULL AND a.status = 'Active'
    ORDER BY a.name ASC
  `)

  const summaries: AgentTargetSummary[] = []
  for (const a of activeAgents) {
    let userId = a.emp_user_id
    if (!userId && (a.email || a.emp_email)) {
      userId = q.val<number>(
        `SELECT id FROM users WHERE deleted_at IS NULL AND active = 1 AND lower(email) IN (lower(?), lower(?)) LIMIT 1`,
        a.email || '',
        a.emp_email || '',
      ) ?? null
    }
    if (!userId && a.name) {
      userId = q.val<number>(
        `SELECT id FROM users WHERE deleted_at IS NULL AND active = 1 AND lower(name) = lower(?) LIMIT 1`,
        a.name,
      ) ?? null
    }

    const tier = a.commission_tier || 'Standard'
    const monthlyTarget = Number(a.monthly_target) > 0
      ? Math.round(Number(a.monthly_target))
      : (TIER_MONTHLY_TARGETS[tier] ?? 60_000)

    const comRow = q.get<{ gci: number; cnt: number }>(`
      SELECT COALESCE(SUM(gross_commission), 0) AS gci, COUNT(*) AS cnt
      FROM agent_commissions
      WHERE agent_id = ? AND status <> 'Cancelled' AND deleted_at IS NULL
        AND substr(COALESCE(transaction_date, created_at), 1, 7) = ?
    `, a.id, ym)

    const closedJobs = q.all<{ deal_value: number | null; commission_pct: number | null }>(`
      SELECT deal_value, commission_pct
      FROM jobs
      WHERE (agent_id = ? OR buyer_agent_id = ?)
        AND (operational_status = 'Closed' OR job_status IN ('Completed', 'Title Deed Issued'))
        AND deleted_at IS NULL
        AND substr(COALESCE(actual_close, deal_date, created_at), 1, 7) = ?
    `, a.id, a.id, ym)

    const dealsClosed = closedJobs.length || Number(comRow?.cnt || 0)
    const achievedFromJobs = closedJobs.reduce((s, j) => s + Number(j.deal_value || 0) * Number(j.commission_pct || 2) / 100, 0)
    const achievedGci = Math.round(Number(comRow?.gci || 0) > 0 ? Number(comRow!.gci) : achievedFromJobs)
    const remainingGci = Math.max(0, monthlyTarget - achievedGci)
    const surplusGci = Math.max(0, achievedGci - monthlyTarget)
    const attainmentPct = monthlyTarget > 0 ? Math.round((achievedGci / monthlyTarget) * 100) : 0
    const status: AgentTargetSummary['status'] = attainmentPct >= 100 ? 'exceeded' : attainmentPct >= 50 ? 'on_track' : 'below_target'

    summaries.push({
      agent_id: a.id,
      agent_no: a.agent_no || `AGT-${a.id}`,
      name: a.name,
      user_id: userId,
      tier,
      monthly_target: monthlyTarget,
      achieved_gci: achievedGci,
      deals_closed: dealsClosed,
      attainment_pct: attainmentPct,
      remaining_gci: remainingGci,
      surplus_gci: surplusGci,
      status,
    })
  }

  const totalTarget = summaries.reduce((s, x) => s + x.monthly_target, 0)
  const totalAchieved = summaries.reduce((s, x) => s + x.achieved_gci, 0)
  const totalRemaining = Math.max(0, totalTarget - totalAchieved)
  const totalSurplus = Math.max(0, totalAchieved - totalTarget)
  const totalPct = totalTarget > 0 ? Math.round((totalAchieved / totalTarget) * 100) : 0
  const exceededCount = summaries.filter(x => x.attainment_pct >= 100).length
  const belowCount = summaries.filter(x => x.attainment_pct < 100).length

  return {
    period: ym,
    month_label: monthLabel,
    agents: summaries,
    totals: {
      target: totalTarget,
      achieved: totalAchieved,
      remaining: totalRemaining,
      surplus: totalSurplus,
      attainment_pct: totalPct,
      exceeded_count: exceededCount,
      below_count: belowCount,
    },
  }
}

/**
 * Sends automated or on-demand Employee Target Tracking notifications:
 * - `'start'` (1st of month): Notifies every active agent of their monthly target at the beginning of the month.
 * - `'mid'` (15th of month): Sends mid-month progress updates showing how much has been achieved and how much is remaining (or exceeded).
 * - `'auto'`: Runs automatically in the daily scheduler — ensures 1st-of-month notifications are sent from day 1 onwards, and mid-month updates are sent from day 15 onwards (or on exact milestone days 1 and 15).
 */
export function notifyEmployeeTargets(mode: 'start' | 'mid' | 'auto' = 'auto', force = false): {
  mode_executed: string[]
  period: string
  month_label: string
  notified_agents: number
  agents: AgentTargetSummary[]
  totals: { target: number; achieved: number; remaining: number; surplus: number; attainment_pct: number; exceeded_count: number; below_count: number }
} {
  const today = todayStr()
  const dayOfMonth = Number(today.slice(8, 10))
  const summary = computeMonthlyTargetSummaries(today)
  const { period, month_label: monthLabel, agents, totals } = summary

  const modesToRun: Array<'start' | 'mid'> = []
  if (mode === 'start') {
    modesToRun.push('start')
  } else if (mode === 'mid') {
    modesToRun.push('mid')
  } else {
    // 'auto' mode:
    // 1. Always ensure beginning-of-month ('start') target notification has been issued for the current month (runs on the 1st, or catches up if server started later in the month).
    modesToRun.push('start')
    // 2. From the 15th onwards (mid-month), automatically issue the mid-month progress & remaining target notification.
    if (dayOfMonth >= 15) modesToRun.push('mid')
  }

  const suffix = force ? `-${Date.now()}` : ''
  let notifiedCount = 0

  for (const m of modesToRun) {
    if (m === 'start') {
      for (const ag of agents) {
        const title = `Monthly Target (${monthLabel}): AED ${ag.monthly_target.toLocaleString('en-US')}`
        const body = `Your assigned monthly GCI target for ${monthLabel} is AED ${ag.monthly_target.toLocaleString('en-US')} (${ag.tier}). Track your live progress and closures on the Leaderboard.`
        if (ag.user_id) {
          notify(ag.user_id, title, body, '/agents', 'target', `target-start-${ag.agent_id}-${period}${suffix}`)
          notifiedCount++
        }
      }
      if (agents.length > 0) {
        notifyLeadership(
          `Monthly Targets Issued (${monthLabel})`,
          `${agents.length} active agent(s) assigned targets · Total monthly team target: AED ${totals.target.toLocaleString('en-US')}`,
          '/agents',
          'target',
          `target-start-lead-${period}${suffix}`,
        )
      }
    } else if (m === 'mid') {
      for (const ag of agents) {
        const exceeded = ag.achieved_gci >= ag.monthly_target
        const title = exceeded
          ? `Mid-Month Target Update (${monthLabel}): ${ag.attainment_pct}% Achieved!`
          : `Mid-Month Target Update (${monthLabel}): ${ag.attainment_pct}% Achieved`
        const body = exceeded
          ? `Target exceeded! Achieved: AED ${ag.achieved_gci.toLocaleString('en-US')} of AED ${ag.monthly_target.toLocaleString('en-US')}${ag.surplus_gci > 0 ? ` (+AED ${ag.surplus_gci.toLocaleString('en-US')} additional achievement above target)` : ''} across ${ag.deals_closed} closure(s).`
          : `Achieved so far: AED ${ag.achieved_gci.toLocaleString('en-US')} (${ag.attainment_pct}%) across ${ag.deals_closed} closure(s) · Remaining to reach target: AED ${ag.remaining_gci.toLocaleString('en-US')} (Target: AED ${ag.monthly_target.toLocaleString('en-US')}).`
        if (ag.user_id) {
          notify(ag.user_id, title, body, '/agents', 'target', `target-mid-${ag.agent_id}-${period}${suffix}`)
          notifiedCount++
        }
      }
      if (agents.length > 0) {
        notifyLeadership(
          `Mid-Month Team Target Update (${monthLabel}): ${totals.attainment_pct}% Achieved`,
          `Achieved: AED ${totals.achieved.toLocaleString('en-US')} of AED ${totals.target.toLocaleString('en-US')} · Remaining: AED ${totals.remaining.toLocaleString('en-US')} (${totals.exceeded_count} exceeding, ${totals.below_count} below target).`,
          '/agents',
          'target',
          `target-mid-lead-${period}${suffix}`,
        )
      }
    }
  }

  return {
    mode_executed: modesToRun,
    period,
    month_label: monthLabel,
    notified_agents: notifiedCount,
    agents,
    totals,
  }
}

export function generateCalendar(): { created: number; updated: number } {
  let created = 0, updated = 0; const now = nowIso()
  const today = todayStr()
  const upsert = (type: string, period: string, due: string, basis: string) => {
    const ex = q.get(`SELECT id, due_date FROM compliance_filings WHERE type = ? AND period = ? AND deleted_at IS NULL`, type, period)
    if (ex) {
      if (ex.due_date !== due) { q.run(`UPDATE compliance_filings SET due_date = ?, basis = ?, updated_at = ? WHERE id = ?`, due, basis, now, ex.id); updated++ }
    } else {
      const st = due < today ? 'Overdue' : 'Upcoming'
      q.run(`INSERT INTO compliance_filings(type, period, due_date, status, auto, basis, created_at, updated_at) VALUES (?,?,?,?,1,?,?,?)`, type, period, due, st, basis, now, now)
      created++
    }
  }

  const issue = String(getSetting('licence_issue_date') || '')
  if (/^\d{4}-\d{2}-\d{2}$/.test(issue)) {
    const d = new Date(issue + 'T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 3)
    const ctRegDue = d.toISOString().slice(0, 10)
    upsert('Corporate tax registration', issue.slice(0, 4), ctRegDue, `3 months from licence issue (${issue})`)
  }

  const fye = String(getSetting('financial_year_end') || '12-31')
  const yr = Number(today.slice(0, 4))
  if (/^\d{2}-\d{2}$/.test(fye)) {
    const fyEnd = `${yr}-${fye}`
    const d = new Date(fyEnd + 'T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 9)
    // Last day of that 9th month if fye is month-end
    if (fye.endsWith('-31') || fye === '06-30' || fye === '09-30') {
      const m = Number(fye.slice(0, 2))
      const dueYr = m + 9 > 12 ? yr + 1 : yr
      const dueMo = ((m + 9 - 1) % 12) + 1
      const lastDay = new Date(Date.UTC(dueYr, dueMo, 0)).toISOString().slice(0, 10)
      upsert('Corporate tax return', `FY${yr}`, lastDay, `9 months after financial year end (${fyEnd})`)
    } else {
      upsert('Corporate tax return', `FY${yr}`, d.toISOString().slice(0, 10), `9 months after financial year end (${fyEnd})`)
    }
  }

  // Quarterly VAT returns (28th of month following quarter end)
  const quarters = [
    { p: `${yr}-Q1`, due: `${yr}-04-28`, basis: '28 days after Q1 end (31 Mar)' },
    { p: `${yr}-Q2`, due: `${yr}-07-28`, basis: '28 days after Q2 end (30 Jun)' },
    { p: `${yr}-Q3`, due: `${yr}-10-28`, basis: '28 days after Q3 end (30 Sep)' },
    { p: `${yr}-Q4`, due: `${yr + 1}-01-28`, basis: '28 days after Q4 end (31 Dec)' },
  ]
  for (const qtr of quarters) upsert('VAT return', qtr.p, qtr.due, qtr.basis)

  // UAE E-Invoicing rollout milestones
  const over50m = !!getSetting('einv_revenue_over_50m')
  upsert('E-invoicing ASP appointment', over50m ? 'Phase 1 (>=50M)' : 'Phase 2 (<50M)', over50m ? '2026-07-31' : '2027-03-31', 'UAE MoF e-invoicing accredited service provider appointment')
  upsert('E-invoicing go-live', over50m ? 'Phase 1 (>=50M)' : 'Phase 2 (<50M)', over50m ? '2027-01-01' : '2027-07-01', 'UAE MoF mandatory e-invoicing go-live')

  // Licences & registrations from register
  for (const it of q.all(`SELECT id, name, type, reference_no, expiry_date FROM compliance_items WHERE deleted_at IS NULL AND expiry_date IS NOT NULL AND status <> 'Not applicable'`)) {
    upsert('Licence renewal', `${it.type} (${it.reference_no || it.id})`, it.expiry_date, `Renewal of ${it.name}`)
  }

  for (const a of q.all(`SELECT id, name, dld_broker_id, dld_expiry FROM agents WHERE deleted_at IS NULL AND status = 'Active' AND dld_expiry IS NOT NULL`)) {
    const due = addDays(a.dld_expiry, -30)
    if (due > today) {
      upsert('Agent DLD Renewal', `${a.dld_broker_id}-${a.dld_expiry.slice(0, 7)}`, due, `Agent ${a.name} (RERA ${a.dld_broker_id}) DLD renewal ${a.dld_expiry}`)
    }
  }

  return { created, updated }
}

const TRN_RE = /^1[0-9]{14}$/
function companyTrnFor(branchId: number | null | undefined) {
  if (branchId) {
    const b = q.get(`SELECT le.trn FROM branches br JOIN legal_entities le ON le.id = br.legal_entity_id WHERE br.id = ? AND br.deleted_at IS NULL AND le.deleted_at IS NULL LIMIT 1`, branchId)
    if (b?.trn) return b.trn
  }
  return getSetting('company_trn')
}

export function checkInvoicePosting(inv: any, lines: any[]) {
  const out: Finding[] = []
  const tax = inv.doc_type !== 'Proforma Invoice'
  if (tax) {
    const registered = !!getSetting('vat_registered')
    if (!registered && (inv.vat_total ?? 0) > 0) out.push({ rule: 'VAT_NOT_REGISTERED', severity: 'Blocker', message: 'The company is recorded as not VAT-registered, so VAT cannot be charged. Remove VAT from the lines or update the VAT registration status in Company Settings.' })
    if (registered && !TRN_RE.test(companyTrnFor(inv.branch_id))) out.push({ rule: 'SUPPLIER_TRN', severity: 'Blocker', message: 'A tax invoice must show the supplier\'s 15-digit TRN. Enter it under Company Settings.' })
    const p = q.get(`SELECT trn, address1, city, country_id FROM parties WHERE id = ?`, inv.party_id)
    if (registered && p && !p.trn && (inv.base_total ?? 0) >= 10000) out.push({ rule: 'CUSTOMER_TRN', severity: 'Warning', message: 'Customer TRN is missing. Invoices of AED 10,000 or more are full tax invoices and must show the customer\'s name, address and TRN if VAT-registered.' })
    if (registered && p && !p.address1 && !p.city && (inv.base_total ?? 0) >= 10000) out.push({ rule: 'CUSTOMER_ADDRESS', severity: 'Warning', message: 'Customer address is missing on a full tax invoice.' })
    if (inv.doc_type === 'Credit Note' && !String(inv.credit_reason ?? '').trim()) out.push({ rule: 'CREDIT_REASON', severity: 'Blocker', message: 'A tax credit note must state the reason it is issued.' })
    if (['Credit Note', 'Debit Note'].includes(inv.doc_type) && !inv.original_invoice_id) out.push({ rule: 'CREDIT_REF', severity: 'Warning', message: 'Link the original tax invoice so the note can be traced.' })
    if (inv.supply_date && daysBetween(inv.supply_date, inv.invoice_date) > 14) out.push({ rule: 'LATE_ISSUE', severity: 'Warning', message: `The invoice is dated ${daysBetween(inv.supply_date, inv.invoice_date)} days after the date of supply; a tax invoice must be issued within 14 days.` })
    const l = licenceFinding(); if (l) out.push(l)
    const d = dldFinding(); if (d) out.push(d)
    const r = reraFinding(); if (r) out.push(r)
  }
  const s = sanctionsFinding(inv.party_id, false); if (s && s.severity === 'Blocker') out.push(s)
  const lv = out.map(level)
  assertNoBlockers(lv)
  syncFindings('invoices', inv.id, inv.invoice_no, ['VAT_NOT_REGISTERED','SUPPLIER_TRN','CUSTOMER_TRN','CUSTOMER_ADDRESS','CREDIT_REASON','CREDIT_REF','LATE_ISSUE','LICENCE_EXPIRED','DLD_EXPIRED','RERA_EXPIRED','SANCTIONS'], lv)
}

export function checkBillPosting(b: any, lines: any[]) {
  const out: Finding[] = []
  const v = q.get(`SELECT name, trn FROM parties WHERE id = ?`, b.vendor_id)
  if ((b.vat_total ?? 0) > 0 && v && !v.trn && getSetting('vat_registered')) out.push({ rule: 'INPUT_VAT_TRN', severity: 'Warning', message: `${v.name} has no TRN on file. Input VAT is recoverable only against a valid tax invoice showing the supplier's TRN.` })
  const s = sanctionsFinding(b.vendor_id, false); if (s && s.severity === 'Blocker') out.push(s)
  const lv = out.map(level)
  assertNoBlockers(lv)
  syncFindings('bills', b.id, b.bill_no, ['INPUT_VAT_TRN', 'SANCTIONS'], lv)
  void lines
}

export function overview() {
  const today = todayStr(), checks: Check[] = []
  
  const lic = tradeLicenceItem(), exp = lic?.expiry_date || getSetting('licence_expiry_date')
  const left = exp ? daysBetween(today, exp) : null
  checks.push({ key: 'licence', label: 'Trade licence valid', status: left === null ? 'fail' : left < 0 ? 'fail' : left <= 60 ? 'warn' : 'ok', detail: left === null ? 'No trade licence expiry recorded' : left < 0 ? `Expired ${-left} days ago (${exp})` : `Valid until ${exp} (${left} days)`, link: lic ? `/e/compliance_items/${lic.id}` : '/e/compliance_items' })
  
  const dld = dldBrokerageItem()
  const dldLeft = dld?.expiry_date ? daysBetween(today, dld.expiry_date) : null
  checks.push({ key: 'dld', label: 'DLD Brokerage Licence', status: !dld ? 'fail' : dldLeft === null ? 'fail' : dldLeft < 0 ? 'fail' : dldLeft <= 60 ? 'warn' : 'ok', detail: !dld ? 'No DLD licence recorded' : dldLeft === null ? 'No expiry date' : dldLeft < 0 ? `Expired ${-dldLeft} days ago (${dld.expiry_date})` : `Valid until ${dld.expiry_date} (${dldLeft} days)`, link: dld ? `/e/compliance_items/${dld.id}` : '/e/compliance_items' })
  
  const rera = reraRegistrationItem()
  const reraLeft = rera?.expiry_date ? daysBetween(today, rera.expiry_date) : null
  checks.push({ key: 'rera', label: 'RERA Registration', status: !rera ? 'fail' : reraLeft === null ? 'fail' : reraLeft < 0 ? 'fail' : reraLeft <= 60 ? 'warn' : 'ok', detail: !rera ? 'No RERA registration recorded' : reraLeft === null ? 'No expiry date' : reraLeft < 0 ? `Expired ${-reraLeft} days ago (${rera.expiry_date})` : `Valid until ${rera.expiry_date} (${reraLeft} days)`, link: rera ? `/e/compliance_items/${rera.id}` : '/e/compliance_items' })
  
  const escrow = escrowAccountItem()
  const escLeft = escrow?.expiry_date ? daysBetween(today, escrow.expiry_date) : null
  checks.push({ key: 'escrow', label: 'Escrow Account Approval', status: !escrow ? 'warn' : escLeft === null ? 'warn' : escLeft < 0 ? 'fail' : escLeft <= 60 ? 'warn' : 'ok', detail: !escrow ? 'No escrow account recorded' : escLeft === null ? 'No expiry date' : escLeft < 0 ? `Expired ${-escLeft} days ago (${escrow.expiry_date})` : `Valid until ${escrow.expiry_date} (${escLeft} days)`, link: escrow ? `/e/compliance_items/${escrow.id}` : '/e/compliance_items' })
  
  const trn = String(getSetting('company_trn') ?? '').replace(/\s/g, ''), reg = !!getSetting('vat_registered')
  checks.push({ key: 'vat', label: 'VAT Status & TRN', status: !reg ? 'info' : TRN_RE.test(trn) ? 'ok' : 'fail', detail: !reg ? 'Recorded as not VAT-registered' : TRN_RE.test(trn) ? `TRN ${trn}` : 'VAT-registered but no valid 15-digit TRN', link: '/admin/settings' })
  
  const badAgents = q.val<number>(`SELECT COUNT(*) FROM agents WHERE deleted_at IS NULL AND status = 'Active' AND (dld_expiry IS NULL OR dld_expiry < ? OR dld_broker_id IS NULL)`, today) ?? 0
  checks.push({ key: 'agents', label: 'Agent DLD Compliance', status: badAgents === 0 ? 'ok' : 'fail', detail: badAgents === 0 ? 'All agents have valid DLD licences' : `${badAgents} active agent(s) with missing/expired DLD licence`, link: '/e/agents' })
  
  const scopeOpen = q.val<number>(`SELECT COUNT(*) FROM compliance_exceptions WHERE rule = 'SCOPE' AND status = 'Open' AND deleted_at IS NULL`) ?? 0
  checks.push({ key: 'scope', label: 'Operations within licensed activities', status: scopeOpen ? 'fail' : 'ok', detail: scopeOpen ? `${scopeOpen} open record(s) outside the licensed activities` : 'All services are licensed', link: '/e/compliance_exceptions' })
  
  const cust = q.get(`SELECT COUNT(*) n, SUM(CASE WHEN sanctions_status = 'Clear' AND sanctions_screened_on IS NOT NULL THEN 1 ELSE 0 END) ok FROM parties WHERE deleted_at IS NULL AND status = 'Active'`)
  checks.push({ key: 'sanctions', label: 'Sanctions Screening', status: !cust?.n ? 'info' : cust.ok === cust.n ? 'ok' : 'warn', detail: cust?.n ? `${cust.ok ?? 0} of ${cust.n} active parties screened clear` : 'No parties yet', link: '/e/parties' })
  
  const open = q.all(`SELECT severity, COUNT(*) n FROM compliance_exceptions WHERE status = 'Open' AND deleted_at IS NULL GROUP BY severity`)
  const nOpen = open.reduce((s, r) => s + r.n, 0)
  checks.push({ key: 'exceptions', label: 'Open Compliance Exceptions', status: nOpen ? 'warn' : 'ok', detail: nOpen ? `${nOpen} open` : 'None', link: '/e/compliance_exceptions' })
  
  const scored = checks.filter(c => c.status !== 'info')
  const score = scored.length ? Math.round(100 * scored.reduce((s, c) => s + (c.status === 'ok' ? 1 : c.status === 'warn' ? 0.5 : 0), 0) / scored.length) : 100

  const jobCounts = q.all<{ deal_type: string; n: number }>(`SELECT deal_type, COUNT(*) n FROM jobs WHERE deleted_at IS NULL AND job_status <> 'Cancelled' GROUP BY deal_type`)
  const scope = SERVICES.map(s => {
    const matchingDeals = jobCounts.filter(j => DEAL_TYPE_SERVICE[j.deal_type] === s.code).reduce((sum, j) => sum + Number(j.n), 0)
    return { code: s.code, label: s.label, covered: missingFor(s.code).length === 0, jobs: matchingDeals, note: s.note }
  })

  const deadlines = q.all(`SELECT id, type, period, due_date, status FROM compliance_filings WHERE deleted_at IS NULL AND status IN ('Upcoming','Overdue') ORDER BY due_date LIMIT 30`).map((f: any) => ({ ...f, days: daysBetween(today, f.due_date) }))
  const expiring = q.all(`SELECT id, name, type, expiry_date, status FROM compliance_items WHERE deleted_at IS NULL AND expiry_date IS NOT NULL AND expiry_date <= ? AND status <> 'Not applicable' ORDER BY expiry_date LIMIT 30`, addDays(today, 90)).map((i: any) => ({ ...i, days: daysBetween(today, i.expiry_date) }))

  return {
    identity: {
      name: getSetting('company_name') || 'SWK Properties L.L.C.',
      name_ar: getSetting('company_name_ar') || '',
      licence_no: getSetting('company_trade_license') || '',
      authority: getSetting('licence_authority') || 'Dubai Department of Economy & Tourism (DET)',
    },
    mode: {
      compliance: getSetting('compliance_mode') || 'enforce',
      scope: getSetting('activity_scope_mode') || 'warn',
    },
    checks,
    score,
    scope,
    deadlines,
    expiring,
    generated_at: nowIso(),
  }
}