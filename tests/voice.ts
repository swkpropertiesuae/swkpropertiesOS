import assert from 'node:assert/strict'
import { syncSchema } from '../src/server/schema'
import { seedReference } from '../src/server/seed'
import { q } from '../src/server/db'
import { setSettings } from '../src/server/settings'
import { createRecord, getDef, SYSTEM_CTX } from '../src/server/engine'
import { ensureAgents } from '../src/server/ai/agents'
import { toolByName } from '../src/server/ai/tools'
import { toolPolicy } from '../src/server/ai/policy'
import { withCall, type VoiceCallState } from '../src/server/ai/voice-context'
import { voiceTurn, voiceEnd, forSpeech, greeting, purgeVoiceData } from '../src/server/integrations/voice'
import { getDef as def, insertRow } from '../src/server/engine'
import { buildApp } from '../src/server/app'

syncSchema(); seedReference(); ensureAgents()

// ---- a scripted model: every LLM request consumes the next scripted reply, so no real provider is called
const queue: any[] = [], seen: any[] = []
const original = globalThis.fetch
globalThis.fetch = async (input, init) => {
  const url = String(input)
  if (!url.startsWith('http://llm.test/')) throw new Error(`unexpected network call: ${url}`)
  const body = JSON.parse(String(init?.body)); seen.push(body)
  const next = queue.shift()
  if (next === 'fail') return new Response('upstream down', { status: 500 })
  if (!next) throw new Error('model called more often than scripted')
  return new Response(JSON.stringify({ choices: [{ message: next }], usage: { total_tokens: 10 } }))
}
const say = (content: string) => ({ content })
const use = (name: string, args: any) => ({ content: '', tool_calls: [{ id: 'c' + Math.random().toString(36).slice(2), function: { name, arguments: JSON.stringify(args) } }] })
const tool = (n: string) => toolByName(n)!
const state = (from: string): VoiceCallState => ({ callRowId: 0, from, partyId: null, leadId: null, ticketId: null, handoff: null, outcome: null })
const row1 = (sql: string, ...a: any[]): any => q.get(sql, ...a)
const count = (sql: string, ...a: any[]) => q.val<number>(sql, ...a) ?? 0

