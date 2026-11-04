import { q } from '../db'
import { getSetting, setSettings } from '../settings'
import { createRecord, patchRecord, getDef, SYSTEM_CTX } from '../engine'

/** Company profile facts. Licence, registration and tax numbers are entered by the administrator, never seeded. */
export function seedCompanyDocuments() {
  const patch: Record<string, unknown> = {}
  const facts = {
    company_name_ar: 'إس دبليو كي العقارية ش.ذ.م.م',
    company_legal_form: 'Limited Liability Company - Single Owner (LLC - SO)',
  }
  for (const [key, value] of Object.entries(facts)) if (!getSetting(key)) patch[key] = value
  const currentName = String(getSetting('company_name') || '').trim()
  if (!currentName || currentName === 'SWK Properties L.L.C' || currentName.toUpperCase() === 'SWK OS') {
    patch.company_name = 'SWK Properties LLC'
  }
  const currentWeb = String(getSetting('company_website') || '').trim()
  if (!currentWeb || currentWeb === 'https://www.swkpropertiesuae.com' || currentWeb === 'www.swkpropertiesuae.com') {
    patch.company_website = 'www.swk.properties · www.swkpropertiesuae.com · www.swk.rent'
  }
  setSettings(patch)
  const items = [
    { type: 'ICP establishment card', name: 'ICP establishment card', status: 'To verify', notes: 'Enter the card number and expiry date. Not evidence of MOHRE/WPS enrolment.' },
    { type: 'Corporate tax registration (FTA)', name: 'Corporate tax registration', status: 'To verify', notes: 'Enter the application reference or registration number. An application reference is not a VAT or corporate tax TRN.' },
  ]
  for (const item of items) {
    const existing = q.get<{ id: number; reference_no: string; status: string }>('SELECT id, reference_no, status FROM compliance_items WHERE name = ? AND deleted_at IS NULL', item.name)
    if (!existing) createRecord(getDef('compliance_items'), { renewal_lead_days: 60, ...item }, SYSTEM_CTX)
    else if (!existing.reference_no && existing.status === 'To verify') patchRecord(getDef('compliance_items'), existing.id, item, SYSTEM_CTX)
  }
}
