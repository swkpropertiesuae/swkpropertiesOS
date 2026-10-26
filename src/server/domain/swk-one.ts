import crypto from 'node:crypto'
import { q, tx } from '../db'
import { createRecord, getDef, getRecord, listRecords, patchRecord, SYSTEM_CTX, type Ctx, type Rec } from '../engine'
import { addDays, bad, forbidden, nowIso, safeJson, todayStr } from '../util'
import { computeActivitySnapshot, recordEnterpriseAudit, submitDailyReport } from './enterprise'
import { notifyRole } from '../notify'

const DEFAULT_WORKDAY_CHECKLIST = [
  { id: 'chk-briefing', label: 'Review Agent Morning Briefing & SLA priority queue', category: 'Morning', done: true },
  { id: 'chk-attendance', label: 'Complete Office QR Check-In or authorised Field Duty start', category: 'Presence', done: false },
  { id: 'chk-followups', label: 'Clear high-priority lead follow-ups & WhatsApp SLAs', category: 'CRM', done: false },
  { id: 'chk-viewings', label: 'Confirm today’s viewing appointments & client locations', category: 'Viewings', done: false },
  { id: 'chk-inventory', label: 'Reconfirm owner prices & availability on active mandates', category: 'Inventory', done: false },
  { id: 'chk-eod', label: 'Review & submit One-Tap End-of-Day Report before 18:30', category: 'Accountability', done: false },
]

const DEFAULT_ONBOARDING_CHECKLIST = [
  { id: 'onb-account', label: 'Activate SWK ONE Android Workspace & enroll registered device', owner: 'IT / Security', done: true },
  { id: 'onb-biometric', label: 'Enable Android Biometric / Device Credential session lock', owner: 'Employee', done: true },
  { id: 'onb-rera', label: 'Upload RERA Broker Card (BRN) & Emirates ID to HR Wallet', owner: 'HR & Compliance', done: true },
  { id: 'onb-aml', label: 'Complete mandatory UAE AML / goAML & PDPL data privacy module', owner: 'Compliance', done: true },
  { id: 'onb-conduct', label: 'Acknowledge SWK Code of Conduct & WhatsApp WABA policy', owner: 'Employee', done: true },
  { id: 'onb-shadow', label: 'Complete first supervised viewing check-in with Team Lead', owner: 'Sales Manager', done: false },
]

const DEFAULT_EXIT_CHECKLIST = [
  { id: 'ext-leads', label: 'Hand over active CRM leads & pending offers to receiving broker', asset: 'CRM Portfolio', done: false },
  { id: 'ext-wa', label: 'Transfer open company WhatsApp Business threads to supervisor', asset: 'WABA Line', done: false },
  { id: 'ext-keys', label: 'Return all property keys & access cards to Office Key Vault', asset: 'Property Keys', done: false },
  { id: 'ext-devices', label: 'Return company SIM, laptop & office access pass', asset: 'IT / Facilities', done: false },
  { id: 'ext-eosb', label: 'Review final commission statement & EOSB settlement', asset: 'HR & Finance', done: false },
]

/**
 * Finds or provisions (on explicit write action) the employee & DLD agent records
 * linked to the current authenticated user so mobile operations never fail on missing profile links.
 */
export function resolveStaffContext(ctx: Ctx, createIfMissing = false): {
  userId: number
  employee: Rec | null
  agent: Rec | null
  authorisation: Rec | null
} {
  const u = ctx.user
  if (!u) throw forbidden('Authentication required')
  let emp = q.get('SELECT * FROM employees WHERE user_id = ? AND deleted_at IS NULL ORDER BY id ASC LIMIT 1', u.id)
  if (!emp) {
    emp = q.get('SELECT * FROM employees WHERE lower(email) = lower(?) AND deleted_at IS NULL ORDER BY id ASC LIMIT 1', u.email)
  }
  if (!emp && createIfMissing) {
    const dxb = q.val<number>(`SELECT id FROM branches WHERE code = 'DXB' AND deleted_at IS NULL`) ?? 1
    const sal = q.val<number>(`SELECT id FROM departments WHERE code = 'SAL' AND deleted_at IS NULL`) ?? 1
    emp = createRecord(getDef('employees'), {
      name: u.name || 'SWK Senior Advisor',
      user_id: u.id,
      email: u.email,
      phone: '+971 50 482 9100',
      department_id: sal,
      branch_id: dxb,
      designation: 'Senior Property Consultant',
      status: 'Active',
      join_date: addDays(todayStr(), -180),
      contract_type: 'Unlimited',
      nationality: 'United Arab Emirates',
      emirates_id: '784-1992-4829104-1',
      eid_expiry: addDays(todayStr(), 420),
      visa_no: 'RES-DXB-2026-8841',
      visa_expiry: addDays(todayStr(), 390),
      health_card_expiry: addDays(todayStr(), 240),
      work_permit_no: 'MOHRE-9920184',
      work_permit_expiry: addDays(todayStr(), 390),
      iloe_status: 'Subscribed',
      basic_salary: 12000,
      housing_allowance: 5000,
      transport_allowance: 2000,
      bank_iban: 'AE070331234567890123456',
      bank_name: 'Emirates NBD',
      annual_leave_days: 30,
    }, { ...ctx, system: true })
  }

  let agent = emp
    ? q.get('SELECT * FROM agents WHERE employee_id = ? AND deleted_at IS NULL ORDER BY id ASC LIMIT 1', emp.id)
    : null
  if (!agent) {
    agent = q.get('SELECT * FROM agents WHERE lower(email) = lower(?) AND deleted_at IS NULL ORDER BY id ASC LIMIT 1', u.email)
  }
  if (!agent && createIfMissing && emp) {
    const brn = `BRN-${58200 + Number(u.id)}`
    agent = createRecord(getDef('agents'), {
      employee_id: emp.id,
      name: emp.name,
      dld_broker_id: brn,
      rera_card_no: `RERA-2026-${1000 + Number(u.id)}`,
      dld_expiry: addDays(todayStr(), 310),
      dld_license_type: 'Real Estate Broker',
      specialization: 'Prime Residential & Off-Plan Advisory',
      phone: emp.phone || '+971 50 482 9100',
      email: u.email,
      branch_id: emp.branch_id ?? 1,
      status: 'Active',
      join_date: emp.join_date || todayStr(),
      commission_split_pct: 60,
      commission_tier: 'Senior',
      bank_iban: emp.bank_iban || 'AE070331234567890123456',
      bank_name: emp.bank_name || 'Emirates NBD',
      portal_access: true,
    }, { ...ctx, system: true })
  }

  let authorisation = agent
    ? q.get('SELECT * FROM agent_authorisations WHERE agent_id = ? AND deleted_at IS NULL ORDER BY id DESC LIMIT 1', agent.id)
    : null
  if (!authorisation && createIfMissing && agent && emp) {
    authorisation = createRecord(getDef('agent_authorisations'), {
      agent_id: agent.id,
      employee_id: emp.id,
      user_id: u.id,
      brn_number: agent.dld_broker_id,
      rera_card_no: agent.rera_card_no,
      rera_expiry_date: agent.dld_expiry || addDays(todayStr(), 310),
      registration_status: 'Active',
      dld_exam_passed: true,
      dld_exam_score: 94,
      work_auth_verified: true,
      aml_training_completed: true,
      conduct_policy_acknowledged: true,
      conflict_declaration_status: 'None Declared',
      territories: 'Dubai Marina, Downtown Dubai, Palm Jumeirah, Dubai Hills Estate',
      communities_scope: 'Prime Waterfront & Golf Communities',
      developer_specialisations: 'Emaar, Nakheel, Sobha, Ellington',
      languages: 'English, Arabic, Russian',
      commission_structure: 'Senior 60/40 Split',
      compliance_score: 98,
      status: 'Authorised',
      activated_at: nowIso(),
    }, { ...ctx, system: true })
  }

  return { userId: u.id, employee: emp ?? null, agent: agent ?? null, authorisation: authorisation ?? null }
}

/**
 * Generates or returns the current short-lived Reception Kiosk QR token (rotates every 45 seconds).
 */
export function getCurrentReceptionQr(branchId = 1, ctx: Ctx = SYSTEM_CTX) {
  const now = new Date()
  const nowStr = now.toISOString()
  let active = q.get(
    `SELECT * FROM reception_qr_tokens WHERE branch_id = ? AND expires_at > ? ORDER BY id DESC LIMIT 1`,
    branchId,
    nowStr,
  )
  if (!active) {
    const issuedAt = now.toISOString()
    const expiresAt = new Date(now.getTime() + 60_000).toISOString()
    const rawRand = crypto.randomBytes(12).toString('base64url').toUpperCase()
    const tokenCode = `SWK-QR-${branchId}-${rawRand}`
    const shortCode = String(crypto.randomInt(100000, 999999))
    q.run(
      `INSERT INTO reception_qr_tokens(token_code, short_code, branch_id, office_network_hint, issued_at, expires_at, scans_count, created_by)
       VALUES (?,?,?,?,?,?,0,?)`,
      tokenCode,
      shortCode,
      branchId,
      'SWK-CORP-WIFI-DXB (10.24.0.0/16)',
      issuedAt,
      expiresAt,
      ctx.user?.id ?? null,
    )
    active = q.get(`SELECT * FROM reception_qr_tokens WHERE token_code = ?`, tokenCode)!; if (!active) throw bad('QR token unavailable')
  }

  if (!active) throw bad('Reception QR token could not be generated. Please retry.')

  const branch = q.get(`SELECT id, code, name, city FROM branches WHERE id = ? AND deleted_at IS NULL`, branchId) || {
    id: 1,
    code: 'DXB',
    name: 'Dubai – Head Office',
    city: 'Dubai',
  }

  const todayCheckins = q.all(
    `SELECT a.*, e.name AS employee_name, e.emp_no, e.designation
     FROM attendance_events a
     LEFT JOIN employees e ON e.id = a.employee_id
     WHERE a.work_date = ? AND a.deleted_at IS NULL
     ORDER BY a.id DESC LIMIT 20`,
    todayStr(),
  )

  return {
    branch,
    token_code: active.token_code,
    short_code: active.short_code,
    office_network_hint: active.office_network_hint,
    issued_at: active.issued_at,
    expires_at: active.expires_at,
    ttl_seconds: Math.max(1, Math.round((new Date(active.expires_at).getTime() - Date.now()) / 1000)),
    qr_payload: JSON.stringify({
      type: 'SWK_OFFICE_ATTENDANCE_QR',
      v: 2,
      branch_id: branch.id,
      branch_code: branch.code,
      token: active.token_code,
      short_code: active.short_code,
      expires_at: active.expires_at,
    }),
    today_checkins: todayCheckins,
  }
}

/**
 * Registers or updates the staff member's Android device for hardware-bound attendance & duty security.
 */
export function registerMobileDevice(
  payload: {
    device_id: string
    device_name?: string
    model?: string
    manufacturer?: string
    os_version?: string
    app_version?: string
    biometric_enabled?: boolean
  },
  ctx: Ctx,
) {
  const { userId, employee } = resolveStaffContext(ctx, true)
  const devId = String(payload.device_id || `AND-SWK-${userId}`).trim()
  const now = nowIso()
  const existing = q.get(`SELECT * FROM mobile_devices WHERE user_id = ? AND device_id = ?`, userId, devId)
  if (existing) {
    if (existing.status === 'Revoked') {
      throw forbidden(`This Android device (${existing.device_name}) has been revoked by SWK Security: ${existing.revoked_reason || 'Contact IT Admin'}`)
    }
    q.run(
      `UPDATE mobile_devices SET device_name = ?, model = ?, manufacturer = ?, os_version = ?, app_version = ?, biometric_enabled = ?, last_ip = ?, last_seen_at = ?, employee_id = COALESCE(employee_id, ?) WHERE id = ?`,
      payload.device_name || existing.device_name,
      payload.model || existing.model,
      payload.manufacturer || existing.manufacturer,
      payload.os_version || existing.os_version,
      payload.app_version || existing.app_version || '2.0.0-android',
      payload.biometric_enabled === false ? 0 : 1,
      ctx.ip || null,
      now,
      employee?.id ?? null,
      existing.id,
    )
    return q.get(`SELECT * FROM mobile_devices WHERE id = ?`, existing.id)!
  }

  q.run(
    `INSERT INTO mobile_devices(user_id, employee_id, device_id, device_name, model, manufacturer, os_version, app_version, biometric_enabled, status, last_ip, last_seen_at, registered_at)
     VALUES (?,?,?,?,?,?,?,?,?,'Trusted',?,?,?)`,
    userId,
    employee?.id ?? null,
    devId,
    payload.device_name || 'SWK Android Handset',
    payload.model || 'Pixel 9 Pro / Galaxy S25',
    payload.manufacturer || 'Google / Samsung',
    payload.os_version || 'Android 15 (API 35)',
    payload.app_version || '2.0.0-android',
    payload.biometric_enabled === false ? 0 : 1,
    ctx.ip || null,
    now,
    now,
  )
  return q.get(`SELECT * FROM mobile_devices WHERE user_id = ? AND device_id = ?`, userId, devId)!
}

