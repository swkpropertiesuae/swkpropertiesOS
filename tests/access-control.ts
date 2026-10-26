/* Access control for company-wide endpoints: a customer-portal user and a role without CRM/finance access must not read other people's data.
   Needs a server on a fresh data directory with STARTER_DATA=false:  npx tsx tests/access-control.ts */
import { Api, BASE, ok, sec, finish } from './_api'

async function main() {
  const a = new Api()
  ok('administrator signs in', await a.login())
  await a.put('/api/admin/settings', { company_trn: '100123456700003' })
  const dxb = (await a.get('/api/e/branches')).data.rows[0].id
  const roles = (await a.get('/api/e/roles?pageSize=50')).data.rows
  const roleId = (n: string) => roles.find((r: any) => r.name === n).id
  const mine = (await a.post('/api/e/parties', { name: 'Portal Customer A', is_customer: true, status: 'Active' })).data.id
  const other = (await a.post('/api/e/parties', { name: 'Rival Customer B', is_customer: true, status: 'Active' })).data.id
  const zr = (await a.get('/api/e/vat_codes?pageSize=20')).data.rows.find((v: any) => v.code === 'ZR').id
  const job = (await a.post('/api/e/jobs', { deal_name: 'Rival deal', deal_type: 'Sale', client_id: other, branch_id: dxb, deal_date: '2026-10-01' })).data.id
  const inv = (await a.post('/api/e/invoices', { doc_type: 'Tax Invoice', party_id: other, job_id: job, invoice_date: '2026-10-01', children: { lines: [{ description: 'Brokerage commission', qty: 1, rate: 5000, vat_code_id: zr }] } })).data.id
  await a.post(`/api/finance/invoices/${inv}/post`)
  const myInv = (await a.post('/api/e/invoices', { doc_type: 'Tax Invoice', party_id: mine, invoice_date: '2026-10-01', children: { lines: [{ description: 'Own commission', qty: 1, rate: 100, vat_code_id: zr }] } })).data.id
  await a.post(`/api/finance/invoices/${myInv}/post`)
  await a.post('/api/e/users', { name: 'Portal A', email: 'portal@a.example', password: 'Portal-Pass-2026!', role_id: roleId('Customer Portal'), branch_id: dxb, party_id: mine, active: true, must_change_password: false })
  await a.post('/api/e/users', { name: 'Property manager', email: 'pm@a.example', password: 'Manager-Pass-2026!', role_id: roleId('Property Mgmt'), branch_id: dxb, active: true, must_change_password: false })
  const p = new Api(), w = new Api()
  ok('portal user signs in', await p.login('portal@a.example', 'Portal-Pass-2026!'))
  ok('property manager signs in', await w.login('pm@a.example', 'Manager-Pass-2026!'))

  sec('Customer portal: own records only')
  let r = await p.get('/api/e/invoices?pageSize=20'); ok('portal lists only its own invoices', r.status === 200 && r.data.total === 1 && r.data.rows[0].party_id === mine, r.data)
  r = await p.get(`/api/e/invoices/${inv}`); ok('another customer’s invoice is not found', r.status === 404)
  r = await p.get(`/api/finance/statement/${mine}`); ok('own statement is readable', r.status === 200 && r.data.closing === 100, r.data)
  r = await p.get(`/api/finance/statement/${other}`); ok('another customer’s statement is refused', r.status === 403)
  r = await p.get(`/api/finance/open-invoices?party_id=${other}`); ok('open invoices of another customer are closed to portal users', r.status === 403, r.data)
  r = await p.get(`/api/finance/open-invoices?party_id=${mine}`); ok('open invoices endpoint is staff-only even for the own company', r.status === 403)
  r = await p.get('/api/finance/open-bills?vendor_id=1'); ok('open vendor bills are closed to portal users', r.status === 403)
  r = await p.get('/api/finance/bank/summary'); ok('company bank balances are closed to portal users', r.status === 403, r.data)
  r = await p.get('/api/finance/year-end/2026'); ok('company year-end figures are closed to portal users', r.status === 403)
  r = await p.get('/api/e/users/lookup?q='); ok('internal staff list is closed to portal users', r.status === 403, r.data)
  r = await p.get('/api/studio/fill-data'); ok('Document Studio helpers are closed to portal users', r.status === 403)
  r = await p.post('/api/studio/documents', {}); ok('portal users cannot create Studio documents', r.status === 403)
  r = await p.get('/api/e/doc_templates?pageSize=2'); ok('portal users cannot browse the template library', r.status === 403 || r.data.total === 0, r.data.total)
  r = await p.get('/api/e/parties/lookup?q=Rival'); ok('portal users cannot look up customers', r.status === 403)
  r = await p.get(`/api/e/jobs/${job}`); ok('another customer’s deal file is not found', r.status === 404, r.data)
  r = await p.get('/api/admin/system'); ok('administration is closed', r.status === 403)
  r = await p.get('/api/dashboard'); ok('portal dashboard still works', r.status === 200 && r.data.portal === true)
  r = await p.get('/api/calendar'); ok('portal calendar still works', r.status === 200)

  sec('Staff without CRM or finance access')
  r = await w.get('/api/e/parties?pageSize=5'); ok('the record API refuses CRM to a property-management role', r.status === 403)
  r = await w.get('/api/e/parties/lookup?q=Rival'); ok('a property-management role can pick a party name for its own forms (reference picker only, no detail)', r.status === 200)
  r = await w.get(`/api/e/parties/${other}`); ok('but cannot read the party record itself', r.status === 403)
  r = await w.get('/api/e/bank_accounts/lookup?q='); ok('bank account names are not listed to a property-management role', r.status === 403, r.data)
  r = await w.get('/api/e/employees/lookup?q='); ok('employee names are not listed to a property-management role', r.status === 403 || (r.status === 200 && r.data.length === 0), r.data)
  r = await w.get('/api/e/branches/lookup?q='); ok('branches stay closed to a role whose forms do not refer to them', r.status === 403, r.data)
  r = await w.get('/api/e/properties/lookup?q='); ok('properties (referenced by the role’s lease forms) can be picked', r.status === 200, r.data)
  r = await w.get('/api/e/users/lookup?q='); ok('assignee pickers still list colleagues', r.status === 200 && r.data.length >= 2, r.data)
  r = await w.get('/api/e/leases/lookup?q='); ok('leases (own module) can be picked', r.status === 200)
  r = await w.get('/api/finance/bank/summary'); ok('bank balances are closed to a property-management role', r.status === 403)

  sec('Limited administrators cannot escalate')
  const limitedRole = (await a.post('/api/e/roles', { name: 'Limited admin', permissions: { dashboard: ['view'], admin: ['view', 'edit', 'create'] } })).data
  await a.post('/api/e/users', { name: 'Limited Admin', email: 'limited@a.example', password: 'Limited-Pass-2026!', role_id: limitedRole.id, branch_id: dxb, active: true, must_change_password: false })
  const l = new Api()
  ok('limited administrator signs in', await l.login('limited@a.example', 'Limited-Pass-2026!'))
  const fullAdminId = (await a.get('/api/e/users?pageSize=50')).data.rows.find((u: any) => u.email === 'admin@swkpropertiesuae.com').id
  r = await l.post('/api/e/users', { name: 'Sneaky', email: 'sneaky@a.example', password: 'Sneaky-Pass-2026!', role_id: roleId('Admin'), branch_id: dxb, active: true, must_change_password: false }); ok('cannot create a user with a full-access role', r.status === 400, r.data)
  r = await l.put(`/api/e/users/${fullAdminId}`, { password: 'Hijacked-Pass-2026!' }); ok('cannot change the password of a full administrator', r.status === 400, r.data)
  r = await l.post(`/api/admin/users/${fullAdminId}/reset-2fa`); ok('cannot reset 2-step verification of a full administrator', r.status === 400, r.data)
  r = await l.post(`/api/admin/users/${fullAdminId}/sign-out`); ok('cannot sign out a full administrator', r.status === 400, r.data)
  r = await l.post('/api/e/roles', { name: 'Too much', permissions: { finance: ['view'] } }); ok('cannot create a role with rights the creator lacks', r.status === 400, r.data)
  r = await l.post('/api/e/roles', { name: 'Within reach', permissions: { admin: ['view'] } }); ok('can create a role within own rights', r.status === 201, r.data)
  r = await l.get('/api/health/db'); ok('database health is visible to administrators', r.status === 200 && 'avg_query_ms' in r.data, r.data)
  r = await w.get('/api/health/db'); ok('database health is closed to other staff', r.status === 403)
  r = await fetch(BASE + '/api/health/db'); ok('database health is closed to anonymous callers', r.status === 401)

  sec('Tracking links and sessions')
  const t1 = (await a.post(`/api/jobs/${job}/tracking-token`)).data, t2 = (await a.post(`/api/jobs/${job}/tracking-token`)).data
  ok('opening the share dialog again keeps the same link', t1.token && t1.token === t2.token, [t1, t2])
  const t3 = (await a.post(`/api/jobs/${job}/tracking-token`, { rotate: true })).data
  ok('a link is replaced only when rotation is requested', t3.token && t3.token !== t1.token)
  r = await fetch(`${BASE}/api/public/track/${t1.token}`); ok('the replaced link stops working', r.status === 404)
  const login = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json', 'x-swk-client': 'android' }, body: JSON.stringify({ email: 'pm@a.example', password: 'Manager-Pass-2026!' }) })
  const lj: any = await login.json(); const hdr = { 'x-swk-session': lj.sessionToken, 'x-swk-client': 'android', 'content-type': 'application/json' }
  r = { status: (await fetch(BASE + '/api/auth/me', { headers: hdr })).status, data: null }; ok('app session token works', r.status === 200)
  await fetch(BASE + '/api/auth/logout', { method: 'POST', headers: hdr, body: '{}' })
  r = { status: (await fetch(BASE + '/api/auth/me', { headers: hdr })).status, data: null }; ok('signing out from the app ends the session on the server', r.status === 401)
  finish()
}
main().catch(e => { console.error(e); process.exit(1) })
