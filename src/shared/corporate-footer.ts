export interface FooterCompany {
  company_name?: string; company_address?: string; company_phone?: string
  company_email?: string; company_info_email?: string; company_website?: string
}

export const SWK_OFFICIAL_WEBSITES = [
  'www.swk.properties',
  'www.swkpropertiesuae.com',
  'www.swk.rent',
] as const

export const SWK_OFFICIAL_WEBSITES_TEXT = SWK_OFFICIAL_WEBSITES.join(' · ')

export function normalizeSwkCompanyName(raw?: string | null): string {
  const trimmed = (raw || '').trim()
  if (!trimmed || trimmed.toUpperCase() === 'SWK OS' || trimmed === 'SWK Properties L.L.C') {
    return 'SWK Properties LLC'
  }
  return trimmed
}

export function normalizeSwkWebsitesText(raw?: string | null): string {
  const cleaned = (raw || '').replace(/^https?:\/\//, '').replace(/\/$/, '').trim()
  if (!cleaned) return SWK_OFFICIAL_WEBSITES_TEXT
  const lower = cleaned.toLowerCase()
  if (SWK_OFFICIAL_WEBSITES.every(domain => lower.includes(domain))) return cleaned
  return SWK_OFFICIAL_WEBSITES_TEXT
}

export function corporateFooterDetails(s: FooterCompany = {}) {
  return {
    name: normalizeSwkCompanyName(s.company_name),
    address: s.company_address || 'Bur Dubai, Dubai, UAE',
    phone: s.company_phone || '+971 4 330 4899',
    email: s.company_info_email || s.company_email || 'info@swkpropertiesuae.com',
    website: normalizeSwkWebsitesText(s.company_website),
    websites: [...SWK_OFFICIAL_WEBSITES],
  }
}
const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
/** Chromium footer templates have no access to the document stylesheet. */
export function corporatePdfFooter(s: FooterCompany, opts: { pageNumbers?: boolean; footerText?: string } = {}) {
  const c = corporateFooterDetails(s)
  return `<div style="width:100%;box-sizing:border-box;padding:0 14mm;font-family:Arial,sans-serif;font-size:8px;color:#425466;line-height:1.5"><div style="border-top:2px solid #007b52;padding-top:6px;display:flex;justify-content:space-between;gap:12px"><div><div style="font-size:9px;font-weight:700;letter-spacing:.7px;color:#15293b">${esc(c.name)}</div><div>${esc(c.address)}</div></div><div style="text-align:right"><div>${esc([c.phone, c.email].filter(Boolean).join(' | '))}</div><div style="font-weight:700;color:#007b52">${esc(c.website)}</div></div></div><div style="display:flex;justify-content:space-between;gap:12px;padding-top:4px;color:#687885"><span>${esc(opts.footerText || '')}</span><span>${opts.pageNumbers !== false ? 'Page <span class="pageNumber"></span> of <span class="totalPages"></span>' : ''}</span></div></div>`
}
