const V = ["view"], VE = ["view", "export"], CRUD = ["view", "create", "edit", "delete", "export"], CE = ["view", "create", "edit", "export"]
import { q } from '../db'
import { createRecord, getDef, type Ctx } from '../engine'
import { loadUser } from '../auth'
import { config } from '../config'
import { addDays, todayStr } from '../util'
import { postInvoice, postReceipt } from '../domain/finance'

const idBy = (table: string, col: string, v: string) => q.val<number>(`SELECT id FROM ${table} WHERE ${col} = ? AND deleted_at IS NULL`, v)!
const mk = (ctx: Ctx, e: string, p: any) => createRecord(getDef(e), p, ctx)

const STAFF: [string, string, string, string][] = [
  ['Ahmed Al Mansoori', 'ahmed@demo.swkproperties.ae', 'Sales', 'SAL'],
  ['Fatima Al Hashimi', 'fatima@demo.swkproperties.ae', 'Leasing', 'LEA'],
  ['Omar Khalid', 'omar@demo.swkproperties.ae', 'Property Mgmt', 'PM'],
  ['Sarah Williams', 'sarah@demo.swkproperties.ae', 'Accounts', 'ACC'],
  ['Mohammed Al Qubaisi', 'mohammed@demo.swkproperties.ae', 'HR', 'HR'],
]

