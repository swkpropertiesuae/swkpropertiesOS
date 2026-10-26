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

/** Real-estate-only navigation. `module` is the RBAC module checked with can(module, 'view'). */
export const SWK_NAV: NavSection[] = [
  { key: 'command', label: 'Command centre', items: [
    { label: 'Enterprise Master OS', to: '/enterprise/master-os', icon: ShieldCheck, isNew: true, desc: '35 modules, 10 workflows & command centre' },
    { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard, module: 'dashboard', desc: 'Your brokerage at a glance' },
    { label: 'Market Pulse', to: '/market', icon: LineChart, isNew: true, desc: 'DLD-style prices, yields & supply' },
    { label: 'Deal Pipeline', to: '/pipeline', icon: KanbanSquare, module: 'sales', isNew: true, desc: 'Lead → Form B → MOU → Transfer' },
    { label: 'Universal Approvals', to: '/e/universal_approvals', icon: CheckCheck, module: 'projects', isNew: true, desc: 'Four-eyes & maker-checker queue' },
    { label: 'Calendar', to: '/calendar', icon: CalendarDays, desc: 'Viewings, transfers & renewals' },
    { label: 'AI Concierge', to: '/ai', icon: Sparkles, module: 'ai', desc: 'AI team, briefings & approvals' },
  ] },
  { key: 'inventory', label: 'Inventory & listings', items: [
    { label: 'Daily Inventory Queue', to: '/e/inventory_submissions', icon: Building2, module: 'properties', isNew: true, desc: '3.07 sourcing & duplicate check' },
    { label: 'Listing Mandates & Prices', to: '/e/listing_mandates', icon: FileSignature, module: 'mandates', isNew: true, desc: '3.12 Form A, Trakheesi & price log' },
    { label: 'Listing Studio', to: '/listings', icon: Megaphone, module: 'properties', isNew: true, desc: 'Quality score, Trakheesi & portals' },
    { label: 'Properties', to: '/e/properties', icon: Building2, module: 'properties' },
    { label: 'Units', to: '/e/units', icon: Home, module: 'properties' },
    { label: 'Off-Plan Launches', to: '/offplan', icon: Rocket, module: 'properties', isNew: true, desc: 'Projects, payment plans & Oqood' },
    { label: 'Communities', to: '/e/communities', icon: Map, module: 'masters' },
    { label: 'Developers', to: '/e/developers', icon: DevIcon, module: 'masters' },
  ] },
  { key: 'clients', label: 'Clients & leads', items: [
    { label: 'Leads', to: '/e/leads', icon: UserPlus, module: 'crm' },
    { label: 'Lead Ownership Logs', to: '/e/lead_assignment_logs', icon: History, module: 'crm', isNew: true, desc: '3.31 immutable attribution trail' },
    { label: 'Contacts', to: '/e/parties', icon: Users, module: 'crm' },
    { label: 'Opportunities', to: '/e/opportunities', icon: Target, module: 'crm' },
    { label: 'Supervised Comms', to: '/e/communications', icon: MessageCircle, module: 'crm', isNew: true, desc: '3.09 WABA SLA & diversion flags' },
    { label: 'AI Voice Calls', to: '/e/voice_calls', icon: PhoneCall, module: 'crm', isNew: true, desc: '3.22 AI receptionist & call logs' },
    { label: 'QA & Client Reviews', to: '/e/qa_reviews', icon: Star, module: 'support', isNew: true, desc: '3.33 QA scoring & broker challenge' },
    { label: 'Calls & Activities', to: '/e/activities', icon: PhoneCall, module: 'crm' },
    { label: 'Campaigns', to: '/e/campaigns', icon: Megaphone, module: 'crm' },
    { label: 'WhatsApp', to: '/whatsapp', icon: MessageCircle, module: 'crm' },
    { label: 'Email', to: '/email', icon: Mail, module: 'crm' },
  ] },
  { key: 'sales', label: 'Sales & mandates', items: [
    { label: 'Enterprise Transactions', to: '/e/transactions', icon: Briefcase, module: 'transactions', isNew: true, desc: '3.13 stage gates & 11 exceptions' },
    { label: 'Developer NOC Centre', to: '/e/developer_requests', icon: FileCheck, module: 'transactions', isNew: true, desc: '3.08 NOC portal & closing gate' },
    { label: 'Mandates (Form A)', to: '/e/mandates', icon: FilePen, module: 'mandates' },
    { label: 'Viewings', to: '/e/viewings', icon: CalendarCheck, module: 'mandates' },
    { label: 'Offers', to: '/e/offers', icon: HandCoins, module: 'transactions' },
    { label: 'Deal Files', to: '/e/jobs', icon: FileSignature, module: 'sales' },
    { label: 'Sales Contracts (Form F)', to: '/e/sales_contracts', icon: FileCheck, module: 'transactions' },
    { label: 'Escrow Accounts', to: '/e/escrow_accounts', icon: ShieldCheck, module: 'transactions' },
  ] },
  { key: 'leasing', label: 'Leasing & management', items: [
    { label: 'Leases & Ejari', to: '/e/leases', icon: KeyRound, module: 'leases' },
    { label: 'Rent Schedules', to: '/e/rent_schedules', icon: CalendarClock, module: 'leases' },
    { label: 'PDC Cheque Vault', to: '/pdc', icon: Wallet, module: 'leases', isNew: true, desc: 'Post-dated cheques & deposits' },
    { label: 'Rent Receipts', to: '/e/rent_receipts', icon: ReceiptText, module: 'leases' },
    { label: 'Service Charges', to: '/e/service_charges', icon: Layers, module: 'leases' },
    { label: 'Maintenance', to: '/e/maintenance', icon: Wrench, module: 'leases' },
    { label: 'Inspections', to: '/e/inspections', icon: ClipboardCheck, module: 'leases' },
    { label: 'Handovers', to: '/e/handovers', icon: DoorOpen, module: 'properties' },
  ] },
  { key: 'owners', label: 'Owners & landlords', items: [
    { label: 'Owner 360', to: '/owners', icon: UserRoundCog, module: 'finance', isNew: true, desc: 'Portfolios, yields & statements' },
    { label: 'Owner Statements', to: '/e/owner_statements', icon: FileBarChart, module: 'finance' },
  ] },
  { key: 'finance', label: 'Commission & finance', items: [
    { label: 'Commission Entitlements', to: '/e/commission_entitlements', icon: Percent, module: 'finance', isNew: true, desc: '3.17 3-way payout & IBAN security' },
    { label: 'Agent Commissions', to: '/e/agent_commissions', icon: Percent, module: 'finance' },
    { label: 'Tax Invoices', to: '/e/invoices', icon: Receipt, module: 'finance' },
    { label: 'Receipts', to: '/e/receipts', icon: HandCoins, module: 'finance' },
    { label: 'Vendor Bills', to: '/e/bills', icon: FileInput, module: 'finance' },
    { label: 'Payments', to: '/e/payments', icon: Banknote, module: 'finance' },
    { label: 'Procurement & Facilities', to: '/e/procurement_requests', icon: PackageCheck, module: 'finance', isNew: true, desc: '3.25 POs, devices & SaaS' },
    { label: 'Bank & Reconciliation', to: '/e/bank_transactions', icon: Scale, module: 'finance' },
    { label: 'Financial Statements', to: '/finance/statements', icon: FileBarChart, module: 'finance' },
  ] },
  { key: 'compliance', label: 'RERA & compliance', items: [
    { label: 'RERA Centre', to: '/rera', icon: Gavel, module: 'compliance', isNew: true, desc: 'BRN, Trakheesi, Form A & AML' },
    { label: 'Risk, Fraud & DLP Cases', to: '/e/compliance_cases', icon: ShieldAlert, module: 'compliance', isNew: true, desc: '3.29/3.30/4.09 independent review' },
    { label: 'Broker Authorisations', to: '/e/agent_authorisations', icon: BadgeCheck, module: 'compliance', isNew: true, desc: '3.04/4.06 regulated activation' },
    { label: 'Licences & Filings', to: '/compliance', icon: BadgeCheck, module: 'compliance' },
    { label: 'Company Documents', to: '/e/company_documents', icon: ScrollText, module: 'documents' },
    { label: 'Document Vault', to: '/documents', icon: FileStack, module: 'documents' },
  ] },
  { key: 'team', label: 'Team', items: [
    { label: 'Daily Accountability', to: '/e/daily_reports', icon: ClipboardCheck, module: 'hr', isNew: true, desc: '3.06 system snapshot vs narrative' },
    { label: 'Visa, Immigration & PRO', to: '/e/immigration_cases', icon: Plane, module: 'hr', isNew: true, desc: '3.03 visa & work-permit workflow' },
    { label: 'Field Presence Sessions', to: '/e/field_sessions', icon: MapPinned, module: 'hr', isNew: true, desc: '3.10 work-hours duty location' },
    { label: 'Recruitment & Separation', to: '/e/hr_lifecycle_cases', icon: Users, module: 'hr', isNew: true, desc: '3.26/4.10 onboarding & offboarding' },
    { label: 'Agent Leaderboard', to: '/agents', icon: Trophy, module: 'hr', isNew: true, desc: 'GCI, conversion & licences' },
    { label: 'Agents (BRN)', to: '/e/agents', icon: IdCard, module: 'hr' },
    { label: 'Employees', to: '/e/employees', icon: Users, module: 'hr' },
    { label: 'Attendance', to: '/e/attendance', icon: Clock, module: 'hr' },
    { label: 'Attendance Events (QR)', to: '/e/attendance_events', icon: Clock, module: 'hr', isNew: true },
    { label: 'Leave', to: '/e/leave_requests', icon: Plane, module: 'hr' },
    { label: 'Payroll & WPS', to: '/e/payslips', icon: Banknote, module: 'hr' },
  ] },
  { key: 'tools', label: 'Tools & reports', items: [
    { label: 'UAE Deal Toolkit', to: '/toolkit', icon: Calculator, isNew: true, desc: 'DLD fees, mortgage, RERA rent, yield' },
    { label: 'Document Studio', to: '/studio', icon: FileCode2, module: 'documents' },
    { label: 'Reports', to: '/reports', icon: BarChart3, module: 'reports' },
  ] },
  { key: 'admin', label: 'Administration', items: [
    { label: 'Corporate Governance', to: '/e/corporate_governance_items', icon: DevIcon, module: 'admin', isNew: true, desc: '3.01 board, budgets & authorities' },
    { label: 'DR & Security Drills', to: '/e/dr_exercises', icon: DatabaseBackup, module: 'admin', isNew: true, desc: '3.35 RTO/RPO restore verification' },
    { label: 'Enterprise Audit Events', to: '/e/audit_events', icon: History, module: 'admin', isNew: true },
    { label: 'Settings', to: '/admin/settings', icon: Settings, module: 'admin' },
    { label: 'Roles & Access', to: '/admin/roles', icon: ShieldHalf, module: 'admin' },
    { label: 'Branches', to: '/e/branches', icon: Building, module: 'admin' },
    { label: 'Audit Trail', to: '/admin/audit', icon: History, module: 'admin' },
    { label: 'Integrations', to: '/admin/integrations', icon: Plug, module: 'admin' },
    { label: 'Backup & Data', to: '/admin/backup', icon: DatabaseBackup, module: 'admin' },
  ] },
]

