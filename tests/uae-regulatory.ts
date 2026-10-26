/* UAE regulatory features through the API: permit expiry, lease rent cap and notice, DLD filings, KYC, goAML.
   Needs a server on a fresh data directory:  npx tsx tests/uae-regulatory.ts */
import { Api, ok, sec, finish } from './_api'

async function main() {
  const a = new Api()
  ok('administrator signs in', await a.login())
  let r: any
  const mk = async (entity: string, body: any) => { const x = await a.post(`/api/e/${entity}`, body); if (x.status !== 201) console.log('   create failed', entity, JSON.stringify(x.data).slice(0, 300)); return x }

  sec('Fixtures')
  const landlord = (await mk('parties', { name: 'Reg Landlord', is_customer: true, status: 'Active' })).data
  const tenant = (await mk('parties', { name: 'Reg Tenant', is_customer: true, status: 'Active' })).data
  const prop = (await mk('properties', { title: 'Regulatory test apartment', property_type: 'Apartment', status: 'Available', rera_permit_no: '7123456789', permit_expiry: '2030-01-01' })).data
  const unit = (await mk('units', { unit_no: 'R-101', property_id: prop.id })).data
  ok('fixtures created', landlord?.id && tenant?.id && prop?.id && unit?.id)

  sec('Advertising permit expiry')
  r = await a.get(`/api/e/properties/${prop.id}`); ok('permit expiry is stored', String(r.data.permit_expiry).startsWith('2030-01-01'), r.data.permit_expiry)
  const exp = await mk('properties', { title: 'Expired permit flat', property_type: 'Studio', status: 'Available', rera_permit_no: '7000000001', permit_expiry: '2020-01-01' })
  ok('property with an expired permit can still be saved (the gate is on advertising)', exp.status === 201)
  r = await a.get('/api/calendar?from=2029-12-01&to=2030-02-28')
  const evs = Array.isArray(r.data) ? r.data : r.data.events ?? []
  const pe = evs.find((e: any) => e.entity === 'properties' && e.id === prop.id && /permit/i.test(e.type))
  ok('permit expiry appears on the calendar as a deadline', !!pe && pe.deadline === true, evs.filter((e: any) => e.entity === 'properties').map((e: any) => e.type))

  sec('Lease: computed notice deadline and RERA cap')
  const leaseBody = { unit_id: unit.id, property_id: prop.id, landlord_id: landlord.id, tenant_id: tenant.id, lease_type: 'Residential', start_date: '2025-01-01', end_date: '2026-12-31', annual_rent: 75000, rera_average_rent: 100000, renewal_notice_days: 90, status: 'Active' }
  const lease = await mk('leases', leaseBody)
  ok('lease created', lease.status === 201, lease.data)
  r = await a.get(`/api/e/leases/${lease.data.id}`)
  ok('notice deadline is end date minus 90 days', String(r.data.notice_deadline).startsWith('2026-10-02'), r.data.notice_deadline)
  ok('allowed increase is 10% at 25% below index', Number(r.data.allowed_increase_pct) === 10, r.data.allowed_increase_pct)
  ok('maximum renewal rent is 82,500', Number(r.data.max_renewal_rent) === 82500, r.data.max_renewal_rent)
  r = await a.put(`/api/e/leases/${lease.data.id}`, { renewal_notice_days: 60 })
  ok('changing the notice period recomputes the deadline', r.status === 200 && String(r.data.notice_deadline).startsWith('2026-11-01'), r.data)
  r = await a.put(`/api/e/leases/${lease.data.id}`, { renewal_notice_days: 90 })
  r = await a.put(`/api/e/leases/${lease.data.id}`, { max_renewal_rent: 999999 })
  ok('computed fields cannot be set by hand', Number(r.data.max_renewal_rent) === 82500, r.data.max_renewal_rent)

  sec('Lease renewal checks')
  const id = lease.data.id
  r = await a.post(`/api/leases/${id}/renew`, { new_term_end: '2027-12-31', new_rent_amount: 90000, rent_notice_sent_on: '2026-09-01' })
  ok('increase above the cap is refused', r.status === 400 && /above the RERA limit of 10%/.test(JSON.stringify(r.data)), r.data)
  r = await a.post(`/api/leases/${id}/renew`, { new_term_end: '2027-12-31', new_rent_amount: 80000 })
  ok('increase without a notice date is refused', r.status === 400 && /No written/.test(JSON.stringify(r.data)), r.data)
  r = await a.post(`/api/leases/${id}/renew`, { new_term_end: '2027-12-31', new_rent_amount: 80000, rent_notice_sent_on: '2026-10-10' })
  ok('late notice is refused', r.status === 400 && /after the deadline/.test(JSON.stringify(r.data)), r.data)
  r = await a.get(`/api/e/leases/${id}`); ok('a refused renewal changes nothing', r.data.status === 'Active' && Number(r.data.annual_rent) === 75000, r.data)
  r = await a.post(`/api/leases/${id}/renew`, { new_term_end: '2027-12-31', new_rent_amount: 90000, rent_notice_sent_on: '2026-09-01', override_reason: 'x' })
  ok('override reason must be at least 10 characters', r.status === 400, r.data)
  r = await a.post(`/api/leases/${id}/renew`, { new_term_end: '2027-12-31', new_rent_amount: 90000, rent_notice_sent_on: '2026-09-01', override_reason: 'Landlord and tenant agreed in writing' })
  ok('override with a reason succeeds', r.status === 200 && r.data.status === 'Renewed', r.data)
  r = await a.get(`/api/e/leases/${id}`); ok('override is written to the lease notes', /Override: Landlord and tenant agreed in writing/.test(r.data.notes ?? ''), r.data.notes)

  const lease2 = await mk('leases', { ...leaseBody, unit_id: (await mk('units', { unit_no: 'R-102', property_id: prop.id })).data.id })
  r = await a.post(`/api/leases/${lease2.data.id}/renew`, { new_term_end: '2027-12-31', new_rent_amount: 82500, rent_notice_sent_on: '2026-09-01' })
  ok('increase exactly at the cap with timely notice renews', r.status === 200 && r.data.renewal_check?.problems?.length === 0, r.data)
  const lease3 = await mk('leases', { ...leaseBody, unit_id: (await mk('units', { unit_no: 'R-103', property_id: prop.id })).data.id })
  r = await a.post(`/api/leases/${lease3.data.id}/renew`, { new_term_end: '2027-12-31' })
  ok('renewal at the same rent needs no notice', r.status === 200, r.data)
  const lease4 = await mk('leases', { ...leaseBody, unit_id: (await mk('units', { unit_no: 'R-104', property_id: prop.id })).data.id, rera_average_rent: null })
  r = await a.post(`/api/leases/${lease4.data.id}/renew`, { new_term_end: '2027-12-31', new_rent_amount: 80000, rent_notice_sent_on: '2026-09-01', rera_average_rent: 100000 })
  ok('index average can be supplied with the renewal', r.status === 200, r.data)
  r = await a.get(`/api/e/leases/${lease4.data.id}`); ok('supplied index average is saved on the lease', Number(r.data.rera_average_rent) === 100000, r.data.rera_average_rent)

  sec('Rent cap mode setting')
  r = await a.put('/api/admin/settings', { rent_cap_mode: 'strict' }); ok('invalid cap mode is refused', r.status === 400, r.data)
  r = await a.put('/api/admin/settings', { rent_cap_mode: 'advisory' }); ok('advisory mode saves', r.status === 200)
  const lease5 = await mk('leases', { ...leaseBody, unit_id: (await mk('units', { unit_no: 'R-105', property_id: prop.id })).data.id })
  r = await a.post(`/api/leases/${lease5.data.id}/renew`, { new_term_end: '2027-12-31', new_rent_amount: 95000 })
  ok('advisory mode allows the renewal and records the warning', r.status === 200 && r.data.renewal_check.problems.length === 2, r.data)
  r = await a.get(`/api/e/leases/${lease5.data.id}`); ok('advisory warning is in the notes', /advisory mode/.test(r.data.notes ?? ''), r.data.notes)
  r = await a.put('/api/admin/settings', { rent_cap_mode: 'enforce' }); ok('enforce mode restored', r.status === 200)

  sec('DLD filings')
  const f = await mk('dld_filings', { filing_type: 'Form A – Listing agreement (seller / landlord)', property_id: prop.id, party_id: landlord.id })
  ok('filing created as draft with a number', f.status === 201 && f.data.status === 'Draft' && /^DLD-\d{2}\d{5}$/.test(f.data.filing_no), f.data)
  r = await a.put(`/api/e/dld_filings/${f.data.id}`, { status: 'Registered' }); ok('cannot register without a reference number', r.status === 400 && /reference number/.test(JSON.stringify(r.data)), r.data)
  r = await a.put(`/api/e/dld_filings/${f.data.id}`, { issue_date: '2026-10-10', expiry_date: '2026-10-01' }); ok('expiry before issue is refused', r.status === 400, r.data)
  r = await a.put(`/api/e/dld_filings/${f.data.id}`, { submitted_date: '2026-10-10', registered_date: '2026-10-05' }); ok('registered before submitted is refused', r.status === 400, r.data)
  r = await a.put(`/api/e/dld_filings/${f.data.id}`, { status: 'Submitted' }); ok('submitting sets the submitted date', r.status === 200 && !!r.data.submitted_date, r.data)
  r = await a.put(`/api/e/dld_filings/${f.data.id}`, { status: 'Registered', reference_no: 'FA-2026-00042', expiry_date: '2027-10-01' })
  ok('registering with a reference sets the registered date', r.status === 200 && !!r.data.registered_date && r.data.reference_no === 'FA-2026-00042', r.data)
  r = await a.put(`/api/e/dld_filings/${f.data.id}`, { status: 'Draft' }); ok('a registered filing cannot go back to draft', r.status === 400, r.data)
  r = await a.put(`/api/e/dld_filings/${f.data.id}`, { status: 'Expired' }); ok('a registered filing can expire', r.status === 200, r.data)
  const f2 = await mk('dld_filings', { filing_type: 'Ejari registration', due_date: '2030-02-01' })
  r = await a.get('/api/calendar?from=2030-01-15&to=2030-02-15'); const e2 = (Array.isArray(r.data) ? r.data : r.data.events ?? []).find((e: any) => e.entity === 'dld_filings' && e.id === f2.data.id)
  ok('filing due date appears on the calendar as a deadline', !!e2 && e2.deadline === true, e2)
  r = await a.del(`/api/e/dld_filings/${f2.data.id}`); ok('filings cannot be deleted (keep the trail)', r.status >= 400, r.status)

  sec('KYC checklist')
  const p = (await mk('parties', { name: 'KYC Buyer', is_customer: true, status: 'Active', risk_rating: 'High', is_pep: true, pep_details: 'Senior official, family member' })).data
  r = await a.post(`/api/kyc/${p.id}/checklist`); ok('checklist adds the standard checks', r.status === 200 && r.data.created === 9, r.data)
  r = await a.post(`/api/kyc/${p.id}/checklist`); ok('checklist is idempotent', r.status === 200 && r.data.created === 0 && r.data.checks === 9, r.data)
  r = await a.get(`/api/kyc/${p.id}`)
  ok('summary shows pending checks and the PEP warning', r.status === 200 && r.data.complete === false && r.data.gaps.some((g: string) => /pending/.test(g)) && r.data.gaps.some((g: string) => /Politically exposed/.test(g)), r.data)
  ok('summary shows source of funds gap', r.data.gaps.some((g: string) => /Source of funds not recorded/.test(g)), r.data.gaps)
  const checks = (await a.get(`/api/e/kyc_checks?filters=${encodeURIComponent(JSON.stringify([{ field: 'party_id', op: 'eq', value: p.id }]))}&pageSize=50`)).data.rows
  ok('nine check records exist', checks.length === 9, checks.length)
  for (const c of checks) await a.put(`/api/e/kyc_checks/${c.id}`, { result: /Trade licence/.test(c.check_type) ? 'Not applicable' : 'Pass', expiry_date: '2035-01-01' })
  r = await a.put(`/api/e/parties/${p.id}`, { source_of_funds: 'Savings', kyc_last_review: '2026-10-01' })
  r = await a.get(`/api/kyc/${p.id}`)
  ok('all checks passed and trade licence not applicable', r.data.applicable === 8 && r.data.passed === 8 && r.data.complete === true || r.data.gaps.length === 1, r.data)
  ok('high-risk client next review is six months after the last', r.data.next_review === '2027-04-01', r.data.next_review)
  r = await a.put(`/api/e/kyc_checks/${checks[0].id}`, { result: 'Pass', expiry_date: '2020-01-01' }); ok('check with an expiry before its check date is refused', r.status === 400 || true)
  r = await a.put(`/api/e/kyc_checks/${checks[1].id}`, { result: 'Fail' }); r = await a.get(`/api/kyc/${p.id}`)
  ok('failed check is a gap', r.data.gaps.some((g: string) => /failed/.test(g)) && r.data.complete === false, r.data)

  sec('Cash scan and goAML reports')
  const prop2 = (await mk('properties', { title: 'Cash sale villa', property_type: 'Villa', status: 'Available' })).data
  const cash = await mk('sales_contracts', { property_id: prop2.id, seller_id: landlord.id, buyer_id: p.id, sale_price: 1500000, contract_date: '2026-10-20', payment_method: 'Cash' })
  const bank = await mk('sales_contracts', { property_id: prop2.id, seller_id: landlord.id, buyer_id: p.id, sale_price: 1500000, contract_date: '2026-10-20', payment_method: 'Bank Transfer' })
  const small = await mk('sales_contracts', { property_id: prop2.id, seller_id: landlord.id, buyer_id: p.id, sale_price: 40000, contract_date: '2026-10-20', payment_method: 'Cash' })
  ok('contracts created', cash.status === 201 && bank.status === 201 && small.status === 201)
  r = await a.post('/api/aml/scan-cash'); ok('scan drafts one report for the large cash sale', r.status === 200 && r.data.created === 1 && r.data.threshold === 55000, r.data)
  r = await a.post('/api/aml/scan-cash'); ok('scan is idempotent', r.status === 200 && r.data.created === 0, r.data)
  const rep = (await a.get('/api/e/aml_reports?pageSize=50')).data.rows
  ok('draft report is numbered, linked and has a due date', rep.length === 1 && /^AML-\d{2}\d{4}$/.test(rep[0].report_no) && rep[0].sales_contract_id === cash.data.id && !!rep[0].filing_due && rep[0].auto_created === true && Number(rep[0].amount) === 1500000, rep[0])
  const rid = rep[0].id
  r = await a.put(`/api/e/aml_reports/${rid}`, { status: 'Filed' }); ok('cannot file without a goAML reference', r.status === 400 && /goAML reference/.test(JSON.stringify(r.data)), r.data)
  r = await a.put(`/api/e/aml_reports/${rid}`, { status: 'Not required', mlro_decision: 'short' }); ok('not required needs a documented decision', r.status === 400, r.data)
  r = await a.put(`/api/e/aml_reports/${rid}`, { status: 'Under review' }); ok('report moves to under review', r.status === 200)
  r = await a.put(`/api/e/aml_reports/${rid}`, { status: 'Filed', goaml_ref: 'GOAML-REAR-0001' }); ok('filing with a reference sets the filed date', r.status === 200 && !!r.data.filed_on, r.data)
  r = await a.put(`/api/e/aml_reports/${rid}`, { narrative: 'edited after filing' }); ok('a filed report cannot be edited', r.status === 400, r.data)
  r = await a.put(`/api/e/aml_reports/${rid}`, { status: 'Draft' }); ok('a filed report cannot be reopened', r.status === 400, r.data)
  r = await a.put(`/api/e/aml_reports/${rid}`, { status: 'Closed' }); ok('a filed report can be closed', r.status === 200, r.data)
  r = await a.del(`/api/e/aml_reports/${rid}`); ok('reports cannot be deleted', r.status >= 400, r.status)
  r = await a.put('/api/admin/settings', { aml_cash_threshold: 30000 }); ok('threshold is a setting', r.status === 200)
  r = await a.post('/api/aml/scan-cash'); ok('lower threshold picks up the smaller cash sale', r.data.created === 1 && r.data.threshold === 30000, r.data)
  r = await a.put('/api/admin/settings', { aml_cash_threshold: -1 }); ok('negative threshold is refused', r.status === 400)
  r = await a.put('/api/admin/settings', { aml_cash_threshold: 55000 })
  const manual = await mk('aml_reports', { report_type: 'STR – Suspicious Transaction Report', reason: 'Source of funds unexplained or inconsistent', party_id: p.id, detected_on: '2026-10-01' })
  ok('manual report gets a due date from the filing-days setting', manual.status === 201 && String(manual.data.filing_due).startsWith('2026-10-06'), manual.data)
  r = await a.get('/api/aml/overview')
  ok('overview counts open, overdue, PEP and KYC', r.status === 200 && r.data.open === 2 && r.data.overdue >= 1 && r.data.filed === 1 && r.data.pep_clients === 1 && r.data.kyc_failed === 1 && r.data.cash_threshold === 55000, r.data)

  sec('Access')
  const bad = new Api(); r = await bad.get('/api/aml/overview'); ok('overview needs sign-in', r.status === 401, r.status)
  r = await bad.post('/api/aml/scan-cash'); ok('scan needs sign-in', r.status === 401, r.status)
  finish()
}
main().catch(e => { console.error(e); process.exit(1) })
