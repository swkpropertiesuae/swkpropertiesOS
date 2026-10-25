import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { q } from '../db'
import { assertCan, createRecord, getDef, getRecord, listRecords, patchRecord } from '../engine'
import { bad, todayStr } from '../util'
import { idOf, need } from './helpers'

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

  // Lease status transitions
  app.post('/api/leases/:id/activate', async (req) => {
    const { id, lease } = loadLease(req, true)
    if (!['Draft', 'Pending Ejari', 'Ejari Registered'].includes(lease.status)) throw bad('Only draft or pending leases can be activated')
    return patchRecord(leaseDef(), id, { status: 'Active' }, req.ctx)
  })

  app.post('/api/leases/:id/register-ejari', async (req) => {
    const { id } = loadLease(req, true)
    const b = z.object({ ejari_no: z.string().min(1), ejari_date: z.string().date().optional() }).parse(req.body)
    return patchRecord(leaseDef(), id, { status: 'Ejari Registered', ejari_no: b.ejari_no, ejari_date: b.ejari_date ?? todayStr() }, req.ctx)
  })

  app.post('/api/leases/:id/terminate', async (req) => {
    const { id, lease } = loadLease(req, true)
    if (!['Active', 'Ejari Registered', 'Notice Served', 'Expiring'].includes(lease.status)) throw bad('Only active leases can be terminated')
    const b = z.object({ notice_date: z.string().date().optional(), reason: z.string().min(5).max(1000) }).parse(req.body)
    const notes = [lease.notes, `Terminated (${b.notice_date ?? todayStr()}): ${b.reason}`].filter(Boolean).join('\n')
    return patchRecord(leaseDef(), id, { status: 'Terminated', notice_date: b.notice_date ?? todayStr(), notes }, req.ctx)
  })

  app.post('/api/leases/:id/renew', async (req) => {
    const { id, lease } = loadLease(req, true)
    if (!['Active', 'Ejari Registered', 'Notice Served', 'Expiring', 'Expired'].includes(lease.status)) throw bad('Lease cannot be renewed from current status')
    const b = z.object({
      new_term_end: z.string().date(),
      new_rent_amount: z.number().positive().optional(),
      new_rent_frequency: z.enum(['Monthly', 'Quarterly', 'Semi-Annual', 'Annual', 'Post-Dated Cheques', 'Custom']).optional(),
    }).parse(req.body)
    return patchRecord(
      leaseDef(),
      id,
      {
        status: 'Renewed',
        end_date: b.new_term_end,
        annual_rent: b.new_rent_amount ?? lease.annual_rent,
        payment_frequency: b.new_rent_frequency ?? lease.payment_frequency,
      },
      req.ctx,
    )
  })

  // Rent Schedule management
  app.post('/api/leases/:id/rent-schedules', async (req) => {
    const { id, lease } = loadLease(req, true)
    const b = z.object({
      due_date: z.string().date(),
      amount: z.number().positive(),
      vat_amount: z.number().min(0).optional(),
      cheque_no: z.string().optional(),
      cheque_date: z.string().date().optional(),
      bank_id: z.number().int().optional(),
      is_pdc: z.boolean().optional(),
      notes: z.string().max(500).optional(),
    }).parse(req.body)
    return createRecord(
      rentScheduleDef(),
      {
        lease_id: id,
        lease_no: lease.lease_no,
        due_date: b.due_date,
        amount: b.amount,
        vat_amount: b.vat_amount ?? 0,
        total_amount: b.amount + (b.vat_amount ?? 0),
        cheque_no: b.cheque_no,
        cheque_date: b.cheque_date ?? b.due_date,
        bank_id: b.bank_id,
        is_pdc: b.is_pdc ?? Boolean(b.cheque_no),
        notes: b.notes,
      },
      req.ctx,
    )
  })

  // Rent Receipt management
  app.post('/api/leases/:id/rent-receipts', async (req) => {
    const { id, lease } = loadLease(req, true)
    const b = z.object({
      receipt_date: z.string().date().optional(),
      amount: z.number().positive(),
      vat_amount: z.number().min(0).optional(),
      rent_schedule_id: z.number().int().optional(),
      tenant_id: z.number().int().optional(),
      payment_method: z.enum(['Bank Transfer', 'Cheque', 'Cash', 'Card', 'PDC', 'Online']).default('Bank Transfer'),
      cheque_no: z.string().optional(),
      cheque_date: z.string().date().optional(),
      reference: z.string().max(200).optional(),
      notes: z.string().max(500).optional(),
    }).parse(req.body)
    return createRecord(
      rentReceiptDef(),
      {
        lease_id: id,
        rent_schedule_id: b.rent_schedule_id,
        tenant_id: b.tenant_id ?? lease.tenant_id,
        receipt_date: b.receipt_date ?? todayStr(),
        amount: b.amount,
        vat_amount: b.vat_amount ?? 0,
        total_amount: b.amount + (b.vat_amount ?? 0),
        payment_method: b.payment_method,
        cheque_no: b.cheque_no,
        cheque_date: b.cheque_date,
        reference: b.reference,
        notes: b.notes,
      },
      req.ctx,
    )
  })

  app.post('/api/leases/:id/rent-receipts/:rid/mark-cleared', async (req) => {
    loadLease(req, true)
    const rid = idOf((req.params as any).rid)
    return patchRecord(rentReceiptDef(), rid, { status: 'Cleared' }, req.ctx)
  })

  // Service Charges management
  app.post('/api/leases/:id/service-charges', async (req) => {
    const { id, lease } = loadLease(req, true)
    const b = z.object({
      period_from: z.string().date(),
      period_to: z.string().date(),
      amount: z.number().positive(),
      vat_amount: z.number().min(0).optional(),
      due_date: z.string().date().optional(),
      breakdown: z.string().max(1000).optional(),
      notes: z.string().max(500).optional(),
    }).parse(req.body)
    return createRecord(
      serviceChargeDef(),
      {
        lease_id: id,
        lease_no: lease.lease_no,
        period_from: b.period_from,
        period_to: b.period_to,
        amount: b.amount,
        vat_amount: b.vat_amount ?? 0,
        total_amount: b.amount + (b.vat_amount ?? 0),
        due_date: b.due_date,
        breakdown: b.breakdown,
        notes: b.notes,
      },
      req.ctx,
    )
  })

  app.get('/api/leases/:id/service-charges', async (req) => {
    const { id } = loadLease(req)
    return q.all('SELECT * FROM service_charges WHERE lease_id = ? AND deleted_at IS NULL ORDER BY period_from DESC, id DESC LIMIT 200', id)
  })

  // Maintenance management
  app.post('/api/leases/:id/maintenance', async (req) => {
    const { id, lease } = loadLease(req, true)
    const b = z.object({
      category: z.enum(['Plumbing', 'Electrical', 'HVAC', 'Appliances', 'Carpentry', 'Painting', 'Cleaning', 'Pest Control', 'Structural', 'Security', 'Common Area', 'Other']).default('Other'),
      description: z.string().min(1).max(1000),
      priority: z.enum(['Low', 'Medium', 'High', 'Urgent', 'Emergency']).default('Medium'),
      scheduled_at: z.string().optional(),
      estimated_cost: z.number().positive().optional(),
      cost_responsibility: z.enum(['Landlord', 'Tenant', 'Shared', 'Warranty', 'Insurance', 'Service Charge']).optional(),
    }).parse(req.body)
    return createRecord(
      maintenanceDef(),
      {
        lease_id: id,
        unit_id: lease.unit_id,
        unit_title: lease.unit_title,
        tenant_id: lease.tenant_id,
        landlord_id: lease.landlord_id,
        category: b.category,
        description: b.description,
        priority: b.priority,
        scheduled_at: b.scheduled_at,
        estimated_cost: b.estimated_cost,
        cost_responsibility: b.cost_responsibility ?? 'Landlord',
      },
      req.ctx,
    )
  })

  app.get('/api/leases/:id/maintenance', async (req) => {
    const { id } = loadLease(req)
    return q.all('SELECT * FROM maintenance WHERE lease_id = ? AND deleted_at IS NULL ORDER BY reported_at DESC, id DESC LIMIT 200', id)
  })

  // Inspection management
  app.post('/api/leases/:id/inspections', async (req) => {
    const { id, lease } = loadLease(req, true)
    const b = z.object({
      inspection_type: z.enum(['Move-In', 'Move-Out', 'Periodic', 'Snagging', 'Compliance', 'Insurance']).default('Periodic'),
      scheduled_at: z.string().min(1),
      inspector_id: z.number().int().optional(),
      status: z.enum(['Scheduled', 'In Progress', 'Completed', 'Cancelled', 'Requires Action']).default('Scheduled'),
      findings: z.string().max(1000).optional(),
      notes: z.string().max(1000).optional(),
    }).parse(req.body)
    return createRecord(
      inspectionDef(),
      {
        lease_id: id,
        unit_id: lease.unit_id,
        unit_title: lease.unit_title,
        inspection_type: b.inspection_type,
        scheduled_at: b.scheduled_at,
        inspector_id: b.inspector_id,
        status: b.status,
        findings: b.findings,
        notes: b.notes,
      },
      req.ctx,
    )
  })

  app.get('/api/leases/:id/inspections', async (req) => {
    const { id } = loadLease(req)
    return q.all('SELECT * FROM inspections WHERE lease_id = ? AND deleted_at IS NULL ORDER BY scheduled_at DESC, id DESC LIMIT 200', id)
  })

  // Handover management
  app.post('/api/leases/:id/handovers', async (req) => {
    const { id, lease } = loadLease(req, true)
    const b = z.object({
      handover_type: z.enum(['Move-In', 'Move-Out', 'Snagging Inspection', 'Pre-Handover', 'Post-Handover']).default('Move-In'),
      scheduled_at: z.string().min(1),
      inspector_id: z.number().int().optional(),
      status: z.enum(['Scheduled', 'In Progress', 'Completed', 'Cancelled', 'Requires Re-Inspection']).default('Scheduled'),
      condition_report: z.string().optional(),
      keys_handed_over: z.string().optional(),
      defects_noted: z.string().optional(),
    }).parse(req.body)
    return createRecord(
      handoverDef(),
      {
        lease_id: id,
        unit_id: lease.unit_id,
        unit_title: lease.unit_title,
        handover_type: b.handover_type,
        scheduled_at: b.scheduled_at,
        inspector_id: b.inspector_id,
        status: b.status,
        condition_report: b.condition_report,
        keys_handed_over: b.keys_handed_over,
        defects_noted: b.defects_noted,
      },
      req.ctx,
    )
  })

  app.get('/api/leases/:id/handovers', async (req) => {
    const { id } = loadLease(req)
    return q.all('SELECT * FROM handovers WHERE lease_id = ? AND deleted_at IS NULL ORDER BY scheduled_at DESC, id DESC LIMIT 200', id)
  })

  app.post('/api/leases/:id/handovers/:hid/complete', async (req) => {
    loadLease(req, true)
    const hid = idOf((req.params as any).hid)
    return patchRecord(handoverDef(), hid, { status: 'Completed', completed_date: todayStr() }, req.ctx)
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
      status: { entity: 'leases', field: 'status' },
    }
    const m = map[type]
    if (!m) throw bad('Unknown search type')
    const opSql = op === 'equals' ? 'eq' : op === 'starts with' ? 'starts' : op === 'ends with' ? 'ends' : op
    const filters = [{ field: m.field, op: opSql, value }]
    const res = listRecords(leaseDef(), { filters, pageSize: 200, sort: 'start_date', dir: 'desc' }, req.ctx)
    return {
      total: res.total,
      rows: res.rows.map(r => ({
        id: r.id,
        lease_no: r.lease_no,
        property: r._labels.property_id ?? '',
        tenant: r._labels.tenant_id ?? '',
        landlord: r._labels.landlord_id ?? '',
        status: r.status,
        start_date: r.start_date,
        end_date: r.end_date,
        annual_rent: r.annual_rent,
      })),
    }
  })

  // Unit search for leases
  app.get('/api/search/units-for-lease', async (req) => {
    need(req, 'properties', 'view')
    const qs = req.query as any
    const value = String(qs.value ?? '').trim()
    if (!value) throw bad('Enter a value to search for')
    return q.all(
      'SELECT id, unit_no, property_id, property_title, status, rent_annual FROM units WHERE deleted_at IS NULL AND (unit_no LIKE ? OR property_id IN (SELECT id FROM properties WHERE deleted_at IS NULL AND title LIKE ?)) ORDER BY unit_no LIMIT 100',
      '%' + value + '%',
      '%' + value + '%',
    )
  })
}
