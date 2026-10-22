import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { q, tx } from '../db'
import { assertCan, patchRecord, createRecord } from '../engine'
import { bad, todayStr } from '../util'

export default async function (app: FastifyInstance) {
  // High-risk operation approval request
  app.post('/api/approval/request', async (req) => {
    const b = z.object({
      entity: z.string().min(1),
      record_id: z.number().int().min(1),
      action: z.enum(['create', 'update', 'delete', 'execute']),
      reason: z.string().min(10).max(500),
      requested_by: z.number().int(),
    }).parse(req.body)

    // Check if already pending
    const existing = q.get(
      `SELECT * FROM approval_requests WHERE entity = ? AND record_id = ? AND status = 'Pending'`,
      b.entity, b.record_id
    )

    if (existing) {
      return { existing, message: 'Approval already pending for this record' }
    }

    // Create approval request
    const result = q.run(
      `INSERT INTO approval_requests (entity, record_id, requested_by, requested_at, status) 
       VALUES (?, ?, ?, ?, 'Pending')`,
      b.entity, b.record_id, b.requested_by, todayStr()
    )

    // Notify approvers (simplified - would integrate with notification service)
    // notifyRole('admins', `Approval requested: ${b.entity} #${b.record_id}`, '')

    return {
      id: result.lastID,
      entity: b.entity,
      record_id: b.record_id,
      action: b.action,
      status: 'Pending',
      requested_at: todayStr(),
      reason: b.reason,
    }
  })

  // Approval action (approve/reject)
  app.post('/api/approval/act', async (req) => {
    const b = z.object({
      approval_id: z.number().int().min(1),
      action: z.enum(['approve', 'reject']),
      approved_by: z.number().int(),
      comments: z.string().max(500).optional(),
    }).parse(req.body)

    const approval = q.get(
      `SELECT * FROM approval_requests WHERE id = ?`,
      b.approval_id
    )

    if (!approval) {
      return bad('Approval request not found')
    }

    if (approval.status !== 'Pending') {
      return bad(`Approval already processed: ${approval.status}`)
    }

    // Execute based on action
    if (b.action === 'approve') {
      // Patch the related record
      // This is simplified - real implementation would map entity to patch operations
      await patchRecord(
        getDef(approval.entity),
        approval.record_id,
        { status: 'Approved', approved_at: todayStr(), approved_by: b.approved_by },
        { system: true }
      )
    }

    // Update approval status
    q.run(
      `UPDATE approval_requests SET status = ?, approved_by = ?, approved_at = ?, comments = ? 
       WHERE id = ?`,
      b.action === 'approve' ? 'Approved' : 'Rejected',
      b.approved_by,
      todayStr(),
      b.comments,
      b.approval_id
    )

    // Notify requester
    // notifyRole('agents', `Approval ${b.action}: ${approval.entity} #${approval.record_id}`, '')

    return {
      approval_id: b.approval_id,
      status: b.action === 'approve' ? 'Approved' : 'Rejected',
      approved_at: todayStr(),
      comments: b.comments,
    }
  })

  // Get pending approvals for user
  app.get('/api/approval/pending', async (req) => {
    const userId = req.user?.id
    if (!userId) return bad('User not authenticated')

    const rows = q.all(
      `SELECT ar.*, u.name AS requester_name 
       FROM approval_requests ar 
       LEFT JOIN users u ON ar.requested_by = u.id 
       WHERE ar.status = 'Pending' 
       AND (ar.approved_by IS NULL OR ar.approved_by = ?)
       ORDER BY ar.requested_at DESC`,
      userId
    )

    return { pending: rows }
  })

  // Get approval history
  app.get('/api/approval/history', async (req) => {
    const entity = req.query.entity as string
    const recordId = req.query.record_id ? Number(record_id) : undefined

    let where = 'WHERE 1=1'
    const params: any[] = []

    if (entity) {
      where += ' AND entity = ?'
      params.push(entity)
    }

    if (recordId !== undefined) {
      where += ' AND record_id = ?'
      params.push(recordId)
    }

    const rows = q.all(
      `SELECT ar.*, u.name AS approver_name, u2.name AS requester_name 
       FROM approval_requests ar 
       LEFT JOIN users u ON ar.approved_by = u.id 
       LEFT JOIN users u2 ON ar.requested_by = u2.id 
       ${where}
       ORDER BY ar.approved_at DESC
       LIMIT 200`,
      ...params
    )

    return { history: rows }
  })
}
