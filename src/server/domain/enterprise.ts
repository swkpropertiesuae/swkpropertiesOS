import { createHash } from 'node:crypto'
import { q } from '../db'
import { assertCan, getRecord, getDef, createRecord, patchRecord, listRecords, audit, SYSTEM_CTX, type Ctx, type Rec } from '../engine'
import type { Hooks } from '../hooks'
import { addDays, bad, forbidden, fromCents, nowIso, safeJson, toCents, todayStr } from '../util'
import { loadUser } from '../auth'
import { notifyRole } from '../notify'

const digest = (v: string) => createHash('sha256').update(v).digest('hex')
const dateValid = (v: string) => !!v && v >= todayStr()

export function recordEnterpriseAudit(
  ctx: Ctx,
  moduleCode: string,
  workflowCode: string,
  eventType: string,
  entityKey: string,
  recordId: number,
  summary: string,
  payload: Record<string, any> = {},
) {
  createRecord(getDef('audit_events'), {
    occurred_at: nowIso(),
    module_code: moduleCode,
    workflow_code: workflowCode,
    event_type: eventType,
    entity_key: entityKey,
    record_id: recordId,
    actor_id: ctx.user?.id ?? null,
    summary: summary.slice(0, 500),
    evidence_payload: payload,
  }, { ...ctx, system: true })
}

// ============================================================================
// Existing Knowledge Base & Staff Competency Controls
// ============================================================================
export const knowledgeHooks: Hooks = {
  beforeSave({ rec, old, ctx }) {
    if (old && old.status === 'Published' && !ctx.system) throw bad('Published content is immutable; start a new revision')
    if (!old) { rec.status = 'Draft'; rec.revision = 1; rec.owner_id ??= ctx.user?.id }
    if (!rec.owner_id) throw bad('Assign an article owner')
  },
}

export function publishKnowledge(id: number, ctx: Ctx) {
  assertCan(ctx, 'projects', 'approve')
  const r = getRecord(getDef('knowledge_articles'), id, ctx)
  if (r.status !== 'Draft') throw bad('This revision is already published')
  if (r.created_by === ctx.user?.id || r.owner_id === ctx.user?.id || r.updated_by === ctx.user?.id) throw bad('A second authorised reviewer must publish this revision')
  if (r.content.trim().length < 100) throw bad('Published articles need at least 100 characters of reviewed content')
  const at = nowIso()
  createRecord(getDef('knowledge_versions'), {
    article_id: id, revision: r.revision, title: r.title, category: r.category, content: r.content,
    author_id: r.owner_id, published_by: ctx.user?.id, published_at: at, checksum: digest(r.content), revision_reason: r.revision_reason,
  }, { ...ctx, system: true })
  return patchRecord(getDef('knowledge_articles'), id, { status: 'Published', published_by: ctx.user?.id, published_at: at }, ctx)
}

export function reviseKnowledge(id: number, reason: string, ctx: Ctx) {
  assertCan(ctx, 'projects', 'edit')
  const r = getRecord(getDef('knowledge_articles'), id, ctx)
  if (r.status !== 'Published') throw bad('Finish the current draft before another revision')
  if (reason.trim().length < 10) throw bad('Explain the revision in at least 10 characters')
  return patchRecord(getDef('knowledge_articles'), id, { status: 'Draft', revision: r.revision + 1, revision_reason: reason, published_by: null, published_at: null }, ctx)
}

export function acknowledgeKnowledge(id: number, ctx: Ctx) {
  assertCan(ctx, 'projects', 'view')
  const r = getRecord(getDef('knowledge_articles'), id, ctx)
  if (r.status !== 'Published') throw bad('Only a published revision can be acknowledged')
  const v = q.get('SELECT id FROM knowledge_versions WHERE article_id=? AND revision=? AND deleted_at IS NULL', id, r.revision)!
  if (q.val('SELECT 1 FROM knowledge_acknowledgements WHERE version_id=? AND user_id=? AND deleted_at IS NULL', v.id, ctx.user?.id)) throw bad('You have already acknowledged this revision')
  return createRecord(getDef('knowledge_acknowledgements'), { version_id: v.id, user_id: ctx.user?.id, acknowledged_at: nowIso() }, { ...ctx, system: true })
}

export const qualificationHooks: Hooks = {
  beforeSave({ rec, old }) {
    if (old && old.status !== 'Pending') throw bad('Verified/revoked qualifications are immutable; record a new assessment')
    if (!old) rec.status = 'Pending'
    if (!loadUser(rec.user_id) || loadUser(rec.user_id)?.party_id) throw bad('Choose an active staff member')
    if (!Number.isInteger(rec.level) || rec.level < 1 || rec.level > 5) throw bad('Qualification level must be 1–5')
    if (rec.assessed_on > todayStr() || rec.expires_on < rec.assessed_on) throw bad('Check assessment and expiry dates')
    if (rec.evidence.trim().length < 10) throw bad('Record the certificate or assessment evidence')
  },
}

export const skillRuleHooks: Hooks = {
  beforeSave({ rec }) {
    if (!Number.isInteger(rec.minimum_level) || rec.minimum_level < 1 || rec.minimum_level > 5) throw bad('Minimum level must be 1–5')
  },
}

export function verifyQualification(id: number, ctx: Ctx) {
  assertCan(ctx, 'hr', 'approve')
  const r = getRecord(getDef('staff_qualifications'), id, ctx)
  if (r.status !== 'Pending') throw bad('Qualification has already been decided')
  if (r.user_id === ctx.user?.id || r.created_by === ctx.user?.id) throw bad('An independent assessor must verify the qualification')
  if (!dateValid(r.expires_on)) throw bad('Expired qualifications cannot be verified')
  q.run("UPDATE staff_qualifications SET status='Verified',verified_by=?,verified_at=?,updated_by=?,updated_at=?,version=version+1 WHERE id=?", ctx.user?.id, nowIso(), ctx.user?.id, nowIso(), id)
  audit(ctx, getDef('staff_qualifications'), id, 'verify', {}, r._title)
  return getRecord(getDef('staff_qualifications'), id, ctx)
}

export function revokeQualification(id: number, reason: string, ctx: Ctx) {
  assertCan(ctx, 'hr', 'approve')
  const r = getRecord(getDef('staff_qualifications'), id, ctx)
  if (r.status !== 'Verified') throw bad('Only a verified qualification can be revoked')
  if (r.user_id === ctx.user?.id) throw bad('An independent assessor must revoke the qualification')
  if (reason.trim().length < 10) throw bad('Record a revocation reason')
  q.run("UPDATE staff_qualifications SET status='Revoked',revocation_reason=?,updated_by=?,updated_at=?,version=version+1 WHERE id=?", reason, ctx.user?.id, nowIso(), id)
  audit(ctx, getDef('staff_qualifications'), id, 'revoke', { reason }, r._title)
  return getRecord(getDef('staff_qualifications'), id, ctx)
}

export function eligibleForActivity(userId: number, activity: string, department: number) {
  const rules = q.all('SELECT * FROM activity_skill_rules WHERE active=1 AND deleted_at IS NULL AND lower(activity)=lower(?) AND (department_id IS NULL OR department_id=?)', activity, department)
  return rules.every(r => !!q.val("SELECT 1 FROM staff_qualifications f JOIN competencies c ON c.id=f.competency_id WHERE f.user_id=? AND f.competency_id=? AND f.level>=? AND f.status='Verified' AND f.expires_on>=? AND f.deleted_at IS NULL AND c.active=1 AND c.deleted_at IS NULL", userId, r.competency_id, r.minimum_level, todayStr()))
}

export function competencyMatrix(ctx: Ctx) {
  assertCan(ctx, 'hr', 'view')
  const users = q.all('SELECT id,name,department_id FROM users WHERE active=1 AND party_id IS NULL AND deleted_at IS NULL')
  const skills = listRecords(getDef('competencies'), { pageSize: 1000 }, ctx).rows
  const qualifications = listRecords(getDef('staff_qualifications'), { pageSize: 10000 }, ctx).rows
  return { users, skills, qualifications: qualifications.map((r): Rec => ({ ...r, current: r.status === 'Verified' && dateValid(r.expires_on) })) }
}

// ============================================================================
// 3.06 & 4.01 Daily Staff Accountability (System Snapshot vs Narrative)
// ============================================================================
export function computeActivitySnapshot(employeeId: number, userId: number | null, date: string) {
  const emp = q.get('SELECT * FROM employees WHERE id = ? AND deleted_at IS NULL', employeeId)
  const uid = userId || emp?.user_id || 0
  const agt = q.get('SELECT id FROM agents WHERE employee_id = ? AND deleted_at IS NULL', employeeId)
  const aid = agt?.id ?? 0

  const calls = q.val<number>(
    `SELECT COUNT(*) FROM activities WHERE deleted_at IS NULL AND (owner_id = ? OR created_by = ?) AND substr(COALESCE(start_at, created_at), 1, 10) = ?`,
    uid, uid, date,
  ) ?? 0
  const tasks = q.val<number>(
    `SELECT COUNT(*) FROM tasks WHERE deleted_at IS NULL AND assignee_id = ? AND status = 'Done' AND substr(COALESCE(completed_at, updated_at), 1, 10) = ?`,
    uid, date,
  ) ?? 0
  const leads = q.val<number>(
    `SELECT COUNT(*) FROM leads WHERE deleted_at IS NULL AND (owner_id = ? OR created_by = ?) AND substr(updated_at, 1, 10) = ?`,
    uid, uid, date,
  ) ?? 0
  const viewings = (q.val<number>(
    `SELECT COUNT(*) FROM viewings WHERE deleted_at IS NULL AND (agent_id = ? OR created_by = ?) AND substr(scheduled_at, 1, 10) = ?`,
    aid, uid, date,
  ) ?? 0) + (q.val<number>(
    `SELECT COUNT(*) FROM property_visits WHERE deleted_at IS NULL AND (conducted_by_id = ? OR created_by = ?) AND substr(scheduled_at, 1, 10) = ?`,
    employeeId, uid, date,
  ) ?? 0)
  const offers = q.val<number>(
    `SELECT COUNT(*) FROM offers WHERE deleted_at IS NULL AND (buyer_agent_id = ? OR listing_agent_id = ? OR created_by = ?) AND offer_date = ?`,
    aid, aid, uid, date,
  ) ?? 0

  return {
    sys_calls_count: calls,
    sys_tasks_completed: tasks,
    sys_leads_contacted: leads,
    sys_viewings_completed: viewings,
    sys_offers_logged: offers,
    system_snapshot: {
      computed_at: nowIso(),
      workday: date,
      employee_id: employeeId,
      user_id: uid,
      agent_id: aid || null,
      metrics: { calls, tasks_completed: tasks, leads_progressed: leads, viewings_and_visits: viewings, offers_logged: offers },
    },
  }
}

export const dailyReportHooks: Hooks = {
  beforeSave({ rec, old, ctx }) {
    if (old && (old.status === 'Submitted (Frozen)' || old.status === 'Approved by Manager') && !ctx.system) {
      throw bad('Submitted daily accountability reports are frozen. Ask your line manager to return the report if an amendment is required.')
    }
    const emp = q.get('SELECT * FROM employees WHERE id = ? AND deleted_at IS NULL', rec.employee_id)
    if (!emp) throw bad('Select a valid employee record')
    rec.user_id ??= emp.user_id ?? ctx.user?.id ?? null
    rec.department_id ??= emp.department_id ?? null
    const date = rec.report_date || todayStr()
    rec.report_date = date

    // Always derive system evidence metrics from source tables; employee edits cannot alter system counts (Gate 10.2)
    const snap = computeActivitySnapshot(rec.employee_id, rec.user_id, date)
    rec.sys_calls_count = snap.sys_calls_count
    rec.sys_tasks_completed = snap.sys_tasks_completed
    rec.sys_leads_contacted = snap.sys_leads_contacted
    rec.sys_viewings_completed = snap.sys_viewings_completed
    rec.sys_offers_logged = snap.sys_offers_logged
    rec.system_snapshot = snap.system_snapshot

    // Check approved leave exemption (Control 4.01)
    const onLeave = q.val<number>(
      `SELECT COUNT(*) FROM leave_requests WHERE employee_id = ? AND status = 'Approved' AND from_date <= ? AND to_date >= ? AND deleted_at IS NULL`,
      rec.employee_id, date, date,
    ) ?? 0
    if (onLeave > 0 || ['Approved Leave (Exempt)', 'Public Holiday (Exempt)', 'Medical / Approved Exemption'].includes(rec.day_type)) {
      if (onLeave > 0 && rec.day_type === 'Assigned Workday') rec.day_type = 'Approved Leave (Exempt)'
      if (!old) rec.status = 'Exemption Logged'
    } else if (!old) {
      rec.status = 'Draft'
      rec.revision_no = 1
      rec.review_version = 0
      rec.review_history = []
    }
  },
}