try {
  setSettings({ ai_enabled: true, ai_provider: 'custom', ai_base_url: 'http://llm.test/v1', ai_model: 'scripted', ai_api_key: '', ai_fallback_provider: '' })
  if (!count(`SELECT COUNT(*) FROM users`)) q.run(`INSERT INTO users(id, name, email, password_hash, role_id, active) VALUES (1,'Test Admin','admin@test.local','x',(SELECT id FROM roles ORDER BY id LIMIT 1),1)`)

  // ================================================================ listings tool
  createRecord(getDef('properties'), { title: 'Marina 2BR sea view', property_type: 'Apartment', status: 'Available', community_id: 'Dubai Marina', building_name: 'Marina Gate 1', bedrooms: 2, bathrooms: 2, area_sqft: 1250, price: 1500000, notes: 'OWNER IS DESPERATE, MIN 1.3M', active: true }, SYSTEM_CTX)
  createRecord(getDef('properties'), { title: 'Marina 2BR rented out', property_type: 'Apartment', status: 'Rented', community_id: 'Dubai Marina', bedrooms: 2, price: 1400000, active: true }, SYSTEM_CTX)
  createRecord(getDef('properties'), { title: 'Hills 3BR villa to let', property_type: 'Villa', status: 'Available', community_id: 'Dubai Hills Estate', bedrooms: 3, rent_annual: 280000, active: true }, SYSTEM_CTX)
  const sale = tool('lookup_listings').run({ purpose: 'sale', bedrooms: 2, area: 'Marina' }, { agent: 't' })
  assert.equal(sale.found, 1, 'only the available Marina 2BR is offered for sale'); assert.equal(sale.listings[0].price_aed, 1500000)
  assert.ok(!JSON.stringify(sale).includes('DESPERATE'), 'internal notes never reach a caller')
  assert.equal(tool('lookup_listings').run({ purpose: 'sale', bedrooms: 2, area: 'Marina', max_price_aed: 1000000 }, { agent: 't' }).found, 0, 'budget ceiling respected')
  const rent = tool('lookup_listings').run({ purpose: 'rent' }, { agent: 't' })
  assert.equal(rent.found, 1); assert.equal(rent.listings[0].rent_per_year_aed, 280000)

  // ================================================================ lead capture, dedupe, caller-ID precedence
  await withCall(state('971501234567'), async () => {
    const a = tool('capture_lead').run({ name: 'Omar', notes: 'Wants 2BR Marina, budget 1.6M', interest: 'Apartment Sale' }, { agent: 'AI Receptionist' })
    assert.equal(a.new_lead, true)
    const b = tool('capture_lead').run({ name: 'Omar', phone: '+971509999999', notes: 'Calling again' }, { agent: 'AI Receptionist' })
    assert.equal(b.new_lead, false, 'the same caller does not create a second lead'); assert.equal(b.lead_no, a.lead_no)
    assert.equal(count(`SELECT COUNT(*) FROM leads WHERE phone = '+971509999999'`), 0, 'a number typed by the model cannot override caller ID')
  })
  const lead = row1(`SELECT * FROM leads WHERE phone = '+971501234567'`)
  assert.equal(lead.source, 'Inbound call'); assert.equal(lead.status, 'New')
  assert.equal(count(`SELECT COUNT(*) FROM comments WHERE entity = 'leads' AND record_id = ? AND body LIKE '%Calling again%'`, lead.id), 1)

  // ================================================================ viewing request, maintenance, call-back, transfer
  const st = state('971501234567')
  await withCall(st, async () => {
    tool('request_viewing').run({ name: 'Omar', property: 'PRP-26-00001', preferred_time: 'Saturday morning' }, { agent: 'AI Receptionist' })
    assert.equal(count(`SELECT COUNT(*) FROM tasks WHERE title LIKE 'Book viewing:%' AND priority = 'High'`), 1)
    assert.equal(st.outcome, 'Viewing requested')
    const m = await tool('report_maintenance_issue').run({ description: 'Water leaking through ceiling', location: 'Marina Gate 1, 2204', urgency: 'emergency', name: 'Omar' }, { agent: 'AI Receptionist' })
    assert.equal(m.priority, 'Urgent'); assert.ok(st.ticketId)
    assert.equal(row1(`SELECT type, priority FROM tickets WHERE id = ?`, st.ticketId).type, 'Maintenance')
    assert.equal(st.outcome, 'Viewing requested', 'a lower-value outcome never overwrites a higher one')
    tool('request_callback').run({ topic: 'Question about my deposit' }, { agent: 'AI Receptionist' })
    assert.equal(count(`SELECT COUNT(*) FROM tasks WHERE title LIKE 'Call back%'`), 1)
    assert.equal(tool('transfer_call').run({ reason: 'caller upset' }, { agent: 'AI Receptionist' }).transferred, false, 'no staff line configured: refuses and points to a call-back')
    setSettings({ voice_transfer_number: '+97143001234' })
    assert.equal(tool('transfer_call').run({ reason: 'caller upset' }, { agent: 'AI Receptionist' }).transferred, true); assert.ok(st.handoff)
  })
  assert.deepEqual(tool('find_caller').run({}, { agent: 't' }), { known: false, note: 'No caller ID' }, 'outside a call there is no caller ID to look up')
  await withCall(state('971501234567'), async () => { const f = tool('find_caller').run({}, { agent: 't' }); assert.equal(f.kind, 'lead'); assert.match(f.note, /not proof of identity/) })

  // ================================================================ tool policy: reviewed capabilities only
  for (const n of ['lookup_listings', 'find_caller']) assert.equal(toolPolicy(n, 'read', 1), 'execute')
  for (const n of ['capture_lead', 'request_viewing', 'report_maintenance_issue', 'request_callback', 'transfer_call']) { assert.equal(toolPolicy(n, 'internal', 1), 'execute'); assert.equal(toolPolicy(n, 'internal', 0), 'approve') }
  assert.equal(toolPolicy('send_whatsapp', 'external', 2), 'approve', 'messages to outsiders still need approval')
  assert.equal(toolPolicy('post_journal', 'internal', 2), 'deny')

  // ================================================================ full call through the gateway
  assert.equal(count(`SELECT COUNT(*) FROM ai_agents WHERE role_key = 'ai-receptionist'`), 1, 'the receptionist is seeded')
  const off = await voiceTurn({ call_id: 'c-off', from: '+971507770000', text: 'Hello' })
  assert.equal(off.action, 'transfer', 'switched off: caller is passed to staff, not left in silence'); assert.equal(seen.length, 0)
  q.run(`UPDATE ai_agents SET active = 1 WHERE role_key = 'ai-receptionist'`)

  assert.match((await voiceTurn({ call_id: 'c1', from: '+971501112222', text: '   ' })).reply, /didn't catch/); assert.equal(seen.length, 0, 'silence costs no model call')

  queue.push(use('find_caller', {}), use('lookup_listings', { purpose: 'sale', bedrooms: 2, area: 'Marina' }), say('I found a **two bedroom** in Marina Gate for one point five million dirhams. See https://example.com/x 🏠 Shall I book a viewing?'))
  const t1 = await voiceTurn({ call_id: 'c1', from: '+971501112222', to: '+97143001111', text: "Hi, I'm looking for a two bedroom to buy in Marina" })
  assert.equal(t1.action, 'none'); assert.ok(!/[*#]|http|🏠/.test(t1.reply), 'reply is plain speech'); assert.match(t1.reply, /two bedroom/)
  assert.match(seen[0].messages[0].content, /LIVE PHONE CALL/); assert.equal(seen[0].max_tokens, 350, 'voice replies are capped for latency')
  let row = row1(`SELECT * FROM voice_calls WHERE call_id = 'c1'`)
  assert.equal(row.from_number, '+971501112222'); assert.equal(row.status, 'In progress'); assert.equal(JSON.parse(row.transcript).length, 2)

  queue.push(use('request_viewing', { name: 'Sara', property: 'Marina Gate 1', preferred_time: 'Friday 4pm' }), say('Thank you Sara. A colleague will call to confirm the time.'))
  const before = seen.length
  const t2 = await voiceTurn({ call_id: 'c1', from: '+971501112222', text: 'Yes please, my name is Sara, Friday afternoon' })
  assert.equal(t2.action, 'none')
  assert.ok(JSON.stringify(seen[before].messages).includes('looking for a two bedroom'), 'earlier turns are replayed from the stored transcript')
  row = row1(`SELECT * FROM voice_calls WHERE call_id = 'c1'`)
  assert.equal(row.outcome, 'Viewing requested'); assert.ok(row.lead_id, 'the call is linked to the lead it created'); assert.equal(JSON.parse(row.transcript).length, 4)

  queue.push(use('transfer_call', { reason: 'caller wants a person' }), say('Of course, connecting you now.'))
  const t3 = await voiceTurn({ call_id: 'c1', from: '+971501112222', text: 'Actually can I speak to someone' })
  assert.equal(t3.action, 'transfer'); assert.equal(t3.transfer_to, '+97143001234')
  row = row1(`SELECT * FROM voice_calls WHERE call_id = 'c1'`); assert.equal(row.handoff, 1); assert.equal(row.outcome, 'Transferred to staff')

  queue.push(say('Sara called about a two bedroom in Marina Gate and asked for a viewing on Friday afternoon; a colleague must confirm the time.'))
  voiceEnd({ call_id: 'c1', duration_sec: 94 })
  for (let i = 0; i < 40 && !row1(`SELECT summary FROM voice_calls WHERE call_id = 'c1'`)?.summary; i++) await new Promise(r => setTimeout(r, 25))
  row = row1(`SELECT * FROM voice_calls WHERE call_id = 'c1'`)
  assert.equal(row.status, 'Completed'); assert.equal(row.duration_sec, 94); assert.match(row.summary, /two bedroom/)

  voiceEnd({ call_id: 'c-silent', duration_sec: 3 })
  assert.equal(row1(`SELECT outcome FROM voice_calls WHERE call_id = 'c-silent'`).outcome, 'Abandoned', 'a caller who never speaks is logged as abandoned')

  // the model provider failing must never leave the caller in silence
  queue.push('fail')
  const down = await voiceTurn({ call_id: 'c2', from: '+971503330000', text: 'Hello?' })
  assert.equal(down.action, 'transfer'); assert.match(down.reply, /technical problem/)
  assert.match(row1(`SELECT error FROM voice_calls WHERE call_id = 'c2'`).error, /HTTP 500/)

  assert.equal(forSpeech('* one\n* two **bold** `x` https://a.b/c'), 'one two bold x')
  assert.match(greeting().en, /AI assistant.*recorded/); assert.match(greeting().ar, /المساعد الذكي/)

  // ================================================================ retention: what callers said is removed, the CRM record stays
  const agentId = row1(`SELECT id FROM ai_agents WHERE role_key = 'ai-receptionist'`).id
  insertRow(def('voice_calls'), { call_id: 'old1', started_at: '2025-01-01T10:00', ended_at: '2025-01-01T10:05', status: 'Completed', summary: 'Asked about Marina rentals', outcome: 'Lead captured', transcript: [{ role: 'user', content: 'my passport number is X123', at: '2025-01-01T10:00' }] })
  insertRow(def('voice_calls'), { call_id: 'old-never-ended', started_at: '2025-01-02T10:00', status: 'In progress', transcript: [{ role: 'user', content: 'hello', at: '2025-01-02T10:00' }] })
  insertRow(def('ai_runs'), { agent_id: agentId, started_at: '2025-01-01T10:00', trigger: 'voice', status: 'ok', input: 'my passport number is X123', output: 'Thanks' })
  insertRow(def('ai_runs'), { agent_id: agentId, started_at: '2025-01-01T10:00', trigger: 'chat', status: 'ok', input: 'internal question', output: 'internal answer' })
  setSettings({ voice_retention_days: 0 })
  assert.deepEqual(purgeVoiceData(), { calls: 0, runs: 0 }, '0 means keep everything')
  setSettings({ voice_retention_days: 90 })
  const purged = purgeVoiceData()
  assert.equal(purged.calls, 2, 'old calls lose their transcript, including calls whose end was never reported'); assert.equal(purged.runs, 1)
  const old = row1(`SELECT * FROM voice_calls WHERE call_id = 'old1'`)
  assert.equal(old.transcript, '[]'); assert.equal(old.summary, 'Asked about Marina rentals'); assert.equal(old.outcome, 'Lead captured')
  assert.equal(row1(`SELECT input FROM ai_runs WHERE ai_runs.trigger = 'voice' AND started_at = '2025-01-01T10:00'`).input, null, 'the copy in the AI activity log is removed too')
  assert.equal(row1(`SELECT input FROM ai_runs WHERE ai_runs.trigger = 'chat' AND started_at = '2025-01-01T10:00'`).input, 'internal question', 'other AI runs are untouched')
  assert.equal(JSON.parse(row1(`SELECT transcript FROM voice_calls WHERE call_id = 'c1'`).transcript).length, 6, 'recent calls keep their transcript')
  assert.deepEqual(purgeVoiceData(), { calls: 0, runs: 0 }, 'a second run finds nothing more to remove')

  // ================================================================ HTTP surface: secret, aliases, staff-only endpoints
  const app = await buildApp()
  const post = (url: string, payload: any) => app.inject({ method: 'POST', url, payload })
  assert.equal((await post('/api/public/voice/s3cret/turn', { call_id: 'h1', text: 'hi' })).statusCode, 404, 'disabled gateway looks like it does not exist')
  setSettings({ voice_enabled: true, voice_secret: 's3cret' })
  assert.equal((await post('/api/public/voice/wrong/turn', { call_id: 'h1', text: 'hi' })).statusCode, 404)
  assert.equal((await post('/api/public/voice/s3cret/turn', { text: 'hi' })).statusCode, 400)
  queue.push(say('Hello, how can I help?'))
  const ok = await post('/api/public/voice/s3cret/turn', { callId: 'h1', caller: '+971504440000', utterance: 'hi there' })
  assert.equal(ok.statusCode, 200); assert.equal(ok.json().reply, 'Hello, how can I help?'); assert.equal(ok.json().call_id, 'h1')
  assert.equal((await app.inject({ method: 'GET', url: '/api/public/voice/s3cret/greeting' })).json().transfer_configured, true)
  assert.equal((await post('/api/public/voice/s3cret/end', { call_id: 'h1', duration: 12 })).json().ok, true)
  assert.equal((await app.inject({ method: 'GET', url: '/api/voice/status' })).statusCode, 401, 'status needs a signed-in user')
  assert.equal((await post('/api/voice/test', { text: 'hi' })).statusCode, 401, 'the test console needs a signed-in user')
  await app.close()

  console.log('Voice checks passed: listings privacy, lead dedupe, caller-ID precedence, escalation, tool policy, multi-turn calls, transfer, summary, failure fallback, transcript retention and the secret-protected gateway. No external service called.')
} finally { globalThis.fetch = original }
