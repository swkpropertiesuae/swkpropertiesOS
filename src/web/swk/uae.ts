/**
 * UAE real-estate rules engine for SWK OS.
 * Every rate below is an indicative Dubai default (DLD / RERA / CBUAE / FTA practice as of 2026) and is
 * passed in as an overridable parameter so the office can update it without code changes.
 */

export const UAE = {
  vat: 0.05,
  dldTransferPct: 0.04,          // DLD transfer fee, % of price (buyer by market practice)
  dldAdminFee: 580,              // title deed issuance (AED 520 + AED 60 knowledge/innovation)
  trusteeFeeHigh: 4000,          // Real Estate Registration Trustee, price ≥ AED 500k (+VAT)
  trusteeFeeLow: 2000,           // price < AED 500k (+VAT)
  mortgageRegPct: 0.0025,        // 0.25% of loan
  mortgageRegFixed: 290,
  valuationFee: 3150,            // bank valuation incl. VAT (typical)
  bankArrangementPct: 0.01,      // up to 1% of loan (+VAT)
  brokerSalePct: 0.02,           // 2% + VAT market norm
  brokerLeasePct: 0.05,          // 5% of annual rent + VAT market norm
  ejariFee: 220,                 // incl. typing/knowledge fees (approx.)
  housingFeePct: 0.05,           // Dubai Municipality housing fee, residential (billed via DEWA)
  dewaDepositApt: 2000, dewaDepositVilla: 4000,
  goldenVisaMin: 2_000_000, investorVisaMin: 750_000,
  dbrMax: 0.5, maxTenureYears: 25,
  goAmlCashThreshold: 55_000,
}

// ---------------------------------------------------------------- buyer cost to close
export function costToClose(p: { price: number; loan?: number; brokerPct?: number; nocFee?: number; includeBroker?: boolean }) {
  const price = Math.max(0, p.price), loan = Math.max(0, p.loan ?? 0)
  const brokerPct = p.brokerPct ?? UAE.brokerSalePct
  const trustee = (price >= 500_000 ? UAE.trusteeFeeHigh : UAE.trusteeFeeLow) * (1 + UAE.vat)
  const lines = [
    { key: 'dld', label: 'DLD transfer fee (4%)', amount: price * UAE.dldTransferPct, note: 'Paid to Dubai Land Department at transfer' },
    { key: 'admin', label: 'Title deed & admin', amount: UAE.dldAdminFee, note: 'Title deed issuance + knowledge fees' },
    { key: 'trustee', label: 'Registration trustee (+VAT)', amount: trustee, note: price >= 500_000 ? 'AED 4,000 + VAT for ≥ AED 500k' : 'AED 2,000 + VAT below AED 500k' },
    ...(p.includeBroker !== false ? [{ key: 'broker', label: `Agency commission (${(brokerPct * 100).toFixed(1)}% + VAT)`, amount: price * brokerPct * (1 + UAE.vat), note: 'Per Form B buyer agreement' }] : []),
    { key: 'noc', label: 'Developer NOC', amount: p.nocFee ?? 1500, note: 'AED 500 – 5,000 depending on developer' },
    ...(loan > 0 ? [
      { key: 'mreg', label: 'Mortgage registration (0.25% + 290)', amount: loan * UAE.mortgageRegPct + UAE.mortgageRegFixed, note: 'DLD mortgage registration' },
      { key: 'val', label: 'Bank valuation', amount: UAE.valuationFee, note: 'Typical, incl. VAT' },
      { key: 'arr', label: 'Bank arrangement fee (≤1% + VAT)', amount: loan * UAE.bankArrangementPct * (1 + UAE.vat), note: 'Negotiable; many banks waive' },
    ] : []),
  ]
  const fees = lines.reduce((s, l) => s + l.amount, 0)
  const downPayment = price - loan
  return { lines, fees, downPayment, cashRequired: downPayment + fees, feesPct: price ? (fees / price) * 100 : 0 }
}