export function submitDailyReport(id: number, ctx: Ctx) {
  assertCan(ctx, 'hr', 'edit')
  const r = getRecord(getDef('daily_reports'), id, ctx)
  if (r.status === 'Submitted (Frozen)' || r.status === 'Approved by Manager') throw bad('This report is already submitted and frozen')
  if (['Approved Leave (Exempt)', 'Public Holiday (Exempt)', 'Medical / Approved Exemption'].includes(r.day_type)) {
    return patchRecord(getDef('daily_reports'), id, { status: 'Exemption Logged', submitted_at: nowIso() }, { ...ctx, system: true })
  }
  if (!String(r.outcomes_narrative ?? '').trim() || !String(r.next_day_priorities ?? '').trim()) {
    throw bad('Complete both the workday outcomes narrative and next-day priorities before submitting')
  }
  const snap = computeActivitySnapshot(r.employee_id, r.user_id, r.report_date)
  const at = nowIso()
  const rev = r.status === 'Returned for Clarification' ? Number(r.revision_no || 1) + 1 : Number(r.revision_no || 1)
  const updated = patchRecord(getDef('daily_reports'), id, {
    ...snap,
    status: 'Submitted (Frozen)',
    submitted_at: at,
    frozen_at: at,
    revision_no: rev,
  }, { ...ctx, system: true })

  if (r.confidential_escalation) {
    createRecord(getDef('compliance_cases'), {
      title: `Confidential staff escalation from Daily Report ${r.report_no}`,
      case_category: 'Client Complaint (4.09)',
      source_type: 'Confidential Whistleblowing',
      severity: 'High',
      subject_user_id: r.user_id,
      linked_entity: 'daily_reports',
      linked_record_id: id,
      evidence_summary: `Confidential channel invoked on ${r.report_date} by employee #${r.employee_id}. Routed separately from line management.`,
    }, { ...ctx, system: true })
  }
  recordEnterpriseAudit(ctx, '3.06', '4.01', 'daily_report.submitted', 'daily_reports', id, `Daily report ${r.report_no} submitted and frozen (v${rev})`, snap.system_snapshot)
  return updated
}

export function reviewDailyReport(id: number, decision: 'approve' | 'return', feedback: string, ctx: Ctx) {
  assertCan(ctx, 'hr', 'approve')
  const r = getRecord(getDef('daily_reports'), id, ctx)
  if (r.status !== 'Submitted (Frozen)') throw bad('Only a submitted (frozen) report can be reviewed')
  if (r.user_id === ctx.user?.id || r.created_by === ctx.user?.id) throw bad('Line manager review must be performed by an independent manager, not the submitting employee')
  if (feedback.trim().length < 5) throw bad('Provide manager review comments (at least 5 characters)')

  const at = nowIso()
  const nextReviewVer = Number(r.review_version || 0) + 1
  const history = Array.isArray(r.review_history) ? [...r.review_history] : safeJson<any[]>(r.review_history, [])
  history.push({
    review_version: nextReviewVer,
    decision,
    feedback: feedback.trim(),
    reviewed_by: ctx.user?.id,
    reviewer_name: ctx.user?.name,
    reviewed_at: at,
    report_revision: r.revision_no,
  })
  const newStatus = decision === 'approve' ? 'Approved by Manager' : 'Returned for Clarification'
  const updated = patchRecord(getDef('daily_reports'), id, {
    status: newStatus,
    reviewed_by: ctx.user?.id,
    reviewed_at: at,
    review_version: nextReviewVer,
    manager_feedback: feedback.trim(),
    review_history: history,
  }, { ...ctx, system: true })
  recordEnterpriseAudit(ctx, '3.06', '4.01', `daily_report.${decision}`, 'daily_reports', id, `Manager ${decision} on ${r.report_no} (review v${nextReviewVer})`, { decision, feedback })
  return updated
}

export function scanMissingDailyReports(workDate = todayStr(), ctx: Ctx = SYSTEM_CTX) {
  const activeEmps = q.all('SELECT * FROM employees WHERE status = ? AND deleted_at IS NULL', 'Active')
  const missing: Rec[] = []
  let tasksCreated = 0
  for (const emp of activeEmps) {
    const onLeave = q.val<number>(
      `SELECT COUNT(*) FROM leave_requests WHERE employee_id = ? AND status = 'Approved' AND from_date <= ? AND to_date >= ? AND deleted_at IS NULL`,
      emp.id, workDate, workDate,
    ) ?? 0
    if (onLeave > 0) continue
    const rep = q.get('SELECT id, status FROM daily_reports WHERE employee_id = ? AND report_date = ? AND deleted_at IS NULL', emp.id, workDate)
    if (!rep || rep.status === 'Draft') {
      missing.push({ employee_id: emp.id, emp_no: emp.emp_no, name: emp.name, status: rep ? 'Draft unsubmitted' : 'Missing' })
      // Control 3.06 & 4.01: Never auto-penalise; repeated non-submission creates a manager follow-up task
      const totalReports = q.val<number>('SELECT COUNT(*) FROM daily_reports WHERE employee_id = ? AND status IN (?, ?) AND deleted_at IS NULL', emp.id, 'Submitted (Frozen)', 'Approved by Manager') ?? 0
      if (totalReports === 0) {
        const mgrUser = emp.manager_id ? q.val<number>('SELECT user_id FROM employees WHERE id = ?', emp.manager_id) : null
        const existingTask = q.val<number>(`SELECT COUNT(*) FROM tasks WHERE link_entity = 'employees' AND link_id = ? AND title LIKE 'Follow up missing daily report%' AND status <> 'Done' AND deleted_at IS NULL`, emp.id) ?? 0
        if (!existingTask) {
          createRecord(getDef('tasks'), {
            title: `Follow up missing daily report: ${emp.name} (${workDate})`,
            kind: 'Follow-up',
            priority: 'High',
            due_date: workDate,
            assignee_id: mgrUser || ctx.user?.id || 1,
            link_entity: 'employees',
            link_id: emp.id,
            link_label: `${emp.emp_no} – ${emp.name}`,
            description: `Automated accountability check (3.06): ${emp.name} has not submitted a daily report for ${workDate}. Please review with the employee (no automatic penalty is applied).`,
          }, { ...ctx, system: true })
          tasksCreated++
        }
      }
    }
  }
  return { work_date: workDate, missing_count: missing.length, manager_tasks_created: tasksCreated, missing }
}

// ============================================================================
// 3.07, 3.12, 4.02, 7.01, 7.07 & Gate 10.3 — Inventory Acquisition & Listing Gate
// ============================================================================
export const inventorySubmissionHooks: Hooks = {
  beforeSave({ rec, old, ctx }) {
    if (!old) {
      rec.sourcing_user_id ??= ctx.user?.id ?? null
      const bld = String(rec.building_name ?? '').trim().toLowerCase()
      const unit = String(rec.unit_no ?? '').trim().toLowerCase()
      // Adversarial 7.01 & Gate 10.3: Duplicate unit detection by building/tower + unit_no
      const dupSub = q.get(
        `SELECT id, submission_no, sourcing_agent_id FROM inventory_submissions WHERE lower(trim(building_name)) = ? AND lower(trim(unit_no)) = ? AND deleted_at IS NULL ORDER BY id ASC LIMIT 1`,
        bld, unit,
      )
      if (dupSub) {
        rec.duplicate_of_id = dupSub.id
        rec.conflict_status = 'Potential Duplicate – Review Required'
        rec.status = 'Duplicate / Conflict Hold'
      } else {
        rec.conflict_status = 'Clear'
        rec.status = 'Submitted'
      }
    } else if (!ctx.system) {
      // Prevent direct CRUD bypass of publication status
      if (rec.status && rec.status !== old.status) {
        throw bad('Use the controlled inventory verification and publication approval endpoints to transition inventory status')
      }
    }
  },
}

export function resolveInventoryConflict(id: number, resolution: 'merge' | 'clear' | 'reject', notes: string, ctx: Ctx) {
  assertCan(ctx, 'properties', 'approve')
  const r = getRecord(getDef('inventory_submissions'), id, ctx)
  if (r.sourcing_user_id === ctx.user?.id) throw bad('An independent listings manager must resolve duplicate inventory conflicts')
  if (notes.trim().length < 10) throw bad('Provide conflict resolution notes (at least 10 characters)')
  const conflictStatus = resolution === 'merge' ? 'Merged Preserving Attribution' : resolution === 'clear' ? 'Clear' : 'Rejected Duplicate'
  const status = resolution === 'reject' ? 'Rejected' : 'Submitted'
  const updated = patchRecord(getDef('inventory_submissions'), id, {
    conflict_status: conflictStatus,
    status,
    rejection_reason: notes.trim(),
  }, { ...ctx, system: true })
  recordEnterpriseAudit(ctx, '3.07', '4.02', `inventory.conflict_${resolution}`, 'inventory_submissions', id, `Inventory conflict resolved as ${conflictStatus} preserving source attribution`, { resolution, notes, duplicate_of_id: r.duplicate_of_id })
  return updated
}

export function verifyInventorySubmission(id: number, stage: 'inventory' | 'compliance', ctx: Ctx) {
  const r = getRecord(getDef('inventory_submissions'), id, ctx)
  if (r.status === 'Duplicate / Conflict Hold' || r.conflict_status === 'Potential Duplicate – Review Required') {
    throw bad('Resolve the duplicate building/unit conflict before verifying this submission')
  }
  if (stage === 'inventory') {
    assertCan(ctx, 'properties', 'edit')
    if (r.sourcing_user_id === ctx.user?.id) throw bad('Independent inventory team verification is required (verifier cannot be the sourcing agent)')
    if (!r.owner_contact_verified || !String(r.source_permission_evidence ?? '').trim()) {
      throw bad('Owner identity/contact verification and signed Form A / marketing authority reference are required')
    }
    const updated = patchRecord(getDef('inventory_submissions'), id, {
      status: 'Inventory Verified',
      inventory_verified_by: ctx.user?.id,
      inventory_verified_at: nowIso(),
    }, { ...ctx, system: true })
    recordEnterpriseAudit(ctx, '3.07', '4.02', 'inventory.verified', 'inventory_submissions', id, `Independent inventory verification completed for ${r.submission_no}`)
    return updated
  } else {
    assertCan(ctx, 'compliance', 'edit')
    if (r.status !== 'Inventory Verified') throw bad('Inventory availability and owner authority must be verified first')
    if (!String(r.trakheesi_permit_no ?? '').trim() || !dateValid(r.permit_expiry_date)) {
      throw bad('Valid, non-expired RERA Trakheesi advertising permit number and expiry date are required for compliance verification')
    }
    const updated = patchRecord(getDef('inventory_submissions'), id, {
      status: 'Compliance Verified',
      compliance_verified_by: ctx.user?.id,
      compliance_verified_at: nowIso(),
    }, { ...ctx, system: true })
    recordEnterpriseAudit(ctx, '3.07', '4.02', 'inventory.compliance_verified', 'inventory_submissions', id, `Compliance permit verification completed for ${r.submission_no}`)
    return updated
  }
}

