import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard, LineChart, KanbanSquare, CalendarDays, Sparkles, Building2, Home, Rocket, Map, Landmark as DevIcon, Megaphone,
  UserPlus, Users, Target, PhoneCall, MessageCircle, Mail, FilePen, CalendarCheck, HandCoins, FileSignature, FileCheck, ShieldCheck,
  KeyRound, CalendarClock, Wallet, ReceiptText, Wrench, ClipboardCheck, DoorOpen, UserRoundCog, FileBarChart, Percent, Receipt, FileInput,
  Banknote, Scale, BadgeCheck, ScrollText, FileStack, Trophy, IdCard, Clock, Plane, Calculator, FileCode2, BarChart3, Settings,
  ShieldHalf, History, Plug, DatabaseBackup, Building, Gavel, Layers, ShieldAlert, CheckCheck, MapPinned, Briefcase, Star, PackageCheck,
  Smartphone, QrCode, Trash2, Newspaper,
} from 'lucide-react'

export type NavItem = { label: string; to: string; icon: LucideIcon; module?: string; isNew?: boolean; desc?: string }
export type NavSection = { key: string; label: string; items: NavItem[] }

/**
 * Logical UAE Real Estate Operating Sequence for SWK Properties:
 * 1. Command & 3 Core Departments (Off-Plan, Secondary, Leasing)
 * 2. Step 1–2: Inventory Sourcing (Dev / Seller / Landlord / 3rd-Party A2A) & Promote (Bayut & Dubizzle)
 * 3. Step 3–5: Platform Leads → Calls / Meetings / Follow-Ups → Site Visits (with Area Companion)
 * 4. Step 6–8: Conversion (Form F / SPA / Ejari) → Legal UAE Payment → Handover & 50/50 Commission Split
 * 5. Attendance (10:00 AM–7:00 PM, Sat 4:00 PM, Sun Holiday, 10:05 Grace), Daily Reports & HR
 * 6. Governance, Pending Delete Bin (Owner Shabib Siraj Approval), RERA & Accounting
 */
