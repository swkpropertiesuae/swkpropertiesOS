// Reference data. Only identifiers / structure — no commercial figures.

export const ISO_COUNTRIES = 'AF AL DZ AS AD AO AI AQ AG AR AM AW AU AT AZ BS BH BD BB BY BE BZ BJ BM BT BO BA BW BV BR IO BN BG BF BI KH CM CA CV KY CF TD CL CN CX CC CO KM CG CD CK CR CI HR CU CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FK FO FJ FI FR GF PF GA GM GE DE GH GI GR GL GD GP GU GT GG GN GW GY HT HN HK HU IS IN ID IR IQ IE IM IL IT JM JP JE JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MS MA MZ MM NA NR NP NL NC NZ NI NE NG NU NF MK MP NO OM PK PW PS PA PG PY PE PH PN PL PT PR QA RE RO RU RW SH KN LC PM VC WS SM ST SA SN RS SC SL SG SK SI SB SO ZA SS ES LK SD SR SE CH SY TW TJ TZ TH TL TG TK TO TT TN TR TM TC TV UG UA AE GB US UY UZ VU VE VN VG VI WF EH YE ZM ZW'.split(' ')

const R = (codes: string) => new Set(codes.split(' '))
export const REGIONS: [string, Set<string>][] = [
  ['GCC & Middle East', R('AE SA OM QA KW BH IQ IR JO LB SY YE IL PS TR')],
  ['Indian Subcontinent', R('IN PK BD LK NP BT MV AF')],
  ['Far East & Asia', R('CN HK TW JP KR KP SG MY TH VN ID PH MM KH LA BN MN MO TL KZ UZ TM KG TJ AZ AM GE')],
  ['Europe', R('GB IE FR DE NL BE LU ES PT IT GR MT CH AT DK SE NO FI IS PL CZ SK HU RO BG HR SI RS BA ME MK AL EE LV LT UA BY MD RU CY AD MC SM LI')],
  ['Africa', R('ZA KE TZ UG ET DJ SO SD SS ER EG LY TN DZ MA NG GH CI SN ML MR GM GN GW SL LR TG BJ BF NE TD CM CF CG CD GA GQ AO ZM ZW MZ MW NA BW LS SZ MG MU SC KM RW BI CV ST')],
  ['Americas', R('US CA MX BR AR CL CO PE VE EC UY PY BO PA CR GT HN SV NI CU DO JM TT BS BB HT')],
  ['Oceania', R('AU NZ FJ PG WS TO VU SB')],
]
export const CURRENCY_BY_COUNTRY: Record<string, string> = { AE: 'AED', SA: 'SAR', QA: 'QAR', KW: 'KWD', OM: 'OMR', BH: 'BHD', US: 'USD', GB: 'GBP', IN: 'INR', PK: 'PKR', CN: 'CNY', ZA: 'ZAR', KE: 'KES', DE: 'EUR', FR: 'EUR', NL: 'EUR', IT: 'EUR', ES: 'EUR', BE: 'EUR', JP: 'JPY' }

export const CURRENCIES: [string, string, string][] = [
  ['AED', 'UAE Dirham', 'د.إ'], ['USD', 'US Dollar', '$'], ['EUR', 'Euro', '€'], ['GBP', 'Pound Sterling', '£'], ['SAR', 'Saudi Riyal', '﷼'], ['QAR', 'Qatari Riyal', ''], ['KWD', 'Kuwaiti Dinar', ''], ['OMR', 'Omani Rial', ''], ['BHD', 'Bahraini Dinar', ''],
  ['INR', 'Indian Rupee', '₹'], ['PKR', 'Pakistani Rupee', ''], ['CNY', 'Chinese Yuan', '¥'], ['JPY', 'Japanese Yen', '¥'], ['ZAR', 'South African Rand', 'R'], ['KES', 'Kenyan Shilling', ''],
]


export const VAT_CODES: [string, string, number, string][] = [
  ['SR', 'Standard rated 5%', 5, 'Standard rated'], ['ZR', 'Zero rated (qualifying exports of services)', 0, 'Zero rated'], ['ES', 'Exempt', 0, 'Exempt'], ['OS', 'Out of scope / disbursement', 0, 'Out of scope'], ['RC', 'Reverse charge 5%', 5, 'Reverse charge'],
]

