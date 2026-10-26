import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard, LineChart, KanbanSquare, CalendarDays, Sparkles, Building2, Home, Rocket, Map, Landmark as DevIcon, Megaphone,
  UserPlus, Users, Target, PhoneCall, MessageCircle, Mail, FilePen, CalendarCheck, HandCoins, FileSignature, FileCheck, ShieldCheck,
  KeyRound, CalendarClock, Wallet, ReceiptText, Wrench, ClipboardCheck, DoorOpen, UserRoundCog, FileBarChart, Percent, Receipt, FileInput,
  Banknote, Scale, BadgeCheck, ScrollText, FileStack, Trophy, IdCard, Clock, Plane, Calculator, FileCode2, BarChart3, Settings,
  ShieldHalf, History, Plug, DatabaseBackup, Building, Gavel, Layers, ShieldAlert, CheckCheck, MapPinned, Briefcase, Star, PackageCheck,
} from 'lucide-react'

export type NavItem = { label: string; to: string; icon: LucideIcon; module?: string; isNew?: boolean; desc?: string }
export type NavSection = { key: string; label: string; items: NavItem[] }

/** Real-estate-only navigation with simple, clear English labels. `module` is the RBAC module checked with can(module, 'view'). */
export const SWK_NAV: NavSection[] = [
  { key: 'command', label: 'Dashboards', items: [
    { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard, module: 'dashboard', desc: 'Today’s business summary' },
    { label: 'Company Operations', to: '/enterprise/master-os', icon: ShieldCheck, isNew: true, desc: 'Daily work, deals, approvals & team checks' },
    { label: 'Market Pulse', to: '/market', icon: LineChart, isNew: true, desc: 'Dubai area prices, yields & supply' },
    { label: 'Deal Pipeline', to: '/pipeline', icon: KanbanSquare, module: 'sales', isNew: true, desc: 'Track deals from enquiry to handover' },
    { label: 'Approvals', to: '/e/universal_approvals', icon: CheckCheck, module: 'projects', isNew: true, desc: 'Requests waiting for manager sign-off' },
    { label: 'Calendar', to: '/calendar', icon: CalendarDays, desc: 'Viewings, meetings & reminders' },
    { label: 'AI Assistant', to: '/ai', icon: Sparkles, module: 'ai', desc: 'Smart helpers, daily briefs & tasks' },
  ] },
  { key: 'inventory', label: 'Properties', items: [
    { label: 'Listing Studio', to: '/listings', icon: Megaphone, module: 'properties', isNew: true, desc: 'Publish & check property listings' },
    { label: 'New Submissions', to: '/e/inventory_submissions', icon: Building2, module: 'properties', isNew: true, desc: 'Properties submitted by agents for review' },
    { label: 'Owner Agreements', to: '/e/listing_mandates', icon: FileSignature, module: 'mandates', isNew: true, desc: 'Signed owner forms, permits & prices' },
    { label: 'Properties', to: '/e/properties', icon: Building2, module: 'properties', desc: 'All properties for sale or rent' },
    { label: 'Units', to: '/e/units', icon: Home, module: 'properties', desc: 'Individual apartments, villas & offices' },
    { label: 'Off-Plan Projects', to: '/offplan', icon: Rocket, module: 'properties', isNew: true, desc: 'New launches & payment plans' },
    { label: 'Communities', to: '/e/communities', icon: Map, module: 'masters', desc: 'Areas & master communities' },
    { label: 'Developers', to: '/e/developers', icon: DevIcon, module: 'masters', desc: 'Property developers' },
  ] },
  { key: 'clients', label: 'CRM', items: [
    { label: 'Leads', to: '/e/leads', icon: UserPlus, module: 'crm', desc: 'New buyer & tenant enquiries' },
    { label: 'Contacts', to: '/e/parties', icon: Users, module: 'crm', desc: 'Buyers, sellers, landlords & tenants' },
    { label: 'Opportunities', to: '/e/opportunities', icon: Target, module: 'crm', desc: 'Active client requirements' },
    { label: 'Client Messages', to: '/e/communications', icon: MessageCircle, module: 'crm', isNew: true, desc: 'WhatsApp & email follow-up tracker' },
    { label: 'Phone Calls', to: '/e/voice_calls', icon: PhoneCall, module: 'crm', isNew: true, desc: 'Incoming calls & receptionist notes' },
    { label: 'Lead History', to: '/e/lead_assignment_logs', icon: History, module: 'crm', isNew: true, desc: 'Who received or reassigned each lead' },
    { label: 'Client Reviews', to: '/e/qa_reviews', icon: Star, module: 'support', isNew: true, desc: 'Client feedback & service quality' },
    { label: 'Calls & Activities', to: '/e/activities', icon: PhoneCall, module: 'crm', desc: 'Meetings, calls & follow-up notes' },
    { label: 'Campaigns', to: '/e/campaigns', icon: Megaphone, module: 'crm', desc: 'Marketing campaigns' },
    { label: 'WhatsApp', to: '/whatsapp', icon: MessageCircle, module: 'crm', desc: 'Live WhatsApp chat inbox' },
    { label: 'Email', to: '/email', icon: Mail, module: 'crm', desc: 'Company email inbox' },
  ] },
  { key: 'sales', label: 'Sales & mandates', items: [
    { label: 'Mandates (Form A)', to: '/e/mandates', icon: FilePen, module: 'mandates', desc: 'Seller marketing agreements' },
    { label: 'Property Sales', to: '/e/transactions', icon: Briefcase, module: 'transactions', isNew: true, desc: 'Step-by-step sale & transfer tracker' },
    { label: 'Developer NOCs', to: '/e/developer_requests', icon: FileCheck, module: 'transactions', isNew: true, desc: 'Developer no-objection certificates' },
    { label: 'Viewings', to: '/e/viewings', icon: CalendarCheck, module: 'mandates', desc: 'Scheduled property viewings' },
    { label: 'Offers', to: '/e/offers', icon: HandCoins, module: 'transactions', desc: 'Buyer & tenant offers' },
    { label: 'Deal Files', to: '/e/jobs', icon: FileSignature, module: 'sales', desc: 'Complete deal folders & billing' },
    { label: 'Sales Contracts (Form F)', to: '/e/sales_contracts', icon: FileCheck, module: 'transactions', desc: 'Signed MOU / Form F contracts' },
    { label: 'Escrow Accounts', to: '/e/escrow_accounts', icon: ShieldCheck, module: 'transactions', desc: 'Project & deal escrow accounts' },
    { label: 'DLD Filings', to: '/e/dld_filings', icon: FileCheck, module: 'transactions', isNew: true, desc: 'Land Department registrations & deeds' },
  ] },
  { key: 'leasing', label: 'Leasing & management', items: [
    { label: 'Leases & Ejari', to: '/e/leases', icon: KeyRound, module: 'leases', desc: 'Tenancy contracts & renewals' },
    { label: 'Rent Schedules', to: '/e/rent_schedules', icon: CalendarClock, module: 'leases', desc: 'Upcoming rent instalments' },
    { label: 'PDC Cheque Vault', to: '/pdc', icon: Wallet, module: 'leases', isNew: true, desc: 'Post-dated rent cheques & deposits' },
    { label: 'Rent Receipts', to: '/e/rent_receipts', icon: ReceiptText, module: 'leases', desc: 'Collected rent receipts' },
    { label: 'Service Charges', to: '/e/service_charges', icon: Layers, module: 'leases', desc: 'Building service charge records' },
    { label: 'Maintenance', to: '/e/maintenance', icon: Wrench, module: 'leases', desc: 'Repair & maintenance requests' },
    { label: 'Inspections', to: '/e/inspections', icon: ClipboardCheck, module: 'leases', desc: 'Move-in & move-out inspections' },
    { label: 'Handovers', to: '/e/handovers', icon: DoorOpen, module: 'properties', desc: 'Key & unit handovers' },
  ] },
  { key: 'owners', label: 'Landlords', items: [
    { label: 'Owner 360', to: '/owners', icon: UserRoundCog, module: 'finance', isNew: true, desc: 'Landlord properties & rental returns' },
    { label: 'Owner Statements', to: '/e/owner_statements', icon: FileBarChart, module: 'finance', desc: 'Income & expense statements' },
  ] },
  { key: 'finance', label: 'Accounting', items: [
    { label: 'Agent Commissions', to: '/e/agent_commissions', icon: Percent, module: 'finance', desc: 'Agent commission statements' },
    { label: 'Commission Payouts', to: '/e/commission_entitlements', icon: Percent, module: 'finance', isNew: true, desc: 'Commission splits & payout approvals' },
    { label: 'Tax Invoices', to: '/e/invoices', icon: Receipt, module: 'finance', desc: 'Client invoices & credit notes' },
    { label: 'Receipts', to: '/e/receipts', icon: HandCoins, module: 'finance', desc: 'Payments received' },
    { label: 'Vendor Bills', to: '/e/bills', icon: FileInput, module: 'finance', desc: 'Supplier bills' },
    { label: 'Payments', to: '/e/payments', icon: Banknote, module: 'finance', desc: 'Outgoing payments' },
    { label: 'Office Purchases', to: '/e/procurement_requests', icon: PackageCheck, module: 'finance', isNew: true, desc: 'Equipment, supplies & vendor orders' },
    { label: 'Bank & Reconciliation', to: '/e/bank_transactions', icon: Scale, module: 'finance', desc: 'Bank statements & matching' },
    { label: 'Financial Statements', to: '/finance/statements', icon: FileBarChart, module: 'finance', desc: 'Profit & loss, balance sheet & VAT' },
  ] },
  { key: 'compliance', label: 'Compliance', items: [
    { label: 'RERA Centre', to: '/rera', icon: Gavel, module: 'compliance', isNew: true, desc: 'Permits, broker cards & RERA checks' },
    { label: 'Compliance Cases', to: '/e/compliance_cases', icon: ShieldAlert, module: 'compliance', isNew: true, desc: 'Complaints, reviews & risk alerts' },
    { label: 'Agent Licences', to: '/e/agent_authorisations', icon: BadgeCheck, module: 'compliance', isNew: true, desc: 'Broker RERA cards & selling approval' },
    { label: 'Licences & Filings', to: '/compliance', icon: BadgeCheck, module: 'compliance', desc: 'Company licences & tax deadlines' },
    { label: 'KYC Checks', to: '/e/kyc_checks', icon: ShieldCheck, module: 'compliance', isNew: true, desc: 'Client identity & AML checks' },
    { label: 'goAML Reports', to: '/e/aml_reports', icon: ShieldAlert, module: 'compliance', isNew: true, desc: 'Suspicious activity log' },
    { label: 'Company Documents', to: '/e/compliance_items', icon: ScrollText, module: 'documents', desc: 'Official company registrations' },
    { label: 'Document Vault', to: '/documents', icon: FileStack, module: 'documents', desc: 'All uploaded files & expiry dates' },
  ] },
  { key: 'team', label: 'Employees', items: [
    { label: 'Agent Leaderboard', to: '/agents', icon: Trophy, module: 'hr', isNew: true, desc: 'Top performing agents & targets' },
    { label: 'Agents (BRN)', to: '/e/agents', icon: IdCard, module: 'hr', desc: 'Registered real estate brokers' },
    { label: 'Employees', to: '/e/employees', icon: Users, module: 'hr', desc: 'Staff profiles & contracts' },
    { label: 'Visas & Work Permits', to: '/e/immigration_cases', icon: Plane, module: 'hr', isNew: true, desc: 'Residency visas, Emirates ID & labour cards' },
    { label: 'Hiring & Handover', to: '/e/hr_lifecycle_cases', icon: Users, module: 'hr', isNew: true, desc: 'New joiner setup & exit checklist' },
    { label: 'Attendance', to: '/e/attendance', icon: Clock, module: 'hr', desc: 'Daily staff attendance' },
    { label: 'Leave', to: '/e/leave_requests', icon: Plane, module: 'hr', desc: 'Holiday & sick leave requests' },
    { label: 'Payroll & WPS', to: '/e/payslips', icon: Banknote, module: 'hr', desc: 'Monthly salaries & bank files' },
  ] },
  { key: 'field', label: 'Field Service', items: [
    { label: 'Field Visits', to: '/e/field_sessions', icon: MapPinned, module: 'hr', isNew: true, desc: 'Check-ins at viewings & client meetings' },
    { label: 'Daily Work Reports', to: '/e/daily_reports', icon: ClipboardCheck, module: 'hr', isNew: true, desc: 'End-of-day staff work summary' },
    { label: 'Office Check-In', to: '/e/attendance_events', icon: Clock, module: 'hr', isNew: true, desc: 'Office arrival & departure logs' },
  ] },
  { key: 'tools', label: 'Documents', items: [
    { label: 'UAE Deal Toolkit', to: '/toolkit', icon: Calculator, isNew: true, desc: 'DLD fees, mortgage & rent calculators' },
    { label: 'Document Studio', to: '/studio', icon: FileCode2, module: 'documents', desc: 'Ready-to-print letters & contracts' },
    { label: 'Reports', to: '/reports', icon: BarChart3, module: 'reports', desc: 'Sales, leasing & finance reports' },
  ] },
  { key: 'admin', label: 'Settings', items: [
    { label: 'Settings', to: '/admin/settings', icon: Settings, module: 'admin', desc: 'Company details, branding & preferences' },
    { label: 'Company Policies', to: '/e/corporate_governance_items', icon: DevIcon, module: 'admin', isNew: true, desc: 'Company rules, budgets & signing limits' },
    { label: 'Safety & Backups', to: '/e/dr_exercises', icon: DatabaseBackup, module: 'admin', isNew: true, desc: 'Backup & recovery checks' },
    { label: 'Activity Log', to: '/e/audit_events', icon: History, module: 'admin', isNew: true, desc: 'Record of important system actions' },
    { label: 'Roles & Access', to: '/admin/roles', icon: ShieldHalf, module: 'admin', desc: 'Staff roles & permissions' },
    { label: 'Branches', to: '/e/branches', icon: Building, module: 'admin', desc: 'Office locations' },
    { label: 'Audit Trail', to: '/admin/audit', icon: History, module: 'admin', desc: 'Detailed change history' },
    { label: 'Integrations', to: '/admin/integrations', icon: Plug, module: 'admin', desc: 'WhatsApp, email, AI & bank connections' },
    { label: 'Backup & Data', to: '/admin/backup', icon: DatabaseBackup, module: 'admin', desc: 'Download backups & manage data' },
  ] },
]