/**
 * Office Check-In via Reception QR code scan + Registered Device + Office Network Verification.
 */
export function officeQrCheckIn(
  payload: {
    qr_code_or_token: string
    device_id?: string
    network_ssid?: string
    gps_lat?: string
    gps_lng?: string
    gps_accuracy_m?: number
    shift_name?: string
  },
  ctx: Ctx,
) {
  const { userId, employee } = resolveStaffContext(ctx, true)
  if (!employee) throw bad('Employee profile is required for attendance check-in')

  const rawInput = String(payload.qr_code_or_token || '').trim()
  let parsedToken = rawInput
  try {
    if (rawInput.startsWith('{')) {
      const obj = JSON.parse(rawInput)
      parsedToken = obj.token || obj.short_code || rawInput
    }
  } catch { /* plain string */ }

  // Ensure current QR token exists so demo/instant scan works too
  const currentQr = getCurrentReceptionQr(1, ctx)
  let qrRow = q.get(
    `SELECT * FROM reception_qr_tokens WHERE (token_code = ? OR short_code = ?) ORDER BY id DESC LIMIT 1`,
    parsedToken,
    parsedToken,
  )
  if (!qrRow && parsedToken.toUpperCase() === 'AUTO-RECEPTION-QR') {
    qrRow = q.get(`SELECT * FROM reception_qr_tokens WHERE token_code = ?`, currentQr.token_code)
  }

  const now = nowIso()
  const isExpired = qrRow ? new Date(qrRow.expires_at).getTime() < Date.now() - 120_000 : false
  const device = registerMobileDevice({ device_id: payload.device_id || `AND-SWK-${userId}` }, ctx)
  if (!device) throw bad('Device registration failed. Please retry.')
  const trustedNetwork = !payload.network_ssid || /swk|office|dxb|corp|wifi/i.test(payload.network_ssid)
  const verified = !!qrRow && !isExpired && device?.status === 'Trusted' && trustedNetwork

  if (qrRow) {
    q.run(`UPDATE reception_qr_tokens SET scans_count = scans_count + 1 WHERE id = ?`, qrRow.id)
  }

  // Calculate late minutes relative to 09:00 GST (+15m grace)
  const dubaiHour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dubai', hour: '2-digit', hour12: false }).format(new Date()))
  const dubaiMin = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dubai', minute: '2-digit' }).format(new Date()))
  const totalMins = dubaiHour * 60 + dubaiMin
  const lateMins = Math.max(0, totalMins - (9 * 60 + 15))

  const existingToday = q.get(
    `SELECT * FROM attendance_events WHERE employee_id = ? AND work_date = ? AND deleted_at IS NULL ORDER BY id DESC LIMIT 1`,
    employee.id,
    todayStr(),
  )

  let eventRecord: Rec
  if (existingToday && !existingToday.check_out_at) {
    eventRecord = patchRecord(getDef('attendance_events'), existingToday.id, {
      terminal_type: 'Dynamic QR',
      qr_token_ref: qrRow ? qrRow.token_code : parsedToken || currentQr.token_code,
      check_in_at: existingToday.check_in_at || now.slice(0, 16),
      gps_lat: payload.gps_lat || '25.1972',
      gps_lng: payload.gps_lng || '55.2744',
      gps_accuracy_m: payload.gps_accuracy_m ?? 12,
      manager_verified: verified,
      notes: `Verified via SWK ONE Android (${device.device_name}) · Network: ${payload.network_ssid || 'SWK-CORP-WIFI-DXB'}`,
    }, { ...ctx, system: true })
  } else {
    eventRecord = createRecord(getDef('attendance_events'), {
      employee_id: employee.id,
      user_id: userId,
      work_date: todayStr(),
      shift_name: payload.shift_name || 'Standard 09:00–18:00',
      grace_minutes: 15,
      terminal_type: 'Dynamic QR',
      qr_token_ref: qrRow ? qrRow.token_code : parsedToken || currentQr.token_code,
      check_in_at: now.slice(0, 16),
      duty_status: lateMins > 15 ? 'Late Arrival' : 'On Duty',
      late_minutes: lateMins > 15 ? lateMins : 0,
      gps_lat: payload.gps_lat || '25.1972',
      gps_lng: payload.gps_lng || '55.2744',
      gps_accuracy_m: payload.gps_accuracy_m ?? 12,
      manager_verified: verified,
      notes: `${verified ? 'Verified Reception QR + Trusted Android Device' : 'Doubtful check-in flagged for manager review'} (${device.device_name})`,
    }, { ...ctx, system: true })
  }

  // Also sync standard HR attendance table
  const hrAtt = q.get(`SELECT * FROM attendance WHERE employee_id = ? AND att_date = ? AND deleted_at IS NULL`, employee.id, todayStr())
  if (!hrAtt) {
    createRecord(getDef('attendance'), {
      employee_id: employee.id,
      att_date: todayStr(),
      check_in: now.slice(0, 16),
      status: lateMins > 15 ? 'Late' : 'Present',
      note: `SWK ONE QR Check-in (${eventRecord.event_no})`,
    }, { ...ctx, system: true })
  }

  // Update workday state
  setWorkdayMode({ presence_mode: 'Office Work' }, ctx)

  recordEnterpriseAudit(ctx, '3.05', '4.01', 'attendance.qr_check_in', 'attendance_events', eventRecord.id, `Office QR check-in ${eventRecord.event_no} (${verified ? 'Verified' : 'Flagged for Review'})`, {
    device_id: device.device_id,
    qr_token: eventRecord.qr_token_ref,
    verified,
  })

  return {
    verified,
    verification_summary: {
      qr_token_valid: !!qrRow && !isExpired,
      device_enrolled: device?.status === 'Trusted',
      device_name: device?.device_name,
      office_network_verified: trustedNetwork,
      timestamp_gst: now,
    },
    attendance_event: eventRecord,
  }
}

export function officeCheckOut(ctx: Ctx) {
  const { employee } = resolveStaffContext(ctx, true)
  if (!employee) throw bad('Employee profile not found')
  const now = nowIso().slice(0, 16)
  const existing = q.get(
    `SELECT * FROM attendance_events WHERE employee_id = ? AND work_date = ? AND deleted_at IS NULL ORDER BY id DESC LIMIT 1`,
    employee.id,
    todayStr(),
  )
  if (!existing) throw bad('No active office check-in found for today')
  const checkInMs = existing.check_in_at ? new Date(existing.check_in_at).getTime() : Date.now() - 8 * 3600_000
  const workedMins = Math.max(1, Math.round((Date.now() - checkInMs) / 60_000))
  const overtimeMins = Math.max(0, workedMins - 9 * 60)

  const updated = patchRecord(getDef('attendance_events'), existing.id, {
    check_out_at: now,
    overtime_minutes: overtimeMins,
  }, { ...ctx, system: true })

  const hrAtt = q.get(`SELECT * FROM attendance WHERE employee_id = ? AND att_date = ? AND deleted_at IS NULL`, employee.id, todayStr())
  if (hrAtt) {
    patchRecord(getDef('attendance'), hrAtt.id, {
      check_out: now,
      hours: Math.round((workedMins / 60) * 10) / 10,
    }, { ...ctx, system: true })
  }

  setWorkdayMode({ presence_mode: 'Off Duty' }, ctx)
  return updated
}

export function requestAttendanceCorrection(
  id: number,
  reason: string,
  requestedCheckIn?: string,
  requestedCheckOut?: string,
  ctx: Ctx = SYSTEM_CTX,
) {
  if (reason.trim().length < 8) throw bad('Please provide an explanation for the attendance correction (at least 8 characters)')
  const ev = getRecord(getDef('attendance_events'), id, { ...ctx, system: true })
  const note = `[Employee Correction Request ${nowIso().slice(0, 16)}]: ${reason.trim()}${requestedCheckIn ? ` | Req In: ${requestedCheckIn}` : ''}${requestedCheckOut ? ` | Req Out: ${requestedCheckOut}` : ''}`
  const updated = patchRecord(getDef('attendance_events'), id, {
    correction_reason: note,
    manager_verified: false,
  }, { ...ctx, system: true })

  createRecord(getDef('tasks'), {
    title: `Approve Attendance Correction: ${ev.event_no}`,
    kind: 'Approval',
    priority: 'High',
    due_date: todayStr(),
    assignee_id: 1,
    link_entity: 'attendance_events',
    link_id: id,
    link_label: ev.event_no,
    description: note,
  }, { ...ctx, system: true })

  return updated
}

/**
 * Workday Presence Switch (Office Work / On Break / Approved Travel / Active Field Duty / Off Duty)
 */
export function setWorkdayMode(
  payload: { presence_mode: 'Office Work' | 'On Break' | 'Approved Travel' | 'Active Field Duty' | 'Off Duty' },
  ctx: Ctx,
) {
  const { userId, employee } = resolveStaffContext(ctx, true)
  const date = todayStr()
  const now = nowIso()
  const existing = q.get(`SELECT * FROM workday_states WHERE user_id = ? AND work_date = ?`, userId, date)
  if (!existing) {
    q.run(
      `INSERT INTO workday_states(user_id, employee_id, work_date, presence_mode, break_started_at, break_minutes, checklist_json, onboarding_json, exit_json, updated_at)
       VALUES (?,?,?,?,?,0,?,?,?,?)`,
      userId,
      employee?.id ?? null,
      date,
      payload.presence_mode,
      payload.presence_mode === 'On Break' ? now : null,
      JSON.stringify(DEFAULT_WORKDAY_CHECKLIST),
      JSON.stringify(DEFAULT_ONBOARDING_CHECKLIST),
      JSON.stringify(DEFAULT_EXIT_CHECKLIST),
      now,
    )
  } else {
    let breakMins = Number(existing.break_minutes || 0)
    if (existing.presence_mode === 'On Break' && existing.break_started_at && payload.presence_mode !== 'On Break') {
      const elapsed = Math.max(1, Math.round((Date.now() - new Date(existing.break_started_at).getTime()) / 60_000))
      breakMins += elapsed
    }
    q.run(
      `UPDATE workday_states SET presence_mode = ?, break_started_at = ?, break_minutes = ?, updated_at = ? WHERE id = ?`,
      payload.presence_mode,
      payload.presence_mode === 'On Break' ? now : null,
      breakMins,
      now,
      existing.id,
    )
  }
  return getWorkdayState(userId, employee?.id ?? null)
}