export const SWK_NAV: NavSection[] = [
  { key: 'command', label: '1. Command & 3 Departments', items: [
    { label: 'Executive Dashboard', to: '/dashboard', icon: LayoutDashboard, module: 'dashboard', desc: '3-Department overview, attendance, briefings & live KPIs' },
    { label: 'Dept 1: Off-Plan Projects', to: '/pipeline?dept=offplan', icon: Rocket, module: 'sales', isNew: true, desc: 'Sales of Off-Plan Projects workflow & developer launches' },
    { label: 'Dept 2: Secondary Projects', to: '/pipeline?dept=secondary', icon: Building2, module: 'sales', isNew: true, desc: 'Ready resale workflow: Seller/A2A → Cash/Mortgage → Form F → NOC' },
    { label: 'Dept 3: Leasing Department', to: '/pipeline?dept=leasing', icon: KeyRound, module: 'sales', isNew: true, desc: 'Bayut & Dubizzle ads → A2A match → PDC cheques → Ejari' },
    { label: 'All-Department Pipeline', to: '/pipeline', icon: KanbanSquare, module: 'sales', isNew: true, desc: 'Unified 8-stage UAE deal board across all 3 departments' },
    { label: 'Market Pulse & Area Companion', to: '/market', icon: LineChart, isNew: true, desc: '24 Dubai areas, daily DLD feed, 15Y outlook & site-visit closing pitch' },
    { label: 'Mortgage & Deal Calculator', to: '/toolkit', icon: Calculator, isNew: true, desc: 'UAE mortgage rates, DLD 4% fees, 50/50 commission & RERA calculators' },
    { label: 'SWK ONE Android App', to: '/swk-one', icon: Smartphone, isNew: true, desc: 'Attendance QR/GPS check-in, site visits & mandatory daily report checkout' },
    { label: 'Reception QR Terminal', to: '/reception-qr', icon: QrCode, isNew: true, desc: 'Office reception rotating QR check-in display (10:00 AM shift)' },
    { label: 'Pending Delete Bin & Approvals', to: '/recycle-bin', icon: Trash2, isNew: true, desc: 'Deletions & Manager decisions awaiting Owner Shabib Siraj approval' },
    { label: 'Deal Withdrawals & Refunds', to: '/withdrawals', icon: Scale, isNew: true, desc: 'Post-closing developer/client withdrawals & terms-based refunds' },
  ] },
  { key: 'inventory', label: '2. Inventory & Promote (Bayut/A2A)', items: [
    { label: 'Properties & 3rd-Party A2A', to: '/e/properties', icon: Building2, module: 'properties', desc: 'Developer, Seller, Landlord & 3rd-Party A2A inventory' },
    { label: 'Bayut & Dubizzle Studio', to: '/listings', icon: Megaphone, module: 'properties', isNew: true, desc: 'Promote listings on connected Bayut & Dubizzle accounts' },
    { label: 'Off-Plan Launches', to: '/offplan', icon: Rocket, module: 'properties', isNew: true, desc: 'Developer launches, EOI & payment plans' },
    { label: 'Seller Mandates (Form A)', to: '/e/mandates', icon: FilePen, module: 'mandates', desc: 'Detailed seller/landlord requirements & RERA Form A' },
    { label: 'Listing Mandates & Permits', to: '/e/listing_mandates', icon: FileSignature, module: 'mandates', isNew: true, desc: 'Trakheesi permits & owner authorization' },
    { label: 'Agent Property Submissions', to: '/e/inventory_submissions', icon: Building2, module: 'properties', isNew: true, desc: 'Field-sourced units submitted for verification' },
    { label: 'Units & Floorplans', to: '/e/units', icon: Home, module: 'properties', desc: 'Individual apartments, villas & commercial units' },
    { label: '24 Dubai Communities', to: '/e/communities', icon: Map, module: 'masters', desc: 'All 24 tracked Dubai master communities' },
    { label: 'Developers', to: '/e/developers', icon: DevIcon, module: 'masters', desc: 'Emaar, Nakheel, DAMAC, Sobha, Meraas & partners' },
  ] },
  { key: 'clients', label: '3. Leads, Follow-Ups & Visits', items: [
    { label: 'Platform Leads', to: '/e/leads', icon: UserPlus, module: 'crm', desc: 'Bayut, Dubizzle, Property Finder & WhatsApp enquiries' },
    { label: 'Calls, Meetings & Follow-Ups', to: '/e/activities', icon: PhoneCall, module: 'crm', desc: 'Call logs, client meetings & follow-up reminders' },
    { label: 'Site Visits & Viewings', to: '/e/viewings', icon: CalendarCheck, module: 'mandates', desc: 'Scheduled field visits with live GPS check-in & area companion' },
    { label: 'Buyer & Tenant Requirements', to: '/e/opportunities', icon: Target, module: 'crm', desc: 'Qualified client budgets, areas & A2A search triggers' },
    { label: 'Clients, Sellers & Landlords', to: '/e/parties', icon: Users, module: 'crm', desc: 'Verified buyers, sellers, landlords & 3rd-party agencies' },
    { label: 'WhatsApp Business Inbox', to: '/whatsapp', icon: MessageCircle, module: 'crm', desc: 'Live WhatsApp conversations & Owner briefings' },
    { label: 'Client Communications', to: '/e/communications', icon: MessageCircle, module: 'crm', isNew: true, desc: 'Multilingual follow-up log' },
    { label: 'Phone Call Recordings', to: '/e/voice_calls', icon: PhoneCall, module: 'crm', isNew: true, desc: 'Inbound & outbound call notes' },
    { label: 'Marketing Campaigns', to: '/e/campaigns', icon: Megaphone, module: 'crm', desc: 'Portal & social ad campaigns' },
    { label: 'Calendar & Schedule', to: '/calendar', icon: CalendarDays, desc: 'Site visits, follow-ups & transfer appointments' },
    { label: 'Company Email', to: '/email', icon: Mail, module: 'crm', desc: 'Connected SWK email inbox' },
  ] },
  { key: 'sales', label: '4. Closing, Form F & Transfers', items: [
    { label: 'Deal Files (3 Departments)', to: '/e/jobs', icon: FileSignature, module: 'sales', desc: 'Master deal folders with legal payment mode & 50/50 split' },
    { label: 'Buyer & Tenant Offers', to: '/e/offers', icon: HandCoins, module: 'transactions', desc: 'Cash, Mortgaged & Pre-Approved offers' },
    { label: 'Sales Contracts (Form F / MOU)', to: '/e/sales_contracts', icon: FileCheck, module: 'transactions', desc: 'Signed RERA Form F MOU & SPA agreements' },
    { label: 'Secondary Transfers & Sales', to: '/e/transactions', icon: Briefcase, module: 'transactions', isNew: true, desc: 'Conveyancing, mortgage valuation & DLD trustee transfer' },
    { label: 'Developer NOCs', to: '/e/developer_requests', icon: FileCheck, module: 'transactions', isNew: true, desc: 'Developer No-Objection Certificates for resale' },
    { label: 'Escrow Accounts', to: '/e/escrow_accounts', icon: ShieldCheck, module: 'transactions', desc: 'DLD project escrow & trust accounts' },
    { label: 'DLD Title Deeds & Oqood', to: '/e/dld_filings', icon: FileCheck, module: 'transactions', isNew: true, desc: 'Land Department title deed & Oqood registrations' },
    { label: 'Deal Withdrawals & Refunds', to: '/withdrawals', icon: Scale, module: 'sales', isNew: true, desc: 'Developer/client withdrawal refund calculator & Owner approval' },
    { label: 'Unit Handovers', to: '/e/handovers', icon: DoorOpen, module: 'properties', desc: 'Snagging, key handover & completion' },
  ] },
  { key: 'leasing', label: '5. Leasing, Ejari & PDCs', items: [
    { label: 'Leases & Ejari Contracts', to: '/e/leases', icon: KeyRound, module: 'leases', desc: 'Tenancy contracts, Ejari & 3rd-party A2A co-broking' },
    { label: 'PDC Cheque Vault', to: '/pdc', icon: Wallet, module: 'leases', isNew: true, desc: 'Post-dated rent cheques & deposit tracking' },
    { label: 'Rent Schedules', to: '/e/rent_schedules', icon: CalendarClock, module: 'leases', desc: 'Instalment due dates & renewal alerts' },
    { label: 'Rent Receipts', to: '/e/rent_receipts', icon: ReceiptText, module: 'leases', desc: 'Collected rent receipts' },
    { label: 'Landlord 360 Portfolio', to: '/owners', icon: UserRoundCog, module: 'finance', isNew: true, desc: 'Landlord properties & net yields' },
    { label: 'Owner Statements', to: '/e/owner_statements', icon: FileBarChart, module: 'finance', desc: 'Landlord income & expense statements' },
    { label: 'Service Charges', to: '/e/service_charges', icon: Layers, module: 'leases', desc: 'RERA Mollak service charge ledgers' },
    { label: 'Maintenance & Snagging', to: '/e/maintenance', icon: Wrench, module: 'leases', desc: 'Repair & maintenance tickets' },
    { label: 'Move-In / Out Inspections', to: '/e/inspections', icon: ClipboardCheck, module: 'leases', desc: 'Condition reports' },
  ] },
  { key: 'finance', label: '6. Legal Payments & 50/50 Split', items: [
    { label: '50/50 Agent Commissions', to: '/e/agent_commissions', icon: Percent, module: 'finance', desc: '50% SWK / 50% Sales Advisor split after 3rd-party A2A share' },
    { label: 'Commission Payouts', to: '/e/commission_entitlements', icon: Percent, module: 'finance', isNew: true, desc: 'Verified commission waterfall & A2A settlements' },
    { label: 'Legal Client Receipts', to: '/e/receipts', icon: HandCoins, module: 'finance', desc: 'Company Bank, Escrow, Manager Cheque, Exchange & VARA USDT (No personal accounts)' },
    { label: 'Tax Invoices (+5% VAT)', to: '/e/invoices', icon: Receipt, module: 'finance', desc: 'Developer, seller & landlord commission tax invoices' },
    { label: 'Vendor & A2A Bills', to: '/e/bills', icon: FileInput, module: 'finance', desc: '3rd-party A2A broker shares & portal invoices' },
    { label: 'Outgoing Payments', to: '/e/payments', icon: Banknote, module: 'finance', desc: 'Approved bank & refund disbursements' },
    { label: 'Bank & Reconciliation', to: '/e/bank_transactions', icon: Scale, module: 'finance', desc: 'Corporate bank accounts & statement matching' },
    { label: 'Financial Statements & VAT', to: '/finance/statements', icon: FileBarChart, module: 'finance', desc: 'Trial balance, P&L, Balance Sheet & UAE FTA VAT Return' },
    { label: 'Office Purchases', to: '/e/procurement_requests', icon: PackageCheck, module: 'finance', isNew: true, desc: 'Office & marketing procurement' },
  ] },
  { key: 'team', label: '7. Attendance, Reports & HR', items: [
    { label: 'SWK ONE Attendance App', to: '/swk-one', icon: Smartphone, isNew: true, desc: 'QR / Live GPS check-in, site visits & mandatory daily report checkout' },
    { label: 'Daily Attendance (10:05 Grace)', to: '/e/attendance', icon: Clock, module: 'hr', desc: 'Mon–Fri 10am–7pm, Sat 10am–4pm, Sun Holiday & Contemptor tracking' },
    { label: 'Daily Work Reports', to: '/e/daily_reports', icon: ClipboardCheck, module: 'hr', isNew: true, desc: 'Mandatory daily report required before staff checkout' },
    { label: 'Field Site-Visit GPS Logs', to: '/e/field_sessions', icon: MapPinned, module: 'hr', isNew: true, desc: 'Outside-office live location site-visit check-in & check-out' },
    { label: 'Attendance Event Stream', to: '/e/attendance_events', icon: Clock, module: 'hr', isNew: true, desc: 'Timestamped QR & GPS check-in/out audit events' },
    { label: 'Sales Advisors (BRN & 50/50)', to: '/e/agents', icon: IdCard, module: 'hr', desc: 'Advisors on Company Visa, 0 basic salary & 50–50% commission split' },
    { label: 'Employees & Leadership', to: '/e/employees', icon: Users, module: 'hr', desc: 'Shabib Siraj (Owner), Mohammad Haseeb (Manager), Talha Shabbir (BDM/IT) & Advisors' },
    { label: 'Agent Leaderboard', to: '/agents', icon: Trophy, module: 'hr', isNew: true, desc: 'Commission rankings & closing performance' },
    { label: 'Company Visas & Permits', to: '/e/immigration_cases', icon: Plane, module: 'hr', isNew: true, desc: 'UAE residency visas, Emirates ID & MOHRE cards' },
    { label: 'Leave Requests', to: '/e/leave_requests', icon: Plane, module: 'hr', desc: 'Annual & sick leave approvals' },
    { label: 'Payroll & Commission WPS', to: '/e/payslips', icon: Banknote, module: 'hr', desc: 'Commission payouts & WPS files' },
  ] },
  { key: 'compliance', label: '8. Audit, Bin, DLD & RERA', items: [
    { label: 'Pending Delete Bin (Recycle)', to: '/recycle-bin', icon: Trash2, isNew: true, desc: 'Pending deletions & Manager decisions awaiting Owner Shabib Siraj' },
    { label: 'System Audit Log', to: '/admin/audit', icon: History, module: 'admin', desc: 'Every create, edit (with mandatory reason) & delete logged' },
    { label: 'Daily DLD Transactions', to: '/e/dld_market_transactions', icon: DevIcon, isNew: true, desc: 'Daily Dubai Land Department sales & Oqood open-data feed' },
    { label: 'Dubai Real Estate News', to: '/e/real_estate_news', icon: Newspaper, isNew: true, desc: 'Live market news, DLD updates & client pitch talking points' },
    { label: 'RERA Compliance Centre', to: '/rera', icon: Gavel, module: 'compliance', isNew: true, desc: 'ORN, BRN, Trakheesi permits & RERA rules' },
    { label: 'KYC & Client Verification', to: '/e/kyc_checks', icon: ShieldCheck, module: 'compliance', isNew: true, desc: 'Passport, Emirates ID & sanctions screening' },
    { label: 'goAML Reports', to: '/e/aml_reports', icon: ShieldAlert, module: 'compliance', isNew: true, desc: 'UAE FIU goAML cash/crypto threshold reporting' },
    { label: 'Document Studio & Vault', to: '/studio', icon: FileCode2, module: 'documents', desc: 'Contract templates, NOCs & document archive' },
    { label: 'Roles & Hierarchy', to: '/admin/roles', icon: ShieldHalf, module: 'admin', desc: 'Owner, Manager, BDM & IT Admin, and Sales Advisor permissions' },
    { label: 'Settings & Integrations', to: '/admin/settings', icon: Settings, module: 'admin', desc: 'Company profile, WhatsApp briefings, Bayut/Dubizzle & backups' },
  ] },
]