export const QUICK_CREATE: { label: string; desc: string; to: string; icon: LucideIcon; module: string }[] = [
  { label: 'Daily work report', desc: 'Submit today’s calls, viewings & summary', to: '/e/daily_reports?new=1', icon: ClipboardCheck, module: 'hr' },
  { label: 'Submit a property', desc: 'Add a newly found property for review', to: '/e/inventory_submissions?new=1', icon: Building2, module: 'properties' },
  { label: 'New lead', desc: 'Add a buyer or tenant enquiry', to: '/e/leads?new=1', icon: UserPlus, module: 'crm' },
  { label: 'Book a viewing', desc: 'Schedule a property visit with a client', to: '/e/viewings?new=1', icon: CalendarCheck, module: 'mandates' },
  { label: 'Request Developer NOC', desc: 'Start a developer NOC for a transfer', to: '/e/developer_requests?new=1', icon: FileCheck, module: 'transactions' },
  { label: 'New property sale', desc: 'Open a new sale & transfer file', to: '/e/transactions?new=1', icon: Briefcase, module: 'transactions' },
  { label: 'New lease (Ejari)', desc: 'Create a tenancy contract & rent cheques', to: '/e/leases?new=1', icon: KeyRound, module: 'leases' },
]

export function findNav(pathname: string) {
  let best: { section: NavSection; item: NavItem } | null = null
  for (const section of SWK_NAV) for (const item of section.items) {
    const p = item.to.split('?')[0]
    if (pathname === p || pathname.startsWith(p + '/')) if (!best || p.length > best.item.to.length) best = { section, item }
  }
  return best
}

