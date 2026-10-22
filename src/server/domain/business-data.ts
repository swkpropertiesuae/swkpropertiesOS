import fs from 'node:fs'
import path from 'node:path'
import { db, q, tx, inDemo, qi, tableExists } from '../db'
import { dirs, BACKUP_EXT } from '../config'
import { ENTITIES } from '../../shared/entities'
import { audit, createRecord, getDef, SYSTEM_CTX, type Ctx, type Rec } from '../engine'
import { getSetting, setSettings, SETTING_DEFAULTS } from '../settings'
import { bad, nowIso, todayStr, addDays } from '../util'
import { postInvoice, setNextInvoiceNumber } from './finance'

export const BUSINESS_ENTITIES: { group: string; keys: string[] }[] = [
  { group: 'Customers, CRM and sales', keys: ['parties', 'contacts', 'campaigns', 'leads', 'opportunities', 'activities', 'whatsapp_messages', 'rate_cards', 'quotations', 'contracts', 'carrier_rfqs', 'rfq_offers'] },
  { group: 'Properties, deals and mandates', keys: ['properties', 'units', 'communities', 'developers', 'mandates', 'viewings', 'offers', 'jobs', 'sales_contracts', 'escrow_accounts', 'escrow_transactions', 'leases', 'rent_schedules', 'rent_receipts', 'service_charges', 'maintenance', 'inspections', 'handovers', 'snagging_items', 'property_visits'] },
  { group: 'Invoices, bills and banking', keys: ['invoices', 'bills', 'receipts', 'payments', 'bank_transactions', 'expenses', 'purchase_orders', 'owner_statements', 'agent_commissions'] },
  { group: 'People and HR', keys: ['employees', 'agents', 'leave_requests', 'attendance', 'payslips'] },
  { group: 'Support, work and AI', keys: ['tickets', 'claims', 'tasks', 'work_items', 'ai_runs', 'ai_actions', 'workflow_runs', 'email_outbox'] },
]

const SYSTEM_TABLES_BY_RECORD = ['comments', 'record_refs', 'record_tags', 'record_links', 'record_likes', 'video_calls']
const KEPT_JOURNAL_SOURCES = ['Manual', 'Year-end close']

export function businessTables(): string[] {
  const seen = new Set<string>()
  const add = (key: string) => {
    const def = ENTITIES[key]
    if (!def || seen.has(key)) return
    seen.add(key)
    for (const c of def.children ?? []) add(c.entity)
  }
  for (const g of BUSINESS_ENTITIES) for (const k of g.keys) add(k)
  return [...seen].filter(tableExists)
}

export interface ResetSummary { group: string; table: string; label: string; count: number }
export function businessDataSummary(): { rows: ResetSummary[]; journals: number; total: number } {
  const rows: ResetSummary[] = []
  const wanted = new Set(businessTables())
  for (const g of BUSINESS_ENTITIES) {
    const keys = new Set<string>()
    const walk = (k: string) => { if (!ENTITIES[k] || keys.has(k)) return; keys.add(k); for (const c of ENTITIES[k].children ?? []) walk(c.entity) }
    g.keys.forEach(walk)
    for (const k of keys) if (wanted.has(k) && !ENTITIES[k].child) rows.push({ group: g.group, table: k, label: ENTITIES[k].plural, count: q.val<number>(`SELECT COUNT(*) FROM ${qi(k)} WHERE deleted_at IS NULL`) ?? 0 })
  }
  const linkedDocs = q.val<number>(`SELECT COUNT(*) FROM studio_documents WHERE deleted_at IS NULL AND (party_id IS NOT NULL OR job_id IS NOT NULL)`) ?? 0
  rows.push({ group: 'Properties, deals and mandates', table: 'studio_documents', label: 'Studio documents linked to deals/properties', count: linkedDocs })
  const journals = q.val<number>(`SELECT COUNT(*) FROM journal_entries WHERE deleted_at IS NULL AND ${journalCondition()}`, ...KEPT_JOURNAL_SOURCES, ...KEPT_JOURNAL_SOURCES) ?? 0
  return { rows, journals, total: rows.reduce((s, r) => s + r.count, 0) + journals }
}

const journalCondition = () => `source_type NOT IN (${KEPT_JOURNAL_SOURCES.map(() => '?').join(',')}) AND NOT (source_type = 'Reversal' AND source_id IN (SELECT id FROM journal_entries WHERE source_type IN (${KEPT_JOURNAL_SOURCES.map(() => '?').join(',')})))`

export async function backupBeforeReset(label = 'before-reset'): Promise<string> {
  const name = `digitalburj-${label}-${nowIso().replace(/[:.]/g, '-').slice(0, 19)}${BACKUP_EXT}`
  fs.mkdirSync(dirs.backups, { recursive: true })
  await db.backup(path.join(dirs.backups, name))
  return name
}