export function approveAndPublishInventory(id: number, ctx: Ctx) {
  assertCan(ctx, 'properties', 'approve')
  const r = getRecord(getDef('inventory_submissions'), id, ctx)
  // Adversarial 7.07 (Unauthorised property advert) & Gate 10.3
  if (r.status !== 'Compliance Verified' || !r.inventory_verified_by || !r.compliance_verified_by || !r.owner_contact_verified || !r.trakheesi_permit_no || !dateValid(r.permit_expiry_date)) {
    createRecord(getDef('compliance_cases'), {
      title: `Blocked unauthorised listing publication attempt: ${r.building_name} ${r.unit_no}`,
      case_category: 'Unauthorised Listing Advert (7.07)',
      source_type: 'Automated Anomaly Lead',
      severity: 'High',
      subject_user_id: ctx.user?.id,
      linked_entity: 'inventory_submissions',
      linked_record_id: id,
      evidence_summary: `Attempted to publish inventory ${r.submission_no} in status "${r.status}" without complete owner authority, valid Trakheesi permit, or prior verification steps.`,
    }, { ...ctx, system: true })
    throw bad('Publication blocked (Control 3.07 / 7.07): Listing cannot be published without verified owner authority, valid Trakheesi permit, independent inventory check, and compliance verification. Incident logged.')
  }
  if (r.sourcing_user_id === ctx.user?.id || r.inventory_verified_by === ctx.user?.id) {
    throw bad('Second-person approval rule (Control 3.07): Approving manager must be distinct from the sourcing agent and inventory verifier')
  }
  // Check broker RERA credential validity (7.08)
  const agent = q.get('SELECT * FROM agents WHERE id = ? AND deleted_at IS NULL', r.sourcing_agent_id)
  if (!agent || agent.status !== 'Active' || (agent.dld_expiry && agent.dld_expiry < todayStr())) {
    throw bad('Sourcing broker RERA registration is expired or inactive. Reassign to an authorised broker before publishing.')
  }

  // Create canonical Property & Listing Mandate
  const prop = createRecord(getDef('properties'), {
    title: `${r.building_name} – Unit ${r.unit_no}`,
    property_type: ['Apartment', 'Villa', 'Townhouse', 'Studio', 'Penthouse', 'Duplex'].includes(r.property_type) ? r.property_type : 'Apartment',
    status: 'Available',
    community_ref: r.community_id ?? null,
    building_name: r.building_name,
    floor_no: r.floor_no ?? null,
    bedrooms: r.bedrooms ?? 1,
    bathrooms: r.bathrooms ?? 1,
    area_sqft: r.area_sqft,
    price: r.asking_price ?? 0,
    rent_annual: r.asking_rent ?? 0,
    rera_permit_no: r.trakheesi_permit_no,
    permit_expiry: r.permit_expiry_date,
    agent_id: r.sourcing_agent_id,
    active: true,
  }, { ...ctx, system: true })

  let ownerPartyId = r.owner_party_id
  if (!ownerPartyId) {
    const createdOwner = createRecord(getDef('parties'), {
      name: r.owner_name,
      phone: r.owner_phone ?? null,
      is_customer: true,
      is_landlord: true,
      status: 'Active',
    }, { ...ctx, system: true })
    ownerPartyId = createdOwner.id
  }

  createRecord(getDef('listing_mandates'), {
    property_id: prop.id,
    owner_id: ownerPartyId,
    listing_agent_id: r.sourcing_agent_id,
    form_a_ref: r.source_permission_evidence,
    title_deed_verified: true,
    passport_eid_verified: true,
    trakheesi_permit_no: r.trakheesi_permit_no,
    permit_expiry_date: r.permit_expiry_date,
    authorized_price: r.asking_price ?? 0,
    authorized_rent: r.asking_rent ?? 0,
    second_person_approver_id: ctx.user?.id,
    approved_at: nowIso(),
    status: 'Verified & Active',
    price_history: [{ price: r.asking_price ?? 0, rent: r.asking_rent ?? 0, approved_by: ctx.user?.id, at: nowIso(), reason: 'Initial approved publication' }],
  }, { ...ctx, system: true })

  const updated = patchRecord(getDef('inventory_submissions'), id, {
    status: 'Published to Stock',
    manager_approved_by: ctx.user?.id,
    manager_approved_at: nowIso(),
    published_property_id: prop.id,
  }, { ...ctx, system: true })
  recordEnterpriseAudit(ctx, '3.07', '4.02', 'inventory.published', 'inventory_submissions', id, `Approved and published ${r.submission_no} to property ${prop.property_no}`, { property_id: prop.id })
  return updated
}

export function approveListingPriceChange(mandateId: number, newPrice: number, reason: string, ctx: Ctx) {
  assertCan(ctx, 'mandates', 'approve')
  const m = getRecord(getDef('listing_mandates'), mandateId, ctx)
  if (m.created_by === ctx.user?.id) throw bad('Price change requires second-person manager approval')
  if (newPrice <= 0 || reason.trim().length < 5) throw bad('Enter a valid new price and owner instruction reason')
  const history = Array.isArray(m.price_history) ? [...m.price_history] : safeJson<any[]>(m.price_history, [])
  history.push({ previous_price: m.authorized_price, price: newPrice, reason: reason.trim(), approved_by: ctx.user?.id, at: nowIso() })
  if (m.property_id) {
    patchRecord(getDef('properties'), m.property_id, { price: newPrice }, { ...ctx, system: true })
  }
  return patchRecord(getDef('listing_mandates'), mandateId, {
    previous_price: m.authorized_price,
    authorized_price: newPrice,
    price_change_reason: reason.trim(),
    price_change_approved_by: ctx.user?.id,
    status: 'Verified & Active',
    price_history: history,
  }, { ...ctx, system: true })
}

// ============================================================================
// 3.08, 4.03, 7.05 & Gate 10.4 — Transaction-Specific Developer NOC & Clearance
// ============================================================================
export const developerRequestHooks: Hooks = {
  beforeSave({ rec, old, ctx }) {
    // Control 3.08: Inventory verification is NOT an NOC application; requires a qualifying transaction and distinct buyer/seller
    if (!rec.sales_contract_id && !rec.job_id) {
      throw bad('Developer NOC Control (3.08): An NOC request requires a qualifying sales contract or deal file (inventory sourcing never triggers an NOC)')
    }
    if (rec.seller_id && rec.buyer_id && rec.seller_id === rec.buyer_id) {
      throw bad('Seller and buyer on a Developer NOC request must be distinct parties')
    }
    if (!old) {
      rec.status = 'Draft'
      rec.closing_stage_unlocked = false
    } else if (!ctx.system) {
      if (rec.closing_stage_unlocked && !old.closing_stage_unlocked) {
        throw bad('Closing stage can only be unlocked through independent NOC verification')
      }
      if (rec.status === 'Verified & Valid (Closing Unlocked)' && old.status !== 'Verified & Valid (Closing Unlocked)') {
        throw bad('Use the independent NOC verification endpoint to validate an issued NOC')
      }
    }
  },
}

export function submitDeveloperNoc(id: number, portalRef: string, senderEmail: string, ctx: Ctx) {
  assertCan(ctx, 'transactions', 'edit')
  const r = getRecord(getDef('developer_requests'), id, ctx)
  if (!r.checklist_completed || !String(r.owner_authorisation_ref ?? '').trim()) {
    throw bad('Complete the developer prerequisite checklist and record the signed seller authorisation reference before submitting')
  }
  if (Number(r.outstanding_service_charges || 0) > 0 && (!r.service_charges_cleared || !String(r.service_charge_receipt_ref ?? '').trim())) {
    throw bad('Outstanding service charges must be settled and supported by payment evidence before developer NOC submission')
  }
  if (!portalRef.trim()) throw bad('Official developer portal application reference is required')
  const updated = patchRecord(getDef('developer_requests'), id, {
    portal_application_ref: portalRef.trim(),
    authorised_sender_email: senderEmail.trim() || 'noc@swkpropertiesuae.com',
    submitted_by: ctx.user?.id,
    submitted_at: nowIso(),
    status: 'Submitted to Developer Portal',
  }, { ...ctx, system: true })
  recordEnterpriseAudit(ctx, '3.08', '4.03', 'noc.submitted', 'developer_requests', id, `Developer NOC ${r.request_no} submitted via portal ref ${portalRef}`)
  return updated
}

export function uploadDeveloperNocDocument(id: number, nocNo: string, issueDate: string, expiryDate: string, docRef: string, ctx: Ctx) {
  assertCan(ctx, 'transactions', 'edit')
  const r = getRecord(getDef('developer_requests'), id, ctx)
  if (r.status !== 'Submitted to Developer Portal' && r.status !== 'NOC Uploaded – Pending Independent Review') {
    throw bad('NOC must be submitted to the developer portal before uploading an issued document')
  }
  // Control 4.03 & 7.05: Uploading a PDF/image NEVER marks the NOC as valid on its own; it waits for independent verification
  return patchRecord(getDef('developer_requests'), id, {
    issued_noc_no: nocNo.trim(),
    issued_date: issueDate || todayStr(),
    expiry_date: expiryDate,
    document_evidence_ref: docRef.trim(),
    status: 'NOC Uploaded – Pending Independent Review',
    closing_stage_unlocked: false,
  }, { ...ctx, system: true })
}

export function verifyDeveloperNoc(id: number, decision: 'verify' | 'flag_fraud', notes: string, ctx: Ctx) {
  assertCan(ctx, 'transactions', 'approve')
  const r = getRecord(getDef('developer_requests'), id, ctx)
  // Adversarial 7.05 (Fake developer NOC) & Gate 10.4
  if (decision === 'flag_fraud' || !String(r.portal_application_ref ?? '').trim() || !String(r.issued_noc_no ?? '').trim() || !String(r.document_evidence_ref ?? '').trim() || !dateValid(r.expiry_date)) {
    const reason = notes.trim() || 'Missing corroborating developer portal reference, certificate number, or valid expiry date'
    patchRecord(getDef('developer_requests'), id, {
      status: 'Held – Fraud / Unverified Escalation',
      closing_stage_unlocked: false,
      escalation_reason: reason,
    }, { ...ctx, system: true })
    createRecord(getDef('compliance_cases'), {
      title: `Fake / unverified Developer NOC held: ${r.request_no}`,
      case_category: 'Fake / Unverified NOC Alert (7.05)',
      source_type: 'Supervisor Escalation',
      severity: 'Critical',
      subject_user_id: r.submitted_by,
      property_id: r.property_id,
      linked_entity: 'developer_requests',
      linked_record_id: id,
      evidence_summary: `NOC ${r.request_no} held before closing stage. Reason: ${reason}`,
    }, { ...ctx, system: true })
    if (decision === 'flag_fraud') {
      return getRecord(getDef('developer_requests'), id, ctx)
    }
    throw bad(`NOC Verification Gate (7.05 / 10.4): Cannot mark NOC valid without corroborating portal reference, certificate number, and future expiry date. Stage held and escalated.`)
  }
  if (r.submitted_by === ctx.user?.id || r.created_by === ctx.user?.id) {
    throw bad('Independent Reviewer Control (4.03 / 10.4): The reviewer verifying the issued NOC must be independent from the coordinator who submitted it')
  }
  const updated = patchRecord(getDef('developer_requests'), id, {
    status: 'Verified & Valid (Closing Unlocked)',
    verified_by: ctx.user?.id,
    verified_at: nowIso(),
    closing_stage_unlocked: true,
    developer_response_log: notes.trim() || r.developer_response_log,
  }, { ...ctx, system: true })

  // Unlock linked Enterprise Transaction
  q.run(`UPDATE transactions SET noc_verified = 1, updated_at = ? WHERE noc_request_id = ? AND deleted_at IS NULL`, nowIso(), id)
  recordEnterpriseAudit(ctx, '3.08', '4.03', 'noc.verified_unlocked', 'developer_requests', id, `Developer NOC ${r.request_no} independently verified; closing stage unlocked`)
  return updated
}

// ============================================================================
// 3.13, 3.14, 4.04, 4.05 & Gate 10.1 — Enterprise Transactions & 11 Exceptions
// ============================================================================
export const transactionHooks: Hooks = {
  beforeSave({ rec, old, ctx }) {
    if (!old) {
      rec.stage ??= 'Lead Qualified'
      rec.exception_state ??= 'None'
      rec.exception_resolved = rec.exception_state === 'None'
    } else if (!ctx.system && rec.stage && rec.stage !== old.stage) {
      throw bad('Stage Control (4.04): Direct stage jumps are prohibited. Use the controlled stage transition endpoint which validates KYC, forms, NOC, transfer evidence, and financial reconciliation.')
    }
  },
}