export const QUICK_CREATE: { label: string; desc: string; to: string; icon: LucideIcon; module: string }[] = [
  { label: 'Submit daily report', desc: '3.06 workday outcomes & system snapshot', to: '/e/daily_reports?new=1', icon: ClipboardCheck, module: 'hr' },
  { label: 'Submit sourced unit', desc: '3.07 daily inventory acquisition queue', to: '/e/inventory_submissions?new=1', icon: Building2, module: 'properties' },
  { label: 'New lead', desc: 'Portal, WhatsApp or walk-in enquiry', to: '/e/leads?new=1', icon: UserPlus, module: 'crm' },
  { label: 'Book a viewing', desc: 'Schedule with client & agent', to: '/e/viewings?new=1', icon: CalendarCheck, module: 'mandates' },
  { label: 'Request Developer NOC', desc: '3.08 transaction-specific NOC clearance', to: '/e/developer_requests?new=1', icon: FileCheck, module: 'transactions' },
  { label: 'Open enterprise deal', desc: '3.13 controlled secondary or off-plan sale', to: '/e/transactions?new=1', icon: Briefcase, module: 'transactions' },
  { label: 'New lease (Ejari)', desc: 'Tenancy contract & cheques', to: '/e/leases?new=1', icon: KeyRound, module: 'leases' },
]

