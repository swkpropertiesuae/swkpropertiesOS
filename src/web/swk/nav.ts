import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard, LineChart, KanbanSquare, CalendarDays, Sparkles, Building2, Home, Rocket, Map, Landmark as DevIcon, Megaphone,
  UserPlus, Users, Target, PhoneCall, MessageCircle, Mail, FilePen, CalendarCheck, HandCoins, FileSignature, FileCheck, ShieldCheck,
  KeyRound, CalendarClock, Wallet, ReceiptText, Wrench, ClipboardCheck, DoorOpen, UserRoundCog, FileBarChart, Percent, Receipt, FileInput,
  Banknote, Scale, BadgeCheck, ScrollText, FileStack, Trophy, IdCard, Clock, Plane, Calculator, FileCode2, BarChart3, Settings,
  ShieldHalf, History, Plug, DatabaseBackup, Building, Gavel, Layers, ShieldAlert, CheckCheck, MapPinned, Briefcase, Star, PackageCheck,
  Smartphone, QrCode, Trash2, BookOpen,
} from 'lucide-react'
import { isRestrictedStaffUser, isAllowedPathForRestrictedStaff } from '@shared/swk-staff-access'

export type NavItem = { label: string; to: string; icon: LucideIcon; module?: string; isNew?: boolean; desc?: string }
export type NavSection = { key: string; label: string; items: NavItem[] }

/**
  * Simple English, workflow-ordered navigation for SWK Properties Business Workspace.
  * Every section orders its app icons step-by-step according to daily real estate workflow.
  */
