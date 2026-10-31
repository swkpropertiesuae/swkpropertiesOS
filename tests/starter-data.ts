/* Clean production start and the business-data reset.
   Production starts with no sample records; the reset clears business data only and keeps a backup.
   Needs a server on a fresh data directory with default settings (STARTER_DATA on, demo off):  npx tsx tests/starter-data.ts */
import { Api, ok, sec, finish } from './_api'

async function main() {
  const a = new Api()
  sec('Sign in')
  ok('administrator signs in', await a.login())
  let r = await a.get('/api/demo/status'); ok('demo workspace is off by default', r.status === 200 && r.data.enabled === false, r.data)

  sec('A new production workspace starts clean')
  for (const e of ['parties', 'contacts', 'leads', 'jobs', 'invoices', 'bills', 'receipts', 'journal_entries', 'quotations', 'opportunities', 'activities', 'tasks']) {
    r = await a.get(`/api/e/${e}?pageSize=1`); ok(`${e} starts empty`, r.status === 200 && r.data.total === 0, r.data.total)
  }
  r = await a.get('/api/e/users'); ok('production leadership users exist', r.data.total >= 2, r.data.rows?.map((u: any) => u.email))
  r = await a.get('/api/e/accounts?pageSize=1'); ok('chart of accounts is installed', r.data.total > 40, r.data.total)
  r = await a.get('/api/e/doc_templates?pageSize=1'); ok('document templates are installed', r.data.total > 40, r.data.total)
  r = await a.get('/api/e/branches'); ok('head office branch exists', r.data.rows.some((b: any) => b.code === 'DXB'), r.data.rows)
  r = await a.get('/api/admin/settings'); ok('company profile is filled in', !!r.data.company_email && !!r.data.company_address && !r.data.company_phone, r.data)
  r = await a.post('/api/admin/business-data/load-starter'); ok('no starter data is shipped: loading is refused', r.status === 400 && /not loaded|already/i.test(r.data.error), r.data)

  sec('Create business records')
  const dxb = (await a.get('/api/e/branches')).data.rows[0].id
  const zr = (await a.get('/api/e/vat_codes?pageSize=20')).data.rows.find((v: any) => v.code === 'ZR').id
  r = await a.put('/api/admin/settings', { company_trn: '100123456700003' }); ok('company TRN saved so tax invoices can post', r.status === 200)
  const party = await a.post('/api/e/parties', { name: 'Starter test client', is_customer: true, status: 'Active' }); ok('client created', party.status === 201, party.data)
  const deal = await a.post('/api/e/jobs', { deal_name: 'Starter test deal', deal_type: 'Sale', client_id: party.data.id, branch_id: dxb, deal_date: '2026-10-01' }); ok('deal file created', deal.status === 201, deal.data)
  const inv = await a.post('/api/e/invoices', { doc_type: 'Tax Invoice', party_id: party.data.id, invoice_date: '2026-10-01', children: { lines: [{ description: 'Brokerage commission', qty: 1, rate: 1000, vat_code_id: zr }] } })
  ok('invoice created', inv.status === 201, inv.data)
  r = await a.post(`/api/finance/invoices/${inv.data.id}/post`); ok('invoice posts', r.status === 200, r.data)

  sec('Clearing business data')
  r = await a.get('/api/admin/business-data'); ok('summary lists what would be removed', r.status === 200 && r.data.total > 0 && r.data.rows.some((x: any) => x.table === 'invoices' && x.count === 1), r.data)
  r = await a.post('/api/admin/business-data/reset', { confirm: 'delete everything' }); ok('wrong confirmation phrase is refused', r.status === 400, r.data)
  r = await a.post('/api/admin/business-data/reset', { confirm: 'DELETE ALL BUSINESS DATA', load_starter: false }); ok('reset succeeds and reports a backup', r.status === 200 && r.data.total > 0 && /^swk-before-reset-/.test(r.data.backup), r.data)
  const bk = await a.get('/api/admin/backups'); ok('the pre-reset backup is listed', bk.data.some((b: any) => b.name === r.data.backup && b.bytes > 10000), bk.data)
  for (const e of ['parties', 'contacts', 'jobs', 'invoices', 'journal_entries', 'attachments']) { const c = await a.get(`/api/e/${e}?pageSize=1`); ok(`${e} is empty after the reset`, c.data.total === 0, c.data.total) }
  r = await a.get('/api/e/accounts?pageSize=1'); ok('chart of accounts is untouched', r.data.total > 40)
  r = await a.get('/api/e/users'); ok('users are untouched', r.data.total >= 2)
  r = await a.get('/api/e/doc_templates?pageSize=1'); ok('document templates are untouched', r.data.total > 40)
  r = await a.get('/api/admin/settings'); ok('company settings are untouched', r.data.company_trn === '100123456700003')
  r = await a.get('/api/admin/audit?action=business-reset'); ok('the reset is in the audit log', r.data.total >= 1, r.data)
  r = await a.post('/api/admin/business-data/reset', { confirm: 'DELETE ALL BUSINESS DATA', load_starter: true }); ok('reset with load_starter still succeeds and loads nothing', r.status === 200 && r.data.starter?.loaded === false, r.data)
  finish()
}
main().catch(e => { console.error(e); process.exit(1) })
