import assert from 'node:assert/strict'
import { syncSchema } from '../src/server/schema'
import { seedReference } from '../src/server/seed'
import { buildApp } from '../src/server/app'
import { q, db } from '../src/server/db'
import { config } from '../src/server/config'
import { createSession, hashPassword } from '../src/server/auth'
import { createRecord, getDef, SYSTEM_CTX } from '../src/server/engine'
import { resetBusinessData } from '../src/server/domain/business-data'

syncSchema()
seedReference()
await resetBusinessData({ user: null, system: true }, { backup: false })
q.run(
  `UPDATE users SET active = 1, password_hash = ?, must_change_password = 1, totp_secret = NULL, failed_logins = 0, locked_until = NULL WHERE email = ?`,
  hashPassword(config.accounts.adminPassword),
  config.accounts.adminEmail
)

const app = await buildApp()
let checks = 0
const check = (label: string, result: unknown) => { assert.ok(result, label); console.log(`✓ ${label}`); checks++ }
const request = (url: string, method: 'GET' | 'POST' = 'GET', payload?: any, cookie?: string, client = true) => app.inject({ url, method, payload, headers: { ...(cookie ? { cookie } : {}), ...(client ? { 'x-swk-client': 'web' } : {}) } })
try {
  check('anonymous rejected', (await request('/api/mobile/workday')).statusCode === 401)
  const login = await request('/api/auth/login', 'POST', { email: config.accounts.adminEmail, password: config.accounts.adminPassword })
  const userId = login.json().user.id, cookie = `swk_sid=${login.cookies.find(c => c.name === 'swk_sid')!.value}`
  check('temporary password gate applies', (await request('/api/mobile/workday', 'GET', undefined, cookie)).statusCode === 403)
  await request('/api/auth/change-password', 'POST', { current: config.accounts.adminPassword, next: 'Native-Staff-2026!' }, cookie)
  check('unlinked employee fails clearly', (await request('/api/mobile/workday', 'GET', undefined, cookie)).statusCode === 400)
  const emp = createRecord(getDef('employees'), { name: 'Mobile test employee', user_id: userId, status: 'Active' }, SYSTEM_CTX)
  const other = createRecord(getDef('employees'), { name: 'Other employee', status: 'Active' }, SYSTEM_CTX)
  const now = Date.now(), start = new Date(now - 60_000).toISOString(), end = new Date(now + 3600_000).toISOString()
  const field = createRecord(getDef('field_sessions'), { employee_id: emp.id, assigned_location: 'Assigned viewing', scheduled_start: start, scheduled_end: end }, SYSTEM_CTX)
  const otherField = createRecord(getDef('field_sessions'), { employee_id: other.id, assigned_location: 'Private other assignment', scheduled_start: start, scheduled_end: end }, SYSTEM_CTX)
  const workday = await request('/api/mobile/workday', 'GET', undefined, cookie)
  check('workday derives signed-in employee', workday.statusCode === 200 && workday.json().employee_id === emp.id)
  check('workday excludes other employee data', !workday.body.includes('Private other assignment'))
  const point = { lat: 25.21, lng: 55.28, accuracy: 5, capturedAt: new Date().toISOString(), mock: false }
  check('CSRF header required', (await request('/api/mobile/attendance', 'POST', { ...point, action: 'in' }, cookie, false)).statusCode === 403)
  check('office configuration fails closed', (await request('/api/mobile/attendance', 'POST', { ...point, action: 'in' }, cookie)).statusCode === 400)
  process.env.SWK_OFFICE_LAT = '25.21'; process.env.SWK_OFFICE_LNG = '55.28'; process.env.SWK_OFFICE_RADIUS_M = '100'
  for (const [label, override] of [['mock GPS', { mock: true }], ['old location', { capturedAt: new Date(now - 180_000).toISOString() }], ['outside office', { lat: 25.5 }], ['poor accuracy', { accuracy: 101 }]] as const) check(`${label} rejected`, (await request('/api/mobile/attendance', 'POST', { ...point, action: 'in', ...override }, cookie)).statusCode === 400)
  const clock = await request('/api/mobile/attendance', 'POST', { ...point, action: 'in', employee_id: other.id }, cookie)
  check('check-in derives own identity and server time', clock.statusCode === 200 && clock.json().employee_id === emp.id && clock.json().check_in_at)
  check('GPS not mislabelled as verified indoor entry', !clock.json().manager_verified && clock.json().terminal_type === 'Remote Authorised')
  check('duplicate check-in rejected', (await request('/api/mobile/attendance', 'POST', { ...point, action: 'in' }, cookie)).statusCode === 400)
  check('check-out succeeds', (await request('/api/mobile/attendance', 'POST', { ...point, action: 'out' }, cookie)).statusCode === 200)
  check('duplicate check-out rejected', (await request('/api/mobile/attendance', 'POST', { ...point, action: 'out' }, cookie)).statusCode === 400)
  check('other duty cannot start', (await request(`/api/mobile/field/${otherField.id}/start`, 'POST', {}, cookie)).statusCode === 403)
  const started = await request(`/api/mobile/field/${field.id}/start`, 'POST', {}, cookie); check('own duty starts', started.statusCode === 200)
  const parallel = createRecord(getDef('field_sessions'), { employee_id: emp.id, assigned_location: 'Parallel duty', scheduled_start: start, scheduled_end: end }, SYSTEM_CTX)
  check('concurrent duty rejected', (await request(`/api/mobile/field/${parallel.id}/start`, 'POST', {}, cookie)).statusCode === 400)
  check('other duty telemetry rejected', (await request(`/api/mobile/field/${otherField.id}/point`, 'POST', point, cookie)).statusCode === 403)
  const sample = await request(`/api/mobile/field/${field.id}/point`, 'POST', point, cookie)
  check('fresh own telemetry accepted', sample.statusCode === 200)
  check('sample and server receipt timestamps available', sample.json().last_location_at && sample.json().last_location_received_at)
  check('safety flag needs reason', (await request(`/api/mobile/field/${field.id}/sos`, 'POST', {}, cookie)).statusCode === 400)
  const sos = await request(`/api/mobile/field/${field.id}/sos`, 'POST', { reason: 'Need assistance at assigned site' }, cookie)
  check('safety flag recorded', sos.statusCode === 200 && sos.json().sos_triggered)
  q.run('UPDATE field_sessions SET scheduled_end = ? WHERE id = ?', new Date(now - 60_000).toISOString().slice(0, 16), field.id)
  check('expired duty rejects telemetry', (await request(`/api/mobile/field/${field.id}/point`, 'POST', point, cookie)).statusCode === 400)
  check('expired duty rejects safety flag', (await request(`/api/mobile/field/${field.id}/sos`, 'POST', { reason: 'Late sample' }, cookie)).statusCode === 400)
  q.run('UPDATE field_sessions SET scheduled_end = ? WHERE id = ?', end.slice(0, 16), field.id)
  check('duty ends', (await request(`/api/mobile/field/${field.id}/end`, 'POST', {}, cookie)).statusCode === 200)
  check('off-duty telemetry rejected', (await request(`/api/mobile/field/${field.id}/point`, 'POST', point, cookie)).statusCode === 400)
  const report = await request('/api/mobile/daily-report', 'POST', { employee_id: other.id, user_id: 999, outcomes_narrative: 'Completed assigned viewing and follow-ups.', next_day_priorities: 'Confirm the client offer.', sys_calls_count: 1000 }, cookie)
  check('report uses own identity and freezes', report.statusCode === 200 && report.json().employee_id === emp.id && report.json().status === 'Submitted (Frozen)')
  check('fabricated activity discarded', report.json().sys_calls_count !== 1000)
  check('duplicate report rejected', (await request('/api/mobile/daily-report', 'POST', { outcomes_narrative: 'Second report attempted', next_day_priorities: 'Tomorrow' }, cookie)).statusCode === 400)
  const token = createSession(userId); q.run('UPDATE users SET active = 0 WHERE id = ?', userId)
  check('disabled account rejected', (await request('/api/mobile/workday', 'GET', undefined, `swk_sid=${token.token}`)).statusCode === 401)
  q.run(
    `UPDATE users SET active = 1, password_hash = ?, must_change_password = 1, totp_secret = NULL, failed_logins = 0, locked_until = NULL WHERE id = ?`,
    hashPassword(config.accounts.adminPassword),
    userId
  )
  console.log(`${checks} native API checks passed`)
} finally { await app.close(); db.close() }
