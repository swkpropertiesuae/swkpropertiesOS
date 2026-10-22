import { q } from '../db'
import { addDays, daysBetween, todayStr, fromCents, r2, nowLocal } from '../util'
import { createRecord, getDef, SYSTEM_CTX } from '../engine'
import { businessSnapshot } from '../integrations/snapshot'
import { queueEmail } from '../mailer'
import { sendWhatsApp, messageOwners, phonesForParty } from '../integrations/whatsapp'
import { notifyRole } from '../notify'
import { addJobEvent } from '../domain/jobs'

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
]
export const toolByName = (n: string) => TOOLS.find(t => t.name === n)
export const toolNow = nowLocal
