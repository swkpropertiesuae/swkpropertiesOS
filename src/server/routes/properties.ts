import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { q, tx } from '../db'
import { assertCan, createRecord, deleteRecord, getDef, getRecord, listRecords, patchRecord, SYSTEM_CTX, updateRecord, audit } from '../engine'
import { bad, notFound, nowLocal, todayStr } from '../util'
import { body, idOf, need } from './helpers'
import { queueEmail } from '../mailer'
import { getSetting } from '../settings'

export default async function (app: FastifyInstance) {
  const propertyDef = () => getDef('properties')
  const unitDef = () => getDef('units')
  const communityDef = () => getDef('communities')
  const developerDef = () => getDef('developers')

  const loadProperty = (req: any, edit = false) => {
    const id = idOf(req.params.id)
    if (edit) assertCan(req.ctx, 'properties', 'edit')
    return { id, property: getRecord(propertyDef(), id, req.ctx, { children: { units: true, media: true } }) }
  }

  const loadUnit = (req: any, edit = false) => {
    const id = idOf(req.params.id)
    if (edit) assertCan(req.ctx, 'properties', 'edit')
    return { id, unit: getRecord(unitDef(), id, req.ctx, { children: { media: true } }) }
  }

  // Property media upload/delete
  app.post('/api/properties/:id/media', async (req) => {
    const { id } = loadProperty(req, true)
    const b = z.object({ url: z.string().url(), caption: z.string().max(200).optional(), order: z.number().int().min(0).optional() }).parse(req.body)
    const prop = getRecord(propertyDef(), id, req.ctx)
    const media = prop.media ? JSON.parse(prop.media) : []
    media.push({ url: b.url, caption: b.caption, order: b.order ?? media.length, created_at: new Date().toISOString() })
    return patchRecord(propertyDef(), id, { media: JSON.stringify(media) }, req.ctx)
  })

  app.delete('/api/properties/:id/media/:mediaId', async (req) => {
    const { id } = loadProperty(req, true)
    const mediaId = idOf((req.params as any).mediaId)
    const prop = getRecord(propertyDef(), id, req.ctx)
    const media = prop.media ? JSON.parse(prop.media) : []
    const filtered = media.filter((m: any, i: number) => i !== mediaId)
    return patchRecord(propertyDef(), id, { media: JSON.stringify(filtered) }, req.ctx)
  })

  // Unit media upload/delete
  app.post('/api/units/:id/media', async (req) => {
    const { id } = loadUnit(req, true)
    const b = z.object({ url: z.string().url(), caption: z.string().max(200).optional(), order: z.number().int().min(0).optional() }).parse(req.body)
    const unit = getRecord(unitDef(), id, req.ctx)
    const media = unit.media ? JSON.parse(unit.media) : []
    media.push({ url: b.url, caption: b.caption, order: b.order ?? media.length, created_at: new Date().toISOString() })
    return patchRecord(unitDef(), id, { media: JSON.stringify(media) }, req.ctx)
  })

  app.delete('/api/units/:id/media/:mediaId', async (req) => {
    const { id } = loadUnit(req, true)
    const mediaId = idOf((req.params as any).mediaId)
    const unit = getRecord(unitDef(), id, req.ctx)
    const media = unit.media ? JSON.parse(unit.media) : []
    const filtered = media.filter((m: any, i: number) => i !== mediaId)
    return patchRecord(unitDef(), id, { media: JSON.stringify(filtered) }, req.ctx)
  })

  // Bulk status updates
  app.post('/api/properties/bulk-status', async (req) => {
    need(req, 'properties', 'edit')
    const b = z.object({ ids: z.array(z.number().int()).min(1).max(100), status: z.enum(['Available', 'Under Offer', 'Sold', 'Off-Plan', 'Rented', 'Reserved', 'Withdrawn']) }).parse(req.body)
    for (const id of b.ids) {
      const prop = getRecord(propertyDef(), id, req.ctx, { children: false })
      patchRecord(propertyDef(), id, { status: b.status }, req.ctx)
    }
    return { updated: b.ids.length }
  })

  app.post('/api/units/bulk-status', async (req) => {
    need(req, 'properties', 'edit')
    const b = z.object({ ids: z.array(z.number().int()).min(1).max(100), status: z.enum(['Available', 'Reserved', 'Under Offer', 'Sold', 'Rented', 'Under Maintenance', 'Blocked']) }).parse(req.body)
    for (const id of b.ids) {
      const unit = getRecord(unitDef(), id, req.ctx, { children: false })
      patchRecord(unitDef(), id, { status: b.status }, req.ctx)
    }
    return { updated: b.ids.length }
  })

  // Property search with filters
  app.get('/api/search/properties', async (req) => {
    need(req, 'properties', 'view')
    const qs = req.query as any
    const type = String(qs.type ?? 'title'), op = String(qs.op ?? 'contains'), value = String(qs.value ?? '').trim()
    if (!value) throw bad('Enter a value to search for')
    const map: Record<string, { entity: string; field: string }> = {
      title: { entity: 'properties', field: 'title' },
      property_type: { entity: 'properties', field: 'property_type' },
      status: { entity: 'properties', field: 'status' },
      community: { entity: 'properties', field: 'community_id' },
      developer: { entity: 'properties', field: 'developer_id' },
      rera_permit_no: { entity: 'properties', field: 'rera_permit_no' },
      ejari_no: { entity: 'properties', field: 'ejari_no' },
      title_deed_no: { entity: 'properties', field: 'title_deed_no' }
    }
    const m = map[type]
    if (!m) throw bad('Unknown search type')
    const opSql = op === 'equals' ? 'eq' : op === 'starts with' ? 'starts' : op === 'ends with' ? 'ends' : op
    let filters: any[] = [{ field: m.field, op: opSql, value }]
    const res = listRecords(propertyDef(), { filters, pageSize: 200, sort: 'listed_date', dir: 'desc' }, req.ctx)
    return { total: res.total, rows: res.rows.map(r => ({ id: r.id, title: r.title, property_type: r.property_type, status: r.status, price: r.price, rent_annual: r.rent_annual, community: r._labels.community_id ?? '', developer: r._labels.developer_id ?? '', listed_date: r.listed_date })) }
  })

  // Unit search
  app.get('/api/search/units', async (req) => {
    need(req, 'properties', 'view')
    const qs = req.query as any
    const type = String(qs.type ?? 'unit_no'), op = String(qs.op ?? 'contains'), value = String(qs.value ?? '').trim()
    if (!value) throw bad('Enter a value to search for')
    const map: Record<string, { entity: string; field: string }> = {
      unit_no: { entity: 'units', field: 'unit_no' },
      property: { entity: 'units', field: 'property_id' },
      status: { entity: 'units', field: 'status' }
    }
    const m = map[type]
    if (!m) throw bad('Unknown search type')
    const opSql = op === 'equals' ? 'eq' : op === 'starts with' ? 'starts' : op === 'ends with' ? 'ends' : op
    let filters: any[] = [{ field: m.field, op: opSql, value }]
    const res = listRecords(unitDef(), { filters, pageSize: 200, sort: 'unit_no', dir: 'asc' }, req.ctx)
    return { total: res.total, rows: res.rows.map(r => ({ id: r.id, unit_no: r.unit_no, property: r._labels.property_id ?? '', status: r.status, bedrooms: r.bedrooms, sale_price: r.sale_price, rent_annual: r.rent_annual })) }
  })

  // Communities search
  app.get('/api/search/communities', async (req) => {
    need(req, 'masters', 'view')
    const qs = req.query as any
    const value = String(qs.value ?? '').trim()
    if (!value) throw bad('Enter a value to search for')
    const rows = q.all(`SELECT id, code, name, emirate, master_developer, active FROM communities WHERE deleted_at IS NULL AND (name LIKE ? OR code LIKE ? OR emirate LIKE ?) ORDER BY name LIMIT 100`, `%${value}%`, `%${value}%`, `%${value}%`)
    return rows
  })

  // Developers search
  app.get('/api/search/developers', async (req) => {
    need(req, 'masters', 'view')
    const qs = req.query as any
    const value = String(qs.value ?? '').trim()
    if (!value) throw bad('Enter a value to search for')
    const rows = q.all(`SELECT id, code, name, rera_id, active FROM developers WHERE deleted_at IS NULL AND (name LIKE ? OR code LIKE ? OR rera_id LIKE ?) ORDER BY name LIMIT 100`, `%${value}%`, `%${value}%`, `%${value}%`)
    return rows
  })
}