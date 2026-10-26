import { q } from '../db'
import { addDays, daysBetween, todayStr, fromCents, toCents, r2, nowLocal } from '../util'
import { createRecord, getDef, SYSTEM_CTX } from '../engine'
import { businessSnapshot } from '../integrations/snapshot'
import { queueEmail } from '../mailer'
import { sendWhatsApp, messageOwners, phonesForParty, normalizePhone, findPartyByPhone } from '../integrations/whatsapp'
import { notifyRole } from '../notify'
import { addJobEvent } from '../domain/jobs'
import { getSetting } from '../settings'
import { MODES } from '../../shared/entities/crm'
import { currentCall, setOutcome } from './voice-context'

export type Risk = 'read' | 'internal' | 'external'
export interface Tool { name: string; description: string; risk: Risk; parameters: any; run: (a: any, ctx: { agent: string }) => Promise<any> | any; summarize?: (a: any) => string }

const S = (description: string) => ({ type: 'string', description })
const Nn = (description: string) => ({ type: 'number', description })
const obj = (properties: Record<string, any>, required: string[] = []) => ({ type: 'object', properties, required })
const money = (c: number | null | undefined) => r2(fromCents(c))
const lim = (a: any, d = 15) => Math.min(Math.max(Number(a?.limit) || d, 1), 40)
const adminId = () => q.val<number>(`SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'Admin' AND u.deleted_at IS NULL ORDER BY u.id LIMIT 1`) ?? 1
const dealByNo = (no: string) => q.get(`SELECT * FROM jobs WHERE deleted_at IS NULL AND job_no = ? LIMIT 1`, String(no).trim().toUpperCase())
const partyByName = (s: string) => q.get(`SELECT * FROM parties WHERE deleted_at IS NULL AND (code = ? OR name LIKE ?) ORDER BY (name = ?) DESC, id LIMIT 1`, s, `%${s}%`, s)

// ---------------------------------------------------------------- helpers for the phone receptionist
const digits9 = (s: string) => String(s ?? '').replace(/\D/g, '').slice(-9)
const clip = (v: unknown, n = 300) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n)
export const leadByPhone = (phone: string): { id: number; lead_no: string; company: string } | null => (digits9(phone).length >= 7 ? (q.get(`SELECT id, lead_no, company FROM leads WHERE deleted_at IS NULL AND status NOT IN ('Converted','Unqualified') AND replace(replace(replace(phone,'+',''),' ',''),'-','') LIKE ? ORDER BY id DESC LIMIT 1`, `%${digits9(phone)}`) as any) ?? null : null)
const commentOn = (entity: string, id: number, text: string, agent: string) => q.run(`INSERT INTO comments(entity, record_id, user_id, body, created_at) VALUES (?,?,?,?,?)`, entity, id, adminId(), `[AI · ${agent}] ${text.slice(0, 2000)}`, new Date().toISOString())
/** The caller's number comes from the telephone network (caller ID); a number the model typed is used only when none is available. */
const callerPhone = (typed?: unknown) => normalizePhone(currentCall()?.from || String(typed ?? ''))

/** Find the open lead for this number or register a new one, so repeat callers never create duplicates. */
function ensureLead(a: { name?: string; phone?: string; interest?: string; notes?: string }, agent: string): { id: number; lead_no: string; created: boolean } {
  const phone = callerPhone(a.phone), name = clip(a.name, 80), notes = clip(a.notes, 1500)
  const call = currentCall()
  const existing = phone ? leadByPhone(phone) : null
  if (existing) {
    if (notes) commentOn('leads', existing.id, `Phone call: ${notes}`, agent)
    if (call) call.leadId = existing.id
    return { id: existing.id, lead_no: existing.lead_no, created: false }
  }
  const interest = MODES.includes(String(a.interest)) ? a.interest : null
  const r = createRecord(getDef('leads'), { company: name || (phone ? `Caller +${phone}` : 'Unknown caller'), contact_name: name || null, phone: phone ? '+' + phone : null, source: 'Inbound call', status: 'New', interest, notes: notes ? `Phone call: ${notes}` : 'Phone call to the AI receptionist' }, SYSTEM_CTX)
  const row = q.get(`SELECT lead_no FROM leads WHERE id = ?`, r.id)
  if (call) call.leadId = r.id
  notifyRole('crm', `New phone lead: ${name || phone || 'unknown caller'}`, notes.slice(0, 160), `/e/leads/${r.id}`, 'info')
  return { id: r.id, lead_no: row?.lead_no ?? String(r.id), created: true }
}

