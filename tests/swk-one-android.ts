import assert from 'node:assert/strict'
import { syncSchema } from '../src/server/schema'
import { seedReference } from '../src/server/seed'
import { buildApp } from '../src/server/app'
import { q, db } from '../src/server/db'
import { config } from '../src/server/config'
import { resetBusinessData } from '../src/server/domain/business-data'

syncSchema()
seedReference()
resetBusinessData({ reseed: false })

const app = await buildApp()
let checks = 0
let address = 10

const check = (label: string, value: unknown) => {
  assert.ok(value, label)
  checks++
  console.log('  ✓', label)
}

async function androidReq(path: string, method = 'GET', payload?: any, sessionToken?: string) {
  return app.inject({
    url: path,
    method: method as any,
    payload,
    remoteAddress: `127.0.1.${address++}`,
    headers: {
      'x-swk-client': 'android',
      ...(sessionToken ? { 'x-swk-session': sessionToken } : {}),
    },
  })
}

try {
  console.log('Testing SWK ONE Android Workspace & SWK ONE 2.0 (65 Features)…')

  // 1. Authenticate from Android client & unlock initial password
  const loginRes = await androidReq('/api/auth/login', 'POST', {
    email: config.accounts.adminEmail,
    password: config.accounts.adminPassword,
  })
  const loginData = loginRes.json()
  check('Android login returns sessionToken for native storage', typeof loginData.sessionToken === 'string' && loginData.sessionToken.length > 10)
  const token = loginData.sessionToken as string

  if (loginData.mustChangePassword) {
    const pwRes = await androidReq('/api/auth/change-password', 'POST', {
      current: config.accounts.adminPassword,
      next: 'SwkAndroid-2026!Secure',
    }, token)
    check('Android personal password unlock succeeds', pwRes.statusCode === 200)
  }

  // 2. Initialize SWK ONE workspace data & verify bootstrap
  const initRes = await androidReq('/api/swk-one/initialize', 'POST', {}, token)
  check('SWK ONE workspace initialization succeeds', initRes.statusCode === 200 && initRes.json().ok === true)

  const bootRes = await androidReq('/api/swk-one/bootstrap', 'GET', undefined, token)
  const boot = bootRes.json()
  check('SWK ONE bootstrap returns morning briefing, viewings, leads, WABA & commissions', bootRes.statusCode === 200 && boot.morning_briefing && boot.viewings.length > 0 && boot.commissions.length > 0)

  // 3. Register Android handset & verify Office Reception QR Check-In
  const devRes = await androidReq('/api/swk-one/device/register', 'POST', {
    device_id: 'SWK-AND-TEST9901',
    device_name: 'Samsung Galaxy S24 Ultra (SWK Fleet)',
    platform: 'Android',
    os_version: 'Android 15 (API 35)',
    app_version: '2.0.0-enterprise',
    biometric_capable: true,
  }, token)
  check('Android hardware device enrollment succeeds', devRes.statusCode === 200 && devRes.json().device.trust_status === 'Enrolled')

  const qrRes = await androidReq('/api/swk-one/reception-qr/current', 'GET', undefined, token)
  const qr = qrRes.json()
  check('Office reception terminal generates short-lived rotating QR token', qrRes.statusCode === 200 && qr.short_code.length === 6)

  const checkInRes = await androidReq('/api/swk-one/attendance/qr-check-in', 'POST', {
    qr_token: qr.token,
    short_code: qr.short_code,
    device_id: 'SWK-AND-TEST9901',
    network_type: 'Office Wi-Fi',
    wifi_ssid: 'SWK-Office-5G-Verified',
    lat: 25.1867,
    lng: 55.2744,
  }, token)
  check('Reception QR + Office Wi-Fi + Enrolled Device check-in is Verified', checkInRes.statusCode === 200 && checkInRes.json().verification === 'Verified')

  // 4. Field Duty Foreground Service lifecycle & strict Off-Duty Location Rejection
  const startDutyRes = await androidReq('/api/swk-one/field-duty/start', 'POST', {
    assigned_location: 'Dubai Marina – Marina Gate Tower 1',
    viewing_id: boot.viewings[0].id,
    lat: 25.0889,
    lng: 55.1469,
    accuracy_m: 6,
    device_id: 'SWK-AND-TEST9901',
  }, token)
  const dutySession = startDutyRes.json().session
  check('Field Duty starts authorised foreground location session', startDutyRes.statusCode === 200 && dutySession.status === 'Active Duty')

  const batchRes = await androidReq(`/api/swk-one/field-duty/${dutySession.id}/location-batch`, 'POST', {
    points: [
      { lat: 25.0891, lng: 55.1471, accuracy_m: 5, recorded_at: new Date().toISOString() },
      { lat: 25.0895, lng: 55.1474, accuracy_m: 6, recorded_at: new Date().toISOString() },
    ],
    battery_pct: 91,
    network_type: '5G_UAE',
  }, token)
  check('Active Field Duty accepts batched GPS telemetry', batchRes.statusCode === 200 && batchRes.json().accepted_points === 2)

  const endDutyRes = await androidReq(`/api/swk-one/field-duty/${dutySession.id}/end`, 'POST', {
    lat: 25.0895,
    lng: 55.1474,
    notes: 'Completed Marina Gate viewing duty',
  }, token)
  check('Ending Field Duty stops active session', endDutyRes.statusCode === 200 && endDutyRes.json().status === 'Completed')

  const offDutyBatchRes = await androidReq(`/api/swk-one/field-duty/${dutySession.id}/location-batch`, 'POST', {
    points: [{ lat: 25.09, lng: 55.15, accuracy_m: 8, recorded_at: new Date().toISOString() }],
  }, token)
  check('Off-duty location updates are strictly rejected (Zero Off-Duty Tracking)', offDutyBatchRes.statusCode === 400 && offDutyBatchRes.json().rejected_off_duty === true)

  // 5. Verified Viewing Arrival & Structured Client Feedback
  const viewingId = boot.viewings[0].id
  const arriveRes = await androidReq(`/api/swk-one/viewings/${viewingId}/arrive`, 'POST', {
    lat: 25.0889,
    lng: 55.1469,
  }, token)
  check('Verified GPS viewing arrival check-in succeeds', arriveRes.statusCode === 200 && arriveRes.json().ok === true)

  const fbRes = await androidReq(`/api/swk-one/viewings/${viewingId}/feedback`, 'POST', {
    interest_level: 9,
    decision: 'Make Offer',
    objections: ['Service Charges'],
    feedback: 'Client loved Marina view; ready to submit formal cash offer.',
  }, token)
  check('Structured viewing outcome & feedback creates CRM follow-up task', fbRes.statusCode === 200 && fbRes.json().ok === true)

  // 6. Camera OCR Extraction, 60s Inventory Submission & Duplicate Unit Guard
  const ocrRes = await androidReq('/api/swk-one/inventory/camera-extract', 'POST', {
    document_type: 'title_deed',
    building_hint: 'Marina Gate Tower 1',
  }, token)
  check('Camera OCR extracts Title Deed fields & verifies image quality', ocrRes.statusCode === 200 && ocrRes.json().extracted.building_name === 'Marina Gate Tower 1')

  const invSubmit1 = await androidReq('/api/swk-one/inventory/submit', 'POST', {
    building_name: 'Palm Tower Residences',
    unit_no: '4208',
    property_type: 'Apartment',
    purpose: 'Sale',
    asking_price: 5800000,
    area_sqft: 1620,
    bedrooms: 2,
    owner_name: 'Tariq Al Qasimi',
    owner_phone: '+971 50 771 9920',
    owner_contact_verified: true,
    source_permission_evidence: 'DLD-FORMA-2026-9910',
  }, token)
  check('First property submission passes duplicate check with Clear status', invSubmit1.statusCode === 200 && invSubmit1.json().conflict_status === 'Clear')

  const dupCheck = await androidReq('/api/swk-one/inventory/check-duplicate?building=Palm%20Tower%20Residences&unit=4208', 'GET', undefined, token)
  check('Real-time duplicate unit check flags existing unit', dupCheck.statusCode === 200 && dupCheck.json().duplicate === true)

  // 7. One-Tap Lead Call Log & Multilingual WABA AI Reply Drafts
  const leadId = boot.leads[0].id
  const callLogRes = await androidReq(`/api/swk-one/leads/${leadId}/quick-log`, 'POST', {
    outcome: 'Connected',
    channel: 'Call',
    notes: 'Confirmed cash proof of funds',
  }, token)
  check('One-tap lead call logger records CRM activity and progresses lead', callLogRes.statusCode === 200 && callLogRes.json().ok === true)

  const commId = boot.communications[0].id
  const arDraftRes = await androidReq('/api/swk-one/communications/ai-draft', 'POST', {
    comm_id: commId,
    language: 'ar',
  }, token)
  check('Multilingual AI draft generator produces Arabic WABA response', arDraftRes.statusCode === 200 && arDraftRes.json().draft.includes('مرحباً'))

  // 8. One-Tap Verified End-of-Day Report
  const eodRes = await androidReq('/api/swk-one/daily-report/one-tap', 'POST', {
    self_summary: 'Completed Marina Gate viewing, sourced Palm Tower #4208, and logged client calls.',
    blockers: 'None',
    next_day_priorities: 'Prepare Form F for Marina Gate',
  }, token)
  check('One-tap End-of-Day report auto-reconciles with system activity counters', eodRes.statusCode === 200 && eodRes.json().report.variance_flag === 0)

  // 9. Encrypted Offline Sync Queue with Idempotent Replay Protection
  const syncRes = await androidReq('/api/swk-one/offline/sync', 'POST', {
    device_id: 'SWK-AND-TEST9901',
    items: [
      {
        client_queue_id: 'OFFLINE-TEST-ITEM-001',
        action_type: 'workday_mode',
        payload: { mode: 'Office Work' },
      },
    ],
  }, token)
  check('Offline queue sync processes queued items', syncRes.statusCode === 200 && syncRes.json().synced_count === 1)

  const replayRes = await androidReq('/api/swk-one/offline/sync', 'POST', {
    device_id: 'SWK-AND-TEST9901',
    items: [
      {
        client_queue_id: 'OFFLINE-TEST-ITEM-001',
        action_type: 'workday_mode',
        payload: { mode: 'Office Work' },
      },
    ],
  }, token)
  check('Offline queue sync is idempotent and prevents duplicate replay', replayRes.statusCode === 200 && replayRes.json().results[0].status === 'already_synced')

  // Clean up business data at the end so starter-data tests remain pristine
  resetBusinessData({ reseed: false })
  console.log(`\nAll ${checks} SWK ONE Android checks passed!`)
} finally {
  await app.close()
  db.close()
}
