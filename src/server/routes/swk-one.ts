import type { FastifyInstance } from 'fastify'
import { q, tx } from '../db'
import { nowIso } from '../util'
import { body, idOf, need } from './helpers'
import {
  askKnowledgeAssistant,
  cameraExtractInventoryFields,
  checkDuplicateInventoryUnit,
  confirmFieldSafetyCheckIn,
  endFieldDutySession,
  escalateCustomerComplaint,
  executeShiftHandover,
  generateMultilingualAiDraft,
  getCurrentReceptionQr,
  getSwkOneBootstrap,
  ingestDutyLocationBatch,
  initializeSwkOneWorkspaceData,
  logPropertyKeyHandover,
  officeCheckOut,
  officeQrCheckIn,
  quickLogLeadCall,
  reconfirmInventoryPrice,
  registerMobileDevice,
  replyToCompanyCommunication,
  reportViewingNoShowOrDelay,
  requestAttendanceCorrection,
  setWorkdayMode,
  startFieldDutySession,
  submitMobileInventory,
  submitMobileLeaveRequest,
  submitMobileOffer,
  submitOneTapDailyReport,
  submitViewingOutcomeAndFeedback,
  syncOfflineQueue,
  toggleChecklistItem,
  triggerFieldEmergencySos,
  withdrawInventoryByOwner,
  recordViewingArrival,
  getCheckoutGateStatus,
} from '../domain/swk-one'
import { DUBAI_AREAS_24 } from './swk-ops'

