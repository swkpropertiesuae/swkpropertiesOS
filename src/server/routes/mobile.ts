/** Native client conveniences. Identity is always derived from the server session. */
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { q, tx } from '../db'
import { bad, forbidden, nowIso, todayStr } from '../util'
import { getDef, createRecord, patchRecord, listRecords, can } from '../engine'
import { submitDailyReport } from '../domain/enterprise'
import { need, idOf } from './helpers'

const point = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), accuracy: z.number().positive().max(100), capturedAt: z.string().datetime(), mock: z.boolean() })
// Existing entity engine stores UTC workflow timestamps without an offset.
const instant = (s: string) => Date.parse(/(Z|[+-]\d{2}:\d{2})$/.test(s) ? s : s + 'Z')
function fresh(p: z.infer<typeof point>) {
  if (p.mock) throw bad('Mock location cannot be used as duty evidence')
  const age = Date.now() - Date.parse(p.capturedAt)
  if (age > 90_000 || age < -10_000) throw bad('Obtain a fresh location fix and try again')
}
export default async function (app: FastifyInstance) {
  const employee = (req: any) => {
    const e = q.get('SELECT id FROM employees WHERE user_id = ? AND deleted_at IS NULL AND status IN (?, ?, ?)', req.user.id, 'Active', 'Probation', 'On leave')
    if (!e) throw bad('Ask HR to link your account to an active employee record')
    return e
  }
  const ownSession = (req: any) => {
    need(req, 'hr', 'view')
    const e = employee(req)
    const s = q.get('SELECT * FROM field_sessions WHERE id = ? AND employee_id = ? AND deleted_at IS NULL', idOf(req.params.id), e.id)
    if (!s) throw forbidden('This field assignment is not yours')
    return s
  }
  app.get('/api/mobile/workday', async req => {
    need(req, 'hr', 'view')
    const e = employee(req), day = todayStr()
    tx(() => {
      const active = q.all("SELECT id, scheduled_end FROM field_sessions WHERE employee_id = ? AND status IN ('Active (On Duty)', 'SOS Emergency Active') AND deleted_at IS NULL", e.id)
      for (const s of active) if (!Number.isFinite(instant(s.scheduled_end)) || instant(s.scheduled_end) <= Date.now()) patchRecord(getDef('field_sessions'), s.id, { status: 'Auto-Expired', ended_at: nowIso() }, { ...req.ctx, system: true })
    })
    const scoped = (entity: string, filters: any[]) => can(req.user, getDef(entity).module, 'view') ? listRecords(getDef(entity), { pageSize: 50, filters }, req.ctx).rows : []
    return {
      date: day, employee_id: e.id,
      attendance: scoped('attendance_events', [{ field: 'employee_id', op: 'eq', value: e.id }, { field: 'work_date', op: 'eq', value: day }]),
      reports: scoped('daily_reports', [{ field: 'employee_id', op: 'eq', value: e.id }, { field: 'report_date', op: 'eq', value: day }]),
      field: scoped('field_sessions', [{ field: 'employee_id', op: 'eq', value: e.id }, { field: 'duty_date', op: 'eq', value: day }]),
      tasks: scoped('tasks', [{ field: 'assignee_id', op: 'eq', value: req.user!.id }]),
      office_checkin_configured: ['SWK_OFFICE_LAT', 'SWK_OFFICE_LNG', 'SWK_OFFICE_RADIUS_M'].every(k => !!process.env[k]),
    }
  })
  app.post('/api/mobile/attendance', async req => tx(() => {
    need(req, 'hr', 'view')
    const b = point.extend({ action: z.enum(['in', 'out']) }).parse(req.body)
    fresh(b)
    const lat = Number(process.env.SWK_OFFICE_LAT), lng = Number(process.env.SWK_OFFICE_LNG), radius = Number(process.env.SWK_OFFICE_RADIUS_M)
    if (!['SWK_OFFICE_LAT', 'SWK_OFFICE_LNG', 'SWK_OFFICE_RADIUS_M'].every(k => !!process.env[k]) || !Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(radius) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || radius < 10 || radius > 500) throw bad('Office check-in is not configured. Ask an administrator to set verified office coordinates and radius.')
    const rad = (x: number) => x * Math.PI / 180
    const a = Math.sin(rad(b.lat - lat) / 2) ** 2 + Math.cos(rad(lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - lng) / 2) ** 2
    const distance = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    if (distance + b.accuracy > radius) throw bad('Your location is not accurate enough inside the office check-in area. Move closer and try again.')
    const e = employee(req), day = todayStr()
    const row = q.get('SELECT * FROM attendance_events WHERE employee_id = ? AND work_date = ? AND deleted_at IS NULL ORDER BY id DESC LIMIT 1', e.id, day)
    if (b.action === 'in') {
      if (row) throw bad('An attendance record already exists today. Request a correction if needed.')
      // GPS proximity is evidence, not a verified indoor entry or a dynamic QR proof.
      return createRecord(getDef('attendance_events'), { employee_id: e.id, user_id: req.user!.id, work_date: day, terminal_type: 'Remote Authorised', check_in_at: nowIso(), gps_lat: String(b.lat), gps_lng: String(b.lng), gps_accuracy_m: b.accuracy, manager_verified: false, notes: 'Native GPS proximity check. Indoor presence has not been independently verified.' }, { ...req.ctx, system: true })
    }
    if (!row?.check_in_at || row.check_out_at) throw bad('There is no open office check-in')
    return patchRecord(getDef('attendance_events'), row.id, { check_out_at: nowIso() }, { ...req.ctx, system: true })
  }))
  app.post('/api/mobile/daily-report', async req => tx(() => {
    need(req, 'hr', 'view')
    const b = z.object({ outcomes_narrative: z.string().trim().min(10).max(10000), blockers_narrative: z.string().max(10000).default(''), next_day_priorities: z.string().trim().min(1).max(10000) }).parse(req.body)
    const e = employee(req), day = todayStr()
    const prior = q.get('SELECT id, status FROM daily_reports WHERE employee_id = ? AND report_date = ? AND deleted_at IS NULL ORDER BY id DESC LIMIT 1', e.id, day)
    if (prior && !['Draft', 'Returned for Clarification'].includes(prior.status)) throw bad('Today’s report is already submitted')
    const ctx = { ...req.ctx, system: true }
    const report = prior ? patchRecord(getDef('daily_reports'), prior.id, b, ctx) : createRecord(getDef('daily_reports'), { ...b, employee_id: e.id, user_id: req.user!.id, report_date: day }, ctx)
    return submitDailyReport(report.id, ctx)
  }))
  app.post('/api/mobile/field/:id/start', async req => tx(() => {
    const s = ownSession(req), now = nowIso()
    if (s.status !== 'Scheduled') throw bad('Assignment is not scheduled')
    if (!Number.isFinite(instant(s.scheduled_start)) || !Number.isFinite(instant(s.scheduled_end)) || instant(s.scheduled_start) > Date.now() || instant(s.scheduled_end) <= Date.now()) throw bad('Start this assignment during its scheduled duty window')
    if (q.val<number>("SELECT COUNT(*) FROM field_sessions WHERE employee_id = ? AND id <> ? AND status IN ('Active (On Duty)', 'SOS Emergency Active') AND deleted_at IS NULL", s.employee_id, s.id)) throw bad('End your current field assignment before starting another')
    return patchRecord(getDef('field_sessions'), s.id, { status: 'Active (On Duty)', started_at: now }, { ...req.ctx, system: true })
  }))
  app.post('/api/mobile/field/:id/point', async req => tx(() => {
    const s = ownSession(req), b = point.parse(req.body)
    fresh(b)
    if (!['Active (On Duty)', 'SOS Emergency Active'].includes(s.status) || !Number.isFinite(instant(s.scheduled_end)) || instant(s.scheduled_end) <= Date.now()) throw bad('Location sharing has ended')
    return patchRecord(getDef('field_sessions'), s.id, { last_lat: String(b.lat), last_lng: String(b.lng), gps_accuracy_m: b.accuracy, last_location_at: b.capturedAt, last_location_received_at: nowIso() }, { ...req.ctx, system: true })
  }))
  app.post('/api/mobile/field/:id/end', async req => tx(() => {
    const s = ownSession(req)
    if (!['Active (On Duty)', 'SOS Emergency Active'].includes(s.status)) throw bad('This assignment is not active')
    return patchRecord(getDef('field_sessions'), s.id, { status: 'Completed (Off Duty)', ended_at: nowIso() }, { ...req.ctx, system: true })
  }))
  app.post('/api/mobile/field/:id/sos', async req => tx(() => {
    const s = ownSession(req)
    const b = z.object({ reason: z.string().trim().min(5).max(1000) }).parse(req.body)
    if (!['Active (On Duty)', 'SOS Emergency Active'].includes(s.status) || !Number.isFinite(instant(s.scheduled_end)) || instant(s.scheduled_end) <= Date.now()) throw bad('No active duty assignment')
    return patchRecord(getDef('field_sessions'), s.id, { sos_triggered: true, sos_reason: b.reason, status: 'SOS Emergency Active', review_status: 'Pending Human Review' }, { ...req.ctx, system: true })
  }))
}
