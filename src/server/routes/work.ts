import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { tx } from '../db'
import { getDef, listRecords, assertCan, patchRecord } from '../engine'
import { idOf } from './helpers'
import { createRecord, SYSTEM_CTX } from '../engine'
import { getRecord } from '../engine'
import { bad, notFound } from '../util'
import { q } from '../db'
import { nowIso } from '../util'
import { loadUser } from '../auth'
import { can } from '../engine'

export default async function (app: FastifyInstance) {
  app.get('/api/work/overview', async req => {
    assertCan(req.ctx, 'projects', 'view')
    const items = listRecords(getDef('work_items'), { pageSize: 10000 }, req.ctx).rows
    const team = req.user && q.get(`SELECT 1 FROM roles WHERE id = (SELECT role_id FROM users WHERE id = ?) AND name = 'Admin'`, req.user.id)
    const userRows = team ? q.all(`SELECT id, name, department_id, work_capacity_points FROM users WHERE active = 1 AND party_id IS NULL AND deleted_at IS NULL`) : q.all(`SELECT id, name, department_id, work_capacity_points FROM users WHERE id = ? AND active = 1 AND deleted_at IS NULL`, req.user!.id)
    const workload = userRows.map(u => {
      const assigned = items.filter(i => i.assignee_id === u.id && ['Open', 'In progress', 'Waiting'].includes(i.status))
      const jobs = can(req.ctx.user!, 'sales', 'view') ? q.val<number>(`SELECT COUNT(*) FROM jobs WHERE agent_id = ? AND job_status NOT IN ('Completed','Cancelled') AND deleted_at IS NULL`, u.id) ?? 0 : 0
      const tasks = q.val<number>(`SELECT COUNT(*) FROM tasks WHERE assignee_id = ? AND status NOT IN ('Done','Cancelled') AND deleted_at IS NULL`, u.id) ?? 0
      const points = assigned.reduce((n, i) => n + (i.complexity || 1), 0) + jobs * 2 + tasks
      const capacity = u.work_capacity_points || 40
      return { ...u, work_items: assigned.length, jobs, tasks, overdue: assigned.filter(i => i.due_at && i.due_at < nowIso() && !i.paused_at).length, points, capacity, utilization: Math.round(points / capacity * 100) }
    })
    return { items, workload, recommendations: [], can_manage: !!team, departments: q.all(`SELECT id, name FROM departments WHERE deleted_at IS NULL AND active = 1`) }
  })

  app.post('/api/work/items/:id/transition', async req => {
    const team = req.user && q.get(`SELECT 1 FROM roles WHERE id = (SELECT role_id FROM users WHERE id = ?) AND name = 'Admin'`, req.user.id)
    const b = z.object({ status: z.enum(['In progress', 'Waiting', 'Completed', 'Cancelled']), note: z.string().trim().max(2000).default('') }).parse(req.body)
    return tx(() => {
      const def = getDef('work_items')
      const r = getRecord(def, idOf((req.params as any).id), req.ctx, { children: false })
      if (!['Open', 'In progress', 'Waiting'].includes(r.status)) throw bad('Finished work cannot be transitioned')
      if (r.assignee_id !== req.user!.id && !team) throw bad('Only the owner or queue manager can change work state')
      if (!['In progress', 'Waiting', 'Completed', 'Cancelled'].includes(b.status)) throw bad('Unknown work status')
      if (b.status === r.status) throw bad('Work is already in this state')
      if (b.status === 'In progress' && r.assignee_id) throw bad('Owner no longer meets activity qualification rules')
      if (['Completed', 'Cancelled'].includes(b.status) && b.note.trim().length < 10) throw bad('Record a resolution of at least 10 characters')
      const patch: any = { status: b.status, resolution: b.note || r.resolution }
      if (b.status === 'Waiting' && !r.paused_at) patch.paused_at = nowIso()
      else if (r.paused_at && b.status !== 'Waiting') { patch.paused_at = null; if (r.due_at) patch.due_at = new Date(new Date(r.due_at).getTime() + Date.now() - new Date(r.paused_at).getTime()).toISOString() }
      if (!['Open', 'In progress', 'Waiting'].includes(b.status)) patch.completed_at = nowIso()
      return patchRecord(def, r.id, patch, req.ctx)
    })
  })
}