/** Launcher ("Apps") presentation for each nav section — one simple icon tile per app on the post-sign-in home screen. */
export type AppTone = 'navy' | 'champ' | 'oasis' | 'ocean' | 'dune' | 'plum'
export const APP_META: Record<string, { blurb: string; icon: LucideIcon; tone: AppTone }> = {
  command: { blurb: 'Dashboards, operations, pipeline, calendar & approvals', icon: LayoutDashboard, tone: 'navy' },
  inventory: { blurb: 'Listings, new property submissions, buildings & off-plan', icon: Building2, tone: 'ocean' },
  clients: { blurb: 'Leads, contacts, WhatsApp, phone calls & reviews', icon: Users, tone: 'oasis' },
  sales: { blurb: 'Seller mandates, offers, NOCs & property transfers', icon: FileSignature, tone: 'champ' },
  leasing: { blurb: 'Tenancy contracts, Ejari, rent cheques & maintenance', icon: KeyRound, tone: 'navy' },
  owners: { blurb: 'Landlord portfolios, rental income & statements', icon: UserRoundCog, tone: 'plum' },
  finance: { blurb: 'Commissions, invoices, bills, purchases & banking', icon: Percent, tone: 'oasis' },
  compliance: { blurb: 'RERA rules, agent licences, KYC checks & cases', icon: Gavel, tone: 'dune' },
  team: { blurb: 'Staff directory, visas, hiring, leave & payroll', icon: Users, tone: 'ocean' },
  field: { blurb: 'Field visits, daily work reports & office check-in', icon: MapPinned, tone: 'champ' },
  tools: { blurb: 'Deal calculators, contract templates & reports', icon: FileStack, tone: 'plum' },
  admin: { blurb: 'Company settings, policies, roles, backups & connections', icon: Settings, tone: 'dune' },
}

