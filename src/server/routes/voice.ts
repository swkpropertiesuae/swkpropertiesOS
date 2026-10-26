import type { FastifyInstance } from 'fastify'
import crypto from 'node:crypto'
import { q } from '../db'
import { getSetting } from '../settings'
import { bad, todayStr } from '../util'
import { need } from './helpers'
import { aiConfigured } from '../ai/llm'
import { greeting, voiceConfigured, voiceEnd, voiceTurn, RECEPTIONIST_KEY } from '../integrations/voice'
import { ensureAgents } from '../ai/agents'
import { logIntegration } from '../integrations/log'

const same = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y) }
const pick = (b: any, ...keys: string[]) => { for (const k of keys) if (b?.[k] !== undefined && b[k] !== null && b[k] !== '') return b[k]; return undefined }

export default async function (app: FastifyInstance) {
  // =================================================================== public gateway (called by the voice platform)
  const gate = { config: { rateLimit: { max: 600, timeWindow: '1 minute' } } }
  const authorised = (req: any) => voiceConfigured() && same(String(getSetting('voice_secret')), String(req.params.secret ?? ''))

  /** Opening line to speak when the call connects (English and Arabic). */
  app.get('/api/public/voice/:secret/greeting', gate, async (req, reply) => {
    if (!authorised(req)) return reply.status(404).send({ error: 'Not found' })
    return greeting()
  })

  /** One caller utterance in, one spoken reply out. The platform sends only the call id and the new text. */
  app.post('/api/public/voice/:secret/turn', gate, async (req, reply) => {
    if (!authorised(req)) return reply.status(404).send({ error: 'Not found' })
    const b: any = req.body ?? {}
    const call_id = String(pick(b, 'call_id', 'callId', 'call_sid', 'id') ?? '')
    if (!call_id) return reply.status(400).send({ error: 'call_id is required' })
    return voiceTurn({ call_id, from: pick(b, 'from', 'caller', 'from_number', 'caller_id'), to: pick(b, 'to', 'called', 'to_number'), text: pick(b, 'text', 'transcript', 'message', 'utterance'), direction: pick(b, 'direction') })
  })

  /** The call is over: closes the log and writes the summary. */
  app.post('/api/public/voice/:secret/end', gate, async (req, reply) => {
    if (!authorised(req)) return reply.status(404).send({ error: 'Not found' })
    const b: any = req.body ?? {}
    const call_id = String(pick(b, 'call_id', 'callId', 'call_sid', 'id') ?? '')
    if (!call_id) return reply.status(400).send({ error: 'call_id is required' })
    return voiceEnd({ call_id, duration_sec: Number(pick(b, 'duration_sec', 'duration', 'durationSeconds')) || 0, transcript: Array.isArray(b.transcript) ? b.transcript : undefined })
  })

  // =================================================================== staff
  app.get('/api/voice/status', async (req) => {
    need(req, 'ai', 'view')
    ensureAgents()
    const agent = q.get(`SELECT id, name, active FROM ai_agents WHERE role_key = ? AND deleted_at IS NULL ORDER BY id LIMIT 1`, RECEPTIONIST_KEY)
    const today = todayStr()
    return {
      enabled: !!getSetting('voice_enabled'), secret_set: !!getSetting('voice_secret'), ai_configured: aiConfigured(), agent: agent ? { id: agent.id, name: agent.name, active: !!agent.active } : null,
      transfer_configured: !!String(getSetting('voice_transfer_number') || '').trim(), greeting: greeting(),
      calls_today: q.val<number>(`SELECT COUNT(*) FROM voice_calls WHERE deleted_at IS NULL AND substr(started_at,1,10) = ?`, today) ?? 0,
      ready: voiceConfigured() && !!agent?.active && aiConfigured(),
    }
  })

  /** Try the receptionist from the browser without any telephony: each call is logged like a real one. */
  app.post('/api/voice/test', async (req) => {
    need(req, 'ai', 'edit')
    const b: any = req.body ?? {}
    const call_id = String(b.call_id || `test-${req.user!.id}-${Date.now()}`).slice(0, 120)
    if (!call_id.startsWith('test-')) throw bad('Test calls must use a call_id that starts with "test-"')
    if (b.end) return voiceEnd({ call_id })
    logIntegration('voice', 'test', true, `Test call turn by ${req.user!.name}`)
    return voiceTurn({ call_id, from: String(b.from || ''), to: 'web test', text: String(b.text ?? '') })
  })
}