export default async function (app: FastifyInstance) {
  // 1. Bootstrap & Workspace Initialization
  app.get('/api/swk-one/bootstrap', async req => getSwkOneBootstrap(req.ctx))
  app.post('/api/swk-one/initialize', async req => ({ ok: true, data: initializeSwkOneWorkspaceData(req.ctx) }))

  // 2. Reception QR Terminal & Office Attendance
  // Only reception / HR staff may read the live code: a phone that can fetch it by itself would not prove presence in the office.
  app.get('/api/swk-one/reception-qr/current', async req => {
    need(req, 'hr', 'edit')
    const branchId = Number((req.query as any)?.branch_id || 1)
    const qr = tx(() => getCurrentReceptionQr(branchId, req.ctx))
    return { ...qr, token: qr.token_code }
  })

  const handleOfficeCheckIn = async (req: any) => {
    const b = body<any>(req)
    const res = tx(() =>
      officeQrCheckIn(
        {
          qr_code_or_token: b.qr_code_or_token || b.qr_token || b.short_code,
          device_id: b.device_id,
          network_ssid: b.network_ssid || b.wifi_ssid || b.network_type,
          gps_lat: b.gps_lat ? String(b.gps_lat) : b.lat ? String(b.lat) : undefined,
          gps_lng: b.gps_lng ? String(b.gps_lng) : b.lng ? String(b.lng) : undefined,
          gps_accuracy_m: b.gps_accuracy_m ?? b.accuracy_m,
          shift_name: b.shift_name,
          client_variable_hours: b.client_variable_hours,
          variable_hours_reason: b.variable_hours_reason,
        } as any,
        req.ctx
      )
    )
    return {
      ...res,
      verification: res.verified ? 'Verified' : 'Doubtful (Flagged for Review)',
      event: res.attendance_event,
    }
  }
  app.post('/api/swk-one/attendance/office-check-in', handleOfficeCheckIn)
  app.post('/api/swk-one/attendance/qr-check-in', handleOfficeCheckIn)

  const handleOfficeCheckOut = async (req: any) => {
    const b = (req.body ?? {}) as any
    return tx(() => officeCheckOut(req.ctx, {
      lat: b.lat !== undefined ? String(b.lat) : undefined,
      lng: b.lng !== undefined ? String(b.lng) : undefined,
      client_variable_hours: b.client_variable_hours,
      variable_hours_reason: b.variable_hours_reason,
    }))
  }
  app.post('/api/swk-one/attendance/office-check-out', handleOfficeCheckOut)
  app.post('/api/swk-one/attendance/check-out', handleOfficeCheckOut)
  app.get('/api/swk-one/attendance/checkout-gate', async req => getCheckoutGateStatus(req.ctx))
  app.get('/api/swk-one/area-companion', async req => {
    const code = String((req.query as any)?.code || 'PALM').toUpperCase()
    const area = DUBAI_AREAS_24.find(a => a.code === code || a.name.toUpperCase().includes(code)) || DUBAI_AREAS_24[0]
    return { area, areas: DUBAI_AREAS_24 }
  })

  app.post('/api/swk-one/attendance/:id/correction', async req => {
    const b = body<{ reason: string; check_in?: string; check_out?: string }>(req)
    return tx(() => requestAttendanceCorrection(idOf((req.params as any).id), b.reason || '', b.check_in, b.check_out, req.ctx))
  })

  // 3. Workday Presence Mode, Checklists & Shift Handover
  app.post('/api/swk-one/workday/mode', async req => {
    const b = body<{ presence_mode?: any; mode?: any }>(req)
    return tx(() => setWorkdayMode({ presence_mode: b.presence_mode || b.mode || 'Office Work' }, req.ctx))
  })
  app.post('/api/swk-one/workday/checklist', async req => {
    const b = body<{ list_type: 'workday' | 'onboarding' | 'exit'; item_id: string; done: boolean }>(req)
    return tx(() => toggleChecklistItem(b, req.ctx))
  })
  app.post('/api/swk-one/workday/handover', async req => {
    const b = body<{ to_user_id: number; notes: string }>(req)
    return tx(() => executeShiftHandover({ to_user_id: Number(b.to_user_id), notes: b.notes || '' }, req.ctx))
  })

  // 4. Native Android Field Duty Foreground Service, Batched Telemetry & SOS
  app.post('/api/swk-one/field-duty/start', async req => {
    const b = body<any>(req)
    const session = tx(() =>
      startFieldDutySession(
        {
          ...b,
          lat: b.lat !== undefined ? String(b.lat) : undefined,
          lng: b.lng !== undefined ? String(b.lng) : undefined,
        },
        req.ctx
      )
    )
    return { ok: true, session }
  })

  app.post('/api/swk-one/field-duty/:id/location-batch', async (req, reply) => {
    const b = body<any>(req)
    try {
      const res = tx(() => ingestDutyLocationBatch(idOf((req.params as any).id), b, req.ctx))
      return { ...res, accepted_points: res.batched_points_accepted }
    } catch (e: any) {
      if (/Off-duty location|no longer active/i.test(String(e?.message || ''))) {
        return reply.code(400).send({
          error: e.message,
          rejected_off_duty: true,
        })
      }
      throw e
    }
  })

  app.post('/api/swk-one/field-duty/:id/end', async req => {
    const b = body<any>(req)
    const updated = tx(() =>
      endFieldDutySession(
        idOf((req.params as any).id),
        {
          lat: b.lat !== undefined ? String(b.lat) : undefined,
          lng: b.lng !== undefined ? String(b.lng) : undefined,
          notes: b.notes,
        },
        req.ctx
      )
    )
    return { ...updated, status: 'Completed' }
  })

  app.post('/api/swk-one/field-duty/sos', async req => {
    const b = body<{ session_id?: number; reason: string; lat?: string | number; lng?: string | number }>(req)
    const s = tx(() =>
      triggerFieldEmergencySos(
        {
          session_id: b.session_id,
          reason: b.reason,
          lat: b.lat !== undefined ? String(b.lat) : undefined,
          lng: b.lng !== undefined ? String(b.lng) : undefined,
        },
        req.ctx
      )
    )
    return { ...s, incident_no: s.session_no }
  })

  const handleSafetyCheckIn = async (req: any) => tx(() => confirmFieldSafetyCheckIn(idOf((req.params as any).id), req.ctx))
  app.post('/api/swk-one/field-duty/:id/safety-checkin', handleSafetyCheckIn)
  app.post('/api/swk-one/field-duty/:id/safety-check-in', handleSafetyCheckIn)

  // 5. Verified Viewing Journey (Arrival, Feedback, No-Show, Delay, Confirmation)
  app.post('/api/swk-one/viewings/:id/arrive', async req => {
    const b = body<any>(req)
    const res = tx(() =>
      recordViewingArrival(
        idOf((req.params as any).id),
        {
          lat: b.lat !== undefined ? String(b.lat) : undefined,
          lng: b.lng !== undefined ? String(b.lng) : undefined,
          accuracy_m: b.accuracy_m,
        },
        req.ctx
      )
    )
    return { ok: true, ...res }
  })

  app.post('/api/swk-one/viewings/:id/feedback', async req => {
    const b = body<any>(req)
    const updated = tx(() => submitViewingOutcomeAndFeedback(idOf((req.params as any).id), b, req.ctx))
    return { ok: true, viewing: updated }
  })

  app.post('/api/swk-one/viewings/:id/event', async req => {
    const b = body<{ mode: 'no_show' | 'late_notice' | 'client_confirmed'; minutes_late?: number; note?: string }>(req)
    return tx(() => reportViewingNoShowOrDelay(idOf((req.params as any).id), b, req.ctx))
  })

  // 6. CRM Quick Call Logging & Digital Offers
  app.post('/api/swk-one/leads/:id/quick-log', async req => {
    const b = body<any>(req)
    const res = tx(() => quickLogLeadCall(idOf((req.params as any).id), b, req.ctx))
    return { ok: true, ...res }
  })

  const handleOfferCreate = async (req: any) => {
    const b = body<any>(req)
    return tx(() => submitMobileOffer(b, req.ctx))
  }
  app.post('/api/swk-one/offers/create', handleOfferCreate)
  app.post('/api/swk-one/offers/submit', handleOfferCreate)

  // 7. Inventory Sourcing, Duplicate Check, Camera OCR, Price Reconfirm & Key Vault
  app.get('/api/swk-one/inventory/check-duplicate', async req => {
    const q = (req.query as any) || {}
    return checkDuplicateInventoryUnit(q.building || q.building_name || '', q.unit || q.unit_no || '')
  })
  app.post('/api/swk-one/inventory/check-duplicate', async req => {
    const b = body<{ building_name?: string; building?: string; unit_no?: string; unit?: string }>(req)
    return checkDuplicateInventoryUnit(b.building_name || b.building || '', b.unit_no || b.unit || '')
  })

  app.post('/api/swk-one/inventory/camera-extract', async req => {
    const b = body<{ doc_type?: 'title_deed' | 'form_a' | 'passport'; document_type?: 'title_deed' | 'form_a' | 'passport'; hint_text?: string; building_hint?: string }>(req)
    return cameraExtractInventoryFields(b.doc_type || b.document_type || 'title_deed', b.hint_text || b.building_hint)
  })

  app.post('/api/swk-one/inventory/submit', async req => {
    const b = body<any>(req)
    return tx(() => submitMobileInventory(b, req.ctx))
  })
  app.post('/api/swk-one/inventory/:id/reconfirm-price', async req => {
    const b = body<any>(req)
    return tx(() => reconfirmInventoryPrice(idOf((req.params as any).id), b, req.ctx))
  })
  const handleOwnerWithdraw = async (req: any) => {
    const b = body<{ reason: string }>(req)
    return tx(() => withdrawInventoryByOwner(idOf((req.params as any).id), b.reason || '', req.ctx))
  }
  app.post('/api/swk-one/inventory/:id/owner-withdraw', handleOwnerWithdraw)
  app.post('/api/swk-one/inventory/:id/owner-withdrawal', handleOwnerWithdraw)

  const handleKeyLog = async (req: any) => {
    const b = body<any>(req)
    return tx(() => logPropertyKeyHandover(b, req.ctx))
  }
  app.post('/api/swk-one/keys/log', handleKeyLog)
  app.post('/api/swk-one/inventory/key-log', handleKeyLog)

  // 8. One-Tap End-of-Day Report
  app.post('/api/swk-one/daily-report/one-tap', async req => {
    const b = body<any>(req)
    const report = tx(() =>
      submitOneTapDailyReport(
        {
          outcomes_narrative: String(b.outcomes_narrative || b.self_summary || '').trim(),
          blockers_narrative: b.blockers_narrative || b.blockers || 'None',
          next_day_priorities: String(b.next_day_priorities || '').trim(),
          confidential_escalation: b.confidential_escalation,
        },
        req.ctx
      )
    )
    return { ok: true, report }
  })

  // 9. Company WhatsApp Business & Multilingual AI Replies
  app.post('/api/swk-one/communications/:id/ai-draft', async req => {
    const b = body<{ lang?: 'en' | 'ar' | 'ru' | 'zh' | 'fr'; language?: 'en' | 'ar' | 'ru' | 'zh' | 'fr'; tone?: 'professional' | 'viewing_confirm' | 'offer_followup' }>(req)
    return generateMultilingualAiDraft(idOf((req.params as any).id), b.lang || b.language || 'en', b.tone || 'professional')
  })
  app.post('/api/swk-one/communications/ai-draft', async req => {
    const b = body<{ comm_id: number; lang?: 'en' | 'ar' | 'ru' | 'zh' | 'fr'; language?: 'en' | 'ar' | 'ru' | 'zh' | 'fr'; tone?: 'professional' | 'viewing_confirm' | 'offer_followup' }>(req)
    return generateMultilingualAiDraft(Number(b.comm_id || 1), b.lang || b.language || 'en', b.tone || 'professional')
  })
  app.post('/api/swk-one/communications/:id/reply', async req => {
    const b = body<{ message: string; language?: string }>(req)
    return tx(() => replyToCompanyCommunication(idOf((req.params as any).id), b, req.ctx))
  })
  app.post('/api/swk-one/communications/escalate', async req => {
    const b = body<any>(req)
    return tx(() => escalateCustomerComplaint(b, req.ctx))
  })
  app.post('/api/swk-one/communications/:id/escalate', async req => {
    const b = body<any>(req)
    return tx(() => escalateCustomerComplaint({ ...b, comm_id: idOf((req.params as any).id) }, req.ctx))
  })

  // 10. HR Self-Service, Knowledge Assistant, Device Registration & Offline Sync
  const handleLeave = async (req: any) => {
    const b = body<any>(req)
    return tx(() => submitMobileLeaveRequest(b, req.ctx))
  }
  app.post('/api/swk-one/hr/leave', handleLeave)
  app.post('/api/swk-one/hr/leave-request', handleLeave)

  app.post('/api/swk-one/knowledge/ask', async req => {
    const b = body<{ question: string }>(req)
    return askKnowledgeAssistant(b.question || '')
  })

  const handleRegisterDevice = async (req: any) => {
    const b = body<any>(req)
    const dev = tx(() => registerMobileDevice(b, req.ctx))
    return { ok: true, device: { ...dev, trust_status: dev.status === 'Trusted' ? 'Enrolled' : dev.status } }
  }
  app.post('/api/swk-one/devices/register', handleRegisterDevice)
  app.post('/api/swk-one/device/register', handleRegisterDevice)

  /**
   * Offline queue replay. Each queued item carries the endpoint it was meant for; it is replayed through that endpoint
   * (so it gets the same validation, ownership and audit rules as an online request) and logged under its idempotency key.
   * Items without an endpoint fall back to the typed handlers in the domain layer.
   */
  const REPLAYABLE = new RegExp('^/api/swk-one/(' + [
    'attendance/(office-check-in|qr-check-in|office-check-out|check-out)',
    'workday/(mode|checklist|handover)',
    'field-duty/(start|sos)', 'field-duty/\\d+/(location-batch|end|safety-check-in|safety-checkin)',
    'viewings/\\d+/(arrive|feedback|event)', 'leads/\\d+/quick-log',
    'offers/(create|submit)', 'inventory/submit', 'inventory/\\d+/(reconfirm-price|owner-withdraw|owner-withdrawal)',
    'keys/log', 'inventory/key-log', 'daily-report/one-tap',
    'communications/(\\d+/)?(reply|escalate)', 'communications/escalate', 'hr/(leave|leave-request)',
    'attendance/\\d+/correction',
  ].join('|') + ')$')

  app.post('/api/swk-one/offline/sync', async req => {
    const b = body<{ items: any[]; device_id?: string }>(req)
    const items = (Array.isArray(b.items) ? b.items : []).slice(0, 100)
    const results: Array<{ idempotency_key: string; status: string; result?: any; error?: string }> = []
    const forwarded: Record<string, string> = { 'x-swk-client': String(req.headers['x-swk-client'] || 'android') }
    for (const h of ['x-swk-session', 'cookie', 'authorization'] as const) if (typeof req.headers[h] === 'string') forwarded[h] = req.headers[h] as string

    for (const i of items) {
      const key = String(i?.idempotency_key || i?.client_queue_id || '').trim()
      if (!key) { results.push({ idempotency_key: '', status: 'error', error: 'Queued item has no idempotency key' }); continue }
      const done = q.get('SELECT result_json FROM offline_sync_queue_log WHERE idempotency_key = ? AND user_id = ?', key, req.user!.id)
      if (done) { results.push({ idempotency_key: key, status: 'already_synced' }); continue }
      const endpoint = typeof i.endpoint === 'string' ? i.endpoint.split('?')[0] : ''
      if (endpoint) {
        if (!REPLAYABLE.test(endpoint)) { results.push({ idempotency_key: key, status: 'error', error: 'This action cannot be replayed from the offline queue' }); continue }
        const res = await app.inject({ method: 'POST', url: endpoint, payload: { ...(i.payload || {}), device_id: i.payload?.device_id || b.device_id }, headers: forwarded })
        const out = res.json?.() ?? {}
        if (res.statusCode >= 200 && res.statusCode < 300) {
          q.run(`INSERT INTO offline_sync_queue_log(idempotency_key, user_id, device_id, action_type, payload_json, result_json, queued_at, synced_at) VALUES (?,?,?,?,?,?,?,?)`,
            key, req.user!.id, String(i.payload?.device_id || b.device_id || ''), endpoint, JSON.stringify(i.payload || {}), JSON.stringify(out), i.queued_at || nowIso(), nowIso())
          results.push({ idempotency_key: key, status: 'synced', result: out })
        } else {
          results.push({ idempotency_key: key, status: 'error', error: String(out?.error || `Rejected (${res.statusCode})`) })
        }
        continue
      }
      const typed = tx(() => syncOfflineQueue([{
        idempotency_key: key, action_type: i.action_type,
        payload: { ...(i.payload || {}), device_id: i.payload?.device_id || b.device_id }, queued_at: i.queued_at,
      }], req.ctx))
      results.push(...typed.results.map(r => ({ ...r, status: r.status === 'duplicate_skipped' ? 'already_synced' : r.status })))
    }
    return { synced_count: results.filter(r => r.status === 'synced').length, results }
  })
}
