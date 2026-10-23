import { studio } from './studio'
import type { EntityDef, NavGroup } from '../types'
import { platform } from './platform'
import { masters } from './masters'
import { crm } from './crm'
import { ops } from './ops'
import { finance } from './finance'
import { people } from './people'
import { automation } from './automation'
import { enterprise } from './enterprise'
import { work } from './work'
import { compliance } from './compliance'
import { properties } from './properties'
import { mandates } from './mandates'
import { transactions } from './transactions'
import { leases } from './leases'
import { jobs } from './jobs'
import { job_charges } from './job_charges'
import { job_events } from './job_events'

export { MODULE_DEFS } from './platform'
export * from './ops'

export const ENTITY_LIST: EntityDef[] = [
  ...platform,
  ...masters,
  ...crm,
  ...properties,
  ...mandates,
  ...jobs,
  ...job_charges,
  ...job_events,
  ...transactions,
  ...leases,
  ...finance,
  ...people,
  ...ops,
  ...automation,
  ...compliance,
  ...work,
  ...enterprise,
  ...studio,
]

export const ENTITIES: Record<string, EntityDef> = Object.fromEntries(ENTITY_LIST.map(e => [e.key, e]))

export function validateMeta(): string[] {
  const errs: string[] = []
  for (const e of ENTITY_LIST) {
    const names = new Set<string>()
    for (const f of e.fields) {
      if (names.has(f.name)) errs.push(`${e.key}.${f.name} duplicated`)
      names.add(f.name)
      if (['id', 'created_at', 'updated_at', 'created_by', 'updated_by', 'deleted_at', 'version', 'custom'].includes(f.name)) errs.push(`${e.key}.${f.name} is reserved`)
      if (f.type === 'ref' && !ENTITIES[f.ref!]) errs.push(`${e.key}.${f.name} -> unknown entity ${f.ref}`)
      if (f.type === 'select' && !f.options?.length) errs.push(`${e.key}.${f.name} select without options`)
    }
    for (const c of e.children ?? []) {
      const ce = ENTITIES[c.entity]
      if (!ce) errs.push(`${e.key}.${c.key} child entity ${c.entity} missing`)
      else if (!ce.fields.find(f => f.name === c.fk)) errs.push(`${c.entity}.${c.fk} fk missing`)
    }
    for (const n of e.title) if (!names.has(n) && n !== 'id') errs.push(`${e.key} title field ${n} missing`)
  }
  return errs
}

