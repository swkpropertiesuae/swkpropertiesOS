import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { tx } from '../db'
import { body, idOf } from './helpers'
import {
  publishKnowledge, reviseKnowledge, acknowledgeKnowledge,
  verifyQualification, revokeQualification, competencyMatrix,
  getEnterpriseCommandCentre, ENTERPRISE_MODULE_CATALOGUE,
  submitDailyReport, reviewDailyReport, scanMissingDailyReports,
  resolveInventoryConflict, verifyInventorySubmission, approveAndPublishInventory, approveListingPriceChange,
  submitDeveloperNoc, uploadDeveloperNocDocument, verifyDeveloperNoc,
  advanceTransactionStage, raiseTransactionException, resolveTransactionException,
  advanceImmigrationCase, activateAgentAuthorisation, handleExpiredBrokerCredential,
  superviseCommunication, handleCommunicationOutage, accessEmployeeLocation,
  updateCommissionPayeeIban, verifyCommissionIban, recordDeveloperClawback,
  initiateCommissionPayout, approveCommissionPayout, executeCommissionPayout,
  assignComplianceInvestigator, decideComplianceCase, appealComplianceCase, resolveComplianceAppeal,
  checkBulkExportDlp, disputeViewingAttendance, reassignProtectedLead,
  challengeQaReview, resolveQaChallenge,
  executeEmployeeSeparation, decideUniversalApproval,
} from '../domain/enterprise'

const reason = z.object({ reason: z.string().trim().min(10).max(2000) })

