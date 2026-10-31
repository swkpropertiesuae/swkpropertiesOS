import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { q, tx } from '../db'
import { assertCan, createRecord, deleteRecord, getDef, getRecord, listRecords, patchRecord, SYSTEM_CTX, audit } from '../engine'
import { bad, notFound, nowLocal, todayStr } from '../util'
import { body, idOf, need } from './helpers'
import { queueEmail } from '../mailer'
import { getSetting } from '../settings'
import { addJobEvent } from '../domain/jobs'

export default async function (app: FastifyInstance) {
  const mandateDef = () => getDef('mandates')
  const viewingDef = () => getDef('viewings')
  const offerDef = () => getDef('offers')

  const loadMandate = (req: any, edit = false) => {
    const id = idOf(req.params.id)
    if (edit) assertCan(req.ctx, 'mandates', 'edit')
    return { id, mandate: getRecord(mandateDef(), id, req.ctx, { children: { portal_links: true, media: true } }) }
  }

  const loadViewing = (req: any, edit = false) => {
    const id = idOf(req.params.id)
    if (edit) assertCan(req.ctx, 'mandates', 'edit')
    return { id, viewing: getRecord(viewingDef(), id, req.ctx, { children: false }) }
  }

  const loadOffer = (req: any, edit = false) => {
    const id = idOf(req.params.id)
    if (edit) assertCan(req.ctx, 'transactions', 'edit')
    return { id, offer: getRecord(offerDef(), id, req.ctx, { children: false }) }
  }

  // Mandate events/timeline
  app.post('/api/mandates/:id/events', async (req) => {
    const { id, mandate } = loadMandate(req, true)
    const b = z.object({ event_type: z.string().min(1), event_at: z.string().optional(), description: z.string().max(1000).optional().nullable(), visible_to_client: z.boolean().optional() }).parse(req.body)
    addJobEvent(id, b.event_type, { at: b.event_at || nowLocal(), description: b.description ?? undefined, visible: b.visible_to_client ?? true, user_id: req.user!.id, source: 'Manual' })
    return { ok: true }
  })

  app.delete('/api/mandates/:id/events/:eid', async (req) => {
    const { id } = loadMandate(req, true)
    q.run('DELETE FROM mandate_events WHERE id = ? AND mandate_id = ? AND source <> ?', idOf((req.params as any).eid), id, 'System')
    return { ok: true }
  })

  app.get('/api/mandates/:id/events', async (req) => {
    const { id } = loadMandate(req)
    const rows = q.all('SELECT e.*, u.name AS user_name FROM mandate_events e LEFT JOIN users u ON u.id = e.user_id WHERE e.mandate_id = ? AND e.deleted_at IS NULL ORDER BY e.event_at DESC, e.id DESC', id)
    return rows
  })

  // Mandate status transitions
  app.post('/api/mandates/:id/activate', async (req) => {
    const { id, mandate } = loadMandate(req, true)
    if (mandate.status !== 'Draft') throw bad('Only draft mandates can be activated')
    return patchRecord(mandateDef(), id, { status: 'Active', last_activity: nowLocal() }, req.ctx)
  })

  app.post('/api/mandates/:id/pause', async (req) => {
    const { id, mandate } = loadMandate(req, true)
    if (mandate.status !== 'Active') throw bad('Only active mandates can be paused')
    return patchRecord(mandateDef(), id, { status: 'Paused' }, req.ctx)
  })

  app.post('/api/mandates/:id/complete', async (req) => {
    const { id, mandate } = loadMandate(req, true)
    if (!['Active', 'Paused'].includes(mandate.status)) throw bad('Only active or paused mandates can be completed')
    return patchRecord(mandateDef(), id, { status: 'Completed', last_activity: nowLocal() }, req.ctx)
  })

  app.post('/api/mandates/:id/withdraw', async (req) => {
    const { id, mandate } = loadMandate(req, true)
    const b = z.object({ reason: z.string().min(10).max(1000) }).parse(req.body)
    return patchRecord(mandateDef(), id, { status: 'Withdrawn', last_activity: nowLocal() }, req.ctx)
  })

  // Portal publish/unpublish
  app.post('/api/mandates/:id/portal', async (req) => {
    const { id, mandate } = loadMandate(req, true)
    const b = z.object({ publish: z.boolean(), featured: z.boolean().optional() }).parse(req.body)
    return patchRecord(mandateDef(), id, { portal_publish: b.publish, portal_featured: b.featured ?? false }, req.ctx)
  })

  // Portal links management
  app.post('/api/mandates/:id/portal-links', async (req) => {
    const { id } = loadMandate(req, true)
    const b = z.object({ portal: z.string().min(1), url: z.string().url(), listing_id: z.string().optional() }).parse(req.body)
    const mandate = getRecord(mandateDef(), id, req.ctx)
    const links = mandate.portal_links ? JSON.parse(mandate.portal_links) : []
    links.push({ portal: b.portal, url: b.url, listing_id: b.listing_id, created_at: nowLocal() })
    return patchRecord(mandateDef(), id, { portal_links: JSON.stringify(links) }, req.ctx)
  })

  app.delete('/api/mandates/:id/portal-links/:linkId', async (req) => {
    const { id } = loadMandate(req, true)
    const linkId = idOf((req.params as any).linkId)
    const mandate = getRecord(mandateDef(), id, req.ctx)
    const links = mandate.portal_links ? JSON.parse(mandate.portal_links) : []
    const filtered = links.filter((_: any, i: number) => i !== linkId)
    return patchRecord(mandateDef(), id, { portal_links: JSON.stringify(filtered) }, req.ctx)
  })

  // Viewing management
  app.post('/api/viewings/:id/confirm', async (req) => {
    const { id, viewing } = loadViewing(req, true)
    if (viewing.status !== 'Scheduled') throw bad('Only scheduled viewings can be confirmed')
    return patchRecord(viewingDef(), id, { status: 'Confirmed' }, req.ctx)
  })

  app.post('/api/viewings/:id/complete', async (req) => {
    const { id, viewing } = loadViewing(req, true)
    const b = z.object({ feedback: z.string().max(1000).optional(), interest_level: z.number().int().min(1).max(10).optional(), follow_up_required: z.boolean().optional(), follow_up_at: z.string().optional() }).parse(req.body)
    return patchRecord(viewingDef(), id, { status: 'Completed', feedback: b.feedback ?? viewing.feedback, interest_level: b.interest_level ?? viewing.interest_level, follow_up_required: b.follow_up_required ?? viewing.follow_up_required, follow_up_at: b.follow_up_at ?? viewing.follow_up_at, agent_notes: b.feedback ? viewing.agent_notes + '\n\nClient feedback: ' + b.feedback : viewing.agent_notes }, req.ctx)
  })

  app.post('/api/viewings/:id/cancel', async (req) => {
    const { id, viewing } = loadViewing(req, true)
    const b = z.object({ reason: z.string().min(5).max(500) }).parse(req.body)
    return patchRecord(viewingDef(), id, { status: 'Cancelled', client_notes: b.reason }, req.ctx)
  })

  app.post('/api/viewings/:id/reschedule', async (req) => {
    const { id, viewing } = loadViewing(req, true)
    const b = z.object({ scheduled_at: z.string().min(1), duration_min: z.number().int().min(15).max(180).optional() }).parse(req.body)
    return patchRecord(viewingDef(), id, { status: 'Rescheduled', scheduled_at: b.scheduled_at, duration_min: b.duration_min ?? viewing.duration_min }, req.ctx)
  })

  // Virtual viewing link
  app.post('/api/viewings/:id/virtual-link', async (req) => {
    const { id, viewing } = loadViewing(req, true)
    const b = z.object({ virtual_link: z.string().url() }).parse(req.body)
    return patchRecord(viewingDef(), id, { virtual_link: b.virtual_link, virtual: true }, req.ctx)
  })

  // Offer management
  app.post('/api/offers/:id/submit', async (req) => {
    const { id, offer } = loadOffer(req, true)
    if (offer.status !== 'Draft') throw bad('Only draft offers can be submitted')
    return patchRecord(offerDef(), id, { status: 'Submitted' }, req.ctx)
  })

  app.post('/api/offers/:id/accept', async (req) => {
    const { id, offer } = loadOffer(req, true)
    if (offer.status !== 'Submitted' && offer.status !== 'Under Review') throw bad('Only submitted or under review offers can be accepted')
    return patchRecord(offerDef(), id, { status: 'Accepted', responded_at: nowLocal() }, req.ctx)
  })

  app.post('/api/offers/:id/reject', async (req) => {
    const { id, offer } = loadOffer(req, true)
    const b = z.object({ reason: z.string().min(10).max(1000) }).parse(req.body)
    if (offer.status !== 'Submitted' && offer.status !== 'Under Review' && offer.status !== 'Negotiating') throw bad('Only active offers can be rejected')
    return patchRecord(offerDef(), id, { status: 'Rejected', responded_at: nowLocal(), special_conditions: (offer.special_conditions ?? '') + '\n\nRejection reason: ' + b.reason }, req.ctx)
  })

  app.post('/api/offers/:id/counter', async (req) => {
    const { id, offer } = loadOffer(req, true)
    const b = z.object({ counter_price: z.number().positive(), counter_terms: z.string().max(1000).optional() }).parse(req.body)
    if (!['Submitted', 'Under Review', 'Negotiating'].includes(offer.status)) throw bad('Only active offers can be countered')
    return patchRecord(offerDef(), id, { status: 'Countered', counter_price: b.counter_price, counter_terms: b.counter_terms, responded_at: nowLocal() }, req.ctx)
  })

  app.post('/api/offers/:id/withdraw', async (req) => {
    const { id, offer } = loadOffer(req, true)
    if (!['Draft', 'Submitted', 'Under Review', 'Negotiating', 'Countered'].includes(offer.status)) throw bad('Offer cannot be withdrawn in its current state')
    return patchRecord(offerDef(), id, { status: 'Withdrawn' }, req.ctx)
  })

  // Mandate search
  app.get('/api/search/mandates', async (req) => {
    need(req, 'mandates', 'view')
    const qs = req.query as any
    const type = String(qs.type ?? 'mandate_no'), op = String(qs.op ?? 'contains'), value = String(qs.value ?? '').trim()
    if (!value) throw bad('Enter a value to search for')
    const map: Record<string, { entity: string; field: string }> = {
      mandate_no: { entity: 'mandates', field: 'mandate_no' },
      property: { entity: 'mandates', field: 'property_id' },
      owner: { entity: 'mandates', field: 'owner_id' },
      agent: { entity: 'mandates', field: 'agent_id' },
      status: { entity: 'mandates', field: 'status' }
    }
    const m = map[type]
    if (!m) throw bad('Unknown search type')
    const opSql = op === 'equals' ? 'eq' : op === 'starts with' ? 'starts' : op === 'ends with' ? 'ends' : op
    const filters = [{ field: m.field, op: opSql, value }]
    const res = listRecords(mandateDef(), { filters, pageSize: 200, sort: 'start_date', dir: 'desc' }, req.ctx)
    return { total: res.total, rows: res.rows.map(r => ({ id: r.id, mandate_no: r.mandate_no, property: r._labels.property_id ?? '', owner: r._labels.owner_id ?? '', agent: r._labels.agent_id ?? '', mandate_type: r.mandate_type, status: r.status, asking_price: r.asking_price, asking_rent: r.asking_rent, start_date: r.start_date, end_date: r.end_date })) }
  })

  // Viewing search
  app.get('/api/search/viewings', async (req) => {
    need(req, 'mandates', 'view')
    const qs = req.query as any
    const type = String(qs.type ?? 'viewing_no'), op = String(qs.op ?? 'contains'), value = String(qs.value ?? '').trim()
    if (!value) throw bad('Enter a value to search for')
    const map: Record<string, { entity: string; field: string }> = {
      viewing_no: { entity: 'viewings', field: 'viewing_no' },
      mandate: { entity: 'viewings', field: 'mandate_id' },
      property: { entity: 'viewings', field: 'property_id' },
      lead: { entity: 'viewings', field: 'lead_id' },
      status: { entity: 'viewings', field: 'status' }
    }
    const m = map[type]
    if (!m) throw bad('Unknown search type')
    const opSql = op === 'equals' ? 'eq' : op === 'starts with' ? 'starts' : op === 'ends with' ? 'ends' : op
    const filters = [{ field: m.field, op: opSql, value }]
    const res = listRecords(viewingDef(), { filters, pageSize: 200, sort: 'scheduled_at', dir: 'desc' }, req.ctx)
    return { total: res.total, rows: res.rows.map(r => ({ id: r.id, viewing_no: r.viewing_no, mandate: r._labels.mandate_id ?? '', property: r._labels.property_id ?? '', lead: r._labels.lead_id ?? '', agent: r._labels.agent_id ?? '', scheduled_at: r.scheduled_at, status: r.status })) }
  })

  // Offer search
  app.get('/api/search/offers', async (req) => {
    need(req, 'transactions', 'view')
    const qs = req.query as any
    const type = String(qs.type ?? 'offer_no'), op = String(qs.op ?? 'contains'), value = String(qs.value ?? '').trim()
    if (!value) throw bad('Enter a value to search for')
    const map: Record<string, { entity: string; field: string }> = {
      offer_no: { entity: 'offers', field: 'offer_no' },
      property: { entity: 'offers', field: 'property_id' },
      buyer: { entity: 'offers', field: 'buyer_id' },
      status: { entity: 'offers', field: 'status' }
    }
    const m = map[type]
    if (!m) throw bad('Unknown search type')
    const opSql = op === 'equals' ? 'eq' : op === 'starts with' ? 'starts' : op === 'ends with' ? 'ends' : op
    const filters = [{ field: m.field, op: opSql, value }]
    const res = listRecords(offerDef(), { filters, pageSize: 200, sort: 'offer_date', dir: 'desc' }, req.ctx)
    return { total: res.total, rows: res.rows.map(r => ({ id: r.id, offer_no: r.offer_no, property: r._labels.property_id ?? '', buyer: r._labels.buyer_id ?? '', offer_type: r.offer_type, status: r.status, offer_price: r.offer_price, offer_date: r.offer_date })) }
  })
}