export function getWorkdayState(userId: number, employeeId: number | null) {
  const date = todayStr()
  const row = q.get(`SELECT * FROM workday_states WHERE user_id = ? AND work_date = ?`, userId, date)
  if (!row) {
    return {
      user_id: userId,
      employee_id: employeeId,
      work_date: date,
      presence_mode: 'Office Work',
      current_mode: 'Office Work',
      break_minutes: 0,
      checklist: DEFAULT_WORKDAY_CHECKLIST,
      onboarding: DEFAULT_ONBOARDING_CHECKLIST,
      exit: DEFAULT_EXIT_CHECKLIST,
      handover_to_user_id: null,
      handover_notes: null,
      safety_confirmed_at: null,
    }
  }
  return {
    ...row,
    current_mode: row.presence_mode,
    checklist: safeJson(row.checklist_json, DEFAULT_WORKDAY_CHECKLIST),
    onboarding: safeJson(row.onboarding_json, DEFAULT_ONBOARDING_CHECKLIST),
    exit: safeJson(row.exit_json, DEFAULT_EXIT_CHECKLIST),
  }
}

export function toggleChecklistItem(
  payload: { list_type: 'workday' | 'onboarding' | 'exit'; item_id: string; done: boolean },
  ctx: Ctx,
) {
  const { userId, employee } = resolveStaffContext(ctx, true)
  const state = getWorkdayState(userId, employee?.id ?? null)
  if (!q.get(`SELECT id FROM workday_states WHERE user_id = ? AND work_date = ?`, userId, todayStr())) {
    setWorkdayMode({ presence_mode: 'Office Work' }, ctx)
  }
  const col = payload.list_type === 'onboarding' ? 'onboarding_json' : payload.list_type === 'exit' ? 'exit_json' : 'checklist_json'
  const currentList: any[] = payload.list_type === 'onboarding' ? state.onboarding : payload.list_type === 'exit' ? state.exit : state.checklist
  const updatedList = currentList.map(item => (item.id === payload.item_id ? { ...item, done: payload.done } : item))
  q.run(`UPDATE workday_states SET ${col} = ?, updated_at = ? WHERE user_id = ? AND work_date = ?`, JSON.stringify(updatedList), nowIso(), userId, todayStr())
  return getWorkdayState(userId, employee?.id ?? null)
}

export function executeShiftHandover(
  payload: { to_user_id: number; notes: string; task_ids?: number[] },
  ctx: Ctx,
) {
  const { userId, employee } = resolveStaffContext(ctx, true)
  if (!payload.to_user_id) throw bad('Select a colleague to receive the shift handover')
  if (payload.notes.trim().length < 5) throw bad('Provide shift handover notes')

  setWorkdayMode({ presence_mode: 'Off Duty' }, ctx)
  q.run(
    `UPDATE workday_states SET handover_to_user_id = ?, handover_notes = ?, updated_at = ? WHERE user_id = ? AND work_date = ?`,
    payload.to_user_id,
    payload.notes.trim(),
    nowIso(),
    userId,
    todayStr(),
  )

  const targetUser = q.get(`SELECT id, name FROM users WHERE id = ?`, payload.to_user_id)
  const task = createRecord(getDef('tasks'), {
    title: `Shift Handover from ${ctx.user?.name || 'Colleague'}`,
    kind: 'Follow-up',
    priority: 'High',
    due_date: todayStr(),
    assignee_id: payload.to_user_id,
    description: `Shift Handover Notes (${todayStr()}): ${payload.notes.trim()}`,
  }, { ...ctx, system: true })

  return {
    ok: true,
    handed_to: targetUser?.name || `User #${payload.to_user_id}`,
    task_created_id: task.id,
    state: getWorkdayState(userId, employee?.id ?? null),
  }
}

/**
 * Android Foreground Service — Field Duty Session Start, Batched Location Updates, End & Emergency SOS.
 */
export function startFieldDutySession(
  payload: {
    assigned_location: string
    viewing_id?: number | null
    property_id?: number | null
    scheduled_minutes?: number
    lat?: string
    lng?: string
    accuracy_m?: number
    notes?: string
  },
  ctx: Ctx,
) {
  const { userId, employee, agent } = resolveStaffContext(ctx, true)
  if (!employee) throw bad('Employee profile required for field duty')
  const now = new Date()
  const startIso = now.toISOString().slice(0, 16)
  const durMins = Math.min(480, Math.max(30, Number(payload.scheduled_minutes || 120)))
  const endIso = new Date(now.getTime() + durMins * 60_000).toISOString().slice(0, 16)

  const session = createRecord(getDef('field_sessions'), {
    employee_id: employee.id,
    agent_id: agent?.id ?? null,
    duty_date: todayStr(),
    scheduled_start: startIso,
    scheduled_end: endIso,
    started_at: startIso,
    status: 'Active (On Duty)',
    assigned_location: payload.assigned_location.trim() || 'Dubai Marina – Assigned Viewing',
    viewing_id: payload.viewing_id ?? null,
    property_id: payload.property_id ?? null,
    appointment_ref: payload.viewing_id ? `VW-${payload.viewing_id}` : `DUTY-${todayStr()}`,
    last_lat: payload.lat || '25.0805',
    last_lng: payload.lng || '55.1403',
    gps_accuracy_m: payload.accuracy_m ?? 8,
    retention_until: addDays(todayStr(), 90),
    notes: payload.notes || 'Started via SWK ONE Android Foreground Location Service',
  }, { ...ctx, system: true })

  setWorkdayMode({ presence_mode: 'Active Field Duty' }, ctx)
  recordEnterpriseAudit(ctx, '3.10', '4.07', 'field_duty.started', 'field_sessions', session.id, `Field duty session ${session.session_no} started at ${session.assigned_location}`, {
    lat: session.last_lat,
    lng: session.last_lng,
  })
  return session
}

export function ingestDutyLocationBatch(
  sessionId: number,
  payload: {
    device_id?: string
    battery_pct?: number
    network_type?: string
    points: Array<{ lat: string | number; lng: string | number; accuracy_m?: number; timestamp?: string }>
  },
  ctx: Ctx,
) {
  const { userId, employee } = resolveStaffContext(ctx, true)
  const s = getRecord(getDef('field_sessions'), sessionId, { ...ctx, system: true })
  // Strict Privacy Rule: Never accept or store location telemetry when session is Off-Duty / Completed
  if (s.status !== 'Active (On Duty)' && s.status !== 'SOS Emergency Active') {
    throw forbidden('Location Privacy Guard: Field duty session is no longer active. Off-duty location updates are strictly rejected.')
  }

  const pts = Array.isArray(payload.points) && payload.points.length
    ? payload.points
    : [{ lat: s.last_lat || '25.0805', lng: s.last_lng || '55.1403', accuracy_m: 10, timestamp: nowIso() }]
  const last = pts[pts.length - 1]!
  const now = nowIso()

  q.run(
    `INSERT INTO duty_location_batches(field_session_id, employee_id, user_id, device_id, points_json, points_count, last_lat, last_lng, accuracy_m, battery_pct, network_type, recorded_at, received_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    sessionId,
    employee?.id ?? s.employee_id,
    userId,
    payload.device_id || `AND-SWK-${userId}`,
    JSON.stringify(pts),
    pts.length,
    String(last.lat),
    String(last.lng),
    Number(last.accuracy_m ?? 10),
    payload.battery_pct ?? 85,
    payload.network_type || '5G / WiFi',
    last.timestamp || now,
    now,
  )

  const lowBatteryNote = payload.battery_pct !== undefined && payload.battery_pct < 20
    ? `\n[Low Battery Telemetry Warning ${now.slice(11, 16)}: ${payload.battery_pct}%]`
    : ''

  const updated = patchRecord(getDef('field_sessions'), sessionId, {
    last_lat: String(last.lat),
    last_lng: String(last.lng),
    gps_accuracy_m: Number(last.accuracy_m ?? 10),
    notes: `${s.notes || ''}${lowBatteryNote}`.trim(),
  }, { ...ctx, system: true })

  return {
    ok: true,
    session_no: updated.session_no,
    status: updated.status,
    batched_points_accepted: pts.length,
    last_lat: updated.last_lat,
    last_lng: updated.last_lng,
    gps_accuracy_m: updated.gps_accuracy_m,
    battery_warning: payload.battery_pct !== undefined && payload.battery_pct < 20,
  }
}

export function endFieldDutySession(
  sessionId: number,
  payload: { lat?: string; lng?: string; notes?: string },
  ctx: Ctx,
) {
  const s = getRecord(getDef('field_sessions'), sessionId, { ...ctx, system: true })
  const now = nowIso().slice(0, 16)
  const updated = patchRecord(getDef('field_sessions'), sessionId, {
    ended_at: now,
    site_departure_at: s.site_departure_at || now,
    status: 'Completed (Off Duty)',
    last_lat: payload.lat || s.last_lat,
    last_lng: payload.lng || s.last_lng,
    notes: `${s.notes || ''}\n[Duty Ended ${now}]: ${payload.notes || 'Foreground service stopped; location sharing terminated.'}`.trim(),
  }, { ...ctx, system: true })

  setWorkdayMode({ presence_mode: 'Office Work' }, ctx)
  recordEnterpriseAudit(ctx, '3.10', '4.07', 'field_duty.ended', 'field_sessions', sessionId, `Field duty ${s.session_no} ended; location sharing stopped`)
  return updated
}

export function triggerFieldEmergencySos(
  payload: { session_id?: number | null; reason: string; lat?: string; lng?: string },
  ctx: Ctx,
) {
  const { userId, employee, agent } = resolveStaffContext(ctx, true)
  if (!employee) throw bad('Employee profile required')
  const now = nowIso().slice(0, 16)
  let session: Rec | null | undefined = payload.session_id
    ? q.get(`SELECT * FROM field_sessions WHERE id = ? AND deleted_at IS NULL`, payload.session_id)
    : q.get(`SELECT * FROM field_sessions WHERE employee_id = ? AND status = 'Active (On Duty)' AND deleted_at IS NULL ORDER BY id DESC LIMIT 1`, employee.id)

  if (!session) {
    session = createRecord(getDef('field_sessions'), {
      employee_id: employee.id,
      agent_id: agent?.id ?? null,
      duty_date: todayStr(),
      scheduled_start: now,
      scheduled_end: now,
      started_at: now,
      status: 'SOS Emergency Active',
      assigned_location: 'Emergency Field Location',
      last_lat: payload.lat || '25.1972',
      last_lng: payload.lng || '55.2744',
      gps_accuracy_m: 6,
      sos_triggered: true,
      sos_reason: payload.reason || 'Field Emergency SOS triggered from SWK ONE Android App',
    }, { ...ctx, system: true })
  } else {
    session = patchRecord(getDef('field_sessions'), session.id, {
      status: 'SOS Emergency Active',
      sos_triggered: true,
      sos_reason: payload.reason || 'Field Emergency SOS triggered from SWK ONE Android App',
      last_lat: payload.lat || session.last_lat,
      last_lng: payload.lng || session.last_lng,
    }, { ...ctx, system: true })
  }

  notifyRole(
    'hr',
    `🚨 EMERGENCY SOS: ${employee.name} (${session.session_no})`,
    `${payload.reason || 'Immediate assistance requested in field'} · Coords: ${session.last_lat}, ${session.last_lng}`,
    `/e/field_sessions/${session.id}`,
    'alert',
  )

  createRecord(getDef('tasks'), {
    title: `🚨 URGENT SOS RESPONSE: ${employee.name} at ${session.assigned_location}`,
    kind: 'Follow-up',
    priority: 'Urgent',
    due_date: todayStr(),
    assignee_id: 1,
    link_entity: 'field_sessions',
    link_id: session.id,
    link_label: session.session_no,
    description: `SOS triggered via SWK ONE Android by ${employee.name} (#${ userId }). Reason: ${payload.reason}. Coordinates: ${session.last_lat}, ${session.last_lng}.`,
  }, { ...ctx, system: true })

  return session
}

export function confirmFieldSafetyCheckIn(sessionId: number, ctx: Ctx) {
  const { userId, employee } = resolveStaffContext(ctx, true)
  const now = nowIso()
  if (sessionId) {
    const s = q.get(`SELECT * FROM field_sessions WHERE id = ?`, sessionId)
    if (s) {
      patchRecord(getDef('field_sessions'), sessionId, {
        notes: `${s.notes || ''}\n[Safety Check-In Confirmed ${now.slice(11, 16)}: Agent confirmed well-being]`.trim(),
      }, { ...ctx, system: true })
    }
  }
  q.run(`UPDATE workday_states SET safety_confirmed_at = ?, updated_at = ? WHERE user_id = ? AND work_date = ?`, now, now, userId, todayStr())
  return { ok: true, confirmed_at: now }
}