export default async function (app: FastifyInstance) {
  // Existing Knowledge & Competency routes
  app.post('/api/knowledge/:id/publish', async req => tx(() => publishKnowledge(idOf((req.params as any).id), req.ctx)))
  app.post('/api/knowledge/:id/revise', async req => { const b = reason.parse(req.body); return tx(() => reviseKnowledge(idOf((req.params as any).id), b.reason, req.ctx)) })
  app.post('/api/knowledge/:id/acknowledge', async req => tx(() => acknowledgeKnowledge(idOf((req.params as any).id), req.ctx)))
  app.get('/api/competency/matrix', async req => competencyMatrix(req.ctx))
  app.post('/api/qualifications/:id/verify', async req => tx(() => verifyQualification(idOf((req.params as any).id), req.ctx)))
  app.post('/api/qualifications/:id/revoke', async req => { const b = reason.parse(req.body); return tx(() => revokeQualification(idOf((req.params as any).id), b.reason, req.ctx)) })

  // 3.28 & Section 8: Enterprise Command Centre & 35-Module Catalogue
  app.get('/api/enterprise/command-centre', async req => getEnterpriseCommandCentre(req.ctx))
  app.get('/api/enterprise/modules', async () => ({ modules: ENTERPRISE_MODULE_CATALOGUE }))

  // 3.06 / 4.01: Daily Staff Accountability & Reporting
  app.post('/api/daily-reports/:id/submit', async req => tx(() => submitDailyReport(idOf((req.params as any).id), req.ctx)))
  app.post('/api/daily-reports/:id/review', async req => {
    const b = body<{ decision: 'approve' | 'return'; feedback?: string }>(req)
    const dec = String(b.decision || 'approve').toLowerCase() === 'return' ? 'return' : 'approve'
    return tx(() => reviewDailyReport(idOf((req.params as any).id), dec, b.feedback || '', req.ctx))
  })
  app.post('/api/daily-reports/scan-missing', async req => {
    const b = body<{ date?: string }>(req)
    return tx(() => scanMissingDailyReports(b.date, req.ctx))
  })

  // 3.07 / 3.12 / 4.02: Daily Inventory Acquisition & Listing Gate
  app.post('/api/inventory-submissions/:id/resolve-conflict', async req => {
    const b = body<{ resolution: 'merge' | 'clear' | 'reject'; notes: string }>(req)
    return tx(() => resolveInventoryConflict(idOf((req.params as any).id), b.resolution, b.notes || '', req.ctx))
  })
  app.post('/api/inventory-submissions/:id/verify', async req => {
    const b = body<{ stage: 'inventory' | 'compliance' }>(req)
    return tx(() => verifyInventorySubmission(idOf((req.params as any).id), b.stage, req.ctx))
  })
  app.post('/api/inventory-submissions/:id/publish', async req => tx(() => approveAndPublishInventory(idOf((req.params as any).id), req.ctx)))
  app.post('/api/listing-mandates/:id/approve-price', async req => {
    const b = body<{ newPrice: number; reason?: string; ownerConsentEvidence?: string }>(req)
    return tx(() => approveListingPriceChange(idOf((req.params as any).id), Number(b.newPrice), b.reason || b.ownerConsentEvidence || '', req.ctx))
  })

  // 3.08 / 4.03: Developer NOC & Clearance Centre
  app.post('/api/developer-requests/:id/submit', async req => {
    const b = body<{ portalRef: string; senderEmail?: string }>(req)
    return tx(() => submitDeveloperNoc(idOf((req.params as any).id), b.portalRef || '', b.senderEmail || 'noc@swkpropertiesuae.com', req.ctx))
  })
  app.post('/api/developer-requests/:id/upload-noc', async req => {
    const b = body<{ nocNumber: string; issueDate: string; expiryDate: string; docRef?: string }>(req)
    return tx(() => uploadDeveloperNocDocument(idOf((req.params as any).id), b.nocNumber || '', b.issueDate || '', b.expiryDate || '', b.docRef || 'DOC-NOC-PDF', req.ctx))
  })
  app.post('/api/developer-requests/:id/verify', async req => {
    const b = body<{ decision: 'verify' | 'flag_fraud'; notes?: string }>(req)
    const dec = String(b.decision || 'verify').toLowerCase() === 'flag_fraud' ? 'flag_fraud' : 'verify'
    return tx(() => verifyDeveloperNoc(idOf((req.params as any).id), dec, b.notes || '', req.ctx))
  })

  // 3.13 / 3.14 / 4.04 / 4.05: Secondary Sales & Off-Plan Transactions
  app.post('/api/enterprise-transactions/:id/advance', async req => {
    const b = body<{ targetStage: string; payload?: Record<string, any> }>(req)
    return tx(() => advanceTransactionStage(idOf((req.params as any).id), b.targetStage, b.payload || {}, req.ctx))
  })
  app.post('/api/enterprise-transactions/:id/raise-exception', async req => {
    const b = body<{ exceptionType: string; notes: string }>(req)
    return tx(() => raiseTransactionException(idOf((req.params as any).id), b.exceptionType, b.notes || '', req.ctx))
  })
  app.post('/api/enterprise-transactions/:id/resolve-exception', async req => {
    const b = body<{ resolutionNotes: string; resumeStage?: string; patchFlags?: Record<string, any> }>(req)
    return tx(() => resolveTransactionException(idOf((req.params as any).id), b.resolutionNotes || '', b.resumeStage || 'Lead Qualified', b.patchFlags || {}, req.ctx))
  })

  // 3.03 / 3.04 / 4.06: Visa, Immigration, PRO & Broker Authorisation
  app.post('/api/immigration-cases/:id/advance', async req => {
    const b = body<{ step: 'submit' | 'official_approval' | 'complete' | 'escalate_delay'; payload?: Record<string, any> }>(req)
    return tx(() => advanceImmigrationCase(idOf((req.params as any).id), b.step, b.payload || {}, req.ctx))
  })
  app.post('/api/agent-authorisations/:id/activate', async req => {
    const b = body<{ stage?: 'hr' | 'compliance' }>(req)
    return tx(() => activateAgentAuthorisation(idOf((req.params as any).id), b.stage || 'compliance', req.ctx))
  })
  app.post('/api/agent-authorisations/:id/expire-cover', async req => {
    const b = body<{ coverAgentId: number }>(req)
    return tx(() => handleExpiredBrokerCredential(idOf((req.params as any).id), Number(b.coverAgentId), req.ctx))
  })

  // 3.09 / 3.10 / 4.07: WhatsApp Supervision & Field Presence Privacy
  app.post('/api/communications/:id/supervise', async req => {
    const b = body<{
      actionType: 'Supervisor Quality Review' | 'Complaint Investigation' | 'Leave / Exit Ownership Handoff' | 'SLA Escalation Reassignment'
      reason: string
      newOwnerId?: number | null
      extractTaskTitle?: string | null
    }>(req)
    return tx(() => superviseCommunication(idOf((req.params as any).id), b.actionType || 'Supervisor Quality Review', b.reason || '', b.newOwnerId ? Number(b.newOwnerId) : null, b.extractTaskTitle || null, req.ctx))
  })
  app.post('/api/communications/:id/outage', async req => {
    const b = body<{ fallbackNote?: string }>(req)
    return tx(() => handleCommunicationOutage(idOf((req.params as any).id), b.fallbackNote || '', req.ctx))
  })
  app.post('/api/field-sessions/:id/location', async req => {
    const b = body<{ exceptionReason?: string }>(req)
    return tx(() => accessEmployeeLocation(idOf((req.params as any).id), b.exceptionReason, req.ctx))
  })

  // 3.17 / 3.32 / 4.08: Commissions, Disputes, IBAN Security & 3-Way Payouts
  app.post('/api/commission-entitlements/:id/update-iban', async req => {
    const b = body<{ newIban: string }>(req)
    return tx(() => updateCommissionPayeeIban(idOf((req.params as any).id), b.newIban, req.ctx))
  })
  app.post('/api/commission-entitlements/:id/verify-iban', async req => {
    const b = body<{ outOfBandRef: string }>(req)
    return tx(() => verifyCommissionIban(idOf((req.params as any).id), b.outOfBandRef || '', req.ctx))
  })
  app.post('/api/commission-entitlements/:id/clawback', async req => {
    const b = body<{ clawbackAmount: number; reason: string }>(req)
    return tx(() => recordDeveloperClawback(idOf((req.params as any).id), Number(b.clawbackAmount), b.reason || '', req.ctx))
  })
  app.post('/api/commission-entitlements/:id/initiate', async req => tx(() => initiateCommissionPayout(idOf((req.params as any).id), req.ctx)))
  app.post('/api/commission-entitlements/:id/approve', async req => tx(() => approveCommissionPayout(idOf((req.params as any).id), req.ctx)))
  app.post('/api/commission-entitlements/:id/execute', async req => {
    const b = body<{ bankRef?: string }>(req)
    return tx(() => executeCommissionPayout(idOf((req.params as any).id), b.bankRef || 'WPS-BANK-BATCH', req.ctx))
  })

  // 3.20 / 3.29 / 3.30 / 3.31 / 3.33 / 4.09: Compliance, Fraud, DLP, Lead Protection & QA
  app.post('/api/compliance-cases/:id/assign', async req => {
    const b = body<{ investigatorId: number }>(req)
    return tx(() => assignComplianceInvestigator(idOf((req.params as any).id), Number(b.investigatorId), req.ctx))
  })
  app.post('/api/compliance-cases/:id/decide', async req => {
    const b = body<{ findings: string; remedyDecision: string }>(req)
    return tx(() => decideComplianceCase(idOf((req.params as any).id), b.findings || '', b.remedyDecision || '', req.ctx))
  })
  app.post('/api/compliance-cases/:id/appeal', async req => {
    const b = body<{ appealNotes: string }>(req)
    return tx(() => appealComplianceCase(idOf((req.params as any).id), b.appealNotes || '', req.ctx))
  })
  app.post('/api/compliance-cases/:id/resolve-appeal', async req => {
    const b = body<{ outcome: 'correct_false_flag' | 'uphold'; notes: string }>(req)
    return tx(() => resolveComplianceAppeal(idOf((req.params as any).id), b.outcome || 'correct_false_flag', b.notes || '', req.ctx))
  })
  app.post('/api/dlp/check-export', async req => {
    const b = body<{ entityKey: string; requestedRows: number }>(req)
    return tx(() => checkBulkExportDlp(b.entityKey, Number(b.requestedRows), req.ctx))
  })
  app.post('/api/viewings/:id/dispute-attendance', async req => {
    const b = body<{ clientStatement: string }>(req)
    return tx(() => disputeViewingAttendance(idOf((req.params as any).id), b.clientStatement || '', req.ctx))
  })
  app.post('/api/leads/:id/reassign-protected', async req => {
    const b = body<{ toUserId: number; mode?: string; reason: string }>(req)
    return tx(() => reassignProtectedLead(idOf((req.params as any).id), Number(b.toUserId), b.mode || 'Approved Manager Reassignment', b.reason || '', req.ctx))
  })
  app.post('/api/qa-reviews/:id/challenge', async req => {
    const b = body<{ challengeReason: string }>(req)
    return tx(() => challengeQaReview(idOf((req.params as any).id), b.challengeReason || '', req.ctx))
  })
  app.post('/api/qa-reviews/:id/resolve-challenge', async req => {
    const b = body<{ decision: 'uphold' | 'adjust'; adjustedScore?: number | null; notes: string }>(req)
    return tx(() => resolveQaChallenge(idOf((req.params as any).id), b.decision || 'adjust', b.adjustedScore !== undefined ? Number(b.adjustedScore) : null, b.notes || '', req.ctx))
  })

  // 3.26 / 3.27 / 4.10: HR Separation & Universal Approvals
  app.post('/api/hr-lifecycle/:id/separate', async req => {
    const b = body<{ handoverToUserId: number }>(req)
    return tx(() => executeEmployeeSeparation(idOf((req.params as any).id), Number(b.handoverToUserId), req.ctx))
  })
  app.post('/api/universal-approvals/:id/decide', async req => {
    const b = body<{ decision: 'approve' | 'reject' | 'return'; comments: string }>(req)
    return tx(() => decideUniversalApproval(idOf((req.params as any).id), b.decision || 'approve', b.comments || '', req.ctx))
  })
}
