import { q } from '../db'
import { createRecord, getDef, SYSTEM_CTX } from '../engine'
import { getSetting, setSettings } from '../settings'
import { addDays, todayStr } from '../util'

type Item = { type: string; name: string; reference_no?: string; authority?: string; status: string; issue_date?: string; expiry_date?: string; notes?: string; portal_url?: string }
const ACTIVITIES: [string, string, string, string][] = [
  ['Real Estate Broker', 'وسطاء العقارات', 'SALES_BROKERAGE,LEASING_BROKERAGE,BROKER', 'Real estate broker registration with RERA.'],
  ['Property Management', 'إدارة العقارات', 'PROPERTY_MANAGEMENT,ESCROW_MANAGEMENT,PROPERTY_MGMT', 'Property management operations.'],
  ['Maintenance Service', 'خدمات الصيانة', 'MAINTNANCE,MAINTENANCE', 'Building maintenance and repair.'],
  ['Valuation Service', 'التقييم العقاري', 'VALUATION', 'Professional property valuation.'],
]
const TO_CHECK = 'Status not evidenced by the documents supplied – confirm and update this record.'

function put(items: Item[]) {
  for (const it of items) {
    if (q.val(`SELECT 1 FROM compliance_items WHERE type = ? AND name = ? AND deleted_at IS NULL`, it.type, it.name)) continue
    createRecord(getDef('compliance_items'), { renewal_lead_days: 60, ...it }, SYSTEM_CTX)
  }
}
const common = (verify = TO_CHECK): Item[] => [
  { type: 'Office registration (ORN)', name: 'DLD Office Registration (ORN)', reference_no: '51517', authority: 'Dubai Land Department (DLD)', status: 'To verify', notes: `DLD & RERA Office Registration Number (ORN) for SWK Properties L.L.C. Enter the issue and expiry dates. ${verify}` },
  { type: 'Real estate broker registration (RERA)', name: 'Real estate broker registration', reference_no: '51517', authority: 'RERA', status: 'To verify', notes: `RERA brokerage registration (ORN). Enter the issue and expiry dates. ${verify}` },
  { type: 'VAT registration (FTA)', name: 'Federal Tax Authority VAT registration', authority: 'Federal Tax Authority (FTA)', status: 'To verify', notes: `Enter the 15-digit TRN under Company Settings once issued. ${verify}` },
  { type: 'Corporate tax registration (FTA)', name: 'Federal Tax Authority Corporate Tax registration', authority: 'Federal Tax Authority (FTA)', status: 'To verify', notes: `Register within 3 months of licence issue via EmaraTax. ${verify}` },
  { type: 'Property management licence', name: 'Property management licence', authority: 'Dubai Land Department', status: 'To verify', notes: `Confirm property management licence and scope. ${verify}` },
  { type: 'MOHRE establishment card / WPS', name: 'MOHRE establishment card and WPS enrolment', authority: 'MOHRE', status: 'To verify', notes: `Needed to hire staff and to run the WPS salary file. ${verify}` },
  { type: 'ICP establishment card', name: 'ICP establishment card', authority: 'Federal Authority for Identity, Citizenship, Customs & Port Security', status: 'To verify', notes: `Needed for residence visas. ${verify}` },
  { type: 'Tenancy contract (Ejari)', name: 'Office tenancy contract (Ejari)', authority: 'Dubai Land Department', status: 'To verify', notes: `The licence address must match the tenancy. ${verify}` },
  { type: 'Property insurance', name: 'Property insurance', authority: 'Insurer', status: 'To verify', notes: 'Cover for property damage, liability and employees\' compulsory health insurance.' },
  { type: 'UBO register', name: 'Ultimate beneficial owner register', authority: 'Dubai Economy and Tourism', status: 'To verify', notes: 'Keep the UBO register and shareholder register filed and updated after any change of ownership or management (check the filing period with DET).' },
  { type: 'Data protection / privacy', name: 'Privacy notice and consent wording', authority: 'Internal (UAE PDPL)', status: 'To obtain', notes: 'Publish a privacy notice on the website and quote form; record marketing consent on customers and leads.' },
]

/** Production: the company’s own licence data from its DET trade licence, DCCI certificate and commercial register. Demo: fictional equivalents. */
export function seedCompliance(opts: { demo?: boolean } = {}) {
  const today = todayStr()
  if (opts.demo) {
    setSettings({ company_name_ar: 'س دبليو كيه للعقارات ش.ذ.م.م', licence_name_en: 'SWK Properties (demo workspace)', company_trn: '100000000000003', company_trade_license: 'DEMO-000000', licence_authority: 'Dubai Economy and Tourism (DET)', licence_issue_date: addDays(today, -165), licence_expiry_date: addDays(today, 200), vat_registered: true, compliance_mode: 'enforce', activity_scope_mode: 'warn', ct_registered: true, ct_trn: '100000000000003' })
    for (const [en, ar, covers] of [...ACTIVITIES.map(a => [a[0], a[1], a[2]] as const)])
      if (!q.val(`SELECT 1 FROM licence_activities WHERE activity_en = ?`, en)) createRecord(getDef('licence_activities'), { activity_en: en, activity_ar: ar, covers, status: 'Active', source: 'Trade licence (demo)' }, SYSTEM_CTX)
    put([
      { type: 'Trade licence', name: 'Commercial licence (DET)', reference_no: 'DEMO-000000', authority: 'Dubai Economy and Tourism (DET)', status: 'Active', issue_date: addDays(today, -165), expiry_date: addDays(today, 200), portal_url: 'https://www.dubaided.gov.ae', notes: 'Demo workspace – fictional record.' },
      ...common('Demo workspace – fictional record.'),
    ])
    return
  }
  const cur = (k: string) => String(getSetting(k) ?? '')
  setSettings({
    company_name: cur('company_name') || 'SWK Properties L.L.C',
    company_name_ar: cur('company_name_ar') || 'إس دبليو كي العقارية ش.ذ.م.م', licence_name_en: cur('licence_name_en') || 'SWK PROPERTIES L.L.C.',
    company_legal_form: cur('company_legal_form') || 'Limited Liability Company – Single Owner (LLC – SO)',
    licence_authority: cur('licence_authority') || 'Dubai Economy and Tourism (DET)',
    company_address: cur('company_address'),
  })
  for (const [en, ar, covers, notes] of ACTIVITIES)
    if (!q.val(`SELECT 1 FROM licence_activities WHERE activity_en = ? AND deleted_at IS NULL`, en)) createRecord(getDef('licence_activities'), { activity_en: en, activity_ar: ar, covers, notes, status: 'Active', source: 'Trade licence' }, SYSTEM_CTX)
  put([
    { type: 'Trade licence', name: 'Commercial licence (DET)', authority: 'Dubai Economy and Tourism (DET)', status: 'To verify', portal_url: 'https://www.dubaided.gov.ae', notes: 'Enter the licence number, issue and expiry dates from the DET licence. Licence conditions to check: no change of location or licence details without DET approval; separate permits for extra offices; signboard in Arabic and English; invoices must show amounts and VAT.' },
    { type: 'Commercial register', name: 'Commercial register certificate', authority: 'Dubai Economy and Tourism (DET)', status: 'To verify', notes: 'Enter the register number, issue and expiry dates.' },
    { type: 'Chamber of Commerce membership', name: 'Dubai Chamber of Commerce & Industry membership', authority: 'Dubai Chamber of Commerce & Industry', status: 'To verify', portal_url: 'http://www.dubaichamber.ae/verify', notes: 'Enter the membership number, issue and expiry dates.' },
    ...common(),
  ])
}
