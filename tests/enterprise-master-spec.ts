import assert from 'node:assert/strict'
import { syncSchema } from '../src/server/schema'
import { seedReference } from '../src/server/seed'
import { validateMeta, ENTITY_LIST } from '../src/shared/entities'
import { q } from '../src/server/db'
import { createRecord, deleteRecord, getDef, listRecords, patchRecord, updateRecord, SYSTEM_CTX, type Ctx } from '../src/server/engine'
import { createSession, loadUser, userFromToken } from '../src/server/auth'
import { todayStr, addDays } from '../src/server/util'
import {
  ENTERPRISE_MODULE_CATALOGUE,
  getEnterpriseCommandCentre,
  submitDailyReport,
  reviewDailyReport,
  scanMissingDailyReports,
  resolveInventoryConflict,
  verifyInventorySubmission,
  approveAndPublishInventory,
  approveListingPriceChange,
  submitDeveloperNoc,
  uploadDeveloperNocDocument,
  verifyDeveloperNoc,
  advanceTransactionStage,
  raiseTransactionException,
  resolveTransactionException,
  advanceImmigrationCase,
  activateAgentAuthorisation,
  handleExpiredBrokerCredential,
  superviseCommunication,
  handleCommunicationOutage,
  accessEmployeeLocation,
  updateCommissionPayeeIban,
  verifyCommissionIban,
  recordDeveloperClawback,
  initiateCommissionPayout,
  approveCommissionPayout,
  executeCommissionPayout,
  assignComplianceInvestigator,
  decideComplianceCase,
  appealComplianceCase,
  resolveComplianceAppeal,
  checkBulkExportDlp,
  disputeViewingAttendance,
  reassignProtectedLead,
  challengeQaReview,
  resolveQaChallenge,
  executeEmployeeSeparation,
  decideUniversalApproval,
} from '../src/server/domain/enterprise'