export const PAYMENT_TERMS: [string, number][] = [['Immediate / advance', 0], ['Net 7 days', 7], ['Net 15 days', 15], ['Net 30 days', 30], ['Net 45 days', 45], ['Net 60 days', 60], ['Net 90 days', 90]]

// code, name, type, subtype, role
export const ACCOUNTS: [string, string, string, string, string?][] = [
  ['1000', 'Cash in hand', 'Asset', 'Cash'], ['1010', 'Petty cash', 'Asset', 'Cash'], ['1100', 'Main operating account – AED', 'Asset', 'Bank'], ['1110', 'USD account', 'Asset', 'Bank'],
  ['1200', 'Accounts receivable', 'Asset', 'Accounts receivable', 'ar_control'], ['1210', 'Employee advances', 'Asset', 'Current asset'], ['1250', 'VAT receivable (input VAT)', 'Asset', 'VAT receivable (input)', 'vat_input'],
  ['1300', 'Prepayments & deposits', 'Asset', 'Current asset'], ['1500', 'Vehicles', 'Asset', 'Fixed asset'], ['1510', 'Office fit-out & equipment', 'Asset', 'Fixed asset'], ['1520', 'Furniture, IT & office equipment', 'Asset', 'Fixed asset'], ['1590', 'Accumulated depreciation', 'Asset', 'Accumulated depreciation'],
  ['2000', 'Accounts payable', 'Liability', 'Accounts payable', 'ap_control'], ['2100', 'VAT payable (output VAT)', 'Liability', 'VAT payable (output)', 'vat_output'], ['2200', 'Accrued expenses', 'Liability', 'Current liability'], ['2210', 'Employee payables', 'Liability', 'Current liability', 'employee_payable'],
  ['2300', 'Customer deposits', 'Liability', 'Current liability'], ['2500', 'Bank loans', 'Liability', 'Long-term liability'],
  ['3000', 'Share capital', 'Equity', 'Capital'], ['3100', 'Retained earnings', 'Equity', 'Retained earnings', 'retained_earnings'], ['3200', "Owners' current account", 'Equity', 'Capital'], ['3900', 'Opening balance equity', 'Equity', 'Capital', 'opening_balance'],
  ['4000', 'Commission revenue – sales', 'Income', 'Operating revenue', 'default_revenue'], ['4100', 'Commission revenue – leasing', 'Income', 'Operating revenue'], ['4200', 'Valuation & professional fees', 'Income', 'Operating revenue'], ['4300', 'Property management fees', 'Income', 'Operating revenue'],
  ['4400', 'Marketing & listing services', 'Income', 'Operating revenue'], ['4800', 'DLD & Ejari recoveries', 'Income', 'Operating revenue'], ['4900', 'Other income', 'Income', 'Other income'],
  ['5000', 'Co-broker & referral commissions', 'Expense', 'Direct cost'], ['5100', 'Listing & developer direct costs', 'Expense', 'Direct cost', 'default_cost'], ['5200', 'Government fees & disbursements paid', 'Expense', 'Direct cost'], ['5300', 'Photography & media cost', 'Expense', 'Direct cost'],
  ['5400', 'Advertising & marketing cost', 'Expense', 'Direct cost'], ['5800', 'Disbursements paid', 'Expense', 'Direct cost'], ['5900', 'Other direct cost', 'Expense', 'Direct cost'],
  ['6000', 'Salaries & wages', 'Expense', 'Payroll'], ['6010', 'Staff benefits, visas & medical', 'Expense', 'Payroll'], ['6100', 'Rent', 'Expense', 'Operating expense'], ['6200', 'Utilities & communication', 'Expense', 'Operating expense'], ['6300', 'Vehicle running costs', 'Expense', 'Operating expense'],
  ['6400', 'Depreciation', 'Expense', 'Operating expense'], ['6500', 'Professional & legal fees', 'Expense', 'Operating expense'], ['6600', 'Marketing & business development', 'Expense', 'Operating expense'], ['6700', 'Bank charges', 'Expense', 'Operating expense'],
  ['6800', 'Insurance', 'Expense', 'Operating expense'], ['6900', 'Miscellaneous expense', 'Expense', 'Operating expense'], ['7000', 'Interest expense', 'Expense', 'Operating expense'], ['7900', 'Exchange gain / (loss)', 'Expense', 'FX gain / loss', 'fx_gain_loss'], ['7910', 'Rounding differences', 'Expense', 'Operating expense', 'rounding'],
]