// ---------------------------------------------------------------- CBUAE mortgage rules
export type Residency = 'expat' | 'national'
export function maxLtv(p: { price: number; residency: Residency; firstHome: boolean; offPlan: boolean }) {
  if (p.offPlan) return 0.5
  if (!p.firstHome) return p.residency === 'national' ? 0.65 : 0.6
  if (p.residency === 'national') return p.price <= 5_000_000 ? 0.85 : 0.75
  return p.price <= 5_000_000 ? 0.8 : 0.7
}
export function monthlyPayment(loan: number, annualRatePct: number, years: number) {
  const r = annualRatePct / 100 / 12, n = Math.max(1, Math.round(years * 12))
  if (r === 0) return loan / n
  return (loan * r) / (1 - Math.pow(1 + r, -n))
}
export function mortgagePlan(p: { price: number; residency: Residency; firstHome: boolean; offPlan: boolean; ratePct: number; years: number; income: number; debts: number; downPct?: number }) {
  const ltv = maxLtv(p)
  const years = Math.min(UAE.maxTenureYears, Math.max(1, p.years))
  const requestedLtv = p.downPct !== undefined ? Math.min(ltv, 1 - p.downPct / 100) : ltv
  const loan = p.price * requestedLtv
  const emi = monthlyPayment(loan, p.ratePct, years)
  const dbr = p.income > 0 ? (emi + p.debts) / p.income : 1
  // largest loan the DBR cap allows
  const r = p.ratePct / 100 / 12, n = years * 12
  const emiCap = Math.max(0, p.income * UAE.dbrMax - p.debts)
  const loanByDbr = r === 0 ? emiCap * n : emiCap * (1 - Math.pow(1 + r, -n)) / r
  const totalInterest = emi * years * 12 - loan
  const schedule = Array.from({ length: years }, (_, y) => {
    let bal = loan
    for (let m = 0; m < (y + 1) * 12; m++) { const int = bal * r; bal = Math.max(0, bal - (emi - int)) }
    return { year: y + 1, balance: Math.round(bal), paid: Math.round(loan - bal) }
  })
  return { ltv, appliedLtv: requestedLtv, loan, emi, dbr, dbrOk: dbr <= UAE.dbrMax, loanByDbr, maxPriceByDbr: loanByDbr / Math.max(requestedLtv, 0.01), totalInterest, years, schedule }
}

// ---------------------------------------------------------------- RERA rental increase (Decree 43 of 2013)
export const RERA_BANDS = [
  { maxBelow: 10, increase: 0, label: 'Up to 10% below index' },
  { maxBelow: 20, increase: 5, label: '11 – 20% below index' },
  { maxBelow: 30, increase: 10, label: '21 – 30% below index' },
  { maxBelow: 40, increase: 15, label: '31 – 40% below index' },
  { maxBelow: Infinity, increase: 20, label: 'More than 40% below index' },
]
export function reraIncrease(currentRent: number, indexAverage: number) {
  const below = indexAverage > 0 ? ((indexAverage - currentRent) / indexAverage) * 100 : 0
  const band = below <= 0 ? RERA_BANDS[0] : RERA_BANDS.find(b => below <= b.maxBelow)!
  const maxRent = currentRent * (1 + band.increase / 100)
  return { below: Math.max(0, below), band, maxIncreasePct: band.increase, maxRent, maxIncrease: maxRent - currentRent }
}

// ---------------------------------------------------------------- rental yield / ROI
export function yieldCalc(p: { price: number; annualRent: number; areaSqft: number; serviceChargePerSqft: number; maintenancePct?: number; mgmtFeePct?: number; vacancyWeeks?: number; mortgageInterest?: number }) {
  const sc = p.areaSqft * p.serviceChargePerSqft
  const vacancy = p.annualRent * ((p.vacancyWeeks ?? 2) / 52)
  const maint = p.annualRent * ((p.maintenancePct ?? 3) / 100)
  const mgmt = p.annualRent * ((p.mgmtFeePct ?? 5) / 100)
  const acq = costToClose({ price: p.price, includeBroker: true }).fees
  const net = p.annualRent - sc - vacancy - maint - mgmt - (p.mortgageInterest ?? 0)
  return {
    gross: p.price ? (p.annualRent / p.price) * 100 : 0,
    net: p.price ? (net / (p.price + acq)) * 100 : 0,
    netIncome: net, serviceCharge: sc, vacancy, maint, mgmt, acquisition: acq,
    paybackYears: net > 0 ? (p.price + acq) / net : Infinity,
  }
}

