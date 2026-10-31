/** Server rules for UAE real estate: lease rent caps and notice dates, DLD filings, KYC and goAML records.
 *  Figures and rules are indicative defaults. Confirm against current RERA / DLD / FIU guidance. */
import type { Hooks } from '../hooks'
import { bad, todayStr, addDays } from '../util'
import { getSetting } from '../settings'
import { noticeDeadline, reraIncrease } from '../../shared/uae-rules'

const day = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : '')

export const leaseHooks: Hooks = {
  beforeSave({ rec }) {
    const days = Number(rec.renewal_notice_days) > 0 ? Number(rec.renewal_notice_days) : 90
    rec.notice_deadline = noticeDeadline(rec.end_date, days)
    const rent = Number(rec.annual_rent) || 0, index = Number(rec.rera_average_rent) || 0
    if (rent > 0 && index > 0) {
      const r = reraIncrease(rent, index)
      rec.allowed_increase_pct = r.maxIncreasePct
      rec.max_renewal_rent = Math.round(r.maxRent * 100) / 100
    } else { rec.allowed_increase_pct = null; rec.max_renewal_rent = null }
    const fee = Number(rec.agency_fee) || 0
    if (fee > 0) {
      const a2a = rec.is_third_party_a2a ? (Number(rec.third_party_a2a_amount) || 0) : 0
      const netPool = Math.max(0, fee - a2a)
      rec.company_50_share = Math.round(netPool * 50) / 100
      rec.advisor_50_share = Math.round(netPool * 50) / 100
    }
  },
}

export const salesContractHooks: Hooks = {
  beforeSave({ rec }) {
    if (rec.personal_account_prohibited_ack === false) {
      throw bad('UAE Compliance Gate: You must confirm that no client funds are received into any Sales Advisor personal account.')
    }
    if (/personal\s*(bank|account|iban)|agent\s*personal|advisor\s*personal/i.test(`${rec.payment_method ?? ''} ${rec.payment_Custodian ?? ''} ${rec.notes ?? ''}`)) {
      throw bad('UAE Compliance Violation: Client payments cannot be received into a Sales Advisor personal account.')
    }
  },
}

export const agentCommissionHooks: Hooks = {
  beforeSave({ rec }) {
    const gross = Number(rec.gross_commission) || 0
    const a2a = Number(rec.third_party_a2a_share) || 0
    const netPool = Math.max(0, Math.round((gross - a2a) * 100) / 100)
    rec.company_net_pool = netPool
    const pct = Number(rec.split_pct ?? 50)
    const agtShare = Math.round(netPool * (pct / 100) * 100) / 100
    rec.agent_share ??= agtShare
    rec.brokerage_share ??= Math.round((netPool - agtShare) * 100) / 100
    const vat = Number(rec.vat_amount) || 0
    const ded = Number(rec.deductions) || 0
    rec.net_payable = Math.max(0, Math.round(((Number(rec.agent_share) || agtShare) + vat - ded) * 100) / 100)
  },
}

export const dealWithdrawalHooks: Hooks = {
  beforeSave({ rec, old, ctx }) {
    const paid = Number(rec.total_paid_amount) || 0
    const retained = Number(rec.forfeited_or_retained_amount) || 0
    if (rec.approved_refund_amount === undefined || rec.approved_refund_amount === null || rec.approved_refund_amount === 0) {
      rec.approved_refund_amount = Math.max(0, Math.round((paid - retained) * 100) / 100)
    }
    if (!ctx.system && old && rec.status !== old.status) {
      const isOwner = ctx.user?.permissions === '*' || ctx.user?.role_name === 'Owner' || ctx.user?.role_name === 'Admin'
      if (rec.status === 'Approved by Owner' && !isOwner) {
        throw bad('Only Owner (Shabib Siraj) can approve a deal withdrawal & client refund determination.')
      }
      if (rec.status === 'Refund Processed' && old.status !== 'Approved by Owner' && !isOwner) {
        throw bad('Deal withdrawal refund must be approved by Owner (Shabib Siraj) before processing refund.')
      }
    }
  },
}

export const dldFilingHooks: Hooks = {
  beforeSave({ rec, old }) {
    const issue = day(rec.issue_date), exp = day(rec.expiry_date)
    if (issue && exp && exp < issue) throw bad('Valid until cannot be before the issue date')
    const sub = day(rec.submitted_date), reg = day(rec.registered_date)
    if (sub && reg && reg < sub) throw bad('Registered on cannot be before submitted on')
    if (rec.status === 'Registered') {
      if (!String(rec.reference_no ?? '').trim()) throw bad('Enter the DLD / developer reference number before marking a filing as registered')
      rec.registered_date ||= todayStr()
      rec.submitted_date ||= rec.registered_date
    }
    if (rec.status === 'Submitted') rec.submitted_date ||= todayStr()
    if (old?.status === 'Registered' && rec.status !== 'Registered' && !['Expired', 'Cancelled'].includes(String(rec.status))) throw bad('A registered filing can only be marked Expired or Cancelled')
  },
}

export const kycCheckHooks: Hooks = {
  beforeSave({ rec }) {
    if (rec.result && rec.result !== 'Pending' && rec.result !== 'Not applicable') rec.checked_on ||= todayStr()
    const checked = day(rec.checked_on), exp = day(rec.expiry_date)
    if (checked && exp && exp < checked) throw bad('Valid until cannot be before the check date')
  },
}

export const amlReportHooks: Hooks = {
  beforeSave({ rec, old }) {
    if (old?.status === 'Filed' && !['Filed', 'Closed'].includes(String(rec.status))) throw bad('A filed goAML report cannot be reopened. Create a new report if more information must be sent')
    if (old?.status === 'Filed') {
      for (const f of ['report_type', 'reason', 'party_id', 'amount', 'transaction_date', 'narrative', 'goaml_ref', 'filed_on'])
        if (JSON.stringify(rec[f] ?? null) !== JSON.stringify(old[f] ?? null)) throw bad('A filed goAML report cannot be changed')
    }
    rec.detected_on ||= todayStr()
    if (!rec.filing_due) rec.filing_due = addDays(day(rec.detected_on) || todayStr(), Math.max(0, Number(getSetting('aml_filing_days') ?? 5)))
    if (rec.status === 'Filed') {
      if (!String(rec.goaml_ref ?? '').trim()) throw bad('Enter the goAML reference before marking a report as filed')
      rec.filed_on ||= todayStr()
    }
    if (rec.status === 'Not required' && String(rec.mlro_decision ?? '').trim().length < 10) throw bad('Record the compliance officer decision (at least 10 characters) before marking a report as not required')
  },
}
