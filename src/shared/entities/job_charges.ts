import type { EntityDef } from '../types'
import { T, TA, I, N, M, P, B, S, R, D, DT } from '../dsl'

const CHARGE_KINDS = ['Revenue', 'Cost']

export const job_charges: EntityDef[] = [
  {
    key: 'job_charges', label: 'Deal Charge', plural: 'Deal Charges', module: 'sales', icon: 'ReceiptText',
    title: ['kind', 'charge_code_id', 'description'], titleSep: ' – ', child: true,
    fields: [
      R('job_id', 'Deal File', 'jobs', { hidden: true, required: true }),
      S('kind', 'Kind', CHARGE_KINDS, { required: true, list: true }),
      R('charge_code_id', 'Charge Code', 'charge_codes', { required: true, list: true }),
      T('description', 'Description', { list: true }),
      R('party_id', 'Party', 'parties', { list: true }),
      S('basis', 'Basis', ['CNT', 'KG', 'CBM', 'PER', 'LBL', 'BL', 'DOC', 'DAY', 'HR', 'MTH', 'Flat'], { list: true }),
      N('qty', 'Qty', { default: 1, min: 0, list: true }),
      M('rate', 'Rate', { list: true }),
      S('currency', 'Currency', ['AED', 'USD', 'EUR', 'GBP', 'SAR'], { default: 'AED', list: true }),
      N('ex_rate', 'Exchange Rate', { default: 1, list: true }),
      R('vat_code_id', 'VAT', 'vat_codes'),
      M('amount', 'Amount', { computed: true, list: true }),
      M('vat_amount', 'VAT', { computed: true }),
      M('base_amount', 'Base Amount (AED)', { computed: true, list: true }),
      S('status', 'Status', ['Unbilled', 'Invoiced', 'Billed', 'Voided'], { default: 'Unbilled', list: true }),
      R('account_id', 'GL Account', 'accounts'),
      R('property_id', 'Property', 'properties'),
      R('unit_id', 'Unit', 'units'),
      R('lease_id', 'Lease', 'leases'),
      TA('notes', 'Notes'),
    ],
    defaultSort: { field: 'id', dir: 'asc' },
  },
]