export const NAV: NavGroup[] = [
  { label: 'Dashboard', icon: 'LayoutDashboard', items: [
    { label: 'Dashboard', to: '/', icon: 'LayoutDashboard', module: 'dashboard' },
  ] },
  { label: 'CRM & Sales', icon: 'Handshake', items: [
    { label: 'Email', to: '/email', icon: 'Mail', module: 'crm' },
    { label: 'Contacts & Parties', to: '/e/parties', icon: 'Users', module: 'crm' },
    { label: 'Leads', to: '/e/leads', icon: 'UserPlus', module: 'crm' },
    { label: 'Opportunities', to: '/e/opportunities', icon: 'Target', module: 'crm' },
    { label: 'Activities', to: '/e/activities', icon: 'PhoneCall', module: 'crm' },
    { label: 'Campaigns', to: '/e/campaigns', icon: 'Megaphone', module: 'crm' },
  ] },
  { label: 'Properties', icon: 'Building2', items: [
    { label: 'Properties', to: '/e/properties', icon: 'Building2', module: 'properties' },
    { label: 'Units', to: '/e/units', icon: 'Home', module: 'properties' },
    { label: 'Communities', to: '/e/communities', icon: 'Map', module: 'masters' },
    { label: 'Developers', to: '/e/developers', icon: 'Building', module: 'masters' },
  ] },
  { label: 'Sales & Mandates', icon: 'FileSignature', items: [
    { label: 'Mandates', to: '/e/mandates', icon: 'FilePen', module: 'mandates' },
    { label: 'Viewings', to: '/e/viewings', icon: 'Calendar', module: 'mandates' },
    { label: 'Offers', to: '/e/offers', icon: 'HandCoins', module: 'transactions' },
    { label: 'Deal Files', to: '/e/jobs', icon: 'FileSignature', module: 'sales' },
    { label: 'Sales Contracts', to: '/e/sales_contracts', icon: 'FileCheck', module: 'transactions' },
    { label: 'Escrow Accounts', to: '/e/escrow_accounts', icon: 'Shield', module: 'transactions' },
  ] },
  { label: 'Leases & Mgmt', icon: 'Key', items: [
    { label: 'Leases', to: '/e/leases', icon: 'FileText', module: 'leases' },
    { label: 'Rent Schedules', to: '/e/rent_schedules', icon: 'CalendarDays', module: 'leases' },
    { label: 'Rent Receipts', to: '/e/rent_receipts', icon: 'ReceiptText', module: 'leases' },
    { label: 'Service Charges', to: '/e/service_charges', icon: 'Settings', module: 'leases' },
    { label: 'Maintenance', to: '/e/maintenance', icon: 'Wrench', module: 'leases' },
    { label: 'Inspections', to: '/e/inspections', icon: 'ClipboardCheck', module: 'leases' },
    { label: 'Handovers', to: '/e/handovers', icon: 'Key', module: 'properties' },
  ] },
  { label: 'Accounts', icon: 'Landmark', items: [
    { label: 'Invoices & Notes', to: '/e/invoices', icon: 'ReceiptText', module: 'finance' },
    { label: 'Receipts', to: '/e/receipts', icon: 'HandCoins', module: 'finance' },
    { label: 'Bills', to: '/e/bills', icon: 'FileInput', module: 'finance' },
    { label: 'Payments', to: '/e/payments', icon: 'Banknote', module: 'finance' },
    { label: 'Journal Entries', to: '/e/journal_entries', icon: 'NotebookPen', module: 'finance' },
    { label: 'Expense Claims', to: '/e/expenses', icon: 'Wallet', module: 'finance' },
    { label: 'Bank Accounts', to: '/e/bank_accounts', icon: 'Landmark', module: 'finance' },
    { label: 'Bank Reconciliation', to: '/e/bank_transactions', icon: 'Scale', module: 'finance' },
    { label: 'Owner Statements', to: '/e/owner_statements', icon: 'FileBarChart', module: 'finance' },
    { label: 'Agent Commissions', to: '/e/agent_commissions', icon: 'Percent', module: 'finance' },
  ] },
  { label: 'People', icon: 'Users', items: [
    { label: 'Employees', to: '/e/employees', icon: 'Users', module: 'hr' },
    { label: 'Agents (DLD Registered)', to: '/e/agents', icon: 'BadgeCheck', module: 'hr' },
    { label: 'Attendance', to: '/e/attendance', icon: 'CalendarCheck', module: 'hr' },
    { label: 'Leave', to: '/e/leave', icon: 'Plane', module: 'hr' },
    { label: 'Payroll', to: '/e/payroll', icon: 'Banknote', module: 'hr' },
  ] },
  { label: 'Support', icon: 'Headphones', items: [
    { label: 'Tickets', to: '/e/tickets', icon: 'Ticket', module: 'support' },
    { label: 'Claims & Disputes', to: '/e/claims', icon: 'AlertTriangle', module: 'support' },
  ] },
  { label: 'Projects', icon: 'FolderKanban', items: [
    { label: 'Projects', to: '/e/projects', icon: 'FolderKanban', module: 'projects' },
    { label: 'Tasks', to: '/e/tasks', icon: 'CheckSquare', module: 'projects' },
  ] },
  { label: 'Documents', icon: 'FileStack', items: [
    { label: 'Document Studio', to: '/studio', icon: 'FileCode2', module: 'documents' },
    { label: 'Templates', to: '/studio/templates', icon: 'FileTemplate', module: 'documents' },
    { label: 'Company Documents', to: '/e/company_documents', icon: 'FileCheck', module: 'documents' },
  ] },
  { label: 'Automation', icon: 'Bot', items: [
    { label: 'AI Employees', to: '/ai', icon: 'Bot', module: 'ai' },
    { label: 'Automation Rules', to: '/e/automation_rules', icon: 'Zap', module: 'ai' },
    { label: 'Webhooks', to: '/e/webhooks', icon: 'Webhook', module: 'ai' },
    { label: 'API Keys', to: '/e/api_keys', icon: 'Key', module: 'ai' },
  ] },
  { label: 'Reports', icon: 'BarChart2', items: [
    { label: 'Sales Pipeline', to: '/reports/sales-pipeline', icon: 'TrendingUp', module: 'reports' },
    { label: 'Rent Roll', to: '/reports/rent-roll', icon: 'FileBarChart', module: 'reports' },
    { label: 'Occupancy', to: '/reports/occupancy', icon: 'Home', module: 'reports' },
    { label: 'Agent Performance', to: '/reports/agent-performance', icon: 'Users', module: 'reports' },
    { label: 'Maintenance KPI', to: '/reports/maintenance', icon: 'Wrench', module: 'reports' },
  ] },
  { label: 'Administration', icon: 'Settings', items: [
    { label: 'Company', to: '/admin/company', icon: 'Building2', module: 'admin' },
    { label: 'Branches', to: '/e/branches', icon: 'Building', module: 'admin' },
    { label: 'Users', to: '/e/users', icon: 'Users', module: 'admin' },
    { label: 'Roles', to: '/e/roles', icon: 'ShieldCheck', module: 'admin' },
    { label: 'Permissions', to: '/admin/permissions', icon: 'Shield', module: 'admin' },
    { label: 'Audit Log', to: '/admin/audit', icon: 'History', module: 'admin' },
    { label: 'Backups', to: '/admin/backups', icon: 'DatabaseBackup', module: 'admin' },
    { label: 'Settings', to: '/admin/settings', icon: 'Settings', module: 'admin' },
    { label: 'Integrations', to: '/admin/integrations', icon: 'Plug', module: 'admin' },
  ] },
]