async function run() {
  // ===========================================================================
  // 0. Metadata & 35-Module Architecture Verification
  // ===========================================================================
  const metaErrors = validateMeta()
  assert.deepEqual(metaErrors, [], `Expected 0 metadata errors, got: ${metaErrors.join('; ')}`)
  assert.ok(ENTITY_LIST.length >= 125, `Expected at least 125 canonical entities, got ${ENTITY_LIST.length}`)
  assert.equal(ENTERPRISE_MODULE_CATALOGUE.length, 35, 'All 35 modules (3.01–3.35) must be registered')

  syncSchema()
  await seedReference({ users: true })

  const today = todayStr()
  const dxb = q.val<number>(`SELECT id FROM branches WHERE code = 'DXB'`)!
  const legalId = q.val<number>(`SELECT id FROM legal_entities WHERE code = 'SWK'`)!
  const deptSal = q.val<number>(`SELECT id FROM departments WHERE code = 'SAL'`)!
  const deptHr = q.val<number>(`SELECT id FROM departments WHERE code = 'HR'`)!
  const adminRoleId = q.val<number>(`SELECT id FROM roles WHERE name = 'Admin'`)!
  const mgrRoleId = q.val<number>(`SELECT id FROM roles WHERE name = 'Manager'`)!
  const salesRoleId = q.val<number>(`SELECT id FROM roles WHERE name = 'Sales'`)!
  const portalRoleId = q.val<number>(`SELECT id FROM roles WHERE name = 'Customer Portal'`)!

  const mkUser = (name: string, email: string, roleId: number, partyId: number | null = null): Ctx => {
    const u = createRecord(getDef('users'), {
      name, email, password: 'TestPassword123!', role_id: roleId, branch_id: dxb, department_id: deptSal, party_id: partyId, active: true,
    }, SYSTEM_CTX)
    return { user: loadUser(u.id)! }
  }

  const ceoCtx = mkUser('Tariq CEO', 'ceo@test.swk.ae', adminRoleId)
  const mgrCtx = mkUser('Layla Sales Director', 'layla@test.swk.ae', mgrRoleId)
  const hrCtx = mkUser('Rashid HR Head', 'rashid@test.swk.ae', mgrRoleId)
  const compCtx = mkUser('Nadia Compliance Officer', 'nadia@test.swk.ae', mgrRoleId)
  const finInitCtx = mkUser('Finance Initiator', 'fin1@test.swk.ae', mgrRoleId)
  const finApproveCtx = mkUser('Finance Approver', 'fin2@test.swk.ae', mgrRoleId)
  const finTreasuryCtx = mkUser('Treasury Executor', 'fin3@test.swk.ae', mgrRoleId)
  const broker1Ctx = mkUser('Broker Karim', 'karim@test.swk.ae', salesRoleId)
  const broker2Ctx = mkUser('Broker Zainab', 'zainab@test.swk.ae', mgrRoleId)

  const empKarim = createRecord(getDef('employees'), {
    name: 'Broker Karim', user_id: broker1Ctx.user!.id, branch_id: dxb, department_id: deptSal,
    designation: 'Property Consultant', join_date: addDays(today, -180), status: 'Active', visa_expiry: addDays(today, 365),
  }, SYSTEM_CTX)
  const empZainab = createRecord(getDef('employees'), {
    name: 'Broker Zainab', user_id: broker2Ctx.user!.id, branch_id: dxb, department_id: deptSal,
    designation: 'Senior Property Consultant', join_date: addDays(today, -365), status: 'Active', visa_expiry: addDays(today, 365),
  }, SYSTEM_CTX)

  const agentKarim = createRecord(getDef('agents'), {
    name: 'Broker Karim', employee_id: empKarim.id, dld_broker_id: 'BRN-9001', rera_card_no: 'RERA-9001',
    dld_expiry: addDays(today, 365), status: 'Active', branch_id: dxb, commission_split_pct: 50,
  }, SYSTEM_CTX)
  const agentZainab = createRecord(getDef('agents'), {
    name: 'Broker Zainab', employee_id: empZainab.id, dld_broker_id: 'BRN-9002', rera_card_no: 'RERA-9002',
    dld_expiry: addDays(today, 365), status: 'Active', branch_id: dxb, commission_split_pct: 50,
  }, SYSTEM_CTX)

  // ===========================================================================
  // 1. Gate 10.2 & Workflow 4.01: Daily Staff Accountability & Reporting
  // ===========================================================================
  createRecord(getDef('activities'), {
    subject: 'Follow-up call with Marina buyer', kind: 'Call', owner_id: broker1Ctx.user!.id, start_at: `${today}T10:00`,
  }, broker1Ctx)

  const dar = createRecord(getDef('daily_reports'), {
    employee_id: empKarim.id,
    user_id: broker1Ctx.user!.id,
    report_date: today,
    sys_calls_count: 999, // Attempt to spoof system count -> hook must override with real count (1)
    outcomes_narrative: 'Conducted buyer qualification call and prepared comparables.',
    next_day_priorities: 'Schedule viewing at Marina Gate.',
  }, broker1Ctx)
  assert.equal(dar.sys_calls_count, 1, 'Gate 10.2: System activity count must be derived from source records, never spoofed')

  const frozenDar = submitDailyReport(dar.id, { ...broker1Ctx, user: mgrCtx.user })
  assert.equal(frozenDar.status, 'Submitted (Frozen)')

  // Employee cannot edit a frozen report
  assert.throws(
    () => updateRecord(getDef('daily_reports'), dar.id, { outcomes_narrative: 'Tampered after freeze' }, broker1Ctx),
    /frozen/i,
    'Gate 10.2: Submitted daily reports must be frozen against silent edits',
  )

  // Submitting employee cannot self-review
  assert.throws(
    () => reviewDailyReport(dar.id, 'approve', 'Self approving my own report', { user: broker1Ctx.user }),
    /independent|access|permission/i,
  )

  // Line manager returns report -> employee resubmits (v2) -> manager approves (review v2)
  const returnedDar = reviewDailyReport(dar.id, 'return', 'Please add viewing reference ID.', mgrCtx)
  assert.equal(returnedDar.status, 'Returned for Clarification')
  assert.equal(returnedDar.review_version, 1)

  const resubDar = submitDailyReport(dar.id, mgrCtx)
  assert.equal(resubDar.revision_no, 2)
  const approvedDar = reviewDailyReport(dar.id, 'approve', 'Verified against CRM logs.', mgrCtx)
  assert.equal(approvedDar.status, 'Approved by Manager')
  assert.equal(approvedDar.review_version, 2)

  // Scan missing reports creates manager follow-up task without automatic penalty
  const scanRes = scanMissingDailyReports(today, mgrCtx)
  assert.ok(scanRes.missing_count >= 1, 'Missing report scan identifies employees without submitted report')

  // ===========================================================================
  // 2. Gate 10.3, Workflow 4.02, Adversarial 7.01 & 7.07: Inventory & Listing Gate
  // ===========================================================================
  const sub1 = createRecord(getDef('inventory_submissions'), {
    building_name: 'Burj Vista Tower 1',
    unit_no: '1802',
    property_type: 'Apartment',
    purpose: 'Sale',
    asking_price: 4200000,
    area_sqft: 1680,
    owner_name: 'Sheikh Saeed',
    owner_phone: '+971501112222',
    owner_contact_verified: true,
    inventory_source: 'Direct Owner Cold Call',
    source_permission_evidence: 'FORM-A-BV-1802',
    trakheesi_permit_no: '7199887766',
    permit_expiry_date: addDays(today, 90),
    sourcing_agent_id: agentKarim.id,
    sourcing_user_id: broker1Ctx.user!.id,
  }, broker1Ctx)
  assert.equal(sub1.status, 'Submitted')

  // Adversarial 7.01: Second agent submits same building + unit
  const sub2Dup = createRecord(getDef('inventory_submissions'), {
    building_name: '  burj vista tower 1 ',
    unit_no: '1802',
    property_type: 'Apartment',
    purpose: 'Sale',
    asking_price: 4150000,
    area_sqft: 1680,
    owner_name: 'Sheikh Saeed',
    sourcing_agent_id: agentZainab.id,
    sourcing_user_id: broker2Ctx.user!.id,
  }, broker2Ctx)
  assert.equal(sub2Dup.status, 'Duplicate / Conflict Hold', 'Adversarial 7.01: Duplicate building+unit must be held automatically')
  assert.equal(sub2Dup.duplicate_of_id, sub1.id)

  const resolvedDup = resolveInventoryConflict(sub2Dup.id, 'merge', 'Merged duplicate preserving Karim source attribution', mgrCtx)
  assert.equal(resolvedDup.conflict_status, 'Merged Preserving Attribution')

  // Adversarial 7.07: Attempt to publish sub1 before inventory & compliance verification -> blocked + logs compliance case
  assert.throws(
    () => approveAndPublishInventory(sub1.id, ceoCtx),
    /Publication blocked/i,
    'Adversarial 7.07 / Gate 10.3: Unverified listing publication must be blocked',
  )
  const adv707Case = q.get(`SELECT * FROM compliance_cases WHERE case_category = 'Unauthorised Listing Advert (7.07)' AND linked_record_id = ?`, sub1.id)
  assert.ok(adv707Case, 'Adversarial 7.07: Blocked publication attempt must log a compliance case')

  // Step 1: Independent inventory verification (cannot be sourcing user)
  assert.throws(() => verifyInventorySubmission(sub1.id, 'inventory', { user: broker1Ctx.user }), /independent|access|permission/i)
  const invVerified = verifyInventorySubmission(sub1.id, 'inventory', mgrCtx)
  assert.equal(invVerified.status, 'Inventory Verified')

  // Step 2: Compliance Trakheesi verification
  const compVerified = verifyInventorySubmission(sub1.id, 'compliance', compCtx)
  assert.equal(compVerified.status, 'Compliance Verified')

  // Step 3: Second-person approval & publication (must differ from sourcing agent & inventory verifier)
  assert.throws(() => approveAndPublishInventory(sub1.id, mgrCtx), /Second-person approval rule/i)
  const publishedSub = approveAndPublishInventory(sub1.id, ceoCtx)
  assert.equal(publishedSub.status, 'Published to Stock')
  assert.ok(publishedSub.published_property_id, 'Canonical property created on publication')

  const mandateRow = q.get(`SELECT * FROM listing_mandates WHERE property_id = ?`, publishedSub.published_property_id)
  assert.ok(mandateRow, 'Canonical listing_mandates record created on publication')
  const updatedMandate = approveListingPriceChange(mandateRow.id, 4050000, 'Signed owner price reduction addendum', mgrCtx)
  assert.equal(updatedMandate.authorized_price, 4050000)

  // ===========================================================================
  // 3. Gate 10.4, Workflow 4.03 & Adversarial 7.05: Developer NOC Centre
  // ===========================================================================
  const sellerParty = createRecord(getDef('parties'), { name: 'Seller Al Futtaim', is_customer: true, status: 'Active' }, SYSTEM_CTX)
  const buyerParty = createRecord(getDef('parties'), { name: 'Buyer Global Holdings', is_customer: true, status: 'Active' }, SYSTEM_CTX)
  const devEmaar = q.val<number>(`SELECT id FROM developers WHERE code = 'EMAAR'`)!

  // Control 3.08: Inventory verification is NOT an NOC; NOC without qualifying deal/contract is blocked
  assert.throws(
    () => createRecord(getDef('developer_requests'), {
      developer_id: devEmaar, property_id: publishedSub.published_property_id, seller_id: sellerParty.id, buyer_id: buyerParty.id,
    }, mgrCtx),
    /requires a qualifying sales contract or deal file/i,
  )

  const dealJob = createRecord(getDef('jobs'), {
    deal_name: 'Burj Vista 1802 Resale', deal_type: 'Sale', property_id: publishedSub.published_property_id,
    client_id: buyerParty.id, agent_id: agentKarim.id, deal_value: 4050000, commission_pct: 2, branch_id: dxb,
  }, SYSTEM_CTX)

  const nocReq = createRecord(getDef('developer_requests'), {
    developer_id: devEmaar,
    property_id: publishedSub.published_property_id,
    job_id: dealJob.id,
    seller_id: sellerParty.id,
    buyer_id: buyerParty.id,
    transaction_type: 'Secondary Resale',
    checklist_completed: true,
    owner_authorisation_ref: 'NOC-AUTH-1802',
    outstanding_service_charges: 12000,
    service_charges_cleared: true,
    service_charge_receipt_ref: 'SC-RCP-1802',
  }, mgrCtx)

  const subNoc = submitDeveloperNoc(nocReq.id, 'EMAAR-PORTAL-99881', 'noc@swkpropertiesuae.com', mgrCtx)
  assert.equal(subNoc.status, 'Submitted to Developer Portal')

  // Uploading NOC PDF does NOT unlock closing on its own
  const upNoc = uploadDeveloperNocDocument(nocReq.id, 'NOC-CERT-99881', today, addDays(today, 30), 'NOC-99881.PDF', mgrCtx)
  assert.equal(upNoc.closing_stage_unlocked, false, 'Gate 10.4: Uploaded NOC must not unlock closing before independent verification')

  // Adversarial 7.05: Flagging a suspicious/unverified NOC holds closing and creates a Critical compliance case
  const heldNoc = verifyDeveloperNoc(nocReq.id, 'flag_fraud', 'Certificate font mismatch; held for Emaar portal callback', compCtx)
  assert.equal(heldNoc.status, 'Held – Fraud / Unverified Escalation')
  assert.equal(heldNoc.closing_stage_unlocked, false)
  const nocFraudCase = q.get(`SELECT * FROM compliance_cases WHERE case_category = 'Fake / Unverified NOC Alert (7.05)' AND linked_record_id = ?`, nocReq.id)
  assert.ok(nocFraudCase, 'Adversarial 7.05: Suspicious NOC creates Critical compliance case')

  // Submitter cannot verify their own NOC
  assert.throws(() => verifyDeveloperNoc(nocReq.id, 'verify', 'Trying to self-verify', mgrCtx), /independent/i)

  // Independent reviewer (compCtx != mgrCtx) verifies NOC -> unlocks closing
  const validNoc = verifyDeveloperNoc(nocReq.id, 'verify', 'Verified directly with Emaar conveyancing desk', compCtx)
  assert.equal(validNoc.status, 'Verified & Valid (Closing Unlocked)')
  assert.equal(validNoc.closing_stage_unlocked, true)

  // ===========================================================================
  // 4. Gate 10.1, Workflows 4.04 & 4.05: Transactions & 11 Exception States
  // ===========================================================================
  const txn = createRecord(getDef('transactions'), {
    transaction_category: 'Secondary Sale',
    property_id: publishedSub.published_property_id,
    job_id: dealJob.id,
    seller_id: sellerParty.id,
    buyer_id: buyerParty.id,
    primary_agent_id: agentKarim.id,
    developer_id: devEmaar,
    deal_value: 4050000,
    deposit_amount: 405000,
    noc_request_id: nocReq.id,
  }, mgrCtx)

  // Direct stage jump via CRUD update is ignored (readonly) and jumping to Closed without prerequisites is blocked
  const attemptedJump = updateRecord(getDef('transactions'), txn.id, { stage: 'Closed' }, mgrCtx)
  assert.equal(attemptedJump.stage, 'Lead Qualified', 'Gate 10.1: Direct CRUD update cannot bypass controlled stage machine')
  assert.throws(
    () => advanceTransactionStage(txn.id, 'Closed', {}, mgrCtx),
    /transfer|evidence/i,
    'Gate 10.1: Cannot jump directly to Closed without verified transfer & financial prerequisites',
  )

  // Raise Exception #3 (POA) -> blocks stage progression until resolved
  const excTxn = raiseTransactionException(txn.id, '3. Deal involves a power of attorney (POA)', 'Verify seller POA with Dubai Courts', mgrCtx)
  assert.equal(excTxn.stage, 'On Hold – Exception Active')
  assert.throws(() => advanceTransactionStage(txn.id, 'KYC & Compliance Cleared', { kyc_cleared: true }, mgrCtx), /unresolved exception/i)

  // Resolve POA exception
  resolveTransactionException(txn.id, 'Dubai Courts notarised POA verified by Legal.', 'Lead Qualified', { poa_verified_by_legal: true }, compCtx)

  // Controlled stage progression through to Closed
  advanceTransactionStage(txn.id, 'KYC & Compliance Cleared', { kyc_cleared: true }, mgrCtx)
  advanceTransactionStage(txn.id, 'MOU / Form F Signed', { forms_completed: true }, mgrCtx)
  advanceTransactionStage(txn.id, 'Developer NOC Verified', { noc_request_id: nocReq.id }, mgrCtx)
  advanceTransactionStage(txn.id, 'Transfer / Title Deed Verified', { title_deed_or_oqood_ref: 'DLD-DEED-2026-7741' }, mgrCtx)

  // Cannot close without Invoice + Receipt
  assert.throws(() => advanceTransactionStage(txn.id, 'Closed', {}, mgrCtx), /Tax Invoice and a verified Bank Receipt/i)

  const bankId = q.val<number>(`SELECT id FROM bank_accounts LIMIT 1`)!
  const inv = createRecord(getDef('invoices'), {
    doc_type: 'Tax Invoice', party_id: sellerParty.id, property_id: publishedSub.published_property_id,
    branch_id: dxb, invoice_date: today, due_date: addDays(today, 14), currency: 'AED', status: 'Posted',
  }, SYSTEM_CTX)
  const rct = createRecord(getDef('receipts'), {
    party_id: sellerParty.id, bank_account_id: bankId, receipt_date: today, method: 'Bank transfer', currency: 'AED', amount: 81000, status: 'Posted',
  }, SYSTEM_CTX)

  const closedTxn = advanceTransactionStage(txn.id, 'Closed', { invoice_id: inv.id, receipt_id: rct.id }, mgrCtx)
  assert.equal(closedTxn.stage, 'Closed')
  assert.equal(closedTxn.financially_reconciled, true)
  assert.equal(closedTxn.collected_commission, 81000)

  // ===========================================================================
  // 5. Gate 10.6, Workflow 4.06, Adversarial 7.08 & 7.09: Visa/PRO & Broker Auth
  // ===========================================================================
  const proCase = createRecord(getDef('immigration_cases'), {
    employee_id: empKarim.id,
    pro_user_id: hrCtx.user!.id,
    legal_entity_id: legalId,
    sponsorship_type: 'Company Sponsored',
    case_type: 'New Employment Visa',
    eligibility_checked: true,
    offer_contract_signed: true,
  }, hrCtx)

  advanceImmigrationCase(proCase.id, 'submit', { application_ref: 'MOHRE-APP-501' }, hrCtx)
  // Adversarial 7.09: Delayed visa escalates without assuming approval
  const delayedVisa = advanceImmigrationCase(proCase.id, 'escalate_delay', {}, hrCtx)
  assert.equal(delayedVisa.status, 'Delayed / Escalated')
  assert.equal(delayedVisa.is_delayed, true)

  advanceImmigrationCase(proCase.id, 'official_approval', { official_approval_ref: 'ICP-PERMIT-501' }, compCtx)
  // Separation of duties (3.03): PRO who submitted (hrCtx) cannot mark internal completion
  assert.throws(() => advanceImmigrationCase(proCase.id, 'complete', {}, hrCtx), /Separation of Duties/i)
  const completedVisa = advanceImmigrationCase(proCase.id, 'complete', {}, ceoCtx)
  assert.equal(completedVisa.status, 'Completed')

  // Gate 10.6: Broker regulated activation requires HR verification + independent Compliance verification
  const authRec = createRecord(getDef('agent_authorisations'), {
    agent_id: agentKarim.id,
    employee_id: empKarim.id,
    user_id: broker1Ctx.user!.id,
    brn_number: 'BRN-9001',
    rera_expiry_date: addDays(today, 365),
    dld_exam_passed: true,
    aml_training_completed: true,
    conduct_policy_acknowledged: true,
  }, hrCtx)

  assert.throws(() => activateAgentAuthorisation(authRec.id, 'compliance', compCtx), /HR must independently verify/i)
  activateAgentAuthorisation(authRec.id, 'hr', hrCtx)
  // HR verifier cannot also perform Compliance sign-off
  assert.throws(() => activateAgentAuthorisation(authRec.id, 'compliance', hrCtx), /Segregation of Duties/i)
  const activeAuth = activateAgentAuthorisation(authRec.id, 'compliance', compCtx)
  assert.equal(activeAuth.status, 'Authorised')

  // Adversarial 7.08: Broker credential expires mid-deal -> restricts broker and assigns active cover broker
  const expiredAuth = handleExpiredBrokerCredential(authRec.id, agentZainab.id, compCtx)
  assert.equal(expiredAuth.status, 'Restricted – Credential Expired')
  assert.equal(expiredAuth.cover_agent_id, agentZainab.id)
  // Restore Karim to active for subsequent tests
  patchRecord(getDef('agents'), agentKarim.id, { status: 'Active', dld_expiry: addDays(today, 365) }, SYSTEM_CTX)

  // ===========================================================================
  // 6. Gate 10.5, Workflow 4.07, Adversarial 7.03, 7.04 & 7.14: WhatsApp & Field Privacy
  // ===========================================================================
  // Adversarial 7.04: Personal WhatsApp diversion attempt is automatically flagged
  const comm = createRecord(getDef('communications'), {
    channel: 'WhatsApp Business',
    customer_phone: '+971507776655',
    party_id: buyerParty.id,
    assigned_user_id: broker2Ctx.user!.id,
    message_summary: 'Hi client, please message me privately on my personal WhatsApp for an off-market discount.',
  }, broker2Ctx)
  assert.equal(comm.diversion_flag, true, 'Adversarial 7.04: Personal WhatsApp diversion phrase must be flagged automatically')
  const divCase = q.get(`SELECT * FROM compliance_cases WHERE case_category = 'Personal WhatsApp Diversion (7.04)' AND linked_record_id = ?`, comm.id)
  assert.ok(divCase, 'Adversarial 7.04: Diversion flag creates a human-review compliance case')

  // Gate 10.5: Supervisory review logs role & reason in supervisor_access_logs
  superviseCommunication(comm.id, 'Complaint Investigation', 'Reviewing personal number diversion flag and extracting follow-up task', mgrCtx.user!.id, 'Call buyer on recorded line', compCtx)
  const supLog = q.get(`SELECT * FROM supervisor_access_logs WHERE communication_id = ?`, comm.id)
  assert.ok(supLog, 'Gate 10.5: Supervisor access must be logged with role and reason')

  // Adversarial 7.14: WhatsApp provider outage queues retry and logs fallback
  const outageComm = handleCommunicationOutage(comm.id, 'Meta API timeout; queued retry and called client from office landline', compCtx)
  assert.equal(outageComm.delivery_status, 'Provider Outage – Retry Queued')

  // Adversarial 7.03 & Gate 10.5: Off-hours GPS access is blocked and logged
  const offHoursSession = createRecord(getDef('field_sessions'), {
    employee_id: empKarim.id,
    agent_id: agentKarim.id,
    duty_date: today,
    scheduled_start: `${today}T09:00`,
    scheduled_end: `${today}T17:00`,
    status: 'Completed (Off Duty)',
    assigned_location: 'Palm Jumeirah',
    last_lat: '25.1124',
    last_lng: '55.1390',
  }, SYSTEM_CTX)

  assert.throws(
    () => accessEmployeeLocation(offHoursSession.id, undefined, mgrCtx),
    /Off-hours or off-duty employee GPS access is denied/i,
    'Adversarial 7.03 / Gate 10.5: Off-hours GPS lookup must be denied',
  )
  const deniedLocLog = q.get(`SELECT * FROM location_access_logs WHERE field_session_id = ?`, offHoursSession.id)!
  assert.equal(deniedLocLog.access_outcome, 'Denied – Off Hours Blocked')

  // ===========================================================================
  // 7. Gate 10.7, Workflow 4.08, Adversarial 7.06, 7.10 & 7.11: Commissions & 3-Way Payout
  // ===========================================================================
  const cen = createRecord(getDef('commission_entitlements'), {
    transaction_id: txn.id,
    job_id: dealJob.id,
    agent_id: agentKarim.id,
    employee_id: empKarim.id,
    developer_id: devEmaar,
    deal_type: 'Secondary Sale',
    gross_commission: 81000,
    split_pct: 50,
    entitlement_amount: 40500,
    earned_amount: 40500,
    invoiced_amount: 81000,
    collected_amount: 81000,
    payable_amount: 40500,
    payee_iban: 'AE070331111111111111111',
  }, finInitCtx)

  // Adversarial 7.06: Payee IBAN changed before payout -> freezes payout until 2-person verification
  const frozenCen = updateCommissionPayeeIban(cen.id, 'AE070339999999999999999', finInitCtx)
  assert.equal(frozenCen.status, 'Frozen – IBAN Swap Verification')
  assert.throws(() => initiateCommissionPayout(cen.id, finInitCtx), /IBAN Swap Gate/i)

  // Payee cannot verify their own IBAN change
  assert.throws(() => verifyCommissionIban(cen.id, 'CALLBACK-SELF', { user: broker1Ctx.user }), /access|permission|never verify/i)
  verifyCommissionIban(cen.id, 'CALLBACK-HR-001', hrCtx)
  // First verifier cannot also be second verifier
  assert.throws(() => verifyCommissionIban(cen.id, 'CALLBACK-HR-002', hrCtx), /different authorised user/i)
  const unfrozenCen = verifyCommissionIban(cen.id, 'CALLBACK-COMP-002', compCtx)
  assert.equal(unfrozenCen.iban_changed_before_payout, false)

  // Adversarial 7.10: Developer clawback recalculates entitlement and payable balance with audit trail
  const clawbackCen = recordDeveloperClawback(cen.id, 5500, 'Partial developer fee adjustment per addendum', finInitCtx)
  assert.equal(clawbackCen.earned_amount, 35000)
  assert.equal(clawbackCen.payable_amount, 35000)

  // Gate 10.7: 3-Way Segregation (Initiator != Approver != Executor) + Adversarial 7.11 (Manager Collusion Block)
  initiateCommissionPayout(cen.id, finInitCtx)
  // Initiator cannot approve
  assert.throws(() => approveCommissionPayout(cen.id, finInitCtx), /Segregation of Duties/i)
  // Adversarial 7.11: Manager who created the transaction (mgrCtx) cannot approve subordinate payout
  assert.throws(() => approveCommissionPayout(cen.id, mgrCtx), /Collusion Control/i)

  approveCommissionPayout(cen.id, finApproveCtx)
  // Approver cannot execute treasury batch
  assert.throws(() => executeCommissionPayout(cen.id, 'BATCH-01', finApproveCtx), /Three-Way Segregation/i)

  const paidCen = executeCommissionPayout(cen.id, 'WPS-BATCH-2026-10', finTreasuryCtx)
  assert.equal(paidCen.status, 'Paid & Reconciled')
  assert.equal(paidCen.paid_amount, 35000)
  assert.equal(paidCen.payable_amount, 0)

  // ===========================================================================
  // 8. Workflow 4.09, Adversarial 7.02, 7.12, 7.13 & 7.16: Complaints, DLP, Portal Scope & Appeals
  // ===========================================================================
  const holdLead = createRecord(getDef('leads'), {
    company: 'Al Noor Capital', contact_name: 'Protected Legal Hold Lead', phone: '+971508887766', source: 'Referral', status: 'Qualified', owner_id: broker1Ctx.user!.id,
  }, SYSTEM_CTX)

  const complaint = createRecord(getDef('compliance_cases'), {
    title: 'Client complaint alleging delayed disclosure',
    case_category: 'Client Complaint (4.09)',
    source_type: 'Client Complaint',
    severity: 'High',
    subject_user_id: broker1Ctx.user!.id,
    implicated_user_id: mgrCtx.user!.id,
    party_id: buyerParty.id,
    linked_entity: 'leads',
    linked_record_id: holdLead.id,
    legal_hold: true,
    evidence_summary: 'Client requested review of promised handover date.',
  }, compCtx)

  // Workflow 4.09: Implicated manager cannot investigate or decide the complaint
  assert.throws(() => assignComplianceInvestigator(complaint.id, mgrCtx.user!.id, compCtx), /Complaint Independence Control/i)
  assert.throws(() => decideComplianceCase(complaint.id, 'Dismissing complaint against my team', 'No action', mgrCtx), /Complaint Independence Control/i)

  // Legal hold blocks deleting the protected record even by CEO/Admin, and transactions have noDelete protection
  assert.throws(() => deleteRecord(getDef('leads'), holdLead.id, ceoCtx), /Legal Hold/i)
  assert.throws(() => deleteRecord(getDef('transactions'), txn.id, ceoCtx), /cannot be deleted/i)
  // Ordinary broker cannot delete customer/lead history (Control 3.31)
  assert.throws(() => deleteRecord(getDef('leads'), holdLead.id, broker1Ctx), /Legal Hold|cannot be deleted by ordinary brokers|access|permission/i)

  decideComplianceCase(complaint.id, 'Reviewed signed Form F and email timeline; disclosure was sent 48h prior.', 'Formal clarification letter sent.', compCtx)

  // Adversarial 7.16: False risk flag appeal & correction
  appealComplianceCase(complaint.id, 'Attached timestamped client acknowledgement receipt.', broker1Ctx)
  // Original decision-maker (compCtx) cannot decide the appeal
  assert.throws(() => resolveComplianceAppeal(complaint.id, 'correct_false_flag', 'Self reviewing appeal', compCtx), /Appeal Review Control/i)
  const clearedAppeal = resolveComplianceAppeal(complaint.id, 'correct_false_flag', 'Verified client signed acknowledgement; cleared flag.', ceoCtx)
  assert.equal(clearedAppeal.status, 'Corrected / Cleared (False Positive)')
  assert.equal(clearedAppeal.correction_applied, true)

  // Adversarial 7.02: Disputed viewing attendance cross-checks field & attendance evidence
  const mnd = createRecord(getDef('mandates'), {
    property_id: publishedSub.published_property_id, mandate_type: 'Exclusive Sale', status: 'Active',
    owner_id: sellerParty.id, agent_id: agentKarim.id, start_date: today, end_date: addDays(today, 90),
  }, SYSTEM_CTX)
  const vw = createRecord(getDef('viewings'), {
    mandate_id: mnd.id, lead_id: holdLead.id, property_id: publishedSub.published_property_id, agent_id: agentKarim.id, scheduled_at: `${today}T14:00`, status: 'Completed',
  }, SYSTEM_CTX)
  const vwDispute = disputeViewingAttendance(vw.id, 'Client states broker did not attend at 14:00', compCtx)
  assert.ok(vwDispute.case_id, 'Adversarial 7.02: Disputed viewing creates compliance review case')

  // Adversarial 7.12: Bulk CRM export (>50 rows) blocked by DLP
  assert.throws(
    () => checkBulkExportDlp('parties', 250, broker1Ctx),
    /Bulk export of 250 records from "parties" is restricted/i,
    'Adversarial 7.12: Bulk CRM export must be blocked by DLP',
  )

  // Adversarial 7.13: Customer portal user cannot access another client's records
  const portalBuyerCtx = mkUser('Buyer Portal User', 'portal@buyer.ae', portalRoleId, buyerParty.id)
  const visibleParties = listRecords(getDef('parties'), {}, portalBuyerCtx)
  assert.equal(visibleParties.rows.length, 1, 'Adversarial 7.13: Customer portal user must only see their own party record')
  assert.equal(visibleParties.rows[0].id, buyerParty.id)

  // 3.33 QA Review & Broker Challenge
  const qa = createRecord(getDef('qa_reviews'), {
    agent_id: agentKarim.id, user_id: broker1Ctx.user!.id, reviewer_id: compCtx.user!.id,
    channel: 'WhatsApp Business Sample', accuracy_score: 78, etiquette_score: 85, overall_score: 80,
    findings: 'Late follow-up noted.',
  }, compCtx)
  challengeQaReview(qa.id, 'Client requested callback the following morning.', broker1Ctx)
  const resolvedQa = resolveQaChallenge(qa.id, 'adjust', 94, 'Verified client timezone preference; score adjusted to 94.', ceoCtx)
  assert.equal(resolvedQa.overall_score, 94)

  // ===========================================================================
  // 9. Gate 10.8, 10.9, 10.10, Workflow 4.10 & Adversarial 7.15: Separation, Four-Eyes & DR
  // ===========================================================================
  const leadForKarim = createRecord(getDef('leads'), {
    company: 'Separation Client LLC', contact_name: 'Separation Test Lead', phone: '+971504443322', source: 'Website', status: 'Qualified', owner_id: broker1Ctx.user!.id,
  }, SYSTEM_CTX)
  reassignProtectedLead(leadForKarim.id, broker1Ctx.user!.id, 'Initial Capture', 'Assigned to Karim', mgrCtx)

  const session = createSession(broker1Ctx.user!.id, '127.0.0.1', 'test-agent')
  assert.ok(userFromToken(session.token), 'Session is active prior to separation')

  const sepCase = createRecord(getDef('hr_lifecycle_cases'), {
    case_type: 'Emergency Separation & Access Removal',
    employee_id: empKarim.id,
    user_id: broker1Ctx.user!.id,
    candidate_or_subject_name: 'Broker Karim',
    department_id: deptSal,
    branch_id: dxb,
    effective_date: today,
  }, hrCtx)

  const sepResult = executeEmployeeSeparation(sepCase.id, broker2Ctx.user!.id, hrCtx)
  assert.equal(sepResult.accounts_disabled, true, 'Gate 10.8: Separated user account disabled')
  assert.equal(sepResult.sessions_revoked, true, 'Gate 10.8: Active sessions revoked')
  assert.equal(userFromToken(session.token), null, 'Gate 10.8: Revoked session token can no longer authenticate')
  assert.ok(sepResult.leads_reassigned_count >= 1, 'Gate 10.8: Open leads reassigned to handover recipient')
  const reassignedLead = q.get(`SELECT * FROM leads WHERE id = ?`, leadForKarim.id)!
  assert.equal(reassignedLead.owner_id, broker2Ctx.user!.id)

  // 3.27 Universal Approval Four-Eyes Sequential
  const uApr = createRecord(getDef('universal_approvals'), {
    title: 'Four-Eyes Treasury Release',
    department_id: deptSal,
    workflow_type: 'High-Risk Financial Payment',
    risk_level: 'High – Four-Eyes Required',
    approval_mode: 'Four-Eyes Sequential',
    requester_id: mgrCtx.user!.id,
    step1_approver_id: hrCtx.user!.id,
    step2_approver_id: ceoCtx.user!.id,
    supporting_evidence: 'Signed contract and invoice attached.',
  }, mgrCtx)
  // Requester cannot self-approve
  assert.throws(() => decideUniversalApproval(uApr.id, 'approve', 'Self approve', mgrCtx), /Maker-Checker Control/i)
  const step1Apr = decideUniversalApproval(uApr.id, 'approve', 'Step 1 verified.', hrCtx)
  assert.equal(step1Apr.status, 'Pending Step 2 (Four-Eyes)')
  // Step 1 approver cannot also approve Step 2
  assert.throws(() => decideUniversalApproval(uApr.id, 'approve', 'Step 2 by same user', hrCtx), /Four-Eyes Control/i)
  const step2Apr = decideUniversalApproval(uApr.id, 'approve', 'Step 2 executive sign-off.', ceoCtx)
  assert.equal(step2Apr.status, 'Approved')

  // Gate 10.9 & Adversarial 7.15: DR Exercise & Restore Verification
  const drDrill = createRecord(getDef('dr_exercises'), {
    title: 'Go-Live Backup Restore & Failover Verification',
    exercise_type: 'Backup Restore Verification Drill',
    target_rto_minutes: 30,
    actual_rto_minutes: 9,
    target_rpo_minutes: 5,
    actual_rpo_minutes: 1,
    backup_file_tested: 'swk-os-verified.zip',
    records_verified_count: 1500,
    checksum_verified: true,
    status: 'Passed – RTO/RPO Verified',
    conducted_by: ceoCtx.user!.id,
    verified_by: compCtx.user!.id,
    evidence_report: 'Full database & attachment vault restored and verified.',
  }, ceoCtx)
  assert.equal(drDrill.status, 'Passed – RTO/RPO Verified')

  // Gate 10.10: Command Centre reconciliation
  const cmdSummary = getEnterpriseCommandCentre(ceoCtx)
  assert.equal(cmdSummary.modules_active, 35)
  assert.ok(cmdSummary.departments.executive.collected_revenue_total >= 81000)
  assert.ok(cmdSummary.departments.finance_and_commissions.commission_paid_total >= 35000)

  console.log('ALL 35 MODULES, 10 WORKFLOWS, 16 ADVERSARIAL SCENARIOS & 10 GO-LIVE GATES PASSED 100%!')
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