export const SWK_NAV: NavSection[] = [
  { key: 'command', label: 'Dashboards', items: [
    { label: 'Overview', to: '/dashboard', icon: LayoutDashboard, module: 'dashboard', desc: 'Daily business summary' },
    { label: 'Deal Pipeline', to: '/pipeline', icon: KanbanSquare, module: 'sales', desc: 'Track deals step by step' },
    { label: 'Approvals', to: '/e/universal_approvals', icon: CheckCheck, module: 'projects', desc: 'Items waiting for sign-off' },
    { label: 'Delete Bin', to: '/recycle-bin', icon: Trash2, desc: 'Owner approval for deletions' },
    { label: 'Calendar', to: '/calendar', icon: CalendarDays, desc: 'Viewings & meetings' },
    { label: 'Daily Operations', to: '/enterprise/master-os', icon: ShieldCheck, desc: 'Company workflow control' },
    { label: 'Market Pulse', to: '/market', icon: LineChart, desc: 'Dubai prices & yields' },
    { label: 'SWK ONE Mobile', to: '/swk-one', icon: Smartphone, desc: 'Staff & agent mobile app' },
    { label: 'Reception QR', to: '/reception-qr', icon: QrCode, desc: 'Office reception check-in' },
    { label: 'AI Assistant', to: '/ai', icon: Sparkles, module: 'ai', desc: 'Smart daily helper' },
  ] },
  { key: 'inventory', label: 'Properties', items: [
    { label: 'New Submissions', to: '/e/inventory_submissions', icon: Building2, module: 'properties', desc: 'Step 1 · Agent property intake' },
    { label: 'Owner Permits', to: '/e/listing_mandates', icon: FileSignature, module: 'mandates', desc: 'Step 2 · Signed owner forms' },
    { label: 'Properties', to: '/e/properties', icon: Building2, module: 'properties', desc: 'Step 3 · Approved buildings & villas' },
    { label: 'Units', to: '/e/units', icon: Home, module: 'properties', desc: 'Step 4 · Apartments & offices' },
    { label: 'Listing Studio', to: '/listings', icon: Megaphone, module: 'properties', desc: 'Step 5 · Publish to portals' },
    { label: 'Off-Plan', to: '/offplan', icon: Rocket, module: 'properties', desc: 'New developer launches' },
    { label: 'Communities', to: '/e/communities', icon: Map, module: 'masters', desc: 'Dubai areas & districts' },
    { label: 'Developers', to: '/e/developers', icon: DevIcon, module: 'masters', desc: 'Master developers' },
  ] },
  { key: 'clients', label: 'CRM', items: [
    { label: 'Leads', to: '/e/leads', icon: UserPlus, module: 'crm', desc: 'Step 1 · New enquiries' },
    { label: 'Phone Calls', to: '/e/voice_calls', icon: PhoneCall, module: 'crm', desc: 'Step 2 · Call log & notes' },
    { label: 'WhatsApp', to: '/whatsapp', icon: MessageCircle, module: 'crm', desc: 'Step 3 · Live WhatsApp chat' },
    { label: 'Email', to: '/email', icon: Mail, module: 'crm', desc: 'Step 4 · Client email inbox' },
    { label: 'Follow-Ups', to: '/e/activities', icon: CalendarCheck, module: 'crm', desc: 'Step 5 · Tasks & callbacks' },
    { label: 'Opportunities', to: '/e/opportunities', icon: Target, module: 'crm', desc: 'Step 6 · Active requirements' },
    { label: 'Contacts', to: '/e/parties', icon: Users, module: 'crm', desc: 'Buyers, sellers & tenants' },
    { label: 'Messages Log', to: '/e/communications', icon: MessageCircle, module: 'crm', desc: 'All client messages' },
    { label: 'Campaigns', to: '/e/campaigns', icon: Megaphone, module: 'crm', desc: 'Marketing campaigns' },
    { label: 'Lead History', to: '/e/lead_assignment_logs', icon: History, module: 'crm', desc: 'Lead routing log' },
    { label: 'Reviews', to: '/e/qa_reviews', icon: Star, module: 'support', desc: 'Client service ratings' },
  ] },
  { key: 'sales', label: 'Sales & mandates', items: [
    { label: 'Seller Form A', to: '/e/mandates', icon: FilePen, module: 'mandates', desc: 'Step 1 · Seller agreement' },
    { label: 'Viewings', to: '/e/viewings', icon: CalendarCheck, module: 'mandates', desc: 'Step 2 · Property visits' },
    { label: 'Buyer Offers', to: '/e/offers', icon: HandCoins, module: 'transactions', desc: 'Step 3 · Client offers' },
    { label: 'Sale Contract (F)', to: '/e/sales_contracts', icon: FileCheck, module: 'transactions', desc: 'Step 4 · Signed Form F / MOU' },
    { label: 'Escrow', to: '/e/escrow_accounts', icon: ShieldCheck, module: 'transactions', desc: 'Step 5 · Deposit & escrow' },
    { label: 'Developer NOC', to: '/e/developer_requests', icon: FileCheck, module: 'transactions', desc: 'Step 6 · Developer clearance' },
    { label: 'DLD Transfer', to: '/e/dld_filings', icon: FileCheck, module: 'transactions', desc: 'Step 7 · Title deed transfer' },
    { label: 'Sales Tracker', to: '/e/transactions', icon: Briefcase, module: 'transactions', desc: 'Step 8 · Full sale progress' },
    { label: 'Deal Folders', to: '/e/jobs', icon: FileSignature, module: 'sales', desc: 'Step 9 · Closing & billing file' },
    { label: 'Withdrawals', to: '/withdrawals', icon: Scale, module: 'sales', desc: 'Step 10 · Deal cancellations & refunds' },
  ] },
  { key: 'leasing', label: 'Leasing & management', items: [
    { label: 'Leases & Ejari', to: '/e/leases', icon: KeyRound, module: 'leases', desc: 'Step 1 · Tenancy contracts' },
    { label: 'Rent Schedules', to: '/e/rent_schedules', icon: CalendarClock, module: 'leases', desc: 'Step 2 · Rent payment dates' },
    { label: 'Rent Cheques', to: '/pdc', icon: Wallet, module: 'leases', desc: 'Step 3 · Post-dated cheques' },
    { label: 'Rent Receipts', to: '/e/rent_receipts', icon: ReceiptText, module: 'leases', desc: 'Step 4 · Collected rent' },
    { label: 'Inspections', to: '/e/inspections', icon: ClipboardCheck, module: 'leases', desc: 'Step 5 · Move-in & move-out' },
    { label: 'Handovers', to: '/e/handovers', icon: DoorOpen, module: 'properties', desc: 'Step 6 · Keys & access cards' },
    { label: 'Maintenance', to: '/e/maintenance', icon: Wrench, module: 'leases', desc: 'Step 7 · Repairs & work orders' },
    { label: 'Service Charges', to: '/e/service_charges', icon: Layers, module: 'leases', desc: 'Step 8 · Building fees' },
  ] },
  { key: 'owners', label: 'Landlords', items: [
    { label: 'Landlord Hub', to: '/owners', icon: UserRoundCog, module: 'finance', desc: 'Step 1 · Portfolios & yields' },
    { label: 'Statements', to: '/e/owner_statements', icon: FileBarChart, module: 'finance', desc: 'Step 2 · Payout statements' },
  ] },
  { key: 'finance', label: 'Accounting', items: [
    { label: 'Invoices', to: '/e/invoices', icon: Receipt, module: 'finance', desc: 'Step 1 · Client tax invoices' },
    { label: 'Receipts', to: '/e/receipts', icon: HandCoins, module: 'finance', desc: 'Step 2 · Money received' },
    { label: 'Commissions', to: '/e/agent_commissions', icon: Percent, module: 'finance', desc: 'Step 3 · Agent deal shares' },
    { label: 'Agent Payouts', to: '/e/commission_entitlements', icon: Percent, module: 'finance', desc: 'Step 4 · Approved payouts' },
    { label: 'Supplier Bills', to: '/e/bills', icon: FileInput, module: 'finance', desc: 'Step 5 · Incoming bills' },
    { label: 'Payments', to: '/e/payments', icon: Banknote, module: 'finance', desc: 'Step 6 · Outgoing transfers' },
    { label: 'Purchases', to: '/e/procurement_requests', icon: PackageCheck, module: 'finance', desc: 'Step 7 · Office supplies' },
    { label: 'Bank Matching', to: '/e/bank_transactions', icon: Scale, module: 'finance', desc: 'Step 8 · Bank reconciliation' },
    { label: 'Profit & VAT', to: '/finance/statements', icon: FileBarChart, module: 'finance', desc: 'Step 9 · Financial reports' },
  ] },
  { key: 'compliance', label: 'Compliance', items: [
    { label: 'KYC Checks', to: '/e/kyc_checks', icon: ShieldCheck, module: 'compliance', desc: 'Step 1 · Client ID & screening' },
    { label: 'RERA Centre', to: '/rera', icon: Gavel, module: 'compliance', desc: 'Step 2 · Permits & forms' },
    { label: 'Broker Cards', to: '/e/agent_authorisations', icon: BadgeCheck, module: 'compliance', desc: 'Step 3 · Agent RERA licences' },
    { label: 'AML Reports', to: '/e/aml_reports', icon: ShieldAlert, module: 'compliance', desc: 'Step 4 · goAML filings' },
    { label: 'Risk Cases', to: '/e/compliance_cases', icon: ShieldAlert, module: 'compliance', desc: 'Step 5 · Compliance reviews' },
    { label: 'Trade Licences', to: '/compliance', icon: BadgeCheck, module: 'compliance', desc: 'Company renewal dates' },
    { label: 'Registrations', to: '/e/compliance_items', icon: ScrollText, module: 'documents', desc: 'Official certificates' },
    { label: 'File Vault', to: '/documents', icon: FileStack, module: 'documents', desc: 'All uploaded documents' },
  ] },
  { key: 'team', label: 'Employees', items: [
    { label: 'Staff List', to: '/e/employees', icon: Users, module: 'hr', desc: 'Step 1 · Employee profiles' },
    { label: 'Brokers (BRN)', to: '/e/agents', icon: IdCard, module: 'hr', desc: 'Step 2 · Sales & leasing agents' },
    { label: 'Joining & Exit', to: '/e/hr_lifecycle_cases', icon: Users, module: 'hr', desc: 'Step 3 · Onboarding checklist' },
    { label: 'Visas & IDs', to: '/e/immigration_cases', icon: Plane, module: 'hr', desc: 'Step 4 · Visas & Emirates ID' },
    { label: 'Attendance', to: '/e/attendance', icon: Clock, module: 'hr', desc: 'Step 5 · Daily check-in log' },
    { label: 'Leave', to: '/e/leave_requests', icon: Plane, module: 'hr', desc: 'Step 6 · Holiday & sick leave' },
    { label: 'Payroll (WPS)', to: '/e/payslips', icon: Banknote, module: 'hr', desc: 'Step 7 · Monthly salary slips' },
    { label: 'Leaderboard', to: '/agents', icon: Trophy, module: 'hr', desc: 'Top performing brokers' },
  ] },
  { key: 'field', label: 'Field Service', items: [
    { label: 'SWK ONE App', to: '/swk-one', icon: Smartphone, desc: 'Step 1 · Open mobile workspace' },
    { label: 'Reception QR', to: '/reception-qr', icon: QrCode, desc: 'Step 2 · Office QR check-in' },
    { label: 'Gate Logs', to: '/e/attendance_events', icon: Clock, module: 'hr', desc: 'Step 3 · Arrival & exit scans' },
    { label: 'Field Visits', to: '/e/field_sessions', icon: MapPinned, module: 'hr', desc: 'Step 4 · GPS site visits' },
    { label: 'Daily Reports', to: '/e/daily_reports', icon: ClipboardCheck, module: 'hr', desc: 'Step 5 · End-of-day summary' },
  ] },
  { key: 'tools', label: 'Documents & Manual', items: [
    { label: 'Company Manual', to: '/competency', icon: BookOpen, desc: 'Official SOPs, rules & knowledge base' },
    { label: 'Manual Articles', to: '/e/knowledge_articles', icon: ScrollText, desc: 'RERA, Wi-Fi & company guidelines' },
    { label: 'Calculators', to: '/toolkit', icon: Calculator, desc: 'DLD fee, ROI & mortgage tools' },
    { label: 'Letter Studio', to: '/studio', icon: FileCode2, module: 'documents', desc: 'Contracts & letter templates' },
    { label: 'Reports', to: '/reports', icon: BarChart3, module: 'reports', desc: 'Custom business exports' },
  ] },
  { key: 'admin', label: 'Settings', items: [
    { label: 'Company Info', to: '/admin/settings', icon: Settings, module: 'admin', desc: 'Logo, seal & company details' },
    { label: 'Branches', to: '/e/branches', icon: Building, module: 'admin', desc: 'Office locations & geofence' },
    { label: 'Roles & Access', to: '/admin/roles', icon: ShieldHalf, module: 'admin', desc: 'Staff permissions' },
    { label: 'Signing Rules', to: '/e/corporate_governance_items', icon: DevIcon, module: 'admin', desc: 'Approval limits & policies' },
    { label: 'Connections', to: '/admin/integrations', icon: Plug, module: 'admin', desc: 'WhatsApp, email & portals' },
    { label: 'Backups', to: '/admin/backup', icon: DatabaseBackup, module: 'admin', desc: 'Database backup & restore' },
    { label: 'Safety Checks', to: '/e/dr_exercises', icon: DatabaseBackup, module: 'admin', desc: 'Recovery drill logs' },
    { label: 'Activity Log', to: '/e/audit_events', icon: History, module: 'admin', desc: 'Security event history' },
    { label: 'Audit Trail', to: '/admin/audit', icon: History, module: 'admin', desc: 'Record change log' },
  ] },
]