export const QUICK_CREATE: { label: string; desc: string; to: string; icon: LucideIcon; module: string }[] = [
  { label: 'Open SWK ONE Attendance & Field App', desc: 'QR / Live GPS check-in, site visits & daily report checkout', to: '/swk-one', icon: Smartphone, module: 'dashboard' },
  { label: 'Submit Daily Work Report', desc: 'Required before 7:00 PM (Sat 4:00 PM) checkout', to: '/e/daily_reports?new=1', icon: ClipboardCheck, module: 'hr' },
  { label: 'Add Property / 3rd-Party A2A Unit', desc: 'Off-Plan, Secondary Seller, or 3rd-Party A2A inventory', to: '/e/properties?new=1', icon: Building2, module: 'properties' },
  { label: 'New Platform Lead', desc: 'Log Bayut, Dubizzle, Property Finder or WhatsApp lead', to: '/e/leads?new=1', icon: UserPlus, module: 'crm' },
  { label: 'Schedule Site Visit (Viewing)', desc: 'Book field visit with live GPS & Area Companion brief', to: '/e/viewings?new=1', icon: CalendarCheck, module: 'mandates' },
  { label: 'Open New Deal File (50/50 Split)', desc: 'Off-Plan, Secondary Form F, or Leasing Ejari deal', to: '/e/jobs?new=1', icon: FileSignature, module: 'sales' },
  { label: 'Log Deal Withdrawal / Refund', desc: 'Developer, Seller or Client withdrawal & refund calculation', to: '/withdrawals', icon: Scale, module: 'sales' },
  { label: 'Pending Delete Bin & Owner Sign-Off', desc: 'Review deletions & Manager decisions for Owner Shabib Siraj', to: '/recycle-bin', icon: Trash2, module: 'dashboard' },
]

