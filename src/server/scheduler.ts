
import { processWorkflowQueue } from './automation'
import { runInDb } from './db'
import { getDemoDb } from './demo/workspace'
import { q } from './db'
import { addDays, nowIso, todayStr } from './util'
import { notify, notifyRole } from './notify'
import { processOutbox } from './mailer'
import { getSetting } from './settings'
import { complianceDaily } from './domain/compliance'
import { nowLocal } from './util'

export function startScheduler() {
  const workflowTick = async () => {
    try { await processWorkflowQueue();  const demo = getDemoDb(); if (demo) await runInDb(demo, async () => { await processWorkflowQueue();  }) } catch (e) { console.error('workflow queue', e) }
  }
  setInterval(() => void workflowTick(), 15000).unref()
  setTimeout(() => void workflowTick(), 2000).unref()
  const tick = () => { try { daily() } catch (e) { console.error('scheduler', e) } }
  setTimeout(tick, 8_000)
  setInterval(tick, 60 * 60 * 1000).unref()
  setInterval(() => { void processOutbox() }, 60 * 1000).unref()
  setInterval(() => { void periodic() }, 5 * 60 * 1000).unref()
  setTimeout(() => { void periodic() }, 20_000)
}

const done = new Map<string, string>()
const once = (key: string, stamp: string) => { if (done.get(key) === stamp) return false; done.set(key, stamp); return true }

async function periodic() {
  const now = nowLocal(), hhmm = now.slice(11, 16), day = now.slice(0, 10)
  const safe = async (name: string, fn: () => Promise<unknown>) => { try { await fn() } catch (e) { console.error('periodic', name, e) } }
  if (getSetting('supabase_sync') && once('sb', now.slice(0, 15))) await safe('supabase', async () => (await import('./integrations/supabase')).syncToSupabase())
  if (once('ai', now.slice(0, 13))) await safe('agents', async () => (await import('./ai/agents')).runDueAgents())
  if (hhmm >= '03:00' && hhmm < '05:00' && once('demo-rebuild', day)) await safe('demo', async () => (await import('./demo/workspace')).rebuildDemoWorkspace())
  if (hhmm >= '02:00' && hhmm < '05:00' && once('voice-retention', day)) await safe('voice-retention', async () => (await import('./integrations/voice')).purgeVoiceData())
  if (hhmm >= '07:30' && once('wa-report', day)) await safe('wa-report', async () => (await import('./integrations/whatsapp')).ownerDailyReport())
  if (hhmm >= '10:00' && once('wa-overdue', day)) await safe('wa-overdue', async () => (await import('./integrations/whatsapp')).overdueReminders())
  if (hhmm >= '02:00' && hhmm < '05:00' && getSetting('r2_backup_nightly') && once('r2-backup', day)) await safe('r2-backup', async () => {
    const r = await import('./routes/integrations'); const name = await r.backupToR2(); const { logIntegration } = await import('./integrations/log'); logIntegration('backup', 'nightly', true, `Backup ${name} created${getSetting('r2_account_id') ? ' and uploaded to R2' : ''}`)
    const fs = await import('node:fs'), path = await import('node:path'), { dirs, isBackupFile } = await import('./config')
    for (const f of fs.readdirSync(dirs.backups).filter(isBackupFile).sort().slice(0, -14)) fs.rmSync(path.join(dirs.backups, f), { force: true })
  })
}

export function daily() {
  const today = todayStr()
  q.run(`UPDATE quotations SET status = 'Expired' WHERE status = 'Sent' AND valid_until < ? AND deleted_at IS NULL`, today)
  q.run(`UPDATE contracts SET status = 'Expired' WHERE status = 'Active' AND end_date < ? AND deleted_at IS NULL`, today)
  for (const t of q.all(`SELECT id, title, assignee_id, due_date FROM tasks WHERE status <> 'Done' AND deleted_at IS NULL AND assignee_id IS NOT NULL AND due_date <= ?`, today))
    notify(t.assignee_id, t.due_date < today ? `Overdue: ${t.title}` : `Due today: ${t.title}`, `Due ${t.due_date}`, `/e/tasks/${t.id}`, 'task', `task-${t.id}-${today}`)
  const due = q.val<number>(`SELECT COUNT(*) FROM invoices WHERE status IN ('Posted','Partially paid') AND doc_type IN ('Tax Invoice','Debit Note') AND balance > 0 AND due_date < ? AND deleted_at IS NULL`, today) ?? 0
  if (due) notifyRole('finance', `${due} invoices are overdue`, 'Review the receivables ageing report', '/reports?r=ar_aging', 'info', `overdue-${today}`)
  // Lease expiries
  const exp = q.all(`SELECT l.id, l.unit_id, l.end_date, p.name as tenant, u.name as agent FROM leases l JOIN parties p ON p.id = l.tenant_id LEFT JOIN users u ON u.id = l.agent_id WHERE l.status IN ('Active','Ejari Registered') AND l.end_date BETWEEN ? AND ? AND l.deleted_at IS NULL`, today, addDays(today, 90))
  for (const l of exp) { if (l.agent) notify(l.agent, `Lease expiring: Unit ${l.unit_id}`, `Expires ${l.end_date} for ${l.tenant}`, `/e/leases/${l.id}`, 'info', `lease-exp-${l.id}-${l.end_date}`) }
  // Contract expiries
  const cexp = q.all(`SELECT id, title, end_date FROM contracts WHERE status = 'Active' AND end_date BETWEEN ? AND ? AND deleted_at IS NULL`, today, addDays(today, 60))
  for (const c of cexp) notifyRole('sales', `Contract expiring: ${c.title}`, `Ends ${c.end_date}`, `/e/contracts/${c.id}`, 'info', `contract-exp-${c.id}-${c.end_date}`)
  complianceDaily()
}
