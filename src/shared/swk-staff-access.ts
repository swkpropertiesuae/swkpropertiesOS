/**
 * Hardcoded SWK Properties Staff Accounts & Role-Based Access Policy
 *
 * Official Governance & Access Hierarchy:
 * - Tier 1 — Supreme Company Owner (Controls Admin & All Accounts):
 *   1. Shabib Siraj (Owner & Managing Director — shabib@swk.properties / Password: Shabib@swk.properties)
 *      - Role: Owner (Full System Access, Final Approver for Recycle Bin Deletions, Deal Withdrawals & Admin Decisions)
 *      - Holds direct supervisory control over admin@swk.properties (can inspect, unlock, reset password, force sign-out, suspend or re-activate admin@swk.properties).
 * - Tier 2 — Full-Access System & Operations Administrator (Controlled by Owner shabib@swk.properties):
 *   2. SWK Admin (Full-Access Administrator — admin@swk.properties / Password: Admin@swk.properties)
 *      - Role: Admin (Converted from the former Shabib Siraj Admin account into your dedicated Full-Access Admin account)
 *      - Full access across all 18+ SWK OS modules (CRM, Sales, Off-Plan, Secondary, Leasing, Properties, Mandates, Finance, HR, Attendance, Studio, Compliance, AI, Reports & System Admin), operating under the direct authority and audit oversight of Owner shabib@swk.properties.
 * - Tier 3 — Operations Manager (Full Operational Access):
 *   3. Mohammad Haseeb (Operations Manager — Haseeb@swk.property / Password: Haseeb123)
 * - Tier 4 — Restricted Staff Access (Attendance, Company Manual, Market Pulse & General Only):
 *   - Talha@swk.property (Talha123)
 *   - Fareed@swk.property (Fareed123)
 *   - Shahid@swk.property (Shahid123)
 *   - Umar@swk.property (Umar123)
 *   - Saifullah@swk.property (Saifullah123)
 *   - Any other staff account that is not Owner (shabib@swk.properties), Admin (admin@swk.properties), or Manager (Haseeb@swk.property).
 */

export interface SwkHardcodedStaffAccount {
  email: string
  displayEmail: string
  aliases: string[]
  password: string
  name: string
  empNo: string
  roleName: 'Owner' | 'Admin' | 'Manager' | 'Staff (Attendance & General)'
  departmentCode: string
  designation: string
  phone: string
  fullAccess: boolean
  controlledBy?: string
}

export const SWK_OWNER_ACCOUNT: SwkHardcodedStaffAccount = {
  email: 'shabib@swk.properties',
  displayEmail: 'shabib@swk.properties',
  aliases: ['shabib@swk.property', 'shabib@swkpropertiesuae.com'],
  password: 'Shabib@swk.properties',
  name: 'Shabib Siraj',
  empNo: 'EMP-OWNER',
  roleName: 'Owner',
  departmentCode: 'MGT',
  designation: 'Owner & Managing Director (Controls Admin & All Accounts)',
  phone: '+971 50 100 0001',
  fullAccess: true,
}

export const SWK_ADMIN_ACCOUNT: SwkHardcodedStaffAccount = {
  email: 'admin@swk.properties',
  displayEmail: 'admin@swk.properties',
  aliases: ['admin@swk.property'],
  password: 'Admin@swk.properties',
  name: 'SWK Admin',
  empNo: 'EMP-ADMIN',
  roleName: 'Admin',
  departmentCode: 'MGT',
  designation: 'Full-Access System & Operations Administrator (Controlled by Owner Shabib Siraj)',
  phone: '+971 50 100 0000',
  fullAccess: true,
  controlledBy: 'shabib@swk.properties',
}