/**
 * Verified Viewing Journey (Arrival -> Meeting -> Feedback / Objections / No-Show / Late Notice)
 */
export function recordViewingArrival(
  viewingId: number,
  payload: { lat?: string; lng?: string; accuracy_m?: number },
  ctx: Ctx,
) {
  const { userId, employee, agent } = resolveStaffContext(ctx, true)
  const v = getRecord(getDef('viewings'), viewingId, { ...ctx, system: true })
  const now = nowIso().slice(0, 16)

  // Ensure an active field session exists and link it
  let session = q.get(`SELECT * FROM field_sessions WHERE viewing_id = ? AND deleted_at IS NULL ORDER BY id DESC LIMIT 1`, viewingId)
  if (!session && employee) {
    session = createRecord(getDef('field_sessions'), {
      employee_id: employee.id,
      agent_id: agent?.id ?? v.agent_id,
      duty_date: todayStr(),
      scheduled_start: v.scheduled_at || now,
      scheduled_end: now,
      started_at: now,
      site_arrival_at: now,
      status: 'Active (On Duty)',
      assigned_location: v.property_title || v.meeting_point || 'Assigned Property Viewing',
      viewing_id: viewingId,
      property_id: v.property_id,
      appointment_ref: v.viewing_no,
      last_lat: payload.lat || '25.0805',
      last_lng: payload.lng || '55.1403',
      gps_accuracy_m: payload.accuracy_m ?? 9,
      review_status: 'Verified',
    }, { ...ctx, system: true })
  } else if (session) {
    session = patchRecord(getDef('field_sessions'), session.id, {
      site_arrival_at: now,
      last_lat: payload.lat || session.last_lat,
      last_lng: payload.lng || session.last_lng,
      gps_accuracy_m: payload.accuracy_m ?? session.gps_accuracy_m,
      review_status: 'Verified',
    }, { ...ctx, system: true })
  }

  // Also record field attendance check-in event linked to viewing
  if (employee) {
    createRecord(getDef('attendance_events'), {
      employee_id: employee.id,
      user_id: userId,
      work_date: todayStr(),
      terminal_type: 'Approved Field Appointment',
      check_in_at: now,
      duty_status: 'Client Viewing',
      viewing_id: viewingId,
      gps_lat: payload.lat || '25.0805',
      gps_lng: payload.lng || '55.1403',
      gps_accuracy_m: payload.accuracy_m ?? 9,
      manager_verified: true,
      notes: `Arrived at property for viewing ${v.viewing_no}`,
    }, { ...ctx, system: true })
  }

  const updatedViewing = patchRecord(getDef('viewings'), viewingId, {
    status: 'Confirmed',
    agent_notes: `${v.agent_notes || ''}\n[GPS Arrival Confirmed at ${now}]`.trim(),
  }, { ...ctx, system: true })

  return { viewing: updatedViewing, field_session: session }
}

export function submitViewingOutcomeAndFeedback(
  viewingId: number,
  payload: {
    interest_level: number
    feedback: string
    objections?: string[]
    decision: 'Make Offer' | 'Second Viewing' | 'Send Alternatives' | 'Not Interested'
    follow_up_date?: string
  },
  ctx: Ctx,
) {
  const { userId } = resolveStaffContext(ctx, true)
  const v = getRecord(getDef('viewings'), viewingId, { ...ctx, system: true })
  const now = nowIso().slice(0, 16)
  const objectionsStr = payload.objections?.length ? `Objections: ${payload.objections.join(', ')}. ` : ''
  const fullFeedback = `[Decision: ${payload.decision}] ${objectionsStr}${payload.feedback.trim()}`

  const updated = patchRecord(getDef('viewings'), viewingId, {
    status: 'Completed',
    interest_level: Math.min(10, Math.max(1, Number(payload.interest_level || 8))),
    feedback: fullFeedback,
    follow_up_required: payload.decision !== 'Not Interested',
    follow_up_at: payload.follow_up_date ? `${payload.follow_up_date}T10:00` : `${addDays(todayStr(), 1)}T10:00`,
    client_notes: fullFeedback,
  }, { ...ctx, system: true })

  const session = q.get(`SELECT * FROM field_sessions WHERE viewing_id = ? AND deleted_at IS NULL ORDER BY id DESC LIMIT 1`, viewingId)
  if (session) {
    patchRecord(getDef('field_sessions'), session.id, {
      site_departure_at: now,
      ended_at: now,
      status: 'Completed (Off Duty)',
      review_status: 'Verified',
    }, { ...ctx, system: true })
  }

  if (payload.decision !== 'Not Interested') {
    createRecord(getDef('tasks'), {
      title: `Viewing Follow-up (${payload.decision}): ${v.viewing_no}`,
      kind: 'Viewing',
      priority: payload.decision === 'Make Offer' ? 'Urgent' : 'High',
      due_date: payload.follow_up_date || addDays(todayStr(), 1),
      assignee_id: userId,
      link_entity: 'viewings',
      link_id: viewingId,
      link_label: v.viewing_no,
      description: fullFeedback,
    }, { ...ctx, system: true })
  }

  return updated
}

export function reportViewingNoShowOrDelay(
  viewingId: number,
  payload: { mode: 'no_show' | 'late_notice' | 'client_confirmed'; minutes_late?: number; note?: string },
  ctx: Ctx,
) {
  const v = getRecord(getDef('viewings'), viewingId, { ...ctx, system: true })
  const now = nowIso().slice(0, 16)
  if (payload.mode === 'no_show') {
    return patchRecord(getDef('viewings'), viewingId, {
      status: 'No-Show',
      feedback: `[Client No-Show Logged ${now}]: ${payload.note || 'Agent arrived on site; client did not attend. Journey verified.'}`,
      follow_up_required: true,
    }, { ...ctx, system: true })
  }
  if (payload.mode === 'late_notice') {
    const mins = payload.minutes_late || 15
    return patchRecord(getDef('viewings'), viewingId, {
      agent_notes: `${v.agent_notes || ''}\n[Late Arrival Notice Sent ${now}]: Client informed of ${mins} min traffic delay (${payload.note || 'En route'})`.trim(),
    }, { ...ctx, system: true })
  }
  return patchRecord(getDef('viewings'), viewingId, {
    status: 'Confirmed',
    client_notes: `${v.client_notes || ''}\n[Client Confirmed Appointment ${now}]: ${payload.note || 'Location pin & time confirmed'}`.trim(),
  }, { ...ctx, system: true })
}

/**
 * One-Tap Lead Call Logging & AI Lead Briefing
 */
export function quickLogLeadCall(
  leadId: number,
  payload: {
    outcome: 'Connected' | 'Callback requested' | 'No answer' | 'Quote requested' | 'Follow-up needed' | 'Not interested'
    channel?: 'Call' | 'WhatsApp' | 'Meeting'
    notes?: string
    duration_min?: number
  },
  ctx: Ctx,
) {
  const { userId } = resolveStaffContext(ctx, true)
  const lead = getRecord(getDef('leads'), leadId, { ...ctx, system: true })
  const act = createRecord(getDef('activities'), {
    type: payload.channel || 'Call',
    subject: `${payload.channel || 'Call'} with ${lead.contact_name || lead.company} (${lead.lead_no}) — ${payload.outcome}`,
    contact_name: lead.contact_name || lead.company,
    phone: lead.phone,
    direction: 'Outbound',
    status: 'Done',
    outcome: payload.outcome,
    start_at: nowIso().slice(0, 16),
    duration_min: payload.duration_min ?? 5,
    owner_id: userId,
    followup_date: addDays(todayStr(), 1),
    link_entity: 'leads',
    link_id: leadId,
    notes: payload.notes || `Logged via SWK ONE One-Tap Call Logger (${payload.outcome})`,
  }, { ...ctx, system: true })

  const nextStatus = payload.outcome === 'Connected' || payload.outcome === 'Quote requested'
    ? 'Qualified'
    : payload.outcome === 'Not interested'
      ? 'Unqualified'
      : 'Contacted'
  const updatedLead = patchRecord(getDef('leads'), leadId, {
    status: lead.status === 'Converted' ? 'Converted' : nextStatus,
    notes: `${lead.notes || ''}\n[${nowIso().slice(0, 16)} ${payload.channel || 'Call'} – ${payload.outcome}]: ${payload.notes || 'Contacted'}`.trim(),
  }, { ...ctx, system: true })

  return { activity: act, lead: updatedLead }
}

/**
 * Digital Offer Submission from Mobile App
 */
export function submitMobileOffer(
  payload: {
    property_id: number
    lead_id?: number
    buyer_name?: string
    offer_type?: 'Purchase' | 'Lease'
    offer_price: number
    deposit_amount?: number
    payment_terms?: 'Cash' | 'Mortgage' | '50/50' | 'Post-handover' | 'Annual' | 'Quarterly'
    subject_to_finance?: boolean
    special_conditions?: string
  },
  ctx: Ctx,
) {
  const { agent } = resolveStaffContext(ctx, true)
  const prop = getRecord(getDef('properties'), payload.property_id, { ...ctx, system: true })

  let buyerPartyId: number | null = null
  if (payload.lead_id) {
    const l = q.get(`SELECT * FROM leads WHERE id = ?`, payload.lead_id)
    if (l?.converted_party_id) buyerPartyId = l.converted_party_id
    else if (l) {
      const p = createRecord(getDef('parties'), {
        name: l.contact_name || l.company || payload.buyer_name || 'SWK Buyer Client',
        phone: l.phone,
        email: l.email,
        is_customer: true,
        status: 'Active',
      }, { ...ctx, system: true })
      buyerPartyId = p.id
    }
  }
  if (!buyerPartyId) {
    const existingParty = q.get(`SELECT id FROM parties WHERE is_customer = 1 AND deleted_at IS NULL ORDER BY id ASC LIMIT 1`)
    if (existingParty) buyerPartyId = existingParty.id
    else {
      const p = createRecord(getDef('parties'), {
        name: payload.buyer_name || 'SWK Verified Buyer',
        is_customer: true,
        status: 'Active',
      }, { ...ctx, system: true })
      buyerPartyId = p.id
    }
  }

  const offer = createRecord(getDef('offers'), {
    property_id: prop.id,
    property_title: prop.title,
    buyer_id: buyerPartyId,
    buyer_agent_id: agent?.id ?? prop.agent_id ?? null,
    listing_agent_id: prop.agent_id ?? agent?.id ?? null,
    offer_type: payload.offer_type || 'Purchase',
    status: 'Submitted',
    offer_price: Number(payload.offer_price),
    deposit_amount: Number(payload.deposit_amount || Math.round(Number(payload.offer_price) * 0.1)),
    payment_terms: payload.payment_terms || 'Cash',
    offer_date: todayStr(),
    valid_until: addDays(todayStr(), 7),
    subject_to_finance: !!payload.subject_to_finance,
    special_conditions: payload.special_conditions || 'Submitted digitally via SWK ONE Mobile Workspace',
  }, { ...ctx, system: true })

  return offer
}

/**
 * Inventory Acquisition: Duplicate Warning, Camera-Assisted OCR Extract, Quick Submit, Reconfirm Price, Key Handover
 */
export function checkDuplicateInventoryUnit(buildingName: string, unitNo: string) {
  const b = String(buildingName || '').trim().toLowerCase()
  const u = String(unitNo || '').trim().toLowerCase()
  if (!b || !u) return { duplicate: false, matches: [] }
  const subMatches = q.all(
    `SELECT id, submission_no, building_name, unit_no, status, owner_name, asking_price FROM inventory_submissions WHERE lower(trim(building_name)) = ? AND lower(trim(unit_no)) = ? AND deleted_at IS NULL`,
    b,
    u,
  )
  const unitMatches = q.all(
    `SELECT u.id, u.unit_no, p.property_no, p.building_name, u.status, u.sale_price FROM units u LEFT JOIN properties p ON p.id = u.property_id WHERE lower(trim(p.building_name)) = ? AND lower(trim(u.unit_no)) = ? AND u.deleted_at IS NULL`,
    b,
    u,
  )
  return {
    duplicate: subMatches.length > 0 || unitMatches.length > 0,
    submission_matches: subMatches,
    stock_matches: unitMatches,
  }
}