export function advanceTransactionStage(id: number, targetStage: string, evidence: Record<string, any>, ctx: Ctx) {
  assertCan(ctx, 'transactions', 'edit')
  const t = getRecord(getDef('transactions'), id, ctx)
  if (t.exception_state !== 'None' && !t.exception_resolved && targetStage !== 'On Hold – Exception Active' && targetStage !== 'Cancelled') {
    throw bad(`Transaction has an active unresolved exception (${t.exception_state}). Resolve the exception before advancing stages.`)
  }

  // Adversarial 7.08 & Gate 10.6: Check primary broker RERA credential validity
  const agent = q.get('SELECT * FROM agents WHERE id = ? AND deleted_at IS NULL', t.primary_agent_id)
  if ((!agent || agent.status !== 'Active' || (agent.dld_expiry && agent.dld_expiry < todayStr())) && !t.co_agent_id) {
    throw bad('Regulated Action Blocked (7.08 / 10.6): Primary broker RERA card has lapsed or is inactive. Assign an authorised cover broker (co_agent_id) before progressing this deal.')
  }

  const patch: Record<string, any> = { ...evidence }

  if (targetStage === 'KYC & Compliance Cleared') {
    if (!patch.kyc_cleared && !t.kyc_cleared) throw bad('Buyer and seller KYC / AML screening must be verified before clearing compliance')
    if (t.exception_state.includes('power of attorney') && !patch.poa_verified_by_legal && !t.poa_verified_by_legal) {
      throw bad('POA Exception Control (3.13 #3): Legal verification of the Power of Attorney is required')
    }
    if (t.exception_state.includes('multiple beneficial owners') && !patch.ubo_verified_by_compliance && !t.ubo_verified_by_compliance) {
      throw bad('Corporate UBO Exception Control (3.13 #4): Beneficial owners (25%+) must be verified by Compliance')
    }
    patch.kyc_cleared = true
  } else if (targetStage === 'MOU / Form F Signed') {
    if (!t.kyc_cleared && !patch.kyc_cleared) throw bad('Complete KYC & Compliance clearance before signing MOU / Form F')
    if (!t.forms_completed && !patch.forms_completed) throw bad('RERA Forms (Form A / Form B / Form F) must be signed and recorded')
    patch.forms_completed = true
  } else if (targetStage === 'Developer NOC Verified') {
    const nocId = patch.noc_request_id || t.noc_request_id
    if (!nocId) throw bad('Link a Developer NOC request before advancing to Developer NOC Verified')
    const noc = q.get('SELECT * FROM developer_requests WHERE id = ? AND deleted_at IS NULL', nocId)
    if (!noc || noc.status !== 'Verified & Valid (Closing Unlocked)' || !noc.closing_stage_unlocked) {
      throw bad('Developer NOC Gate (4.03 / 10.4): The linked Developer NOC has not yet been independently verified and unlocked')
    }
    patch.noc_request_id = nocId
    patch.noc_verified = true
  } else if (targetStage === 'Transfer / Title Deed Verified') {
    if (t.transaction_category === 'Secondary Sale' && !t.noc_verified) {
      throw bad('Cannot verify DLD Transfer / Title Deed before Developer NOC is verified')
    }
    const ref = String(patch.title_deed_or_oqood_ref || t.title_deed_or_oqood_ref || '').trim()
    if (!ref) throw bad('External Title Deed or Oqood registration reference is required')
    patch.title_deed_or_oqood_ref = ref
    patch.transfer_evidence_verified = true
    patch.transfer_verified_by = ctx.user?.id
  } else if (targetStage === 'Invoiced & Reconciled' || targetStage === 'Closed') {
    if (!t.transfer_evidence_verified && !patch.transfer_evidence_verified) {
      throw bad('External transfer / title-deed evidence must be verified before invoicing and closing')
    }
    const invId = patch.invoice_id || t.invoice_id
    const rctId = patch.receipt_id || t.receipt_id
    if (!invId || !rctId) throw bad('Both a posted Tax Invoice and a verified Bank Receipt are required to mark the transaction Invoiced & Reconciled')
    const rct = q.get('SELECT * FROM receipts WHERE id = ? AND deleted_at IS NULL', rctId)
    patch.invoice_id = invId
    patch.receipt_id = rctId
    patch.financially_reconciled = true
    if (rct) patch.collected_commission = fromCents(rct.amount)
  }

  patch.stage = targetStage
  const updated = patchRecord(getDef('transactions'), id, patch, { ...ctx, system: true })
  recordEnterpriseAudit(ctx, '3.13', '4.04', 'transaction.stage_advanced', 'transactions', id, `Transaction ${t.transaction_no} advanced to "${targetStage}"`, patch)
  return updated
}

export function raiseTransactionException(id: number, exceptionState: string, plan: string, ctx: Ctx) {
  assertCan(ctx, 'transactions', 'edit')
  const t = getRecord(getDef('transactions'), id, ctx)
  if (!exceptionState || exceptionState === 'None') throw bad('Select one of the 11 secondary sale exception states')
  const patch: Record<string, any> = {
    exception_state: exceptionState,
    exception_resolution_plan: plan.trim(),
    exception_resolved: false,
    stage: 'On Hold – Exception Active',
  }
  if (exceptionState.includes('deposit is disputed')) {
    patch.deposit_held_status = 'Disputed (Frozen)'
  }
  if (exceptionState.includes('misrepresentation') || exceptionState.includes('Two brokers claim')) {
    createRecord(getDef('compliance_cases'), {
      title: `Transaction exception escalation (${exceptionState}): ${t.transaction_no}`,
      case_category: 'Client Complaint (4.09)',
      source_type: 'Supervisor Escalation',
      severity: 'High',
      party_id: t.buyer_id,
      property_id: t.property_id,
      transaction_id: id,
      linked_entity: 'transactions',
      linked_record_id: id,
      evidence_summary: `Exception raised on ${t.transaction_no}: ${exceptionState}. Plan: ${plan}`,
    }, { ...ctx, system: true })
  }
  const updated = patchRecord(getDef('transactions'), id, patch, { ...ctx, system: true })
  recordEnterpriseAudit(ctx, '3.13', '4.04', 'transaction.exception_raised', 'transactions', id, `Exception raised on ${t.transaction_no}: ${exceptionState}`, patch)
  return updated
}

export function resolveTransactionException(id: number, resolutionNotes: string, resumeStage: string, patchFlags: Record<string, any>, ctx: Ctx) {
  assertCan(ctx, 'transactions', 'approve')
  const t = getRecord(getDef('transactions'), id, ctx)
  if (resolutionNotes.trim().length < 10) throw bad('Document the exception resolution evidence (at least 10 characters)')
  const updated = patchRecord(getDef('transactions'), id, {
    ...patchFlags,
    exception_resolved: true,
    exception_resolution_plan: `${t.exception_resolution_plan || ''}\n[Resolved by ${ctx.user?.name} at ${nowIso()}]: ${resolutionNotes.trim()}`.trim(),
    stage: resumeStage || 'Lead Qualified',
  }, { ...ctx, system: true })
  recordEnterpriseAudit(ctx, '3.13', '4.04', 'transaction.exception_resolved', 'transactions', id, `Exception resolved on ${t.transaction_no}`, { resolutionNotes, resumeStage })
  return updated
}

// ============================================================================
// 3.03, 3.04, 4.06, 7.08, 7.09 & Gate 10.6 — Immigration PRO & Agent Activation
// ============================================================================
export function advanceImmigrationCase(
  id: number,
  step: 'submit' | 'official_approval' | 'complete' | 'escalate_delay',
  payload: Record<string, any>,
  ctx: Ctx,
) {
  assertCan(ctx, 'hr', 'edit')
  const c = getRecord(getDef('immigration_cases'), id, ctx)
  if (step === 'submit') {
    if (!c.eligibility_checked && !payload.eligibility_checked) throw bad('Verify the eligibility checklist before submitting the visa/work-permit application')
    if (!c.offer_contract_signed && !payload.offer_contract_signed) throw bad('Offer letter and MOHRE contract must be signed before application submission')
    if (!String(payload.application_ref || c.application_ref || '').trim()) throw bad('Application reference number is required')
    return patchRecord(getDef('immigration_cases'), id, {
      eligibility_checked: true,
      offer_contract_signed: true,
      application_ref: String(payload.application_ref || c.application_ref).trim(),
      submitted_date: payload.submitted_date || todayStr(),
      expected_decision_date: payload.expected_decision_date || addDays(todayStr(), 10),
      submitted_by: ctx.user?.id,
      status: 'Application Submitted',
    }, { ...ctx, system: true })
  }
  if (step === 'official_approval') {
    assertCan(ctx, 'hr', 'approve')
    if (!String(payload.official_approval_ref || c.official_approval_ref || '').trim()) {
      throw bad('Official government approval / entry permit reference is required')
    }
    return patchRecord(getDef('immigration_cases'), id, {
      official_approval_ref: String(payload.official_approval_ref || c.official_approval_ref).trim(),
      officially_approved_on: payload.officially_approved_on || todayStr(),
      permit_expiry_date: payload.permit_expiry_date || c.permit_expiry_date || addDays(todayStr(), 730),
      approval_verified_by: ctx.user?.id,
      is_delayed: false,
      status: 'Officially Approved',
    }, { ...ctx, system: true })
  }
  if (step === 'complete') {
    assertCan(ctx, 'hr', 'approve')
    // Control 3.03: Separation of application submission, official approval, and internally marked completion
    if (!c.official_approval_ref) throw bad('Cannot mark PRO case complete without an official government approval reference')
    if (c.submitted_by && c.submitted_by === ctx.user?.id) {
      throw bad('Separation of Duties (3.03): Internal completion sign-off must be performed by HR/Management, distinct from the PRO who submitted the application')
    }
    const updated = patchRecord(getDef('immigration_cases'), id, {
      medical_status: payload.medical_status || c.medical_status || 'Fit',
      eid_status: payload.eid_status || c.eid_status || 'Card Delivered',
      health_insurance_status: payload.health_insurance_status || c.health_insurance_status || 'Active',
      completed_by: ctx.user?.id,
      completed_at: nowIso(),
      status: 'Completed',
    }, { ...ctx, system: true })
    if (c.employee_id && updated.permit_expiry_date) {
      patchRecord(getDef('employees'), c.employee_id, { visa_no: c.official_approval_ref, visa_expiry: updated.permit_expiry_date }, { ...ctx, system: true })
    }
    return updated
  }
  // Adversarial 7.09: Employee visa delayed -> escalate, never assume approval
  const note = `[Escalated ${todayStr()}]: Application ${c.application_ref || c.case_no} exceeded expected decision window (${c.expected_decision_date}). Do NOT assume approval; regulated duties remain restricted until official approval is issued.`
  createRecord(getDef('tasks'), {
    title: `URGENT PRO Follow-up: Delayed visa case ${c.case_no}`,
    kind: 'Follow-up',
    priority: 'Urgent',
    due_date: todayStr(),
    assignee_id: c.pro_user_id || ctx.user?.id || 1,
    link_entity: 'immigration_cases',
    link_id: id,
    link_label: c.case_no,
    description: note,
  }, { ...ctx, system: true })
  return patchRecord(getDef('immigration_cases'), id, {
    is_delayed: true,
    status: 'Delayed / Escalated',
    notes: `${c.notes || ''}\n${note}`.trim(),
  }, { ...ctx, system: true })
}

export function activateAgentAuthorisation(id: number, stage: 'hr' | 'compliance', ctx: Ctx) {
  const a = getRecord(getDef('agent_authorisations'), id, ctx)
  if (stage === 'hr') {
    assertCan(ctx, 'hr', 'approve')
    if (!a.employee_id) throw bad('Link a valid HR Employee record before verifying work authorisation')
    const emp = q.get('SELECT * FROM employees WHERE id = ? AND deleted_at IS NULL', a.employee_id)
    if (!emp || emp.status !== 'Active') throw bad('Employee record must be Active in HR')
    if (emp.visa_expiry && emp.visa_expiry < todayStr()) throw bad('Employee residence visa / work permit is expired')
    return patchRecord(getDef('agent_authorisations'), id, {
      work_auth_verified: true,
      hr_verified_by: ctx.user?.id,
      status: 'Pending Compliance Sign-off',
    }, { ...ctx, system: true })
  } else {
    assertCan(ctx, 'compliance', 'approve')
    // Control 4.06 & Gate 10.6: Independent HR work-auth + Compliance BRN validation
    if (!a.work_auth_verified || !a.hr_verified_by) {
      throw bad('HR must independently verify employment and visa/work authorisation before Compliance activates regulated brokerage duties')
    }
    if (a.hr_verified_by === ctx.user?.id || a.user_id === ctx.user?.id) {
      throw bad('Segregation of Duties (4.06 / 10.6): Compliance sign-off must be performed by an officer independent of HR verification and the broker')
    }
    if (!String(a.brn_number ?? '').trim() || !dateValid(a.rera_expiry_date)) {
      throw bad('Valid RERA BRN number and future card expiry date are required for regulated brokerage activation')
    }
    if (!a.dld_exam_passed || !a.aml_training_completed || !a.conduct_policy_acknowledged) {
      throw bad('RERA exam, mandatory AML/PDPL training, and code-of-conduct acknowledgement must all be completed')
    }
    if (a.conflict_declaration_status === 'Restricted') {
      throw bad('Broker has an unresolved conflict-of-interest restriction')
    }
    const updated = patchRecord(getDef('agent_authorisations'), id, {
      registration_status: 'Active',
      status: 'Authorised',
      compliance_verified_by: ctx.user?.id,
      activated_at: nowIso(),
    }, { ...ctx, system: true })
    if (a.agent_id) {
      patchRecord(getDef('agents'), a.agent_id, { status: 'Active', dld_broker_id: a.brn_number, dld_expiry: a.rera_expiry_date }, { ...ctx, system: true })
    }
    recordEnterpriseAudit(ctx, '3.04', '4.06', 'agent_auth.activated', 'agent_authorisations', id, `Regulated brokerage duties activated for ${a.auth_no} (BRN ${a.brn_number})`)
    return updated
  }
}

