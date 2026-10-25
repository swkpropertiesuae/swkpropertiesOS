export {}
/* Client-handover checks: production workspace is empty (zero mock data).
   Run on a fresh data directory:  npx tsx tests/handover.ts */
const BASE = process.env.BASE_URL ?? 'http://localhost:8080'
let pass = 0, fail = 0
const failures: string[] = []
const ok = (n: string, c: any, x?: any) => { if (c) { pass++; console.log('  ✓', n) } else { fail++; failures.push(n); console.log('  ✗', n, x !== undefined ? JSON.stringify(x).slice(0, 300) : '') } }
class Client {
  cookie = ''
  async api(method: string, path: string, body?: any) {
    const res = await fetch(BASE + path, { method, headers: { 'content-type': 'application/json', 'x-swk-client': 'web', ...(this.cookie ? { cookie: this.cookie } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined })
    const sc = res.headers.get('set-cookie'); if (sc && path.includes('/auth/login')) this.cookie = sc.split(';')[0]
    const t = await res.text(); let data: any; try { data = JSON.parse(t) } catch { data = t }
    return { status: res.status, data }
  }
}
const sec = (t: string) => console.log('\n' + t)
const BUSINESS = [
  'parties', 'contacts', 'leads', 'opportunities', 'activities', 'campaigns',
  'properties', 'units', 'mandates', 'viewings', 'offers', 'sales_contracts',
  'escrow_accounts', 'escrow_transactions', 'leases', 'rent_schedules', 'rent_receipts',
  'service_charges', 'maintenance', 'inspections', 'handovers', 'snagging_items',
  'property_visits', 'agent_commissions', 'owner_statements',
  'quotations', 'contracts', 'jobs', 'invoices', 'bills', 'receipts',
  'payments', 'journal_entries', 'bank_transactions', 'expenses', 'payslips',
  'leave_requests', 'attendance', 'tickets', 'claims', 'tasks', 'projects',
  'fixed_assets', 'announcements', 'attachments',
  'whatsapp_messages', 'automation_rules', 'webhooks', 'year_end_closes',
  'wps_batches', 'ai_runs', 'ai_actions',
]

async function main() {
  const admin = new Client(), mgr = new Client()
  sec('Production workspace: admin and manager, zero mock/sample data')
  let r = await admin.api('POST', '/api/auth/login', { email: 'admin@swkpropertiesuae.com', password: 'SWK@Admin2026' }); ok('admin signs in', r.data.ok && !r.data.demo, r.data)
  ok('admin must change the default password at first login', r.data.mustChangePassword === true)
  r = await mgr.api('POST', '/api/auth/login', { email: 'manager@swkpropertiesuae.com', password: 'SWK@Manager2026' }); ok('manager signs in', r.data.ok && !r.data.demo); ok('manager must change password', r.data.mustChangePassword === true)
  r = await admin.api('GET', '/api/auth/me'); ok('admin has full access and is not flagged as demo', r.data.permissions === '*' && r.data.demo === false)
  r = await mgr.api('GET', '/api/auth/me'); ok('manager has full access', r.data.permissions === '*')
  r = await admin.api('GET', '/api/admin/system'); ok('temporary password blocks business APIs', r.status === 403)
  r = await admin.api('POST', '/api/auth/change-password', { current: 'SWK@Admin2026', next: 'Admin-Personal2026!' }); ok('admin changes temporary password', r.status === 200)
  r = await mgr.api('POST', '/api/auth/change-password', { current: 'SWK@Manager2026', next: 'Manager-Personal2026!' }); ok('manager changes temporary password', r.status === 200)

  const counts: Record<string, number> = {}
  for (const e of BUSINESS) { const x = await admin.api('GET', `/api/e/${e}?pageSize=1`); counts[e] = x.data.total ?? -1 }
  const dirty = Object.entries(counts).filter(([, n]) => n !== 0)
  ok('all business tables are empty in production (zero mock data)', dirty.length === 0, dirty)

  r = await admin.api('GET', '/api/e/users'); ok('only the two production users exist (no demo users)', r.data.total === 2 && !r.data.rows.some((u: any) => /demo/i.test(u.email)), r.data.rows?.map((u: any) => u.email))
  r = await admin.api('GET', '/api/e/accounts?pageSize=1'); ok('reference data (chart of accounts) is installed', r.data.total > 40)
  r = await admin.api('GET', '/api/e/communities?pageSize=1'); ok('UAE communities reference data is installed', r.data.total >= 10)
  r = await admin.api('GET', '/api/e/developers?pageSize=1'); ok('UAE developers reference data is installed', r.data.total >= 10)
  r = await admin.api('GET', '/api/e/legal_entities'); ok('a single default SWK legal entity exists', r.data.total === 1 && r.data.rows[0].code === 'SWK', r.data.rows)
  r = await admin.api('GET', '/api/admin/system'); ok('no demo loader in production', r.data.demo_possible === undefined)
  r = await admin.api('POST', '/api/admin/demo-data'); ok('sample-data endpoint is gone', r.status === 404)
  r = await admin.api('GET', '/api/ai/status'); ok('AI employees exist but are all switched off by default', r.data.agents.length >= 5 && r.data.agents.every((a: any) => !a.active), r.data.agents?.map((a: any) => a.active))

  sec('Clean production CRUD verification')
  r = await admin.api('POST', '/api/e/parties', { name: 'Real Production Client', is_customer: true }); ok('production create works', r.status === 201, r.data)
  const realId = r.data.id
  await admin.api('DELETE', `/api/e/parties/${realId}`)
  r = await admin.api('GET', '/api/e/parties'); ok('production party deleted cleanly', r.data.total === 0)

  console.log(`\n${pass} passed, ${fail} failed`)
  if (fail) console.log('Failures:\n - ' + failures.join('\n - '))
  process.exit(fail ? 1 : 0)
}
main().catch(e => { console.error(e); process.exit(1) })