export const QUICK_CREATE: { label: string; desc: string; to: string; icon: LucideIcon; module: string }[] = [
  { label: 'Open SWK ONE Mobile', desc: 'Staff & agent mobile workspace', to: '/swk-one', icon: Smartphone, module: 'dashboard' },
  { label: 'New Lead', desc: 'Add a buyer or tenant enquiry', to: '/e/leads?new=1', icon: UserPlus, module: 'crm' },
  { label: 'Submit Property', desc: 'Add a new property for review', to: '/e/inventory_submissions?new=1', icon: Building2, module: 'properties' },
  { label: 'Book Viewing', desc: 'Schedule a property visit', to: '/e/viewings?new=1', icon: CalendarCheck, module: 'mandates' },
  { label: 'New Sale File', desc: 'Start a property sale & transfer', to: '/e/transactions?new=1', icon: Briefcase, module: 'transactions' },
  { label: 'New Lease (Ejari)', desc: 'Create a tenancy contract', to: '/e/leases?new=1', icon: KeyRound, module: 'leases' },
  { label: 'Request NOC', desc: 'Apply for developer NOC', to: '/e/developer_requests?new=1', icon: FileCheck, module: 'transactions' },
  { label: 'Daily Report', desc: 'Submit today’s work summary', to: '/e/daily_reports?new=1', icon: ClipboardCheck, module: 'hr' },
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
  command: { blurb: 'Overview, deal pipeline, approvals & calendar', icon: LayoutDashboard, tone: 'navy' },
  inventory: { blurb: 'Submissions, owner permits, units & listings', icon: Building2, tone: 'champ' },
  clients: { blurb: 'Leads, calls, WhatsApp, email & follow-ups', icon: Users, tone: 'oasis' },
  sales: { blurb: 'Form A mandates, viewings, offers, NOC & transfer', icon: FileSignature, tone: 'champ' },
  leasing: { blurb: 'Leases, Ejari, rent schedules, cheques & repairs', icon: KeyRound, tone: 'navy' },
  owners: { blurb: 'Landlord portfolios, yields & payout statements', icon: UserRoundCog, tone: 'plum' },
  finance: { blurb: 'Invoices, receipts, commissions, bills & VAT', icon: Percent, tone: 'oasis' },
  compliance: { blurb: 'KYC checks, RERA permits, broker cards & AML', icon: Gavel, tone: 'dune' },
  team: { blurb: 'Staff, brokers, visas, attendance, leave & payroll', icon: Users, tone: 'ocean' },
  field: { blurb: 'SWK ONE mobile app, QR check-in & field visits', icon: MapPinned, tone: 'champ' },
  tools: { blurb: 'Deal calculators, contract studio & reports', icon: FileStack, tone: 'plum' },
  admin: { blurb: 'Company info, branches, roles, backups & logs', icon: Settings, tone: 'navy' },
}

