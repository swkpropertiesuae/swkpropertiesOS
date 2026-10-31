import assert from 'node:assert/strict'
import { syncSchema } from '../src/server/schema'
import { seedReference } from '../src/server/seed'
import { buildApp } from '../src/server/app'
import { q, db } from '../src/server/db'
import { config } from '../src/server/config'
import { hashPassword } from '../src/server/auth'
import { resetBusinessData } from '../src/server/domain/business-data'

syncSchema()
seedReference()
await resetBusinessData({ user: null, system: true }, { backup: false })
seedReference()

// Ensure Shabib Siraj (Owner) and Mohammad Haseeb (Manager) accounts are active with known test passwords
q.run(
  `UPDATE users SET active = 1, password_hash = ?, must_change_password = 0, totp_secret = NULL, failed_logins = 0, locked_until = NULL WHERE email = ?`,
  hashPassword('SwkOwner-2026!Secure'),
  config.accounts.adminEmail
)
q.run(
  `UPDATE users SET active = 1, password_hash = ?, must_change_password = 0, totp_secret = NULL, failed_logins = 0, locked_until = NULL WHERE email = ?`,
  hashPassword('SwkManager-2026!Secure'),
  config.accounts.managerEmail
)

const app = await buildApp()
let checks = 0
let address = 50

const check = (label: string, value: unknown, debug?: any) => {
  if (!value && debug !== undefined) console.error('DEBUG FAIL:', label, debug)
  assert.ok(value, label)
  checks++
  console.log('  ✓', label)
}

async function apiReq(path: string, method = 'GET', payload?: any, sessionToken?: string, extraHeaders?: Record<string, string>) {
  return app.inject({
    url: path,
    method: method as any,
    payload,
    remoteAddress: `127.0.2.${address++}`,
    headers: {
      'x-swk-client': 'android',
      ...(sessionToken ? { 'x-swk-session': sessionToken } : {}),
      ...(extraHeaders || {}),
    },
  })
}