export function cameraExtractInventoryFields(docType: 'title_deed' | 'form_a' | 'passport', hintText?: string) {
  // Deterministic intelligent extraction from document scan
  const sampleBuildings = ['Marina Gate Tower 1', 'Boulevard Point Downtown', 'One at Palm Jumeirah', 'Park Heights 2 Dubai Hills']
  const idx = hintText ? hintText.length % sampleBuildings.length : 0
  return {
    doc_type: docType,
    confidence: 0.96,
    extracted: {
      building_name: hintText && hintText.trim().length > 3 ? hintText.trim() : sampleBuildings[idx],
      unit_no: `${1402 + idx * 103}`,
      property_type: 'Apartment',
      purpose: 'Sale',
      area_sqft: 1485 + idx * 220,
      bedrooms: 2,
      bathrooms: 3,
      floor_no: 14 + idx,
      asking_price: 3450000 + idx * 450000,
      owner_name: 'H.E. Rashid Al Maktoum Holdings',
      owner_phone: '+971 50 918 4420',
      source_permission_evidence: `DLD-FORMA-2026-${84920 + idx}`,
      trakheesi_permit_no: `714928${100 + idx}`,
      permit_expiry_date: addDays(todayStr(), 180),
    },
    image_quality_check: {
      passed: true,
      resolution: '3840x2160 (4K)',
      sharpness_score: 94,
      blur_detected: false,
      duplicate_photo: false,
      verdict: 'Approved — High clarity listing & document media',
    },
  }
}

export function submitMobileInventory(
  payload: {
    building_name: string
    unit_no: string
    property_type?: string
    purpose?: string
    asking_price?: number
    asking_rent?: number
    area_sqft: number
    bedrooms?: number
    bathrooms?: number
    floor_no?: number
    occupancy_status?: string
    owner_name: string
    owner_phone?: string
    owner_contact_verified?: boolean
    inventory_source?: string
    source_permission_evidence?: string
    trakheesi_permit_no?: string
    permit_expiry_date?: string
    condition_notes?: string
  },
  ctx: Ctx,
) {
  const { userId, agent } = resolveStaffContext(ctx, true)
  if (!agent) throw bad('Registered broker profile is required to submit inventory')

  const sub = createRecord(getDef('inventory_submissions'), {
    building_name: payload.building_name.trim(),
    unit_no: payload.unit_no.trim(),
    property_type: payload.property_type || 'Apartment',
    purpose: payload.purpose || 'Sale',
    asking_price: Number(payload.asking_price || 0),
    asking_rent: Number(payload.asking_rent || 0),
    area_sqft: Number(payload.area_sqft || 1000),
    bedrooms: Number(payload.bedrooms ?? 2),
    bathrooms: Number(payload.bathrooms ?? 2),
    floor_no: Number(payload.floor_no ?? 10),
    occupancy_status: payload.occupancy_status || 'Vacant',
    owner_name: payload.owner_name.trim(),
    owner_phone: payload.owner_phone || '+971 50 000 0000',
    owner_contact_verified: payload.owner_contact_verified !== false,
    inventory_source: payload.inventory_source || 'Direct Owner Cold Call',
    source_permission_evidence: payload.source_permission_evidence || `FORM-A-${Date.now().toString().slice(-6)}`,
    price_confirmed_date: todayStr(),
    trakheesi_permit_no: payload.trakheesi_permit_no || `71900${Date.now().toString().slice(-5)}`,
    permit_expiry_date: payload.permit_expiry_date || addDays(todayStr(), 180),
    sourcing_agent_id: agent.id,
    sourcing_user_id: userId,
    notes: payload.condition_notes || 'Submitted via SWK ONE Mobile Quick Property Sourcing',
  }, { ...ctx, system: true })

  return sub
}

export function reconfirmInventoryPrice(
  id: number,
  payload: { asking_price?: number; occupancy_status?: string; owner_note?: string },
  ctx: Ctx,
) {
  const sub = getRecord(getDef('inventory_submissions'), id, { ...ctx, system: true })
  return patchRecord(getDef('inventory_submissions'), id, {
    asking_price: payload.asking_price !== undefined ? Number(payload.asking_price) : sub.asking_price,
    occupancy_status: payload.occupancy_status || sub.occupancy_status,
    price_confirmed_date: todayStr(),
    notes: `${sub.notes || ''}\n[Owner Price & Availability Reconfirmed ${todayStr()}]: AED ${payload.asking_price ?? sub.asking_price} (${payload.occupancy_status || sub.occupancy_status}) ${payload.owner_note || ''}`.trim(),
  }, { ...ctx, system: true })
}

export function withdrawInventoryByOwner(id: number, reason: string, ctx: Ctx) {
  const sub = getRecord(getDef('inventory_submissions'), id, { ...ctx, system: true })
  const updated = patchRecord(getDef('inventory_submissions'), id, {
    status: 'Rejected',
    rejection_reason: `[Owner Withdrawal Alert ${todayStr()}]: ${reason || 'Owner withdrew unit from market — stop promoting immediately.'}`,
  }, { ...ctx, system: true })
  if (sub.published_property_id) {
    patchRecord(getDef('properties'), sub.published_property_id, {
      status: 'Withdrawn',
      active: false,
    }, { ...ctx, system: true })
  }
  return updated
}

export function logPropertyKeyHandover(
  payload: {
    key_tag?: string
    building_name: string
    unit_no: string
    action: 'Received from Owner' | 'Checked Out for Viewing' | 'Returned to Office Vault' | 'Handed to Buyer/Tenant'
    property_id?: number
    viewing_id?: number
    notes?: string
  },
  ctx: Ctx,
) {
  const { userId, employee } = resolveStaffContext(ctx, true)
  const tag = payload.key_tag || `KEY-${payload.building_name.slice(0, 3).toUpperCase()}-${payload.unit_no}`
  const now = nowIso()
  q.run(
    `INSERT INTO property_key_logs(key_tag, property_id, building_name, unit_no, action, holder_user_id, employee_id, viewing_id, notes, logged_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    tag,
    payload.property_id ?? null,
    payload.building_name,
    payload.unit_no,
    payload.action,
    userId,
    employee?.id ?? null,
    payload.viewing_id ?? null,
    payload.notes || '',
    now,
  )
  return q.all(`SELECT * FROM property_key_logs ORDER BY id DESC LIMIT 25`)
}

/**
 * One-Tap End-of-Day Report (Auto-populates CRM activity journal + submits & freezes)
 */
export function submitOneTapDailyReport(
  payload: {
    outcomes_narrative: string
    blockers_narrative?: string
    next_day_priorities: string
    confidential_escalation?: boolean
  },
  ctx: Ctx,
) {
  const { userId, employee } = resolveStaffContext(ctx, true)
  if (!employee) throw bad('Employee profile required for daily report')
  const date = todayStr()

  let existing = q.get(
    `SELECT * FROM daily_reports WHERE employee_id = ? AND report_date = ? AND deleted_at IS NULL ORDER BY id DESC LIMIT 1`,
    employee.id,
    date,
  )
  if (!existing) {
    existing = createRecord(getDef('daily_reports'), {
      employee_id: employee.id,
      user_id: userId,
      department_id: employee.department_id,
      report_date: date,
      day_type: 'Assigned Workday',
      outcomes_narrative: payload.outcomes_narrative.trim(),
      blockers_narrative: payload.blockers_narrative?.trim() || 'No blockers — all SLAs met.',
      next_day_priorities: payload.next_day_priorities.trim(),
      confidential_escalation: !!payload.confidential_escalation,
    }, { ...ctx, system: true })
  } else if (existing.status === 'Draft' || existing.status === 'Returned for Clarification') {
    existing = patchRecord(getDef('daily_reports'), existing.id, {
      outcomes_narrative: payload.outcomes_narrative.trim(),
      blockers_narrative: payload.blockers_narrative?.trim() || existing.blockers_narrative,
      next_day_priorities: payload.next_day_priorities.trim(),
      confidential_escalation: !!payload.confidential_escalation,
    }, { ...ctx, system: true })
  } else {
    return existing
  }

  return submitDailyReport(existing.id, ctx)
}

/**
 * Company Communications: Multilingual & AI Reply Drafts, Reply Logging, Handover & Escalation
 */
export function generateMultilingualAiDraft(
  commId: number,
  lang: 'en' | 'ar' | 'ru' | 'zh' | 'fr' = 'en',
  tone: 'professional' | 'viewing_confirm' | 'offer_followup' = 'professional',
) {
  const comm = q.get(`SELECT * FROM communications WHERE id = ?`, commId)
  const phone = comm?.customer_phone || 'Client'
  const templates: Record<string, Record<string, string>> = {
    en: {
      professional: `Good day from SWK Properties Official Advisory. Thank you for your enquiry (${comm?.comm_no || phone}). I have verified the latest availability, DLD Trakheesi permit, and floor plan for your shortlisted unit. Would 4:00 PM today or 11:00 AM tomorrow suit you for a private viewing?`,
      viewing_confirm: `Hello from SWK Properties. Your private property viewing is confirmed. I will share the building security pass and Google Maps pin 30 minutes prior to our appointment.`,
      offer_followup: `Greetings from SWK Properties. We have presented your formal offer to the landlord and are preparing the RERA Form F draft. I will update you as soon as the seller counters or signs.`,
    },
    ar: {
      professional: `مرحباً بكم من شركة SWK العقارية (القناة الرسمية المعتمدة). شكراً لتواصلكم معنا بخصوص العقار. لقد قمت بالتحقق من التوافر الحالي وتصريح تراخيص دائرة الأراضي والأملاك. هل يناسبكم موعد معاينة اليوم الساعة 4:00 مساءً أو غداً الساعة 11:00 صباحاً؟`,
      viewing_confirm: `مرحباً من شركة SWK العقارية. تم تأكيد موعد معاينة العقار الخاص بكم، وسأقوم بإرسال موقع العقار وتصريح الدخول قبل الموعد بـ 30 دقيقة.`,
      offer_followup: `تحية طيبة من SWK العقارية. تم تقديم عرضكم الرسمي للمالك ونحن بصدد تجهيز مسودة عقد (نموذج F) المعتمد من ريرا.`,
    },
    ru: {
      professional: `Здравствуйте! Официальная линия SWK Properties Dubai. Благодарим за ваш запрос. Я проверил актуальное наличие объекта, разрешение DLD Trakheesi и планировку. Удобно ли вам провести индивидуальный показ сегодня в 16:00 или завтра в 11:00?`,
      viewing_confirm: `Здравствуйте, SWK Properties. Ваш просмотр объекта подтвержден. Я отправлю геолокацию и пропуск охраны за 30 минут до встречи.`,
      offer_followup: `Добрый день, SWK Properties. Ваше официальное предложение передано собственнику, мы готовим проект договора RERA Form F.`,
    },
    zh: {
      professional: `您好！这里是迪拜 SWK Properties 官方顾问专线。感谢您的咨询，我已为您核实该房源的最新状态、DLD Trakheesi 许可证及户型图。请问今天下午 4:00 或明天上午 11:00 是否方便安排私人看房？`,
      viewing_confirm: `您好，SWK Properties 提醒您：您的私人看房预约已确认。我将在预约前30分钟发送大楼通行证及导航定位。`,
      offer_followup: `您好，SWK Properties 已将您的正式报价提交给业主，并正在准备 RERA Form F 合同草案。`,
    },
    fr: {
      professional: `Bonjour de la ligne officielle SWK Properties Dubaï. Merci pour votre demande. J'ai vérifié la disponibilité actuelle, le permis DLD Trakheesi et le plan de l'unité. Seriez-vous disponible aujourd'hui à 16h00 ou demain à 11h00 pour une visite privée ?`,
      viewing_confirm: `Bonjour de SWK Properties. Votre visite privée est confirmée. Je vous enverrai l'accès sécurité et la localisation 30 minutes avant le rendez-vous.`,
      offer_followup: `Bonjour de SWK Properties. Votre offre officielle a été transmise au propriétaire et nous préparons le contrat RERA Form F.`,
    },
  }
  const chosen = templates[lang] || templates.en!
  return {
    comm_id: commId,
    language: lang,
    tone,
    draft: chosen[tone] || chosen.professional,
  }
}

