import type { EntityDef } from '../types'
import { T, TA, I, N, M, P, B, S, R, D, DT } from '../dsl'
import { ACCOUNT_TYPES } from './masters'

const CUR = ['AED', 'USD', 'EUR', 'GBP', 'SAR', 'INR', 'CNY', 'ZAR']
const PAY_METHODS = ['Bank transfer', 'Cheque', 'Cash', 'Card', 'Online / gateway', 'Set-off']

export const finance: EntityDef[] = [
  {
    key: 'accounts', label: 'Account', plural: 'Chart of accounts', module: 'finance', icon: 'BookOpenText', title: ['code', 'name'], titleSep: ' – ',
    fields: [
      T('code', 'Account code', { required: true, unique: true, list: true, search: true, section: 'Account' }), T('name', 'Account name', { required: true, list: true, search: true, span: 2 }),
      S('type', 'Type', ACCOUNT_TYPES, { required: true, list: true }),
      S('subtype', 'Sub-type', ['Bank', 'Cash', 'Accounts receivable', 'Accounts payable', 'Current asset', 'Fixed asset', 'Accumulated depreciation', 'VAT receivable (input)', 'VAT payable (output)', 'Current liability', 'Long-term liability', 'Capital', 'Retained earnings', 'Operating revenue', 'Other income', 'Direct cost', 'Operating expense', 'FX gain / loss', 'Payroll', 'Commission payable', 'Security deposits held'], { list: true }),
      S('role', 'System role', ['', 'ar_control', 'ap_control', 'vat_output', 'vat_input', 'retained_earnings', 'fx_gain_loss', 'employee_payable', 'default_revenue', 'default_cost', 'opening_balance', 'rounding', 'security_deposit_held', 'commission_payable'], { help: 'Accounts used automatically by posting rules' }),
      R('parent_id', 'Parent account', 'accounts'), B('active', 'Active', { default: true, list: true }), TA('description', 'Description'),
    ],
    defaultSort: { field: 'code', dir: 'asc' },
  },
  {
    key: 'journal_entries', label: 'Journal entry', plural: 'Journal entries', module: 'finance', icon: 'NotebookPen', title: ['entry_no'], panel: true, statusField: 'status', noDelete: true,
    numbering: { field: 'entry_no', pattern: 'JV{YY}{seq:6}' },
    children: [{ key: 'lines', label: 'Lines', entity: 'journal_lines', fk: 'entry_id' }],
    fields: [
      T('entry_no', 'Entry no.', { readonly: true, list: true, search: true, section: 'Journal' }), D('entry_date', 'Date', { required: true, default: 'today', list: true }), R('branch_id', 'Branch', 'branches'),
      T('memo', 'Narration', { list: true, search: true, span: 2 }), S('status', 'Status', ['Posted', 'Reversed'], { default: 'Posted', list: true, readonly: true }), T('source_type', 'Source', { readonly: true, list: true }),
      I('source_id', 'Source id', { readonly: true, hidden: true }), T('source_no', 'Source no.', { readonly: true, list: true }), M('total_debit', 'Total debit', { computed: true, list: true }), M('total_credit', 'Total credit', { computed: true }),
      I('reversal_of', 'Reversal of', { readonly: true, hidden: true }), R('legal_entity_id', 'Legal entity', 'legal_entities', { readonly: true, list: true }),
    ],
    defaultSort: { field: 'id', dir: 'desc' },
  },
  {
    key: 'journal_lines', label: 'Journal line', plural: 'Journal lines', module: 'finance', icon: 'List', title: ['id'], child: true,
    fields: [
      R('entry_id', 'Entry', 'journal_entries', { hidden: true }), R('account_id', 'Account', 'accounts', { required: true, list: true }), R('party_id', 'Party', 'parties'), R('property_id', 'Property', 'properties'), R('unit_id', 'Unit', 'units'), R('lease_id', 'Lease', 'leases'),
      T('description', 'Description'), M('debit', 'Debit', { list: true }), M('credit', 'Credit', { list: true }),
    ],
  },
  {
    key: 'invoices', label: 'Invoice', plural: 'Invoices & notes', module: 'finance', icon: 'ReceiptText', title: ['invoice_no'], panel: true, statusField: 'status', print: 'invoice', noDelete: true, customFields: true,
    numbering: { field: 'invoice_no', pattern: '{prefix}{YY}{seq:5}' },
    children: [{ key: 'lines', label: 'Invoice lines', entity: 'invoice_lines', fk: 'invoice_id', columns: ['charge_code_id', 'description', 'qty', 'rate', 'line_ccy', 'line_roe', 'vat_code_id', 'amount'] }],
    fields: [
      T('invoice_no', 'Document no.', { readonly: true, list: true, search: true, section: 'Document' }), S('doc_type', 'Document type', ['Tax Invoice', 'Proforma Invoice', 'Debit Note', 'Credit Note'], { required: true, default: 'Tax Invoice', list: true }),
      R('party_id', 'Customer', 'parties', { required: true, refFilter: { is_customer: 1 }, list: true }), R('property_id', 'Property', 'properties', { list: true }), R('unit_id', 'Unit', 'units', { list: true }), R('lease_id', 'Lease', 'leases', { list: true }),
      D('invoice_date', 'Invoice date', { required: true, default: 'today', list: true }), D('supply_date', 'Date of supply', { help: 'If different from the invoice date. A tax invoice must be issued within 14 days of supply.' }), D('due_date', 'Due date', { list: true }), R('payment_term_id', 'Payment term', 'payment_terms'), R('branch_id', 'Branch', 'branches', { list: true }),
      S('currency', 'Currency', CUR, { default: 'AED', required: true, list: true }), N('ex_rate', 'Exchange rate to AED', { default: 1 }), T('reference', 'Customer reference / PO'), T('credit_reason', 'Reason for credit / debit note', { help: 'Required on credit notes' }), R('original_invoice_id', 'Against invoice', 'invoices', { help: 'For credit / debit notes' }),
      S('status', 'Status', ['Draft', 'Posted', 'Partially paid', 'Paid', 'Void'], { default: 'Draft', list: true, readonly: true }),
      M('subtotal', 'Subtotal', { computed: true }), M('vat_total', 'VAT', { computed: true }), M('total', 'Total', { computed: true, list: true }), M('paid_amount', 'Paid', { computed: true }), M('balance', 'Balance', { computed: true, list: true }), M('base_total', 'Total (AED)', { computed: true }),
      R('bank_account_id', 'Remit to bank account', 'bank_accounts'), R('journal_id', 'Journal', 'journal_entries', { readonly: true }), T('void_reason', 'Void reason', { readonly: true }),
      S('einvoice_status', 'E-invoice', ['', 'Not sent', 'Submitted', 'Accepted', 'Rejected'], { readonly: true, list: false }), T('einvoice_ref', 'E-invoice reference', { readonly: true }), DT('einvoice_at', 'E-invoice sent at', { readonly: true }),
      TA('notes', 'Notes to customer'), TA('terms', 'Terms'),
      T('custom_no', 'Own invoice number', { section: 'Numbering & rounding', help: 'Optional. Type the number exactly as it should print (for example DXB/INV/103A). Leave blank to use the next number in the series when the invoice is posted.' }),
      S('round_total', 'Rounding', ['No rounding', 'Round total to whole amount'], { default: 'No rounding' }), M('rounding', 'Rounding adjustment', { computed: true }),
    ],
    defaultSort: { field: 'id', dir: 'desc' },
  },
  {
    key: 'invoice_lines', label: 'Invoice line', plural: 'Invoice lines', module: 'finance', icon: 'List', title: ['description'], child: true,
    fields: [
      R('invoice_id', 'Invoice', 'invoices', { hidden: true }), R('charge_code_id', 'Charge', 'charge_codes'), T('description', 'Description'), T('unit', 'Unit'), N('qty', 'Qty', { default: 1 }), M('rate', 'Rate'),
      S('line_ccy', 'Priced in', ['', ...CUR], { help: 'Leave blank when the rate is already in the invoice currency. Choose USD (for example) to price this line in USD and bill it in the invoice currency at the rate of exchange.' }), N('line_roe', 'ROE', { help: 'Rate of exchange to the invoice currency, up to 6 decimals (for example 3.685).' }),
      R('vat_code_id', 'Tax', 'vat_codes'), P('vat_pct', 'VAT %', { hidden: true }), M('amount', 'Amount', { computed: true }), M('vat_amount', 'VAT', { computed: true, hidden: true }), M('line_total', 'Total', { computed: true, hidden: true }),
      R('account_id', 'Revenue account', 'accounts', { hidden: true }), R('property_id', 'Property', 'properties', { hidden: true }), R('unit_id', 'Unit', 'units', { hidden: true }), R('lease_id', 'Lease', 'leases', { hidden: true }),
    ],
  },
  {
    key: 'bills', label: 'Vendor bill', plural: 'Vendor bills', module: 'finance', icon: 'FileInput', title: ['bill_no'], panel: true, statusField: 'status', noDelete: true, customFields: true,
    numbering: { field: 'bill_no', pattern: 'BILL{YY}{seq:5}' },
    children: [{ key: 'lines', label: 'Bill lines', entity: 'bill_lines', fk: 'bill_id', columns: ['charge_code_id', 'description', 'qty', 'rate', 'vat_code_id', 'amount'] }],
    fields: [
      T('bill_no', 'Bill no.', { readonly: true, list: true, search: true, section: 'Bill' }), R('vendor_id', 'Vendor', 'parties', { required: true, refFilter: { is_vendor: 1 }, list: true }), T('vendor_invoice_no', 'Vendor invoice no.', { required: true, list: true, search: true }),
      R('property_id', 'Property', 'properties', { list: true }), R('unit_id', 'Unit', 'units', { list: true }), R('lease_id', 'Lease', 'leases', { list: true }),
      D('bill_date', 'Bill date', { required: true, default: 'today', list: true }), D('due_date', 'Due date', { list: true }), R('payment_term_id', 'Payment term', 'payment_terms'),
      S('currency', 'Currency', CUR, { default: 'AED', required: true, list: true }), N('ex_rate', 'Exchange rate to AED', { default: 1 }), R('branch_id', 'Branch', 'branches', { list: true }),
      S('status', 'Status', ['Draft', 'Posted', 'Partially paid', 'Paid', 'Void'], { default: 'Draft', list: true, readonly: true }),
      M('subtotal', 'Subtotal', { computed: true }), M('vat_total', 'VAT', { computed: true }), M('total', 'Total', { computed: true, list: true }), M('paid_amount', 'Paid', { computed: true }), M('balance', 'Balance', { computed: true, list: true }), M('base_total', 'Total (AED)', { computed: true }),
      S('approval_status', 'Approval', ['Not required', 'Pending', 'Approved', 'Rejected'], { default: 'Not required', readonly: true }),
      R('journal_id', 'Journal', 'journal_entries', { readonly: true }), T('void_reason', 'Void reason', { readonly: true }), TA('notes', 'Notes'),
    ],
    defaultSort: { field: 'id', dir: 'desc' },
  },
  {
    key: 'bill_lines', label: 'Bill line', plural: 'Bill lines', module: 'finance', icon: 'List', title: ['description'], child: true,
    fields: [
      R('bill_id', 'Bill', 'bills', { hidden: true }), R('charge_code_id', 'Charge', 'charge_codes'), T('description', 'Description'), N('qty', 'Qty', { default: 1 }), M('rate', 'Rate'),
      R('vat_code_id', 'Tax', 'vat_codes'), P('vat_pct', 'VAT %', { hidden: true }), M('amount', 'Amount', { computed: true }), M('vat_amount', 'VAT', { computed: true, hidden: true }), M('line_total', 'Total', { computed: true, hidden: true }),
      R('account_id', 'Expense account', 'accounts', { hidden: false }), R('property_id', 'Property', 'properties', { hidden: true }), R('unit_id', 'Unit', 'units', { hidden: true }), R('lease_id', 'Lease', 'leases', { hidden: true }),
    ],
  },
  {
    key: 'receipts', label: 'Receipt', plural: 'Customer receipts', module: 'finance', icon: 'HandCoins', title: ['receipt_no'], panel: true, statusField: 'status', print: 'receipt', noDelete: true,
    numbering: { field: 'receipt_no', pattern: 'RCT{YY}{seq:5}' },
    children: [{ key: 'allocations', label: 'Allocated to invoices', entity: 'receipt_allocations', fk: 'receipt_id' }],
    fields: [
      T('receipt_no', 'Receipt no.', { readonly: true, list: true, search: true, section: 'Receipt' }), R('party_id', 'Customer', 'parties', { required: true, refFilter: { is_customer: 1 }, list: true }), D('receipt_date', 'Date', { required: true, default: 'today', list: true }),
      S('method', 'Method', PAY_METHODS, { default: 'Bank transfer', list: true }), R('bank_account_id', 'Deposit to', 'bank_accounts', { required: true, list: true }), S('currency', 'Currency', CUR, { default: 'AED' }), N('ex_rate', 'Exchange rate to AED', { default: 1 }),
      M('amount', 'Amount received', { required: true, list: true }), M('allocated', 'Allocated', { computed: true }), M('unallocated', 'Unallocated (on account)', { computed: true, list: true }), T('reference', 'Reference / cheque no.', { list: true }),
      S('status', 'Status', ['Draft', 'Posted', 'Void'], { default: 'Draft', list: true, readonly: true }), R('journal_id', 'Journal', 'journal_entries', { readonly: true }), TA('notes', 'Notes'),
    ],
    defaultSort: { field: 'id', dir: 'desc' },
  },
  {
    key: 'receipt_allocations', label: 'Allocation', plural: 'Receipt allocations', module: 'finance', icon: 'List', title: ['id'], child: true,
    fields: [R('receipt_id', 'Receipt', 'receipts', { hidden: true }), R('invoice_id', 'Invoice', 'invoices', { required: true }), M('amount', 'Amount', { required: true })],
  },
  {
    key: 'payments', label: 'Payment', plural: 'Vendor payments', module: 'finance', icon: 'Banknote', title: ['payment_no'], panel: true, statusField: 'status', print: 'payment', noDelete: true,
    numbering: { field: 'payment_no', pattern: 'PAY{YY}{seq:5}' },
    children: [{ key: 'allocations', label: 'Allocated to bills', entity: 'payment_allocations', fk: 'payment_id' }],
    fields: [
      T('payment_no', 'Payment no.', { readonly: true, list: true, search: true, section: 'Payment' }), R('vendor_id', 'Vendor', 'parties', { required: true, refFilter: { is_vendor: 1 }, list: true }), D('payment_date', 'Date', { required: true, default: 'today', list: true }),
      S('method', 'Method', PAY_METHODS, { default: 'Bank transfer', list: true }), R('bank_account_id', 'Paid from', 'bank_accounts', { required: true, list: true }), S('currency', 'Currency', CUR, { default: 'AED' }), N('ex_rate', 'Exchange rate to AED', { default: 1 }),
      M('amount', 'Amount paid', { required: true, list: true }), M('allocated', 'Allocated', { computed: true }), M('unallocated', 'Unallocated (advance)', { computed: true }), T('reference', 'Reference / cheque no.', { list: true }),
      S('status', 'Status', ['Draft', 'Posted', 'Void'], { default: 'Draft', list: true, readonly: true }), S('approval_status', 'Approval', ['Not required', 'Pending', 'Approved', 'Rejected'], { default: 'Not required', readonly: true }),
      R('journal_id', 'Journal', 'journal_entries', { readonly: true }), TA('notes', 'Notes'),
    ],
    defaultSort: { field: 'id', dir: 'desc' },
  },
  {
    key: 'payment_allocations', label: 'Allocation', plural: 'Payment allocations', module: 'finance', icon: 'List', title: ['id'], child: true,
    fields: [R('payment_id', 'Payment', 'payments', { hidden: true }), R('bill_id', 'Bill', 'bills', { required: true }), M('amount', 'Amount', { required: true })],
  },
  {
    key: 'bank_accounts', label: 'Bank account', plural: 'Bank & cash accounts', module: 'finance', icon: 'Landmark', title: ['name'],
    fields: [
      T('name', 'Account name', { required: true, list: true, search: true, section: 'Bank account' }), S('type', 'Type', ['Bank', 'Cash', 'Petty cash', 'Card / gateway'], { default: 'Bank', list: true }), T('bank_name', 'Bank', { list: true }),
      T('account_no', 'Account no.'), T('iban', 'IBAN', { list: true }), T('swift', 'SWIFT / BIC'), S('currency', 'Currency', CUR, { default: 'AED', list: true }),
      R('gl_account_id', 'GL account', 'accounts', { required: true, list: true }), M('opening_balance', 'Opening balance'), D('opening_date', 'Opening date'), B('active', 'Active', { default: true, list: true }),
    ],
  },
  {
    key: 'bank_transactions', label: 'Bank statement line', plural: 'Bank reconciliation', module: 'finance', icon: 'Scale', title: ['description'], statusField: 'status',
    description: 'Import bank statement lines (CSV) and match them to posted receipts and payments.',
    fields: [
      R('bank_account_id', 'Bank account', 'bank_accounts', { required: true, list: true, section: 'Statement line' }), D('txn_date', 'Date', { required: true, list: true }), T('description', 'Description', { list: true, search: true, span: 2 }),
      T('reference', 'Reference', { list: true, search: true }), M('debit', 'Withdrawal', { list: true }), M('credit', 'Deposit', { list: true }), T('fingerprint', 'Import key', { hidden: true }),
      S('status', 'Status', ['Unreconciled', 'Reconciled'], { default: 'Unreconciled', list: true }), T('matched_to', 'Matched to', { list: true, help: 'e.g. RCT2600012' }), D('reconciled_on', 'Reconciled on'),
    ],
    defaultSort: { field: 'txn_date', dir: 'desc' },
  },
  {
    key: 'expenses', label: 'Expense claim', plural: 'Expense claims', module: 'finance', icon: 'Wallet', title: ['expense_no'], panel: true, statusField: 'status',
    numbering: { field: 'expense_no', pattern: 'EXP{YY}{seq:5}' },
    fields: [
      T('expense_no', 'Claim no.', { readonly: true, list: true, search: true, section: 'Expense' }), R('employee_id', 'Employee', 'employees', { required: true, list: true }), D('expense_date', 'Date', { required: true, default: 'today', list: true }),
      S('category', 'Category', ['Travel', 'Fuel', 'Client entertainment', 'Meals', 'Communication', 'Office supplies', 'Courier', 'Accommodation', 'Marketing', 'Training', 'Other'], { required: true, list: true }),
      T('description', 'Description', { list: true, span: 2 }), M('amount', 'Amount', { required: true, list: true }), M('vat_amount', 'VAT included'), R('property_id', 'Property', 'properties'), R('unit_id', 'Unit', 'units'),
      R('account_id', 'Expense account', 'accounts'), S('status', 'Status', ['Draft', 'Submitted', 'Approved', 'Rejected', 'Paid'], { default: 'Draft', list: true, readonly: true }), R('approver_id', 'Approver', 'users', { readonly: true }),
      R('paid_from_id', 'Paid from', 'bank_accounts', { readonly: true }), D('paid_on', 'Paid on', { readonly: true }), R('journal_id', 'Journal', 'journal_entries', { readonly: true }), TA('notes', 'Notes'),
    ],
    defaultSort: { field: 'id', dir: 'desc' },
  },
  // --- Real Estate Finance Extensions ---
  {
    key: 'owner_statements', label: 'Owner Statement', plural: 'Owner Statements', module: 'finance', icon: 'FileBarChart',
    title: ['statement_no', 'owner_name'], titleSep: ' – ',
    numbering: { field: 'statement_no', pattern: 'OST-{YY}{seq:5}' },
    panel: true, statusField: 'status', print: 'owner_statement', noDelete: true,
    fields: [
      T('statement_no', 'Statement No.', { readonly: true, list: true, search: true, section: 'Statement' }),
      R('owner_id', 'Owner', 'parties', { required: true, list: true }),
      T('owner_name', 'Owner', { readonly: true, list: true }),
      D('period_from', 'Period From', { required: true, list: true }),
      D('period_to', 'Period To', { required: true, list: true }),
      S('status', 'Status', ['Draft', 'Generated', 'Sent', 'Paid'], { default: 'Draft', list: true, key: true }),
      M('opening_balance', 'Opening Balance'), M('rental_income', 'Rental Income'), M('service_charges_collected', 'Service Charges Collected'),
      M('commission_deducted', 'Commission Deducted'), M('maintenance_deducted', 'Maintenance Deducted'), M('other_deductions', 'Other Deductions'),
      M('closing_balance', 'Closing Balance'), D('generated_date', 'Generated Date', { default: 'today', list: true }),
      D('sent_date', 'Sent Date'), R('generated_by_id', 'Generated By', 'users'), TA('notes', 'Notes'),
    ],
    defaultSort: { field: 'period_to', dir: 'desc' },
  },
  {
    key: 'agent_commissions', label: 'Agent Commission', plural: 'Agent Commissions', module: 'finance', icon: 'Percent',
    title: ['commission_no', 'agent_name'], titleSep: ' – ',
    numbering: { field: 'commission_no', pattern: 'COM-{YY}{seq:5}' },
    panel: true, statusField: 'status', noDelete: true,
    fields: [
      T('commission_no', 'Commission No.', { readonly: true, list: true, search: true, section: 'Commission' }),
      R('agent_id', 'Agent', 'agents', { required: true, list: true }),
      T('agent_name', 'Agent', { readonly: true, list: true }),
      R('sales_contract_id', 'Sales Contract', 'sales_contracts', { list: true }),
      R('lease_id', 'Lease', 'leases', { list: true }),
      R('mandate_id', 'Mandate', 'mandates', { list: true }),
      S('source_type', 'Source', ['Sale', 'Lease', 'Renewal', 'Referral'], { required: true, list: true }),
      M('gross_commission', 'Gross Commission', { required: true, list: true }),
      M('brokerage_share', 'Brokerage Share', { list: true }),
      M('agent_share', 'Agent Share', { list: true }),
      P('agent_split_pct', 'Agent Split %', { min: 0, max: 100, list: true }),
      D('transaction_date', 'Transaction Date', { list: true }),
      D('due_date', 'Due Date', { list: true }),
      S('status', 'Status', ['Pending', 'Approved', 'Paid', 'Disputed', 'Cancelled'], { default: 'Pending', list: true, key: true }),
      D('paid_date', 'Paid Date'), R('payment_id', 'Payment Record', 'payments'),
      R('approved_by_id', 'Approved By', 'users'), D('approved_date', 'Approved Date'), TA('notes', 'Notes'),
    ],
    defaultSort: { field: 'transaction_date', dir: 'desc' },
  },
]
