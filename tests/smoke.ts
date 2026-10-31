import { signInReady } from './login-ready'
/* End-to-end API smoke test for SWK Properties OS. Usage: BASE_URL=http://localhost:8080 npm test */
const BASE = process.env.BASE_URL ?? 'http://localhost:8080'
let cookie = ''
let pass = 0, fail = 0
const failures: string[] = []

async function api(method: string, path: string, body?: any, opts: { raw?: boolean; noAuth?: boolean } = {}): Promise<any> {
  const res = path === '/api/auth/login' ? await signInReady(BASE, body) : await fetch(BASE + path, { method, headers: { 'content-type': 'application/json', 'x-swk-client': 'web', ...(cookie && !opts.noAuth ? { cookie } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined })
  const sc = res.headers.get('set-cookie'); if (sc && path.includes('/auth/login')) cookie = sc.split(';')[0]
  if (opts.raw) return res
  const text = await res.text()
  let data: any; try { data = JSON.parse(text) } catch { data = text }
  return { status: res.status, data }
}
function ok(name: string, cond: any, extra?: any) { if (cond) { pass++; console.log('  ✓', name) } else { fail++; failures.push(name); console.log('  ✗', name, extra !== undefined ? JSON.stringify(extra).slice(0, 400) : '') } }
const sec = (t: string) => console.log('\n' + t)
const id = (r: any) => r.data?.id

async function main() {
  sec('Auth')
  let r = await api('POST', '/api/auth/login', { email: 'admin@swkpropertiesuae.com', password: 'wrong-password' }, { noAuth: true }); ok('wrong password rejected', r.status === 401)
  r = await api('GET', '/api/e/jobs', undefined, { noAuth: true }); ok('unauthenticated API call rejected', r.status === 401)
  r = await api('POST', '/api/auth/login', { email: 'manager@swkpropertiesuae.com', password: 'SWK@Manager2026' }); ok('manager can sign in', r.status === 200 && r.data.ok, r.data)
  const mgrCookie = cookie
  r = await api('POST', '/api/auth/login', { email: 'admin@swkpropertiesuae.com', password: 'SWK@Admin2026' }); ok('admin can sign in', r.status === 200 && r.data.ok, r.data)
  r = await api('GET', '/api/auth/me'); ok('me returns full permissions for admin', r.data.permissions === '*' && r.data.defaultPassword === false, r.data)
  r = await api('GET', '/api/meta'); ok('meta lists entities and navigation', r.data.entities.length > 70 && r.data.nav.length >= 8, Object.keys(r.data))
  r = await api('PUT', '/api/admin/settings', { company_trn: '100123456700003' }); ok('company TRN saved (needed to post tax invoices)', r.status === 200 && r.data.company_trn === '100123456700003', r.data)

  sec('Master data seeded')
  r = await api('GET', '/api/e/countries?pageSize=1'); ok('countries seeded', r.data.total > 200, r.data.total)
  r = await api('GET', '/api/e/communities?pageSize=1'); ok('UAE communities seeded', r.data.total >= 10, r.data.total)
  r = await api('GET', '/api/e/developers?pageSize=1'); ok('UAE developers seeded', r.data.total >= 10, r.data.total)
  r = await api('GET', '/api/e/accounts?pageSize=200'); ok('chart of accounts seeded', r.data.total > 40)
  r = await api('GET', '/api/e/charge_codes?pageSize=1'); ok('charge codes seeded', r.data.total >= 15)

  sec('CRM & Parties')
  r = await api('POST', '/api/e/parties', { name: 'Al Noor Capital LLC', is_customer: true, is_landlord: true, trn: '100123456700003', status: 'Active', credit_limit: 500000, credit_days: 30, sanctions_status: 'Clear', sanctions_screened_on: '2026-10-12' }); ok('create customer/landlord', r.status === 201 && /^P\d{5}$/.test(r.data.code), r.data)
  const cust = id(r)
  r = await api('POST', '/api/e/parties', { name: 'al noor capital llc', is_customer: true }); ok('duplicate customer name blocked', r.status === 400, r.data)
  r = await api('POST', '/api/e/parties', { name: 'Bayut & Dubizzle Group LLC', is_vendor: true, trn: '100987654300003', sanctions_status: 'Clear', sanctions_screened_on: '2026-10-12' }); const vendor = id(r); ok('create vendor', r.status === 201)
  r = await api('POST', '/api/e/parties', { name: 'Bad TRN Co', is_customer: true, trn: '123' }); ok('invalid TRN rejected', r.status === 400)
  r = await api('POST', '/api/e/leads', { company: 'Marina Buyer Enquiry', contact_name: 'S. Khan', email: 'sk@atlas.example', status: 'New', source: 'Property Finder', est_value: 2500000 }); const lead = id(r); ok('create lead', r.status === 201 && r.data.lead_no)
  r = await api('POST', `/api/leads/${lead}/convert`); ok('convert lead to customer + opportunity', r.status === 200 && r.data.party?.id && r.data.opportunity?.id, r.data)

  sec('Properties, Units, Mandates & Leases')
  const branch = (await api('GET', '/api/e/branches')).data.rows[0]
  r = await api('POST', '/api/e/agents', { name: 'Tariq Al Mansoori', email: 'tariq@swkpropertiesuae.com', mobile: '+971501234567', dld_broker_id: 'BRN-59201', dld_expiry: '2027-08-16', status: 'Active', commission_split_pct: 55 }); const agentId = id(r); ok('create RERA broker agent', r.status === 201, r.data)
  r = await api('POST', '/api/e/properties', { title: 'Marina Gate Tower 1 · 2BR Residence', property_type: 'Apartment', status: 'Available', community_id: 'Dubai Marina', developer_id: 'Select Group', bedrooms: 2, bathrooms: 3, area_sqft: 1380, price: 3200000, rent_annual: 210000, rera_permit_no: '7129485012', agent_id: agentId, branch_id: branch.id }); const propId = id(r); ok('create property listing', r.status === 201 && /^PRP-/.test(r.data.property_no), r.data)
  r = await api('POST', '/api/e/units', { unit_no: 'MG1-2404', property_id: propId, unit_type: 'Residential', status: 'Available', bedrooms: 2, bathrooms: 3, area_sqft: 1380, sale_price: 3200000, rent_annual: 210000, service_charge_annual: 24840, owner_id: cust, agent_id: agentId }); const unitId = id(r); ok('create unit', r.status === 201, r.data)
  r = await api('POST', '/api/e/mandates', { property_id: propId, unit_id: unitId, mandate_type: 'Exclusive Sale', status: 'Active', owner_id: cust, agent_id: agentId, asking_price: 3200000, start_date: '2026-10-01', end_date: '2027-03-31' }); const mandateId = id(r); ok('create Form A mandate', r.status === 201 && /^MND-/.test(r.data.mandate_no), r.data)
  r = await api('POST', '/api/e/leases', { unit_id: unitId, property_id: propId, landlord_id: cust, tenant_id: cust, agent_id: agentId, lease_type: 'Residential', status: 'Draft', start_date: '2026-11-01', end_date: '2027-10-31', annual_rent: 210000, cheque_count: 2 }); const leaseId = id(r); ok('create lease', r.status === 201 && /^LSE-/.test(r.data.lease_no), r.data)
  r = await api('POST', `/api/leases/${leaseId}/register-ejari`, { ejari_no: 'EJ-2026-991024' }); ok('register Ejari on lease', r.status === 200 && r.data.status === 'Ejari Registered', r.data)

  sec('Master Deal File (Jobs) & Invoicing -> Ledger')
  const commCode = (await api('GET', '/api/e/charge_codes?q=COMM')).data.rows[0] ?? (await api('GET', '/api/e/charge_codes')).data.rows[0]
  const mktCode = (await api('GET', '/api/e/charge_codes?q=MKT')).data.rows[0] ?? commCode
  r = await api('POST', '/api/e/jobs', {
    deal_name: 'Marina Gate 2404 Sale', deal_type: 'Sale', client_id: cust, property_id: propId, unit_id: unitId, mandate_id: mandateId, agent_id: agentId, branch_id: branch.id, department: 'SALES',
    deal_date: '2026-10-12', target_close: '2026-11-15', deal_value: 3200000, commission_pct: 2,
    children: {
      charges: [
        { kind: 'Revenue', charge_code_id: commCode.id, description: '2% Buyer Brokerage Commission', qty: 1, rate: 64000, vat_pct: 5, currency: 'AED', party_id: cust },
        { kind: 'Cost', charge_code_id: mktCode.id, description: 'Featured Portal Promotion', qty: 1, rate: 4000, vat_pct: 0, currency: 'AED', party_id: vendor },
      ],
    },
  })
  ok('create deal file', r.status === 201, r.data)
  const job = r.data
  ok('deal number format DL-YYNNNNN', /^DL-\d{7}$/.test(job.job_no), job.job_no)
  ok('deal totals computed (rev 64000, cost 4000, profit 60000)', job.total_revenue === 64000 && job.total_cost === 4000 && job.profit === 60000, [job.total_revenue, job.total_cost, job.profit])
  r = await api('PUT', `/api/e/jobs/${job.id}`, { version: 99, notes: 'x' }); ok('optimistic locking rejects stale version', r.status === 409)
  r = await api('POST', `/api/jobs/${job.id}/events`, { event_type: 'Offer Accepted', description: 'Form F MOU signed by both parties' }); ok('add deal milestone', r.status === 200)
  r = await api('GET', `/api/jobs/${job.id}/events`); ok('events recorded', r.data.length >= 2, r.data.length)
  r = await api('GET', `/api/jobs/${job.id}/kpi`); ok('deal KPI computed', r.data.revenue === 64000 && r.data.profit === 60000, r.data)
  r = await api('POST', `/api/jobs/${job.id}/tracking-token`); const token = r.data.token; ok('public tracking token', token?.length === 32)
  r = await api('GET', `/api/public/deal/${token}`, undefined, { noAuth: true }); ok('public deal tracking works without login and hides finance', r.status === 200 && r.data.job_no === job.job_no && !('total_revenue' in r.data), r.data)
  r = await api('GET', `/api/public/deal/${'0'.repeat(32)}`, undefined, { noAuth: true }); ok('unknown tracking token 404', r.status === 404)

  sec('Search (Deal No / Global)')
  r = await api('GET', `/api/search/jobs?type=job_no&op=contains&value=${job.job_no.slice(-4)}`); ok('search by deal no returns row', r.data.rows.length === 1 && r.data.rows[0].deal_name === 'Marina Gate 2404 Sale', r.data)
  r = await api('GET', `/api/search/global?q=Al Noor`); ok('global search finds customer', r.data.some((x: any) => x.entity === 'parties'), r.data)

  sec('Invoicing → posting → ledger')
  r = await api('POST', `/api/jobs/${job.id}/generate-invoices`, {}); ok('generate invoice from unbilled revenue', r.status === 200 && r.data.length === 1, r.data)
  const inv = r.data[0]
  ok('invoice totals: 64,000 + 5% VAT (3,200) = 67,200', inv.subtotal === 64000 && inv.vat_total === 3200 && inv.total === 67200, [inv.subtotal, inv.vat_total, inv.total])
  ok('draft invoice number is a draft placeholder', inv.invoice_no.startsWith('DRAFT-'))
  r = await api('POST', `/api/finance/invoices/${inv.id}/post`); ok('post invoice', r.status === 200 && /^INV26\d{5}$/.test(r.data.invoice_no) && r.data.status === 'Posted', r.data)
  ok('posted invoice has journal and balance', !!r.data.journal_id && r.data.balance === 67200)
  r = await api('PUT', `/api/e/invoices/${inv.id}`, { party_id: vendor, version: r.data.version }); ok('posted invoice is locked', r.status === 400, r.data)
  r = await api('POST', `/api/finance/invoices/${inv.id}/post`); ok('cannot post twice', r.status === 400)
  r = await api('GET', `/api/e/jobs/${job.id}`); ok('deal charges flagged Invoiced', r.data.children.charges.filter((c: any) => c.kind === 'Revenue').every((c: any) => c.status === 'Invoiced'))
  r = await api('POST', `/api/jobs/${job.id}/generate-invoices`, {}); ok('no double invoicing of charges', r.status === 400, r.data)
  const bank = (await api('GET', '/api/e/bank_accounts')).data.rows.find((b: any) => b.type === 'Bank')
  r = await api('POST', '/api/e/receipts', { party_id: cust, bank_account_id: bank.id, amount: 67200, receipt_date: '2026-10-20', reference: 'MGR-CHQ-1', children: { allocations: [{ invoice_id: inv.id, amount: 67200 }] } }); ok('create receipt with allocation', r.status === 201, r.data)
  const rec = id(r)
  r = await api('POST', `/api/finance/receipts/${rec}/post`); ok('post receipt', r.status === 200 && r.data.status === 'Posted', r.data)
  r = await api('GET', `/api/e/invoices/${inv.id}`); ok('invoice settled → Paid, balance 0', r.data.status === 'Paid' && r.data.balance === 0 && r.data.paid_amount === 67200, [r.data.status, r.data.balance])
  r = await api('POST', `/api/finance/invoices/${inv.id}/void`, { reason: 'test' }); ok('cannot void a paid invoice', r.status === 400)
  r = await api('POST', `/api/jobs/${job.id}/bill-from-costs`, { vendor_id: vendor, vendor_invoice_no: 'BD-7781' }); ok('create vendor bill from deal costs', r.status === 200 && r.data.total === 4000, [r.data.total, r.data.vat_total])
  const bill = r.data.id
  r = await api('POST', `/api/finance/bills/${bill}/post`); ok('post vendor bill', r.status === 200 && r.data.status === 'Posted', r.data)
  r = await api('GET', '/api/reports/trial_balance?as_of=2026-12-31'); ok('trial balance balances', r.status === 200 && r.data.totals.debit === r.data.totals.credit && r.data.totals.debit > 0, r.data.totals)
  r = await api('GET', '/api/reports/profit_loss?from=2026-01-01&to=2026-12-31'); const pl = r.data.rows.find((x: any) => x.name === 'Net profit / (loss)'); ok('P&L: revenue 64,000 − cost 4,000 = 60,000', pl?.amount === 60000, pl)
  r = await api('GET', '/api/reports/balance_sheet?as_of=2026-12-31'); const chk = r.data.rows.find((x: any) => x.kind === 'check'); ok('balance sheet balances', chk?.amount === 0, chk)
  r = await api('GET', '/api/reports/ar_aging?as_of=2026-10-30'); ok('AR ageing empty after payment', r.data.totals.total === 0, r.data.totals)

  sec('Collaboration Panel, Tasks, Tickets & Video')
  r = await api('POST', `/api/panel/jobs/${job.id}/comments`, { body: 'NOC booked at developer office' }); ok('add comment', r.status === 200)
  r = await api('POST', `/api/panel/jobs/${job.id}/tags`, { tag: 'vip-transfer' }); ok('add tag', r.status === 200)
  r = await api('POST', `/api/panel/jobs/${job.id}/refs`, { ref_type: 'Form F Ref', ref_value: 'MOU-8891' }); ok('add reference', r.status === 200)
  r = await api('POST', `/api/panel/jobs/${job.id}/like`); ok('like record', r.data.liked === true)
  r = await api('POST', `/api/panel/jobs/${job.id}/video`); ok('start video call link', /^https:\/\/meet\.jit\.si\/SWK OS-jobs-/.test(r.data.url), r.data)
  r = await api('POST', '/api/e/tasks', { title: 'Collect DLD Trustee Manager Cheque', due_date: '2026-11-10', link_entity: 'jobs', link_id: job.id }); ok('follow-up task linked to deal', r.status === 201 && String(r.data.link_label ?? '').startsWith(job.job_no), r.data)
  r = await api('POST', '/api/e/tickets', { subject: 'Snagging key handover query', customer_id: cust, link_entity: 'jobs', link_id: job.id, priority: 'High' }); ok('ticket linked to deal with SLA', r.status === 201 && !!r.data.due_at, r.data)
  r = await api('GET', `/api/panel/jobs/${job.id}`); const p = r.data
  ok('side panel counts', p.comments === 2 && p.followups === 1 && p.tags === 1 && p.references === 1 && p.likes === 1 && p.complaints === 1 && p.videocalls === 1 && p.history >= 2, p)

  sec('Dashboard, Reports, Calendar, KPI & Security')
  r = await api('GET', '/api/dashboard'); ok('dashboard payload', r.status === 200 && r.data.kpis && r.data.charts?.pipeline_funnel?.length === 8, Object.keys(r.data))
  r = await api('GET', '/api/reports'); ok('report catalogue', r.data.length >= 20, r.data.length)
  r = await api('GET', '/api/reports/job_register?format=csv', undefined, { raw: true }); ok('report CSV export', ((r as Response).headers.get('content-type') ?? '').includes('text/csv'))
  r = await api('GET', '/api/kpi'); ok('KPI board', r.data.kpis.length >= 10)
  r = await api('GET', `/api/e/jobs/export.csv`, undefined, { raw: true }); const csv = await (r as Response).text(); ok('CSV export of deals', csv.includes(job.job_no))
  r = await fetch(BASE + '/api/e/jobs', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: '{}' }); ok('CSRF header required for cookie mutations', r.status === 403)
  r = await api('POST', '/api/admin/backups'); ok('database backup created', r.status === 200 && /\.(db|json\.gz)$/.test(r.data.name ?? ''), r.data)

  void mgrCookie
  console.log(`\n${pass} passed, ${fail} failed`)
  if (fail) { console.log('Failures:\n - ' + failures.join('\n - ')); process.exit(1) }
}
main().catch(e => { console.error(e); process.exit(1) })
