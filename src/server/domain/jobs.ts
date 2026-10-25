import crypto from 'node:crypto'
import { q } from '../db'
import { bad, r2, nowLocal, todayStr } from '../util'
import { createRecord, getDef, getRecord, insertRow, patchRecord, nextSeq, type Ctx, type Rec } from '../engine'
import { fxRate, BASE } from './accounting'
import { notify } from '../notify'
import { getSetting } from '../settings'

const vatPct = (id: number | null | undefined) => (id ? q.val<number>(`SELECT rate FROM vat_codes WHERE id = ?`, id) ?? 0 : 0)

export function addJobEvent(jobId: number, type: string, o: { at?: string; description?: string; source?: string; user_id?: number | null; visible?: boolean } = {}) {
  insertRow(getDef('job_events'), { job_id: jobId, event_at: o.at ?? nowLocal(), event_type: type, description: o.description ?? null, source: o.source ?? 'System', visible_to_customer: o.visible ?? true, user_id: o.user_id ?? null })
}

function computeCharges(rows: Rec[], jobId: number | undefined) {
  for (const r of rows) {
    const cc = r.charge_code_id ? q.get(`SELECT * FROM charge_codes WHERE id = ?`, r.charge_code_id) : null
    if (cc) {
      if (!r.description) r.description = cc.name
      if (!r.vat_code_id && r.vat_pct === undefined && cc.vat_code_id) r.vat_code_id = cc.vat_code_id
      if ((r.rate === undefined || r.rate === null) && r.kind !== 'Cost' && cc.default_rate) r.rate = cc.default_rate / 100
    }
    r.qty = Number(r.qty ?? 1); r.rate = Number(r.rate ?? 0)
    if (r.qty < 0 || r.rate < 0) throw bad('Quantity and rate cannot be negative')
    r.currency = r.currency || BASE()
    r.ex_rate = fxRate(r.currency, r.ex_rate)
    r.amount = r2(r.qty * r.rate)
    r.vat_pct = vatPct(r.vat_code_id)
    r.vat_amount = r2(r.amount * r.vat_pct / 100)
    r.base_amount = r2(r.amount * r.ex_rate)
    if (!r.id) r.status = 'Unbilled'
  }
}

export function recomputeJobTotals(jobId: number) {
  q.run(`UPDATE jobs SET
    total_revenue = (SELECT COALESCE(SUM(base_amount),0) FROM job_charges WHERE job_id = ? AND kind = 'Revenue' AND deleted_at IS NULL),
    total_cost = (SELECT COALESCE(SUM(base_amount),0) FROM job_charges WHERE job_id = ? AND kind = 'Cost' AND deleted_at IS NULL),
    profit = (SELECT COALESCE(SUM(base_amount),0) FROM job_charges WHERE job_id = ? AND kind = 'Revenue' AND deleted_at IS NULL) -
             (SELECT COALESCE(SUM(base_amount),0) FROM job_charges WHERE job_id = ? AND kind = 'Cost' AND deleted_at IS NULL)
    WHERE id = ?`, jobId, jobId, jobId, jobId, jobId)
}