export type LauncherApp = { key: string; label: string; blurb: string; icon: LucideIcon; tone: AppTone; items: NavItem[]; landing: string }

export const RESTRICTED_STAFF_LAUNCHER_APPS: LauncherApp[] = [
  {
    key: 'attendance',
    label: 'Attendance & QR',
    blurb: 'Daily Reception QR check-in, check-out, attendance history & leave',
    icon: QrCode,
    tone: 'champ',
    landing: '/reception-qr?scan=1',
    items: [
      { label: 'Scan Reception QR', to: '/reception-qr?scan=1', icon: QrCode, desc: 'Daily QR attendance check-in' },
      { label: 'My Attendance Log', to: '/e/attendance', icon: Clock, module: 'hr', desc: 'Personal daily check-in history' },
      { label: 'Gate Scan Events', to: '/e/attendance_events', icon: Clock, module: 'hr', desc: 'Verified QR & Wi-Fi timestamps' },
      { label: 'Leave Requests', to: '/e/leave_requests', icon: Plane, module: 'hr', desc: 'Apply for holiday or sick leave' },
      { label: 'Daily Work Summary', to: '/e/daily_reports', icon: ClipboardCheck, module: 'hr', desc: 'End-of-day activity report' },
    ],
  },
  {
    key: 'manual',
    label: 'Company Manual',
    blurb: 'SWK Properties handbook, RERA rules, SOPs & calculators',
    icon: BookOpen,
    tone: 'navy',
    landing: '/competency',
    items: [
      { label: 'Company Manual & SOPs', to: '/competency', icon: BookOpen, desc: 'Official staff handbook & knowledge test' },
      { label: 'SOP Articles', to: '/e/knowledge_articles', icon: ScrollText, desc: 'Company policies & procedures' },
      { label: 'Deal Calculators', to: '/toolkit', icon: Calculator, desc: 'DLD fee, ROI & mortgage calculator' },
    ],
  },
  {
    key: 'market_pulse',
    label: 'Market Pulse',
    blurb: 'Live Dubai community prices, rental yields, developers & DLD pulse',
    icon: LineChart,
    tone: 'oasis',
    landing: '/market',
    items: [
      { label: 'Market Pulse Live', to: '/market', icon: LineChart, desc: 'Dubai community prices & gross yields' },
      { label: 'Dubai Communities', to: '/e/communities', icon: Map, module: 'masters', desc: '24 prime Dubai districts' },
      { label: 'Master Developers', to: '/e/developers', icon: DevIcon, module: 'masters', desc: 'Emaar, Nakheel, Sobha, DAMAC & more' },
      { label: 'Market News', to: '/e/real_estate_news', icon: Megaphone, module: 'masters', desc: 'UAE property market updates' },
    ],
  },
  {
    key: 'general',
    label: 'General Workspace',
    blurb: 'SWK ONE mobile app, company calendar, AI assistant & profile',
    icon: Smartphone,
    tone: 'ocean',
    landing: '/swk-one',
    items: [
      { label: 'SWK ONE Mobile App', to: '/swk-one', icon: Smartphone, desc: 'Mobile attendance, manual & market pulse' },
      { label: 'Calendar', to: '/calendar', icon: CalendarDays, desc: 'Company schedule & events' },
      { label: 'AI Assistant', to: '/ai', icon: Sparkles, module: 'ai', desc: 'Internal SWK AI assistant' },
    ],
  },
]

/** Permission-filtered apps for the launcher. An app is hidden when none of its features are permitted. */
export function launcherApps(can: (module: string, action?: 'view') => boolean, user?: { email?: string | null; name?: string | null; role?: string | null; permissions?: any } | null): LauncherApp[] {
  if (user && isRestrictedStaffUser(user)) {
    return RESTRICTED_STAFF_LAUNCHER_APPS
  }
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
export function recentItems(can: (module: string, action?: 'view') => boolean, limit = 4, user?: { email?: string | null; name?: string | null; role?: string | null; permissions?: any } | null): (NavItem & { section: string })[] {
  let list: string[] = []
  try { list = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') } catch { /* ignore */ }
  const restricted = !!(user && isRestrictedStaffUser(user))
  const all = SWK_NAV.flatMap(s => s.items.map(i => ({ ...i, section: s.label })))
  return list
    .map(to => all.find(i => i.to === to))
    .filter((i): i is NavItem & { section: string } => !!i && (!i.module || can(i.module, 'view')) && (!restricted || isAllowedPathForRestrictedStaff(i.to)))
    .slice(0, limit)
}
