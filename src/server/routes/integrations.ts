import type { FastifyInstance } from 'fastify'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { db, q } from '../db'
import { dirs, config, BACKUP_EXT } from '../config'
import { getSetting, publicSettings, setSettings } from '../settings'
import { audit, getDef, getRecord, assertCan, can } from '../engine'
import { forbidden, bad, notFound, nowIso, safeJson, todayStr } from '../util'
import { idOf, need } from './helpers'
import { COOKIE } from '../app'
import { CATALOG } from '../integrations/catalog'
import { verifySmtp, mailProvider, queueEmail } from '../mailer'
import { r2Test, r2Put, r2Configured, useR2 } from '../integrations/storage'
import { schemaSql, syncToSupabase, testSupabase, resetSupabaseCursors } from '../integrations/supabase'
import { testWhatsApp, sendWhatsApp, waConfigured, verifySignature, handleWebhook, normalizePhone } from '../integrations/whatsapp'
import { testLlm, PRESETS, aiConfigured } from '../ai/llm'
import { runAgent, chatWithAgent, decideAction, ensureAgents, latestBrief } from '../ai/agents'
import { AGENT_TEMPLATES } from '../ai/templates'
import { TOOLS } from '../ai/tools'
import { buildEinvoiceXml, submitEinvoice } from '../integrations/einvoice'
import { buildWps } from '../integrations/wps'
import { closeYear, reopenYear, yearEndPreview } from '../integrations/yearend'
import { importLines, parseStatement, autoMatch } from '../integrations/bank'
import { renderPrintPdf, pdfAvailable } from '../integrations/pdf'
import { logIntegration } from '../integrations/log'
import { ENTITIES } from '../../shared/entities'
import { createRecord } from '../engine'

const same = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y) }
const origin = (req: any) => String(config.baseUrl || `${req.protocol}://${req.headers.host}`).replace(/\/+$/, '')

export async function backupToR2(): Promise<string> {
  const name = `digitalburj-${nowIso().replace(/[:.]/g, '-').slice(0, 19)}${BACKUP_EXT}`
  const p = path.join(dirs.backups, name)
  await db.backup(p)
  if (r2Configured()) await r2Put(`backups/${name}`, fs.readFileSync(p), 'application/octet-stream')
  return name
}