export function findNav(pathname: string) {
  let best: { section: NavSection; item: NavItem } | null = null
  for (const section of SWK_NAV) for (const item of section.items) {
    const p = item.to.split('?')[0]
    if (pathname === p || pathname.startsWith(p + '/')) if (!best || p.length > best.item.to.length) best = { section, item }
  }
  return best
}

export type AppTone = 'navy' | 'champ' | 'oasis' | 'ocean' | 'dune' | 'plum'
export const APP_META: Record<string, { blurb: string; icon: LucideIcon; tone: AppTone }> = {
  command: { blurb: 'Executive Dashboard, 3 Departments (Off-Plan, Secondary, Leasing), Market Pulse & SWK ONE', icon: LayoutDashboard, tone: 'navy' },
  inventory: { blurb: 'Developer, Seller & 3rd-Party A2A Inventory + Bayut & Dubizzle Promotion', icon: Building2, tone: 'ocean' },
  clients: { blurb: 'Platform Leads, Calls, Follow-Ups, Site Visits & WhatsApp Inbox', icon: Users, tone: 'oasis' },
  sales: { blurb: 'Form F (MOU), NOCs, DLD Transfers, Legal Payments & Deal Withdrawals', icon: FileSignature, tone: 'champ' },
  leasing: { blurb: 'Leasing, Bayut/Dubizzle A2A Match, PDC Cheque Vault & Ejari', icon: KeyRound, tone: 'navy' },
  finance: { blurb: '50–50% Net Commission Split, A2A Shares, Legal Receipts & UAE VAT', icon: Percent, tone: 'oasis' },
  team: { blurb: '10am–7pm Attendance (10:05 Grace), Site-Visit GPS, Daily Reports & Company Visas', icon: Clock, tone: 'ocean' },
  compliance: { blurb: 'Pending Delete Bin (Owner Approval), Audit Trail, Daily DLD & RERA', icon: Gavel, tone: 'dune' },
}

export type LauncherApp = { key: string; label: string; blurb: string; icon: LucideIcon; tone: AppTone; items: NavItem[]; landing: string }

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
export function rememberVisit(pathname: string) {
  const hit = findNav(pathname)
  if (!hit) return
  try {
    const list: string[] = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
    localStorage.setItem(RECENT_KEY, JSON.stringify([hit.item.to, ...list.filter(t => t !== hit.item.to)].slice(0, 8)))
  } catch { /* ignore */ }
}
export function recentItems(can: (module: string, action?: 'view') => boolean, limit = 4): (NavItem & { section: string })[] {
  let list: string[] = []
  try { list = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') } catch { /* ignore */ }
  const all = SWK_NAV.flatMap(s => s.items.map(i => ({ ...i, section: s.label })))
  return list.map(to => all.find(i => i.to === to)).filter((i): i is NavItem & { section: string } => !!i && (!i.module || can(i.module, 'view'))).slice(0, limit)
}