const staffTask = (title: string, details: string, priority: 'Medium' | 'High' | 'Urgent', lead?: { id: number; lead_no: string }) =>
  createRecord(getDef('tasks'), { title: clip(title, 200), description: details.slice(0, 2000), due_date: todayStr(), priority, kind: 'Follow-up', link_entity: lead ? 'leads' : null, link_id: lead?.id ?? null, link_label: lead?.lead_no ?? null, assignee_id: adminId() }, SYSTEM_CTX)

export const TOOLS: Tool[] = [
  { name: 'business_snapshot', risk: 'read', description: 'Key numbers: active deals, pipeline value, rent roll, receivables, overdue, payables, cash, leads, tickets, tasks, expiring leases.', parameters: obj({}), run: () => businessSnapshot().data },
  { name: 'search_deals', risk: 'read', description: 'Find deal files by deal number, property, client name, status or deal type.', parameters: obj({ query: S('text to search'), status: S('Lead | Active Mandate | Offer Submitted | Offer Accepted | Contract Signed | DLD Submitted | DLD Approved | Title Deed Issued | Completed | Cancelled | On Hold'), limit: Nn('max rows') }),
    run: a => q.all(`SELECT j.job_no, j.deal_name, j.deal_type, j.job_status, p.name client, j.deal_value, j.deal_date, j.target_close, j.operational_status FROM jobs j LEFT JOIN parties p ON p.id = j.client_id WHERE j.deleted_at IS NULL ${a.status ? 'AND j.job_status = ?' : ''} ${a.query ? `AND (j.job_no LIKE ? OR j.deal_name LIKE ? OR p.name LIKE ? OR j.property_id IN (SELECT id FROM properties WHERE title LIKE ?))` : ''} ORDER BY j.id DESC LIMIT ${lim(a)}`, ...(a.status ? [a.status] : []), ...(a.query ? Array(4).fill(`%${a.query}%`) : [])) },
  { name: 'get_deal', risk: 'read', description: 'Full picture of one deal: parties, property, dates, charges, invoices, timeline events.', parameters: obj({ deal_no: S('deal number') }, ['deal_no']),
    run: a => {
      const j = dealByNo(a.deal_no); if (!j) return { error: 'Deal not found' }
      const lab = (id: number | null) => (id ? q.val<string>(`SELECT name FROM parties WHERE id = ?`, id) : null)
      return {
        deal_no: j.job_no, deal_name: j.deal_name, deal_type: j.deal_type, status: j.job_status, client: lab(j.client_id), owner: lab(j.owner_id), agent: lab(j.agent_id),
        deal_value: money(j.deal_value), commission_pct: j.commission_pct, target_close: j.target_close, operational_status: j.operational_status,
        property: q.val<string>(`SELECT title FROM properties WHERE id = ?`, j.property_id),
        revenue_aed: money(j.total_revenue), cost_aed: money(j.total_cost), profit_aed: money((j.total_revenue ?? 0) - (j.total_cost ?? 0)),
        invoices: q.all(`SELECT invoice_no, doc_type, status, due_date, total, balance, currency FROM invoices WHERE job_id = ? AND deleted_at IS NULL`, j.id).map(i => ({ ...i, total: money(i.total), balance: money(i.balance) })),
        events: q.all(`SELECT event_at, event_type, description FROM job_events WHERE job_id = ? AND deleted_at IS NULL ORDER BY event_at DESC, id DESC LIMIT 6`, j.id),
      }
    } },
  { name: 'search_parties', risk: 'read', description: 'Find customers/vendors by name or code with credit limit and outstanding balance.', parameters: obj({ query: S('name or code'), limit: Nn('max rows') }, ['query']),
    run: a => q.all(`SELECT p.code, p.name, p.status, p.phone, p.email, p.credit_limit, p.credit_days, (SELECT COALESCE(SUM(balance * ex_rate),0) FROM invoices i WHERE i.party_id = p.id AND i.status IN ('Posted','Partially paid') AND i.doc_type IN ('Tax Invoice','Debit Note') AND i.deleted_at IS NULL) outstanding FROM parties p WHERE p.deleted_at IS NULL AND (p.name LIKE ? OR p.code LIKE ?) LIMIT ${lim(a, 10)}`, `%${a.query}%`, `%${a.query}%`).map(r => ({ ...r, credit_limit: money(r.credit_limit), outstanding_aed: money(r.outstanding), outstanding: undefined })) },
  { name: 'overdue_invoices', risk: 'read', description: 'Overdue receivables sorted by days overdue, with customer contact details.', parameters: obj({ min_days_overdue: Nn('minimum days past due'), limit: Nn('max rows') }),
    run: a => q.all(`SELECT i.invoice_no, i.invoice_date, i.due_date, i.currency, i.balance, i.job_id, p.id party_id, p.name customer, p.email, p.phone FROM invoices i JOIN parties p ON p.id = i.party_id WHERE i.status IN ('Posted','Partially paid') AND i.doc_type IN ('Tax Invoice','Debit Note') AND i.balance > 0 AND i.due_date < ? AND i.deleted_at IS NULL AND i.due_date <= ? ORDER BY i.due_date ASC LIMIT ${lim(a, 20)}`, todayStr(), addDays(todayStr(), -(Number(a.min_days_overdue) || 1))).map(r => ({ ...r, days_overdue: daysBetween(r.due_date, todayStr()), balance: money(r.balance) })) },
  { name: 'party_statement', risk: 'read', description: 'Open invoices and total outstanding for one customer.', parameters: obj({ customer: S('customer name or code') }, ['customer']),
    run: a => { const p = partyByName(a.customer); if (!p) return { error: 'Customer not found' }; const rows = q.all(`SELECT invoice_no, invoice_date, due_date, currency, total, balance FROM invoices WHERE party_id = ? AND status IN ('Posted','Partially paid') AND doc_type IN ('Tax Invoice','Debit Note') AND balance > 0 AND deleted_at IS NULL ORDER BY due_date`, p.id).map(r => ({ ...r, total: money(r.total), balance: money(r.balance) })); return { customer: p.name, open_invoices: rows } } },
  { name: 'bills_due', risk: 'read', description: 'Vendor bills unpaid and due within N days.', parameters: obj({ days: Nn('days ahead (default 7)') }),
    run: a => q.all(`SELECT b.bill_no, b.vendor_invoice_no, p.name vendor, b.due_date, b.currency, b.balance FROM bills b JOIN parties p ON p.id = b.vendor_id WHERE b.status IN ('Posted','Partially paid') AND b.balance > 0 AND b.due_date <= ? AND b.deleted_at IS NULL ORDER BY b.due_date LIMIT 30`, addDays(todayStr(), Number(a.days) || 7)).map(r => ({ ...r, balance: money(r.balance) })) },
  { name: 'pipeline_summary', risk: 'read', description: 'Deals by stage with count and value.', parameters: obj({}), run: () => q.all(`SELECT job_status as stage, COUNT(*) count, COALESCE(SUM(deal_value),0) value FROM jobs WHERE deleted_at IS NULL GROUP BY job_status ORDER BY value DESC`).map(r => ({ ...r, value_aed: money(r.value), value: undefined })) },
  { name: 'rent_roll', risk: 'read', description: 'Active leases with rent, expiry and tenant.', parameters: obj({ limit: Nn('max rows') }),
    run: a => q.all(`SELECT l.lease_no, u.unit_no, p.title property, t.name tenant, l.annual_rent, l.start_date, l.end_date, l.status, l.ejari_no FROM leases l JOIN units u ON u.id = l.unit_id JOIN properties p ON p.id = l.property_id JOIN parties t ON t.id = l.tenant_id WHERE l.deleted_at IS NULL AND l.status IN ('Active','Ejari Registered') ORDER BY l.end_date LIMIT ${lim(a, 30)}`).map(r => ({ ...r, annual_rent: money(r.annual_rent) })) },
  { name: 'expiring_leases', risk: 'read', description: 'Leases expiring within N days.', parameters: obj({ days: Nn('days ahead (default 90)') }),
    run: a => q.all(`SELECT l.lease_no, u.unit_no, t.name tenant, l.end_date, l.annual_rent, l.ejari_no FROM leases l JOIN units u ON u.id = l.unit_id JOIN parties t ON t.id = l.tenant_id WHERE l.deleted_at IS NULL AND l.status IN ('Active','Ejari Registered') AND l.end_date BETWEEN ? AND ? ORDER BY l.end_date LIMIT 30`, todayStr(), addDays(todayStr(), Number(a.days) || 90)).map(r => ({ ...r, annual_rent: money(r.annual_rent) })) },
  { name: 'mandate_health', risk: 'read', description: 'Active mandates with viewings in the last N days, portal publishing, days to expiry and last activity. Fewest viewings first.', parameters: obj({ days: Nn('look-back window for viewings (default 21)'), limit: Nn('max rows') }),
    run: a => { const since = addDays(todayStr(), -(Number(a.days) || 21)); return q.all(`SELECT m.mandate_no, m.property_title, m.mandate_type, m.exclusive, m.portal_publish, m.end_date, m.last_activity, (SELECT COUNT(*) FROM viewings v WHERE v.mandate_id = m.id AND v.deleted_at IS NULL AND v.status NOT IN ('Cancelled') AND substr(v.scheduled_at,1,10) >= ?) viewings FROM mandates m WHERE m.deleted_at IS NULL AND m.status = 'Active' ORDER BY viewings, m.end_date LIMIT ${lim(a, 25)}`, since).map(r => ({ mandate_no: r.mandate_no, property: r.property_title, type: r.mandate_type, exclusive: !!r.exclusive, published_to_portals: !!r.portal_publish, expires: r.end_date, days_to_expiry: r.end_date ? daysBetween(todayStr(), r.end_date) : null, viewings_in_period: r.viewings, last_activity: r.last_activity })) } },
  { name: 'list_leads', risk: 'read', description: 'Leads, newest first, optionally by status.', parameters: obj({ status: S('lead status'), limit: Nn('max rows') }),
    run: a => q.all(`SELECT id, lead_no, company, contact_name, phone, email, source, status, est_value, created_at FROM leads WHERE deleted_at IS NULL ${a.status ? 'AND status = ?' : ''} ORDER BY id DESC LIMIT ${lim(a)}`, ...(a.status ? [a.status] : [])).map(r => ({ ...r, est_value: money(r.est_value) })) },
  { name: 'stale_opportunities', risk: 'read', description: 'Open opportunities with no update for 7+ days, and quotations sent but not answered for 5+ days.', parameters: obj({}),
    run: () => ({ opportunities: q.all(`SELECT opp_no, title, stage, value, updated_at FROM opportunities WHERE deleted_at IS NULL AND stage NOT IN ('Won','Lost') AND substr(updated_at,1,10) < ? LIMIT 15`, addDays(todayStr(), -7)).map(r => ({ ...r, value: money(r.value) })), quotes: q.all(`SELECT q.quote_no, p.name customer, q.status, q.valid_until, q.updated_at FROM quotations q LEFT JOIN parties p ON p.id = q.customer_id WHERE q.deleted_at IS NULL AND q.status = 'Sent' AND substr(q.updated_at,1,10) < ? LIMIT 15`, addDays(todayStr(), -5)) }) },
  { name: 'list_tasks', risk: 'read', description: 'Open tasks, overdue first.', parameters: obj({ limit: Nn('max rows') }), run: a => q.all(`SELECT id, title, status, priority, due_date, link_label FROM tasks WHERE deleted_at IS NULL AND status <> 'Done' ORDER BY (due_date IS NULL), due_date LIMIT ${lim(a, 20)}`) },
  { name: 'open_tickets', risk: 'read', description: 'Open complaints/tickets with age and customer.', parameters: obj({}), run: () => q.all(`SELECT t.id, t.ticket_no, t.subject, t.type, t.priority, t.status, t.created_at, p.name customer FROM tickets t LEFT JOIN parties p ON p.id = t.customer_id WHERE t.deleted_at IS NULL AND t.status NOT IN ('Resolved','Closed') ORDER BY t.id DESC LIMIT 20`) },
  { name: 'expiring_documents', risk: 'read', description: 'Documents, licences, visas and IDs expiring within N days.', parameters: obj({ days: Nn('days ahead (default 30)') }),
    run: a => { const to = addDays(todayStr(), Number(a.days) || 30); return { files: q.all(`SELECT file_name, category, link_label, expiry_date FROM attachments WHERE deleted_at IS NULL AND expiry_date IS NOT NULL AND expiry_date <= ? ORDER BY expiry_date LIMIT 20`, to), employees: q.all(`SELECT name, visa_expiry, passport_expiry, eid_expiry, health_card_expiry FROM employees WHERE deleted_at IS NULL AND status IN ('Active','On leave','Probation') AND (visa_expiry <= ? OR passport_expiry <= ? OR eid_expiry <= ? OR health_card_expiry <= ?) LIMIT 20`, to, to, to, to) } } },
  // ---------------- internal writes
  { name: 'create_task', risk: 'internal', description: 'Create a follow-up task for the team.', parameters: obj({ title: S('what must be done'), details: S('context'), due_in_days: Nn('days from today'), priority: S('Low | Medium | High | Urgent'), deal_no: S('optional related deal number') }, ['title']),
    summarize: a => `Create task: ${a.title}`, run: a => { const j = a.deal_no ? dealByNo(a.deal_no) : null; const r = createRecord(getDef('tasks'), { title: String(a.title).slice(0, 200), description: a.details ?? null, due_date: addDays(todayStr(), Number(a.due_in_days ?? 1)), priority: ['Low', 'Medium', 'High', 'Urgent'].includes(a.priority) ? a.priority : 'Medium', kind: 'Follow-up', link_entity: j ? 'jobs' : null, link_id: j?.id ?? null, link_label: j?.job_no ?? null, assignee_id: adminId() }, SYSTEM_CTX); return { created: r._title, id: r.id } } },
  { name: 'add_note', risk: 'internal', description: 'Add an internal comment on a record (deals, parties, invoices, leads, tickets, quotations).', parameters: obj({ entity: S('jobs | parties | invoices | leads | tickets | quotations'), key: S('deal_no, invoice_no, lead_no, ticket_no, quote_no or customer name'), text: S('comment text') }, ['entity', 'key', 'text']),
    summarize: a => `Note on ${a.entity} ${a.key}: ${String(a.text).slice(0, 80)}`,
    run: (a, c) => {
      const map: Record<string, [string, string]> = { jobs: ['jobs', 'job_no'], invoices: ['invoices', 'invoice_no'], leads: ['leads', 'lead_no'], tickets: ['tickets', 'ticket_no'], quotations: ['quotations', 'quote_no'], parties: ['parties', 'name'] }
      const m = map[a.entity]; if (!m) return { error: 'Unsupported entity' }
      const row = q.get(`SELECT id FROM ${m[0]} WHERE deleted_at IS NULL AND ${m[1]} ${m[1] === 'name' ? 'LIKE' : '='} ? LIMIT 1`, m[1] === 'name' ? `%${a.key}%` : a.key)
      if (!row) return { error: 'Record not found' }
      q.run(`INSERT INTO comments(entity, record_id, user_id, body, created_at) VALUES (?,?,?,?,?)`, m[0], row.id, adminId(), `[AI · ${c.agent}] ${String(a.text).slice(0, 2000)}`, new Date().toISOString())
      return { ok: true }
    } },
  { name: 'create_lead', risk: 'internal', description: 'Register a new sales lead.', parameters: obj({ company: S('company name'), contact_name: S('person'), phone: S('phone / WhatsApp'), email: S('e-mail'), notes: S('what they need') }, ['company']),
    summarize: a => `Create lead: ${a.company}`, run: a => { const r = createRecord(getDef('leads'), { company: a.company, contact_name: a.contact_name ?? null, phone: a.phone ?? null, email: a.email ?? null, notes: a.notes ?? null, source: 'Other', status: 'New' }, SYSTEM_CTX); return { created: r._title, id: r.id } } },
  { name: 'add_deal_event', risk: 'internal', description: 'Record an internal note in a deal timeline.', parameters: obj({ deal_no: S('deal number'), description: S('note') }, ['deal_no', 'description']),
    summarize: a => `Timeline note on ${a.deal_no}`, run: a => { const j = dealByNo(a.deal_no); if (!j) return { error: 'Deal not found' }; addJobEvent(j.id, 'Note', { description: String(a.description).slice(0, 500), source: 'System', visible: false }); return { ok: true } } },
  { name: 'alert_team', risk: 'internal', description: 'Send an in-app alert to managers (and the owner on WhatsApp if configured). Use sparingly for urgent matters.', parameters: obj({ title: S('short headline'), message: S('details') }, ['title']),
    summarize: a => `Alert: ${a.title}`, run: async a => { notifyRole('ai', `AI alert: ${a.title}`, a.message ?? '', '/ai', 'alert'); await messageOwners(`⚠ ${a.title}${a.message ? '\n' + a.message : ''}`, 'agent', 'wa_tpl_notify'); return { ok: true } } },
  // ---------------- external (leaves the company)
  { name: 'send_email', risk: 'external', description: 'E-mail a customer, vendor or colleague (plain text). Always professional and concise; sign as the SWK Properties team.', parameters: obj({ to: S('recipient e-mail'), subject: S('subject'), body: S('message') }, ['to', 'subject', 'body']),
    summarize: a => `E-mail to ${a.to}: ${a.subject}`, run: a => { if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a.to)) return { error: 'Invalid e-mail' }; return { queued_email_id: queueEmail({ to: a.to, subject: a.subject, body: a.body }) } } },
  { name: 'send_whatsapp', risk: 'external', description: 'Send a WhatsApp message to a phone number or to all contacts of a customer.', parameters: obj({ to: S('phone number in international format, or customer name'), text: S('message') }, ['to', 'text']),
    summarize: a => `WhatsApp to ${a.to}: ${String(a.text).slice(0, 80)}`,
    run: async a => { const nums = /^[\d+\s-]{7,}$/.test(String(a.to)) ? [a.to] : (() => { const p = partyByName(String(a.to)); return p ? phonesForParty(p.id).slice(0, 2) : [] })(); if (!nums.length) return { error: 'No phone found' }; const out = []; for (const n of nums) out.push(await sendWhatsApp(n, a.text, { origin: 'agent', tpl: 'wa_tpl_notify' })); return out } },
  // ---------------- phone receptionist (read)
  { name: 'lookup_listings', risk: 'read', description: 'Search available properties for sale or rent. Returns spoken-friendly facts only (no owner details). Prices are AED.',
    parameters: obj({ purpose: S('sale | rent'), bedrooms: Nn('number of bedrooms (0 = studio)'), area: S('community, building or area name'), max_price_aed: Nn('budget ceiling: sale price, or yearly rent'), limit: Nn('max rows (default 4)') }),
    run: a => {
      const rent = String(a.purpose).toLowerCase().startsWith('rent'), n = Math.min(Math.max(Number(a.limit) || 4, 1), 6)
      const where = [`deleted_at IS NULL`, `active = 1`, `status IN ('Available','Off-Plan')`, rent ? `rent_annual > 0` : `price > 0`], args: any[] = []
      if (a.bedrooms !== undefined && a.bedrooms !== null && a.bedrooms !== '') { where.push(`bedrooms = ?`); args.push(Number(a.bedrooms)) }
      if (a.area) { where.push(`(community_id LIKE ? OR sub_community LIKE ? OR building_name LIKE ? OR title LIKE ?)`); args.push(...Array(4).fill(`%${clip(a.area, 60)}%`)) }
      if (Number(a.max_price_aed) > 0) { where.push(`${rent ? 'rent_annual' : 'price'} <= ?`); args.push(toCents(a.max_price_aed)) }
      const rows = q.all(`SELECT property_no, title, property_type, community_id, sub_community, building_name, bedrooms, bathrooms, area_sqft, furnishing, price, rent_annual, is_off_plan, payment_plan, completion_year, available_date FROM properties WHERE ${where.join(' AND ')} ORDER BY listed_date DESC, id DESC LIMIT ${n}`, ...args)
      return { found: rows.length, listings: rows.map(r => ({ ref: r.property_no, title: r.title, type: r.property_type, area: [r.building_name, r.sub_community, r.community_id].filter(Boolean).join(', '), bedrooms: r.bedrooms, bathrooms: r.bathrooms, size_sqft: r.area_sqft, furnishing: r.furnishing, [rent ? 'rent_per_year_aed' : 'price_aed']: money(rent ? r.rent_annual : r.price), off_plan: !!r.is_off_plan, payment_plan: r.is_off_plan ? r.payment_plan : undefined, completion_year: r.is_off_plan ? r.completion_year : undefined, available_from: r.available_date })) }
    } },
  { name: 'find_caller', risk: 'read', description: 'Check whether the caller\'s phone number matches a known customer or lead. Caller ID can be spoofed: use this only to greet and route, never to read out account details.',
    parameters: obj({ phone: S('only if the caller ID is unavailable') }),
    run: a => {
      const phone = callerPhone(a.phone); if (!phone) return { known: false, note: 'No caller ID' }
      const known = findPartyByPhone(phone), lead = leadByPhone(phone)
      const party = known ? q.get(`SELECT id, name FROM parties WHERE id = ?`, known.party_id) : null
      return {
        known: !!(party || lead), kind: party ? 'customer' : lead ? 'lead' : 'new caller', name: known?.contact || party?.name || lead?.company || null,
        active_leases: party ? q.val<number>(`SELECT COUNT(*) FROM leases WHERE tenant_id = ? AND status IN ('Active','Ejari Registered') AND deleted_at IS NULL`, party.id) ?? 0 : 0,
        open_tickets: party ? q.val<number>(`SELECT COUNT(*) FROM tickets WHERE customer_id = ? AND status NOT IN ('Resolved','Closed') AND deleted_at IS NULL`, party.id) ?? 0 : 0,
        note: 'Caller ID is not proof of identity. Do not disclose balances, contract terms or personal data; take a message or offer a call-back from a colleague.',
      }
    } },
  // ---------------- phone receptionist (internal writes)
  { name: 'capture_lead', risk: 'internal', description: 'Save the caller as a sales lead (or add to their existing lead). Use once you have their name and what they are looking for.',
    parameters: obj({ name: S('caller name'), phone: S('only if caller ID is unavailable'), interest: S(`one of: ${MODES.join(' | ')}`), notes: S('budget, area, bedrooms, timeline, financing, anything useful for the agent') }, ['notes']),
    summarize: a => `Capture lead: ${a.name ?? 'caller'}`,
    run: (a, c) => { const l = ensureLead(a, c.agent); setOutcome('Lead captured'); return { lead_no: l.lead_no, new_lead: l.created } } },
  { name: 'request_viewing', risk: 'internal', description: 'Ask the sales team to arrange a viewing. A colleague confirms the exact time with the caller, so never promise a slot.',
    parameters: obj({ name: S('caller name'), phone: S('only if caller ID is unavailable'), property: S('listing reference (e.g. PRP-26-00012) or the building/area they mean'), preferred_time: S('when the caller would like to view, in their words'), notes: S('budget, number of people, other requirements') }, ['name', 'property']),
    summarize: a => `Viewing request: ${a.property}`,
    run: (a, c) => {
      const l = ensureLead({ name: a.name, phone: a.phone, notes: `Wants to view ${clip(a.property, 120)}${a.preferred_time ? ` – ${clip(a.preferred_time, 80)}` : ''}. ${clip(a.notes, 500)}` }, c.agent)
      staffTask(`Book viewing: ${clip(a.property, 80)} for ${clip(a.name, 60)}`, `Caller ${clip(a.name, 80)} (+${callerPhone(a.phone)}) asked to view ${clip(a.property, 160)}.\nPreferred time: ${clip(a.preferred_time, 120) || 'not stated'}.\n${clip(a.notes, 500)}\nCall them back to confirm the slot and create the viewing.`, 'High', l)
      setOutcome('Viewing requested'); notifyRole('crm', 'Viewing requested by phone', `${clip(a.name, 60)} – ${clip(a.property, 80)}`, `/e/leads/${l.id}`, 'info')
      return { lead_no: l.lead_no, recorded: true, note: 'A colleague will call to confirm the time.' }
    } },
  { name: 'report_maintenance_issue', risk: 'internal', description: 'Log a maintenance problem reported by a tenant or owner as a ticket. Set urgency "emergency" for flooding, fire or smoke, gas smell, exposed electrics, lift entrapment, no security/door lock, or anything unsafe.',
    parameters: obj({ description: S('what is wrong, where, since when'), location: S('building and unit number'), urgency: S('routine | urgent | emergency'), name: S('caller name'), phone: S('only if caller ID is unavailable') }, ['description', 'urgency']),
    summarize: a => `Maintenance ticket (${a.urgency}): ${clip(a.description, 80)}`,
    run: async (a, c) => {
      const urgency = ['routine', 'urgent', 'emergency'].includes(String(a.urgency)) ? String(a.urgency) : 'urgent', priority = urgency === 'emergency' ? 'Urgent' : urgency === 'urgent' ? 'High' : 'Medium'
      const phone = callerPhone(a.phone), known = phone ? findPartyByPhone(phone) : null
      const r = createRecord(getDef('tickets'), { subject: `${urgency === 'emergency' ? 'EMERGENCY – ' : ''}${clip(a.description, 90)}`, type: 'Maintenance', priority, status: 'Open', customer_id: known?.party_id ?? null, description: `Reported by phone${a.name ? ` by ${clip(a.name, 80)}` : ''}${phone ? ` (+${phone})` : ''}.\nLocation: ${clip(a.location, 120) || 'not stated'}.\n${clip(a.description, 1500)}`, due_at: urgency === 'emergency' ? nowLocal() : null }, SYSTEM_CTX)
      const t = q.get(`SELECT ticket_no FROM tickets WHERE id = ?`, r.id), call = currentCall()
      if (call) call.ticketId = r.id
      setOutcome('Maintenance logged')
      notifyRole('support', `${urgency === 'emergency' ? 'EMERGENCY ' : ''}Maintenance ticket ${t?.ticket_no ?? ''}`, clip(a.description, 160), `/e/tickets/${r.id}`, urgency === 'routine' ? 'info' : 'alert')
      if (urgency === 'emergency') await messageOwners(`🚨 Emergency maintenance call\n${clip(a.location, 80) || 'location not stated'}: ${clip(a.description, 200)}\nCaller: ${clip(a.name, 60) || 'unknown'} +${phone}\nTicket ${t?.ticket_no ?? r.id}`, 'agent', 'wa_tpl_notify')
      return { ticket_no: t?.ticket_no, priority, note: urgency === 'emergency' ? 'The duty team has been alerted now.' : 'The maintenance team will follow up.' }
    } },
  { name: 'request_callback', risk: 'internal', description: 'Ask a colleague to call the person back (use when no one is available to take the call or the topic needs a human).',
    parameters: obj({ name: S('caller name'), phone: S('only if caller ID is unavailable'), topic: S('what the call-back is about'), preferred_time: S('when it suits them, in their words') }, ['topic']),
    summarize: a => `Call-back: ${clip(a.topic, 80)}`,
    run: (a, c) => {
      const phone = callerPhone(a.phone), known = phone ? findPartyByPhone(phone) : null, lead = phone ? leadByPhone(phone) : null
      staffTask(`Call back ${clip(a.name, 60) || '+' + phone}: ${clip(a.topic, 80)}`, `Caller ${clip(a.name, 80) || 'unknown'} (+${phone})${known ? ' – existing customer' : ''}.\nTopic: ${clip(a.topic, 500)}\nBest time: ${clip(a.preferred_time, 120) || 'not stated'}.`, 'High', lead ?? undefined)
      setOutcome('Callback requested'); notifyRole('crm', 'Call-back requested', `${clip(a.name, 60)} – ${clip(a.topic, 100)}`, '/tasks', 'info')
      return { recorded: true, note: 'A colleague will call back.' }
    } },
  { name: 'transfer_call', risk: 'internal', description: 'Hand the call to a member of staff. Use when the caller asks for a person, is upset, or the question is outside what you can safely answer (legal, contracts, disputes, payments). After calling this, tell the caller you are connecting them.',
    parameters: obj({ reason: S('why the call is being transferred') }, ['reason']),
    summarize: a => `Transfer call: ${clip(a.reason, 80)}`,
    run: a => {
      const call = currentCall()
      if (!call || !String(getSetting('voice_transfer_number') || '').trim()) return { transferred: false, note: 'No staff line is available. Offer a call-back with request_callback instead.' }
      call.handoff = { reason: clip(a.reason, 200) }; setOutcome('Transferred to staff')
      return { transferred: true, note: 'The call will be connected to staff as soon as you finish this reply.' }
    } },
]
export const toolByName = (n: string) => TOOLS.find(t => t.name === n)
export const toolNow = nowLocal