export default async function (app: FastifyInstance) {
  // =================================================================== integrations catalogue
  app.get('/api/integrations', async (req) => {
    need(req, 'admin', 'view')
    const s = publicSettings()
    const base = origin(req)
    return {
      sections: CATALOG.map(sec => ({ ...sec, values: Object.fromEntries(sec.fields.map(f => [f.key, s[f.key] ?? (f.type === 'bool' ? false : '')])), webhooks: sec.webhooks?.map(w => ({ ...w, url: w.secret ? (getSetting(w.key) ? base + w.path + '••••••••' : null) : base + w.path })) })),
      status: { mail: mailProvider(), r2: r2Configured(), storage_in_r2: useR2(), whatsapp: waConfigured(), ai: aiConfigured(), pdf: pdfAvailable(), supabase: !!getSetting('supabase_url') && !!getSetting('supabase_service_key') },
      presets: PRESETS,
    }
  })
  app.post('/api/integrations/:key/test', async (req) => {
    need(req, 'admin', 'edit')
    const k = (req.params as any).key
    const r = k === 'mail' ? await verifySmtp() : k === 'storage' ? await r2Test() : k === 'supabase' ? await testSupabase() : k === 'whatsapp' ? await testWhatsApp() : k === 'ai' ? await testLlm() : null
    if (!r) throw bad('No test available for this integration')
    logIntegration(k, 'test', !!(r as any).ok, `Connection test: ${(r as any).ok ? 'OK' : (r as any).error}`)
    return r
  })
  app.post('/api/integrations/webhook-secret/:which', async (req) => {
    need(req, 'admin', 'edit')
    const which = (req.params as any).which
    const key = which === 'tracking' ? 'tracking_webhook_secret' : which === 'bank' ? 'bank_webhook_secret' : null
    if (!key) throw bad('Unknown webhook')
    const secret = crypto.randomBytes(20).toString('hex')
    setSettings({ [key]: secret })
    audit(req.ctx, getDef('branches'), 0, 'settings', { [key]: ['***', '***'] }, 'Webhook secret regenerated')
    return { url: `${origin(req)}/api/public/${which}/${secret}`, note: 'Copy this URL now – it is not shown again.' }
  })
  app.get('/api/integrations/supabase/schema.sql', async (req, reply) => { need(req, 'admin', 'view'); reply.header('content-type', 'text/plain; charset=utf-8').header('content-disposition', 'attachment; filename="digitalburj-supabase-schema.sql"'); return schemaSql() })
  app.post('/api/integrations/supabase/sync', async (req) => { need(req, 'admin', 'edit'); const b = (req.body ?? {}) as any; if (b.full) resetSupabaseCursors(); return syncToSupabase() })
  app.post('/api/integrations/backup-r2', async (req) => { need(req, 'admin', 'edit'); const name = await backupToR2(); audit(req.ctx, getDef('branches'), 0, 'backup', { file: [null, name] }, name); return { name, r2: r2Configured() } })

  // =================================================================== public webhooks
  const limit = { config: { rateLimit: { max: 300, timeWindow: '1 minute' } } }
  app.get('/api/public/whatsapp', limit, async (req, reply) => {
    const s = req.query as any
    if (s['hub.mode'] === 'subscribe' && getSetting('wa_verify_token') && same(String(s['hub.verify_token'] ?? ''), String(getSetting('wa_verify_token')))) return reply.type('text/plain').send(String(s['hub.challenge'] ?? ''))
    return reply.status(403).send('forbidden')
  })
  app.post('/api/public/whatsapp', limit, async (req, reply) => {
    const raw = (req as any).rawBody as string | undefined
    if (!verifySignature(raw ?? JSON.stringify(req.body), req.headers['x-hub-signature-256'] as string | undefined)) return reply.status(401).send({ error: 'bad signature' })
    reply.send({ ok: true })
    void handleWebhook(req.body).catch(e => logIntegration('whatsapp', 'webhook', false, String(e?.message ?? e)))
  })
  app.post('/api/public/bank/:secret', limit, async (req, reply) => {
    const secret = String(getSetting('bank_webhook_secret') || '')
    if (!secret || !same(secret, String((req.params as any).secret))) return reply.status(404).send({ error: 'Not found' })
    const b = z.object({ iban: z.string().optional(), bank_account_id: z.number().optional(), transactions: z.array(z.object({ date: z.string(), description: z.string().optional(), reference: z.string().optional(), amount: z.number().optional(), debit: z.number().optional(), credit: z.number().optional() })).max(2000) }).parse(req.body)
    const acct = b.bank_account_id ?? q.val<number>(`SELECT id FROM bank_accounts WHERE replace(iban,' ','') = ? AND deleted_at IS NULL`, (b.iban ?? '').replace(/\s/g, ''))
    if (!acct) return reply.status(422).send({ error: 'Bank account not found for that IBAN' })
    return importLines(acct, b.transactions.map(t => ({ date: t.date.slice(0, 10), description: t.description ?? '(bank feed)', reference: t.reference ?? '', debit: t.debit ?? (t.amount && t.amount < 0 ? -t.amount : 0), credit: t.credit ?? (t.amount && t.amount > 0 ? t.amount : 0) })), 'feed')
  })

  // =================================================================== finance
  app.get('/api/finance/year-end/:year', async (req) => { need(req, 'finance', 'view'); return yearEndPreview(Number((req.params as any).year), (req.query as any).entity ? Number((req.query as any).entity) : null) })
  app.post('/api/finance/year-end/close', async (req) => { need(req, 'finance', 'approve'); const b = z.object({ year: z.number().int(), entity: z.number().int().nullable().optional(), lock: z.boolean().optional() }).parse(req.body); return closeYear(b.year, req.ctx, { entityId: b.entity ?? null, lock: b.lock }) })
  app.post('/api/finance/year-end/:id/reopen', async (req) => { need(req, 'finance', 'approve'); return reopenYear(idOf((req.params as any).id), req.ctx) })

  app.post('/api/finance/bank/auto-match', async (req) => { need(req, 'finance', 'edit'); return { matched: autoMatch((req.body as any)?.bank_account_id) } })

  app.get('/api/invoices/:id/einvoice.xml', async (req, reply) => {
    const id = idOf((req.params as any).id); getRecord(getDef('invoices'), id, req.ctx, { children: false }); need(req, 'finance', 'export')
    const { xml, filename } = buildEinvoiceXml(id)
    reply.header('content-type', 'application/xml; charset=utf-8').header('content-disposition', `attachment; filename="${filename}"`); return xml
  })
  app.post('/api/invoices/:id/einvoice/submit', async (req) => { need(req, 'finance', 'edit'); const id = idOf((req.params as any).id); getRecord(getDef('invoices'), id, req.ctx, { children: false }); return submitEinvoice(id) })

  // =================================================================== HR – WPS
  app.get('/api/hr/wps/:period', async (req) => { need(req, 'hr', 'view'); const r = buildWps((req.params as any).period, { includeDrafts: (req.query as any).drafts === '1' }); return { ...r, content: undefined } })
  app.post('/api/hr/wps/:period/generate', async (req) => {
    need(req, 'hr', 'approve')
    const r = buildWps((req.params as any).period, { save: true, entityId: (req.body as any)?.entity ?? null })
    if (!r.ok) throw bad('Fix the listed problems first', r)
    audit(req.ctx, getDef('wps_batches'), r.batch_id!, 'wps-generated', { file: [null, r.file_name] }, r.file_name)
    return { ...r, content: undefined }
  })
  app.get('/api/hr/wps/batches/:id/download', async (req, reply) => {
    need(req, 'hr', 'export')
    const b = q.get(`SELECT file_name, content FROM wps_batches WHERE id = ? AND deleted_at IS NULL`, idOf((req.params as any).id))
    if (!b) throw notFound('File not found')
    reply.header('content-type', 'text/plain; charset=utf-8').header('content-disposition', `attachment; filename="${b.file_name}"`); return safeJson<string>(b.content, '')
  })

}
  // =================================================================== operations
