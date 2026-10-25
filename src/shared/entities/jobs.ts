import type { EntityDef } from '../types'
import { T, TA, I, N, M, P, B, S, R, D, DT, J } from '../dsl'

const DEAL_STATUS = ['Lead', 'Active Mandate', 'Offer Submitted', 'Offer Accepted', 'Contract Signed', 'DLD Submitted', 'DLD Approved', 'Title Deed Issued', 'Completed', 'Cancelled', 'On Hold']
const DEAL_TYPES = ['Sale', 'Lease', 'Off-Plan Sale', 'Commercial Lease', 'Staff Housing', 'Bulk Deal']

export const jobs: EntityDef[] = [
  {
    key: 'jobs', label: 'Deal File', plural: 'Deal Files', module: 'sales', icon: 'FileSignature',
    title: ['job_no', 'deal_name'], titleSep: ' – ',
    numbering: { field: 'job_no', pattern: 'DL-{YY}{seq:5}' },
    panel: true, statusField: 'job_status', customFields: true, print: 'deal_file',
    children: [
      { key: 'charges', label: 'Charges', entity: 'job_charges', fk: 'job_id', columns: ['kind', 'charge_code_id', 'description', 'party_id', 'qty', 'rate', 'currency', 'ex_rate', 'vat_code_id', 'amount', 'status'] },
      { key: 'events', label: 'Timeline', entity: 'job_events', fk: 'job_id', columns: ['event_at', 'event_type', 'description', 'user_id'] },
    ],
    fields: [
      T('job_no', 'Deal No.', { readonly: true, list: true, search: true, section: 'Deal', key: true }),
      T('deal_name', 'Deal Name', { required: true, list: true, search: true, span: 2 }),
      S('deal_type', 'Deal Type', DEAL_TYPES, { required: true, list: true }),
      S('job_status', 'Status', DEAL_STATUS, { default: 'Lead', list: true, key: true }),
      R('branch_id', 'Branch', 'branches', { required: true, list: true }),
      R('property_id', 'Property', 'properties', { list: true, search: true }),
      R('unit_id', 'Unit', 'units', { list: true }),
      R('client_id', 'Client (Buyer/Tenant)', 'parties', { refFilter: { is_customer: 1 }, list: true, search: true, key: true }),
      R('owner_id', 'Owner/Landlord', 'parties', { list: true }),
      R('agent_id', 'Listing Agent', 'agents', { list: true }),
      R('buyer_agent_id', 'Buyer Agent', 'agents', { list: true }),
      D('deal_date', 'Deal Date', { required: true, default: 'today', list: true }),
      M('deal_value', 'Deal Value', { list: true }),
      P('commission_pct', 'Commission %', { min: 0, max: 10, list: true }),
      M('commission_amount', 'Commission (AED)', { computed: true, list: true }),
      D('target_close', 'Target Close Date', { list: true }),
      D('actual_close', 'Actual Close Date', { list: true }),
      S('operational_status', 'Stage', ['Inquiry', 'Viewing', 'Offer', 'Negotiation', 'Contract', 'DLD Process', 'Handover', 'Closed'], { section: 'Pipeline', list: true, key: true }),
      M('total_revenue', 'Revenue (AED)', { computed: true, key: true }), M('total_cost', 'Cost (AED)', { computed: true, key: true }), M('profit', 'Profit (AED)', { computed: true, key: true }),
      R('sales_contract_id', 'Sales Contract', 'sales_contracts'),
      R('lease_id', 'Lease', 'leases'),
      R('mandate_id', 'Mandate', 'mandates'),
      TA('notes', 'Internal Notes', { span: 3 }),
    ],
    defaultSort: { field: 'deal_date', dir: 'desc' },
    calendar: { field: 'target_close' },
  },
]