// ---------------------------------------------------------------- Golden Visa & residency
export function visaEligibility(p: { value: number; mortgaged: boolean; paidToBank?: number; offPlan: boolean; jointOwners?: number }) {
  const share = p.value / Math.max(1, p.jointOwners ?? 1)
  const golden = share >= UAE.goldenVisaMin
  const investor = share >= UAE.investorVisaMin
  const notes: string[] = []
  if (p.mortgaged) notes.push('Mortgaged property qualifies when the bank issues a NOC; the paid-up equity is assessed by ICP / GDRFA.')
  if (p.offPlan) notes.push('Off-plan qualifies when bought from a DLD-approved developer and the value is met (completion % checked by DLD).')
  if ((p.jointOwners ?? 1) > 1) notes.push('Jointly owned: each owner’s share must meet the threshold on its own (spouses may combine).')
  return { share, golden, investor, tier: golden ? '10-year Golden Visa' : investor ? '2-year property investor visa' : 'Not yet eligible', gap: golden ? 0 : UAE.goldenVisaMin - share, notes }
}

// ---------------------------------------------------------------- commission waterfall (Form I co-broking)
export function commissionWaterfall(p: { price: number; pct: number; coBrokerShare: number; referralPct: number; agentSplit: number; leaderOverride?: number }) {
  const gross = p.price * (p.pct / 100)
  const vat = gross * UAE.vat
  const coBroker = gross * (p.coBrokerShare / 100)
  const afterCo = gross - coBroker
  const referral = afterCo * (p.referralPct / 100)
  const pool = afterCo - referral
  const agent = pool * (p.agentSplit / 100)
  const leader = pool * ((p.leaderOverride ?? 0) / 100)
  const company = pool - agent - leader
  return { gross, vat, invoiceTotal: gross + vat, coBroker, referral, agent, leader, company, steps: [
    { label: 'Gross commission', value: gross }, { label: 'Co-broker (Form I)', value: -coBroker }, { label: 'Referral', value: -referral },
    { label: 'Agent share', value: -agent }, { label: 'Team leader override', value: -leader }, { label: 'SWK net revenue', value: company },
  ] }
}

// ---------------------------------------------------------------- tenant move-in costs
export function leaseCosts(p: { annualRent: number; furnished: boolean; villa: boolean; cheques: number; agencyPct?: number }) {
  const agency = p.annualRent * ((p.agencyPct ?? 5) / 100)
  const lines = [
    { label: `Security deposit (${p.furnished ? '10' : '5'}%)`, amount: p.annualRent * (p.furnished ? 0.1 : 0.05), refundable: true },
    { label: 'Agency fee + VAT', amount: agency * (1 + UAE.vat), refundable: false },
    { label: 'Ejari registration', amount: UAE.ejariFee, refundable: false },
    { label: 'DEWA connection deposit', amount: p.villa ? UAE.dewaDepositVilla : UAE.dewaDepositApt, refundable: true },
    { label: `First cheque (1 of ${p.cheques})`, amount: p.annualRent / Math.max(1, p.cheques), refundable: false },
  ]
  return { lines, moveIn: lines.reduce((s, l) => s + l.amount, 0), housingFeeMonthly: (p.annualRent * UAE.housingFeePct) / 12, chequeAmount: p.annualRent / Math.max(1, p.cheques) }
}

