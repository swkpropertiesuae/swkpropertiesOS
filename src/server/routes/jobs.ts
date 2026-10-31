import type { FastifyInstance } from 'fastify'
import { randomBytes } from 'crypto'
import { z } from 'zod'
import { config } from '../config'
import { inDemo, q, tx } from '../db'
import { assertCan, createRecord, deleteRecord, getDef, getRecord, listRecords, patchRecord, SYSTEM_CTX, updateRecord, audit } from '../engine'
import { bad, notFound, nowLocal } from '../util'
import { body, idOf, need } from './helpers'
import { addJobEvent, duplicateJob, generateInvoicesFromJob, generateBillFromJobCosts, recomputeJobTotals, convertProforma, jobKpi } from '../domain/jobs'
import { queueEmail } from '../mailer'
import { getSetting } from '../settings'
import { postInvoice } from '../domain/finance'

export default async function (app: FastifyInstance) {
  const jobDef = () => getDef('jobs')
  const loadJob = (req: any, edit = false) => {
    const id = idOf(req.params.id)
    if (edit) assertCan(req.ctx, 'sales', 'edit')
    return { id, job: getRecord(jobDef(), id, req.ctx, { children: true }) }
  }

  // Timeline events
  app.post('/api/jobs/:id/events', async (req) => {
    const { id, job } = loadJob(req, true)
    const b = z.object({ event_type: z.string().min(1), event_at: z.string().optional(), description: z.string().max(1000).optional().nullable(), visible_to_customer: z.boolean().optional() }).parse(req.body)
    addJobEvent(id, b.event_type, { at: b.event_at || nowLocal(), description: b.description ?? undefined, visible: b.visible_to_customer ?? true, user_id: req.user!.id, source: 'Manual' })
    // Sync status from key milestones
    const sync: Record<string, string> = {
      'Viewing Conducted': 'Viewing', 'Offer Submitted': 'Offer', 'Offer Accepted': 'Contract', 
      'Contract Signed': 'Contract', 'DLD Submitted': 'DLD Process', 'DLD Approved': 'DLD Process',
      'Title Deed Issued': 'Handover', 'Handover Completed': 'Closed'
    }
    if (sync[b.event_type]) {
      const patch: any = { operational_status: sync[b.event_type] }
      if (b.event_type === 'Offer Accepted' && ['Lead', 'Active Mandate', 'Viewing'].includes(job.job_status)) patch.job_status = 'Offer Accepted'
      else if (b.event_type === 'Contract Signed' && !['Contract Signed', 'DLD Submitted', 'DLD Approved', 'Title Deed Issued', 'Completed', 'Cancelled'].includes(job.job_status)) patch.job_status = 'Contract Signed'
      else if (b.event_type === 'Handover Completed') patch.job_status = 'Completed'
      else if (job.job_status === 'Lead' && b.event_type !== 'Note') patch.job_status = 'Active Mandate'
      patchRecord(jobDef(), id, patch, req.ctx)
    }
    return { ok: true }
  })

  app.delete('/api/jobs/:id/events/:eid', async (req) => {
    const { id } = loadJob(req, true)
    q.run(`DELETE FROM job_events WHERE id = ? AND job_id = ? AND source <> 'System'`, idOf((req.params as any).eid), id)
    return { ok: true }
  })

  app.get('/api/jobs/:id/events', async (req) => {
    const { id } = loadJob(req)
    const rows = q.all(`SELECT e.*, u.name AS user_name FROM job_events e LEFT JOIN users u ON u.id = e.user_id WHERE e.job_id = ? AND e.deleted_at IS NULL ORDER BY e.event_at DESC, e.id DESC`, id)
    return rows
  })

  app.post('/api/jobs/:id/generate-invoices', async (req) => {
    const { id } = loadJob(req)
    need(req, 'finance', 'create')
    const b = z.object({ doc_type: z.enum(['Tax Invoice', 'Proforma Invoice']).optional(), charge_ids: z.array(z.number()).optional(), post: z.boolean().optional() }).parse(req.body ?? {})
    return tx(() => {
      const invs = generateInvoicesFromJob(id, { docType: b.doc_type, chargeIds: b.charge_ids }, req.ctx)
      if (b.post) { need(req, 'finance', 'edit'); return invs.map(i => postInvoice(i.id, req.ctx)) }
      return invs
    })
  })

  app.post('/api/jobs/:id/bill-from-costs', async (req) => {
    const { id } = loadJob(req)
    need(req, 'finance', 'create')
    const b = z.object({ vendor_id: z.number().int(), vendor_invoice_no: z.string().min(1).max(80), charge_ids: z.array(z.number().int()).optional() }).parse(req.body ?? {})
    return tx(() => generateBillFromJobCosts(id, b, req.ctx))
  })

  app.post('/api/invoices/:id/convert-proforma', async (req) => { need(req, 'finance', 'create'); return tx(() => convertProforma(idOf((req.params as any).id), req.ctx)) })

  app.post('/api/jobs/bulk-proforma', async (req) => {
    need(req, 'finance', 'create')
    const b = z.object({ job_ids: z.array(z.number().int()).min(1).max(100) }).parse(req.body)
    const created: any[] = [], skipped: { job_id: number; reason: string }[] = []
    for (const jid of b.job_ids) {
      try { getRecord(jobDef(), jid, req.ctx, { children: false }); tx(() => created.push(...generateInvoicesFromJob(jid, { docType: 'Proforma Invoice' }, req.ctx))) }
      catch (e: any) { skipped.push({ job_id: jid, reason: e?.message ?? 'failed' }) }
    }
    return { created: created.map(c => ({ id: c.id, invoice_no: c.invoice_no, job_id: c.job_id, total: c.total, currency: c.currency })), skipped }
  })

  app.post('/api/jobs/:id/duplicate', async (req) => { need(req, 'jobs', 'create'); const { id } = loadJob(req); return tx(() => duplicateJob(id, req.ctx)) })
  app.get('/api/jobs/:id/kpi', async (req) => { const { id } = loadJob(req); return jobKpi(id) })

  // Public client status link: portal users may share their own deals; staff share any deal they can see.
  app.post('/api/jobs/:id/tracking-token', async (req) => {
    const id = idOf((req.params as any).id)
    if (req.user!.party_id) {
      const owner = q.val<number>(`SELECT client_id FROM jobs WHERE id = ? AND deleted_at IS NULL`, id)
      if (owner !== req.user!.party_id) throw bad('You can only share your own deals')
    } else assertCan(req.ctx, 'sales', 'view')
    // Re-opening the share dialog must not break links already sent or printed as QR codes: reuse the token unless a new one is explicitly requested.
    const rotate = (req.body as any)?.rotate === true
    let token = rotate ? undefined : q.val<string>(`SELECT token FROM job_tracking_tokens WHERE job_id = ?`, id) ?? undefined
    if (!token) {
      token = (inDemo() ? 'demo-' : '') + randomBytes(16).toString('hex')
      q.run(`INSERT INTO job_tracking_tokens (job_id, token, created_at) VALUES (?, ?, ?) ON CONFLICT(job_id) DO UPDATE SET token = excluded.token, created_at = excluded.created_at`, id, token, nowLocal())
    }
    // Build the link from the configured public address, never from the Host header the caller supplied.
    const base = (config.baseUrl || `${req.protocol}://${req.headers.host}`).replace(/\/+$/, '')
    return { token, url: `${base}/t/${token}` }
  })

  // Client-facing deal status (no financials) for /t/<token> links and document QR codes.
  const STAGES = ['Inquiry', 'Viewing', 'Offer', 'Negotiation', 'Contract', 'DLD Process', 'Handover', 'Closed']
  const getPublicDeal = async (req: any) => {
    const token = String((req.params as any).token)
    if (!token || token.length > 80) throw bad('Tracking link not found')
    const jobId = q.val<number>(`SELECT job_id FROM job_tracking_tokens WHERE token = ?`, token)
    if (!jobId) throw notFound('Tracking link not found')
    const j: any = q.get(`SELECT id, job_no, deal_name, deal_type, job_status, operational_status, target_close, deal_date, client_id, property_id FROM jobs WHERE id = ? AND deleted_at IS NULL`, jobId)
    if (!j) throw notFound('This deal is no longer available')
    const client = j.client_id ? q.val<string>(`SELECT name FROM parties WHERE id = ?`, j.client_id) : null
    // community_id is free text on a property; community_ref is the link to the communities master.
    const prop: any = j.property_id ? q.get(`SELECT title, community_id, community_ref FROM properties WHERE id = ?`, j.property_id) : null
    const communityId = prop?.community_ref ?? (/^\d+$/.test(String(prop?.community_id ?? '')) ? Number(prop.community_id) : null)
    const community = (communityId ? q.val<string>(`SELECT name FROM communities WHERE id = ?`, communityId) : null) ?? (prop?.community_id && !communityId ? String(prop.community_id) : null)
    const events = q.all(`SELECT event_at, event_type, description FROM job_events WHERE job_id = ? AND deleted_at IS NULL AND visible_to_customer = 1 ORDER BY event_at DESC, id DESC LIMIT 20`, j.id)
    return {
      job_no: j.job_no, deal_name: j.deal_name, deal_type: j.deal_type, job_status: j.job_status,
      operational_status: j.operational_status, target_close: j.target_close, deal_date: j.deal_date,
      stage_index: Math.max(0, STAGES.indexOf(j.operational_status ?? j.job_status)), stages: STAGES,
      client, property: prop?.title ?? '', community: community ?? '',
      company: getSetting<string>('company_name') || 'SWK Properties L.L.C.', events,
    }
  }
  app.get('/api/public/deal/:token', getPublicDeal)
  app.get('/api/public/track/:token', getPublicDeal)

  // Bulk mail for deal updates
  app.post('/api/jobs/bulk-mail', async (req) => {
    need(req, 'sales', 'edit')
    const b = z.object({ job_ids: z.array(z.number().int()).min(1).max(100), template: z.enum(['status', 'offer', 'contract', 'handover', 'custom']), subject: z.string().max(200).optional(), message: z.string().max(5000).optional(), to: z.string().max(300).optional(), preview: z.boolean().optional() }).parse(req.body)
    const co = getSetting<string>('company_name')
    const out: any[] = []
    for (const jid of b.job_ids) {
      const j = getRecord(jobDef(), jid, req.ctx, { children: true })
      const contacts = q.all(`SELECT email FROM contacts WHERE party_id = ? AND deleted_at IS NULL AND email <> '' AND (receives_tracking = 1 OR is_primary = 1)`, j.client_id).map(r => r.email)
      const fallback = q.val<string>(`SELECT email FROM parties WHERE id = ?`, j.client_id)
      const to = b.to || [...new Set(contacts.length ? contacts : fallback ? [fallback] : [])].join(', ')
      const L = j._labels
      const last = (j.children.events as any[]).filter(e => e.visible_to_customer).sort((a, c) => String(c.event_at).localeCompare(String(a.event_at)))[0]
      const head = `Deal ${j.job_no} · ${j.deal_name}${j.property_id ? ` · ${L.property_id ?? ''}` : ''}`
      let subject = b.subject, text = ''
      if (b.template === 'status') { subject ||= `Deal update – ${j.job_no}`; text = `Dear Customer,\n\n${head}\nStatus: ${j.operational_status ?? j.job_status}${last ? `\nLatest update: ${last.event_type} (${String(last.event_at).replace('T', ' ')})` : ''}` }
      else if (b.template === 'offer') { subject ||= `Offer update – ${j.job_no}`; text = `Dear Customer,\n\n${head}\nYour offer has been updated.` }
      else if (b.template === 'contract') { subject ||= `Contract update – ${j.job_no}`; text = `Dear Customer,\n\n${head}\nContract is ready for review.` }
      else if (b.template === 'handover') { subject ||= `Handover scheduled – ${j.job_no}`; text = `Dear Customer,\n\n${head}\nHandover has been scheduled.` }
      else { subject ||= `${j.job_no}`; text = '' }
      const bodyText = `${b.message ? b.message + '\n\n' : ''}${text}\n\nBest regards,\n${req.user!.name}\n${co}`
      if (b.preview) out.push({ job_id: jid, job_no: j.job_no, to, subject, body: bodyText })
      else {
        if (!to) { out.push({ job_id: jid, job_no: j.job_no, error: 'No e-mail address for this customer' }); continue }
        const id = queueEmail({ to, subject: subject!, body: bodyText, link_entity: 'jobs', link_id: jid, userId: req.user!.id })
        addJobEvent(jid, 'Documents sent', { description: `E-mail "${subject}" queued to ${to}`, user_id: req.user!.id, source: 'System', visible: false })
        out.push({ job_id: jid, job_no: j.job_no, queued: id, to })
      }
    }
    return out
  })

  app.get('/api/search/jobs', async (req) => {
    need(req, 'sales', 'view')
    const qs = req.query as any
    const type = String(qs.type ?? 'job_no'), op = String(qs.op ?? 'contains'), value = String(qs.value ?? '').trim()
    if (!value) throw bad('Enter a value to search for')
    const map: Record<string, { entity: string; field: string; via?: string }> = {
      job_no: { entity: 'jobs', field: 'job_no' }, deal_name: { entity: 'jobs', field: 'deal_name' }, client: { entity: 'jobs', field: 'client_id' },
      property: { entity: 'jobs', field: 'property_id' }, mandate: { entity: 'jobs', field: 'mandate_id' },
    }
    const m = map[type]
    if (!m) throw bad('Unknown search type')
    const opSql = op === 'equals' ? 'eq' : op === 'starts with' ? 'starts' : op === 'ends with' ? 'ends' : op
    let filters: any[] = []
    if (m.via) {
      const pat = `%${value.replace(/[\\%_]/g, c => '\\' + c)}%`
      const ids = m.via === 'invoice' ? q.all(`SELECT DISTINCT job_id id FROM invoices WHERE invoice_no LIKE ? ESCAPE '\\' AND job_id IS NOT NULL AND deleted_at IS NULL`, pat)
        : []
      if (!ids.length) return { rows: [], total: 0 }
      filters = [{ field: 'id', op: 'in', value: ids.map(r => r.id) }]
    } else filters = [{ field: m.field, op: opSql, value }]
    const res = listRecords(jobDef(), { filters, pageSize: 200, sort: 'deal_date', dir: 'desc' }, req.ctx)
    return { total: res.total, rows: res.rows.map(r => ({ id: r.id, job_no: r.job_no, deal_name: r.deal_name, deal_date: r.deal_date, job_status: r.job_status, deal_type: r.deal_type, deal_value: r.deal_value, client: r._labels.client_id ?? '', property: r._labels.property_id ?? '', agent: r._labels.agent_id ?? '', operational_status: r.operational_status })) }
  })
}