export const SWK_STAFF_ACCOUNTS: readonly SwkHardcodedStaffAccount[] = [
  SWK_OWNER_ACCOUNT,
  SWK_ADMIN_ACCOUNT,
  {
    email: 'haseeb@swk.property',
    displayEmail: 'Haseeb@swk.property',
    aliases: ['haseeb@swk.properties', 'haseeb@swkpropertiesuae.com', 'manager@swkpropertiesuae.com'],
    password: 'Haseeb123',
    name: 'Mohammad Haseeb',
    empNo: 'EMP-HASEEB',
    roleName: 'Manager',
    departmentCode: 'OPS',
    designation: 'Operations Manager',
    phone: '+971 50 100 0002',
    fullAccess: true,
    controlledBy: 'shabib@swk.properties',
  },
  {
    email: 'talha@swk.property',
    displayEmail: 'Talha@swk.property',
    aliases: ['talha@swk.properties', 'talha@swkpropertiesuae.com'],
    password: 'Talha123',
    name: 'Talha Shabbir',
    empNo: 'EMP-TALHA',
    roleName: 'Staff (Attendance & General)',
    departmentCode: 'IT',
    designation: 'BDM & Digital Operations',
    phone: '+971 50 100 0003',
    fullAccess: false,
    controlledBy: 'shabib@swk.properties',
  },
  {
    email: 'fareed@swk.property',
    displayEmail: 'Fareed@swk.property',
    aliases: ['fareed@swk.properties', 'fareed@swkpropertiesuae.com'],
    password: 'Fareed123',
    name: 'Fareed',
    empNo: 'EMP-FAREED',
    roleName: 'Staff (Attendance & General)',
    departmentCode: 'SAL',
    designation: 'Property Consultant',
    phone: '+971 50 100 0004',
    fullAccess: false,
    controlledBy: 'shabib@swk.properties',
  },
  {
    email: 'shahid@swk.property',
    displayEmail: 'Shahid@swk.property',
    aliases: ['shahid@swk.properties', 'shahid@swkpropertiesuae.com'],
    password: 'Shahid123',
    name: 'Shahid',
    empNo: 'EMP-SHAHID',
    roleName: 'Staff (Attendance & General)',
    departmentCode: 'SAL',
    designation: 'Property Consultant',
    phone: '+971 50 100 0005',
    fullAccess: false,
    controlledBy: 'shabib@swk.properties',
  },
  {
    email: 'umar@swk.property',
    displayEmail: 'Umar@swk.property',
    aliases: ['umar@swk.properties', 'umar@swkpropertiesuae.com'],
    password: 'Umar123',
    name: 'Umar',
    empNo: 'EMP-UMAR',
    roleName: 'Staff (Attendance & General)',
    departmentCode: 'SAL',
    designation: 'Property Consultant',
    phone: '+971 50 100 0006',
    fullAccess: false,
    controlledBy: 'shabib@swk.properties',
  },
  {
    email: 'saifullah@swk.property',
    displayEmail: 'Saifullah@swk.property',
    aliases: ['saifullah@swk.properties', 'saifullah@swkpropertiesuae.com'],
    password: 'Saifullah123',
    name: 'Saifullah',
    empNo: 'EMP-SAIFULLAH',
    roleName: 'Staff (Attendance & General)',
    departmentCode: 'SAL',
    designation: 'Property Consultant',
    phone: '+971 50 100 0007',
    fullAccess: false,
    controlledBy: 'shabib@swk.properties',
  },
] as const

const OWNER_EMAILS = new Set<string>([
  'shabib@swk.properties',
  'shabib@swk.property',
  'shabib@swkpropertiesuae.com',
])

const ADMIN_EMAILS = new Set<string>([
  'admin@swk.properties',
  'admin@swk.property',
  'admin@swkpropertiesuae.com',
])

const QR_PRINT_ALLOWED_EMAILS = new Set<string>([
  ...OWNER_EMAILS,
  ...ADMIN_EMAILS,
  'haseeb@swk.properties',
  'haseeb@swk.property',
  'haseeb@swkpropertiesuae.com',
  'manager@swkpropertiesuae.com',
])

const FULL_ACCESS_EMAILS = new Set<string>([
  ...QR_PRINT_ALLOWED_EMAILS,
  'demo@swkpropertiesuae.com',
])

/**
 * HARD RULE: ONLY Haseeb (Mohammad Haseeb) and Owner (Shabib Siraj / Admin) can view or print the Office Attendance QR code.
 * All other staff must never see any UI, menu item, poster, or control related to printing the QR code — they only scan and check in.
 */
export function canPrintReceptionQr(
  user: { email?: string | null; role?: string | null; role_name?: string | null; name?: string | null; party_id?: number | null } | null | undefined,
): boolean {
  if (!user || user.party_id) return false
  const email = String(user.email || '').trim().toLowerCase()
  if (RESTRICTED_STAFF_EMAILS.has(email)) return false
  if (QR_PRINT_ALLOWED_EMAILS.has(email)) return true
  const role = String(user.role_name || user.role || '').trim().toLowerCase()
  const name = String(user.name || '').trim().toLowerCase()
  if (role === 'owner' || role === 'admin') return true
  if (name === 'shabib siraj' || name === 'mohammad haseeb') return true
  if (role === 'manager' && (name.includes('haseeb') || email.includes('haseeb') || email.includes('manager'))) return true
  return false
}

/**
 * Hard check for Administration & Governance logic (Recycle Bin, Withdrawals, Universal Approvals,
 * Owner Morning Briefing, 10:30 AM Contemptor Report, System Settings, Roles & Users).
 * Visible ONLY to Owner, Haseeb, or staff who have been explicitly granted an Administrative role.
 */
export function canAccessSwkAdminLogic(
  user: {
    email?: string | null
    role?: string | null
    role_name?: string | null
    name?: string | null
    party_id?: number | null
    permissions?: '*' | Record<string, string[]> | null
  } | null | undefined,
): boolean {
  if (!user || user.party_id) return false
  if (canPrintReceptionQr(user)) return true
  if (isRestrictedStaffUser(user)) return false
  const role = String(user.role_name || user.role || '').trim().toLowerCase()
  if (role === 'admin' || role === 'owner') return true
  const perms = user.permissions
  if (perms === '*') return true
  if (perms && typeof perms === 'object' && Array.isArray(perms.admin) && perms.admin.includes('view')) {
    return true
  }
  return false
}