export function handleExpiredBrokerCredential(id: number, coverAgentId: number, ctx: Ctx) {
  assertCan(ctx, 'compliance', 'edit')
  const a = getRecord(getDef('agent_authorisations'), id, ctx)
  if (!coverAgentId || coverAgentId === a.agent_id) throw bad('Select a distinct, active cover broker')
  const cover = q.get('SELECT * FROM agents WHERE id = ? AND status = ? AND deleted_at IS NULL', coverAgentId, 'Active')
  if (!cover || (cover.dld_expiry && cover.dld_expiry < todayStr())) {
    throw bad('Cover broker must hold an active, non-expired RERA registration')
  }
  const updated = patchRecord(getDef('agent_authorisations'), id, {
    registration_status: 'Expired',
    status: 'Restricted – Credential Expired',
    cover_agent_id: coverAgentId,
  }, { ...ctx, system: true })
  if (a.agent_id) {
    patchRecord(getDef('agents'), a.agent_id, { status: 'Licence Expired' }, { ...ctx, system: true })
    // Assign cover agent on active transactions so deals are protected while restricting regulated actions by expired broker (7.08)
    q.run(`UPDATE transactions SET co_agent_id = ? WHERE primary_agent_id = ? AND stage NOT IN ('Closed', 'Cancelled') AND deleted_at IS NULL`, coverAgentId, a.agent_id)
  }
  createRecord(getDef('compliance_cases'), {
    title: `Broker RERA credential lapsed: ${a.brn_number} — Cover assigned`,
    case_category: 'Broker Credential Lapse (7.08)',
    source_type: 'Automated Anomaly Lead',
    severity: 'High',
    subject_user_id: a.user_id,
    linked_entity: 'agent_authorisations',
    linked_record_id: id,
    evidence_summary: `RERA BRN ${a.brn_number} expired (${a.rera_expiry_date}). Regulated duties restricted and active deals covered by agent #${coverAgentId} (${cover.name}).`,
  }, { ...ctx, system: true })
  recordEnterpriseAudit(ctx, '3.04', '4.06', 'agent_auth.expired_cover_assigned', 'agent_authorisations', id, `Restricted expired BRN ${a.brn_number} and assigned cover broker ${cover.name}`)
  return updated
}

// ============================================================================
// 3.09, 3.10, 4.07, 7.03, 7.04, 7.14 & Gate 10.5 — WhatsApp Supervision & Field Privacy
// ============================================================================
const DIVERSION_REGEX = /\b(personal\s+number|private\s+whatsapp|personal\s+whatsapp|message\s+me\s+privately|call\s+my\s+personal|text\s+my\s+personal|off\s+the\s+company\s+line)\b/i

export const communicationHooks: Hooks = {
  beforeSave({ rec, old, ctx }) {
    const text = String(rec.message_summary ?? '')
    // Adversarial 7.04: Detect attempts to divert customer from company channel to personal WhatsApp
    if (DIVERSION_REGEX.test(text)) {
      rec.diversion_flag = true
      rec.diversion_evidence = `Matched personal-channel diversion pattern in message: "${text.slice(0, 180)}"`
      rec.escalation_tag = 'Personal Number Diversion Flag'
      rec.status = 'Escalated to Supervisor'
    }
    if (!old) {
      rec.sla_due_at ??= nowIso()
    }
  },
  afterSave({ rec, isNew, ctx }) {
    if (rec.diversion_flag && isNew) {
      createRecord(getDef('compliance_cases'), {
        title: `Personal WhatsApp diversion flag on ${rec.comm_no}`,
        case_category: 'Personal WhatsApp Diversion (7.04)',
        source_type: 'Automated Anomaly Lead',
        severity: 'High',
        subject_user_id: rec.assigned_user_id,
        party_id: rec.party_id ?? null,
        property_id: rec.property_id ?? null,
        linked_entity: 'communications',
        linked_record_id: rec.id,
        evidence_summary: `Company channel supervision flagged potential diversion to personal number: ${rec.diversion_evidence}. Routed for fair human investigation.`,
      }, { ...ctx, system: true })
    }
  },
}

export function superviseCommunication(
  id: number,
  actionType: 'Supervisor Quality Review' | 'Complaint Investigation' | 'Leave / Exit Ownership Handoff' | 'SLA Escalation Reassignment',
  reason: string,
  newOwnerId: number | null,
  extractTaskTitle: string | null,
  ctx: Ctx,
) {
  assertCan(ctx, 'crm', 'approve')
  const c = getRecord(getDef('communications'), id, ctx)
  if (reason.trim().length < 10) throw bad('Supervisory access requires a documented business reason (at least 10 characters) for the audit log')

  // Gate 10.5: Log supervisory access with role and reason
  createRecord(getDef('supervisor_access_logs'), {
    communication_id: id,
    accessed_by: ctx.user?.id,
    access_role: ctx.user?.role_name || 'Supervisor',
    action_type: actionType,
    reason: reason.trim(),
    accessed_at: nowIso(),
  }, { ...ctx, system: true })

  const patch: Record<string, any> = {}
  if (newOwnerId && newOwnerId !== c.assigned_user_id) {
    patch.previous_owner_id = c.assigned_user_id
    patch.assigned_user_id = newOwnerId
    patch.status = 'Handed Over'
  }
  if (extractTaskTitle && extractTaskTitle.trim()) {
    const t = createRecord(getDef('tasks'), {
      title: extractTaskTitle.trim(),
      kind: 'Follow-up',
      priority: 'High',
      due_date: todayStr(),
      assignee_id: newOwnerId || c.assigned_user_id,
      link_entity: 'communications',
      link_id: id,
      link_label: c.comm_no,
      description: `Follow-up commitment extracted from supervised conversation ${c.comm_no}: ${reason}`,
    }, { ...ctx, system: true })
    patch.followup_task_id = t.id
  }
  const updated = Object.keys(patch).length ? patchRecord(getDef('communications'), id, patch, { ...ctx, system: true }) : c
  recordEnterpriseAudit(ctx, '3.09', '4.07', 'communication.supervised', 'communications', id, `Supervisor ${actionType} logged on ${c.comm_no}`, { reason, newOwnerId })
  return updated
}

export function handleCommunicationOutage(id: number, fallbackNote: string, ctx: Ctx) {
  assertCan(ctx, 'crm', 'edit')
  const c = getRecord(getDef('communications'), id, ctx)
  // Adversarial 7.14: WhatsApp provider outage -> queue retry, service alert, sanctioned alternate communication
  notifyRole('crm', `WhatsApp Provider Outage – Retry Queued (${c.comm_no})`, fallbackNote || 'Messages queued for automatic retry; use sanctioned company email/phone line for urgent client callbacks.', '/whatsapp', 'alert')
  const updated = patchRecord(getDef('communications'), id, {
    delivery_status: 'Provider Outage – Retry Queued',
    escalation_tag: 'Outage Fallback Needed',
    message_summary: `${c.message_summary}\n[Outage Fallback Logged ${nowIso()}]: ${fallbackNote || 'Queued for retry; sanctioned company call/email used.'}`,
  }, { ...ctx, system: true })
  recordEnterpriseAudit(ctx, '3.09', '4.07', 'communication.outage_queued', 'communications', id, `Provider outage handled on ${c.comm_no}; retry queued and fallback logged`)
  return updated
}

export function accessEmployeeLocation(sessionId: number, exceptionReason: string | undefined, ctx: Ctx) {
  assertCan(ctx, 'hr', 'view')
  const s = getRecord(getDef('field_sessions'), sessionId, ctx)
  const now = nowIso().slice(0, 16)
  const withinHours = (s.status === 'Active (On Duty)' || s.status === 'SOS Emergency Active') &&
    (!s.scheduled_start || now >= String(s.scheduled_start).slice(0, 16)) &&
    (!s.scheduled_end || now <= String(s.scheduled_end).slice(0, 16))

  // Adversarial 7.03 (Off-hours GPS access) & Gate 10.5
  if (!withinHours) {
    const hasDocumentedEmergency = !!exceptionReason && exceptionReason.trim().length >= 15
    createRecord(getDef('location_access_logs'), {
      field_session_id: sessionId,
      employee_id: s.employee_id,
      accessed_by: ctx.user?.id,
      accessed_at: nowIso(),
      is_within_work_hours: false,
      access_outcome: hasDocumentedEmergency ? 'Granted – Documented Emergency Exception' : 'Denied – Off Hours Blocked',
      exception_reason: exceptionReason?.trim() || 'Attempted off-hours location lookup without documented emergency exception',
      security_review_required: true,
    }, { ...ctx, system: true })

    createRecord(getDef('compliance_cases'), {
      title: `Off-hours employee GPS location access ${hasDocumentedEmergency ? 'exception' : 'blocked'}: Session ${s.session_no}`,
      case_category: 'Off-Hours GPS Access Alert (7.03)',
      source_type: 'Automated Anomaly Lead',
      severity: 'High',
      subject_user_id: ctx.user?.id,
      linked_entity: 'field_sessions',
      linked_record_id: sessionId,
      evidence_summary: `User ${ctx.user?.name} (#${ctx.user?.id}) requested location for employee #${s.employee_id} outside active duty hours (Session status: ${s.status}). Outcome: ${hasDocumentedEmergency ? 'Granted under emergency exception' : 'Denied'}.`,
    }, { ...ctx, system: true })

    if (!hasDocumentedEmergency) {
      throw forbidden('Privacy & Field Presence Control (3.10 / 7.03): Off-hours or off-duty employee GPS access is denied. Attempt logged and flagged for IT Security review.')
    }
  } else {
    createRecord(getDef('location_access_logs'), {
      field_session_id: sessionId,
      employee_id: s.employee_id,
      accessed_by: ctx.user?.id,
      accessed_at: nowIso(),
      is_within_work_hours: true,
      access_outcome: 'Granted – Active Duty',
      exception_reason: 'Standard active-duty dispatch coordination',
      security_review_required: false,
    }, { ...ctx, system: true })
  }

  return {
    session_no: s.session_no,
    employee_id: s.employee_id,
    status: s.status,
    assigned_location: s.assigned_location,
    last_lat: s.last_lat,
    last_lng: s.last_lng,
    gps_accuracy_m: s.gps_accuracy_m,
    within_work_hours: withinHours,
  }
}

// ============================================================================
// 3.17, 3.32, 4.08, 7.06, 7.10, 7.11 & Gate 10.7 — Commissions, IBAN Swap & 3-Way Segregation
// ============================================================================
export const commissionEntitlementHooks: Hooks = {
  beforeSave({ rec, old, ctx }) {
    const gross = Number(rec.gross_commission || 0)
    const split = Number(rec.split_pct ?? 50)
    const base = Math.round(gross * (split / 100) * 100) / 100
    if (!old) {
      rec.entitlement_amount ??= base
      rec.earned_amount ??= base
      rec.invoiced_amount ??= 0
      rec.collected_amount ??= 0
      rec.clawback_amount ??= 0
      rec.payable_amount ??= 0
      rec.paid_amount ??= 0
    } else if (!ctx.system) {
      // Detect IBAN modification via generic CRUD and trigger 7.06 freeze
      if (rec.payee_iban && rec.payee_iban !== old.payee_iban) {
        rec.iban_changed_before_payout = true
        rec.iban_verified_by_1 = null
        rec.iban_verified_by_2 = null
        rec.status = 'Frozen – IBAN Swap Verification'
      }
    }
  },
}

export function updateCommissionPayeeIban(id: number, newIban: string, ctx: Ctx) {
  assertCan(ctx, 'finance', 'edit')
  const c = getRecord(getDef('commission_entitlements'), id, ctx)
  if (!newIban || newIban.trim().length < 15) throw bad('Provide a valid IBAN')
  // Adversarial 7.06 & Gate 10.7: Bank account swap before payout triggers freeze + out-of-band & 2-person approval
  const updated = patchRecord(getDef('commission_entitlements'), id, {
    payee_iban: newIban.trim(),
    iban_changed_before_payout: true,
    iban_out_of_band_ref: null,
    iban_verified_by_1: null,
    iban_verified_by_2: null,
    status: 'Frozen – IBAN Swap Verification',
  }, { ...ctx, system: true })
  recordEnterpriseAudit(ctx, '3.17', '4.08', 'commission.iban_changed_frozen', 'commission_entitlements', id, `Payee IBAN changed on ${c.entitlement_no}; payout frozen pending out-of-band and two-person verification`, { old_iban: c.payee_iban, new_iban: newIban })
  return updated
}

export function verifyCommissionIban(id: number, outOfBandRef: string, ctx: Ctx) {
  assertCan(ctx, 'finance', 'approve')
  const c = getRecord(getDef('commission_entitlements'), id, ctx)
  if (!c.iban_changed_before_payout) throw bad('No pending IBAN change requires verification')
  if (!outOfBandRef || outOfBandRef.trim().length < 6) throw bad('Record the out-of-band callback verification reference')
  const emp = c.employee_id ? q.get('SELECT user_id FROM employees WHERE id = ?', c.employee_id) : null
  if (emp?.user_id && emp.user_id === ctx.user?.id) {
    throw bad('Gate 10.7: A commission payee can never verify or approve their own bank account change')
  }
  if (!c.iban_verified_by_1) {
    return patchRecord(getDef('commission_entitlements'), id, {
      iban_out_of_band_ref: outOfBandRef.trim(),
      iban_verified_by_1: ctx.user?.id,
    }, { ...ctx, system: true })
  }
  if (c.iban_verified_by_1 === ctx.user?.id) {
    throw bad('Two-Person IBAN Control (7.06): Second IBAN verifier must be a different authorised user from the first verifier')
  }
  const nextStatus = Number(c.collected_amount || 0) > 0 ? 'Eligible for Payout' : 'Earned'
  const updated = patchRecord(getDef('commission_entitlements'), id, {
    iban_out_of_band_ref: outOfBandRef.trim(),
    iban_verified_by_2: ctx.user?.id,
    iban_changed_before_payout: false,
    status: nextStatus,
  }, { ...ctx, system: true })
  recordEnterpriseAudit(ctx, '3.17', '4.08', 'commission.iban_two_person_verified', 'commission_entitlements', id, `Two-person IBAN verification completed for ${c.entitlement_no}`)
  return updated
}