// ---------------------------------------------------------------- off-plan payment plan
export function paymentPlan(p: { price: number; bookingPct: number; constructionPct: number; handoverPct: number; postHandoverPct: number; constructionInstalments: number; postInstalments: number; start: Date; handover: Date }) {
  const rows: { label: string; date: Date; pct: number; amount: number; phase: 'Booking' | 'Construction' | 'Handover' | 'Post-handover' | 'DLD' }[] = []
  rows.push({ label: 'Booking / down payment', date: p.start, pct: p.bookingPct, amount: p.price * p.bookingPct / 100, phase: 'Booking' })
  rows.push({ label: 'DLD Oqood registration (4%)', date: p.start, pct: 4, amount: p.price * 0.04, phase: 'DLD' })
  const months = Math.max(1, (p.handover.getTime() - p.start.getTime()) / (30.44 * 864e5))
  for (let i = 1; i <= p.constructionInstalments; i++) {
    const d = new Date(p.start); d.setMonth(d.getMonth() + Math.round((months * i) / (p.constructionInstalments + 1)))
    rows.push({ label: `Construction instalment ${i}`, date: d, pct: p.constructionPct / p.constructionInstalments, amount: (p.price * p.constructionPct / 100) / p.constructionInstalments, phase: 'Construction' })
  }
  rows.push({ label: 'On handover', date: p.handover, pct: p.handoverPct, amount: p.price * p.handoverPct / 100, phase: 'Handover' })
  for (let i = 1; i <= p.postInstalments; i++) {
    const d = new Date(p.handover); d.setMonth(d.getMonth() + Math.round((24 * i) / p.postInstalments))
    rows.push({ label: `Post-handover ${i}`, date: d, pct: p.postHandoverPct / p.postInstalments, amount: (p.price * p.postHandoverPct / 100) / p.postInstalments, phase: 'Post-handover' })
  }
  const planPct = p.bookingPct + p.constructionPct + p.handoverPct + p.postHandoverPct
  return { rows, planPct, valid: Math.abs(planPct - 100) < 0.01 }
}

// ---------------------------------------------------------------- indicative market data (DLD-style)
export type Community = { id: string; name: string; image: string; ppsf: number; ppsfLY: number; rentStudio: number; rent1: number; rent2: number; rent3: number; yieldPct: number; serviceCharge: number; transactionsQ: number; offPlanShare: number; trend: number[]; segment: 'Prime' | 'Upper-mid' | 'Mid' | 'Value'; lat: number; lng: number }
export const COMMUNITIES: Community[] = [
  { id: 'palm-jumeirah', name: 'Palm Jumeirah', image: '/media/communities/palm-jumeirah.webp', ppsf: 4380, ppsfLY: 3720, rentStudio: 110000, rent1: 165000, rent2: 260000, rent3: 420000, yieldPct: 5.1, serviceCharge: 24, transactionsQ: 1180, offPlanShare: 38, trend: [3150, 3320, 3480, 3610, 3720, 3890, 4050, 4210, 4380], segment: 'Prime', lat: 25.1124, lng: 55.139 },
  { id: 'downtown-dubai', name: 'Downtown Dubai', image: '/media/communities/downtown-dubai.webp', ppsf: 2980, ppsfLY: 2660, rentStudio: 85000, rent1: 125000, rent2: 195000, rent3: 300000, yieldPct: 5.6, serviceCharge: 21, transactionsQ: 1640, offPlanShare: 31, trend: [2310, 2400, 2490, 2580, 2660, 2740, 2820, 2900, 2980], segment: 'Prime', lat: 25.1972, lng: 55.2744 },
  { id: 'dubai-marina', name: 'Dubai Marina', image: '/media/communities/dubai-marina.webp', ppsf: 2290, ppsfLY: 2070, rentStudio: 72000, rent1: 105000, rent2: 160000, rent3: 230000, yieldPct: 6.4, serviceCharge: 18, transactionsQ: 2210, offPlanShare: 22, trend: [1780, 1850, 1920, 2000, 2070, 2130, 2190, 2240, 2290], segment: 'Upper-mid', lat: 25.0805, lng: 55.1403 },
  { id: 'business-bay', name: 'Business Bay', image: '/media/communities/business-bay.webp', ppsf: 2180, ppsfLY: 1950, rentStudio: 68000, rent1: 98000, rent2: 150000, rent3: 210000, yieldPct: 6.8, serviceCharge: 17, transactionsQ: 2570, offPlanShare: 54, trend: [1640, 1710, 1790, 1870, 1950, 2010, 2070, 2120, 2180], segment: 'Upper-mid', lat: 25.1865, lng: 55.2631 },
  { id: 'dubai-hills-estate', name: 'Dubai Hills Estate', image: '/media/communities/dubai-hills-estate.webp', ppsf: 2390, ppsfLY: 2090, rentStudio: 70000, rent1: 110000, rent2: 170000, rent3: 260000, yieldPct: 5.8, serviceCharge: 15, transactionsQ: 1930, offPlanShare: 47, trend: [1720, 1810, 1900, 2000, 2090, 2170, 2250, 2320, 2390], segment: 'Upper-mid', lat: 25.1014, lng: 55.2298 },
  { id: 'dubai-creek-harbour', name: 'Dubai Creek Harbour', image: '/media/communities/dubai-creek-harbour.webp', ppsf: 2320, ppsfLY: 2050, rentStudio: 66000, rent1: 98000, rent2: 150000, rent3: 220000, yieldPct: 6.2, serviceCharge: 17, transactionsQ: 1410, offPlanShare: 66, trend: [1690, 1770, 1860, 1960, 2050, 2120, 2190, 2260, 2320], segment: 'Upper-mid', lat: 25.2048, lng: 55.3463 },
  { id: 'jvc', name: 'Jumeirah Village Circle', image: '/media/communities/jvc.webp', ppsf: 1320, ppsfLY: 1200, rentStudio: 48000, rent1: 72000, rent2: 105000, rent3: 145000, yieldPct: 7.9, serviceCharge: 13, transactionsQ: 3380, offPlanShare: 61, trend: [1010, 1050, 1090, 1150, 1200, 1230, 1260, 1290, 1320], segment: 'Value', lat: 25.0597, lng: 55.2066 },
  { id: 'sheikh-zayed-road', name: 'Sheikh Zayed Road', image: '/media/communities/sheikh-zayed-road.webp', ppsf: 1920, ppsfLY: 1760, rentStudio: 64000, rent1: 92000, rent2: 140000, rent3: 195000, yieldPct: 6.6, serviceCharge: 16, transactionsQ: 760, offPlanShare: 18, trend: [1520, 1570, 1630, 1700, 1760, 1800, 1840, 1880, 1920], segment: 'Mid', lat: 25.2167, lng: 55.2797 },
]
export const QUARTERS = ['Q3-24', 'Q4-24', 'Q1-25', 'Q2-25', 'Q3-25', 'Q4-25', 'Q1-26', 'Q2-26', 'Q3-26']
export const communityByName = (name?: string | null) => COMMUNITIES.find(c => name && (name.toLowerCase().includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(c.id.replace(/-/g, ' '))))

