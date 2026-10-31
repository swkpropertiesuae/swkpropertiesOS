import { q } from '../db'
import { config } from '../config'
import { createRecord, getDef, SYSTEM_CTX } from '../engine'
import { nowIso, todayStr } from '../util'
import * as D from './data'
import { setSettings } from '../settings'
import { seedCompanyDocuments } from './company-documents'
import { seedCompliance } from './compliance'
import { syncStudioLibrary } from '../studio/library'

const done = (g: string) => !!q.val(`SELECT 1 FROM settings WHERE key = ?`, `seed:${g}`)
const mark = (g: string) => q.run(`INSERT INTO settings(key, value, updated_at) VALUES (?, '1', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`, `seed:${g}`, nowIso())
const idOf = (table: string, col: string, val: string) => q.val<number>(`SELECT id FROM ${table} WHERE ${col} = ? AND deleted_at IS NULL`, val)

export async function seedReference(opts: { users?: boolean; demo?: boolean } = {}) {
  const withUsers = opts.users !== false
  const mk = (key: string, payload: Record<string, any>) => createRecord(getDef(key), payload, SYSTEM_CTX)

  if (!done('branches')) {
    mk('branches', { code: 'DXB', name: 'Dubai – Head Office', city: 'Dubai', country: 'United Arab Emirates', is_head_office: true, active: true })
    mark('branches')
  }
  if (!done('legal_entity')) {
    const id = mk('legal_entities', { code: 'SWK', name: 'SWK Properties L.L.C.', base_currency: config.baseCurrency, is_default: true, active: true }).id
    q.run(`UPDATE branches SET legal_entity_id = ? WHERE legal_entity_id IS NULL`, id)
    mark('legal_entity')
  }
  if (!done('departments')) {
    for (const [code, name] of [
      ['OFFPLAN', 'Sales of Off-Plan Projects'],
      ['SECONDARY', 'Secondary Projects'],
      ['LEASING', 'Leasing Department'],
      ['OPS', 'Operations'],
      ['SAL', 'Sales & Business Development'],
      ['LEA', 'Leasing'],
      ['PM', 'Property Management'],
      ['ACC', 'Accounts & Finance'],
      ['DOC', 'Documentation & Conveyancing'],
      ['HR', 'Human Resources'],
      ['IT', 'BDM, Digital Marketing & IT'],
      ['MGT', 'Management'],
    ]) mk('departments', { code, name })
    mark('departments')
  }
  if (!done('departments_swk_v2')) {
    for (const [code, name] of [
      ['OFFPLAN', 'Sales of Off-Plan Projects'],
      ['SECONDARY', 'Secondary Projects'],
      ['LEASING', 'Leasing Department'],
      ['IT', 'BDM, Digital Marketing & IT'],
    ]) {
      if (!idOf('departments', 'code', code)) mk('departments', { code, name })
    }
    mark('departments_swk_v2')
  }
  if (!done('roles')) {
    const V = ['view'], VE = ['view', 'export'], CRUD = ['view', 'create', 'edit', 'delete', 'export'], CE = ['view', 'create', 'edit', 'export'], ALL_MOD = ['view', 'create', 'edit', 'delete', 'approve', 'export']
    const roles = [
      { name: 'Admin', description: 'Owner (Shabib Siraj) – Full system control and final administrative approver', system: true, permissions: '*' },
      { name: 'Owner', description: 'Owner (Shabib Siraj) – Complete control over company operations, approvals and deletions', system: true, permissions: '*' },
      {
        name: 'Manager',
        description: 'Manager (Mohammad Haseeb) – Majority operational access; administrative decisions and record deletions require Owner approval',
        system: true,
        permissions: {
          dashboard: ALL_MOD, crm: ALL_MOD, sales: ALL_MOD, properties: ALL_MOD, mandates: ALL_MOD,
          transactions: ALL_MOD, leases: ALL_MOD, finance: ALL_MOD, assets: ALL_MOD, hr: ALL_MOD,
          support: ALL_MOD, projects: ALL_MOD, documents: ALL_MOD, compliance: ALL_MOD, ai: ALL_MOD,
          reports: ALL_MOD, masters: ALL_MOD, admin: V,
        },
      },
      {
        name: 'BDM & IT Admin',
        description: 'BDM & IT Admin (Talha Shabbir) – CRM, ERP, Digital Marketing, Portal Syndication (Bayut/Dubizzle) & IT Administration',
        system: true,
        permissions: {
          dashboard: ALL_MOD, crm: ALL_MOD, sales: ALL_MOD, properties: ALL_MOD, mandates: ALL_MOD,
          transactions: CE, leases: ALL_MOD, finance: VE, assets: CE, hr: V,
          support: ALL_MOD, projects: ALL_MOD, documents: ALL_MOD, compliance: VE, ai: ALL_MOD,
          reports: ALL_MOD, masters: ALL_MOD, admin: ['view', 'create', 'edit', 'export'],
        },
      },
      {
        name: 'Sales Advisor',
        description: 'Sales Advisor (Company Visa, Zero Basic Salary, 50-50% Commission Split with SWK Properties)',
        system: true,
        permissions: { dashboard: V, crm: CRUD, sales: [...CRUD, 'approve', 'export'], properties: CE, mandates: CE, transactions: CE, leases: CE, hr: CE, documents: CE, support: CE, projects: CRUD, reports: VE, masters: V },
      },
      { name: 'Sales', description: 'CRM, quotations and customer follow-up (Sales Advisor 50/50 split)', permissions: { dashboard: V, crm: CRUD, sales: [...CRUD, 'approve', 'export'], properties: CE, mandates: CE, transactions: CE, leases: CE, hr: CE, documents: CE, support: CE, projects: CRUD, reports: VE, masters: V } },
      { name: 'Operations', description: 'Deals, leases, transactions and properties', permissions: { dashboard: V, crm: V, sales: CRUD, leases: CRUD, transactions: CRUD, properties: CRUD, mandates: CRUD, hr: CE, compliance: V, documents: CRUD, support: CE, projects: CRUD, reports: VE, masters: V } },
      { name: 'Accounts', description: 'Invoicing, bills, banking and financial reports', permissions: { dashboard: V, crm: V, sales: V, finance: [...CRUD, 'approve'], documents: CE, reports: VE, masters: CE, hr: V, leases: CRUD } },
      { name: 'Property Mgmt', description: 'Leases, maintenance and inspections', permissions: { dashboard: V, sales: V, leases: CRUD, documents: CE, projects: CE, masters: V } },
      { name: 'HR', description: 'Employees, leave, attendance and payroll', permissions: { dashboard: V, hr: [...CRUD, 'approve'], documents: CE, projects: CE, masters: V } },
      { name: 'Viewer', description: 'Read-only access to business modules', permissions: { dashboard: V, crm: V, sales: V, leases: V, transactions: V, properties: V, finance: V, support: V, projects: V, documents: V, reports: V } },
      { name: 'Customer Portal', description: 'External customers — own deals, invoices and documents only', permissions: { dashboard: V, crm: V, sales: V, finance: V, leases: V, mandates: V, transactions: V, documents: V, support: ['view', 'create'] } },
    ]
    for (const r of roles) mk('roles', { name: r.name, description: r.description, is_system: r.system || false, permissions: r.permissions })
    q.run(`UPDATE roles SET is_system = 1 WHERE name IN ('Admin','Owner','Manager','BDM & IT Admin','Sales Advisor')`)
    mark('roles')
  }
  if (!done('roles_swk_v2')) {
    const V = ['view'], VE = ['view', 'export'], CRUD = ['view', 'create', 'edit', 'delete', 'export'], CE = ['view', 'create', 'edit', 'export'], ALL_MOD = ['view', 'create', 'edit', 'delete', 'approve', 'export']
    if (!idOf('roles', 'name', 'Owner')) mk('roles', { name: 'Owner', description: 'Owner (Shabib Siraj) – Complete control over company operations, approvals and deletions', is_system: true, permissions: '*' })
    if (!idOf('roles', 'name', 'BDM & IT Admin')) mk('roles', { name: 'BDM & IT Admin', description: 'BDM & IT Admin (Talha Shabbir) – CRM, ERP, Digital Marketing, Portal Syndication & IT Admin', is_system: true, permissions: { dashboard: ALL_MOD, crm: ALL_MOD, sales: ALL_MOD, properties: ALL_MOD, mandates: ALL_MOD, transactions: CE, leases: ALL_MOD, finance: VE, assets: CE, hr: V, support: ALL_MOD, projects: ALL_MOD, documents: ALL_MOD, compliance: VE, ai: ALL_MOD, reports: ALL_MOD, masters: ALL_MOD, admin: ['view', 'create', 'edit', 'export'] } })
    if (!idOf('roles', 'name', 'Sales Advisor')) mk('roles', { name: 'Sales Advisor', description: 'Sales Advisor (Company Visa, Zero Basic Salary, 50-50% Commission Split)', is_system: true, permissions: { dashboard: V, crm: CRUD, sales: [...CRUD, 'approve', 'export'], properties: CE, mandates: CE, transactions: CE, leases: CE, hr: CE, documents: CE, support: CE, projects: CRUD, reports: VE, masters: V } })
    mark('roles_swk_v2')
  }
  if (withUsers && !done('users')) {
    const a = config.accounts
    const dxb = idOf('branches', 'code', 'DXB')
    for (const [email, name, pw, role, deptCode, desig] of [
      [a.adminEmail, a.adminName, a.adminPassword, 'Admin', 'MGT', 'Owner & Managing Director'],
      ['shabib@swkpropertiesuae.com', 'Shabib Siraj', a.adminPassword, 'Admin', 'MGT', 'Owner & Managing Director'],
      [a.managerEmail, a.managerName, a.managerPassword, 'Manager', 'OPS', 'Operations Manager'],
      ['haseeb@swkpropertiesuae.com', 'Mohammad Haseeb', a.managerPassword, 'Manager', 'OPS', 'Operations Manager'],
      [a.bdmEmail, a.bdmName, a.bdmPassword, 'BDM & IT Admin', 'IT', 'BDM, Digital Marketing & IT Admin'],
    ] as const) {
      if (idOf('users', 'lower(email)', email)) continue
      if (role === 'Admin' && email === a.adminEmail && a.adminPasswordGenerated) console.warn(`[first start] ${role} account ${email} created with a generated one-time password: ${pw}\n  Sign in and change it now (set ADMIN_PASSWORD / MANAGER_PASSWORD to choose your own).`)
      mk('users', { name, email, password: pw, role_id: idOf('roles', 'name', role), branch_id: dxb, department_id: idOf('departments', 'code', deptCode) ?? idOf('departments', 'code', 'MGT'), designation: desig, active: true, must_change_password: true })
    }
    mark('users')
  }
  if (withUsers && !done('users_swk_hierarchy_v2')) {
    const a = config.accounts
    const dxb = idOf('branches', 'code', 'DXB')
    q.run(`UPDATE users SET name = 'Shabib Siraj', designation = 'Owner & Managing Director' WHERE lower(email) = ?`, a.adminEmail)
    q.run(`UPDATE users SET name = 'Mohammad Haseeb', designation = 'Operations Manager' WHERE lower(email) = ?`, a.managerEmail)
    for (const [email, name, pw, role, deptCode, desig] of [
      ['shabib@swkpropertiesuae.com', 'Shabib Siraj', a.adminPassword, 'Admin', 'MGT', 'Owner & Managing Director'],
      ['haseeb@swkpropertiesuae.com', 'Mohammad Haseeb', a.managerPassword, 'Manager', 'OPS', 'Operations Manager'],
      [a.bdmEmail, a.bdmName, a.bdmPassword, 'BDM & IT Admin', 'IT', 'BDM, Digital Marketing & IT Admin'],
    ] as const) {
      if (!idOf('users', 'lower(email)', email)) {
        mk('users', { name, email, password: pw, role_id: idOf('roles', 'name', role) ?? idOf('roles', 'name', 'Admin'), branch_id: dxb, department_id: idOf('departments', 'code', deptCode) ?? idOf('departments', 'code', 'MGT'), designation: desig, active: true, must_change_password: true })
      }
    }
    mark('users_swk_hierarchy_v2')
  }
  if (!done('countries')) {
    const names = new Intl.DisplayNames(['en'], { type: 'region' })
    for (const code of D.ISO_COUNTRIES) {
      let name = code
      try { name = names.of(code) ?? code } catch { /* keep code */ }
      const region = D.REGIONS.find(([, s]) => s.has(code))?.[0] ?? 'Other'
      mk('countries', { code, name, region, currency: D.CURRENCY_BY_COUNTRY[code] ?? null, active: true })
    }
    mark('countries')
  }
  if (!done('currencies')) {
    for (const [code, name, symbol] of D.CURRENCIES) mk('currencies', { code, name, symbol, rate: code === 'AED' ? 1 : code === 'USD' ? 3.6725 : null, active: true })
    mark('currencies')
  }
  if (!done('vat')) { for (const [code, name, rate, category] of D.VAT_CODES) mk('vat_codes', { code, name, rate, category }); mark('vat') }
  if (!done('terms')) { for (const [name, days] of D.PAYMENT_TERMS) mk('payment_terms', { name, days }); mark('terms') }
  if (!done('accounts')) {
    for (const [code, name, type, subtype, role] of D.ACCOUNTS) mk('accounts', { code, name, type, subtype, role: role ?? '', active: true })
    mark('accounts')
  }
  // Added after first release: databases created earlier receive the rounding account without disturbing their existing chart.
  if (!done('accounts_rounding')) {
    if (!idOf('accounts', 'code', '7910') && !q.val(`SELECT 1 FROM accounts WHERE role = 'rounding' AND deleted_at IS NULL`)) mk('accounts', { code: '7910', name: 'Rounding differences', type: 'Expense', subtype: 'Operating expense', role: 'rounding', active: true })
    mark('accounts_rounding')
  }
  if (!done('charges')) {
    for (const [code, name, applies_to, group, vat, inc, cost] of D.CHARGE_CODES) {
      mk('charge_codes', { code, name, applies_to, group, vat_code_id: idOf('vat_codes', 'code', vat), income_account_id: idOf('accounts', 'code', inc), cost_account_id: idOf('accounts', 'code', cost), active: true })
    }
    mark('charges')
  }
  if (!done('banks')) {
    mk('bank_accounts', { name: 'Main operating account (AED)', type: 'Bank', currency: 'AED', gl_account_id: idOf('accounts', 'code', '1100'), active: true })
    mk('bank_accounts', { name: 'Cash in hand', type: 'Cash', currency: 'AED', gl_account_id: idOf('accounts', 'code', '1000'), active: true })
    mk('bank_accounts', { name: 'Petty cash', type: 'Petty cash', currency: 'AED', gl_account_id: idOf('accounts', 'code', '1010'), active: true })
    mark('banks')
  }
  if (!done('communities')) {
    for (const [code, name, emirate, area, master_developer, avg_price_sqft, avg_rent_annual] of [
      ['MARINA', 'Dubai Marina', 'Dubai', 'Dubai', 'Emaar Properties', 2290, 160000],
      ['DOWNTOWN', 'Downtown Dubai', 'Dubai', 'Dubai', 'Emaar Properties', 2980, 195000],
      ['PALM', 'Palm Jumeirah', 'Dubai', 'Dubai', 'Nakheel', 4380, 260000],
      ['BBAY', 'Business Bay', 'Dubai', 'Dubai', 'Dubai Properties', 2180, 150000],
      ['DHILLS', 'Dubai Hills Estate', 'Dubai', 'Dubai', 'Emaar Properties', 2390, 170000],
      ['CREEK', 'Dubai Creek Harbour', 'Dubai', 'Dubai', 'Emaar Properties', 2320, 150000],
      ['JVC', 'Jumeirah Village Circle', 'Dubai', 'Dubai', 'Nakheel', 1320, 105000],
      ['JLT', 'Jumeirah Lakes Towers (JLT)', 'Dubai', 'Dubai', 'DMCC', 1680, 125000],
      ['ARANCHES', 'Arabian Ranches', 'Dubai', 'Dubai', 'Emaar Properties', 1950, 240000],
      ['SZR', 'Sheikh Zayed Road', 'Dubai', 'Dubai', 'Meraas', 1920, 140000],
      ['DIFC', 'DIFC', 'Dubai', 'Dubai', 'DIFC Authority', 3100, 210000],
      ['MBR', 'MBR City & Sobha Hartland', 'Dubai', 'Dubai', 'Meydan / Sobha Realty', 2240, 155000],
      ['EBEACH', 'Emaar Beachfront', 'Dubai', 'Dubai', 'Emaar Properties', 3850, 240000],
      ['PJEBEL', 'Palm Jebel Ali', 'Dubai', 'Dubai', 'Nakheel', 3250, 290000],
      ['DSOUTH', 'Dubai South & Expo City', 'Dubai', 'Dubai', 'Dubai South', 1290, 88000],
      ['DAMACH', 'DAMAC Hills & DAMAC Lagoons', 'Dubai', 'Dubai', 'DAMAC Properties', 1540, 145000],
      ['FURJAN', 'Al Furjan', 'Dubai', 'Dubai', 'Nakheel', 1420, 118000],
      ['ARJAN', 'Arjan & Miracle Garden', 'Dubai', 'Dubai', 'Dubai Holding', 1350, 92000],
      ['BARARI', 'Al Barari', 'Dubai', 'Dubai', 'Al Barari', 2650, 420000],
      ['DISLANDS', 'Dubai Islands', 'Dubai', 'Dubai', 'Nakheel', 2480, 185000],
      ['CITYWALK', 'City Walk & Jumeirah', 'Dubai', 'Dubai', 'Meraas', 2890, 210000],
      ['BLUEW', 'Bluewaters Island', 'Dubai', 'Dubai', 'Meraas', 4650, 320000],
      ['JGE', 'Jumeirah Golf Estates', 'Dubai', 'Dubai', 'Wasl / JGE', 2120, 285000],
      ['MOTOR', 'Motor City & Sports City', 'Dubai', 'Dubai', 'Union Properties', 1260, 96000],
    ] as const) {
      if (!idOf('communities', 'code', code)) mk('communities', { code, name, emirate, area, master_developer, avg_price_sqft, avg_rent_annual, active: true })
    }
    mark('communities')
  }
  if (!done('communities_swk_v2')) {
    for (const [code, name, emirate, area, master_developer, avg_price_sqft, avg_rent_annual] of [
      ['JLT', 'Jumeirah Lakes Towers (JLT)', 'Dubai', 'Dubai', 'DMCC', 1680, 125000],
      ['MBR', 'MBR City & Sobha Hartland', 'Dubai', 'Dubai', 'Meydan / Sobha Realty', 2240, 155000],
      ['EBEACH', 'Emaar Beachfront', 'Dubai', 'Dubai', 'Emaar Properties', 3850, 240000],
      ['PJEBEL', 'Palm Jebel Ali', 'Dubai', 'Dubai', 'Nakheel', 3250, 290000],
      ['DSOUTH', 'Dubai South & Expo City', 'Dubai', 'Dubai', 'Dubai South', 1290, 88000],
      ['DAMACH', 'DAMAC Hills & DAMAC Lagoons', 'Dubai', 'Dubai', 'DAMAC Properties', 1540, 145000],
      ['FURJAN', 'Al Furjan', 'Dubai', 'Dubai', 'Nakheel', 1420, 118000],
      ['ARJAN', 'Arjan & Miracle Garden', 'Dubai', 'Dubai', 'Dubai Holding', 1350, 92000],
      ['BARARI', 'Al Barari', 'Dubai', 'Dubai', 'Al Barari', 2650, 420000],
      ['DISLANDS', 'Dubai Islands', 'Dubai', 'Dubai', 'Nakheel', 2480, 185000],
      ['CITYWALK', 'City Walk & Jumeirah', 'Dubai', 'Dubai', 'Meraas', 2890, 210000],
      ['BLUEW', 'Bluewaters Island', 'Dubai', 'Dubai', 'Meraas', 4650, 320000],
      ['JGE', 'Jumeirah Golf Estates', 'Dubai', 'Dubai', 'Wasl / JGE', 2120, 285000],
      ['MOTOR', 'Motor City & Sports City', 'Dubai', 'Dubai', 'Union Properties', 1260, 96000],
    ] as const) {
      if (!idOf('communities', 'code', code)) mk('communities', { code, name, emirate, area, master_developer, avg_price_sqft, avg_rent_annual, active: true })
    }
    mark('communities_swk_v2')
  }
  if (!done('developers')) {
    for (const [code, name, rera_id, website] of [
      ['EMAAR', 'Emaar Properties', 'DEV-001', 'https://www.emaar.com'],
      ['NAKHEEL', 'Nakheel', 'DEV-002', 'https://www.nakheel.com'],
      ['DAMAC', 'DAMAC Properties', 'DEV-003', 'https://www.damacproperties.com'],
      ['SOBHA', 'Sobha Realty', 'DEV-004', 'https://www.sobharealty.com'],
      ['MERAAS', 'Meraas', 'DEV-005', 'https://www.meraas.com'],
      ['ELLINGTON', 'Ellington Properties', 'DEV-006', 'https://www.ellingtonproperties.ae'],
      ['SELECT', 'Select Group', 'DEV-007', 'https://www.select-group.ae'],
      ['BINGHATTI', 'Binghatti', 'DEV-008', 'https://www.binghatti.com'],
      ['OMNIYAT', 'Omniyat', 'DEV-009', 'https://www.omniyat.com'],
      ['ALDAR', 'Aldar Properties', 'DEV-010', 'https://www.aldar.com'],
    ] as const) {
      mk('developers', { code, name, rera_id, website, active: true })
    }
    mark('developers')
  }
  if (!done('compliance')) { seedCompliance({ demo: opts.demo }); mark('compliance') }
  if (!opts.demo && !done('company_documents_20261015')) {
    seedCompanyDocuments()
    mark('company_documents_20261015')
  }
  if (!opts.demo && !done('document_presentation_20261015')) {
    setSettings({ company_address: 'Bur Dubai, Dubai, UAE' })
    mark('document_presentation_20261015')
  }
  if (!opts.demo && (q.val<number>(`SELECT COUNT(*) FROM employees WHERE deleted_at IS NULL`) ?? 0) === 0) {
    const dxb = idOf('branches', 'code', 'DXB')
    const dept = (code: string) => idOf('departments', 'code', code) ?? idOf('departments', 'code', 'MGT')
    const usr = (email: string) => idOf('users', 'lower(email)', email.toLowerCase())
    const shabibEmp = mk('employees', {
      name: 'Shabib Siraj',
      user_id: usr(config.accounts.adminEmail),
      department_id: dept('MGT'),
      designation: 'Owner & Managing Director',
      branch_id: dxb,
      status: 'Active',
      join_date: '2020-01-01',
      contract_type: 'Unlimited',
      phone: '+971 50 100 0001',
      email: config.accounts.adminEmail,
      compensation_model: 'Salaried Management / Operations',
      company_visa_sponsored: true,
      basic_salary: 0,
    })
    const haseebEmp = mk('employees', {
      name: 'Mohammad Haseeb',
      user_id: usr(config.accounts.managerEmail),
      department_id: dept('OPS'),
      designation: 'Operations Manager',
      branch_id: dxb,
      manager_id: shabibEmp.id,
      status: 'Active',
      join_date: '2021-03-01',
      contract_type: 'Unlimited',
      phone: '+971 50 100 0002',
      email: config.accounts.managerEmail,
      compensation_model: 'Salaried Management / Operations',
      company_visa_sponsored: true,
      basic_salary: 18000,
    })
    mk('employees', {
      name: 'Talha Shabbir',
      user_id: usr(config.accounts.bdmEmail),
      department_id: dept('IT'),
      designation: 'BDM, Digital Marketing & IT Admin',
      branch_id: dxb,
      manager_id: shabibEmp.id,
      status: 'Active',
      join_date: '2022-06-01',
      contract_type: 'Unlimited',
      phone: '+971 50 100 0003',
      email: config.accounts.bdmEmail,
      compensation_model: 'Salaried Management / Operations',
      company_visa_sponsored: true,
      basic_salary: 14000,
    })
    for (const [advName, advEmail, deptCode, spec, brn] of [
      ['Zaid Al-Mansoori', 'zaid@swkpropertiesuae.com', 'OFFPLAN', 'Sales of Off-Plan Projects', 'BRN-68201'],
      ['Nadia Al-Hashemi', 'nadia@swkpropertiesuae.com', 'SECONDARY', 'Secondary Projects', 'BRN-68202'],
      ['Rashed Al-Maktoum', 'rashed@swkpropertiesuae.com', 'LEASING', 'Leasing', 'BRN-68203'],
    ] as const) {
      const emp = mk('employees', {
        name: advName,
        department_id: dept(deptCode),
        designation: `Sales Advisor – ${spec}`,
        branch_id: dxb,
        manager_id: haseebEmp.id,
        status: 'Active',
        join_date: '2023-02-01',
        contract_type: 'Limited',
         email: advEmail,
        compensation_model: 'Commission Only (50/50 Company Visa – 0 Basic)',
        company_visa_sponsored: true,
        commission_split_company_pct: 50,
        commission_split_agent_pct: 50,
        basic_salary: 0,
        housing_allowance: 0,
        transport_allowance: 0,
        other_allowance: 0,
      })
      if (!idOf('agents', 'dld_broker_id', brn)) {
        mk('agents', {
          employee_id: emp.id,
          name: advName,
          department_division: spec,
          company_visa_no_basic: true,
          dld_broker_id: brn,
          rera_card_no: `RERA-${brn}`,
          dld_expiry: '2027-12-31',
          specialization: spec,
          email: advEmail,
          branch_id: dxb,
          status: 'Active',
          commission_split_pct: 50,
          commission_tier: '50/50 Standard (Company Visa)',
        })
      }
    }
  }
  if (!opts.demo && (!done('market_pulse_swk_v2') || (q.val<number>(`SELECT COUNT(*) FROM dld_market_transactions WHERE deleted_at IS NULL`) ?? 0) === 0)) {
    const sys = { user: null, system: true }
    const today = new Date().toISOString().slice(0, 10)
    for (const t of [
      { txn_date: today, community_code: 'DOWNTOWN', area_name: 'Downtown Dubai', building_or_project: 'Address Residences Dubai Opera', department_division: 'Sales of Off-Plan Projects', procedure_type: 'Off-Plan Sale (Oqood)', property_type: 'Apartment', bedrooms: '2 B/R', area_sqft: 1485, transacted_value_aed: 5850000, price_per_sqft_aed: 3938, buyer_finance_mode: 'Developer Payment Plan', source_repo: 'Dubai Pulse / DLD Open Data GitHub Sync' },
      { txn_date: today, community_code: 'DMARINA', area_name: 'Dubai Marina', building_or_project: 'Marina Gate II', department_division: 'Secondary Projects', procedure_type: 'Secondary Ready Sale (Title Deed)', property_type: 'Apartment', bedrooms: '2 B/R', area_sqft: 1464, transacted_value_aed: 3650000, price_per_sqft_aed: 2493, buyer_finance_mode: 'Cash', source_repo: 'Dubai Pulse / DLD Open Data GitHub Sync' },
      { txn_date: today, community_code: 'PALM', area_name: 'Palm Jumeirah', building_or_project: 'Signature Villas Frond G', department_division: 'Secondary Projects', procedure_type: 'Secondary Ready Sale (Title Deed)', property_type: 'Villa', bedrooms: '5 B/R', area_sqft: 7000, transacted_value_aed: 48500000, price_per_sqft_aed: 6928, buyer_finance_mode: 'Cash', source_repo: 'Dubai Pulse / DLD Open Data GitHub Sync' },
      { txn_date: today, community_code: 'DHILLS', area_name: 'Dubai Hills Estate', building_or_project: 'Park Field Tower A', department_division: 'Sales of Off-Plan Projects', procedure_type: 'Off-Plan Sale (Oqood)', property_type: 'Apartment', bedrooms: '1 B/R', area_sqft: 737, transacted_value_aed: 1780000, price_per_sqft_aed: 2415, buyer_finance_mode: 'Developer Payment Plan', source_repo: 'Dubai Pulse / DLD Open Data GitHub Sync' },
      { txn_date: today, community_code: 'BBAY', area_name: 'Business Bay', building_or_project: 'Ellington One River Point', department_division: 'Sales of Off-Plan Projects', procedure_type: 'Off-Plan Sale (Oqood)', property_type: 'Apartment', bedrooms: '2 B/R', area_sqft: 1378, transacted_value_aed: 3920000, price_per_sqft_aed: 2845, buyer_finance_mode: 'Developer Payment Plan', source_repo: 'Dubai Pulse / DLD Open Data GitHub Sync' },
      { txn_date: today, community_code: 'CREEK', area_name: 'Dubai Creek Harbour', building_or_project: 'Creek Waters 2', department_division: 'Sales of Off-Plan Projects', procedure_type: 'Off-Plan Sale (Oqood)', property_type: 'Apartment', bedrooms: '3 B/R', area_sqft: 1850, transacted_value_aed: 4450000, price_per_sqft_aed: 2405, buyer_finance_mode: 'Developer Payment Plan', source_repo: 'Dubai Pulse / DLD Open Data GitHub Sync' },
      { txn_date: today, community_code: 'JVC', area_name: 'Jumeirah Village Circle', building_or_project: 'Binghatti Corner', department_division: 'Secondary Projects', procedure_type: 'Secondary Ready Sale (Title Deed)', property_type: 'Apartment', bedrooms: '1 B/R', area_sqft: 689, transacted_value_aed: 1080000, price_per_sqft_aed: 1568, buyer_finance_mode: 'Mortgaged', source_repo: 'Dubai Pulse / DLD Open Data GitHub Sync' },
      { txn_date: today, community_code: 'PJEBEL', area_name: 'Palm Jebel Ali', building_or_project: 'The Beach Collection Frond M', department_division: 'Sales of Off-Plan Projects', procedure_type: 'Off-Plan Sale (Oqood)', property_type: 'Villa', bedrooms: '6 B/R', area_sqft: 7532, transacted_value_aed: 26800000, price_per_sqft_aed: 3558, buyer_finance_mode: 'Developer Payment Plan', source_repo: 'Dubai Pulse / DLD Open Data GitHub Sync' },
      { txn_date: today, community_code: 'DSOUTH', area_name: 'Dubai South & Expo City', building_or_project: 'South Bay Phase 4 Lagoon Townhouses', department_division: 'Sales of Off-Plan Projects', procedure_type: 'Off-Plan Sale (Oqood)', property_type: 'Townhouse', bedrooms: '4 B/R', area_sqft: 3015, transacted_value_aed: 3850000, price_per_sqft_aed: 1277, buyer_finance_mode: 'Developer Payment Plan', source_repo: 'Dubai Pulse / DLD Open Data GitHub Sync' },
      { txn_date: today, community_code: 'MBR', area_name: 'MBR City & Sobha Hartland', building_or_project: 'Sobha Hartland II 340 Riverside Crescent', department_division: 'Sales of Off-Plan Projects', procedure_type: 'Off-Plan Sale (Oqood)', property_type: 'Apartment', bedrooms: '2 B/R', area_sqft: 1120, transacted_value_aed: 2690000, price_per_sqft_aed: 2402, buyer_finance_mode: 'Developer Payment Plan', source_repo: 'Dubai Pulse / DLD Open Data GitHub Sync' },
    ]) {
      try { createRecord(getDef('dld_market_transactions'), t, sys) } catch {}
    }
    for (const n of [
      { published_at: `${today} 09:00`, headline: 'Dubai Metro Blue Line 2029 Construction Accelerates Connectivity for Creek Harbour & Silicon Oasis', category: 'Master Plan & Infrastructure (2040)', area_name: 'Dubai Creek Harbour', impact_ticker: 'Bullish (+)', source_name: 'RTA & DLD Market Intelligence', summary: '30km Blue Line with 14 stations connects Dubai Creek Harbour, Festival City, International City, and Academic City with world-record 100m metro bridge over Dubai Creek.', client_pitch_takeaway: 'Mention the 22–28% historical capital appreciation near new Metro stations within 24 months of handover.', urgent_alert: true },
      { published_at: `${today} 09:15`, headline: 'Al Maktoum International Airport (DWC) AED 128B Expansion Drives Record Demand in Dubai South & Palm Jebel Ali', category: 'Master Plan & Infrastructure (2040)', area_name: 'Dubai South & Expo City', impact_ticker: 'Major Infrastructure Catalyst', source_name: 'Dubai Aviation Engineering Projects', summary: 'World’s largest airport capacity (260M passengers) expected to draw 1M+ new residents into the Southern Dubai corridor over the next 10–15 years.', client_pitch_takeaway: 'Position Dubai South and Palm Jebel Ali as the next 15-year generational wealth corridor under the Dubai 2040 Urban Master Plan.', urgent_alert: true },
      { published_at: `${today} 09:30`, headline: 'DLD & VARA Framework Streamlines Regulated USDT/Crypto Settlement via Licensed UAE Escrow Gateways', category: 'DLD & RERA Regulation', area_name: 'Downtown Dubai', impact_ticker: 'Regulatory Update', source_name: 'Dubai Land Department / VARA', summary: 'Institutional and international buyers can settle property purchases via VARA-licensed OTC gateways converting directly into AED Manager’s Cheques or Developer Escrow.', client_pitch_takeaway: 'Assure international buyers that SWK Properties facilitates 100% compliant VARA-licensed USDT-to-AED developer escrow & corporate bank settlement.', urgent_alert: true },
      { published_at: `${today} 09:45`, headline: 'UAE Central Bank EIBOR Steady at 3.89% — Fixed 3-Year Mortgage Rates Starting at 3.99% Boost Secondary Market', category: 'Mortgage & Central Bank Rate', area_name: 'Dubai Hills Estate', impact_ticker: 'Bullish (+)', source_name: 'UAE Central Bank / Mortgage Market Desk', summary: 'Competitive 3.99%–4.29% fixed mortgage packages from leading UAE banks are accelerating secondary Form F conversions in Dubai Hills, Marina, and JVC.', client_pitch_takeaway: 'Show tenants paying AED 150k+ annual rent that their monthly mortgage installment on a 20% down payment is now comparable to rent.', urgent_alert: true },
    ]) {
      try { createRecord(getDef('real_estate_news'), n, sys) } catch {}
    }
    mark('market_pulse_swk_v2')
  }
  syncStudioLibrary()
}