export function recordDeveloperClawback(id: number, clawbackAmount: number, reason: string, ctx: Ctx) {
  assertCan(ctx, 'finance', 'edit')
  const c = getRecord(getDef('commission_entitlements'), id, ctx)
  if (clawbackAmount <= 0 || reason.trim().length < 8) throw bad('Enter a positive clawback amount and audit reason')
  // Adversarial 7.10: Developer commission clawback recalculates entitlement and receivable with audit trail
  const ent = Number(c.entitlement_amount || 0)
  const earned = Math.max(0, ent - clawbackAmount)
  const collected = Number(c.collected_amount || 0)
  const paid = Number(c.paid_amount || 0)
  const payable = Math.max(0, Math.min(earned, collected) - paid)
  const updated = patchRecord(getDef('commission_entitlements'), id, {
    clawback_amount: clawbackAmount,
    earned_amount: earned,
    payable_amount: payable,
    clawback_reason: `${c.clawback_reason || ''}\n[Clawback ${todayStr()} by ${ctx.user?.name}]: AED ${clawbackAmount} – ${reason.trim()}`.trim(),
    status: 'Clawback Adjusted',
  }, { ...ctx, system: true })
  recordEnterpriseAudit(ctx, '3.32', '4.05', 'commission.clawback_recalculated', 'commission_entitlements', id, `Developer commission clawback of AED ${clawbackAmount} applied to ${c.entitlement_no}`, { clawbackAmount, earned, payable, reason })
  return updated
}

export function initiateCommissionPayout(id: number, ctx: Ctx) {
  assertCan(ctx, 'finance', 'edit')
  const c = getRecord(getDef('commission_entitlements'), id, ctx)
  if (c.dispute_status === 'Open Dispute (Payout Blocked)' || c.dispute_status === 'Under Management Arbitration') {
    throw bad('Dispute Gate (3.17): Resolve lead and co-broker disputes before initiating commission payout')
  }
  if (c.iban_changed_before_payout || c.status === 'Frozen – IBAN Swap Verification') {
    throw bad('IBAN Swap Gate (7.06): Payee IBAN was changed; complete out-of-band and two-person IBAN verification before payout')
  }
  if (Number(c.collected_amount || 0) <= 0 || Number(c.payable_amount || 0) <= 0) {
    throw bad('Collection Gate (4.08): Commission must be invoiced and cash-collected before initiating payout')
  }
  const emp = c.employee_id ? q.get('SELECT user_id FROM employees WHERE id = ?', c.employee_id) : null
  if (emp?.user_id && emp.user_id === ctx.user?.id) {
    throw bad('Segregation of Duties (Gate 10.7): A commission payee cannot initiate their own payout')
  }
  const updated = patchRecord(getDef('commission_entitlements'), id, {
    status: 'Eligible for Payout',
    initiated_by: ctx.user?.id,
  }, { ...ctx, system: true })
  recordEnterpriseAudit(ctx, '3.17', '4.08', 'commission.payout_initiated', 'commission_entitlements', id, `Commission payout initiated for ${c.entitlement_no} by ${ctx.user?.name}`)
  return updated
}

export function approveCommissionPayout(id: number, ctx: Ctx) {
  assertCan(ctx, 'finance', 'approve')
  const c = getRecord(getDef('commission_entitlements'), id, ctx)
  if (c.status !== 'Eligible for Payout' && c.status !== 'Clawback Adjusted') {
    throw bad('Commission entitlement must be initiated as Eligible for Payout first')
  }
  if (!c.initiated_by) throw bad('Payout must be initiated by Finance before approval')
  if (c.initiated_by === ctx.user?.id) {
    throw bad('Segregation of Duties (4.08): Payout approver must be independent from the payout initiator')
  }
  const emp = c.employee_id ? q.get('SELECT user_id, manager_id FROM employees WHERE id = ?', c.employee_id) : null
  if (emp?.user_id && emp.user_id === ctx.user?.id) {
    throw bad('Gate 10.7: A commission payee cannot approve their own payment')
  }
  // Adversarial 7.11 (Manager collusion): Manager who arranged the deal or is co-agent cannot approve subordinate payout
  if (c.transaction_id) {
    const txn = q.get('SELECT created_by, primary_agent_id, co_agent_id FROM transactions WHERE id = ?', c.transaction_id)
    const approverAgent = q.get('SELECT id FROM agents WHERE employee_id IN (SELECT id FROM employees WHERE user_id = ?)', ctx.user?.id ?? 0)
    if (txn && (txn.created_by === ctx.user?.id || (approverAgent && (txn.primary_agent_id === approverAgent.id || txn.co_agent_id === approverAgent.id)))) {
      createRecord(getDef('compliance_cases'), {
        title: `Blocked manager collusion / self-interested approval on ${c.entitlement_no}`,
        case_category: 'Fraud / Collusion Lead (3.29)',
        source_type: 'Automated Anomaly Lead',
        severity: 'Critical',
        subject_user_id: ctx.user?.id,
        transaction_id: c.transaction_id,
        linked_entity: 'commission_entitlements',
        linked_record_id: id,
        evidence_summary: `User ${ctx.user?.name} (#${ctx.user?.id}) attempted to approve commission payout ${c.entitlement_no} on a transaction they arranged or participated in.`,
      }, { ...ctx, system: true })
      throw bad('Collusion Control (7.11): A manager or participant who arranged the transaction cannot approve the subordinate payout. Independent authority required.')
    }
  }
  const updated = patchRecord(getDef('commission_entitlements'), id, {
    status: 'Approved for Payout',
    approved_by: ctx.user?.id,
    approved_at: nowIso(),
  }, { ...ctx, system: true })
  recordEnterpriseAudit(ctx, '3.17', '4.08', 'commission.payout_approved', 'commission_entitlements', id, `Commission payout approved for ${c.entitlement_no} by independent approver ${ctx.user?.name}`)
  return updated
}

export function executeCommissionPayout(id: number, bankRef: string, ctx: Ctx) {
  assertCan(ctx, 'finance', 'edit')
  const c = getRecord(getDef('commission_entitlements'), id, ctx)
  if (c.status !== 'Approved for Payout') throw bad('Commission payout must be approved by an independent authority before execution')
  // Control 2 & 4.08: 3-way segregation (initiator != approver != payer)
  if (c.initiated_by === ctx.user?.id || c.approved_by === ctx.user?.id) {
    throw bad('Three-Way Segregation of Duties (Control 2 / 4.08): The treasury executor releasing the payment batch must be distinct from both the initiator and the approver')
  }
  const emp = c.employee_id ? q.get('SELECT user_id FROM employees WHERE id = ?', c.employee_id) : null
  if (emp?.user_id && emp.user_id === ctx.user?.id) {
    throw bad('Gate 10.7: Payee cannot execute their own commission payout')
  }
  const payable = Number(c.payable_amount || 0)
  const updated = patchRecord(getDef('commission_entitlements'), id, {
    paid_amount: Number(c.paid_amount || 0) + payable,
    payable_amount: 0,
    status: 'Paid & Reconciled',
    executed_by: ctx.user?.id,
    executed_at: nowIso(),
    bank_reconciled: true,
    dispute_notes: `${c.dispute_notes || ''}\n[Bank Batch Reconciled: ${bankRef || 'WPS/BANK-BATCH'}]`.trim(),
  }, { ...ctx, system: true })
  recordEnterpriseAudit(ctx, '3.17', '4.08', 'commission.payout_executed', 'commission_entitlements', id, `Commission payout executed and reconciled for ${c.entitlement_no} (Ref: ${bankRef})`)
  return updated
}

// ============================================================================
// 3.29, 3.30, 3.31, 3.33, 4.09, 7.02, 7.12, 7.16 — Complaints, Appeals, DLP & QA
// ============================================================================
export function assignComplianceInvestigator(caseId: number, investigatorId: number, ctx: Ctx) {
  assertCan(ctx, 'compliance', 'edit')
  const c = getRecord(getDef('compliance_cases'), caseId, ctx)
  // Control 4.09: Managers implicated in a complaint must not investigate or decide it
  if (investigatorId === c.implicated_user_id || investigatorId === c.subject_user_id) {
    throw bad('Complaint Independence Control (4.09): A manager or staff member implicated in or subject to a case cannot be assigned to investigate it')
  }
  return patchRecord(getDef('compliance_cases'), caseId, {
    investigator_id: investigatorId,
    status: 'Under Human Investigation',
  }, { ...ctx, system: true })
}

export function decideComplianceCase(caseId: number, findings: string, remedyDecision: string, ctx: Ctx) {
  assertCan(ctx, 'compliance', 'approve')
  const c = getRecord(getDef('compliance_cases'), caseId, ctx)
  if (ctx.user?.id === c.implicated_user_id || ctx.user?.id === c.subject_user_id) {
    throw bad('Complaint Independence Control (4.09): Managers or staff implicated in a case cannot decide it')
  }
  if (findings.trim().length < 10 || remedyDecision.trim().length < 5) {
    throw bad('Record both independent investigation findings and the approved remedy decision')
  }
  const updated = patchRecord(getDef('compliance_cases'), caseId, {
    investigation_findings: findings.trim(),
    remedy_decision: remedyDecision.trim(),
    decided_by: ctx.user?.id,
    decided_at: nowIso(),
    status: 'Remedy / Action Approved',
  }, { ...ctx, system: true })
  recordEnterpriseAudit(ctx, '3.29', '4.09', 'compliance_case.decided', 'compliance_cases', caseId, `Independent decision recorded on ${c.case_no}`)
  return updated
}

export function appealComplianceCase(caseId: number, appealNotes: string, ctx: Ctx) {
  const c = getRecord(getDef('compliance_cases'), caseId, ctx)
  if (appealNotes.trim().length < 10) throw bad('Provide appeal grounds and counter-evidence (at least 10 characters)')
  // Control 3.29 & Adversarial 7.16: Right to appeal automated risk flags or findings
  return patchRecord(getDef('compliance_cases'), caseId, {
    appeal_submitted: true,
    appeal_notes: appealNotes.trim(),
    status: 'Appealed by Subject',
  }, { ...ctx, system: true })
}

export function resolveComplianceAppeal(caseId: number, outcome: 'correct_false_flag' | 'uphold', notes: string, ctx: Ctx) {
  assertCan(ctx, 'compliance', 'approve')
  const c = getRecord(getDef('compliance_cases'), caseId, ctx)
  if (ctx.user?.id === c.decided_by || ctx.user?.id === c.investigator_id || ctx.user?.id === c.implicated_user_id) {
    throw bad('Appeal Review Control (7.16): An appeal must be reviewed by an authority independent of the original investigator and decision-maker')
  }
  const corrected = outcome === 'correct_false_flag'
  const updated = patchRecord(getDef('compliance_cases'), caseId, {
    appeal_decided_by: ctx.user?.id,
    correction_applied: corrected,
    legal_hold: !corrected,
    remedy_decision: `${c.remedy_decision || ''}\n[Appeal Outcome ${nowIso()}]: ${corrected ? 'FALSE FLAG CORRECTED & CLEARED' : 'UPHELD'} – ${notes.trim()}`.trim(),
    status: corrected ? 'Corrected / Cleared (False Positive)' : 'Closed',
  }, { ...ctx, system: true })
  recordEnterpriseAudit(ctx, '3.29', '4.09', `compliance_case.appeal_${outcome}`, 'compliance_cases', caseId, `Appeal on ${c.case_no} resolved as ${outcome}`)
  return updated
}

export function checkBulkExportDlp(entityKey: string, requestedRows: number, ctx: Ctx) {
  // Adversarial 7.12 (Bulk CRM exfiltration) & Module 3.30 (Data Loss & Insider Risk)
  const sensitiveEntities = new Set(['parties', 'contacts', 'leads', 'opportunities', 'employees', 'investors', 'transactions'])
  const isSeparating = q.val<number>(
    `SELECT COUNT(*) FROM hr_lifecycle_cases WHERE user_id = ? AND case_type IN ('Resignation & Standard Offboarding', 'Emergency Separation & Access Removal') AND status <> 'Cancelled' AND deleted_at IS NULL`,
    ctx.user?.id ?? 0,
  ) ?? 0
  if (sensitiveEntities.has(entityKey) && (requestedRows > 50 || isSeparating > 0)) {
    const c = createRecord(getDef('compliance_cases'), {
      title: `DLP Alert: Bulk CRM / sensitive export blocked (${entityKey}, ${requestedRows} rows)`,
      case_category: 'Bulk Export / DLP Alert (3.30)',
      source_type: 'Automated Anomaly Lead',
      severity: 'Critical',
      subject_user_id: ctx.user?.id,
      linked_entity: entityKey,
      legal_hold: true,
      evidence_summary: `User ${ctx.user?.name} (#${ctx.user?.id}) attempted bulk export of ${requestedRows} rows from "${entityKey}"${isSeparating ? ' while in separation/offboarding workflow' : ''}. Export blocked and evidence preserved.`,
    }, { ...ctx, system: true })
    notifyRole('admin', `DLP Security Alert (${c.case_no})`, `Blocked bulk export of ${requestedRows} ${entityKey} records by ${ctx.user?.name}`, `/e/compliance_cases/${c.id}`, 'alert')
    throw forbidden(`DLP & Insider Risk Control (3.30 / 7.12): Bulk export of ${requestedRows} records from "${entityKey}" is restricted. Security alert ${c.case_no} has been logged.`)
  }
  return { allowed: true, watermarked: true, watermark: `CONFIDENTIAL • SWK PROPERTIES OS • EXPORTED BY ${ctx.user?.email || 'STAFF'} AT ${nowIso()}` }
}