// RERA rental index (indicative averages) used by the renewal calculator
export const RENT_INDEX: Record<string, Record<string, number>> = Object.fromEntries(COMMUNITIES.map(c => [c.name, { Studio: c.rentStudio, '1 BR': c.rent1, '2 BR': c.rent2, '3 BR': c.rent3 }]))

// Developer catalogue (logos from the SWK website)
export const DEVELOPERS = [
  { name: 'Emaar Properties', logo: '/media/developers/logo-01.png' }, { name: 'Nakheel', logo: '/media/developers/logo-02.png' },
  { name: 'DAMAC Properties', logo: '/media/developers/logo-03.png' }, { name: 'Sobha Realty', logo: '/media/developers/logo-04.png' },
  { name: 'Meraas', logo: '/media/developers/logo-05.png' }, { name: 'Ellington Properties', logo: '/media/developers/logo-06.png' },
  { name: 'Binghatti', logo: '/media/developers/logo-07.png' }, { name: 'Azizi Developments', logo: '/media/developers/logo-08.png' },
  { name: 'Omniyat', logo: '/media/developers/logo-09.png' }, { name: 'Danube Properties', logo: '/media/developers/logo-10.png' },
]

// RERA contract forms used through the deal lifecycle
export const RERA_FORMS = [
  { code: 'Form A', name: 'Seller / landlord ↔ broker listing agreement', stage: 'Mandate' },
  { code: 'Form B', name: 'Buyer / tenant ↔ broker agreement', stage: 'Qualification' },
  { code: 'Form I', name: 'Agent-to-agent co-broking agreement', stage: 'Co-broke' },
  { code: 'Form F', name: 'Memorandum of Understanding (MOU) — buyer ↔ seller', stage: 'Offer accepted' },
  { code: 'NOC', name: 'Developer No-Objection Certificate', stage: 'Pre-transfer' },
  { code: 'Title deed', name: 'DLD title deed issued at the trustee office', stage: 'Transfer' },
]
