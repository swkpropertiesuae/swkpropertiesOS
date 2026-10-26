import type { FastifyInstance } from 'fastify'
import { tx } from '../db'
import { body, idOf } from './helpers'
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
} from '../domain/swk-one'

export default async function (app: FastifyInstance) {
  // 1. Bootstrap & Workspace Initialization
  app.get('/api/swk-one/bootstrap', async req => getSwkOneBootstrap(req.ctx))
  app.post('/api/swk-one/initialize', async req => initializeSwkOneWorkspaceData(req.ctx))

  // 2. Reception QR Terminal & Office Attendance
  app.get('/api/swk-one/reception-qr/current', async req => {
    const branchId = Number((req.query as any)?.branch_id || 1)
    return tx(() => getCurrentReceptionQr(branchId, req.ctx))
  })
  app.post('/api/swk-one/attendance/office-check-in', async req => {
    const b = body<any>(req)
    return tx(() => officeQrCheckIn(b, req.ctx))
  })
  app.post('/api/swk-one/attendance/office-check-out', async req => tx(() => officeCheckOut(req.ctx)))
  app.post('/api/swk-one/attendance/:id/correction', async req => {
    const b = body<{ reason: string; check_in?: string; check_out?: string }>(req)
    return tx(() => requestAttendanceCorrection(idOf((req.params as any).id), b.reason || '', b.check_in, b.check_out, req.ctx))
  })

  // 3. Workday Presence Mode, Checklists & Shift Handover
  app.post('/api/swk-one/workday/mode', async req => {
    const b = body<{ presence_mode: any }>(req)
    return tx(() => setWorkdayMode({ presence_mode: b.presence_mode || 'Office Work' }, req.ctx))
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
    return tx(() => startFieldDutySession(b, req.ctx))
  })
  app.post('/api/swk-one/field-duty/:id/location-batch', async req => {
    const b = body<any>(req)
    return tx(() => ingestDutyLocationBatch(idOf((req.params as any).id), b, req.ctx))
  })
  app.post('/api/swk-one/field-duty/:id/end', async req => {
    const b = body<any>(req)
    return tx(() => endFieldDutySession(idOf((req.params as any).id), b, req.ctx))
  })
  app.post('/api/swk-one/field-duty/sos', async req => {
    const b = body<{ session_id?: number; reason: string; lat?: string; lng?: string }>(req)
    return tx(() => triggerFieldEmergencySos(b, req.ctx))
  })
  app.post('/api/swk-one/field-duty/:id/safety-checkin', async req => {
    return tx(() => confirmFieldSafetyCheckIn(idOf((req.params as any).id), req.ctx))
  })

  // 5. Verified Viewing Journey (Arrival, Feedback, No-Show, Delay, Confirmation)
  app.post('/api/swk-one/viewings/:id/arrive', async req => {
    const b = body<any>(req)
    return tx(() => recordViewingArrival(idOf((req.params as any).id), b, req.ctx))
  })
  app.post('/api/swk-one/viewings/:id/feedback', async req => {
    const b = body<any>(req)
    return tx(() => submitViewingOutcomeAndFeedback(idOf((req.params as any).id), b, req.ctx))
  })
  app.post('/api/swk-one/viewings/:id/event', async req => {
    const b = body<{ mode: 'no_show' | 'late_notice' | 'client_confirmed'; minutes_late?: number; note?: string }>(req)
    return tx(() => reportViewingNoShowOrDelay(idOf((req.params as any).id), b, req.ctx))
  })

  // 6. CRM Quick Call Logging & Digital Offers
  app.post('/api/swk-one/leads/:id/quick-log', async req => {
    const b = body<any>(req)
    return tx(() => quickLogLeadCall(idOf((req.params as any).id), b, req.ctx))
  })
  app.post('/api/swk-one/offers/create', async req => {
    const b = body<any>(req)
    return tx(() => submitMobileOffer(b, req.ctx))
  })

  // 7. Inventory Sourcing, Duplicate Check, Camera OCR, Price Reconfirm & Key Vault
  app.post('/api/swk-one/inventory/check-duplicate', async req => {
    const b = body<{ building_name: string; unit_no: string }>(req)
    return checkDuplicateInventoryUnit(b.building_name, b.unit_no)
  })
  app.post('/api/swk-one/inventory/camera-extract', async req => {
    const b = body<{ doc_type: 'title_deed' | 'form_a' | 'passport'; hint_text?: string }>(req)
    return cameraExtractInventoryFields(b.doc_type || 'title_deed', b.hint_text)
  })
  app.post('/api/swk-one/inventory/submit', async req => {
    const b = body<any>(req)
    return tx(() => submitMobileInventory(b, req.ctx))
  })
  app.post('/api/swk-one/inventory/:id/reconfirm-price', async req => {
    const b = body<any>(req)
    return tx(() => reconfirmInventoryPrice(idOf((req.params as any).id), b, req.ctx))
  })
  app.post('/api/swk-one/inventory/:id/owner-withdraw', async req => {
    const b = body<{ reason: string }>(req)
    return tx(() => withdrawInventoryByOwner(idOf((req.params as any).id), b.reason || '', req.ctx))
  })
  app.post('/api/swk-one/keys/log', async req => {
    const b = body<any>(req)
    return tx(() => logPropertyKeyHandover(b, req.ctx))
  })

  // 8. One-Tap End-of-Day Report
  app.post('/api/swk-one/daily-report/one-tap', async req => {
    const b = body<any>(req)
    return tx(() => submitOneTapDailyReport(b, req.ctx))
  })

  // 9. Company WhatsApp Business & Multilingual AI Replies
  app.post('/api/swk-one/communications/:id/ai-draft', async req => {
    const b = body<{ lang?: 'en' | 'ar' | 'ru' | 'zh' | 'fr'; tone?: 'professional' | 'viewing_confirm' | 'offer_followup' }>(req)
    return generateMultilingualAiDraft(idOf((req.params as any).id), b.lang || 'en', b.tone || 'professional')
  })
  app.post('/api/swk-one/communications/:id/reply', async req => {
    const b = body<{ message: string; language?: string }>(req)
    return tx(() => replyToCompanyCommunication(idOf((req.params as any).id), b, req.ctx))
  })
  app.post('/api/swk-one/communications/escalate', async req => {
    const b = body<any>(req)
    return tx(() => escalateCustomerComplaint(b, req.ctx))
  })

  // 10. HR Self-Service, Knowledge Assistant, Device Registration & Offline Sync
  app.post('/api/swk-one/hr/leave', async req => {
    const b = body<any>(req)
    return tx(() => submitMobileLeaveRequest(b, req.ctx))
  })
  app.post('/api/swk-one/knowledge/ask', async req => {
    const b = body<{ question: string }>(req)
    return askKnowledgeAssistant(b.question || '')
  })
  app.post('/api/swk-one/devices/register', async req => {
    const b = body<any>(req)
    return tx(() => registerMobileDevice(b, req.ctx))
  })
  app.post('/api/swk-one/offline/sync', async req => {
    const b = body<{ items: any[] }>(req)
    return tx(() => syncOfflineQueue(Array.isArray(b.items) ? b.items : [], req.ctx))
  })
}