export function disputeViewingAttendance(viewingId: number, clientStatement: string, ctx: Ctx) {
  assertCan(ctx, 'mandates', 'edit')
  const v = getRecord(getDef('viewings'), viewingId, ctx)
  // Adversarial 7.02 (Invented viewing): Cross-check appointment & field presence evidence; route for human review
  const fieldEvidence = q.get('SELECT * FROM field_sessions WHERE viewing_id = ? AND deleted_at IS NULL', viewingId)
  const attEvidence = q.get('SELECT * FROM attendance_events WHERE viewing_id = ? AND deleted_at IS NULL', viewingId)
  const c = createRecord(getDef('compliance_cases'), {
    title: `Disputed viewing attendance review: ${v.viewing_no}`,
    case_category: 'Invented Viewing Dispute (7.02)',
    source_type: 'Client Complaint',
    severity: 'High',
    property_id: v.property_id,
    linked_entity: 'viewings',
    linked_record_id: viewingId,
    evidence_summary: `Customer disputed attendance for viewing ${v.viewing_no} ("${clientStatement}"). Cross-check: Field Session=${fieldEvidence ? fieldEvidence.session_no : 'NONE'}, Attendance Check-in=${attEvidence ? attEvidence.event_no : 'NONE'}. Routed for independent human review.`,
  }, { ...ctx, system: true })
  return { viewing_no: v.viewing_no, case_no: c.case_no, case_id: c.id, field_evidence_present: !!fieldEvidence, attendance_checkin_present: !!attEvidence }
}

export function reassignProtectedLead(leadId: number, toUserId: number, mode: string, reason: string, ctx: Ctx) {
  assertCan(ctx, 'crm', 'approve')
  const l = getRecord(getDef('leads'), leadId, ctx)
  if (!toUserId) throw bad('Select the target agent/user for lead reassignment')
  if (reason.trim().length < 5) throw bad('Provide a reason for lead reassignment')
  const log = createRecord(getDef('lead_assignment_logs'), {
    lead_id: leadId,
    from_user_id: l.owner_id ?? null,
    to_user_id: toUserId,
    assignment_mode: mode || 'Approved Manager Reassignment',
    reason: reason.trim(),
    approved_by: ctx.user?.id,
    sla_response_due_at: nowIso(),
    assigned_at: nowIso(),
  }, { ...ctx, system: true })
  patchRecord(getDef('leads'), leadId, { owner_id: toUserId }, { ...ctx, system: true })
  recordEnterpriseAudit(ctx, '3.31', '4.04', 'lead.reassigned', 'leads', leadId, `Lead ${l.lead_no} reassigned to user #${toUserId} (${mode})`, { log_id: log.id, reason })
  return log
}

export function challengeQaReview(qaId: number, challengeReason: string, ctx: Ctx) {
  const qRev = getRecord(getDef('qa_reviews'), qaId, ctx)
  if (challengeReason.trim().length < 10) throw bad('Provide detailed grounds for challenging the QA assessment (at least 10 characters)')
  return patchRecord(getDef('qa_reviews'), qaId, {
    broker_challenged: true,
    challenge_reason: challengeReason.trim(),
    status: 'Challenged by Broker',
  }, { ...ctx, system: true })
}

export function resolveQaChallenge(qaId: number, decision: 'uphold' | 'adjust', adjustedScore: number | null, notes: string, ctx: Ctx) {
  assertCan(ctx, 'support', 'approve')
  const qRev = getRecord(getDef('qa_reviews'), qaId, ctx)
  if (qRev.reviewer_id === ctx.user?.id) throw bad('Manager sign-off on a challenged QA assessment must be independent of the original QA reviewer')
  const patch: Record<string, any> = {
    status: decision === 'adjust' ? 'Adjusted after Challenge' : 'Upheld by Manager',
    manager_final_signoff_by: ctx.user?.id,
    signed_off_at: nowIso(),
    coaching_plan: `${qRev.coaching_plan || ''}\n[Manager Sign-Off ${todayStr()}]: ${notes.trim()}`.trim(),
  }
  if (decision === 'adjust' && adjustedScore !== null) {
    patch.overall_score = adjustedScore
  }
  return patchRecord(getDef('qa_reviews'), qaId, patch, { ...ctx, system: true })
}

// ============================================================================
// 3.26 & 4.10 — Employee Separation / Emergency Removal & Portfolio Handover
// ============================================================================
export function executeEmployeeSeparation(lifecycleId: number, handoverToUserId: number, ctx: Ctx) {
  assertCan(ctx, 'hr', 'approve')
  const lc = getRecord(getDef('hr_lifecycle_cases'), lifecycleId, ctx)
  if (!handoverToUserId) throw bad('Specify a receiving staff user (handover_to_user_id) to reassign leads, WhatsApp conversations, viewings and NOC tasks')
  const targetUserId = lc.user_id || (lc.employee_id ? q.val<number>('SELECT user_id FROM employees WHERE id = ?', lc.employee_id) : null)
  if (targetUserId && targetUserId === handoverToUserId) throw bad('Handover recipient must be a different active staff member')

  let leadsCount = 0, waCount = 0, viewingsCount = 0, nocTasksCount = 0

  if (targetUserId) {
    // 1. Disable user account and revoke all active sessions & API keys (Gate 10.8)
    q.run('UPDATE users SET active = 0, updated_at = ? WHERE id = ?', nowIso(), targetUserId)
    q.run('DELETE FROM sessions WHERE user_id = ?', targetUserId)
    q.run('UPDATE api_keys SET active = 0 WHERE user_id = ?', targetUserId)

    // 2. Reassign open leads & log lead_assignment_logs (preserve full customer history — no erasure)
    const openLeads = q.all(`SELECT id, lead_no FROM leads WHERE owner_id = ? AND status NOT IN ('Converted', 'Unqualified') AND deleted_at IS NULL`, targetUserId)
    for (const l of openLeads) {
      q.run('UPDATE leads SET owner_id = ?, updated_at = ? WHERE id = ?', handoverToUserId, nowIso(), l.id)
      createRecord(getDef('lead_assignment_logs'), {
        lead_id: l.id,
        from_user_id: targetUserId,
        to_user_id: handoverToUserId,
        assignment_mode: 'Employee Separation / Leave Handover',
        reason: `Automated separation handover (${lc.lifecycle_no})`,
        approved_by: ctx.user?.id,
        assigned_at: nowIso(),
      }, { ...ctx, system: true })
      leadsCount++
    }

    // 3. Reassign supervised WhatsApp / communication threads
    const openComms = q.all(`SELECT id FROM communications WHERE assigned_user_id = ? AND status <> 'Closed' AND deleted_at IS NULL`, targetUserId)
    for (const cm of openComms) {
      q.run(`UPDATE communications SET previous_owner_id = ?, assigned_user_id = ?, status = 'Handed Over', updated_at = ? WHERE id = ?`, targetUserId, handoverToUserId, nowIso(), cm.id)
      createRecord(getDef('supervisor_access_logs'), {
        communication_id: cm.id,
        accessed_by: ctx.user?.id,
        access_role: ctx.user?.role_name || 'HR / Admin',
        action_type: 'Leave / Exit Ownership Handoff',
        reason: `Employee separation handover (${lc.lifecycle_no}) to user #${handoverToUserId}`,
        accessed_at: nowIso(),
      }, { ...ctx, system: true })
      waCount++
    }

    // 4. Reassign open tasks & NOC coordination items
    nocTasksCount = q.run(`UPDATE tasks SET assignee_id = ?, updated_at = ? WHERE assignee_id = ? AND status <> 'Done' AND deleted_at IS NULL`, handoverToUserId, nowIso(), targetUserId).changes
  }

  if (lc.employee_id) {
    patchRecord(getDef('employees'), lc.employee_id, { status: 'Resigned' }, { ...ctx, system: true })
    const agt = q.get('SELECT id FROM agents WHERE employee_id = ? AND deleted_at IS NULL', lc.employee_id)
    const receivingAgt = q.get('SELECT id FROM agents WHERE employee_id IN (SELECT id FROM employees WHERE user_id = ?) AND deleted_at IS NULL', handoverToUserId)
    if (agt) {
      patchRecord(getDef('agents'), agt.id, { status: 'Resigned' }, { ...ctx, system: true })
      q.run(`UPDATE agent_authorisations SET status = 'Exited', updated_at = ? WHERE agent_id = ?`, nowIso(), agt.id)
      if (receivingAgt) {
        viewingsCount = q.run(`UPDATE viewings SET agent_id = ?, updated_at = ? WHERE agent_id = ? AND status IN ('Scheduled', 'Confirmed') AND deleted_at IS NULL`, receivingAgt.id, nowIso(), agt.id).changes
      }
    }
  }

  const updated = patchRecord(getDef('hr_lifecycle_cases'), lifecycleId, {
    handover_to_user_id: handoverToUserId,
    accounts_disabled: true,
    sessions_revoked: true,
    leads_reassigned_count: leadsCount,
    whatsapp_reassigned_count: waCount,
    viewings_reassigned_count: viewingsCount,
    noc_tasks_reassigned_count: nocTasksCount,
    legal_hold_preserved: true,
    approved_by: ctx.user?.id,
    approved_at: nowIso(),
    status: 'Accounts Revoked & Portfolio Reassigned',
  }, { ...ctx, system: true })
  recordEnterpriseAudit(ctx, '3.26', '4.10', 'hr.separation_executed', 'hr_lifecycle_cases', lifecycleId, `Separation executed for ${lc.lifecycle_no}: accounts disabled, sessions revoked, ${leadsCount} leads & ${waCount} comms reassigned, history preserved`)
  return updated
}

// ============================================================================
// 3.27 — Universal Task & Approval Engine (Four-Eyes & Delegation)
// ============================================================================
export function decideUniversalApproval(id: number, decision: 'approve' | 'reject' | 'return', comments: string, ctx: Ctx) {
  assertCan(ctx, 'projects', 'approve')
  const a = getRecord(getDef('universal_approvals'), id, ctx)
  if (a.requester_id === ctx.user?.id) throw bad('Maker-Checker Control (3.27): Requester cannot approve their own approval request')
  if (comments.trim().length < 5) throw bad('Provide approval/rejection comments (at least 5 characters)')

  if (decision === 'reject' || decision === 'return') {
    return patchRecord(getDef('universal_approvals'), id, {
      status: decision === 'reject' ? 'Rejected' : 'Returned for Resubmission',
      decision_comments: `${a.decision_comments || ''}\n[${decision.toUpperCase()} by ${ctx.user?.name} at ${nowIso()}]: ${comments.trim()}`.trim(),
    }, { ...ctx, system: true })
  }

  if (a.status === 'Pending Step 1') {
    const needsStep2 = a.approval_mode === 'Four-Eyes Sequential' || a.risk_level !== 'Standard'
    return patchRecord(getDef('universal_approvals'), id, {
      step1_decided_by: ctx.user?.id,
      step1_decided_at: nowIso(),
      status: needsStep2 ? 'Pending Step 2 (Four-Eyes)' : 'Approved',
      decision_comments: `${a.decision_comments || ''}\n[Step 1 Approved by ${ctx.user?.name} at ${nowIso()}]: ${comments.trim()}`.trim(),
    }, { ...ctx, system: true })
  }

  if (a.status === 'Pending Step 2 (Four-Eyes)') {
    if (a.step1_decided_by === ctx.user?.id) {
      throw bad('Four-Eyes Control (3.27): Step 2 approver must be a different authorised user from the Step 1 approver')
    }
    return patchRecord(getDef('universal_approvals'), id, {
      step2_decided_by: ctx.user?.id,
      step2_decided_at: nowIso(),
      status: 'Approved',
      decision_comments: `${a.decision_comments || ''}\n[Step 2 Four-Eyes Approved by ${ctx.user?.name} at ${nowIso()}]: ${comments.trim()}`.trim(),
    }, { ...ctx, system: true })
  }

  throw bad(`Approval ${a.approval_no} is already in status "${a.status}"`)
}

