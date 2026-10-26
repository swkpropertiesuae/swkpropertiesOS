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
