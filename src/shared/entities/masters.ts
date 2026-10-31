import type { EntityDef } from '../types'
import { T, TA, I, N, M, P, B, E, PH, S, R, D, U } from '../dsl'

export const ACCOUNT_TYPES = ['Asset', 'Liability', 'Equity', 'Income', 'Expense']

export const masters: EntityDef[] = [
  {
    key: 'countries', label: 'Country', plural: 'Countries', module: 'masters', icon: 'Globe2', title: ['name'],
    fields: [
      T('code', 'ISO code', { required: true, unique: true, list: true, search: true, section: 'Country' }),
      T('name', 'Name', { required: true, list: true, search: true }), T('region', 'Region', { list: true }),
      T('currency', 'Currency'), T('dial_code', 'Dial code'), B('active', 'Active', { default: true }),
    ],
    defaultSort: { field: 'name', dir: 'asc' },
  },
  {
    key: 'currencies', label: 'Currency', plural: 'Currencies', module: 'masters', icon: 'Coins', title: ['code'],
    description: 'Exchange rates are expressed as units of the base currency (AED) per 1 unit of the currency. Only AED and the USD peg are pre-filled — maintain the rest in line with your bank.',
    fields: [
      T('code', 'Code', { required: true, unique: true, list: true, search: true, section: 'Currency' }), T('name', 'Name', { required: true, list: true }), T('symbol', 'Symbol'),
      N('rate', 'Rate to AED', { list: true, help: 'AED per 1 unit' }), D('rate_date', 'Rate date', { list: true }), I('decimals', 'Decimals', { default: 2 }), B('active', 'Active', { default: true, list: true }),
    ],
  },
  {
    key: 'exchange_rates', label: 'Exchange rate', plural: 'Exchange-rate history', module: 'masters', icon: 'LineChart', title: ['currency', 'rate_date'],
    fields: [
      T('currency', 'Currency code', { required: true, list: true, section: 'Rate' }), D('rate_date', 'Date', { required: true, default: 'today', list: true }),
      N('rate', 'AED per unit', { required: true, list: true }), T('source', 'Source', { list: true }),
    ],
    defaultSort: { field: 'rate_date', dir: 'desc' },
  },
  {
    key: 'vat_codes', label: 'Tax code', plural: 'VAT / tax codes', module: 'masters', icon: 'Percent', title: ['code', 'name'], titleSep: ' – ',
    description: 'Review the treatment of each code with your tax adviser. UAE VAT standard rate is 5%; qualifying residential rents are exempt and supplied commission services are taxable.',
    fields: [
      T('code', 'Code', { required: true, unique: true, list: true, search: true, section: 'Tax code' }), T('name', 'Name', { required: true, list: true }),
      P('rate', 'Rate %', { required: true, list: true }), S('category', 'Category', ['Standard rated', 'Zero rated', 'Exempt', 'Out of scope', 'Reverse charge'], { list: true }),
      B('active', 'Active', { default: true }),
    ],
  },
  {
    key: 'charge_codes', label: 'Service item', plural: 'Service items', module: 'masters', icon: 'Receipt', title: ['code', 'name'], titleSep: ' – ',
    fields: [
      T('code', 'Code', { required: true, unique: true, list: true, search: true, section: 'Service item' }), T('name', 'Item name', { required: true, list: true, search: true }),
      S('applies_to', 'Applies to', ['Revenue & cost', 'Revenue only', 'Cost only'], { default: 'Revenue & cost', list: true }),
      S('group', 'Print group', ['Commission', 'Professional fees', 'Marketing', 'Property management', 'Government & disbursements', 'Documentation', 'Other'], { list: true, default: 'Commission' }),
      M('default_rate', 'Default sell rate'), R('vat_code_id', 'Default tax code', 'vat_codes', { list: true }),
      R('income_account_id', 'Income account', 'accounts'), R('cost_account_id', 'Cost account', 'accounts'), B('active', 'Active', { default: true }),
    ],
  },
  {
    key: 'payment_terms', label: 'Payment term', plural: 'Payment terms', module: 'masters', icon: 'CalendarClock', title: ['name'],
    fields: [T('name', 'Name', { required: true, unique: true, list: true, section: 'Term' }), I('days', 'Due in (days)', { required: true, list: true }), T('description', 'Description', { span: 2 }), B('active', 'Active', { default: true })],
  },
]