// code, name, applies_to, group, vat, income acct, cost acct
export const CHARGE_CODES: [string, string, string, string, string, string, string][] = [
  ['COMM-SALE', 'Sales commission', 'Revenue & cost', 'Commission', 'SR', '4000', '5000'], ['COMM-LEASE', 'Leasing commission', 'Revenue & cost', 'Commission', 'SR', '4100', '5000'],
  ['COMM-PM', 'Property management fee', 'Revenue & cost', 'Commission', 'SR', '4300', '5000'], ['AGENT-RFL', 'Agent referral share', 'Cost only', 'Commission', 'SR', '4900', '5000'],
  ['VAL-MKT', 'Valuation – market opinion', 'Revenue only', 'Professional fees', 'SR', '4200', '5900'], ['VAL-BANK', 'Bank / mortgage valuation support', 'Revenue only', 'Professional fees', 'SR', '4200', '5900'],
  ['MKT-PKG', 'Listing marketing package', 'Revenue & cost', 'Marketing', 'SR', '4400', '5400'], ['MKT-PHOTO', 'Photography, video & media', 'Revenue & cost', 'Marketing', 'SR', '4400', '5300'],
  ['GOV-DLD', 'DLD transfer fee (recovery)', 'Revenue & cost', 'Government & disbursements', 'OS', '4800', '5200'], ['GOV-EJARI', 'Ejari registration (recovery)', 'Revenue & cost', 'Government & disbursements', 'OS', '4800', '5200'],
  ['NOC-ADM', 'NOC / handover administration', 'Revenue only', 'Documentation', 'SR', '4200', '5900'], ['DOC-FEE', 'Contract & documentation fee', 'Revenue only', 'Documentation', 'SR', '4200', '5900'],
  ['SRV-INSP', 'Move-in / move-out inspection', 'Revenue & cost', 'Property management', 'SR', '4300', '5900'], ['SRV-MAIN', 'Maintenance works (recovery)', 'Revenue & cost', 'Property management', 'SR', '4300', '5200'],
  ['SVC-OTHER', 'Other real-estate service fee', 'Revenue & cost', 'Other', 'SR', '4900', '5900'],
]

export interface RoleSeed { name: string; description: string; system?: boolean; permissions: '*' | Record<string, string[]> }
  // export const ROLES: RoleSeed[] = (() => {
  //   const V = ['view'], VE = ['view', 'export'], CRUD = ['view', 'create', 'edit', 'delete', 'export'], CE = ['view', 'create', 'edit', 'export']
  //   //   const list: RoleSeed[] = [
  //   //     { name: 'Admin', description: 'Full system access, including administration', system: true, permissions: '*' },
  //   //     { name: 'Manager', description: 'Full access to every module', system: true, permissions: '*' },
  //   //     { name: 'Sales', description: 'CRM, quotations and customer follow-up', permissions: { dashboard: V, crm: CRUD, sales: [...CRUD, 'approve', 'export'], documents: CE, support: CE, projects: CRUD, reports: VE, masters: V } },
  //   //     { name: 'Operations', description: 'Jobs, shipments, customs, transport and warehouse', permissions: { dashboard: V, crm: V, sales: CRUD, leases: CRUD, transactions: CRUD, properties: CRUD, documents: CRUD, support: CE, projects: CRUD, reports: VE, masters: V } },
  //   //     { name: 'Accounts', description: 'Invoicing, bills, banking and financial reports', permissions: { dashboard: V, crm: V, sales: V, finance: [...CRUD, 'approve'], documents: CE, reports: VE, masters: CE, hr: V, leases: CRUD } },
  //   //     { name: 'Warehouse', description: 'Warehouse stock, receipts and dispatch', permissions: { dashboard: V, sales: V, properties: CRUD, transactions: CE, documents: CE, projects: CE, masters: V } },
  //   //     { name: 'HR', description: 'Employees, leave, attendance and payroll', permissions: { dashboard: V, hr: [...CRUD, 'approve'], documents: CE, projects: CE, masters: V } },
  //   //     { name: 'Viewer', description: 'Read-only access to business modules', permissions: { dashboard: V, crm: V, sales: V, leases: V, transactions: V, properties: V, finance: V, support: V, projects: V, documents: V, reports: V } },
  //   //     { name: 'Customer Portal', description: 'External customers — own jobs, invoices and quotations only', permissions: { dashboard: V, sales: V, finance: V, documents: V, support: ['view', 'create'] } },
  //   //   ]
  //   //   return list
  //   // })()