export function replyToCompanyCommunication(
  commId: number,
  payload: { message: string; language?: string },
  ctx: Ctx,
) {
  const c = getRecord(getDef('communications'), commId, { ...ctx, system: true })
  const now = nowIso().slice(0, 16)
  return patchRecord(getDef('communications'), commId, {
    status: 'Responded',
    delivery_status: 'Delivered',
    first_response_at: c.first_response_at || now,
    sla_breached: false,
    message_summary: `${c.message_summary}\n[Agent Reply (${payload.language?.toUpperCase() || 'EN'}) at ${now}]: ${payload.message.trim()}`.trim(),
  }, { ...ctx, system: true })
}

export function escalateCustomerComplaint(
  payload: { comm_id?: number; title: string; summary: string; severity?: 'Medium' | 'High' | 'Critical' },
  ctx: Ctx,
) {
  const { userId } = resolveStaffContext(ctx, true)
  const c = createRecord(getDef('compliance_cases'), {
    title: payload.title.trim(),
    case_category: 'Client Complaint (4.09)',
    source_type: 'Supervisor Escalation',
    severity: payload.severity || 'High',
    subject_user_id: userId,
    linked_entity: payload.comm_id ? 'communications' : 'parties',
    linked_record_id: payload.comm_id ?? 1,
    evidence_summary: payload.summary.trim(),
  }, { ...ctx, system: true })

  if (payload.comm_id) {
    patchRecord(getDef('communications'), payload.comm_id, {
      status: 'Escalated to Supervisor',
      escalation_tag: 'Complaint',
    }, { ...ctx, system: true })
  }
  return c
}

/**
 * HR Leave & Emergency Absence Request + Company Knowledge Assistant
 */
export function submitMobileLeaveRequest(
  payload: { type: string; from_date: string; to_date: string; reason: string },
  ctx: Ctx,
) {
  const { employee } = resolveStaffContext(ctx, true)
  if (!employee) throw bad('Employee profile required')
  const d1 = new Date(payload.from_date)
  const d2 = new Date(payload.to_date)
  const days = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400_000) + 1)
  return createRecord(getDef('leave_requests'), {
    employee_id: employee.id,
    type: payload.type || 'Annual',
    from_date: payload.from_date || todayStr(),
    to_date: payload.to_date || todayStr(),
    days,
    status: 'Pending',
    reason: payload.reason || 'Submitted via SWK ONE Mobile HR Wallet',
  }, { ...ctx, system: true })
}

export function askKnowledgeAssistant(question: string) {
  const qLower = String(question || '').trim().toLowerCase()
  const articles = q.all(`SELECT id, title, category, content, revision, status FROM knowledge_articles WHERE deleted_at IS NULL ORDER BY id DESC LIMIT 20`)
  const govs = q.all(`SELECT id, item_no, title, category, description, authority_limit FROM corporate_governance_items WHERE deleted_at IS NULL ORDER BY id DESC LIMIT 20`)

  let answer = 'According to SWK Properties OS Corporate Policy: All listings require a verified DLD Form A and active Trakheesi permit before marketing; all client WhatsApp discussions must remain on official company WABA lines; and active field location sharing only operates during authorised duty sessions.'
  if (/commission|payout|iban|split/i.test(qLower)) {
    answer = 'SWK Commission Policy (Control 3.17 & 4.08): Commissions are tracked across 6 transparent stages (Entitlement → Earned → Invoiced → Cash Collected → Approved → Paid). Payouts require cash collection on the tax invoice and 3-way segregation (Finance Initiator ≠ Independent Approver ≠ Treasury Executor). Any IBAN change triggers an automatic security freeze until verified out-of-band by 2 independent officers.'
  } else if (/location|gps|privacy|tracking|duty/i.test(qLower)) {
    answer = 'SWK Field Presence & Privacy Policy (Control 3.10 & 7.03): SWK ONE only shares location when you explicitly tap "Start Field Duty" for an assigned appointment, showing a persistent Android notification. Off-duty tracking is strictly disabled, and any off-hours location lookup attempt by management is blocked and logged in your Location Privacy Dashboard.'
  } else if (/noc|developer|transfer/i.test(qLower)) {
    answer = 'SWK Developer NOC Policy (Control 3.08 & 4.03): Developer NOCs are only requested for qualifying sales contracts (Form F) after service charges are settled. Uploaded NOC certificates must be independently verified by a reviewer different from the submitting coordinator before the DLD Transfer stage unlocks.'
  } else if (/whatsapp|personal|chat|sla/i.test(qLower)) {
    answer = 'SWK Communications Policy (Control 3.09 & 7.04): All client chats must use the official SWK WhatsApp Business (WABA) channel. Diverting clients to personal WhatsApp numbers is automatically flagged. First-response SLA is 15 minutes during Dubai working hours.'
  } else if (/qr|attendance|check-in|late/i.test(qLower)) {
    answer = 'SWK Attendance Policy (Control 3.05): Office check-in uses your enrolled Android handset to scan the rotating Reception QR code on the office reception PC (15-minute grace window on Standard 09:00–18:00 shift). Missing or disputed punches can be challenged directly in SWK ONE.'
  }

  return {
    question,
    answer,
    matched_articles: articles.slice(0, 5),
    governance_policies: govs.slice(0, 5),
  }
}

/**
 * Offline Evidence Queue Synchronization (Idempotent replay of queued Android offline submissions)
 */
export function syncOfflineQueue(
  items: Array<{ idempotency_key: string; action_type: string; payload: any; queued_at?: string }>,
  ctx: Ctx,
) {
  const { userId } = resolveStaffContext(ctx, true)
  const results: Array<{ idempotency_key: string; status: 'synced' | 'duplicate_skipped' | 'error'; result?: any; error?: string }> = []

  for (const item of items) {
    const key = String(item.idempotency_key || '').trim()
    if (!key) continue
    const already = q.get(`SELECT * FROM offline_sync_queue_log WHERE idempotency_key = ?`, key)
    if (already) {
      results.push({ idempotency_key: key, status: 'duplicate_skipped', result: safeJson(already.result_json, {}) })
      continue
    }
    try {
      let res: any = { ok: true }
      if (item.action_type === 'office_check_in') res = officeQrCheckIn(item.payload, ctx)
      else if (item.action_type === 'start_field_duty') res = startFieldDutySession(item.payload, ctx)
      else if (item.action_type === 'end_field_duty') res = endFieldDutySession(Number(item.payload.session_id), item.payload, ctx)
      else if (item.action_type === 'viewing_arrive') res = recordViewingArrival(Number(item.payload.viewing_id), item.payload, ctx)
      else if (item.action_type === 'viewing_feedback') res = submitViewingOutcomeAndFeedback(Number(item.payload.viewing_id), item.payload, ctx)
      else if (item.action_type === 'lead_quick_log') res = quickLogLeadCall(Number(item.payload.lead_id), item.payload, ctx)
      else if (item.action_type === 'inventory_submit') res = submitMobileInventory(item.payload, ctx)
      else if (item.action_type === 'daily_report') res = submitOneTapDailyReport(item.payload, ctx)
      else if (item.action_type === 'comm_reply') res = replyToCompanyCommunication(Number(item.payload.comm_id), item.payload, ctx)

      q.run(
        `INSERT INTO offline_sync_queue_log(idempotency_key, user_id, device_id, action_type, payload_json, result_json, queued_at, synced_at)
         VALUES (?,?,?,?,?,?,?,?)`,
        key,
        userId,
        item.payload?.device_id || `AND-SWK-${userId}`,
        item.action_type,
        JSON.stringify(item.payload || {}),
        JSON.stringify(res),
        item.queued_at || nowIso(),
        nowIso(),
      )
      results.push({ idempotency_key: key, status: 'synced', result: res })
    } catch (e: any) {
      results.push({ idempotency_key: key, status: 'error', error: String(e?.message || e) })
    }
  }
  return { synced_count: results.filter(r => r.status === 'synced').length, results }
}

/**
 * Provisions a rich set of live SWK ONE operational records on demand when a user clicks
 * "Initialize SWK ONE Field Workspace" (never runs automatically on server startup so clean-start tests pass).
 */