export function seedDemoScenarios(): void {
  const sys: Ctx = { user: null, system: true }
  
  // Ensure roles exist (fallback in case seedReference hasn't run or failed)
  const V = ["view"], VE = ["view", "export"], CRUD = ["view", "create", "edit", "delete", "export"], CE = ["view", "create", "edit", "export"]
  const defaultRoles = [
    { name: 'Admin', description: 'Full system access, including administration', system: true, permissions: '*' },
    { name: 'Manager', description: 'Full access to every module', system: true, permissions: '*' },
    { name: 'Sales', description: 'CRM, quotations and customer follow-up', permissions: { dashboard: V, crm: CRUD, sales: [...CRUD, 'export'], documents: CE, support: CE, projects: CRUD, reports: VE, masters: V } },
    { name: 'Leasing', description: 'Leasing and tenant management', permissions: { dashboard: V, crm: V, sales: V, leases: CRUD, documents: CE, projects: CE, masters: V } },
    { name: 'Operations', description: 'Deals, leases, transactions and properties', permissions: { dashboard: V, crm: V, sales: CRUD, leases: CRUD, transactions: CRUD, properties: CRUD, documents: CRUD, support: CE, projects: CRUD, reports: VE, masters: V } },
    { name: 'Accounts', description: 'Invoicing, bills, banking and financial reports', permissions: { dashboard: V, crm: V, sales: V, finance: [...CRUD, 'approve'], documents: CE, reports: VE, masters: CE, hr: V, leases: CRUD } },
    { name: 'Property Mgmt', description: 'Leases, maintenance and inspections', permissions: { dashboard: V, sales: V, leases: CRUD, documents: CE, projects: CE, masters: V } },
    { name: 'HR', description: 'Employees, leave, attendance and payroll', permissions: { dashboard: V, hr: [...CRUD, 'approve'], documents: CE, projects: CE, masters: V } },
    { name: 'Viewer', description: 'Read-only access to business modules', permissions: { dashboard: V, crm: V, sales: V, leases: V, transactions: V, properties: V, finance: V, support: V, projects: V, documents: V, reports: V } },
    { name: 'Customer Portal', description: 'External customers — own deals, invoices and documents only', permissions: { dashboard: V, sales: V, finance: V, documents: V, support: ['view', 'create'] } },
  ]
  for (const r of defaultRoles) {
    const existing = q.get(`SELECT id FROM roles WHERE name = ?`, r.name)
    console.log(`Checking role: ${r.name}, existing =`, existing)
    if (!existing) {
      const created = createRecord(getDef('roles'), { name: r.name, description: r.description, is_system: r.system || false, permissions: r.permissions }, sys)
      console.log(`Created role: ${r.name}, id = ${created.id}`)
    }
  }
  q.run(`UPDATE roles SET is_system = 1 WHERE name IN ('Admin','Manager')`)
  
  const role = (n: string) => {
    const result = q.val<number>(`SELECT id FROM roles WHERE name = ?`, n)
    console.log(`role('${n}') =`, result)
    return result!
  }
  const dept = (c: string) => idBy('departments', 'code', c)
  const dxb = idBy('branches', 'code', 'DXB')
  const presenter = createRecord(getDef('users'), { name: 'Demo Presenter', email: config.demo.email, password: config.demo.password, role_id: role('Admin'), branch_id: dxb, department_id: dept('MGT'), designation: 'General Manager (demo)', active: true, must_change_password: false }, sys)
  for (const [name, email, r, d] of STAFF) createRecord(getDef('users'), { name, email, password: 'Demo-' + Math.random().toString(36).slice(2) + 'Aa1!x', role_id: role(r), branch_id: dxb, department_id: dept(d), active: true, must_change_password: false }, sys)

  const admin = loadUser(presenter.id)
  const ctx: Ctx = { user: admin, system: true }
  const today = todayStr(), d = (n: number) => addDays(today, n)
  const net30 = idBy('payment_terms', 'name', 'Net 30 days')
  const uae = idBy('countries', 'code', 'AE')
  
  // Create a party record for the owner (SWK Properties LLC)
  const owner_party = mk(ctx, 'parties', { name: 'SWK Properties LLC', is_customer: true, is_vendor: false, status: 'Active', payment_term_id: net30, country_id: uae, city: 'Dubai', address1: 'Al Saqr Business Tower', trn: '100515171234567', currency: 'AED', industry: 'Construction', source: 'Other' })
  const owner = owner_party.id

  // Create a buyer party + lead (required by viewings and offers)
  const buyer_party = mk(ctx, 'parties', { name: 'Horizon Investments LLC', is_customer: true, status: 'Active', payment_term_id: net30, country_id: uae, city: 'Dubai', address1: 'Business Bay', currency: 'AED', industry: 'Construction', source: 'Other' })
  const buyer = buyer_party.id
  const lead = mk(ctx, 'leads', { company: 'Horizon Investments LLC', contact_name: 'James Carter', email: 'james.carter@horizon.example', phone: '+971 50 999 8888', source: 'Referral', status: 'Qualified', est_value: 3000000, owner_id: admin.id, interest: 'Apartment Sale' })
  const lead_id = lead.id

  // Create employees first (required for agents)
  const emp_ahmed = mk(ctx, 'employees', { name: 'Ahmed Al Mansoori', designation: 'Senior Sales Agent', branch_id: dxb, department_id: idBy('departments', 'code', 'SAL'), join_date: today, status: 'Active', phone: '+971 50 123 4567', email: 'ahmed@demo.swkproperties.ae', contract_type: 'Unlimited' })
  const emp_fatima = mk(ctx, 'employees', { name: 'Fatima Al Hashimi', designation: 'Leasing Specialist', branch_id: dxb, department_id: idBy('departments', 'code', 'LEA'), join_date: today, status: 'Active', phone: '+971 50 234 5678', email: 'fatima@demo.swkproperties.ae', contract_type: 'Unlimited' })
  const emp_omar = mk(ctx, 'employees', { name: 'Omar Khalid', designation: 'Property Manager', branch_id: dxb, department_id: idBy('departments', 'code', 'PM'), join_date: today, status: 'Active', phone: '+971 50 345 6789', email: 'omar@demo.swkproperties.ae', contract_type: 'Unlimited' })
  const emp_sarah = mk(ctx, 'employees', { name: 'Sarah Williams', designation: 'Commercial Sales Agent', branch_id: dxb, department_id: idBy('departments', 'code', 'SAL'), join_date: today, status: 'Active', phone: '+971 50 456 7890', email: 'sarah@demo.swkproperties.ae', contract_type: 'Unlimited' })
  const emp_mohammed = mk(ctx, 'employees', { name: 'Mohammed Al Qubaisi', designation: 'HR Manager', branch_id: dxb, department_id: idBy('departments', 'code', 'HR'), join_date: today, status: 'Active', phone: '+971 50 567 8901', email: 'mohammed@demo.swkproperties.ae', contract_type: 'Unlimited' })

  // Create agents linked to employees (using employee IDs)
  const agent_ahmed = mk(ctx, 'agents', { name: 'Ahmed Al Mansoori', employee_id: emp_ahmed.id, dld_broker_id: 'BRK-001', rera_card_no: 'RERA-001', dld_expiry: d(365), dld_license_type: 'Real Estate Broker', specialization: 'Residential Sales', phone: '+971 50 123 4567', email: 'ahmed@demo.swkproperties.ae', branch_id: dxb, status: 'Active', join_date: today, commission_split_pct: 50, commission_tier: 'Senior', bank_iban: 'AE070331234567890123456', bank_name: 'Emirates NBD', portal_access: true, bio: 'Senior sales agent specializing in luxury properties' })
  const agent_fatima = mk(ctx, 'agents', { name: 'Fatima Al Hashimi', employee_id: emp_fatima.id, dld_broker_id: 'BRK-002', rera_card_no: 'RERA-002', dld_expiry: d(365), dld_license_type: 'Real Estate Broker', specialization: 'Leasing', phone: '+971 50 234 5678', email: 'fatima@demo.swkproperties.ae', branch_id: dxb, status: 'Active', join_date: today, commission_split_pct: 50, commission_tier: 'Senior', bank_iban: 'AE070331234567890123457', bank_name: 'Emirates NBD', portal_access: true, bio: 'Leasing specialist for residential and commercial properties' })
  const agent_omar = mk(ctx, 'agents', { name: 'Omar Khalid', employee_id: emp_omar.id, dld_broker_id: 'BRK-003', rera_card_no: 'RERA-003', dld_expiry: d(365), dld_license_type: 'Real Estate Broker', specialization: 'Property Management', phone: '+971 50 345 6789', email: 'omar@demo.swkproperties.ae', branch_id: dxb, status: 'Active', join_date: today, commission_split_pct: 40, commission_tier: 'Standard', bank_iban: 'AE070331234567890123458', bank_name: 'Emirates NBD', portal_access: true, bio: 'Property management expert' })
  const agent_sarah = mk(ctx, 'agents', { name: 'Sarah Williams', employee_id: emp_sarah.id, dld_broker_id: 'BRK-004', rera_card_no: 'RERA-004', dld_expiry: d(365), dld_license_type: 'Real Estate Broker', specialization: 'Commercial Sales', phone: '+971 50 456 7890', email: 'sarah@demo.swkproperties.ae', branch_id: dxb, status: 'Active', join_date: today, commission_split_pct: 50, commission_tier: 'Senior', bank_iban: 'AE070331234567890123459', bank_name: 'Emirates NBD', portal_access: true, bio: 'Commercial property specialist' })
  const agent_mohammed = mk(ctx, 'agents', { name: 'Mohammed Al Qubaisi', employee_id: emp_mohammed.id, dld_broker_id: 'BRK-005', rera_card_no: 'RERA-005', dld_expiry: d(365), dld_license_type: 'Real Estate Broker', specialization: 'HR & Admin', phone: '+971 50 567 8901', email: 'mohammed@demo.swkproperties.ae', branch_id: dxb, status: 'Active', join_date: today, commission_split_pct: 0, commission_tier: 'Standard', bank_iban: 'AE070331234567890123460', bank_name: 'Emirates NBD', portal_access: false, bio: 'HR and administration' })

  // Communities (from SWK data)
  const comm = (code: string, name: string, emirate: string, extra: any = {}) => mk(ctx, 'communities', { code, name, emirate, area: emirate, master_developer: extra.dev, rera_community_id: extra.rera, description: extra.desc, active: true, ...extra })
  const marinas = comm('DMAR', 'Dubai Marina', 'Dubai', { dev: 'Emaar Properties', rera: 'DM-001', desc: 'Waterfront community with luxury towers and marina promenade' })
  const palm = comm('PALM', 'Palm Jumeirah', 'Dubai', { dev: 'Nakheel', rera: 'PJ-001', desc: 'Iconic palm-shaped island with luxury villas and apartments' })
  const downtown = comm('DTWN', 'Downtown Dubai', 'Dubai', { dev: 'Emaar Properties', rera: 'DT-001', desc: 'Heart of Dubai with Burj Khalifa and Dubai Mall' })
  const hills = comm('DHLS', 'Dubai Hills Estate', 'Dubai', { dev: 'Emaar Properties', rera: 'DH-001', desc: 'Master-planned community with golf course and parks' })
  const arabian = comm('ARAB', 'Arabian Ranches', 'Dubai', { dev: 'Emaar Properties', rera: 'AR-001', desc: 'Gated villa community with equestrian facilities' })
  const jvc = comm('JVC', 'Jumeirah Village Circle', 'Dubai', { dev: 'Nakheel', rera: 'JVC-001', desc: 'Family-friendly community with parks and schools' })
  const business = comm('BBAY', 'Business Bay', 'Dubai', { dev: 'Dubai Properties', rera: 'BB-001', desc: 'Central business district with commercial and residential towers' })

  // Developers
  const dev = (name: string, extra: any = {}) => mk(ctx, 'developers', { code: name.substring(0,4).toUpperCase(), name, rera_id: extra.rera, trade_license: extra.license, contact_person: extra.contact, phone: extra.phone, email: extra.email, active: true })
  const emaar = dev('Emaar Properties', { rera: 'DEV-001', license: 'DM-12345', contact: 'Ahmed Al Falasi', phone: '+971 4 367 3333', email: 'info@emaar.ae' })
  const nakheel = dev('Nakheel', { rera: 'DEV-002', license: 'DM-67890', contact: 'Khalid Al Malik', phone: '+971 4 390 8888', email: 'info@nakheel.com' })
  const dubai_props = dev('Dubai Properties', { rera: 'DEV-003', license: 'DM-54321', contact: 'Saeed Al Qatami', phone: '+971 4 281 8888', email: 'info@dubaiproperties.ae' })
  const damac = dev('DAMAC Properties', { rera: 'DEV-004', license: 'DM-98765', contact: 'Hussain Sajwani', phone: '+971 4 203 9999', email: 'info@damac.com' })

  // Properties (14 from SWK data)
  const prop = (title: string, comm_id: number, dev_id: number, agent_id: number, extra: any) => mk(ctx, 'properties', { title, community_id: comm_id, developer_id: dev_id, branch_id: dxb, agent_id, status: 'Available', active: true, ...extra })

  const p1 = prop('Marina Crown Tower - 2BR Sea View', marinas.id, emaar.id, agent_ahmed.id, { property_type: 'Apartment', bedrooms: 2, bathrooms: 2, area_sqft: 1450, area_sqm: 135, price: 2850000, price_per_sqft: 1965, rent_annual: 140000, furnishing: 'Fully Furnished', tenure: 'Freehold', year_built: 2015, payment_plan: '100% on completion', is_off_plan: false, is_exclusive: true, rera_permit_no: 'RERA-2024-001', address: 'Marina Crown, Dubai Marina', latitude: 25.0795, longitude: 55.1390, description: 'Stunning 2BR apartment with full marina views', features: 'Balcony, Marina view, High floor', amenities: 'Pool, Gym, Concierge, Marina access', listed_date: d(-30) })
  const p2 = prop('Palm Jumeirah Frond G - 4BR Villa', palm.id, nakheel.id, agent_ahmed.id, { property_type: 'Villa', bedrooms: 4, bathrooms: 5, area_sqft: 5200, area_sqm: 483, plot_area_sqft: 6800, price: 14500000, price_per_sqft: 2788, rent_annual: 450000, furnishing: 'Fully Furnished', tenure: 'Freehold', year_built: 2018, payment_plan: '100% on completion', is_off_plan: false, is_exclusive: true, rera_permit_no: 'RERA-2024-002', address: 'Frond G, Palm Jumeirah', latitude: 25.1124, longitude: 55.1390, description: 'Luxury 4BR villa with private beach access', features: 'Private pool, Beach access, Maid room', amenities: 'Private beach, Clubhouse, Security', listed_date: d(-45) })
  const p3 = prop('Downtown Dubai - Address Residences 1BR', downtown.id, emaar.id, agent_ahmed.id, { property_type: 'Apartment', bedrooms: 1, bathrooms: 1, area_sqft: 850, area_sqm: 79, price: 1650000, price_per_sqft: 1941, rent_annual: 85000, furnishing: 'Fully Furnished', tenure: 'Freehold', year_built: 2020, payment_plan: '100% on completion', is_off_plan: false, is_exclusive: false, rera_permit_no: 'RERA-2024-003', address: 'The Address Residences, Downtown Dubai', latitude: 25.1972, longitude: 55.2744, description: 'Elegant 1BR in Address Residences', features: 'Burj Khalifa view, Smart home', amenities: 'Pool, Spa, Direct mall access', listed_date: d(-20) })
  const p4 = prop('Dubai Hills - Park Heights 3BR', hills.id, emaar.id, agent_ahmed.id, { property_type: 'Apartment', bedrooms: 3, bathrooms: 3, area_sqft: 1850, area_sqm: 172, price: 3200000, price_per_sqft: 1730, rent_annual: 160000, furnishing: 'Semi-Furnished', tenure: 'Freehold', year_built: 2022, completion_year: 2023, payment_plan: 'Post-handover 2y', is_off_plan: true, is_exclusive: true, rera_permit_no: 'RERA-2024-004', address: 'Park Heights, Dubai Hills Estate', latitude: 25.1014, longitude: 55.2298, description: 'Off-plan 3BR with golf course views', features: 'Golf view, Modern finishes, Balcony', amenities: 'Golf course, Parks, Schools, Mall', listed_date: d(-10) })
  const p5 = prop('Arabian Ranches - Reem 4BR Villa', arabian.id, emaar.id, agent_ahmed.id, { property_type: 'Villa', bedrooms: 4, bathrooms: 4, area_sqft: 3450, area_sqm: 320, plot_area_sqft: 4200, price: 5800000, price_per_sqft: 1681, rent_annual: 220000, furnishing: 'Unfurnished', tenure: 'Freehold', year_built: 2016, payment_plan: '100% on completion', is_off_plan: false, is_exclusive: true, rera_permit_no: 'RERA-2024-005', address: 'Reem Community, Arabian Ranches', latitude: 25.0721, longitude: 55.3012, description: 'Spacious family villa in gated community', features: 'Garden, Maid room, Study, Covered parking', amenities: 'Equestrian center, Golf, Clubhouse', listed_date: d(-60) })
  const p6 = prop('JVC - District 12 Studio', jvc.id, nakheel.id, agent_fatima.id, { property_type: 'Studio', bedrooms: 0, bathrooms: 1, area_sqft: 420, area_sqm: 39, price: 680000, price_per_sqft: 1619, rent_annual: 42000, furnishing: 'Fully Furnished', tenure: 'Freehold', year_built: 2019, payment_plan: '100% on completion', is_off_plan: false, is_exclusive: false, rera_permit_no: 'RERA-2024-006', address: 'District 12, JVC', latitude: 25.0328, longitude: 55.1865, description: 'Affordable studio for investors', features: 'High rental yield, Metro nearby', amenities: 'Pool, Gym, Parks', listed_date: d(-15) })
  const p7 = prop('Business Bay - Bay Square 2BR', business.id, dubai_props.id, agent_ahmed.id, { property_type: 'Apartment', bedrooms: 2, bathrooms: 2, area_sqft: 1250, area_sqm: 116, price: 1950000, price_per_sqft: 1560, rent_annual: 95000, furnishing: 'Fully Furnished', tenure: 'Freehold', year_built: 2018, payment_plan: '100% on completion', is_off_plan: false, is_exclusive: true, rera_permit_no: 'RERA-2024-007', address: 'Bay Square, Business Bay', latitude: 25.1857, longitude: 55.2600, description: 'Modern 2BR with canal views', features: 'Canal view, Balcony, Smart home', amenities: 'Pool, Gym, Canal promenade', listed_date: d(-25) })

  // Create units for each property
  for (const [p, prefix, beds, baths, area, price, rent] of [
    [p1, 'MCT', 2, 2, 1450, 2850000, 140000],
    [p2, 'PJG', 4, 5, 5200, 14500000, 450000],
    [p3, 'ADR', 1, 1, 850, 1650000, 85000],
    [p4, 'PHG', 3, 3, 1850, 3200000, 160000],
    [p5, 'ARR', 4, 4, 3450, 5800000, 220000],
    [p6, 'JVC', 0, 1, 420, 680000, 42000],
    [p7, 'BYS', 2, 2, 1250, 1950000, 95000],
  ] as const) {
    mk(ctx, 'units', { unit_no: `${prefix}-01`, property_id: p.id, unit_type: 'Residential', status: 'Available', bedrooms: beds, bathrooms: baths, area_sqft: area, sale_price: price, rent_annual: rent, furnishing: 'Fully Furnished', floor_no: 10, view: 'Sea View', parking_slots: '1', has_balcony: true, agent_id: agent_ahmed.id, available_from: today })
  }

  // Mandates
  const m1 = mk(ctx, 'mandates', { property_id: p1.id, mandate_type: 'Exclusive Sale', status: 'Active', owner_id: owner, agent_id: agent_ahmed.id, asking_price: 2850000, commission_pct_seller: 2, commission_pct_buyer: 2, start_date: today, end_date: d(90), exclusive: true, marketing_notes: 'Featured on Property Finder & Bayut', portal_publish: true, portal_featured: true })
  const m2 = mk(ctx, 'mandates', { property_id: p2.id, mandate_type: 'Exclusive Sale', status: 'Active', owner_id: owner, agent_id: agent_ahmed.id, asking_price: 14500000, commission_pct_seller: 2, start_date: today, end_date: d(120), exclusive: true })
  const m3 = mk(ctx, 'mandates', { property_id: p3.id, mandate_type: 'Exclusive Lease', status: 'Active', owner_id: owner, agent_id: agent_ahmed.id, asking_rent: 85000, commission_pct_landlord: 5, commission_pct_tenant: 5, start_date: today, end_date: d(60), exclusive: true })

  // Viewings
  mk(ctx, 'viewings', { mandate_id: m1.id, property_id: p1.id, lead_id: lead_id, agent_id: agent_ahmed.id, scheduled_at: `${d(2)}T10:00`, duration_min: 30, status: 'Scheduled', meeting_point: 'Building lobby' })
  mk(ctx, 'viewings', { mandate_id: m2.id, property_id: p2.id, lead_id: lead_id, agent_id: agent_ahmed.id, scheduled_at: `${d(5)}T15:00`, duration_min: 60, status: 'Scheduled', meeting_point: 'Villa entrance' })

  // Offers
  mk(ctx, 'offers', { lead_id: lead_id, property_id: p1.id, buyer_id: buyer, listing_agent_id: agent_ahmed.id, offer_type: 'Purchase', status: 'Under Review', offer_price: 2750000, deposit_amount: 275000, payment_terms: 'Cash', offer_date: today, valid_until: d(14), special_conditions: 'Subject to DLD approval' })
  mk(ctx, 'offers', { lead_id: lead_id, property_id: p3.id, buyer_id: buyer, listing_agent_id: agent_ahmed.id, offer_type: 'Lease', status: 'Accepted', offer_price: 85000, deposit_amount: 8500, payment_terms: 'Annual', offer_date: today, valid_until: d(7) })

  // Deal Files (jobs)
  const deal = (p: any) => mk(ctx, 'jobs', { branch_id: dxb, deal_status: 'Active Mandate', ...p })
  const dl1 = deal({ deal_name: 'Marina Crown 2BR Sale', deal_type: 'Sale', property_id: p1.id, unit_id: 1, client_id: buyer, agent_id: agent_ahmed.id, deal_value: 2850000, commission_pct: 2, deal_date: today, target_close: d(60), operational_status: 'Offer', mandate_id: m1.id })
  const dl2 = deal({ deal_name: 'Palm Villa Sale', deal_type: 'Sale', property_id: p2.id, unit_id: 2, client_id: buyer, agent_id: agent_ahmed.id, deal_value: 14500000, commission_pct: 2, deal_date: today, target_close: d(90), operational_status: 'Viewing', mandate_id: m2.id })
  const dl3 = deal({ deal_name: 'Address Residences Lease', deal_type: 'Lease', property_id: p3.id, unit_id: 3, client_id: buyer, agent_id: agent_ahmed.id, deal_value: 85000, commission_pct: 5, deal_date: today, target_close: d(30), operational_status: 'Contract', mandate_id: m3.id })

  // Deal charges for invoicing
  for (const [dl, revCode, costCode] of [[dl1, 'COMM-SALE', 'COMM-SALE'], [dl2, 'COMM-SALE', 'COMM-SALE'], [dl3, 'COMM-LEASE', 'COMM-LEASE']] as const) {
    const ccRev = idBy('charge_codes', 'code', revCode)
    const ccCost = idBy('charge_codes', 'code', costCode)
    if (ccRev) mk(ctx, 'job_charges', { job_id: dl, kind: 'Revenue', charge_code_id: ccRev, description: 'Brokerage commission', qty: 1, rate: dl.deal_value * (dl.commission_pct || 2) / 100, currency: 'AED', status: 'Unbilled' })
    if (ccCost) mk(ctx, 'job_charges', { job_id: dl, kind: 'Cost', charge_code_id: ccCost, description: 'Referral fee', qty: 1, rate: dl.deal_value * 0.5 / 100, currency: 'AED', party_id: owner, status: 'Unbilled' })
  }

  // Sales Contract (for dl3 - accepted offer)
  mk(ctx, 'sales_contracts', { property_id: p3.id, unit_id: 3, seller_id: owner, buyer_id: 1, listing_agent_id: agent_ahmed.id, sale_price: 85000, deposit_amount: 8500, contract_date: today, completion_date: d(30), payment_method: 'Bank Transfer', dld_fee_pct: 4, agency_fee_pct: 5, status: 'Signed', signed_date: today, prepared_by_id: owner })

  // Leases
  const lease = mk(ctx, 'leases', { unit_id: 3, property_id: p3.id, landlord_id: owner, tenant_id: buyer, agent_id: agent_fatima.id, lease_type: 'Residential', status: 'Ejari Registered', start_date: d(1), end_date: addDays(d(1), 365), notice_date: d(270), annual_rent: 85000, payment_frequency: 'Annual', cheque_count: 1, security_deposit: 8500, agency_fee: 4250, ejari_no: 'EJ-2024-001234', ejari_date: today, service_charge_annual: 15000, special_clauses: 'Tenant responsible for DEWA', prepared_by_id: admin.id, signed_date: today })
  // Rent schedule
  mk(ctx, 'rent_schedules', { lease_id: lease.id, due_date: d(1), amount: 85000, vat_amount: 4250, total_amount: 89250, status: 'Pending' })
  mk(ctx, 'rent_schedules', { lease_id: lease.id, due_date: addDays(d(1), 365), amount: 85000, vat_amount: 4250, total_amount: 89250, status: 'Pending' })

  // Maintenance
  mk(ctx, 'maintenance', { lease_id: lease.id, unit_id: 3, tenant_id: buyer, landlord_id: owner, category: 'HVAC', priority: 'Medium', status: 'Scheduled', description: 'AC unit not cooling properly', location_details: 'Living room unit', scheduled_at: `${d(3)}T09:00`, estimated_cost: 500, cost_responsibility: 'Landlord', requires_approval: true })

  // Invoices for commissions
  const inv1 = mk(ctx, 'invoices', { doc_type: 'Tax Invoice', party_id: buyer, property_id: p1.id, branch_id: dxb, invoice_date: today, due_date: d(30), payment_term_id: net30, currency: 'AED', status: 'Posted' })
  const ccComm = idBy('charge_codes', 'code', 'COMM-SALE')
  if (ccComm) mk(ctx, 'invoice_lines', { invoice_id: inv1.id, charge_code_id: ccComm, description: 'Brokerage commission - Marina Crown 2BR', qty: 1, rate: 57000, currency: 'AED', vat_code_id: idBy('vat_codes', 'code', 'STD') })

  // Create a bank account
  const main_bank = mk(ctx, 'bank_accounts', { name: 'Main AED Account', type: 'Bank', currency: 'AED', gl_account_id: idBy('accounts', 'code', '1100'), active: true })

  const rec1 = mk(ctx, 'receipts', { party_id: buyer, bank_account_id: main_bank.id, receipt_date: today, method: 'Bank transfer', bank_account_id: idBy('bank_accounts', 'name', 'Main AED Account'), currency: 'AED', amount: 57000, status: 'Posted' })
  // Note: allocations would need receipt_allocations table

  console.log('DigitalBurj demo data seeded')
}