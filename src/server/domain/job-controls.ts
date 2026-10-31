import { q } from '../db'
import { bad, nowIso } from '../util'
import { getRecord, getDef } from '../engine'

export function closureReadiness(jobId: number, ctx: any) {
  const job = getRecord(getDef('jobs'), jobId, ctx, { children: { charges: true, events: true } })
  const invoices = q.all(`SELECT * FROM invoices WHERE job_id = ? AND deleted_at IS NULL ORDER BY id`, jobId)
  const bills = q.all(`SELECT * FROM bills WHERE job_id = ? AND deleted_at IS NULL ORDER BY id`, jobId)
  const payments = q.all(`SELECT * FROM payments WHERE job_id = ? AND deleted_at IS NULL ORDER BY id`, jobId)
  const receipts = q.all(`SELECT * FROM receipts WHERE job_id = ? AND deleted_at IS NULL ORDER BY id`, jobId)

  const n = (sql: string) => q.val<number>(sql, jobId) ?? 0
  const verified = (evidenceType: string) => {
    const e = q.get(`SELECT 1 FROM job_closure_evidence WHERE job_id = ? AND kind = ? AND verified = 1 AND deleted_at IS NULL`, jobId, evidenceType)
    return !!e
  }

  const checks = [
    { key: 'revenue_invoiced', label: 'All revenue charges invoiced', passed: n(`SELECT COUNT(*) FROM job_charges WHERE job_id = ? AND kind = 'Revenue' AND status = 'Unbilled' AND deleted_at IS NULL AND amount <> 0`) === 0 },
    { key: 'cost_billed', label: 'All cost charges billed', passed: n(`SELECT COUNT(*) FROM job_charges WHERE job_id = ? AND kind = 'Cost' AND status = 'Unbilled' AND deleted_at IS NULL AND amount <> 0`) === 0 },
    { key: 'documents', label: 'Documents reviewed', passed: verified('Documents verified') },
    { key: 'final_accounts', label: 'Final accounts prepared', passed: verified('Final accounts') },
    { key: 'compliance', label: 'Compliance checks passed', passed: verified('Compliance') },
    { key: 'handover', label: 'Handover completed', passed: verified('Handover completed') },
  ]
  return { job, invoices, bills, payments, receipts, checks }
}

export function addClosureEvidence(jobId: number, kind: string, note: string, ctx: any) {
  return q.run(`INSERT INTO job_closure_evidence (job_id, kind, note, user_id, created_at) VALUES (?, ?, ?, ?, ?)`, jobId, kind, note, ctx.user.id, nowIso())
}

export function verifyClosureEvidence(jobId: number, evidenceId: number, ctx: any) {
  q.run(`UPDATE job_closure_evidence SET verified = 1, verified_by = ?, verified_at = ? WHERE id = ? AND job_id = ?`, ctx.user.id, nowIso(), evidenceId, jobId)
}

export function requestReopen(jobId: number, reason: string, ctx: any) {
  return q.run(`INSERT INTO job_reopen_requests (job_id, reason, requested_by, requested_at) VALUES (?, ?, ?, ?)`, jobId, reason, ctx.user.id, nowIso())
}

export function decideReopen(jobId: number, requestId: number, approve: boolean, reason: string, ctx: any) {
  if (approve) q.run(`UPDATE jobs SET job_status = 'Lead', closed_at = NULL WHERE id = ?`, jobId)
  q.run(`UPDATE job_reopen_requests SET decided = 1, decided_by = ?, decided_at = ?, decision = ?, decision_reason = ? WHERE id = ?`, ctx.user.id, nowIso(), approve ? 'approved' : 'rejected', reason, requestId)
  return { ok: true }
}