try {
  console.log('Testing SWK Properties OS Complete UAE Overhaul…')

  // 1. Verify Security Hardening: /api/demo/status never leaks demoPassword
  const demoStatusRes = await apiReq('/api/demo/status', 'GET')
  const demoStatus = demoStatusRes.json()
  check('Demo status endpoint never leaks demoPassword', demoStatusRes.statusCode === 200 && !('demoPassword' in demoStatus))

  // 2. Verify Company Hierarchy & Seeded Accounts
  const ownerLogin = await apiReq('/api/auth/login', 'POST', {
    email: config.accounts.adminEmail,
    password: 'SwkOwner-2026!Secure',
  })
  const ownerToken = ownerLogin.json().sessionToken as string
  check('Owner Shabib Siraj logs in with full access', ownerLogin.statusCode === 200 && Boolean(ownerToken))

  const managerLogin = await apiReq('/api/auth/login', 'POST', {
    email: config.accounts.managerEmail,
    password: 'SwkManager-2026!Secure',
  })
  const managerToken = managerLogin.json().sessionToken as string
  check('Manager Mohammad Haseeb logs in with operational access', managerLogin.statusCode === 200 && Boolean(managerToken))

  const staffRows = q.all<any>(`SELECT * FROM employees WHERE deleted_at IS NULL`)
  check('Shabib Siraj (Owner), Mohammad Haseeb (Manager), and Talha Shabbir (BDM & IT Admin) exist in employees',
    staffRows.some((e: any) => String(e.name).includes('Shabib Siraj')) &&
    staffRows.some((e: any) => String(e.name).includes('Mohammad Haseeb')) &&
    staffRows.some((e: any) => String(e.name).includes('Talha Shabbir'))
  )
  const advisorRows = staffRows.filter((e: any) => String(e.compensation_model).includes('Commission Only'))
  check('Sales Advisors are on Company Visa with 0 basic salary and 50/50 commission split',
    advisorRows.length > 0 && advisorRows.every((e: any) => Number(e.basic_salary) === 0 && Number(e.commission_split_company_pct ?? e.commission_split_pct ?? 50) === 50 && Number(e.commission_split_agent_pct ?? 50) === 50),
    advisorRows
  )

  const depts = q.all<any>(`SELECT code, name FROM departments WHERE deleted_at IS NULL`)
  check('3 Core Operational Departments (OFFPLAN, SECONDARY, LEASING) exist',
    depts.some((d: any) => d.code === 'OFFPLAN') &&
    depts.some((d: any) => d.code === 'SECONDARY') &&
    depts.some((d: any) => d.code === 'LEASING')
  )

  // 3. Initialize SWK ONE & Verify Live GPS Site-Visit Check-In + Mandatory Checkout Gate
  await apiReq('/api/swk-one/initialize', 'POST', {}, ownerToken)
  const bootRes = await apiReq('/api/swk-one/bootstrap', 'GET', undefined, ownerToken)
  const boot = bootRes.json()
  check('SWK ONE bootstrap includes shift_info and checkout_gate',
    bootRes.statusCode === 200 && boot.shift_info && boot.checkout_gate
  )

  // Ensure all today's viewings are Scheduled and no daily report exists yet for today to test Checkout Gate blocking
  const today = new Date().toISOString().slice(0, 10)
  q.run(`DELETE FROM daily_reports WHERE report_date = ?`, today)
  const viewingId = boot.viewings[0].id
  q.run(`UPDATE viewings SET status = 'Scheduled', scheduled_at = ? WHERE id = ?`, `${today} 11:30`, viewingId)

  // Live GPS Site-Visit Arrival also registers Attendance if not yet checked in
  q.run(`DELETE FROM attendance WHERE att_date = ?`, today)
  q.run(`DELETE FROM attendance_events WHERE work_date = ?`, today)
  const arriveRes = await apiReq(`/api/swk-one/viewings/${viewingId}/arrive`, 'POST', {
    lat: 25.0889,
    lng: 55.1469,
  }, ownerToken)
  check('Live GPS site-visit arrival registers attendance & field check-in',
    arriveRes.statusCode === 200 && arriveRes.json().ok === true && Boolean(arriveRes.json().field_session) && (q.val<number>(`SELECT COUNT(*) FROM attendance_events WHERE work_date = ?`, today) ?? 0) > 0,
    arriveRes.json()
  )

  // Attempt checkout before submitting Daily Report -> MUST BE BLOCKED by Checkout Gate
  const blockedCheckout = await apiReq('/api/swk-one/attendance/check-out', 'POST', {
    lat: 25.1867,
    lng: 55.2744,
  }, ownerToken)
  check('Checkout Gate blocks check-out before Daily Report and scheduled site visits are completed',
    blockedCheckout.statusCode === 400 && String(blockedCheckout.json().error).includes('Checkout Gate Blocked'),
    blockedCheckout.json()
  )

  // Complete all scheduled viewings for today & submit One-Tap Daily Report
  for (const v of boot.viewings) {
    await apiReq(`/api/swk-one/viewings/${v.id}/feedback`, 'POST', {
      interest_level: 9,
      decision: 'Make Offer',
      objections: [],
      feedback: 'Client excited about property ROI and ready to proceed.',
    }, ownerToken)
  }
  const eodRes = await apiReq('/api/swk-one/daily-report/one-tap', 'POST', {
    self_summary: 'Completed site visits and client follow-ups.',
    blockers: 'None',
    next_day_priorities: 'Prepare Form F and Reservation',
  }, ownerToken)
  check('Daily report submitted', eodRes.statusCode === 200)

  const allowedCheckout = await apiReq('/api/swk-one/attendance/check-out', 'POST', {
    lat: 25.1867,
    lng: 55.2744,
    client_variable_hours: true,
    variable_hours_reason: 'Extended client viewing at Dubai Marina',
  }, ownerToken)
  check('Check-out succeeds after all scheduled site visits and Daily Report are completed',
    allowedCheckout.statusCode === 200 && allowedCheckout.json().ok === true,
    allowedCheckout.json()
  )

  // 4. Verify Owner WhatsApp Morning Briefing & 10:30 AM Attendance Report
  const morningBriefRes = await apiReq('/api/swk-ops/briefings/morning', 'POST', {}, ownerToken)
  check('Owner Shabib Siraj receives WhatsApp Morning Briefing',
    morningBriefRes.statusCode === 200 && morningBriefRes.json().ok === true && morningBriefRes.json().briefing.recipient.includes('Shabib Siraj')
  )
  const attReportRes = await apiReq('/api/swk-ops/briefings/attendance-1030', 'POST', {}, ownerToken)
  check('Owner Shabib Siraj receives 10:30 AM WhatsApp Attendance & Contemptor Report',
    attReportRes.statusCode === 200 && attReportRes.json().ok === true && Array.isArray(attReportRes.json().summary.late_after_1005)
  )

  // 5. Verify Mandatory Lost/Unqualified Lead Reason
  const leadRes = await apiReq('/api/e/leads', 'POST', {
    company: 'Test Prospect UAE',
    contact_name: 'Omar Al Mansoori',
    phone: '+971 50 123 9876',
    source: 'Bayut',
    department_division: 'Sales of Off-Plan Projects',
    interest: 'Off-Plan Sale',
    status: 'New',
  }, ownerToken)
  const leadId = leadRes.json().id
  check('Lead created under Sales of Off-Plan Projects', leadRes.statusCode === 201 && leadId > 0, leadRes.json())

  const badDisqualify = await apiReq(`/api/e/leads/${leadId}`, 'PUT', {
    status: 'Unqualified',
  }, ownerToken)
  check('Disqualifying a lead without a non-conversion reason is rejected', badDisqualify.statusCode === 400)

  const goodDisqualify = await apiReq(`/api/e/leads/${leadId}`, 'PUT', {
    status: 'Unqualified',
    non_conversion_reason: 'Price / Budget Mismatch',
    non_conversion_notes: 'Client budget is AED 1.1M vs AED 1.6M minimum launch price.',
  }, ownerToken)
  check('Disqualifying a lead with a specific reason succeeds',
    goodDisqualify.statusCode === 200 && goodDisqualify.json().non_conversion_reason === 'Price / Budget Mismatch'
  )

  // 6. Verify Universal Audit Log, Mandatory Edit/Delete Reason & Pending Delete Bin (Owner-Only Approval)
  const noReasonDelete = await apiReq(`/api/e/leads/${leadId}`, 'DELETE', undefined, managerToken)
  check('Deleting a record without a specific reason is rejected', noReasonDelete.statusCode === 400)

  const managerDelete = await apiReq(`/api/e/leads/${leadId}?reason=Duplicate%20portal%20test%20lead`, 'DELETE', undefined, managerToken)
  const managerDeleteJson = managerDelete.json()
  check('Non-Owner delete request is routed to Pending Delete Bin awaiting Owner Shabib Siraj approval',
    managerDelete.statusCode === 200 && managerDeleteJson.queued_for_owner_approval === true && managerDeleteJson.recycle_request?.status === 'Pending Owner Approval',
    managerDeleteJson
  )

  const stillExists = q.get<any>(`SELECT id, deleted_at FROM leads WHERE id = ?`, leadId)
  check('Record remains intact in database while pending in Recycle Bin', stillExists && stillExists.deleted_at === null)

  const recycleReqId = managerDeleteJson.recycle_request.id
  const mgrTryApprove = await apiReq(`/api/swk-ops/recycle-bin/${recycleReqId}/decide`, 'POST', {
    decision: 'approve',
    owner_notes: 'Manager trying to approve own deletion',
  }, managerToken)
  check('Manager Mohammad Haseeb cannot approve permanent deletion from Recycle Bin (Owner Only)', mgrTryApprove.statusCode === 403)

  const ownerApproveDelete = await apiReq(`/api/swk-ops/recycle-bin/${recycleReqId}/decide`, 'POST', {
    decision: 'approve',
    owner_notes: 'Approved by Shabib Siraj after verifying duplicate lead.',
  }, ownerToken)
  check('Owner Shabib Siraj approves Recycle Bin request and permanently deletes record',
    ownerApproveDelete.statusCode === 200 && ownerApproveDelete.json().status === 'Approved & Deleted'
  )
  const deletedNow = q.get<any>(`SELECT id, deleted_at FROM leads WHERE id = ?`, leadId)
  check('Record is soft-deleted only after Owner Shabib Siraj approval', Boolean(deletedNow?.deleted_at))

  // 7. Verify Strictly Legal UAE Payment Modes (Blocking Sales Advisor Personal Accounts) & 50/50 Net Commission Split after 3rd-Party A2A Share
  const custRes = await apiReq('/api/e/parties', 'POST', {
    name: 'Al Futtaim Investor Group LLC',
    is_customer: true,
    phone: '+971 50 998 1122',
    kyc_status: 'Verified',
  }, ownerToken)
  const customerId = custRes.json().id
  const bankAccId = q.val<number>(`SELECT id FROM bank_accounts WHERE deleted_at IS NULL ORDER BY id ASC LIMIT 1`) || 1

  const illegalReceipt = await apiReq('/api/e/receipts', 'POST', {
    party_id: customerId,
    receipt_date: today,
    method: 'Bank transfer',
    bank_account_id: bankAccId,
    amount: 50000,
    notes: 'Transferred to agent personal bank account IBAN',
  }, ownerToken)
  check('Client payment referencing a Sales Advisor personal account is strictly blocked', illegalReceipt.statusCode === 400)

  const cryptoReceipt = await apiReq('/api/e/receipts', 'POST', {
    party_id: customerId,
    receipt_date: today,
    method: 'UAE-Permitted Crypto / USDT (VARA-Licensed Gateway)',
    bank_account_id: bankAccId,
    currency: 'USDT',
    ex_rate: 3.6725,
    reference: 'VARA-USDT-TX-0x99887766',
    amount: 100000,
  }, ownerToken)
  check('Legal UAE USDT / VARA Crypto payment to SWK company account succeeds',
    cryptoReceipt.statusCode === 201 && cryptoReceipt.json().method === 'UAE-Permitted Crypto / USDT (VARA-Licensed Gateway)',
    cryptoReceipt.json()
  )

  // Create a Secondary Deal with 3rd-Party A2A Agent Commission and verify 50/50 split on net company pool
  const branchId = q.val<number>(`SELECT id FROM branches WHERE deleted_at IS NULL ORDER BY id ASC LIMIT 1`) || 1
  const jobRes = await apiReq('/api/e/jobs', 'POST', {
    deal_name: 'Dubai Marina Penthouse Secondary Sale',
    deal_type: 'Sale',
    department_division: 'Secondary Projects',
    branch_id: branchId,
    client_id: customerId,
    deal_date: today,
    deal_value: 2500000,
    commission_pct: 4,
    commission_amount: 100000,
    is_third_party_agent: true,
    external_agency_name: 'Harbour Real Estate Brokers LLC',
    external_agent_name: 'Tariq Al Mulla (ORN-12088)',
    a2a_commission_split_pct: 20,
    a2a_commission_amount: 20000,
    buyer_finance_type: 'Mortgage Pre-Approved',
    legal_payment_mode: 'Manager Cheque (In Seller/Developer Name)',
  }, ownerToken)
  const splitJob = jobRes.json()
  // Gross 100,000 - 20,000 (3rd party A2A) = 80,000 Net Pool -> 40,000 SWK Company (50%) & 40,000 Sales Advisor (50%)
  check('50/50 Commission Split deducts 3rd-party A2A share first (100k - 20k = 80k net -> 40k SWK / 40k Advisor)',
    jobRes.statusCode === 201 &&
    Number(splitJob.a2a_commission_amount) === 20000 &&
    Number(splitJob.company_50_share) === 40000 &&
    Number(splitJob.advisor_50_share) === 40000,
    splitJob
  )

  // 8. Verify Deal Withdrawal & Client Refund Workflow (Requires Owner Shabib Siraj Approval)
  const wdCreateRes = await apiReq('/api/swk-ops/withdrawals', 'POST', {
    department_division: 'Secondary Projects',
    job_id: splitJob.id,
    client_id: customerId,
    withdrawing_party: 'Developer (Project Delay / Cancellation)',
    withdrawal_stage: 'After Form F / MOU Signed (10% Deposit Held)',
    reason: 'Seller/Developer unable to deliver NOC within agreed contract window.',
    total_amount_paid: 100000,
    original_payment_mode: 'Manager Cheque (Uncashed)',
    agreed_terms_at_payment: '100% full refund if Seller/Developer defaults on NOC delivery.',
    forfeited_deduction_amount: 0,
    refundable_amount: 100000,
  }, managerToken)
  const withdrawalId = wdCreateRes.json().withdrawal?.id
  check('Deal withdrawal & client refund request created', wdCreateRes.statusCode === 200 && withdrawalId > 0, wdCreateRes.json())

  const wdMgrReview = await apiReq(`/api/swk-ops/withdrawals/${withdrawalId}/manager-review`, 'POST', {
    manager_recommendation: 'Verified MOU clause 8; full refund of AED 100,000 recommended.',
  }, managerToken)
  check('Manager Mohammad Haseeb reviews withdrawal and forwards to Owner Shabib Siraj',
    wdMgrReview.statusCode === 200 && wdMgrReview.json().status === 'Pending Owner Approval'
  )

  const wdMgrTryApprove = await apiReq(`/api/swk-ops/withdrawals/${withdrawalId}/owner-approve`, 'POST', {
    decision: 'approve',
  }, managerToken)
  check('Manager cannot self-approve Deal Withdrawal refund (Owner Only)', wdMgrTryApprove.statusCode === 403)

  const wdOwnerApprove = await apiReq(`/api/swk-ops/withdrawals/${withdrawalId}/owner-approve`, 'POST', {
    decision: 'approve',
    owner_approval_notes: 'Approved by Shabib Siraj. Issue refund via SWK corporate bank transfer.',
    refund_reference: 'SWK-REF-2026-0091',
  }, ownerToken)
  check('Owner Shabib Siraj approves Deal Withdrawal & releases client refund',
    wdOwnerApprove.statusCode === 200 && wdOwnerApprove.json().status === 'Refund Paid & Closed'
  )

  // 9. Verify Manager Administrative Decision Gate (Requires Owner Shabib Siraj Approval)
  const admCreate = await apiReq('/api/swk-ops/admin-decisions', 'POST', {
    decision_type: 'Portal Advertising Budget Reallocation',
    subject: 'Increase Bayut Signature Slot allocation for Q4 Off-Plan Launches',
    amount: 45000,
    justification: 'High lead conversion in Dubai Creek Harbour & Marina off-plan campaigns.',
  }, managerToken)
  const admId = admCreate.json().approval?.id
  check('Manager Mohammad Haseeb submits administrative decision for Owner approval',
    admCreate.statusCode === 200 && admId > 0 && admCreate.json().approval.status === 'Pending'
  )

  const admOwnerDecide = await apiReq(`/api/swk-ops/admin-decisions/${admId}/owner-decide`, 'POST', {
    decision: 'approve',
    notes: 'Approved by Shabib Siraj for Q4 off-plan push.',
  }, ownerToken)
  check('Owner Shabib Siraj approves Manager administrative decision',
    admOwnerDecide.statusCode === 200 && admOwnerDecide.json().status === 'Approved'
  )

  // 10. Verify Bayut & Dubizzle Portal Syndication + 3rd-Party A2A Partner Matcher
  const portalSyncRes = await apiReq('/api/swk-ops/portals/sync', 'POST', {
    portal: 'ALL',
    department_division: 'Leasing',
  }, ownerToken)
  check('Bayut & Dubizzle portal feed & lead sync succeeds',
    portalSyncRes.statusCode === 200 && portalSyncRes.json().ok === true && portalSyncRes.json().synced.length === 2
  )

  const a2aMatchRes = await apiReq('/api/swk-ops/a2a-match?department_division=Secondary%20Projects', 'GET', undefined, ownerToken)
  check('3rd-Party A2A Partner Matcher returns partner inventory & registered A2A brokers',
    a2aMatchRes.statusCode === 200 && Array.isArray(a2aMatchRes.json().a2a_brokers)
  )

  // 11. Verify Market Pulse (24 Dubai Areas, Daily DLD Sync, Real Estate News & Site-Visit Area Companion)
  const dldSyncRes = await apiReq('/api/swk-ops/dld-sync', 'POST', {}, ownerToken)
  check('Daily DLD Transactions feed syncs into Market Pulse',
    dldSyncRes.statusCode === 200 && dldSyncRes.json().ok === true && dldSyncRes.json().inserted_count >= 0
  )

  const pulseRes = await apiReq('/api/swk-ops/market-pulse', 'GET', undefined, ownerToken)
  const pulse = pulseRes.json()
  check('Market Pulse returns 24 Dubai areas, daily DLD transactions, real estate news, and UAE mortgage bank rates',
    pulseRes.statusCode === 200 &&
    pulse.communities.length >= 24 &&
    pulse.dld_transactions.length > 0 &&
    pulse.news.length > 0 &&
    pulse.mortgage_rates.length > 0
  )

  const companionRes = await apiReq('/api/swk-ops/area-companion/MARINA', 'GET', undefined, ownerToken)
  const companion = companionRes.json()
  check('Site-Visit Area Companion returns stock-style ticker, 15-year outlook (2026–2041), nearby landmarks, and closing pitch keywords',
    companionRes.statusCode === 200 &&
    companion.stock_card?.ticker === 'DLD:MARINA' &&
    String(companion.companion?.future_15yr_outlook).length > 20 &&
    Array.isArray(companion.companion?.closing_keywords) &&
    companion.companion.closing_keywords.length > 0 &&
    Array.isArray(companion.companion?.pitch_phrases) &&
    companion.companion.pitch_phrases.length > 0
  )

  console.log(`\nAll ${checks} SWK Properties OS Overhaul checks passed!`)
} finally {
  await resetBusinessData({ user: null, system: true }, { backup: false })
  seedReference()
  q.run(
    `UPDATE users SET active = 1, password_hash = ?, must_change_password = 1, totp_secret = NULL, failed_logins = 0, locked_until = NULL WHERE email = ?`,
    hashPassword(config.accounts.adminPassword),
    config.accounts.adminEmail
  )
  await app.close()
  db.close()
}
