/**
 * Hardcoded SWK Properties Staff Accounts & Role-Based Access Policy
 *
 * Official Policy:
 * - Full Operational & Administrative Access:
 *   1. Shabib Siraj (Owner & Managing Director / Admin)
 *   2. Mohammad Haseeb (Operations Manager — Haseeb@swk.property)
 * - Restricted Staff Access (Attendance, Company Manual, Market Pulse & General Only):
 *   - Talha@swk.property (Talha123)
 *   - Fareed@swk.property (Fareed123)
 *   - Shahid@swk.property (Shahid123)
 *   - Umar@swk.property (Umar123)
 *   - Saifullah@swk.property (Saifullah123)
 *   - Any other staff account that is not Shabib Siraj (Admin) or Mohammad Haseeb.
 */

export interface SwkHardcodedStaffAccount {
  email: string
  displayEmail: string
  aliases: string[]
  password: string
  name: string
  empNo: string
  roleName: 'Admin' | 'Manager' | 'Staff (Attendance & General)'
  departmentCode: string
  designation: string
  phone: string
  fullAccess: boolean
}

export const SWK_STAFF_ACCOUNTS: readonly SwkHardcodedStaffAccount[] = [
  {
    email: 'haseeb@swk.property',
    displayEmail: 'Haseeb@swk.property',
    aliases: ['haseeb@swkpropertiesuae.com', 'manager@swkpropertiesuae.com'],
    password: 'Haseeb123',
    name: 'Mohammad Haseeb',
    empNo: 'EMP-HASEEB',
    roleName: 'Manager',
    departmentCode: 'OPS',
    designation: 'Operations Manager',
    phone: '+971 50 100 0002',
    fullAccess: true,
  },
  {
    email: 'talha@swk.property',
    displayEmail: 'Talha@swk.property',
    aliases: ['talha@swkpropertiesuae.com'],
    password: 'Talha123',
    name: 'Talha Shabbir',
    empNo: 'EMP-TALHA',
    roleName: 'Staff (Attendance & General)',
    departmentCode: 'IT',
    designation: 'BDM & Digital Operations',
    phone: '+971 50 100 0003',
    fullAccess: false,
  },
  {
    email: 'fareed@swk.property',
    displayEmail: 'Fareed@swk.property',
    aliases: ['fareed@swkpropertiesuae.com'],
    password: 'Fareed123',
    name: 'Fareed',
    empNo: 'EMP-FAREED',
    roleName: 'Staff (Attendance & General)',
    departmentCode: 'SAL',
    designation: 'Property Consultant',
    phone: '+971 50 100 0004',
    fullAccess: false,
  },
  {
    email: 'shahid@swk.property',
    displayEmail: 'Shahid@swk.property',
    aliases: ['shahid@swkpropertiesuae.com'],
    password: 'Shahid123',
    name: 'Shahid',
    empNo: 'EMP-SHAHID',
    roleName: 'Staff (Attendance & General)',
    departmentCode: 'SAL',
    designation: 'Property Consultant',
    phone: '+971 50 100 0005',
    fullAccess: false,
  },
  {
    email: 'umar@swk.property',
    displayEmail: 'Umar@swk.property',
    aliases: ['umar@swkpropertiesuae.com'],
    password: 'Umar123',
    name: 'Umar',
    empNo: 'EMP-UMAR',
    roleName: 'Staff (Attendance & General)',
    departmentCode: 'SAL',
    designation: 'Property Consultant',
    phone: '+971 50 100 0006',
    fullAccess: false,
  },
  {
    email: 'saifullah@swk.property',
    displayEmail: 'Saifullah@swk.property',
    aliases: ['saifullah@swkpropertiesuae.com'],
    password: 'Saifullah123',
    name: 'Saifullah',
    empNo: 'EMP-SAIFULLAH',
    roleName: 'Staff (Attendance & General)',
    departmentCode: 'SAL',
    designation: 'Property Consultant',
    phone: '+971 50 100 0007',
    fullAccess: false,
  },
] as const

const FULL_ACCESS_EMAILS = new Set<string>([
  'admin@swkpropertiesuae.com',
  'shabib@swkpropertiesuae.com',
  'shabib@swk.property',
  'admin@swk.property',
  'haseeb@swk.property',
  'haseeb@swkpropertiesuae.com',
  'manager@swkpropertiesuae.com',
  'demo@swkpropertiesuae.com',
])

const RESTRICTED_STAFF_EMAILS = new Set<string>([
  'talha@swk.property',
  'talha@swkpropertiesuae.com',
  'fareed@swk.property',
  'fareed@swkpropertiesuae.com',
  'shahid@swk.property',
  'shahid@swkpropertiesuae.com',
  'umar@swk.property',
  'umar@swkpropertiesuae.com',
  'saifullah@swk.property',
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
  return e.endsWith('@swk.property') || e.endsWith('@swkpropertiesuae.com')
}

/**
 * Hardcoded check: ONLY Admin (Shabib Siraj) and Haseeb (Mohammad Haseeb) have full operational access.
 * Every other staff account is strictly limited to Attendance, Company Manual, Market Pulse, and General features.
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
  const email = String(user.email || '').trim().toLowerCase()
  const role = String(user.role_name || user.role || '').trim().toLowerCase()
  if (RESTRICTED_STAFF_EMAILS.has(email)) return true
  if (role === 'staff (attendance & general)') return true
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
  ])
  if (exactAllowed.has(clean)) return true
  if (
    clean.startsWith('/reception-qr/') ||
    clean.startsWith('/swk/reception-qr/') ||
    clean.startsWith('/qr-reception/') ||
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