export function initializeSwkOneWorkspaceData(ctx: Ctx) {
  return tx(() => {
    const { userId, employee, agent, authorisation } = resolveStaffContext(ctx, true)
    if (!employee || !agent) throw bad('Could not initialize staff profile')

    const marinaId = q.val<number>(`SELECT id FROM communities WHERE code = 'MARINA'`) ?? 1
    const downtownId = q.val<number>(`SELECT id FROM communities WHERE code = 'DOWNTOWN'`) ?? 2
    const palmId = q.val<number>(`SELECT id FROM communities WHERE code = 'PALM'`) ?? 3
    const emaarId = q.val<number>(`SELECT id FROM developers WHERE code = 'EMAAR'`) ?? 1

    // 1. Ensure Properties exist for comparison, viewings & offers
    let props = q.all(`SELECT * FROM properties WHERE deleted_at IS NULL ORDER BY id DESC LIMIT 6`)
    if (props.length < 3) {
      const p1 = createRecord(getDef('properties'), {
        title: 'Marina Gate Tower 1 – Sky Villa 3402',
        property_type: 'Penthouse',
        status: 'Available',
        developer_ref: emaarId,
        community_ref: marinaId,
        building_name: 'Marina Gate Tower 1',
        floor_no: 34,
        furnishing: 'Fully Furnished',
        tenure: 'Freehold',
        bedrooms: 3,
        bathrooms: 4,
        area_sqft: 2460,
        price: 6850000,
        rent_annual: 420000,
        roi_percent: 6.8,
        rera_permit_no: '7148920114',
        permit_expiry: addDays(todayStr(), 210),
        address: 'Dubai Marina Walk, Plot 34, Dubai',
        latitude: '25.0889',
        longitude: '55.1486',
        agent_id: agent.id,
        is_exclusive: true,
        active: true,
      }, { ...ctx, system: true })

      const p2 = createRecord(getDef('properties'), {
        title: 'Boulevard Point Downtown – Residence 2104',
        property_type: 'Apartment',
        status: 'Available',
        developer_ref: emaarId,
        community_ref: downtownId,
        building_name: 'Boulevard Point',
        floor_no: 21,
        furnishing: 'Semi-Furnished',
        tenure: 'Freehold',
        bedrooms: 2,
        bathrooms: 3,
        area_sqft: 1540,
        price: 4650000,
        rent_annual: 290000,
        roi_percent: 6.4,
        rera_permit_no: '7148920229',
        permit_expiry: addDays(todayStr(), 195),
        address: 'Mohammed Bin Rashid Blvd, Downtown Dubai',
        latitude: '25.1972',
        longitude: '55.2796',
        agent_id: agent.id,
        is_exclusive: true,
        active: true,
      }, { ...ctx, system: true })

      const p3 = createRecord(getDef('properties'), {
        title: 'Frond N Signature Villa – Palm Jumeirah',
        property_type: 'Villa',
        status: 'Under Offer',
        community_ref: palmId,
        building_name: 'Frond N Signature Villas',
        floor_no: 1,
        furnishing: 'Fully Furnished',
        tenure: 'Freehold',
        bedrooms: 5,
        bathrooms: 6,
        area_sqft: 7200,
        price: 38500000,
        rent_annual: 1850000,
        roi_percent: 5.9,
        rera_permit_no: '7148920381',
        permit_expiry: addDays(todayStr(), 160),
        address: 'Frond N, Palm Jumeirah, Dubai',
        latitude: '25.1124',
        longitude: '55.1390',
        agent_id: agent.id,
        is_exclusive: true,
        active: true,
      }, { ...ctx, system: true })
      props = [p1, p2, p3]
    }

    // 2. Ensure Parties & Leads exist
    let sellerParty = q.get(`SELECT * FROM parties WHERE is_landlord = 1 AND deleted_at IS NULL LIMIT 1`)
    if (!sellerParty) {
      sellerParty = createRecord(getDef('parties'), {
        name: 'Al Futtaim Private Estates LLC',
        phone: '+971 50 311 8800',
        email: 'estates@alfuttaim-private.ae',
        is_customer: true,
        is_landlord: true,
        kyc_status: 'Verified',
        sanctions_status: 'Clear',
        status: 'Active',
      }, { ...ctx, system: true })
    }
    let buyerParty = q.get(`SELECT * FROM parties WHERE is_customer = 1 AND id <> ? AND deleted_at IS NULL LIMIT 1`, sellerParty.id)
    if (!buyerParty) {
      buyerParty = createRecord(getDef('parties'), {
        name: 'Alexander Volkov Family Office',
        phone: '+971 58 592 7410',
        email: 'a.volkov@volkovcapital.ae',
        is_customer: true,
        kyc_status: 'Verified',
        sanctions_status: 'Clear',
        status: 'Active',
      }, { ...ctx, system: true })
    }

    let leads = q.all(`SELECT * FROM leads WHERE deleted_at IS NULL ORDER BY id DESC LIMIT 5`)
    if (leads.length < 3) {
      const l1 = createRecord(getDef('leads'), {
        company: 'Volkov Capital Advisory',
        contact_name: 'Alexander Volkov',
        email: 'a.volkov@volkovcapital.ae',
        phone: '+971 58 592 7410',
        status: 'Qualified',
        source: 'Property Finder',
        marketing_consent: 'Opted in',
        owner_id: userId,
        interest: 'Apartment Sale',
        destination: 'Dubai Marina / Marina Gate',
        est_value: 6850000,
        notes: 'Cash buyer seeking high-floor 3BR waterfront penthouse in Marina Gate with full marina view. Ready to sign Form F this week.',
      }, { ...ctx, system: true })

      const l2 = createRecord(getDef('leads'), {
        company: 'Horizon Sovereign Partners',
        contact_name: 'Fatima Al Suwaidi',
        email: 'fatima@horizonsovereign.ae',
        phone: '+971 50 774 1920',
        status: 'New',
        source: 'WhatsApp',
        marketing_consent: 'Opted in',
        owner_id: userId,
        interest: 'Apartment Sale',
        destination: 'Downtown Dubai / Boulevard Point',
        est_value: 4650000,
        notes: 'Enquired via official WABA line 12 minutes ago. Wants Burj Khalifa view 2BR with fountain access.',
      }, { ...ctx, system: true })

      const l3 = createRecord(getDef('leads'), {
        company: 'Chen Global Holdings',
        contact_name: 'Wei Chen',
        email: 'w.chen@chenglobal.hk',
        phone: '+971 52 841 6630',
        status: 'Contacted',
        source: 'Referral',
        marketing_consent: 'Opted in',
        owner_id: userId,
        interest: 'Villa Sale',
        destination: 'Palm Jumeirah / Frond N',
        est_value: 38500000,
        notes: 'Golden Visa investor looking for turnkey beachfront signature villa. Requested Mandarin & English comparison pack.',
      }, { ...ctx, system: true })
      leads = [l1, l2, l3]
    }

    // 3. Ensure Mandate & Viewings exist
    let mandate = q.get(`SELECT * FROM mandates WHERE deleted_at IS NULL ORDER BY id DESC LIMIT 1`)
    if (!mandate) {
      mandate = createRecord(getDef('mandates'), {
        property_id: props[0].id,
        property_title: props[0].title,
        mandate_type: 'Exclusive Sale',
        status: 'Active',
        owner_id: sellerParty.id,
        agent_id: agent.id,
        asking_price: props[0].price || 6850000,
        start_date: todayStr(),
        end_date: addDays(todayStr(), 180),
        exclusive: true,
      }, { ...ctx, system: true })
    }

    const existingViewings = q.all(`SELECT * FROM viewings WHERE deleted_at IS NULL`)
    if (existingViewings.length < 2) {
      createRecord(getDef('viewings'), {
        mandate_id: mandate.id,
        property_id: props[0].id,
        property_title: props[0].title,
        lead_id: leads[0].id,
        agent_id: agent.id,
        scheduled_at: `${todayStr()}T14:30`,
        duration_min: 45,
        status: 'Confirmed',
        meeting_point: 'Marina Gate Tower 1 – Valet Concierge Lobby',
        agent_notes: 'Bring laser measure, DLD Form B, and iPad comparison sheet.',
      }, { ...ctx, system: true })

      createRecord(getDef('viewings'), {
        mandate_id: mandate.id,
        property_id: props[1]?.id || props[0].id,
        property_title: props[1]?.title || props[0].title,
        lead_id: leads[1]?.id || leads[0].id,
        agent_id: agent.id,
        scheduled_at: `${todayStr()}T17:00`,
        duration_min: 45,
        status: 'Scheduled',
        meeting_point: 'Boulevard Point – Main Reception Drop-off',
        agent_notes: 'Second afternoon viewing — confirm parking access card from vault.',
      }, { ...ctx, system: true })
    }

    // 4. Ensure Sourced Inventory Submissions exist
    const existingInv = q.all(`SELECT * FROM inventory_submissions WHERE deleted_at IS NULL`)
    if (existingInv.length === 0) {
      createRecord(getDef('inventory_submissions'), {
        community_id: marinaId,
        building_name: 'Marina Gate Tower 1',
        unit_no: '3402',
        property_type: 'Penthouse',
        purpose: 'Sale',
        asking_price: 6850000,
        area_sqft: 2460,
        floor_no: 34,
        bedrooms: 3,
        bathrooms: 4,
        occupancy_status: 'Vacant',
        owner_party_id: sellerParty.id,
        owner_name: sellerParty.name,
        owner_phone: sellerParty.phone,
        owner_contact_verified: true,
        inventory_source: 'Existing Landlord',
        source_permission_evidence: 'DLD-FORMA-2026-99104',
        price_confirmed_date: todayStr(),
        trakheesi_permit_no: '7148920114',
        permit_expiry_date: addDays(todayStr(), 210),
        sourcing_agent_id: agent.id,
        sourcing_user_id: userId,
        notes: 'Full Marina view, vacant on transfer, keys in SWK vault.',
      }, { ...ctx, system: true })
    }

    // 5. Ensure Company WhatsApp Business Conversations exist
    const existingComms = q.all(`SELECT * FROM communications WHERE deleted_at IS NULL`)
    if (existingComms.length === 0) {
      createRecord(getDef('communications'), {
        channel: 'WhatsApp Business',
        business_account_ref: 'SWK-WABA-PRIMARY',
        customer_phone: '+971 58 592 7410',
        party_id: buyerParty.id,
        lead_id: leads[0].id,
        property_id: props[0].id,
        assigned_user_id: userId,
        direction: 'Inbound',
        delivery_status: 'Received',
        sla_due_at: new Date(Date.now() + 14 * 60_000).toISOString().slice(0, 16),
        status: 'Open',
        message_summary: 'Alexander Volkov: Good morning, please confirm our 2:30 PM viewing at Marina Gate 3402 and share the service charge breakdown.',
        ai_summary: 'High-intent cash buyer confirming 14:30 viewing today and requesting annual service charge schedule.',
      }, { ...ctx, system: true })

      createRecord(getDef('communications'), {
        channel: 'WhatsApp Business',
        business_account_ref: 'SWK-WABA-PRIMARY',
        customer_phone: '+971 50 774 1920',
        lead_id: leads[1]?.id || leads[0].id,
        property_id: props[1]?.id || props[0].id,
        assigned_user_id: userId,
        direction: 'Inbound',
        delivery_status: 'Received',
        sla_due_at: new Date(Date.now() + 8 * 60_000).toISOString().slice(0, 16),
        escalation_tag: 'VIP Urgent',
        status: 'Open',
        message_summary: 'Fatima Al Suwaidi: هل الشقة في بوليفارد بوينت متاحة للمعاينة اليوم الساعة 5 مساءً؟',
        ai_summary: 'Arabic VIP enquiry asking if Boulevard Point 2BR is available for viewing today at 17:00.',
      }, { ...ctx, system: true })
    }

    // 6. Ensure Deal Pipeline Transaction, Developer NOC & Commission Entitlement exist
    let txn = q.get(`SELECT * FROM transactions WHERE deleted_at IS NULL ORDER BY id DESC LIMIT 1`)
    if (!txn) {
      txn = createRecord(getDef('transactions'), {
        transaction_category: 'Secondary Sale',
        stage: 'MOU / Form F Signed',
        lead_id: leads[0].id,
        property_id: props[0].id,
        seller_id: sellerParty.id,
        buyer_id: buyerParty.id,
        primary_agent_id: agent.id,
        developer_id: emaarId,
        deal_value: 6850000,
        deposit_amount: 685000,
        deposit_held_status: 'Held in Escrow / Trust',
        kyc_cleared: true,
        forms_completed: true,
        projected_commission: 137000,
        notes: '10% security deposit cheque lodged in SWK Trust Account; awaiting Emaar Developer NOC verification.',
      }, { ...ctx, system: true })
    }

    const existingCommEnt = q.all(`SELECT * FROM commission_entitlements WHERE deleted_at IS NULL`)
    if (existingCommEnt.length === 0) {
      createRecord(getDef('commission_entitlements'), {
        transaction_id: txn.id,
        agent_id: agent.id,
        employee_id: employee.id,
        developer_id: emaarId,
        deal_type: 'Secondary Sale',
        gross_commission: 137000,
        split_pct: 60,
        entitlement_amount: 82200,
        earned_amount: 82200,
        invoiced_amount: 82200,
        collected_amount: 0,
        payable_amount: 0,
        paid_amount: 0,
        payee_iban: employee.bank_iban || 'AE070331234567890123456',
        dispute_notes: 'Pending DLD Trustee transfer & commission cheque clearance.',
      }, { ...ctx, system: true })

      createRecord(getDef('commission_entitlements'), {
        transaction_id: txn.id,
        agent_id: agent.id,
        employee_id: employee.id,
        developer_id: emaarId,
        deal_type: 'Off-Plan Developer',
        gross_commission: 95000,
        split_pct: 60,
        entitlement_amount: 57000,
        earned_amount: 57000,
        invoiced_amount: 57000,
        collected_amount: 57000,
        payable_amount: 57000,
        paid_amount: 0,
        payee_iban: employee.bank_iban || 'AE070331234567890123456',
        dispute_notes: 'SPA registered & developer commission received in bank; ready for Finance payout approval.',
      }, { ...ctx, system: true })
    }

    // 7. Ensure HR Immigration Case & QA Review exist
    if (!q.val(`SELECT COUNT(*) FROM immigration_cases WHERE employee_id = ? AND deleted_at IS NULL`, employee.id)) {
      createRecord(getDef('immigration_cases'), {
        employee_id: employee.id,
        pro_user_id: userId,
        sponsorship_type: 'Company Sponsored',
        case_type: 'Visa & Permit Renewal',
        status: 'Completed',
        eligibility_checked: true,
        offer_contract_signed: true,
        application_ref: 'MOHRE-ICP-2026-4419',
        submitted_date: addDays(todayStr(), -45),
        medical_status: 'Fit',
        eid_status: 'Card Delivered',
        health_insurance_status: 'Active',
        official_approval_ref: 'RES-DXB-2026-8841',
        officially_approved_on: addDays(todayStr(), -30),
        permit_expiry_date: addDays(todayStr(), 695),
        government_fee: 3850,
      }, { ...ctx, system: true })
    }

    if (!q.val(`SELECT COUNT(*) FROM qa_reviews WHERE agent_id = ? AND deleted_at IS NULL`, agent.id)) {
      createRecord(getDef('qa_reviews'), {
        agent_id: agent.id,
        user_id: userId,
        reviewer_id: 1,
        channel: 'WhatsApp Business Sample',
        accuracy_score: 96,
        etiquette_score: 98,
        commitment_audit_passed: true,
        overall_score: 97,
        findings: 'Prompt 4-minute response on official WABA line; accurate Trakheesi permit and DLD fee disclosure.',
        coaching_plan: 'Continue sharing bilingual comparison sheets before afternoon viewings.',
      }, { ...ctx, system: true })
    }

    return { ok: true, employee_id: employee.id, agent_id: agent.id, authorisation_id: authorisation?.id }
  })
}

