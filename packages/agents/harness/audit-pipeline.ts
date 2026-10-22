import type { Hooks } from '../hooks'
import { q } from '../db'
import type { Rec, Def } from '../engine'
import { nowLocal } from '../util'

// Append-only audit event types
export enum AuditEventType {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  EXECUTE = 'EXECUTE',
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
}

// Audit event record interface
export interface AuditEvent {
  id: number
  entity: string
  record_id: number
  action: AuditEventType
  user_id: number | null
  tenant_id: number
  previous_state: string | null
  new_state: string
  timestamp: string
  ip_address: string | null
  user_agent: string | null
  request_id: string
  metadata: Record<string, any>
}

// Create audit event in append-only table
export const createAuditEvent = async (
  entity: string,
  recordId: number,
  action: AuditEventType,
  userId: number | null,
  tenantId: number,
  previousState: string | null,
  newState: string,
  req: any,
  metadata?: Record<string, any>
): Promise<AuditEvent> => {
  const ipAddress = req.ip || req.socket?.remoteAddress || null
  const userAgent = req.get('User-Agent') || null
  const requestId = req?.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  const event: AuditEvent = {
    id: 0, // Will be set by database insert
    entity,
    record_id: recordId,
    action,
    user_id: userId,
    tenant_id: tenantId,
    previous_state: previousState,
    new_state: newState,
    timestamp: nowLocal(),
    ip_address: ipAddress,
    user_agent: userAgent,
    request_id: requestId,
    metadata: metadata || {},
  }

  // Insert into append-only audit_events table
  const result = q.run(
    `INSERT INTO audit_events (entity, record_id, action, user_id, tenant_id, previous_state, new_state, timestamp, ip_address, user_agent, request_id, metadata) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      event.entity,
      event.record_id,
      event.action,
      event.user_id,
      event.tenant_id,
      event.previous_state,
      event.new_state,
      event.timestamp,
      event.ip_address,
      event.user_agent,
      event.request_id,
      JSON.stringify(event.metadata),
    ]
  )

  event.id = result.lastID as number

  return event
}

// Hook to automatically audit entity operations
export const entityAuditHooks: Hooks = {
  beforeCreate: async ({ rec, ctx }) => {
    // Record creation audit
    const req = ctx?.req
    if (req) {
      await createAuditEvent(
        ctx.def?.key ?? 'unknown',
        rec.id ?? 0,
        AuditEventType.CREATE,
        ctx.user?.id ?? null,
        ctx.user?.tenant_id ?? 0,
        null,
        JSON.stringify(rec),
        req
      )
    }
    return rec
  },

  beforeUpdate: async ({ rec, old, ctx }) => {
    // Record update audit
    const req = ctx?.req
    if (req) {
      await createAuditEvent(
        ctx.def?.key ?? 'unknown',
        rec.id ?? 0,
        AuditEventType.UPDATE,
        ctx.user?.id ?? null,
        ctx.user?.tenant_id ?? 0,
        JSON.stringify(old),
        JSON.stringify(rec),
        req
      )
    }
    return rec
  },

  beforeDelete: async ({ rec, ctx }) => {
    // Record deletion audit
    const req = ctx?.req
    if (req) {
      await createAuditEvent(
        ctx.def?.key ?? 'unknown',
        rec.id ?? 0,
        AuditEventType.DELETE,
        ctx.user?.id ?? null,
        ctx.user?.tenant_id ?? 0,
        JSON.stringify(rec),
        'Deleted',
        req
      )
    }
    return rec
  },

  // Execute action audit (for sandboxed code)
  onExecute: async ({ result, ctx }) => {
    const req = ctx?.req
    if (req) {
      await createAuditEvent(
        'sandbox',
        result?.fileHash ?? 0,
        AuditEventType.EXECUTE,
        ctx.user?.id ?? null,
        ctx.user?.tenant_id ?? 0,
        null,
        `Execution ${result?.success ? 'success' : 'failed'}: ${result?.error || ''}`,
        req,
        { executionTime: result?.executionTime, memoryUsed: result?.memoryUsed }
      )
    }
  },
}

// Get audit events with filtering
export const getAuditEvents = async (
  filters: {
    entity?: string
    action?: AuditEventType
    tenantId?: number
    userId?: number
    startDate?: string
    endDate?: string
    recordId?: number
  },
  pagination: { page?: number; pageSize?: number } = { page: 1, pageSize: 100 }
) => {
  let where = 'WHERE 1=1'
  const params: any[] = []

  if (filters.entity) {
    where += ' AND entity = ?'
    params.push(filters.entity)
  }

  if (filters.action !== undefined) {
    where += ' AND action = ?'
    params.push(filters.action)
  }

  if (filters.tenantId !== undefined) {
    where += ' AND tenant_id = ?'
    params.push(filters.tenantId)
  }

  if (filters.userId !== undefined) {
    where += ' AND user_id = ?'
    params.push(filters.userId)
  }

  if (filters.recordId !== undefined) {
    where += ' AND record_id = ?'
    params.push(filters.recordId)
  }

  if (filters.startDate) {
    where += ' AND timestamp >= ?'
    params.push(filters.startDate)
  }

  if (filters.endDate) {
    where += ' AND timestamp <= ?'
    params.push(filters.endDate)
  }

  // Count total
  const countRow = q.get(
    `SELECT COUNT(*) as total FROM audit_events ${where}`,
    ...params
  )
  const total = countRow?.total || 0

  // Get page
  const offset = (pagination.page - 1) * pagination.pageSize
  const rows = q.all(
    `SELECT ae.*, u.name AS user_name 
     FROM audit_events ae 
     LEFT JOIN users u ON ae.user_id = u.id
     ${where}
     ORDER BY ae.timestamp DESC
     LIMIT ? OFFSET ?
     ?,
     pagination.pageSize,
     offset
    `,
    ...params,
    pagination.pageSize,
    offset
  )

  return { total, rows }
}

// Get audit event by ID
export const getAuditEventById = async (eventId: number) => {
  return q.get(
    `SELECT ae.*, u.name AS user_name, u2.name AS tenant_name 
     FROM audit_events ae 
     LEFT JOIN users u ON ae.user_id = u.id 
     LEFT JOIN users u2 ON ae.tenant_id = u2.id
     WHERE ae.id = ?`,
    eventId
  )
}

// Export audit event type for use in hooks
export { AuditEventType }