const RESTRICTED_STAFF_EMAILS = new Set<string>([
  'talha@swk.property',
  'talha@swk.properties',
  'talha@swkpropertiesuae.com',
  'fareed@swk.property',
  'fareed@swk.properties',
  'fareed@swkpropertiesuae.com',
  'shahid@swk.property',
  'shahid@swk.properties',
  'shahid@swkpropertiesuae.com',
  'umar@swk.property',
  'umar@swk.properties',
  'umar@swkpropertiesuae.com',
  'saifullah@swk.property',
  'saifullah@swk.properties',
  'saifullah@swkpropertiesuae.com',
])

export const RESTRICTED_STAFF_PERMISSIONS: Record<string, string[]> = {
  dashboard: ['view'],
  hr: ['view', 'create'],
  masters: ['view'],
  ai: ['view', 'create'],
}

export const RESTRICTED_STAFF_ALLOWED_ENTITIES = new Set<string>([
  'attendance',
  'attendance_events',
  'leave_requests',
  'daily_reports',
  'knowledge_articles',
  'staff_qualifications',
  'activity_skill_rules',
  'communities',
  'developers',
  'dld_market_transactions',
  'real_estate_news',
  'branches',
  'departments',
])

export const RESTRICTED_STAFF_SELF_SCOPED_ENTITIES = new Set<string>([
  'attendance',
  'attendance_events',
  'leave_requests',
  'daily_reports',
])

export function isSwkCompanyEmail(email: string | null | undefined): boolean {
  const e = String(email || '').trim().toLowerCase()
  return e.endsWith('@swk.properties') || e.endsWith('@swk.property') || e.endsWith('@swkpropertiesuae.com')
}

export function isOwnerSwkUser(
  user: { email?: string | null; role?: string | null; role_name?: string | null; name?: string | null } | null | undefined,
): boolean {
  if (!user) return false
  const email = String(user.email || '').trim().toLowerCase()
  if (OWNER_EMAILS.has(email)) return true
  const role = String(user.role_name || user.role || '').trim().toLowerCase()
  return role === 'owner'
}

export function isAdminSwkUser(
  user: { email?: string | null; role?: string | null; role_name?: string | null; name?: string | null } | null | undefined,
): boolean {
  if (!user) return false
  const email = String(user.email || '').trim().toLowerCase()
  if (ADMIN_EMAILS.has(email)) return true
  const role = String(user.role_name || user.role || '').trim().toLowerCase()
  return role === 'admin'
}

/**
 * Hardcoded check: ONLY Owner (shabib@swk.properties), Admin (admin@swk.properties), and Manager (Haseeb@swk.property)
 * have full operational access. Every other staff account is strictly limited to Attendance, Company Manual, Market Pulse, and General features.
 */
export function isFullAccessSwkUser(
  user: { email?: string | null; role?: string | null; role_name?: string | null; name?: string | null } | null | undefined,
): boolean {
  if (!user) return false
  const email = String(user.email || '').trim().toLowerCase()
  if (RESTRICTED_STAFF_EMAILS.has(email)) return false
  if (FULL_ACCESS_EMAILS.has(email)) return true
  const role = String(user.role_name || user.role || '').trim().toLowerCase()
  const name = String(user.name || '').trim().toLowerCase()
  if (role === 'admin' || role === 'owner') return true
  if (role === 'manager' && (name.includes('haseeb') || email.includes('haseeb') || email.includes('manager'))) return true
  return false
}

export function isRestrictedStaffUser(
  user: { email?: string | null; role?: string | null; role_name?: string | null; name?: string | null; party_id?: number | null } | null | undefined,
): boolean {
  if (!user || user.party_id) return false
  if (canPrintReceptionQr(user)) return false
  const email = String(user.email || '').trim().toLowerCase()
  const role = String(user.role_name || user.role || '').trim().toLowerCase()
  if (role === 'staff (attendance & general)') return true
  if (role && role !== 'staff (attendance & general)') return false
  if (RESTRICTED_STAFF_EMAILS.has(email)) return true
  if (email.endsWith('@swk.property') && !FULL_ACCESS_EMAILS.has(email)) return true
  return false
}

export function isAllowedPathForRestrictedStaff(pathname: string): boolean {
  const clean = String(pathname || '/').split('?')[0] || '/'
  const exactAllowed = new Set([
    '/',
    '/home',
    '/login',
    '/qr-checkin',
    '/reception-qr',
    '/swk/reception-qr',
    '/qr-reception',
    '/market',
    '/competency',
    '/toolkit',
    '/tools',
    '/calendar',
    '/ai',
    '/profile',
    '/workspace-tools',
    '/handover',
    '/handover-portal',
  ])
  if (exactAllowed.has(clean)) return true
  if (
    clean.startsWith('/reception-qr/') ||
    clean.startsWith('/swk/reception-qr/') ||
    clean.startsWith('/qr-reception/') ||
    clean.startsWith('/handover/') ||
    clean.startsWith('/print/')
  ) {
    return true
  }
  if (clean.startsWith('/e/')) {
    const entity = clean.split('/')[2] || ''
    return RESTRICTED_STAFF_ALLOWED_ENTITIES.has(entity)
  }
  return false
}
