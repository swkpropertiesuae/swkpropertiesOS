import { q } from '../db'
import { nowIso } from '../util'
import { bad } from '../util'
import { getDef, getRecord, createRecord, patchRecord, assertCan, SYSTEM_CTX, type Ctx, type Rec } from '../engine'

const entityActivity: Record<string, string> = {
  jobs: 'Deal update', leads: 'New lead', opportunities: 'Opportunity', activities: 'Activity',
  invoices: 'Invoice', bills: 'Bill', receipts: 'Receipt', payments: 'Payment',
  contracts: 'Contract', tickets: 'Ticket', claims: 'Claim', tasks: 'Task',
  leases: 'Lease', viewings: 'Viewing', handovers: 'Handover', maintenance: 'Maintenance',
}

const doneByEntity: Record<string, string> = { jobs: 'Completed', leads: 'Converted', opportunities: 'Won', activities: 'Done',
  invoices: 'Paid', bills: 'Paid', receipts: 'Posted', payments: 'Posted',
  contracts: 'Signed', tickets: 'Closed', claims: 'Settled', tasks: 'Done',
  leases: 'Active', viewings: 'Completed', handovers: 'Completed', maintenance: 'Completed' }

const active = (s: string) => !['Done', 'Completed', 'Closed', 'Paid', 'Cancelled', 'Settled', 'Won', 'Lost'].some(d => s.includes(d))

export function createWorkItemFrom(entity: string, rec: Rec, ctx: Ctx) {
  const activity = entityActivity[entity] ?? entity
  const done = doneByEntity[entity] ?? 'Done'
  const department = q.val<number>(`SELECT department_id FROM users WHERE id = ?`, rec.assignee_id ?? rec.operator_id ?? rec.agent_id ?? rec.created_by)
  const owner = rec.assignee_id ?? rec.operator_id ?? rec.agent_id ?? rec.created_by
  if (!owner) return
  const key = `${entity}:${rec.id}`
  const existing = q.get(`SELECT id, status FROM work_items WHERE dedupe_key = ? AND deleted_at IS NULL`, key)
  if (existing) {
    if (done && active(existing.status)) patchRecord(getDef('work_items'), existing.id, { status: done, completed_at: nowIso(), resolution: 'Source workflow completed automatically', paused_at: null }, SYSTEM_CTX)
    return
  }
  createRecord(getDef('work_items'), { title: `${activity}: ${rec._title}`, source_entity: entity, source_id: rec.id, activity, department_id: department, assignee_id: owner, complexity: 1, dedupe_key: key }, SYSTEM_CTX)
}

export const workHooks = {
  beforeSave({ rec, old, isNew, ctx }: any) {
    if (isNew) rec.status = 'Open'
    if (!isNew && old?.status !== rec.status && rec.status === 'Completed' && !rec.completed_at) rec.completed_at = nowIso()
    if (rec.assignee_id && rec.assignee_id !== ctx.user?.id) {
      const u = q.get(`SELECT name FROM users WHERE id = ?`, rec.assignee_id)
      if (u) { /* notify */ }
    }
  },
}

export const slaHooks = {}

// ---------------------------------------------------------------- syncWorkQueues for Real Estate

function sourceDone(entity: string, rec: Rec, activity: string) {
  if (entity === 'jobs') return rec.job_status === 'Completed' ? 'Completed' : 'In progress'
  if (entity === 'leases') return rec.status === 'Active' ? 'Completed' : 'In progress'
  if (entity === 'mandates') return rec.status === 'Completed' ? 'Completed' : 'In progress'
  if (entity === 'invoices') return rec.status === 'Paid' ? 'Completed' : 'In progress'
  if (entity === 'bills') return rec.status === 'Paid' ? 'Completed' : 'In progress'
  if (entity === 'tickets') return rec.status === 'Closed' ? 'Completed' : 'In progress'
  if (entity === 'tasks') return rec.status === 'Done' ? 'Completed' : 'In progress'
  return 'In progress'
}

function eligibleForActivity(userId: number, activity: string, departmentId: number) {
  return q.get(`SELECT 1 FROM staff_qualifications WHERE user_id = ? AND department_id = ? AND (activity = ? OR activity = 'All') AND deleted_at IS NULL`, userId, departmentId, activity)
}

export function syncWorkQueues(entity: string, rec: Rec) {
  let activity = '', code = 'OPS', owner = rec.operator_id ?? rec.owner_id ?? rec.agent_id ?? rec.created_by
  if (entity === 'jobs') { activity = 'Deal update'; code = 'SAL'; owner = rec.agent_id ?? rec.created_by }
  else if (entity === 'mandates') { activity = 'Mandate update'; code = 'SAL'; owner = rec.agent_id ?? rec.created_by }
  else if (entity === 'leases') { activity = 'Lease update'; code = 'PM'; owner = rec.agent_id ?? rec.created_by }
  else if (entity === 'invoices') { activity = 'Invoice'; code = 'ACC'; owner = rec.created_by }
  else if (entity === 'bills') { activity = 'Bill'; code = 'ACC'; owner = rec.created_by }
  else if (entity === 'tickets') { activity = 'Ticket'; code = 'SUP'; owner = rec.assigned_to ?? rec.created_by }
  else if (entity === 'tasks') { activity = 'Task'; code = 'PRJ'; owner = rec.assignee_id ?? rec.created_by }
  else return
  
  const key = `${entity}:${rec.id}:${activity}`
  const existing = q.get(`SELECT id, status FROM work_items WHERE dedupe_key = ? AND deleted_at IS NULL`, key)
  const done = sourceDone(entity, rec, activity)
  if (existing) { if (done && active(existing.status)) patchRecord(getDef('work_items'), existing.id, { status: done, completed_at: nowIso(), resolution: 'Source workflow completed automatically', paused_at: null }, SYSTEM_CTX); return }
  if (done) return
  const department = q.val<number>(`SELECT id FROM departments WHERE code = ? AND deleted_at IS NULL`, code) ?? q.val<number>(`SELECT id FROM departments WHERE deleted_at IS NULL ORDER BY id LIMIT 1`)
  if (!department) return
  const u = owner ? q.get(`SELECT * FROM users WHERE id = ?`, owner) : null
  if (!u || u.party_id) owner = null
  if (owner && !eligibleForActivity(owner, activity, department)) owner = null
  createRecord(getDef('work_items'), { title: `${activity}: ${rec._title}`, source_entity: entity, source_id: rec.id, activity, department_id: department, assignee_id: owner, complexity: 1, dedupe_key: key }, SYSTEM_CTX)
}
