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

// RERA rent-increase bands live in the shared rules so the server and the toolkit agree.
export { RERA_BANDS, reraIncrease } from '@shared/uae-rules'

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

// ---------------------------------------------------------------- indicative market data (DLD-style — all 24 major Dubai areas)
export type Community = {
  id: string
  code?: string
  ticker?: string
  name: string
  image: string
  ppsf: number
  ppsfLY: number
  rentStudio: number
  rent1: number
  rent2: number
  rent3: number
  yieldPct: number
  serviceCharge: number
  transactionsQ: number
  offPlanShare: number
  trend: number[]
  segment: 'Prime' | 'Upper-mid' | 'Mid' | 'Value'
  lat: number
  lng: number
}
export const COMMUNITIES: Community[] = [
  { id: 'palm-jumeirah', code: 'PALM', ticker: 'PALM.DXB', name: 'Palm Jumeirah', image: '/media/communities/palm-jumeirah.webp', ppsf: 4380, ppsfLY: 3720, rentStudio: 110000, rent1: 165000, rent2: 260000, rent3: 420000, yieldPct: 5.1, serviceCharge: 24, transactionsQ: 1180, offPlanShare: 38, trend: [3150, 3320, 3480, 3610, 3720, 3890, 4050, 4210, 4380], segment: 'Prime', lat: 25.1124, lng: 55.139 },
  { id: 'downtown-dubai', code: 'DWNT', ticker: 'DWNT.DXB', name: 'Downtown Dubai', image: '/media/communities/downtown-dubai.webp', ppsf: 2980, ppsfLY: 2660, rentStudio: 85000, rent1: 125000, rent2: 195000, rent3: 300000, yieldPct: 5.6, serviceCharge: 21, transactionsQ: 1640, offPlanShare: 31, trend: [2310, 2400, 2490, 2580, 2660, 2740, 2820, 2900, 2980], segment: 'Prime', lat: 25.1972, lng: 55.2744 },
  { id: 'dubai-marina', code: 'MARN', ticker: 'MARN.DXB', name: 'Dubai Marina', image: '/media/communities/dubai-marina.webp', ppsf: 2290, ppsfLY: 2070, rentStudio: 72000, rent1: 105000, rent2: 160000, rent3: 230000, yieldPct: 6.4, serviceCharge: 18, transactionsQ: 2210, offPlanShare: 22, trend: [1780, 1850, 1920, 2000, 2070, 2130, 2190, 2240, 2290], segment: 'Upper-mid', lat: 25.0805, lng: 55.1403 },
  { id: 'business-bay', code: 'BBAY', ticker: 'BBAY.DXB', name: 'Business Bay', image: '/media/communities/business-bay.webp', ppsf: 2180, ppsfLY: 1950, rentStudio: 68000, rent1: 98000, rent2: 150000, rent3: 210000, yieldPct: 6.8, serviceCharge: 17, transactionsQ: 2570, offPlanShare: 54, trend: [1640, 1710, 1790, 1870, 1950, 2010, 2070, 2120, 2180], segment: 'Upper-mid', lat: 25.1865, lng: 55.2631 },
  { id: 'dubai-hills-estate', code: 'DHIL', ticker: 'DHIL.DXB', name: 'Dubai Hills Estate', image: '/media/communities/dubai-hills-estate.webp', ppsf: 2390, ppsfLY: 2090, rentStudio: 70000, rent1: 110000, rent2: 170000, rent3: 260000, yieldPct: 5.8, serviceCharge: 15, transactionsQ: 1930, offPlanShare: 47, trend: [1720, 1810, 1900, 2000, 2090, 2170, 2250, 2320, 2390], segment: 'Upper-mid', lat: 25.1014, lng: 55.2298 },
  { id: 'dubai-creek-harbour', code: 'DCHB', ticker: 'DCHB.DXB', name: 'Dubai Creek Harbour', image: '/media/communities/dubai-creek-harbour.webp', ppsf: 2320, ppsfLY: 2050, rentStudio: 66000, rent1: 98000, rent2: 150000, rent3: 220000, yieldPct: 6.2, serviceCharge: 17, transactionsQ: 1410, offPlanShare: 66, trend: [1690, 1770, 1860, 1960, 2050, 2120, 2190, 2260, 2320], segment: 'Upper-mid', lat: 25.2048, lng: 55.3463 },
  { id: 'jvc', code: 'JVCC', ticker: 'JVCC.DXB', name: 'Jumeirah Village Circle', image: '/media/communities/jvc.webp', ppsf: 1320, ppsfLY: 1200, rentStudio: 48000, rent1: 72000, rent2: 105000, rent3: 145000, yieldPct: 7.9, serviceCharge: 13, transactionsQ: 3380, offPlanShare: 61, trend: [1010, 1050, 1090, 1150, 1200, 1230, 1260, 1290, 1320], segment: 'Value', lat: 25.0597, lng: 55.2066 },
  { id: 'sheikh-zayed-road', code: 'SZRD', ticker: 'SZRD.DXB', name: 'Sheikh Zayed Road', image: '/media/communities/sheikh-zayed-road.webp', ppsf: 1920, ppsfLY: 1760, rentStudio: 64000, rent1: 92000, rent2: 140000, rent3: 195000, yieldPct: 6.6, serviceCharge: 16, transactionsQ: 760, offPlanShare: 18, trend: [1520, 1570, 1630, 1700, 1760, 1800, 1840, 1880, 1920], segment: 'Mid', lat: 25.2167, lng: 55.2797 },
  { id: 'al-barsha', code: 'BRSH', ticker: 'BRSH.DXB', name: 'Al Barsha', image: '/media/communities/dubai-hills-estate.webp', ppsf: 1450, ppsfLY: 1330, rentStudio: 52000, rent1: 78000, rent2: 118000, rent3: 165000, yieldPct: 7.1, serviceCharge: 14, transactionsQ: 620, offPlanShare: 35, trend: [1150, 1190, 1240, 1290, 1330, 1360, 1390, 1420, 1450], segment: 'Mid', lat: 25.1112, lng: 55.2003 },
  { id: 'emirates-living', code: 'EMLV', ticker: 'EMLV.DXB', name: 'Emirates Living', image: '/media/communities/palm-jumeirah.webp', ppsf: 2650, ppsfLY: 2310, rentStudio: 75000, rent1: 120000, rent2: 185000, rent3: 290000, yieldPct: 5.3, serviceCharge: 6, transactionsQ: 490, offPlanShare: 5, trend: [1890, 1980, 2090, 2200, 2310, 2400, 2490, 2570, 2650], segment: 'Prime', lat: 25.0695, lng: 55.1687 },
  { id: 'arabian-ranches', code: 'ARAB', ticker: 'ARAB.DXB', name: 'Arabian Ranches', image: '/media/communities/dubai-hills-estate.webp', ppsf: 1850, ppsfLY: 1620, rentStudio: 65000, rent1: 105000, rent2: 145000, rent3: 215000, yieldPct: 5.9, serviceCharge: 5, transactionsQ: 810, offPlanShare: 28, trend: [1340, 1410, 1480, 1550, 1620, 1680, 1740, 1800, 1850], segment: 'Upper-mid', lat: 25.0545, lng: 55.2683 },
  { id: 'damac-hills', code: 'DAMH', ticker: 'DAMH.DXB', name: 'DAMAC Hills', image: '/media/communities/jvc.webp', ppsf: 1540, ppsfLY: 1360, rentStudio: 49000, rent1: 74000, rent2: 112000, rent3: 175000, yieldPct: 6.7, serviceCharge: 12, transactionsQ: 1450, offPlanShare: 49, trend: [1120, 1180, 1240, 1300, 1360, 1410, 1460, 1500, 1540], segment: 'Mid', lat: 25.0218, lng: 55.2494 },
  { id: 'sobha-hartland', code: 'SOBH', ticker: 'SOBH.DXB', name: 'Sobha Hartland', image: '/media/communities/dubai-creek-harbour.webp', ppsf: 2410, ppsfLY: 2140, rentStudio: 68000, rent1: 102000, rent2: 155000, rent3: 235000, yieldPct: 6.1, serviceCharge: 18, transactionsQ: 1320, offPlanShare: 58, trend: [1810, 1890, 1970, 2060, 2140, 2210, 2280, 2350, 2410], segment: 'Prime', lat: 25.1765, lng: 55.3075 },
  { id: 'mbr-city', code: 'MBRM', ticker: 'MBRM.DXB', name: 'MBR City / Meydan', image: '/media/communities/downtown-dubai.webp', ppsf: 2150, ppsfLY: 1890, rentStudio: 62000, rent1: 92000, rent2: 142000, rent3: 215000, yieldPct: 6.3, serviceCharge: 16, transactionsQ: 1880, offPlanShare: 64, trend: [1580, 1650, 1730, 1810, 1890, 1960, 2030, 2090, 2150], segment: 'Upper-mid', lat: 25.1558, lng: 55.3003 },
  { id: 'difc', code: 'DIFC', ticker: 'DIFC.DXB', name: 'DIFC', image: '/media/communities/sheikh-zayed-road.webp', ppsf: 3450, ppsfLY: 3020, rentStudio: 95000, rent1: 145000, rent2: 225000, rent3: 350000, yieldPct: 5.5, serviceCharge: 23, transactionsQ: 420, offPlanShare: 42, trend: [2480, 2600, 2730, 2870, 3020, 3130, 3240, 3350, 3450], segment: 'Prime', lat: 25.2116, lng: 55.2816 },
  { id: 'jbr', code: 'JBRB', ticker: 'JBRB.DXB', name: 'Jumeirah Beach Residence', image: '/media/communities/dubai-marina.webp', ppsf: 2680, ppsfLY: 2380, rentStudio: 82000, rent1: 120000, rent2: 180000, rent3: 270000, yieldPct: 6.0, serviceCharge: 19, transactionsQ: 690, offPlanShare: 19, trend: [1990, 2080, 2180, 2280, 2380, 2460, 2540, 2610, 2680], segment: 'Prime', lat: 25.0777, lng: 55.1332 },
  { id: 'bluewaters', code: 'BLUW', ticker: 'BLUW.DXB', name: 'Bluewaters Island', image: '/media/communities/palm-jumeirah.webp', ppsf: 4850, ppsfLY: 4120, rentStudio: 135000, rent1: 195000, rent2: 310000, rent3: 480000, yieldPct: 5.4, serviceCharge: 25, transactionsQ: 240, offPlanShare: 15, trend: [3380, 3560, 3740, 3930, 4120, 4310, 4500, 4680, 4850], segment: 'Prime', lat: 25.0796, lng: 55.1225 },
  { id: 'jlt', code: 'JLTS', ticker: 'JLTS.DXB', name: 'Jumeirah Lakes Towers', image: '/media/communities/dubai-marina.webp', ppsf: 1680, ppsfLY: 1490, rentStudio: 58000, rent1: 86000, rent2: 132000, rent3: 185000, yieldPct: 7.4, serviceCharge: 15, transactionsQ: 1790, offPlanShare: 34, trend: [1240, 1300, 1360, 1420, 1490, 1540, 1590, 1640, 1680], segment: 'Mid', lat: 25.0693, lng: 55.1419 },
  { id: 'al-furjan', code: 'FRJN', ticker: 'FRJN.DXB', name: 'Al Furjan', image: '/media/communities/jvc.webp', ppsf: 1410, ppsfLY: 1250, rentStudio: 50000, rent1: 75000, rent2: 115000, rent3: 170000, yieldPct: 7.3, serviceCharge: 13, transactionsQ: 1120, offPlanShare: 46, trend: [1040, 1090, 1140, 1190, 1250, 1290, 1330, 1370, 1410], segment: 'Mid', lat: 25.0332, lng: 55.1469 },
  { id: 'dubai-silicon-oasis', code: 'DSOA', ticker: 'DSOA.DXB', name: 'Dubai Silicon Oasis', image: '/media/communities/business-bay.webp', ppsf: 1120, ppsfLY: 980, rentStudio: 42000, rent1: 62000, rent2: 92000, rent3: 135000, yieldPct: 8.2, serviceCharge: 12, transactionsQ: 940, offPlanShare: 48, trend: [810, 850, 890, 930, 980, 1020, 1060, 1090, 1120], segment: 'Value', lat: 25.1212, lng: 55.3773 },
  { id: 'dubai-sports-city', code: 'SPRT', ticker: 'SPRT.DXB', name: 'Dubai Sports City', image: '/media/communities/jvc.webp', ppsf: 1180, ppsfLY: 1030, rentStudio: 43000, rent1: 64000, rent2: 96000, rent3: 140000, yieldPct: 8.1, serviceCharge: 12, transactionsQ: 870, offPlanShare: 44, trend: [860, 900, 940, 980, 1030, 1070, 1110, 1150, 1180], segment: 'Value', lat: 25.0414, lng: 55.2194 },
  { id: 'expo-city', code: 'EXPO', ticker: 'EXPO.DXB', name: 'Expo City Dubai', image: '/media/communities/dubai-creek-harbour.webp', ppsf: 2080, ppsfLY: 1810, rentStudio: 60000, rent1: 90000, rent2: 138000, rent3: 205000, yieldPct: 6.4, serviceCharge: 16, transactionsQ: 680, offPlanShare: 78, trend: [1490, 1570, 1650, 1730, 1810, 1880, 1950, 2020, 2080], segment: 'Upper-mid', lat: 24.9602, lng: 55.1506 },
  { id: 'dubai-south', code: 'DSOU', ticker: 'DSOU.DXB', name: 'Dubai South', image: '/media/communities/dubai-hills-estate.webp', ppsf: 1290, ppsfLY: 1090, rentStudio: 45000, rent1: 68000, rent2: 102000, rent3: 150000, yieldPct: 7.6, serviceCharge: 12, transactionsQ: 2140, offPlanShare: 74, trend: [880, 930, 980, 1030, 1090, 1140, 1190, 1240, 1290], segment: 'Value', lat: 24.8967, lng: 55.1614 },
  { id: 'palm-jebel-ali', code: 'PLMJ', ticker: 'PLMJ.DXB', name: 'Palm Jebel Ali', image: '/media/communities/palm-jumeirah.webp', ppsf: 3650, ppsfLY: 3180, rentStudio: 100000, rent1: 150000, rent2: 240000, rent3: 390000, yieldPct: 5.5, serviceCharge: 20, transactionsQ: 540, offPlanShare: 98, trend: [2750, 2860, 2970, 3080, 3180, 3300, 3420, 3540, 3650], segment: 'Prime', lat: 25.0044, lng: 54.9886 },
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
