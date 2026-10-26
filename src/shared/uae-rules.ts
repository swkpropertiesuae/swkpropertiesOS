/**
 * UAE real estate rules that the server enforces and the web app displays.
 * Pure functions only (no database, no clock): callers pass today's date in.
 *
 * The rent-increase bands follow Dubai Decree 43 of 2013 as used by the RERA rent calculator. They are indicative:
 * confirm against the current RERA rental index and law before relying on them in a dispute.
 */
import { shiftDate } from './calendar'

const DATE = /^\d{4}-\d{2}-\d{2}$/
const day = (v: unknown) => (typeof v === 'string' && DATE.test(v.slice(0, 10)) ? v.slice(0, 10) : '')
const r2 = (n: number) => Math.round(n * 100) / 100

// ---------------------------------------------------------------- RERA rent increase (Decree 43 of 2013)
export const RERA_BANDS = [
  { maxBelow: 10, increase: 0, label: 'Up to 10% below index' },
  { maxBelow: 20, increase: 5, label: '11 – 20% below index' },
  { maxBelow: 30, increase: 10, label: '21 – 30% below index' },
  { maxBelow: 40, increase: 15, label: '31 – 40% below index' },
  { maxBelow: Infinity, increase: 20, label: 'More than 40% below index' },
]

export function reraIncrease(currentRent: number, indexAverage: number) {
  const below = indexAverage > 0 ? ((indexAverage - currentRent) / indexAverage) * 100 : 0
  const band = below <= 0 ? RERA_BANDS[0] : RERA_BANDS.find(b => below <= b.maxBelow)!
  const maxRent = currentRent * (1 + band.increase / 100)
  return { below: Math.max(0, below), band, maxIncreasePct: band.increase, maxRent, maxIncrease: maxRent - currentRent }
}

// ---------------------------------------------------------------- renewal notice and increase check
/** Last day to give the tenant written notice of a rent change or non-renewal (end date minus the notice period). */
export function noticeDeadline(endDate: unknown, noticeDays: number): string | null {
  const end = day(endDate)
  return end ? shiftDate(end, -Math.max(0, Math.round(noticeDays))) : null
}

export interface RenewalInput {
  currentRent: number
  newRent: number
  /** RERA index average rent for the unit; without it an increase cannot be confirmed. */
  indexAverage?: number | null
  endDate: string
  /** Date written notice of the rent change was sent to the tenant. */
  noticeSentOn?: string | null
  noticeDays?: number
}

export interface RenewalCheck {
  increasePct: number
  maxIncreasePct: number | null
  maxRent: number | null
  noticeDeadline: string | null
  problems: string[]
}

export function renewalCheck(p: RenewalInput): RenewalCheck {
  const current = Number(p.currentRent) || 0, next = Number(p.newRent) || 0
  const increasePct = current > 0 ? r2(((next - current) / current) * 100) : 0
  const index = Number(p.indexAverage) || 0
  const deadline = noticeDeadline(p.endDate, p.noticeDays ?? 90)
  const out: RenewalCheck = { increasePct, maxIncreasePct: null, maxRent: null, noticeDeadline: deadline, problems: [] }
  if (index > 0 && current > 0) {
    const r = reraIncrease(current, index)
    out.maxIncreasePct = r.maxIncreasePct
    out.maxRent = r2(r.maxRent)
  }
  if (next <= current) return out // no increase: nothing to justify
  if (out.maxRent === null) out.problems.push('The RERA index average rent is not recorded, so the increase cannot be confirmed.')
  else if (next > out.maxRent + 0.005) out.problems.push(`The increase of ${increasePct}% is above the RERA limit of ${out.maxIncreasePct}% (maximum rent ${out.maxRent.toLocaleString('en-US')}).`)
  const sent = day(p.noticeSentOn)
  if (!sent) out.problems.push('No written rent-change notice is recorded.')
  else if (deadline && sent > deadline) out.problems.push(`The rent-change notice was sent on ${sent}, after the deadline of ${deadline}.`)
  return out
}

// ---------------------------------------------------------------- advertising permit (Trakheesi)
export type PermitStatus = 'Missing' | 'No expiry' | 'Valid' | 'Expiring' | 'Expired'

export function permitStatus(permitNo: unknown, expiry: unknown, today: string, warnDays = 30): PermitStatus {
  if (!String(permitNo ?? '').trim()) return 'Missing'
  const exp = day(expiry)
  if (!exp) return 'No expiry'
  if (exp < today) return 'Expired'
  return exp <= shiftDate(today, warnDays) ? 'Expiring' : 'Valid'
}

/** A listing may be advertised unless the permit is missing or expired. */
export const permitUsable = (s: PermitStatus) => s !== 'Missing' && s !== 'Expired'

// ---------------------------------------------------------------- KYC / AML
export const KYC_STANDARD_CHECKS = [
  'Identity document (Emirates ID / passport)',
  'Residence visa or entry stamp',
  'Proof of address',
  'Trade licence (companies)',
  'Beneficial owner identification (25%+)',
  'Source of funds',
  'Sanctions screening',
  'PEP screening',
  'Adverse media screening',
] as const

/** Months until the next client review, by risk rating (internal policy default; adjust to your AML policy). */
export const KYC_REVIEW_MONTHS: Record<string, number> = { High: 6, Medium: 12, Low: 24 }

export function nextKycReview(lastReview: unknown, risk: unknown): string | null {
  const last = day(lastReview)
  if (!last) return null
  const months = KYC_REVIEW_MONTHS[String(risk)] ?? KYC_REVIEW_MONTHS.Medium
  const d = new Date(last + 'T00:00:00Z')
  d.setUTCMonth(d.getUTCMonth() + months)
  return d.toISOString().slice(0, 10)
}
