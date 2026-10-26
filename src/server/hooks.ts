import { docTemplateHooks, studioDocumentHooks } from './domain/studio'
import {
  knowledgeHooks, qualificationHooks, skillRuleHooks,
  dailyReportHooks, inventorySubmissionHooks, developerRequestHooks,
  transactionHooks, communicationHooks, commissionEntitlementHooks,
} from './domain/enterprise'
import { slaHooks, workHooks } from './domain/work'
import { automationRuleHooks } from './automation'
import type { EntityDef } from '../shared/types'
import { can, type Ctx, type Rec } from './engine'
import { q } from './db'
import { bad, forbidden } from './util'
import { jobHooks } from './domain/jobs'
import { quoteHooks, partyHooks, leadHooks, opportunityHooks, contractHooks } from './domain/sales'
import { invoiceHooks, billHooks, receiptHooks, paymentHooks, journalHooks, expenseHooks, bankTxnHooks } from './domain/finance'
import { leaseHooks, dldFilingHooks, kycCheckHooks, amlReportHooks } from './domain/uae'
import { withCompliance, COMPLIANCE_KEYS } from './domain/compliance'
import { userHooks, roleHooks, branchHooks, taskHooks, ticketHooks, leaveHooks, attendanceHooks, payslipHooks, poHooks, currencyHooks, activityHooks, apiKeyHooks, attachmentHooks } from './domain/misc'

export interface HookArgs { def: EntityDef; rec: Rec; old: Rec | null; children: Record<string, Rec[]>; isNew: boolean; ctx: Ctx }
export interface DeleteArgs { def: EntityDef; rec: Rec; ctx: Ctx }
export interface Hooks {
  tokens?: (rec: Rec) => Record<string, string>
  numberDate?: (rec: Rec) => string
  beforeSave?: (a: HookArgs) => void
  afterSave?: (a: HookArgs) => void
  beforeDelete?: (a: DeleteArgs) => void
}

const registry: Record<string, () => Hooks> = {
  doc_templates: () => docTemplateHooks, studio_documents: () => studioDocumentHooks,
  knowledge_articles: () => knowledgeHooks, staff_qualifications: () => qualificationHooks, activity_skill_rules: () => skillRuleHooks,
  daily_reports: () => dailyReportHooks, inventory_submissions: () => inventorySubmissionHooks, developer_requests: () => developerRequestHooks,
  transactions: () => transactionHooks, communications: () => communicationHooks, commission_entitlements: () => commissionEntitlementHooks,
  automation_rules: () => automationRuleHooks, sla_policies: () => slaHooks, work_items: () => workHooks,
  jobs: () => jobHooks,
  quotations: () => quoteHooks, parties: () => partyHooks, leads: () => leadHooks, opportunities: () => opportunityHooks, contracts: () => contractHooks,
  invoices: () => invoiceHooks, bills: () => billHooks, receipts: () => receiptHooks, payments: () => paymentHooks, journal_entries: () => journalHooks,
  expenses: () => expenseHooks, bank_transactions: () => bankTxnHooks,
  users: () => userHooks, roles: () => roleHooks, branches: () => branchHooks, tasks: () => taskHooks, tickets: () => ticketHooks, leave_requests: () => leaveHooks,
  attendance: () => attendanceHooks, payslips: () => payslipHooks, purchase_orders: () => poHooks, currencies: () => currencyHooks, activities: () => activityHooks,
  leases: () => leaseHooks, dld_filings: () => dldFilingHooks, kyc_checks: () => kycCheckHooks, aml_reports: () => amlReportHooks,
  api_keys: () => apiKeyHooks, attachments: () => attachmentHooks,
}

const IMMUTABLE_ENTITIES = new Set(['audit_events', 'supervisor_access_logs', 'location_access_logs', 'lead_assignment_logs'])
const PROTECTED_HISTORY_ENTITIES = new Set(['leads', 'parties', 'opportunities', 'communications', 'transactions', 'listing_mandates'])

function enforceDeleteGovernance(key: string, a: DeleteArgs) {
  if (IMMUTABLE_ENTITIES.has(key)) {
    throw bad(`${a.def.label} records are immutable audit logs and cannot be deleted`)
  }
  if (key === 'compliance_cases' && a.rec.legal_hold) {
    throw bad('Cannot delete a compliance case while Legal Hold is active (Control 3.20 / 4.09)')
  }
  const hold = q.get(
    `SELECT case_no FROM compliance_cases WHERE linked_entity = ? AND linked_record_id = ? AND legal_hold = 1 AND status <> 'Closed' AND deleted_at IS NULL LIMIT 1`,
    key, a.rec.id,
  )
  if (hold) {
    throw bad(`Record is locked under Legal Hold by Compliance Case ${hold.case_no} (Control 3.20 / 4.09)`)
  }
  if (PROTECTED_HISTORY_ENTITIES.has(key) && !a.ctx.system && a.ctx.user) {
    const role = String(a.ctx.user.role_name || '').toLowerCase()
    const isAdminOrCompliance = can(a.ctx.user, 'admin', 'delete') || can(a.ctx.user, 'compliance', 'approve') || ['admin', 'administrator', 'ceo', 'compliance', 'legal'].some(r => role.includes(r))
    if (!isAdminOrCompliance) {
      throw forbidden('Customer and lead history cannot be deleted by ordinary brokers or non-compliance roles (Control 3.31)')
    }
  }
}

const NONE: Hooks = {}
const wrapped = new Map<string, Hooks>()
export function hooksFor(key: string): Hooks {
  let w = wrapped.get(key)
  if (w) return w
  const raw = registry[key]?.() ?? NONE
  const base = COMPLIANCE_KEYS.has(key) ? withCompliance(key, raw) : raw
  w = {
    ...base,
    beforeDelete(a: DeleteArgs) {
      enforceDeleteGovernance(key, a)
      base.beforeDelete?.(a)
    },
  }
  wrapped.set(key, w)
  return w
}
