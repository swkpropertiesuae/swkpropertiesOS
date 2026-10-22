import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { q, tx } from '../db'
import { assertCan, createRecord, deleteRecord, getDef, getRecord, listRecords, patchRecord, SYSTEM_CTX, audit } from '../engine'
import { bad, notFound, nowLocal, todayStr } from '../util'
import { body, idOf, need } from './helpers'
import { queueEmail } from '../mailer'
import { getSetting } from '../settings'
import { postInvoice } from '../domain/finance'
import { addJobEvent } from '../domain/jobs'

export default async function (app: FastifyInstance) {
  const salesContractDef = () => getDef('sales_contracts')
  const escrowAccountDef = () => getDef('escrow_accounts')
  const escrowTransactionDef = () => getDef('escrow_transactions')

  const loadSalesContract = (req: any, edit = false) => {
    const id = idOf(req.params.id)
    if (edit) assertCan(req.ctx, 'transactions', 'edit')
    return { id, contract: getRecord(salesContractDef(), id, req.ctx, { children: { escrow_transactions: true } }) }
  }

  const loadEscrowAccount = (req: any, edit = false) => {
    const id = idOf(req.params.id)
    if (edit) assertCan(req.ctx, 'transactions', 'edit')
    return { id, escrow: getRecord(escrowAccountDef(), id, req.ctx, { children: { transactions: true } }) }
  }

  // Sales Contract status transitions
  app.post('/api/sales_contracts/:id/sign', async (req) => {
    const { id, contract } = loadSalesContract(req, true)
    if (contract.status !== 'Draft') throw bad('Only draft contracts can be signed')
    const b = z.object({ signed_date: z.string().date().optional(), witness1_id: z.number().int().optional(), witness2_id: z.number().int().optional() }).parse(req.body)
    return patchRecord(salesContractDef(), id, { status: 'Signed', signed_date: b.signed_date ?? todayStr(), witness1_id: b.witness1_id, witness2_id: b.witness2_id }, req.ctx)
  })

  app.post('/api/sales_contracts/:id/submit_dld', async (req) => {
    const { id, contract } = loadSalesContract(req, true)
    if (contract.status !== 'Signed') throw bad('Only signed contracts can be submitted to DLD')
    const b = z.object({ dld_application_no: z.string().min(1), dld_submission_date: z.string().date().optional() }).parse(req.body)
    return patchRecord(salesContractDef(), id, { status: 'DLD Submitted', dld_application_no: b.dld_application_no, dld_submission_date: b.dld_submission_date ?? todayStr() }, req.ctx)
  })

  app.post('/api/sales_contracts/:id/dld_approve', async (req) => {
    const { id, contract } = loadSalesContract(req, true)
    if (contract.status !== 'DLD Submitted') throw bad('Only DLD submitted contracts can be approved')
    const b = z.object({ dld_approval_date: z.string().date().optional(), title_deed_no: z.string().optional() }).parse(req.body)
    return patchRecord(salesContractDef(), id, { status: 'DLD Approved', dld_approval_date: b.dld_approval_date ?? todayStr(), title_deed_no: b.title_deed_no }, req.ctx)
  })

  app.post('/api/sales_contracts/:id/title_deed', async (req) => {
    const { id, contract } = loadSalesContract(req, true)
    if (contract.status !== 'DLD Approved') throw bad('Only DLD approved contracts can receive title deed')
    const b = z.object({ title_deed_no: z.string().min(1), title_deed_date: z.string().date().optional() }).parse(req.body)
    return patchRecord(salesContractDef(), id, { status: 'Title Deed Issued', title_deed_no: b.title_deed_no, title_deed_date: b.title_deed_date ?? todayStr() }, req.ctx)
  })

  app.post('/api/sales_contracts/:id/complete', async (req) => {
    const { id, contract } = loadSalesContract(req, true)
    if (contract.status !== 'Title Deed Issued') throw bad('Only contracts with title deed issued can be completed')
    const b = z.object({ handover_date: z.string().date().optional() }).parse(req.body)
    return patchRecord(salesContractDef(), id, { status: 'Completed', handover_date: b.handover_date ?? todayStr() }, req.ctx)
  })

  app.post('/api/sales_contracts/:id/cancel', async (req) => {
    const { id, contract } = loadSalesContract(req, true)
    const b = z.object({ reason: z.string().min(10).max(1000) }).parse(req.body)
    if (['Completed', 'Cancelled'].includes(contract.status)) throw bad('Contract cannot be cancelled in its current state')
    return patchRecord(salesContractDef(), id, { status: 'Cancelled' }, req.ctx)
  })

  // Sales Contract PDF generation
  app.post('/api/sales_contracts/:id/generate-pdf', async (req) => {
    const { id, contract } = loadSalesContract(req, true)
    return { message: 'PDF generation via Document Studio', contract_id: id }
  })

  // Escrow Account management
  app.post('/api/escrow_accounts/:id/open', async (req) => {
    const { id, escrow } = loadEscrowAccount(req, true)
    if (escrow.status !== 'Opened') throw bad('Only opened escrow accounts can be opened')
    const b = z.object({ dld_escrow_ref: z.string().optional() }).parse(req.body)
    return patchRecord(escrowAccountDef(), id, { status: 'Funds Received', dld_escrow_ref: b.dld_escrow_ref }, req.ctx)
  })

  app.post('/api/escrow_accounts/:id/deposit', async (req) => {
    const { id, escrow } = loadEscrowAccount(req, true)
    const b = z.object({ type: z.enum(['Deposit', 'Fee', 'DLD Payment', 'Agent Commission', 'Seller Payout']), amount: z.number().positive(), reference: z.string().max(100).optional(), description: z.string().max(500).optional(), from_party_id: z.number().int().optional(), to_party_id: z.number().int().optional(), related_invoice_id: z.number().int().optional() }).parse(req.body)
    return tx(() => {
      const transaction = createRecord(getDef('escrow_transactions'), { escrow_account_id: id, type: b.type, amount: b.amount, transaction_date: todayStr(), reference: b.reference, description: b.description, from_party_id: b.from_party_id, to_party_id: b.to_party_id, related_invoice_id: b.related_invoice_id }, req.ctx)
      const currentReceived = escrow.received_amount ?? 0
      const newReceived = (escrow.received_amount ?? 0) + b.amount
      patchRecord(escrowAccountDef(), id, { received_amount: newReceived }, req.ctx)
      if (newReceived >= escrow.expected_amount) {
        patchRecord(escrowAccountDef(), id, { status: 'Funds Verified' }, req.ctx)
      }
      return transaction
    })
  })

  app.post('/api/escrow_accounts/:id/release', async (req) => {
    const { id, escrow } = loadEscrowAccount(req, true)
    if (!['Funds Verified', 'DLD Submitted', 'Title Transfer Pending'].includes(escrow.status)) {
      throw bad('Escrow must be verified or in DLD process to release funds')
    }
    const b = z.object({ type: z.enum(['Seller Payout', 'Agent Commission', 'DLD Payment', 'Fee']), amount: z.number().positive(), reference: z.string().max(100).optional(), description: z.string().max(500).optional(), to_party_id: z.number().int() }).parse(req.body)
    return tx(() => {
      const transaction = createRecord(getDef('escrow_transactions'), { escrow_account_id: id, type: b.type, amount: b.amount, transaction_date: todayStr(), reference: b.reference, description: b.description, from_party_id: escrow.bank_id, to_party_id: b.to_party_id }, req.ctx)
      const newReceived = Math.max(0, (escrow.received_amount ?? 0) - b.amount)
      patchRecord(escrowAccountDef(), id, { received_amount: newReceived }, req.ctx)
      if (newReceived === 0) {
        patchRecord(escrowAccountDef(), id, { status: 'Funds Released' }, req.ctx)
      }
      return transaction
    })
  })

  app.post('/api/escrow_accounts/:id/close', async (req) => {
    const { id, escrow } = loadEscrowAccount(req, true)
    if (escrow.status !== 'Funds Released' && escrow.status !== 'Closed') {
      throw bad('Only released or closed escrow accounts can be closed')
    }
    return patchRecord(escrowAccountDef(), id, { status: 'Closed', closed_date: todayStr() }, req.ctx)
  })

  // Escrow transaction search
  app.get('/api/search/escrow_transactions', async (req) => {
    need(req, 'transactions', 'view')
    const qs = req.query as any
    const escrowId = qs.escrow_account_id ? Number(qs.escrow_account_id) : undefined
    const type = qs.type
    const from = qs.from
    const to = qs.to
    let where = 'WHERE et.deleted_at IS NULL'
    const params: any[] = []
    if (escrowId) {
      where += ' AND et.escrow_account_id = ?'
      params.push(escrowId)
    }
    if (type) {
      where += ' AND et.type = ?'
      params.push(type)
    }
    if (from) {
      where += ' AND et.transaction_date >= ?'
      params.push(from)
    }
    if (to) {
      where += ' AND et.transaction_date <= ?'
      params.push(to)
    }
    const rows = q.all('SELECT et.*, et.type, et.amount, et.transaction_date, et.reference, et.description, et.reconciled FROM escrow_transactions et ' + where + ' ORDER BY et.transaction_date DESC, et.id DESC LIMIT 200', ...params)
    return rows
  })

  // Sales Contract search
  app.get('/api/search/sales_contracts', async (req) => {
    need(req, 'transactions', 'view')
    const qs = req.query as any
    const type = String(qs.type ?? 'contract_no'), op = String(qs.op ?? 'contains'), value = String(qs.value ?? '').trim()
    if (!value) throw bad('Enter a value to search for')
    const map: Record<string, { entity: string; field: string }> = {
      contract_no: { entity: 'sales_contracts', field: 'contract_no' },
      property: { entity: 'sales_contracts', field: 'property_id' },
      seller: { entity: 'sales_contracts', field: 'seller_id' },
      buyer: { entity: 'sales_contracts', field: 'buyer_id' },
      status: { entity: 'sales_contracts', field: 'status' },
      dld_application_no: { entity: 'sales_contracts', field: 'dld_application_no' },
      title_deed_no: { entity: 'sales_contracts', field: 'title_deed_no' }
    }
    const m = map[type]
    if (!m) throw bad('Unknown search type')
    const opSql = op === 'equals' ? 'eq' : op === 'starts with' ? 'starts' : op === 'ends with' ? 'ends' : op
    const filters = [{ field: m.field, op: opSql, value }]
    const res = listRecords(getDef('sales_contracts'), { filters, pageSize: 200, sort: 'contract_date', dir: 'desc' }, req.ctx)
    return { total: res.total, rows: res.rows.map(r => ({ id: r.id, contract_no: r.contract_no, property: r._labels.property_id ?? '', seller: r._labels.seller_id ?? '', buyer: r._labels.buyer_id ?? '', status: r.status, sale_price: r.sale_price, contract_date: r.contract_date, dld_application_no: r.dld_application_no, title_deed_no: r.title_deed_no })) }
  })

  // Escrow Account search
  app.get('/api/search/escrow_accounts', async (req) => {
    need(req, 'transactions', 'view')
    const qs = req.query as any
    const type = String(qs.type ?? 'account_no'), op = String(qs.op ?? 'contains'), value = String(qs.value ?? '').trim()
    if (!value) throw bad('Enter a value to search for')
    const map: Record<string, { entity: string; field: string }> = {
      account_no: { entity: 'escrow_accounts', field: 'account_no' },
      sales_contract: { entity: 'escrow_accounts', field: 'sales_contract_id' },
      bank: { entity: 'escrow_accounts', field: 'bank_id' },
      status: { entity: 'escrow_accounts', field: 'status' }
    }
    const m = map[type]
    if (!m) throw bad('Unknown search type')
    const opSql = op === 'equals' ? 'eq' : op === 'starts with' ? 'starts' : op === 'ends with' ? 'ends' : op
    const filters = [{ field: m.field, op: opSql, value }]
    const res = listRecords(getDef('escrow_accounts'), { filters, pageSize: 200, sort: 'opened_date', dir: 'desc' }, req.ctx)
    return { total: res.total, rows: res.rows.map(r => ({ id: r.id, account_no: r.account_no, sales_contract: r._labels.sales_contract_id ?? '', bank: r._labels.bank_id ?? '', status: r.status, expected_amount: r.expected_amount, received_amount: r.received_amount, opened_date: r.opened_date })) }
  })
}