export const jobHooks = {
  beforeDelete({ rec }: { rec: any }) {
    if (rec.job_status === 'Completed') throw bad('Completed deals cannot be deleted')
  },
  tokens: (rec: any) => ({ branch: q.val<string>(`SELECT code FROM branches WHERE id = ?`, rec.branch_id) ?? 'DL' }),
  numberDate: (rec: any) => rec.deal_date,
  beforeSave({ rec, old, children, isNew, ctx }: any) {
    if (isNew && rec.job_status === 'Completed' && !ctx.system) throw bad('Create the deal first, then complete it')
    if (old?.job_status === 'Completed' && ctx.jobTransition !== 'reopen') throw bad('Completed deals are locked. Request approval to reopen.')

    if (isNew || old?.client_id !== rec.client_id) {
      const c = q.get(`SELECT name, status FROM parties WHERE id = ?`, rec.client_id)
      if (c?.status === 'Blocked') throw bad(`${c.name} is blocked — new deals cannot be opened`)
    }
    if (old) {
      if (old.branch_id !== rec.branch_id || old.deal_date !== rec.deal_date) throw bad('Branch and deal date cannot be changed once the deal number has been issued')
    }
    if (children.charges) computeCharges(children.charges, rec.id)
    if (old && old.job_status !== rec.job_status) {
      if (rec.job_status === 'Completed') {
        const n = q.val<number>(`SELECT COUNT(*) FROM job_charges WHERE job_id = ? AND kind = 'Revenue' AND status = 'Unbilled' AND deleted_at IS NULL AND amount <> 0`, rec.id) ?? 0
        if (n) throw bad(`${n} revenue charge${n > 1 ? 's are' : ' is'} not yet invoiced. Invoice or remove ${n > 1 ? 'them' : 'it'} before completing the deal.`)
      }
    }
  },
  afterSave({ rec, old, isNew, ctx }: any) {
    recomputeJobTotals(rec.id)
    const uid = ctx.user?.id ?? null
    if (isNew) addJobEvent(rec.id, 'Note', { description: `Deal ${rec.job_no} created`, user_id: uid })
    if (!isNew && old && old.job_status !== rec.job_status) addJobEvent(rec.id, 'Note', { description: `Deal status: ${old.job_status} → ${rec.job_status}`, user_id: uid })
    if (rec.agent_id && rec.agent_id !== ctx.user?.id && (isNew || old?.agent_id !== rec.agent_id)) notify(rec.agent_id, `Deal ${rec.job_no} assigned to you`, rec._title ?? '', `/e/jobs/${rec.id}`, 'assignment')
  },
}

export function generateInvoicesFromJob(jobId: number, opts: { docType?: string; chargeIds?: number[]; billInBase?: boolean } = {}, ctx: Ctx) {
  const job = getRecord(getDef('jobs'), jobId, ctx, { children: { charges: true } })
  if (!job.children?.charges?.length) throw bad('No charges to invoice')
  const charges = job.children.charges.filter((c: any) => !opts.chargeIds || opts.chargeIds.includes(c.id))
  if (!charges.length) throw bad('Selected charges not found')
  const revenue = charges.filter((c: any) => c.kind === 'Revenue' && c.status === 'Unbilled')
  if (!revenue.length) throw bad('No unbilled revenue charges to invoice')
  const groupBy: Record<string, any[]> = {}
  for (const c of revenue) {
    const key = `${c.currency}|${c.party_id ?? ''}`
    ;(groupBy[key] ??= []).push(c)
  }
  const invs: any[] = []
  for (const [, cs] of Object.entries(groupBy)) {
    const first = cs[0]
    const inv = createRecord(getDef('invoices'), {
      doc_type: opts.docType || 'Tax Invoice', party_id: first.party_id || job.client_id, property_id: job.property_id, unit_id: job.unit_id, branch_id: job.branch_id,
      invoice_date: todayStr(), currency: first.currency, ex_rate: first.ex_rate, job_id: jobId,
      children: {
        lines: cs.map((c: any) => ({
          job_charge_id: c.id, charge_code_id: c.charge_code_id, description: c.description, qty: c.qty, rate: c.rate,
          vat_code_id: c.vat_code_id, property_id: job.property_id, unit_id: job.unit_id,
        })),
      },
    }, ctx)
    invs.push(inv)
  }
  return invs
}

