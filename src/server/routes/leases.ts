import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { q, tx } from '../db'
import { assertCan, createRecord, deleteRecord, getDef, getRecord, listRecords, patchRecord, SYSTEM_CTX, audit } from '../engine'
import { bad, notFound, nowLocal, todayStr } from '../util'
import { body, idOf, need } from './helpers'
import { queueEmail } from '../mailer'
import { getSetting } from '../settings'

export default async function (app: FastifyInstance) {
  const leaseDef = () => getDef('leases')
  const rentScheduleDef = () => getDef('rent_schedules')
  const rentReceiptDef = () => getDef('rent_receipts')
  const serviceChargeDef = () => getDef('service_charges')
  const maintenanceDef = () => getDef('maintenance')
  const inspectionDef = () => getDef('inspections')
  const handoverDef = () => getDef('handovers')

  const loadLease = (req: any, edit = false) => {
    const id = idOf(req.params.id)
    if (edit) assertCan(req.ctx, 'leases', 'edit')
    return { id, lease: getRecord(leaseDef(), id, req.ctx, { children: true }) }
  }

  const loadRentSchedule = (req: any, edit = false) => {
    const id = idOf(req.params.id)
    if (edit) assertCan(req.ctx, 'leases', 'edit')
    return { id, schedule: getRecord(rentScheduleDef(), id, req.ctx, { children: false }) }
  }

  const loadRentReceipt = (req: any, edit = false) => {
    const id = idOf(req.params.id)
    if (edit) assertCan(req.ctx, 'leases', 'edit')
    return { id, receipt: getRecord(rentReceiptDef(), id, req.ctx, { children: false }) }
  }

  // Lease status transitions
  app.post('/api/leases/:id/activate', async (req) => {
    const { id, lease } = loadLease(req, true)
    if (lease.status !== 'Draft') throw bad('Only draft leases can be activated')
    return patchRecord(leaseDef(), id, { status: 'Active', last_activity: nowLocal() }, req.ctx)
  })

  app.post('/api/leases/:id/terminate', async (req) => {
    const { id, lease } = loadLease(req, true)
    if (!['Active', 'Vacant'].includes(lease.status)) throw bad('Only active or vacant leases can be terminated')
    const b = z.object({ termination_date: z.string().date(), reason: z.string().min(10).max(1000) }).parse(req.body)
    return patchRecord(leaseDef(), id, { status: 'Terminated', termination_date: b.termination_date, reason: b.reason }, req.ctx)
  })

  app.post('/api/leases/:id/renew', async (req) => {
    const { id, lease } = loadLease(req, true)
    if (lease.status !== 'Active') throw bad('Only active leases can be renewed')
    const b = z.object({ new_term_end: z.string().date(), new_rent_amount: z.number().positive().optional(), new_rent_frequency: z.enum(['Monthly', 'Quarterly', 'Semi-Annual', 'Annual']).optional() }).parse(req.body)
    return patchRecord(leaseDef(), id, { status: 'Renewed', last_activity: nowLocal(), new_term_end: b.new_term_end, new_rent_amount: b.new_rent_amount ?? lease.rent_amount, new_rent_frequency: b.new_rent_frequency ?? lease.rent_frequency }, req.ctx)
  })

  app.post('/api/leases/:id/cancel', async (req) => {
    const { id, lease } = loadLease(req, true)
    const b = z.object({ reason: z.string().min(10).max(1000) }).parse(req.body)
    if (['Completed', 'Cancelled'].includes(lease.status)) throw bad('Lease cannot be cancelled in its current state')
    return patchRecord(leaseDef(), id, { status: 'Cancelled' }, req.ctx)
  })

  // Rent Schedule management
  app.post('/api/leases/:id/rent-schedules', async (req) => {
    const { id } = loadLease(req, true)
    const b = z.object({ rent_amount: z.number().positive(), rent_frequency: z.enum(['Monthly', 'Quarterly', 'Semi-Annual', 'Annual']).default('Monthly'), effective_date: z.string().min(1), notes: z.string().max(500).optional() }).parse(req.body)
    const schedule = createRecord(rentScheduleDef(), { lease_id: id, rent_amount: b.rent_amount, rent_frequency: b.rent_frequency, effective_date: b.effective_date, notes: b.notes }, req.ctx)
    return schedule
  })

  app.post('/api/leases/:id/rent-schedules/:sid/activate', async (req) => {
    const { id } = loadLease(req, true)
    const sid = idOf((req.params as any).sid)
    const schedules = q.all('SELECT * FROM rent_schedules WHERE lease_id = ? AND deleted_at IS NULL', id)
    const schedule = schedules.find((s: any) => s.id === sid)
    if (!schedule) throw bad('Rent schedule not found')
    if (schedule.status !== 'Pending') throw bad('Only pending rent schedules can be activated')
    return patchRecord(rentScheduleDef(), sid, { status: 'Active' }, req.ctx)
  })

  app.post('/api/leases/:id/rent-schedules/:sid/close', async (req) => {
    const { id } = loadLease(req, true)
    const sid = idOf((req.params as any).sid)
    const schedules = q.all('SELECT * FROM rent_schedules WHERE lease_id = ? AND deleted_at IS NULL', id)
    const schedule = schedules.find((s: any) => s.id === sid)
    if (!schedule) throw bad('Rent schedule not found')
    return patchRecord(rentScheduleDef(), sid, { status: 'Closed' }, req.ctx)
  })

  // Rent Receipt management
  app.post('/api/leases/:id/rent-receipts', async (req) => {
    const { id } = loadLease(req, true)
    const b = z.object({ receipt_date: z.string().min(1), amount: z.number().positive(), paid_by_party_id: z.number().int(), payment_method: z.enum(['Cash', 'Bank Transfer', 'Cheque', 'Online', 'WPS']).default('Bank Transfer'), reference: z.string().max(200).optional(), notes: z.string().max(500).optional() }).parse(req.body)
    const receipt = createRecord(rentReceiptDef(), { lease_id: id, receipt_date: b.receipt_date, amount: b.amount, paid_by_party_id: b.paid_by_party_id, payment_method: b.payment_method, reference: b.reference, notes: b.notes }, req.ctx)
    return receipt
  })

  app.post('/api/leases/:id/rent-receipts/:rid/mark-paid', async (req) => {
    const { id } = loadLease(req, true)
    const rid = idOf((req.params as any).rid)
    return patchRecord(rentReceiptDef(), rid, { status: 'Paid' }, req.ctx)
  })

  // Service Charges management
  app.post('/api/leases/:id/service-charges', async (req) => {
    const { id } = loadLease(req, true)
    const b = z.object({ charge_date: z.string().min(1), amount: z.number().positive(), charge_type: z.enum(['Service Charge', 'Maintenance Fee', 'Security Fee', 'Amenity Fee', 'Other']).default('Service Charge'), description: z.string().max(500).optional(), associated_with: z.enum(['Common Areas', 'Building Facilities', 'Landscaping', 'Utilities', 'Other']).default('Common Areas') }).parse(req.body)
    const sc = createRecord(serviceChargeDef(), { lease_id: id, charge_date: b.charge_date, amount: b.amount, charge_type: b.charge_type, description: b.description, associated_with: b.associated_with }, req.ctx)
    return sc
  })

  app.get('/api/leases/:id/service-charges', async (req) => {
    const { id } = loadLease(req)
    const rows = q.all('SELECT * FROM service_charges WHERE lease_id = ? AND deleted_at IS NULL ORDER BY charge_date DESC, id DESC LIMIT 200', id)
    return rows
  })

  // Maintenance management
  app.post('/api/leases/:id/maintenance', async (req) => {
    const { id } = loadLease(req, true)
    const b = z.object({ title: z.string().min(1), description: z.string().max(1000).optional(), priority: z.enum(['Low', 'Medium', 'High', 'Urgent']).default('Medium'), scheduled_at: z.string().optional(), estimated_cost: z.number().positive().optional(), responsible_party: z.string().max(200).optional() }).parse(req.body)
    const maintenance = createRecord(maintenanceDef(), { lease_id: id, title: b.title, description: b.description, priority: b.priority, scheduled_at: b.scheduled_at, estimated_cost: b.estimated_cost, responsible_party: b.responsible_party }, req.ctx)
    return maintenance
  })

  app.get('/api/leases/:id/maintenance', async (req) => {
    const { id } = loadLease(req)
    const rows = q.all('SELECT * FROM maintenance WHERE lease_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 200', id)
    return rows
  })

  // Inspection management
  app.post('/api/leases/:id/inspections', async (req) => {
    const { id } = loadLease(req, true)
    const b = z.object({ inspected_at: z.string().min(1), inspector_id: z.number().int(), status: z.enum(['Pass', 'Fail', 'Needs Attention']).default('Pass'), notes: z.string().max(1000).optional(), photos: z.string().optional() }).parse(req.body)
    const inspection = createRecord(inspectionDef(), { lease_id: id, inspected_at: b.inspected_at, inspector_id: b.inspector_id, status: b.status, notes: b.notes, photos: b.photos }, req.ctx)
    return inspection
  })

  app.get('/api/leases/:id/inspections', async (req) => {
    const { id } = loadLease(req)
    const rows = q.all('SELECT * FROM inspections WHERE lease_id = ? AND deleted_at IS NULL ORDER BY inspected_at DESC LIMIT 200', id)
    return rows
  })

  // Handover management
  app.post('/api/leases/:id/handovers', async (req) => {
    const { id } = loadLease(req, true)
    const b = z.object({ handover_date: z.string().min(1), handed_over_by: z.string().max(200), status: z.enum(['Scheduled', 'In Progress', 'Completed', 'Pending Documentation']).default('Scheduled'), snagging_report_url: z.string().url().optional(), keys_returned: z.boolean().default(false), possession_returned: z.boolean().default(false) }).parse(req.body)
    const handover = createRecord(handoverDef(), { lease_id: id, handover_date: b.handover_date, handed_over_by: b.handed_over_by, status: b.status, snagging_report_url: b.snagging_report_url, keys_returned: b.keys_returned, possession_returned: b.possession_returned }, req.ctx)
    return handover
  })

  app.get('/api/leases/:id/handovers', async (req) => {
    const { id } = loadLease(req)
    const rows = q.all('SELECT * FROM handovers WHERE lease_id = ? AND deleted_at IS NULL ORDER BY handover_date DESC LIMIT 200', id)
    return rows
  })

  app.post('/api/leases/:id/handovers/:hid/complete', async (req) => {
    const { id } = loadLease(req, true)
    const hid = idOf((req.params as any).hid)
    return patchRecord(handoverDef(), hid, { status: 'Completed', completed_at: nowLocal(), handover_acknowledged: true }, req.ctx)
  })

  // Lease search
  app.get('/api/search/leases', async (req) => {
    need(req, 'leases', 'view')
    const qs = req.query as any
    const type = String(qs.type ?? 'lease_no'), op = String(qs.op ?? 'contains'), value = String(qs.value ?? '').trim()
    if (!value) throw bad('Enter a value to search for')
    const map: Record<string, { entity: string; field: string }> = {
      lease_no: { entity: 'leases', field: 'lease_no' },
      property: { entity: 'leases', field: 'property_id' },
      tenant: { entity: 'leases', field: 'tenant_id' },
      landlord: { entity: 'leases', field: 'landlord_id' },
      status: { entity: 'leases', field: 'status' }
    }
    const m = map[type]
    if (!m) throw bad('Unknown search type')
    const opSql = op === 'equals' ? 'eq' : op === 'starts with' ? 'starts' : op === 'ends with' ? 'ends' : op
    const filters = [{ field: m.field, op: opSql, value }]
    const res = listRecords(leaseDef(), { filters, pageSize: 200, sort: 'start_date', dir: 'desc' }, req.ctx)
    return { total: res.total, rows: res.rows.map(r => ({ id: r.id, lease_no: r.lease_no, property: r._labels.property_id ?? '', tenant: r._labels.tenant_id ?? '', landlord: r._labels.landlord_id ?? '', status: r.status, start_date: r.start_date, end_date: r.end_date, rent_amount: r.rent_amount })) }
  })

  // Unit search for leases
  app.get('/api/search/units-for-lease', async (req) => {
    need(req, 'units', 'view')
    const qs = req.query as any
    const value = String(qs.value ?? '').trim()
    if (!value) throw bad('Enter a value to search for')
    const rows = q.all('SELECT id, unit_no, property_id FROM units WHERE deleted_at IS NULL AND (unit_no LIKE ? OR property_id IN (SELECT id FROM properties WHERE deleted_at IS NULL AND name LIKE ?)) ORDER BY unit_no LIMIT 100', '%' + value + '%', '%' + value + '%')
    return rows
  })
}