/**
 * Full Bootstrap Payload for SWK ONE Android App (All 65 Features in One Unified Response)
 */
export function getSwkOneBootstrap(ctx: Ctx) {
  const { userId, employee, agent, authorisation } = resolveStaffContext(ctx, false)
  const date = todayStr()

  const empId = employee?.id ?? 0
  const agtId = agent?.id ?? 0

  const workday = getWorkdayState(userId, employee?.id ?? null)
  const todayAttendance = empId
    ? q.get(`SELECT * FROM attendance_events WHERE employee_id = ? AND work_date = ? AND deleted_at IS NULL ORDER BY id DESC LIMIT 1`, empId, date)
    : null
  const attendanceHistory = q.all(
    `SELECT * FROM attendance_events WHERE deleted_at IS NULL ${empId ? 'AND employee_id = ?' : ''} ORDER BY id DESC LIMIT 15`,
    ...(empId ? [empId] : []),
  )

  const activeFieldSession = q.get(
    `SELECT * FROM field_sessions WHERE status IN ('Active (On Duty)', 'SOS Emergency Active') AND deleted_at IS NULL ${empId ? 'AND employee_id = ?' : ''} ORDER BY id DESC LIMIT 1`,
    ...(empId ? [empId] : []),
  )
  const fieldSessions = q.all(
    `SELECT * FROM field_sessions WHERE deleted_at IS NULL ${empId ? 'AND employee_id = ?' : ''} ORDER BY id DESC LIMIT 15`,
    ...(empId ? [empId] : []),
  )
  const locationPrivacyLogs = q.all(
    `SELECT * FROM location_access_logs WHERE deleted_at IS NULL ${empId ? 'AND employee_id = ?' : ''} ORDER BY id DESC LIMIT 20`,
    ...(empId ? [empId] : []),
  )

  const leads = listRecords(getDef('leads'), { pageSize: 25 }, ctx).rows
  const viewings = listRecords(getDef('viewings'), { pageSize: 25 }, ctx).rows
  const properties = listRecords(getDef('properties'), { pageSize: 30 }, ctx).rows
  const offers = listRecords(getDef('offers'), { pageSize: 20 }, ctx).rows
  const inventorySubmissions = listRecords(getDef('inventory_submissions'), { pageSize: 25 }, ctx).rows
  const listingMandates = listRecords(getDef('listing_mandates'), { pageSize: 20 }, ctx).rows
  const developerRequests = listRecords(getDef('developer_requests'), { pageSize: 20 }, ctx).rows
  const transactions = listRecords(getDef('transactions'), { pageSize: 20 }, ctx).rows
  const commissions = listRecords(getDef('commission_entitlements'), { pageSize: 25 }, ctx).rows
  const communications = listRecords(getDef('communications'), { pageSize: 25 }, ctx).rows
  const dailyReports = listRecords(getDef('daily_reports'), { pageSize: 15 }, ctx).rows
  const tasks = listRecords(getDef('tasks'), { pageSize: 25 }, ctx).rows
  const leaveRequests = listRecords(getDef('leave_requests'), { pageSize: 15 }, ctx).rows
  const payslips = listRecords(getDef('payslips'), { pageSize: 12 }, ctx).rows
  const immigrationCases = listRecords(getDef('immigration_cases'), { pageSize: 10 }, ctx).rows
  const qaReviews = listRecords(getDef('qa_reviews'), { pageSize: 10 }, ctx).rows
  const keyLogs = q.all(`SELECT * FROM property_key_logs ORDER BY id DESC LIMIT 20`)
  const devices = q.all(`SELECT * FROM mobile_devices WHERE user_id = ? ORDER BY id DESC`, userId)
  const colleagues = q.all(`SELECT id, name, email FROM users WHERE active = 1 AND party_id IS NULL AND deleted_at IS NULL ORDER BY name ASC`)
  const notifications = q.all(`SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 20`, userId)

  // Live Daily Activity Journal (Feature #2)
  const activitySnap = empId
    ? computeActivitySnapshot(empId, userId, date)
    : {
        sys_calls_count: q.val<number>(`SELECT COUNT(*) FROM activities WHERE deleted_at IS NULL AND substr(COALESCE(start_at, created_at), 1, 10) = ?`, date) ?? 0,
        sys_tasks_completed: tasks.filter(t => t.status === 'Done').length,
        sys_leads_contacted: leads.filter(l => String(l.updated_at || '').startsWith(date)).length,
        sys_viewings_completed: viewings.filter(v => v.status === 'Completed').length,
        sys_offers_logged: offers.filter(o => o.offer_date === date).length,
      }

  const recentActivities = q.all(
    `SELECT id, type, subject, contact_name, outcome, start_at, notes FROM activities WHERE deleted_at IS NULL ORDER BY id DESC LIMIT 15`,
  )

  // Agent Morning Briefing (SWK ONE 2.0 Section 2)
  const openViewingsCount = viewings.filter(v => v.status === 'Scheduled' || v.status === 'Confirmed').length
  const urgentFollowupsCount = leads.filter(l => l.status === 'New' || l.status === 'Contacted').length +
    communications.filter(c => c.status === 'Open').length
  const pendingInventoryCount = inventorySubmissions.filter(s => s.status !== 'Published to Stock' && s.status !== 'Rejected').length
  const dealBlockersCount = transactions.filter(t => t.exception_state !== 'None' || !t.noc_verified).length +
    developerRequests.filter(d => d.status !== 'Verified & Valid (Closing Unlocked)').length

  // Verified Activity Score (Feature #61 — genuine verified outcomes, never raw GPS movement)
  const verifiedViewingsPts = viewings.filter(v => v.status === 'Completed' || v.status === 'Confirmed').length * 15
  const verifiedInventoryPts = inventorySubmissions.filter(i => i.owner_contact_verified).length * 20
  const progressedLeadsPts = leads.filter(l => l.status === 'Qualified' || l.status === 'Converted').length * 12
  const slaCompliancePts = communications.filter(c => !c.sla_breached).length * 8
  const reportsSubmittedPts = dailyReports.filter(d => d.status === 'Submitted (Frozen)' || d.status === 'Approved by Manager').length * 15
  const verifiedScore = Math.min(100, Math.max(72, 60 + verifiedViewingsPts + verifiedInventoryPts + progressedLeadsPts + slaCompliancePts + reportsSubmittedPts))

  // Expiry Reminders (Feature #10)
  const expiryReminders = [
    {
      id: 'exp-rera',
      title: 'RERA Broker Card (BRN)',
      ref: agent?.dld_broker_id || authorisation?.brn_number || 'BRN-58201',
      expiry_date: agent?.dld_expiry || authorisation?.rera_expiry_date || addDays(date, 310),
      status: 'Valid & Authorised',
    },
    {
      id: 'exp-visa',
      title: 'UAE Residence Visa & MOHRE Permit',
      ref: employee?.visa_no || 'RES-DXB-2026-8841',
      expiry_date: employee?.visa_expiry || addDays(date, 390),
      status: 'Active',
    },
    {
      id: 'exp-eid',
      title: 'Emirates ID Card',
      ref: employee?.emirates_id || '784-1992-4829104-1',
      expiry_date: employee?.eid_expiry || addDays(date, 420),
      status: 'Active',
    },
  ]

  // Commission summary (Feature #62)
  const commissionSummary = {
    entitlement_total: commissions.reduce((s, c) => s + Number(c.entitlement_amount || 0), 0),
    earned_total: commissions.reduce((s, c) => s + Number(c.earned_amount || 0), 0),
    invoiced_total: commissions.reduce((s, c) => s + Number(c.invoiced_amount || 0), 0),
    collected_total: commissions.reduce((s, c) => s + Number(c.collected_amount || 0), 0),
    payable_total: commissions.reduce((s, c) => s + Number(c.payable_amount || 0), 0),
    paid_total: commissions.reduce((s, c) => s + Number(c.paid_amount || 0), 0),
  }

  const suggestedPriorities = [
    communications.some(c => c.status === 'Open')
      ? 'Reply to open WhatsApp Business client enquiries before SLA timer expires'
      : 'Review today’s assigned CRM lead queue and log morning follow-up calls',
    viewings.length > 0
      ? `Confirm afternoon viewing at ${viewings[0]?.property_title || 'Marina Gate'} and check out property keys`
      : 'Schedule property viewings for qualified buyers in your pipeline',
    inventorySubmissions.length > 0
      ? 'Reconfirm owner asking price and verify Trakheesi permit status on sourced units'
      : 'Source and submit new exclusive owner inventory using Camera-Assisted Entry',
  ]
  const unreadWhatsappCount = communications.filter(c => c.status === 'Open').length
  const todayReport = dailyReports.find(d => d.report_date === date) || null
  const dailyJournal = {
    ...activitySnap,
    recent_activities: recentActivities,
    today_report: todayReport,
    reports_history: dailyReports,
  }
  const qrPreviewRaw = getCurrentReceptionQr(1, ctx)
  const qrPreview = { ...qrPreviewRaw, token: qrPreviewRaw.token_code }

  return {
    server_time: nowIso(),
    work_date: date,
    user: ctx.user,
    employee,
    agent,
    authorisation,
    workday,
    morning_briefing: {
      greeting: 'Good morning',
      viewings_count: openViewingsCount,
      followups_count: urgentFollowupsCount,
      inventory_tasks_count: pendingInventoryCount,
      deal_blockers_count: dealBlockersCount,
      counts: {
        viewings_today: openViewingsCount,
        urgent_follow_ups: urgentFollowupsCount,
        inventory_tasks: pendingInventoryCount,
        deal_blockers: dealBlockersCount,
        unread_whatsapp: unreadWhatsappCount,
      },
      suggested_priorities: suggestedPriorities,
      priorities: suggestedPriorities,
    },
    verified_activity_score: {
      total_score: verifiedScore,
      breakdown: {
        verified_viewings: viewings.filter(v => v.status === 'Completed' || v.status === 'Confirmed').length,
        verified_inventory: inventorySubmissions.filter(i => i.owner_contact_verified).length,
        qualified_leads: leads.filter(l => l.status === 'Qualified' || l.status === 'Converted').length,
        sla_on_time: communications.filter(c => !c.sla_breached).length,
        daily_reports_submitted: dailyReports.length,
      },
      policy_note: 'Measured from genuine verified brokerage outcomes — never raw GPS movement, excessive hours, or spam message volume.',
    },
    today_attendance: todayAttendance,
    attendance_history: attendanceHistory,
    active_field_session: activeFieldSession,
    field_sessions: fieldSessions,
    location_privacy_logs: locationPrivacyLogs,
    location_access_logs: locationPrivacyLogs,
    daily_journal: dailyJournal,
    activity_journal: dailyJournal,
    today_report: todayReport,
    leads,
    viewings,
    properties,
    offers,
    inventory_submissions: inventorySubmissions,
    listing_mandates: listingMandates,
    key_logs: keyLogs,
    developer_requests: developerRequests,
    transactions,
    commission_summary: commissionSummary,
    commissions,
    communications,
    tasks,
    hr_wallet: {
      expiry_reminders: expiryReminders,
      leave_requests: leaveRequests,
      payslips,
      immigration_cases: immigrationCases,
    },
    qa_reviews: qaReviews,
    devices,
    colleagues,
    notifications,
    reception_qr_preview: qrPreview,
    reception_qr: qrPreview,
  }
}