export function duplicateJob(jobId: number, ctx: Ctx) {
  const job = getRecord(getDef('jobs'), jobId, ctx, { children: { charges: true, events: true } })
  const newJob = createRecord(getDef('jobs'), {
    deal_name: job.deal_name, deal_type: job.deal_type, branch_id: job.branch_id, property_id: job.property_id,
    unit_id: job.unit_id, client_id: job.client_id, owner_id: job.owner_id, agent_id: job.agent_id,
    buyer_agent_id: job.buyer_agent_id, deal_value: job.deal_value, commission_pct: job.commission_pct,
    deal_date: todayStr(), job_status: 'Lead', operational_status: 'Inquiry',
  }, ctx)
  for (const c of job.children.charges ?? []) {
    const { id, status, created_at, updated_at, created_by, updated_by, deleted_at, version, ...rest } = c
    insertRow(getDef('job_charges'), { ...rest, job_id: newJob.id, status: 'Unbilled', amount: 0, vat_amount: 0, base_amount: 0 })
  }
  return newJob
}

export function convertProforma(invoiceId: number, ctx: Ctx) {
  const inv = getRecord(getDef('invoices'), invoiceId, ctx)
  if (inv.doc_type !== 'Proforma Invoice') throw bad('Only proforma invoices can be converted')
  return patchRecord(getDef('invoices'), invoiceId, { doc_type: 'Tax Invoice', invoice_no: null }, ctx)
}

export function generateBillFromJobCosts(jobId: number, opts: { vendor_id: number; vendor_invoice_no: string; charge_ids?: number[] }, ctx: Ctx) {
  const job = getRecord(getDef('jobs'), jobId, ctx, { children: { charges: true } })
  const costs = (job.children?.charges ?? []).filter((c: any) => c.kind === 'Cost' && c.status === 'Unbilled' && (!opts.charge_ids || opts.charge_ids.includes(c.id)) && (!c.party_id || c.party_id === opts.vendor_id))
  if (!costs.length) throw bad('No unbilled cost charges found for this vendor')
  const first = costs[0]
  return createRecord(getDef('bills'), {
    vendor_id: opts.vendor_id, vendor_invoice_no: opts.vendor_invoice_no, job_id: jobId,
    property_id: job.property_id, unit_id: job.unit_id, branch_id: job.branch_id,
    bill_date: todayStr(), currency: first.currency || BASE(), ex_rate: first.ex_rate || 1,
    children: {
      lines: costs.map((c: any) => ({
        job_charge_id: c.id, charge_code_id: c.charge_code_id, description: c.description,
        qty: c.qty, rate: c.rate, vat_code_id: c.vat_code_id, vat_pct: c.vat_pct,
        property_id: job.property_id, unit_id: job.unit_id,
      })),
    },
  }, ctx)
}

export function jobKpi(jobId: number) {
  const j = q.get(`SELECT * FROM jobs WHERE id = ?`, jobId)
  const rev = r2((q.val<number>(`SELECT COALESCE(SUM(base_amount),0) FROM job_charges WHERE job_id = ? AND kind = 'Revenue' AND deleted_at IS NULL`, jobId) ?? 0) / 100)
  const cost = r2((q.val<number>(`SELECT COALESCE(SUM(base_amount),0) FROM job_charges WHERE job_id = ? AND kind = 'Cost' AND deleted_at IS NULL`, jobId) ?? 0) / 100)
  const unbilled = r2((q.val<number>(`SELECT COALESCE(SUM(base_amount),0) FROM job_charges WHERE job_id = ? AND kind = 'Revenue' AND status = 'Unbilled' AND deleted_at IS NULL`, jobId) ?? 0) / 100)
  const invoiced = r2((q.val<number>(`SELECT COALESCE(SUM(base_amount),0) FROM job_charges WHERE job_id = ? AND kind = 'Revenue' AND status <> 'Unbilled' AND deleted_at IS NULL`, jobId) ?? 0) / 100)
  const dealValue = r2((j?.deal_value ?? 0) / 100)
  return { revenue: rev, cost, profit: r2(rev - cost), unbilled, invoiced, marginPct: rev ? ((rev - cost) / rev) * 100 : 0, dealValue, commission: dealValue && j?.commission_pct ? r2(dealValue * j.commission_pct / 100) : 0 }
}