// ============================================================================
// 3.28, Section 3, Section 8 & Section 10 — CEO Command Centre & 35-Module Matrix
// ============================================================================
export const ENTERPRISE_MODULE_CATALOGUE = [
  { code: '3.01', name: 'Corporate Governance', owner: 'CEO/COO', priority: 'P0', entity: 'corporate_governance_items', route: '/enterprise/master-os?tab=governance' },
  { code: '3.02', name: 'Employee 360 & HR', owner: 'HR', priority: 'P0', entity: 'employees', route: '/e/employees' },
  { code: '3.03', name: 'Visa, Immigration & PRO', owner: 'HR/PRO', priority: 'P0', entity: 'immigration_cases', route: '/enterprise/master-os?tab=pro' },
  { code: '3.04', name: 'Broker Licensing & Agent Lifecycle', owner: 'Compliance/Sales', priority: 'P0', entity: 'agent_authorisations', route: '/enterprise/master-os?tab=agents' },
  { code: '3.05', name: 'Attendance, Leave & Field Duty', owner: 'HR/Operations', priority: 'P1', entity: 'attendance_events', route: '/enterprise/master-os?tab=field' },
  { code: '3.06', name: 'Daily Staff Accountability', owner: 'Line Managers', priority: 'P0', entity: 'daily_reports', route: '/enterprise/master-os?tab=accountability' },
  { code: '3.07', name: 'Daily Inventory Acquisition', owner: 'Listings Manager', priority: 'P0', entity: 'inventory_submissions', route: '/enterprise/master-os?tab=inventory' },
  { code: '3.08', name: 'Developer NOC & Clearance', owner: 'Transactions Manager', priority: 'P0', entity: 'developer_requests', route: '/enterprise/master-os?tab=noc' },
  { code: '3.09', name: 'WhatsApp Business Supervision', owner: 'Communications Manager', priority: 'P0', entity: 'communications', route: '/enterprise/master-os?tab=comms' },
  { code: '3.10', name: 'Work-hours Field Presence', owner: 'Operations/Privacy', priority: 'P1', entity: 'field_sessions', route: '/enterprise/master-os?tab=field' },
  { code: '3.11', name: 'CRM & Lead Ownership', owner: 'Head of Sales', priority: 'P0', entity: 'leads', route: '/pipeline' },
  { code: '3.12', name: 'Property Inventory & Listings', owner: 'Listings Manager', priority: 'P0', entity: 'listing_mandates', route: '/listings-studio' },
  { code: '3.13', name: 'Secondary Sales Transactions', owner: 'Transactions Manager', priority: 'P0', entity: 'transactions', route: '/enterprise/master-os?tab=transactions' },
  { code: '3.14', name: 'Off-plan & Developers', owner: 'Head of Off-plan', priority: 'P0', entity: 'developers', route: '/off-plan' },
  { code: '3.15', name: 'Leasing & Tenancies', owner: 'Leasing Manager', priority: 'P1', entity: 'leases', route: '/e/leases' },
  { code: '3.16', name: 'Property Management', owner: 'Property Manager', priority: 'Conditional', entity: 'handovers', route: '/owner-360' },
  { code: '3.17', name: 'Commissions & Disputes', owner: 'Finance/Sales', priority: 'P0', entity: 'commission_entitlements', route: '/enterprise/master-os?tab=commissions' },
  { code: '3.18', name: 'Payroll & Benefits', owner: 'HR/Finance', priority: 'P0', entity: 'payslips', route: '/hr/wps' },
  { code: '3.19', name: 'Accounting & Treasury', owner: 'Finance Controller', priority: 'P0', entity: 'journal_entries', route: '/finance/bank-recon' },
  { code: '3.20', name: 'Legal, AML/KYC & Licensing', owner: 'Compliance Officer', priority: 'P0', entity: 'kyc_checks', route: '/rera' },
  { code: '3.21', name: 'Document Vault & E-signatures', owner: 'Legal/Operations', priority: 'P0', entity: 'studio_documents', route: '/studio' },
  { code: '3.22', name: 'AI Voice Receptionist & Call Centre', owner: 'Communications Manager', priority: 'P1', entity: 'voice_calls', route: '/ai' },
  { code: '3.23', name: 'Marketing & Growth Attribution', owner: 'Marketing Manager', priority: 'P1', entity: 'campaigns', route: '/e/campaigns' },
  { code: '3.24', name: 'Customer / Investor Portals', owner: 'Customer Service', priority: 'P1', entity: 'owner_statements', route: '/owner-360' },
  { code: '3.25', name: 'Procurement, Assets & Facilities', owner: 'Administration/Finance', priority: 'P1', entity: 'procurement_requests', route: '/e/procurement_requests' },
  { code: '3.26', name: 'Recruitment & Offboarding', owner: 'HR/IT', priority: 'P1', entity: 'hr_lifecycle_cases', route: '/enterprise/master-os?tab=hr' },
  { code: '3.27', name: 'Universal Task & Approval Engine', owner: 'COO/IT', priority: 'P0', entity: 'universal_approvals', route: '/enterprise/master-os?tab=approvals' },
  { code: '3.28', name: 'CEO & Department Command Centres', owner: 'CEO/COO', priority: 'P0', entity: 'audit_events', route: '/enterprise/master-os' },
  { code: '3.29', name: 'Fraud & Collusion Detection', owner: 'Risk/Compliance', priority: 'P0', entity: 'compliance_cases', route: '/enterprise/master-os?tab=risk' },
  { code: '3.30', name: 'Data Loss & Insider Risk', owner: 'IT Security', priority: 'P0', entity: 'compliance_cases', route: '/enterprise/master-os?tab=risk' },
  { code: '3.31', name: 'Lead Ownership Protection', owner: 'Sales Operations', priority: 'P0', entity: 'lead_assignment_logs', route: '/e/lead_assignment_logs' },
  { code: '3.32', name: 'Developer Commission Assurance', owner: 'Finance/Off-plan', priority: 'P1', entity: 'commission_entitlements', route: '/enterprise/master-os?tab=commissions' },
  { code: '3.33', name: 'Quality Assurance & Client Reviews', owner: 'Customer Experience', priority: 'P1', entity: 'qa_reviews', route: '/enterprise/master-os?tab=risk' },
  { code: '3.34', name: 'AI Functional Agents', owner: 'AI Product Owner', priority: 'P2', entity: 'ai_agents', route: '/ai' },
  { code: '3.35', name: 'Infrastructure, Cybersecurity & DR', owner: 'IT Lead', priority: 'P0', entity: 'dr_exercises', route: '/enterprise/master-os?tab=dr' },
]

export function getEnterpriseCommandCentre(ctx: Ctx) {
  assertCan(ctx, 'dashboard', 'view')
  const today = todayStr()
  const count = (table: string, where = 'deleted_at IS NULL', ...args: any[]) => q.val<number>(`SELECT COUNT(*) FROM ${table} WHERE ${where}`, ...args) ?? 0
  const sumMoney = (table: string, col: string, where = 'deleted_at IS NULL', ...args: any[]) => fromCents(q.val<number>(`SELECT COALESCE(SUM(${col}), 0) FROM ${table} WHERE ${where}`, ...args) ?? 0)

  const kpis = {
    people: {
      active_employees: count('employees', `status = 'Active' AND deleted_at IS NULL`),
      authorised_brokers: count('agent_authorisations', `status = 'Authorised' AND deleted_at IS NULL`),
      open_pro_cases: count('immigration_cases', `status NOT IN ('Completed', 'Cancelled') AND deleted_at IS NULL`),
      delayed_pro_cases: count('immigration_cases', `is_delayed = 1 AND deleted_at IS NULL`),
      daily_reports_today: count('daily_reports', `report_date = ? AND deleted_at IS NULL`, today),
      active_field_sessions: count('field_sessions', `status = 'Active (On Duty)' AND deleted_at IS NULL`),
    },
    inventory: {
      submissions_total: count('inventory_submissions'),
      verified_stock: count('properties', `status IN ('Available', 'Off-Plan') AND active = 1 AND deleted_at IS NULL`),
      active_listing_mandates: count('listing_mandates', `status = 'Verified & Active' AND deleted_at IS NULL`),
      duplicate_conflicts_held: count('inventory_submissions', `status = 'Duplicate / Conflict Hold' AND deleted_at IS NULL`),
    },
    crm: {
      total_leads: count('leads'),
      open_opportunities: count('opportunities', `stage NOT IN ('Won', 'Lost') AND deleted_at IS NULL`),
      pipeline_value_aed: sumMoney('opportunities', 'value', `stage NOT IN ('Won', 'Lost') AND deleted_at IS NULL`),
      protected_assignment_logs: count('lead_assignment_logs'),
    },
    transactions: {
      active_transactions: count('transactions', `stage NOT IN ('Closed', 'Cancelled') AND deleted_at IS NULL`),
      on_hold_exceptions: count('transactions', `stage = 'On Hold – Exception Active' AND deleted_at IS NULL`),
      verified_nocs: count('developer_requests', `status = 'Verified & Valid (Closing Unlocked)' AND deleted_at IS NULL`),
      pending_nocs: count('developer_requests', `status NOT IN ('Verified & Valid (Closing Unlocked)', 'Rejected', 'Expired') AND deleted_at IS NULL`),
    },
    finance: {
      revenue_invoiced_aed: sumMoney('invoices', 'total', `status IN ('Posted', 'Partially paid', 'Paid') AND deleted_at IS NULL`),
      cash_collected_aed: Math.max(
        sumMoney('receipts', 'amount', `status <> 'Void' AND deleted_at IS NULL`),
        sumMoney('transactions', 'collected_commission', `deleted_at IS NULL`),
      ),
      commission_earned_aed: sumMoney('commission_entitlements', 'earned_amount'),
      commission_payable_aed: sumMoney('commission_entitlements', 'payable_amount'),
      commission_paid_aed: sumMoney('commission_entitlements', 'paid_amount'),
    },
    comms: {
      supervised_threads: count('communications'),
      voice_calls_logged: count('voice_calls'),
      diversion_flags: count('communications', `diversion_flag = 1 AND deleted_at IS NULL`),
      supervisor_audit_logs: count('supervisor_access_logs'),
    },
    risk_and_it: {
      open_compliance_cases: count('compliance_cases', `status NOT IN ('Closed', 'Corrected / Cleared (False Positive)') AND deleted_at IS NULL`),
      pending_universal_approvals: count('universal_approvals', `status LIKE 'Pending%' AND deleted_at IS NULL`),
      qa_reviews_completed: count('qa_reviews'),
      dr_exercises_passed: count('dr_exercises', `status LIKE 'Passed%' AND deleted_at IS NULL`),
    },
  }

  const modules = ENTERPRISE_MODULE_CATALOGUE.map(m => ({
    ...m,
    records: count(m.entity),
    status: 'Live & Enforced',
  }))

  return {
    generated_at: nowIso(),
    modules_active: modules.length,
    kpis,
    modules,
    module_catalogue: modules,
    departments: {
      executive: {
        active_pipeline_value: kpis.crm.pipeline_value_aed + sumMoney('transactions', 'deal_value', `stage NOT IN ('Closed', 'Cancelled') AND deleted_at IS NULL`),
        collected_revenue_total: kpis.finance.cash_collected_aed,
        pending_universal_approvals: kpis.risk_and_it.pending_universal_approvals,
        open_compliance_cases: kpis.risk_and_it.open_compliance_cases,
      },
      sales_and_leasing: {
        enterprise_transactions_open: kpis.transactions.active_transactions,
        whatsapp_diversion_flags: kpis.comms.diversion_flags,
      },
      inventory_and_listings: {
        verified_mandates: kpis.inventory.active_listing_mandates,
        duplicate_conflicts_held: kpis.inventory.duplicate_conflicts_held,
      },
      developer_noc_and_conveyancing: {
        nocs_verified_unlocked: kpis.transactions.verified_nocs,
        nocs_fraud_or_unverified_held: count('developer_requests', `status = 'Held – Fraud / Unverified Escalation' AND deleted_at IS NULL`),
      },
      hr_pro_and_accountability: {
        daily_reports_submitted_today: kpis.people.daily_reports_today,
        authorised_brokers: kpis.people.authorised_brokers,
        expired_broker_credentials: count('agent_authorisations', `status = 'Restricted – Credential Expired' AND deleted_at IS NULL`),
        open_immigration_cases: kpis.people.open_pro_cases,
        delayed_immigration_cases: kpis.people.delayed_pro_cases,
      },
      finance_and_commissions: {
        commission_payable_total: kpis.finance.commission_payable_aed,
        commission_paid_total: kpis.finance.commission_paid_aed,
      },
      compliance_risk_and_qa: {
        verified_dr_exercises: kpis.risk_and_it.dr_exercises_passed,
      },
    },
  }
}
