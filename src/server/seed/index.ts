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
    for (const [code, name] of [['OPS', 'Operations'], ['SAL', 'Sales & Business Development'], ['LEA', 'Leasing'], ['PM', 'Property Management'], ['ACC', 'Accounts & Finance'], ['DOC', 'Documentation & Conveyancing'], ['HR', 'Human Resources'], ['MGT', 'Management']]) mk('departments', { code, name })
    mark('departments')
  }
  if (!done('roles')) {
    const V = ['view'], VE = ['view', 'export'], CRUD = ['view', 'create', 'edit', 'delete', 'export'], CE = ['view', 'create', 'edit', 'export']
    const roles = [
      { name: 'Admin', description: 'Full system access, including administration', system: true, permissions: '*' },
      { name: 'Manager', description: 'Full access to every module', system: true, permissions: '*' },
      { name: 'Sales', description: 'CRM, quotations and customer follow-up', permissions: { dashboard: V, crm: CRUD, sales: [...CRUD, 'approve', 'export'], properties: CE, mandates: CE, transactions: CE, hr: CE, documents: CE, support: CE, projects: CRUD, reports: VE, masters: V } },
      { name: 'Operations', description: 'Deals, leases, transactions and properties', permissions: { dashboard: V, crm: V, sales: CRUD, leases: CRUD, transactions: CRUD, properties: CRUD, mandates: CRUD, hr: CE, compliance: V, documents: CRUD, support: CE, projects: CRUD, reports: VE, masters: V } },
      { name: 'Accounts', description: 'Invoicing, bills, banking and financial reports', permissions: { dashboard: V, crm: V, sales: V, finance: [...CRUD, 'approve'], documents: CE, reports: VE, masters: CE, hr: V, leases: CRUD } },
      { name: 'Property Mgmt', description: 'Leases, maintenance and inspections', permissions: { dashboard: V, sales: V, leases: CRUD, documents: CE, projects: CE, masters: V } },
      { name: 'HR', description: 'Employees, leave, attendance and payroll', permissions: { dashboard: V, hr: [...CRUD, 'approve'], documents: CE, projects: CE, masters: V } },
      { name: 'Viewer', description: 'Read-only access to business modules', permissions: { dashboard: V, crm: V, sales: V, leases: V, transactions: V, properties: V, finance: V, support: V, projects: V, documents: V, reports: V } },
      { name: 'Customer Portal', description: 'External customers — own deals, invoices and documents only', permissions: { dashboard: V, crm: V, sales: V, finance: V, leases: V, mandates: V, transactions: V, documents: V, support: ['view', 'create'] } },
    ]
    for (const r of roles) mk('roles', { name: r.name, description: r.description, is_system: r.system || false, permissions: r.permissions })
    q.run(`UPDATE roles SET is_system = 1 WHERE name IN ('Admin','Manager')`)
    mark('roles')
  }
  if (withUsers && !done('users')) {
    const a = config.accounts
    const dxb = idOf('branches', 'code', 'DXB')
    for (const [email, name, pw, role] of [[a.adminEmail, a.adminName, a.adminPassword, 'Admin'], [a.managerEmail, a.managerName, a.managerPassword, 'Manager']] as const) {
      if (idOf('users', 'lower(email)', email)) continue
      if (role === 'Admin' ? a.adminPasswordGenerated : a.managerPasswordGenerated) console.warn(`[first start] ${role} account ${email} created with a generated one-time password: ${pw}\n  Sign in and change it now (set ADMIN_PASSWORD / MANAGER_PASSWORD to choose your own).`)
      mk('users', { name, email, password: pw, role_id: idOf('roles', 'name', role), branch_id: dxb, department_id: idOf('departments', 'code', role === 'Admin' ? 'MGT' : 'OPS'), active: true, must_change_password: true })
    }
    mark('users')
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
      ['ARANCHES', 'Arabian Ranches', 'Dubai', 'Dubai', 'Emaar Properties', 1950, 240000],
      ['SZR', 'Sheikh Zayed Road', 'Dubai', 'Dubai', 'Meraas', 1920, 140000],
      ['DIFC', 'DIFC', 'Dubai', 'Dubai', 'DIFC Authority', 3100, 210000],
    ] as const) {
      mk('communities', { code, name, emirate, area, master_developer, avg_price_sqft, avg_rent_annual, active: true })
    }
    mark('communities')
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
  syncStudioLibrary()
}
