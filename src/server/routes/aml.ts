/** KYC checklists and AML / goAML helpers. Thresholds and check lists are editable defaults: confirm against current FIU / RERA / MoE guidance. */
import type { FastifyInstance } from 'fastify'
import { q } from '../db'
import { createRecord, getDef, getRecord } from '../engine'
import { getSetting } from '../settings'
import { fromCents, todayStr } from '../util'
import { KYC_STANDARD_CHECKS, nextKycReview } from '../../shared/uae-rules'
import { idOf, need } from './helpers'

export default async function (app: FastifyInstance) {
  const kycSummary = (partyId: number) => {
    const rows = q.all<any>(`SELECT * FROM kyc_checks WHERE party_id = ? AND deleted_at IS NULL ORDER BY id`, partyId)
    const today = todayStr()
    const latest = new Map<string, any>()
    for (const r of rows) latest.set(r.check_type, r)
    const gaps: string[] = []
    for (const [type, r] of latest) {
      if (r.result === 'Fail') gaps.push(`${type}: failed`)
      else if (r.result === 'Pending') gaps.push(`${type}: pending`)
      else if (r.result === 'Pass' && r.expiry_date && String(r.expiry_date).slice(0, 10) < today) gaps.push(`${type}: expired on ${String(r.expiry_date).slice(0, 10)}`)
    }
    const applicable = [...latest.values()].filter(r => r.result !== 'Not applicable')
    const passed = applicable.filter(r => r.result === 'Pass' && !(r.expiry_date && String(r.expiry_date).slice(0, 10) < today)).length
    return { checks: rows.length, applicable: applicable.length, passed, complete: applicable.length > 0 && passed === applicable.length, gaps }
  }

  app.get('/api/kyc/:partyId', async (req) => {
    need(req, 'compliance', 'view')
    const id = idOf((req.params as any).partyId)
    const party = getRecord(getDef('parties'), id, req.ctx, { children: false })
    const summary = kycSummary(id)
    const extra: string[] = []
    if (party.is_pep) extra.push('Politically exposed person: senior approval and enhanced due diligence needed')
    if (!party.source_of_funds) extra.push('Source of funds not recorded')
    if (party.is_company && !String(party.ubo_details ?? '').trim()) extra.push('Beneficial owners (25%+) not recorded')
    return { party_id: id, ...summary, gaps: [...summary.gaps, ...extra], risk_rating: party.risk_rating ?? null, last_review: party.kyc_last_review ?? null, next_review: nextKycReview(party.kyc_last_review, party.risk_rating) }
  })

  app.post('/api/kyc/:partyId/checklist', async (req) => {
    need(req, 'compliance', 'edit')
    const id = idOf((req.params as any).partyId)
    getRecord(getDef('parties'), id, req.ctx, { children: false })
    const have = new Set(q.all<any>(`SELECT check_type FROM kyc_checks WHERE party_id = ? AND deleted_at IS NULL`, id).map(r => r.check_type))
    const created: string[] = []
    for (const type of KYC_STANDARD_CHECKS) {
      if (have.has(type)) continue
      createRecord(getDef('kyc_checks'), { party_id: id, check_type: type, result: 'Pending' }, req.ctx)
      created.push(type)
    }
    return { created: created.length, existing: have.size, ...kycSummary(id) }
  })

  // Draft goAML reports for cash payments at or above the threshold. Idempotent: one draft per source record.
  app.post('/api/aml/scan-cash', async (req) => {
    need(req, 'compliance', 'edit')
    const threshold = Number(getSetting('aml_cash_threshold') ?? 55000)
    const known = new Set(q.all<any>(`SELECT source_ref FROM aml_reports WHERE source_ref IS NOT NULL AND deleted_at IS NULL`).map(r => r.source_ref))
    const reason = 'Cash payment at or above the threshold'
    const created: number[] = []
    const draft = (ref: string, amount: number, date: string, partyId: number | null, contractId: number | null, what: string) => {
      if (known.has(ref)) return
      known.add(ref)
      const r = createRecord(getDef('aml_reports'), {
        report_type: 'REAR – Real Estate Activity Report', status: 'Draft', reason, party_id: partyId, sales_contract_id: contractId, amount, transaction_date: date,
        narrative: `${what}: cash payment of AED ${amount.toLocaleString('en-US')} (threshold AED ${threshold.toLocaleString('en-US')}). Compliance officer to review and decide whether a report is required.`,
        source_ref: ref, auto_created: true,
      }, { ...req.ctx, system: true }) // source_ref and auto_created are read-only for people
      created.push(r.id)
    }
    for (const c of q.all<any>(`SELECT id, buyer_id, sale_price, contract_date FROM sales_contracts WHERE payment_method = 'Cash' AND deleted_at IS NULL`)) {
      const amount = fromCents(c.sale_price)
      if (amount >= threshold) draft(`sales_contracts:${c.id}`, amount, String(c.contract_date ?? '').slice(0, 10), c.buyer_id ?? null, c.id, `Sales contract #${c.id}`)
    }
    for (const r of q.all<any>(`SELECT id, tenant_id, amount, receipt_date FROM rent_receipts WHERE payment_method = 'Cash' AND deleted_at IS NULL`)) {
      const amount = fromCents(r.amount)
      if (amount >= threshold) draft(`rent_receipts:${r.id}`, amount, String(r.receipt_date ?? '').slice(0, 10), r.tenant_id ?? null, null, `Rent receipt #${r.id}`)
    }
    return { threshold, created: created.length, ids: created }
  })

  app.get('/api/aml/overview', async (req) => {
    need(req, 'compliance', 'view')
    const today = todayStr()
    const open = q.all<any>(`SELECT id, status, filing_due FROM aml_reports WHERE deleted_at IS NULL AND status IN ('Draft', 'Under review')`)
    const overdue = open.filter(r => r.filing_due && String(r.filing_due).slice(0, 10) < today).length
    const filed = q.val<number>(`SELECT COUNT(*) FROM aml_reports WHERE deleted_at IS NULL AND filed_on IS NOT NULL`) ?? 0
    const pep = q.val<number>(`SELECT COUNT(*) FROM parties WHERE deleted_at IS NULL AND is_pep = 1`) ?? 0
    const pending = q.val<number>(`SELECT COUNT(*) FROM kyc_checks WHERE deleted_at IS NULL AND result = 'Pending'`) ?? 0
    const failed = q.val<number>(`SELECT COUNT(*) FROM kyc_checks WHERE deleted_at IS NULL AND result = 'Fail'`) ?? 0
    return { open: open.length, overdue, filed, pep_clients: pep, kyc_pending: pending, kyc_failed: failed, cash_threshold: Number(getSetting('aml_cash_threshold') ?? 55000) }
  })
}