export function findNav(pathname: string) {
  let best: { section: NavSection; item: NavItem } | null = null
  for (const section of SWK_NAV) for (const item of section.items) {
    const p = item.to.split('?')[0]
    if (pathname === p || pathname.startsWith(p + '/')) if (!best || p.length > best.item.to.length) best = { section, item }
  }
  return best
}

/** Launcher ("Apps") presentation for each nav section — one tile per section on the post-sign-in home screen. */
export type AppTone = 'navy' | 'champ' | 'oasis' | 'ocean' | 'dune' | 'plum'
export const APP_META: Record<string, { blurb: string; icon: LucideIcon; tone: AppTone }> = {
  command: { blurb: 'Enterprise Master OS, dashboard, pipeline & four-eyes approvals', icon: LayoutDashboard, tone: 'navy' },
  inventory: { blurb: '3.07 inventory queue, 3.12 mandates, listings & off-plan', icon: Building2, tone: 'ocean' },
  clients: { blurb: 'Leads, 3.09 supervised WhatsApp, 3.22 AI voice & 3.33 QA', icon: Users, tone: 'oasis' },
  sales: { blurb: '3.13 transactions, 3.08 Developer NOCs, Form A/F & deals', icon: FileSignature, tone: 'champ' },
  leasing: { blurb: 'Ejari leases, PDC cheques & maintenance', icon: KeyRound, tone: 'navy' },
  owners: { blurb: 'Landlord portfolios, yields & statements', icon: UserRoundCog, tone: 'plum' },
  finance: { blurb: '3.17 3-way commissions, tax invoices, 3.25 procurement & bank', icon: Receipt, tone: 'oasis' },
  compliance: { blurb: 'RERA centre, 3.29/3.30 risk & DLP cases, 3.04 broker auth', icon: Gavel, tone: 'dune' },
  team: { blurb: '3.06 daily reports, 3.03 PRO visas, 3.10 field duty & payroll', icon: Trophy, tone: 'ocean' },
  tools: { blurb: 'Deal toolkit, Document Studio & reports', icon: Calculator, tone: 'champ' },
  admin: { blurb: '3.01 governance, 3.35 DR drills, roles, audit & integrations', icon: Settings, tone: 'plum' },
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
