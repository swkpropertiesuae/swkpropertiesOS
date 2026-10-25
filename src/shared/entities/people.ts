import type { EntityDef } from '../types'
import { T, TA, I, N, M, P, B, E, PH, S, R, D, DT, U } from '../dsl'

export const people: EntityDef[] = [
  // ---------------- HR
  {
    key: 'employees', label: 'Employee', plural: 'Employees', module: 'hr', icon: 'UserRound', title: ['emp_no', 'name'], titleSep: ' – ', panel: true, statusField: 'status',
    numbering: { field: 'emp_no', pattern: 'EMP{seq:4}' },
    fields: [
      T('emp_no', 'Employee no.', { readonly: true, list: true, search: true, section: 'Employee' }), T('name', 'Full name', { required: true, list: true, search: true, span: 2 }), R('user_id', 'Linked user', 'users'),
      R('department_id', 'Department', 'departments', { list: true }), T('designation', 'Designation', { list: true }), R('branch_id', 'Branch', 'branches', { list: true }), R('manager_id', 'Reports to', 'employees'),
      S('status', 'Status', ['Active', 'On leave', 'Probation', 'Resigned', 'Terminated'], { default: 'Active', list: true }), D('join_date', 'Join date', { list: true }), S('contract_type', 'Contract', ['Unlimited', 'Limited', 'Part-time', 'Contractor']),
      PH('phone', 'Phone'), E('email', 'Work e-mail'), T('nationality', 'Nationality'), S('gender', 'Gender', ['Male', 'Female']), D('dob', 'Date of birth'),
      T('passport_no', 'Passport no.', { section: 'Documents' }), D('passport_expiry', 'Passport expiry', { list: true }), T('emirates_id', 'Emirates ID'), D('eid_expiry', 'Emirates ID expiry'), T('visa_no', 'Visa / residence no.'), D('visa_expiry', 'Visa expiry', { list: true }), T('labour_card_no', 'Labour card no.'),
      D('health_card_expiry', 'Health insurance expiry'), T('work_permit_no', 'Work permit no.'), D('work_permit_expiry', 'Work permit / labour contract expiry', { list: false }),
      S('iloe_status', 'Unemployment insurance (ILOE)', ['Subscribed', 'Not subscribed', 'Exempt'], { default: 'Not subscribed' }),
      M('basic_salary', 'Basic salary', { section: 'Compensation' }), M('housing_allowance', 'Housing'), M('transport_allowance', 'Transport'), M('other_allowance', 'Other allowances'), T('bank_iban', 'Salary IBAN'), T('bank_routing_code', 'Bank routing code (WPS, 9 digits)'), T('bank_name', 'Salary bank'), T('mol_person_id', 'MOHRE person ID (WPS, 14 digits)'),
      N('annual_leave_days', 'Annual leave entitlement', { default: 30 }), TA('notes', 'Notes'),
    ],
  },
  {
    key: 'agents', label: 'Agent (DLD Registered)', plural: 'Agents', module: 'hr', icon: 'BadgeCheck', title: ['agent_no', 'name'], titleSep: ' – ', panel: true, statusField: 'status',
    numbering: { field: 'agent_no', pattern: 'AGT{seq:4}' },
    fields: [
      T('agent_no', 'Agent No.', { readonly: true, list: true, search: true, section: 'Agent' }),
      R('employee_id', 'Employee Record', 'employees', { list: true, help: 'Link to HR employee record for payroll' }),
      T('name', 'Full Name', { required: true, list: true, search: true, span: 2 }),
      T('dld_broker_id', 'DLD Broker ID (RERA No.)', { required: true, unique: true, list: true, search: true, section: 'DLD Registration' }),
      T('rera_card_no', 'RERA Card No.', { list: true }),
      D('dld_expiry', 'DLD Registration Expiry', { list: true }),
      T('dld_license_type', 'License Type', { default: 'Real Estate Broker', list: true }),
      T('specialization', 'Specialization', { list: true, help: 'e.g. Residential Sales, Commercial Leasing, Off-Plan' }),
      PH('phone', 'Mobile', { list: true }), E('email', 'Email', { list: true }),
      R('branch_id', 'Branch', 'branches', { list: true }),
      R('manager_id', 'Team Lead / Manager', 'agents', { list: true }),
      S('status', 'Status', ['Active', 'On Leave', 'Suspended', 'Licence Expired', 'Resigned'], { default: 'Active', list: true, key: true }),
      D('join_date', 'Join Date', { list: true }),
      P('commission_split_pct', 'Default Commission Split %', { min: 0, max: 100, help: 'Agent\'s share of brokerage commission' }),
      S('commission_tier', 'Commission Tier', ['Standard', 'Senior', 'Partner', 'Custom'], { default: 'Standard', list: true }),
      T('bank_iban', 'Commission IBAN'), T('bank_name', 'Bank'),
      T('social_media', 'Social Media', { span: 3, help: 'LinkedIn, Instagram, Property Finder, Bayut profile URLs' }),
      B('portal_access', 'Client Portal Access', { default: true }),
      TA('bio', 'Agent Bio', { span: 3 }),
      TA('notes', 'Internal Notes'),
    ],
    defaultSort: { field: 'name', dir: 'asc' },
  },
  {
    key: 'leave_requests', label: 'Leave request', plural: 'Leave requests', module: 'hr', icon: 'Plane', title: ['id'], panel: true, statusField: 'status', calendar: { field: 'from_date' },
    fields: [
      R('employee_id', 'Employee', 'employees', { required: true, list: true, section: 'Leave' }), S('type', 'Leave type', ['Annual', 'Sick', 'Unpaid', 'Maternity / paternity', 'Compassionate', 'Hajj', 'Public holiday swap'], { required: true, list: true }),
      D('from_date', 'From', { required: true, list: true }), D('to_date', 'To', { required: true, list: true }), N('days', 'Days', { list: true }),
      S('status', 'Status', ['Pending', 'Approved', 'Rejected', 'Cancelled'], { default: 'Pending', list: true, readonly: true }), R('approver_id', 'Approver', 'users', { readonly: true }), TA('reason', 'Reason'),
    ],
    defaultSort: { field: 'from_date', dir: 'desc' },
  },
  {
    key: 'attendance', label: 'Attendance', plural: 'Attendance', module: 'hr', icon: 'Clock', title: ['id'],
    fields: [
      R('employee_id', 'Employee', 'employees', { required: true, list: true, section: 'Attendance' }), D('att_date', 'Date', { required: true, default: 'today', list: true }),
      DT('check_in', 'Check-in', { list: true }), DT('check_out', 'Check-out', { list: true }), N('hours', 'Hours', { computed: true, list: true }),
      S('status', 'Status', ['Present', 'Absent', 'Late', 'Half day', 'Remote', 'On leave', 'Public holiday'], { default: 'Present', list: true }), T('note', 'Note'),
    ],
    defaultSort: { field: 'att_date', dir: 'desc' },
  },
  {
    key: 'payslips', label: 'Payslip', plural: 'Payroll', module: 'hr', icon: 'BadgeDollarSign', title: ['period'], panel: true, statusField: 'status', print: 'payslip',
    description: 'Internal payroll records. Generation calculates pay from the employee record; bank/WPS salary transfer files are produced outside this system.',
    fields: [
      R('employee_id', 'Employee', 'employees', { required: true, list: true, section: 'Payslip' }), T('period', 'Period (YYYY-MM)', { required: true, list: true }),
      M('basic', 'Basic', { list: true }), M('allowances', 'Allowances'), M('overtime', 'Overtime'), M('deductions', 'Deductions'), M('net_pay', 'Net pay', { computed: true, list: true }),
      N('unpaid_days', 'Unpaid leave days'), S('status', 'Status', ['Draft', 'Approved', 'Paid'], { default: 'Draft', list: true }), D('paid_on', 'Paid on'), TA('notes', 'Notes'),
    ],
    defaultSort: { field: 'period', dir: 'desc' },
  },
  // ---------------- Support (Property focused)
  {
    key: 'tickets', label: 'Ticket / Complaint', plural: 'Complaints & tickets', module: 'support', icon: 'LifeBuoy', title: ['ticket_no', 'subject'], titleSep: ' – ', panel: true, statusField: 'status',
    numbering: { field: 'ticket_no', pattern: 'TKT{YY}{seq:5}' },
    fields: [
      T('ticket_no', 'Ticket no.', { readonly: true, list: true, search: true, section: 'Ticket' }), T('subject', 'Subject', { required: true, list: true, search: true, span: 2 }),
      S('type', 'Type', ['Maintenance', 'Tenant Complaint', 'Landlord Complaint', 'Service Request', 'Billing Query', 'Contract Dispute', 'Ejari Issue', 'Handover Issue', 'Other'], { default: 'Service Request', list: true }),
      S('priority', 'Priority', ['Low', 'Medium', 'High', 'Urgent'], { default: 'Medium', list: true }),
      S('status', 'Status', ['Open', 'In progress', 'Waiting on customer', 'Waiting on vendor', 'Resolved', 'Closed'], { default: 'Open', list: true }),
      R('property_id', 'Property', 'properties', { list: true }), R('unit_id', 'Unit', 'units', { list: true }),
      R('lease_id', 'Lease', 'leases', { list: true }), R('customer_id', 'Customer', 'parties', { list: true }),
      T('link_entity', 'Linked record type', { hidden: true }), I('link_id', 'Linked record id', { hidden: true }), T('link_label', 'Linked record', { readonly: true, list: true }),
      R('assigned_to', 'Assigned to', 'users', { list: true }), DT('due_at', 'SLA due', { list: true }), DT('resolved_at', 'Resolved at', { readonly: true }),
      TA('description', 'Description'), TA('resolution', 'Resolution / root cause'),
    ],
    defaultSort: { field: 'id', dir: 'desc' },
  },
  {
    key: 'claims', label: 'Dispute / Claim', plural: 'Disputes & claims', module: 'support', icon: 'ShieldAlert', title: ['claim_no'], panel: true, statusField: 'status',
    numbering: { field: 'claim_no', pattern: 'DSP{YY}{seq:4}' },
    fields: [
      T('claim_no', 'Claim no.', { readonly: true, list: true, search: true, section: 'Claim' }),
      R('property_id', 'Property', 'properties', { list: true }), R('unit_id', 'Unit', 'units', { list: true }),
      R('lease_id', 'Lease', 'leases', { list: true }),
      R('claimant_id', 'Claimant', 'parties', { required: true, list: true }),
      R('respondent_id', 'Respondent', 'parties', { list: true }),
      S('type', 'Type', ['Security Deposit', 'Maintenance', 'Rent Arrears', 'Service Charges', 'Early Termination', 'Contract Breach', 'Ejari Dispute', 'Handover Defects'], { list: true }),
      S('status', 'Status', ['Reported', 'Mediation', 'RERA RDC Submitted', 'RDC Hearing', 'Settled', 'Judgment', 'Closed'], { default: 'Reported', list: true }),
      D('incident_date', 'Incident date', { list: true }), M('claim_amount', 'Claim amount', { list: true }), M('settled_amount', 'Settled amount'),
      T('rdc_case_no', 'RERA RDC Case No.', { list: true }),
      TA('description', 'Description'), TA('resolution', 'Resolution'),
    ],
  },
  // ---------------- Projects & tasks
  {
    key: 'projects', label: 'Project', plural: 'Projects', module: 'projects', icon: 'FolderKanban', title: ['name'], panel: true, statusField: 'status',
    fields: [
      T('name', 'Project', { required: true, list: true, search: true, span: 2, section: 'Project' }), R('property_id', 'Property', 'properties', { list: true }), R('owner_id', 'Owner', 'parties', { list: true }), R('manager_id', 'Project manager', 'users', { list: true }),
      S('status', 'Status', ['Planned', 'Active', 'On hold', 'Completed', 'Cancelled'], { default: 'Planned', list: true }), D('start_date', 'Start', { list: true }), D('end_date', 'Due', { list: true }), M('budget', 'Budget'), TA('description', 'Scope'),
    ],
  },
  {
    key: 'tasks', label: 'Task', plural: 'Tasks & follow-ups', module: 'projects', icon: 'ListChecks', title: ['title'], panel: true, statusField: 'status', kanban: { field: 'status' }, calendar: { field: 'due_date' },
    fields: [
      T('title', 'Task', { required: true, list: true, search: true, span: 2, section: 'Task' }), S('status', 'Status', ['To do', 'In progress', 'Blocked', 'Done'], { default: 'To do', list: true }), S('priority', 'Priority', ['Low', 'Medium', 'High', 'Urgent'], { default: 'Medium', list: true }),
      D('due_date', 'Due date', { list: true }), R('assignee_id', 'Assigned to', 'users', { default: 'me', list: true }), R('project_id', 'Project', 'projects'), S('kind', 'Kind', ['Task', 'Follow-up', 'Approval', 'Document chase', 'Payment reminder', 'Viewing', 'Offer follow-up', 'Ejari renewal'], { default: 'Task', list: true }),
      T('link_entity', 'Linked record type', { hidden: true }), I('link_id', 'Linked record id', { hidden: true }), T('link_label', 'Linked record', { list: true, readonly: true }), DT('completed_at', 'Completed at', { readonly: true }), TA('description', 'Details'),
    ],
    defaultSort: { field: 'due_date', dir: 'asc' },
  },
  // ---------------- Assets (Office equipment, not logistics)
  {
    key: 'fixed_assets', label: 'Asset', plural: 'Fixed assets', module: 'assets', icon: 'Armchair', title: ['asset_no', 'name'], titleSep: ' – ', panel: true,
    numbering: { field: 'asset_no', pattern: 'AST{seq:5}' },
    fields: [
      T('asset_no', 'Asset no.', { readonly: true, list: true, search: true, section: 'Asset' }), T('name', 'Name', { required: true, list: true, search: true }),
      S('category', 'Category', ['Office Equipment', 'Furniture', 'Vehicles', 'IT Hardware', 'Software Licences', 'Signage', 'Model Units / Showroom', 'Tools'], { list: true }),
      R('branch_id', 'Branch', 'branches', { list: true }), R('location_id', 'Location', 'properties'),
      M('cost', 'Cost'), D('purchase_date', 'Purchased'), N('useful_life_years', 'Useful life (years)'), S('depreciation_method', 'Depreciation', ['Straight line', 'Declining balance'], { default: 'Straight line' }),
      R('depreciation_account_id', 'Depreciation exp. account', 'accounts'), R('accumulated_dep_account_id', 'Accum. dep. account', 'accounts'),
      B('active', 'Active', { default: true, list: true }), TA('notes', 'Notes'),
    ],
  },
]