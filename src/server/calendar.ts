import { HttpError } from './util'
import { ENTITIES } from '../shared/entities'
import type { CalendarCategory, CalendarEvent } from '../shared/calendar'
import { CALENDAR_CATEGORIES } from '../shared/calendar'
import { can, getRecord, listRecords, type Ctx } from './engine'

const categoryFor: Record<string, CalendarCategory> = { jobs: 'sales', documents: 'sales', crm: 'activities', projects: 'work', finance: 'finance', sales: 'sales', hr: 'people', compliance: 'compliance', properties: 'properties', leases: 'leases' }
const specialTypes: Record<string, string> = { 'jobs.target_close': 'Target Close', 'jobs.deal_date': 'Deal Date', 'invoices.due_date': 'Invoice due', 'bills.due_date': 'Bill due', 'quotations.valid_until': 'Quote expiry', 'contracts.end_date': 'Contract end', 'tasks.due_date': 'Task', 'leave_requests.from_date': 'Leave', 'viewings.scheduled_at': 'Viewing', 'handovers.scheduled_at': 'Handover', 'leases.start_date': 'Lease Start', 'leases.end_date': 'Lease End', 'maintenance.scheduled_at': 'Maintenance', 'inspections.scheduled_at': 'Inspection' }
const spanEnd: Record<string, string> = { activities: 'end_at', leave_requests: 'to_date', projects: 'end_date' }
const finished = new Set(['done', 'completed', 'closed', 'paid', 'cancelled', 'canceled', 'void', 'voided', 'rejected', 'disposed', 'filed', 'renewed', 'delivered', 'empty returned'])

export function calendarEvents(from: string, to: string, ctx: Ctx): CalendarEvent[] {
  const events: CalendarEvent[] = []
  const readableParents = new Map<string, boolean>()
  for (const def of Object.values(ENTITIES)) {
    if (!can(ctx.user, def.module, 'view')) continue
    const parent = def.child ? Object.values(ENTITIES).find(p => p.children?.some(c => c.entity === def.key)) : undefined
    const parentLink = parent?.children?.find(c => c.entity === def.key)
    if (def.child && !parentLink) continue
    for (const field of def.fields.filter(f => ['date', 'datetime'].includes(f.type) && !f.hidden && !f.secret && !f.virtual)) {
      const spanStart = def.calendar?.field ?? (def.key === 'projects' ? 'start_date' : undefined)
      const endField = spanStart === field.name ? spanEnd[def.key] : undefined
      if (field.name === spanEnd[def.key] && spanStart) continue
      const filters = endField
        ? [{ field: field.name, op: 'lte' as const, value: to + 'T23:59:59' }, { field: endField, op: 'gte' as const, value: from }]
        : [{ field: field.name, op: 'gte' as const, value: from }, { field: field.name, op: 'lte' as const, value: to + 'T23:59:59' }]
      const batches = [listRecords(def, { filters, pageSize: 100000 }, ctx).rows]
      if (endField) batches.push(listRecords(def, { filters: [{ field: field.name, op: 'gte', value: from }, { field: field.name, op: 'lte', value: to + 'T23:59:59' }, { field: endField, op: 'null' }], pageSize: 100000 }, ctx).rows)
      const seen = new Set<number>()
      for (const record of batches.flat()) {
        if (seen.has(record.id)) continue
        seen.add(record.id)
        if (parent && parentLink) {
          const parentId = Number(record[parentLink.fk]), key = `${parent.key}:${parentId}`
          if (!readableParents.has(key)) {
            try { getRecord(parent, parentId, ctx, { children: false }); readableParents.set(key, true) }
            catch (error) { if (error instanceof HttpError && [403, 404].includes(error.status)) readableParents.set(key, false); else throw error }
          }
          if (!readableParents.get(key)) continue
        }
        const status = String(record[def.statusField ?? (def.key === 'jobs' ? 'job_status' : 'status')] ?? '')
        if (['cancelled', 'canceled', 'void', 'voided', 'rejected'].includes(status.toLowerCase())) continue
        const category = def.module === 'crm' && def.key !== 'activities' ? 'sales' : categoryFor[def.module] ?? 'other'
        const type = def.key === 'activities' && field.name === 'start_at' ? String(record.type) : specialTypes[`${def.key}.${field.name}`] ?? `${def.label} · ${field.label}`
        const ownerField = ['assignee_id', 'owner_id', 'operator_id', 'manager_id', 'assigned_to', 'user_id', 'requested_by'].find(name => record[name])
        const date = String(record[field.name])
        const end = endField ? String(record[endField]) : date
        const title = def.key === 'leave_requests' ? `${record._labels?.employee_id ?? 'Employee'} · ${record.type} leave` : record._title ?? '#' + record.id
        const catInfo = CALENDAR_CATEGORIES[category]
        events.push({ 
          uid: `${def.key}:${record.id}:${field.name}`, 
          id: record.id, 
          entity: def.key, 
          category, 
          type, 
          title, 
          start: date, 
          end, 
          link: `/e/${def.key}/${record.id}`, 
          allDay: field.type === 'date', 
          status: record[def.statusField ?? 'status'] ?? '', 
          completed: finished.has(String(record[def.statusField ?? 'status'] ?? '').toLowerCase()),
          deadline: def.calendar != null || ['due_date', 'end_date', 'target_close', 'expiry_date', 'end_date'].includes(field.name),
          owner: record[ownerField ?? ''] ?? '',
          ownerId: ownerField ? Number(record[ownerField]) : null,
          location: '',
          priority: '',
          color: catInfo.color,
          date,
        })
      }
    }
  }
  return events
}