export type LauncherApp = { key: string; label: string; blurb: string; icon: LucideIcon; tone: AppTone; items: NavItem[]; landing: string }

/** Permission-filtered apps for the launcher. An app is hidden when none of its features are permitted. */
export function launcherApps(can: (module: string, action?: 'view') => boolean): LauncherApp[] {
  const out: LauncherApp[] = []
  for (const s of SWK_NAV) {
    const items = s.items.filter(i => !i.module || can(i.module, 'view'))
    const meta = APP_META[s.key]
    if (!items.length || !meta) continue
    out.push({ key: s.key, label: s.label, ...meta, items, landing: items[0]!.to })
  }
  return out
}

const RECENT_KEY = 'swk.recent'
/** Remembers the last few feature pages a user opened (per browser) so the launcher can offer a way back in. */
export function rememberVisit(pathname: string) {
  const hit = findNav(pathname)
  if (!hit) return
  try {
    const list: string[] = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
    localStorage.setItem(RECENT_KEY, JSON.stringify([hit.item.to, ...list.filter(t => t !== hit.item.to)].slice(0, 8)))
  } catch { /* storage unavailable — recents are a convenience only */ }
}
export function recentItems(can: (module: string, action?: 'view') => boolean, limit = 4): (NavItem & { section: string })[] {
  let list: string[] = []
  try { list = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') } catch { /* ignore */ }
  const all = SWK_NAV.flatMap(s => s.items.map(i => ({ ...i, section: s.label })))
  return list.map(to => all.find(i => i.to === to)).filter((i): i is NavItem & { section: string } => !!i && (!i.module || can(i.module, 'view'))).slice(0, limit)
}