export async function resetBusinessData(ctx: Ctx, opts: { backup?: boolean } = {}): Promise<{ backup: string; deleted: Record<string, number>; files_removed: number; total: number }> {
  if (inDemo()) throw bad('The demo workspace cannot be reset here. Use "Reset demo now".')
  const backup = opts.backup === false ? '' : await backupBeforeReset()
  const tables = businessTables()
  const top = [...new Set(BUSINESS_ENTITIES.flatMap(g => g.keys))].filter(k => ENTITIES[k])
  const deleted: Record<string, number> = {}
  let files = 0
  const stored: string[] = []
  tx(() => {
    if (tableExists('attachments')) {
      for (const f of q.all<{ stored_name: string }>(`SELECT stored_name FROM attachments WHERE link_entity IN (${top.map(() => '?').join(',')})`, ...top)) stored.push(f.stored_name)
      deleted.attachments = q.run(`DELETE FROM attachments WHERE link_entity IN (${top.map(() => '?').join(',')})`, ...top).changes
    }
    for (const t of SYSTEM_TABLES_BY_RECORD) deleted[t] = q.run(`DELETE FROM ${qi(t)} WHERE entity IN (${top.map(() => '?').join(',')})`, ...top).changes
    deleted.compliance_exceptions = q.run(`DELETE FROM compliance_exceptions WHERE link_entity IN (${top.map(() => '?').join(',')})`, ...top).changes
    deleted.notifications = q.run(`DELETE FROM notifications`).changes
    for (const t of ['job_tracking_tokens', 'job_closure_evidence', 'job_reopen_requests', 'approval_requests']) deleted[t] = q.run(`DELETE FROM ${qi(t)}`).changes
    const cond = journalCondition(), args = [...KEPT_JOURNAL_SOURCES, ...KEPT_JOURNAL_SOURCES]
    q.run(`DELETE FROM journal_lines WHERE entry_id IN (SELECT id FROM journal_entries WHERE ${cond})`, ...args)
    deleted.journal_entries = q.run(`DELETE FROM journal_entries WHERE ${cond}`, ...args).changes
    q.run(`UPDATE journal_lines SET party_id = NULL, job_id = NULL WHERE party_id IS NOT NULL OR job_id IS NOT NULL`)
    for (const t of tables) {
      if (ENTITIES[t].child) deleted[t] = q.run(`DELETE FROM ${qi(t)}`).changes
    }
    for (const t of tables) {
      if (!ENTITIES[t].child) deleted[t] = q.run(`DELETE FROM ${qi(t)}`).changes
    }
    deleted.studio_documents = q.run(`DELETE FROM studio_documents WHERE party_id IS NOT NULL OR job_id IS NOT NULL`).changes
    for (const t of SYSTEM_TABLES_BY_RECORD) q.run(`DELETE FROM ${qi(t)} WHERE entity = 'studio_documents' AND record_id NOT IN (SELECT id FROM studio_documents)`)
    for (const f of q.all<{ stored_name: string }>(`SELECT stored_name FROM attachments WHERE link_entity = 'studio_documents' AND link_id NOT IN (SELECT id FROM studio_documents)`)) stored.push(f.stored_name)
    q.run(`DELETE FROM attachments WHERE link_entity = 'studio_documents' AND link_id NOT IN (SELECT id FROM studio_documents)`)
    for (const t of tables) q.run(`DELETE FROM sequences WHERE key LIKE ?`, `${t}|%`)
    q.run(`DELETE FROM sequences WHERE key LIKE 'invoices:series|%'`)
    setSettings({ lock_date: '' })
    q.run(`DELETE FROM settings WHERE key = ?`, MARK)
    audit(ctx, getDef('branches'), 0, 'business-reset', { removed: [null, Object.values(deleted).reduce((s, n) => s + n, 0)], backup: [null, backup || 'none'] }, 'Business data reset')
  })
  for (const s of stored) {
    if (!s || s.includes('..') || path.isAbsolute(s) || /^[a-z]+:/i.test(s)) continue
    try { fs.rmSync(path.join(dirs.uploads, s), { force: true }); files++ } catch { }
  }
  return { backup, deleted, files_removed: files, total: Object.values(deleted).reduce((s, n) => s + n, 0) }
}

export const STARTER_MARK = 'seed:digitalburj-starter-2026'
export const STARTER_DECLINED = 'seed:digitalburj-starter-declined'
const MARK = STARTER_MARK
const hasKey = (k: string) => !!q.val(`SELECT 1 FROM settings WHERE key = ?`, k)
export const starterLoaded = () => hasKey(MARK)
export const starterDeclined = () => hasKey(STARTER_DECLINED)
export const declineStarter = () => q.run(`INSERT INTO settings(key, value, updated_at) VALUES (?, '1', ?) ON CONFLICT(key) DO NOTHING`, STARTER_DECLINED, nowIso())
export const clearStarterDeclined = () => q.run(`DELETE FROM settings WHERE key = ?`, STARTER_DECLINED)


export async function loadDigitalBurjStarterData(ctx: Ctx = SYSTEM_CTX): Promise<{ loaded: boolean; reason?: string }> {
  if (inDemo()) return { loaded: false, reason: 'demo workspace' }
  if (starterLoaded()) return { loaded: false, reason: 'already loaded' }
  
  const { seedDemoScenarios } = await import("../seed/demo")
  seedDemoScenarios()
  
  q.run(`INSERT INTO settings(key, value, updated_at) VALUES (?, '1', ?) ON CONFLICT(key) DO NOTHING`, MARK, nowIso())
  return { loaded: true }
}