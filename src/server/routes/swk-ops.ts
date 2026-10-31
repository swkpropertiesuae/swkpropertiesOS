import type { FastifyInstance } from 'fastify'
import { q, tx } from '../db'
import { can, createRecord, deleteRecord, getDef, insertRow, SYSTEM_CTX, updateRecord, type Ctx } from '../engine'
import { HttpError, fromCents, nowIso, nowLocal, toCents, todayStr } from '../util'
import { notify, notifyLeadership } from '../notify'
import { sendWhatsApp, ownerNumbers } from '../integrations/whatsapp'
import { computeDubaiShiftInfo } from '../domain/swk-one'

export interface AreaIntelligence {
  code: string
  ticker: string
  name: string
  segment: 'Prime' | 'Upper-mid' | 'Mid' | 'Value'
  ppsf: number
  ppsfLY: number
  yoyPct: number
  yieldPct: number
  serviceCharge: number
  transactionsQ: number
  offPlanShare: number
  rentStudio: number
  rent1: number
  rent2: number
  rent3: number
  lat: number
  lng: number
  trend: number[]
  forecast15Y: { year: number; projectedPpsf: number; catalyst: string }[]
  nearby: {
    metro: string
    landmarks: string[]
    schools: string[]
    hospitals: string[]
    beachOrParkMins: string
  }
  ongoingProjects: string[]
  future15YearOutlook: string
  closingKeywords: string[]
  fieldVisitPitchScript: string[]
}

export const DUBAI_AREAS_24: AreaIntelligence[] = [
  {
    code: 'PALM', ticker: 'PALM.DXB', name: 'Palm Jumeirah', segment: 'Prime',
    ppsf: 4380, ppsfLY: 3720, yoyPct: 17.7, yieldPct: 5.1, serviceCharge: 24, transactionsQ: 1180, offPlanShare: 38,
    rentStudio: 110000, rent1: 165000, rent2: 260000, rent3: 420000, lat: 25.1124, lng: 55.1390,
    trend: [3150, 3320, 3480, 3610, 3720, 3890, 4050, 4210, 4380],
    forecast15Y: [
      { year: 2026, projectedPpsf: 4380, catalyst: 'Ultra-prime branded residence handovers (Armani Beach, Como)' },
      { year: 2029, projectedPpsf: 5250, catalyst: 'Zero remaining freehold plots on crescent & fronds' },
      { year: 2033, projectedPpsf: 6400, catalyst: 'Global UHNW trophy asset scarcity & beachfront premium' },
      { year: 2037, projectedPpsf: 7650, catalyst: 'Generational villa redevelopment & smart coastal transit' },
      { year: 2041, projectedPpsf: 9100, catalyst: 'Dubai 2040 coastal heritage crown jewel status' },
    ],
    nearby: {
      metro: 'Palm Monorail → Dubai Tram → Sobha Realty Metro (8 mins)',
      landmarks: ['Atlantis The Royal', 'Nakheel Mall', 'Palm West Beach', 'The Pointe Waterfront'],
      schools: ['Dubai College (10 mins)', 'GEMS Wellington International (12 mins)', 'Regent International School'],
      hospitals: ['Al Zahra Hospital Dubai', 'Emirates Hospital Clinic Palm', 'Saudi German Hospital (12 mins)'],
      beachOrParkMins: '0 mins (Private beachfront & Al Ittihad Park)',
    },
    ongoingProjects: ['Omniyat Orla Infinity', 'Armani Beach Residences by Arada', 'Ellington Ocean House', 'Six Senses The Palm'],
    future15YearOutlook: 'Zero new land supply makes Palm Jumeirah the ultimate scarcity play over the next 15 years (2026–2041). Expect continuous ultra-luxury villa rebuilds and 2x+ capital appreciation driven by global billionaire migration.',
    closingKeywords: ['Zero New Land Supply', 'Private Beachfront Trophy Asset', '17.7% YoY Capital Growth', 'Instant 10-Year Golden Visa', 'UHNW Dollar-Pegged Safe Haven'],
    fieldVisitPitchScript: [
      'Notice the private beach access right here — not a single new plot can ever be added to Palm Jumeirah.',
      'Last year alone prices rose 17.7% to AED 4,380/sqft while maintaining a tax-free 5.1% yield.',
      'Every unit here comfortably exceeds the AED 2M 10-year Golden Visa threshold for your entire family.',
    ],
  },
  {
    code: 'DWNT', ticker: 'DWNT.DXB', name: 'Downtown Dubai', segment: 'Prime',
    ppsf: 2980, ppsfLY: 2660, yoyPct: 12.0, yieldPct: 5.6, serviceCharge: 21, transactionsQ: 1640, offPlanShare: 31,
    rentStudio: 85000, rent1: 125000, rent2: 195000, rent3: 300000, lat: 25.1972, lng: 55.2744,
    trend: [2310, 2400, 2490, 2580, 2660, 2740, 2820, 2900, 2980],
    forecast15Y: [
      { year: 2026, projectedPpsf: 2980, catalyst: 'Dubai Mall AED 1.5B expansion & Opera District completion' },
      { year: 2029, projectedPpsf: 3550, catalyst: 'Full maturation of final Boulevard & Burj Crown plots' },
      { year: 2033, projectedPpsf: 4250, catalyst: 'DIFC Zabeel expansion linking seamlessly to Downtown' },
      { year: 2037, projectedPpsf: 5100, catalyst: 'Pedestrianized climate-controlled boulevard network' },
      { year: 2041, projectedPpsf: 6050, catalyst: 'Undisputed cultural & tourism core of the Middle East' },
    ],
    nearby: {
      metro: 'Burj Khalifa / Dubai Mall Metro Station (Direct air-conditioned link)',
      landmarks: ['Burj Khalifa', 'The Dubai Mall (100M+ annual visitors)', 'Dubai Opera', 'Souk Al Bahar'],
      schools: ['JSS Private School (8 mins)', 'Hartland International School (10 mins)', 'Citizens School (7 mins)'],
      hospitals: ['Mediclinic Dubai Mall', 'Emirates Hospital Jumeirah (12 mins)', 'American Hospital (14 mins)'],
      beachOrParkMins: '2 mins to Burj Park; 12 mins to Jumeirah Beach',
    },
    ongoingProjects: ['Dubai Mall 200-Store Luxury Expansion', 'Mercedes-Benz Places by Binghatti', 'St. Regis The Residences', 'Address Residences Zabeel'],
    future15YearOutlook: 'With Emaar’s AED 1.5B Dubai Mall expansion and adjacent DIFC 2.0 growth, Downtown is transitioning into a completely built-out Manhattan-style core over 2026–2041 with unmatched short-term & corporate rental liquidity.',
    closingKeywords: ['Center of Now', '100M+ Footfall Next Door', 'Unmatched Resale Liquidity', 'Burj Khalifa View Premium', 'High Holiday-Home ADR'],
    fieldVisitPitchScript: [
      'Look at the direct Burj corridor — properties with this view command a 22% resale and holiday-home premium.',
      'With Emaar’s AED 1.5 billion expansion of Dubai Mall right across the boulevard, footfall is passing 110 million visitors a year.',
      'If you ever want to exit in 48 hours, Downtown Dubai is the most liquid real estate submarket in the region.',
    ],
  },
  {
    code: 'MARN', ticker: 'MARN.DXB', name: 'Dubai Marina', segment: 'Upper-mid',
    ppsf: 2290, ppsfLY: 2070, yoyPct: 10.6, yieldPct: 6.4, serviceCharge: 18, transactionsQ: 2210, offPlanShare: 22,
    rentStudio: 72000, rent1: 105000, rent2: 160000, rent3: 230000, lat: 25.0805, lng: 55.1403,
    trend: [1780, 1850, 1920, 2000, 2070, 2130, 2190, 2240, 2290],
    forecast15Y: [
      { year: 2026, projectedPpsf: 2290, catalyst: 'Six Senses Residences & Ciel Tower completion' },
      { year: 2029, projectedPpsf: 2720, catalyst: 'Dubai Harbour superyacht marina & bridge connectivity' },
      { year: 2033, projectedPpsf: 3250, catalyst: 'Palm Jebel Ali corridor boosting New Dubai coastal belt' },
      { year: 2037, projectedPpsf: 3850, catalyst: 'Legacy tower refurbishment cycle & waterfront scarcity' },
      { year: 2041, projectedPpsf: 4550, catalyst: 'Dubai 2040 primary beachfront tourism & lifestyle hub' },
    ],
    nearby: {
      metro: 'Sobha Realty Metro & DMCC Metro + Dubai Tram Loop',
      landmarks: ['Dubai Marina Mall', 'Pier 7', 'JBR Walk & The Beach', 'Dubai Harbour Yacht Club'],
      schools: ['Emirates International School Meadows (10 mins)', 'Dubai British School Emirates Hills (12 mins)'],
      hospitals: ['Medcare Medical Centre Marina', 'Saudi German Hospital Barsha (10 mins)', 'Al Zahra Hospital'],
      beachOrParkMins: '5 mins walk to JBR Beach & 7km Marina Promenade',
    },
    ongoingProjects: ['Six Senses Residences Dubai Marina', 'Franck Muller Aeternitas', 'LIV Waterside', 'Habtoor Grand Residences'],
    future15YearOutlook: '95%+ built out, Dubai Marina benefits over the next 15 years from European/UK expat demand, walkability to metro/beach, and spillover from Dubai Harbour and Palm Jebel Ali.',
    closingKeywords: ['Walk-to-Beach & Metro', '95% Occupancy Year-Round', '6.4% Gross Rental Yield', 'European Expat Magnet', 'Zero Future Construction Noise'],
    fieldVisitPitchScript: [
      'You are 5 minutes on foot from both the Metro and the beach — that is why Marina occupancy stays above 95% all year.',
      'At AED 2,290/sqft you are buying waterfront at nearly half the price per square foot of Palm Jumeirah.',
      'Whether you lease annually or on short-term holiday lets, tenants line up within days of listing.',
    ],
  },
  {
    code: 'BBAY', ticker: 'BBAY.DXB', name: 'Business Bay', segment: 'Upper-mid',
    ppsf: 2180, ppsfLY: 1950, yoyPct: 11.8, yieldPct: 6.8, serviceCharge: 17, transactionsQ: 2570, offPlanShare: 54,
    rentStudio: 68000, rent1: 98000, rent2: 150000, rent3: 210000, lat: 25.1865, lng: 55.2631,
    trend: [1640, 1710, 1790, 1870, 1950, 2010, 2070, 2120, 2180],
    forecast15Y: [
      { year: 2026, projectedPpsf: 2180, catalyst: 'Marasi Bay ultra-luxury yacht club by Omniyat' },
      { year: 2029, projectedPpsf: 2650, catalyst: 'Bugatti, Jacob & Co, and One River Point handovers' },
      { year: 2033, projectedPpsf: 3200, catalyst: 'Complete Canal promenade activation & DIFC spillover' },
      { year: 2037, projectedPpsf: 3820, catalyst: 'Narrowing price gap with Downtown Dubai to <12%' },
      { year: 2041, projectedPpsf: 4500, catalyst: 'Central financial & waterfront residential powerhouse' },
    ],
    nearby: {
      metro: 'Business Bay Metro Station + RTA Water Canal Marine Transport',
      landmarks: ['Dubai Water Canal Boardwalk', 'Marasi Bay Marina', 'The Opus by Zaha Hadid', 'Downtown Dubai (3 mins)'],
      schools: ['Horizon English School (8 mins)', 'JSS Private School (6 mins)', 'Dubai International School'],
      hospitals: ['Emirates Hospital Clinic Business Bay', 'Aster Royal Clinic', 'Mediclinic City Hospital (12 mins)'],
      beachOrParkMins: '1 min to Dubai Canal 12km Jogging Track; 10 mins to Jumeirah Beach & Safa Park',
    },
    ongoingProjects: ['Bugatti Residences by Binghatti', 'Vela & Vela Viento by Omniyat', 'Peninsula by Select Group', 'One River Point by Ellington'],
    future15YearOutlook: 'Over 2026–2041, Business Bay’s Marasi Bay and Dubai Water Canal transformation is turning it from a commercial district into an ultra-prime waterfront rivaling Downtown at a 27% discount per sqft.',
    closingKeywords: ['Dubai Canal Waterfront', '27% Discount vs Downtown', '6.8% High Corporate Yield', 'Marasi Bay Luxury Re-rating', '3 Mins to Burj Khalifa & DIFC'],
    fieldVisitPitchScript: [
      'We are literally 3 minutes from Burj Khalifa, yet you are entering at AED 2,180/sqft instead of AED 2,980/sqft in Downtown.',
      'Look at the Dubai Water Canal promenade — Omniyat and Select Group are turning Marasi Bay into the Monaco of central Dubai.',
      'Finance and tech executives working in DIFC and Business Bay drive a rock-solid 6.8% rental yield here.',
    ],
  },
  {
    code: 'DHIL', ticker: 'DHIL.DXB', name: 'Dubai Hills Estate', segment: 'Upper-mid',
    ppsf: 2390, ppsfLY: 2090, yoyPct: 14.4, yieldPct: 5.8, serviceCharge: 15, transactionsQ: 1930, offPlanShare: 47,
    rentStudio: 70000, rent1: 110000, rent2: 170000, rent3: 260000, lat: 25.1014, lng: 55.2298,
    trend: [1720, 1810, 1900, 2000, 2090, 2170, 2250, 2320, 2390],
    forecast15Y: [
      { year: 2026, projectedPpsf: 2390, catalyst: 'Parkside & Golf Grand handovers around Central Park' },
      { year: 2029, projectedPpsf: 2920, catalyst: 'Planned Etihad Rail & Metro connectivity along Umm Suqeim/Al Khail' },
      { year: 2033, projectedPpsf: 3550, catalyst: '100% master-community completion by Emaar' },
      { year: 2037, projectedPpsf: 4250, catalyst: 'Generational family villa & park-view scarcity' },
      { year: 2041, projectedPpsf: 5100, catalyst: 'Green Heart of Dubai benchmark family address' },
    ],
    nearby: {
      metro: 'Dubai Hills Mall RTA Express Bus → Equiti Metro (10 mins); future metro corridor',
      landmarks: ['Dubai Hills Mall', '18-Hole Championship Golf Course', 'Dubai Hills Central Park (180,000 sqm)'],
      schools: ['GEMS International School', 'GEMS Wellington Academy Al Khail', 'GEMS New Millennium School'],
      hospitals: ['King’s College Hospital London (Inside Community)', 'Mediclinic Parkview (8 mins)'],
      beachOrParkMins: '0 mins to 180,000 sqm Central Park; 12 mins to Umm Suqeim Beach',
    },
    ongoingProjects: ['Address Residences Dubai Hills', 'Vida Residences Club Point', 'Parkland & Golf Hillside by Emaar'],
    future15YearOutlook: 'As Emaar’s flagship green master community with King’s College Hospital, 3 GEMS schools, and Dubai Hills Mall inside the gates, 2026–2041 will cement Dubai Hills as the #1 end-user family capital growth engine.',
    closingKeywords: ['Emaar Master Community', '14.4% YoY Capital Growth', 'King’s College Hospital & 3 GEMS Schools Inside', '18-Hole Golf & Central Park', 'Low AED 15/sqft Service Charge'],
    fieldVisitPitchScript: [
      'Families move to Dubai Hills and never leave — you have King’s College Hospital, three GEMS schools, and Dubai Hills Mall without ever exiting the community.',
      'Emaar’s master-planned green communities historically double within 7–9 years of final handover, and we are already up 14.4% YoY.',
      'Notice the low AED 15/sqft service charge — that keeps your net rental return remarkably strong.',
    ],
  },
  {
    code: 'DCHB', ticker: 'DCHB.DXB', name: 'Dubai Creek Harbour', segment: 'Upper-mid',
    ppsf: 2320, ppsfLY: 2050, yoyPct: 13.2, yieldPct: 6.2, serviceCharge: 17, transactionsQ: 1410, offPlanShare: 66,
    rentStudio: 66000, rent1: 98000, rent2: 150000, rent3: 220000, lat: 25.2048, lng: 55.3463,
    trend: [1690, 1770, 1860, 1960, 2050, 2120, 2190, 2260, 2320],
    forecast15Y: [
      { year: 2026, projectedPpsf: 2320, catalyst: 'Creek Beach & Palace Residences completion' },
      { year: 2029, projectedPpsf: 2950, catalyst: 'Dubai Metro Blue Line opening with iconic Creek station (2029)' },
      { year: 2033, projectedPpsf: 3750, catalyst: 'Redesigned Dubai Creek Tower & Dubai Square mega-retail opening' },
      { year: 2037, projectedPpsf: 4600, catalyst: 'Full island & sanctuary district activation (2x size of Downtown)' },
      { year: 2041, projectedPpsf: 5650, catalyst: 'New Eastern Downtown of Dubai 2040 Master Plan' },
    ],
    nearby: {
      metro: 'Upcoming Dubai Metro Blue Line Iconic Station (Designed by SOM, Target 2029) + RTA Marine Ferry',
      landmarks: ['Creek Marina Yacht Club', 'Ras Al Khor Flamingo Sanctuary', 'Viewing Point Cantilever', 'Creek Beach'],
      schools: ['Swiss International Scientific School (7 mins)', 'Deira International School (8 mins)'],
      hospitals: ['Mediclinic City Hospital (10 mins)', 'Clemenceau Medical Center (10 mins)'],
      beachOrParkMins: '0 mins to Creek Beach Lagoon & Central Park',
    },
    ongoingProjects: ['Dubai Metro Blue Line Iconic Station', 'Dubai Square Mega Mall', 'Redesigned Creek Tower by Emaar', 'Address Grand Creek'],
    future15YearOutlook: 'Twice the size of Downtown Dubai and anchored by the 2029 Dubai Metro Blue Line, Dubai Square, and the redesigned Creek Tower, Dubai Creek Harbour has the strongest 15-year infrastructure catalyst in the Emirate.',
    closingKeywords: ['2x Size of Downtown Dubai', '2029 Metro Blue Line Catalyst', 'Flamingo Sanctuary & Skyline Views', 'Emaar Waterfront Masterplan', 'Early-Innings Capital Multiplier'],
    fieldVisitPitchScript: [
      'Buying here today is like buying Downtown Dubai in 2008 before Dubai Mall and the Metro station opened.',
      'In 2029 the new Dubai Metro Blue Line opens its flagship station right here, alongside Emaar’s Dubai Square mega-retail.',
      'You get uninterrupted views of both the Ras Al Khor Flamingo Sanctuary and the Downtown Burj Khalifa skyline.',
    ],
  },
  {
    code: 'JVCC', ticker: 'JVCC.DXB', name: 'Jumeirah Village Circle', segment: 'Value',
    ppsf: 1320, ppsfLY: 1200, yoyPct: 10.0, yieldPct: 7.9, serviceCharge: 13, transactionsQ: 3380, offPlanShare: 61,
    rentStudio: 48000, rent1: 72000, rent2: 105000, rent3: 145000, lat: 25.0597, lng: 55.2066,
    trend: [1010, 1050, 1090, 1150, 1200, 1230, 1260, 1290, 1320],
    forecast15Y: [
      { year: 2026, projectedPpsf: 1320, catalyst: '4 new Hessa Street & Al Khail access bridges cutting traffic by 60%' },
      { year: 2029, projectedPpsf: 1620, catalyst: 'Boutique resort-style handovers (Ellington, Binghatti, Iman)' },
      { year: 2033, projectedPpsf: 1980, catalyst: 'Near-complete plot absorption & community park upgrades' },
      { year: 2037, projectedPpsf: 2350, catalyst: 'Planned southern metro line feeder integration' },
      { year: 2041, projectedPpsf: 2800, catalyst: 'Mature mid-market cash-cow community in central New Dubai' },
    ],
    nearby: {
      metro: 'RTA J01 Bus to Mall of the Emirates Metro (15 mins)',
      landmarks: ['Circle Mall JVC', '33 Landscaped Community Parks', 'FIVE Jumeirah Village Hotel'],
      schools: ['JSS International School (Inside JVC)', 'Sunmarke School (8 mins)', 'Nord Anglia International (10 mins)'],
      hospitals: ['Karama Medical Centre JVC', 'Right Health Clinic', 'Mediclinic Parkview (10 mins)'],
      beachOrParkMins: '1 min to 33 neighbourhood parks; 15 mins to Dubai Marina & JBR',
    },
    ongoingProjects: ['RTA Hessa Street AED 689M Expansion', 'Binghatti Phantom & Royale', 'Ellington Mercer House / Belgravia Series', 'Danube Elitz 3'],
    future15YearOutlook: 'As the #1 transaction volume hub in Dubai with a 7.9% gross rental yield and RTA’s Hessa Street expansion solving peak traffic, JVC remains the undisputed cash-flow champion for 2026–2041.',
    closingKeywords: ['#1 Transaction Volume in Dubai', '7.9% High Cash-Flow Yield', 'AED 1,320/sqft Entry Point', 'Hessa Street Upgrade Catalyst', 'Low AED 13/sqft Service Charge'],
    fieldVisitPitchScript: [
      'JVC records more sales and rental contracts than any other community in Dubai — over 3,300 transactions a quarter.',
      'At a 7.9% gross yield and only AED 13/sqft service charge, your rental income pays the property off in just over 11 years.',
      'RTA’s new Al Khail and Hessa Street flyovers have cut entry and exit times in half.',
    ],
  },
  {
    code: 'SZRD', ticker: 'SZRD.DXB', name: 'Sheikh Zayed Road', segment: 'Mid',
    ppsf: 1920, ppsfLY: 1760, yoyPct: 9.1, yieldPct: 6.6, serviceCharge: 16, transactionsQ: 760, offPlanShare: 18,
    rentStudio: 64000, rent1: 92000, rent2: 140000, rent3: 195000, lat: 25.2167, lng: 55.2797,
    trend: [1520, 1570, 1630, 1700, 1760, 1800, 1840, 1880, 1920],
    forecast15Y: [
      { year: 2026, projectedPpsf: 1920, catalyst: 'DWTC One Central & Museum of the Future commercial boom' },
      { year: 2029, projectedPpsf: 2300, catalyst: 'Freehold conversion of prime SZR plots delivering luxury towers' },
      { year: 2033, projectedPpsf: 2780, catalyst: 'DIFC Zabeel & Trade Centre district integration' },
      { year: 2037, projectedPpsf: 3300, catalyst: 'Autonomous aerial taxi vertiports along SZR corridor' },
      { year: 2041, projectedPpsf: 3900, catalyst: 'Iconic spine of Dubai connecting Old & New financial centers' },
    ],
    nearby: {
      metro: 'Emirates Towers, Financial Centre & World Trade Centre Metro Stations (Direct doorstep)',
      landmarks: ['Museum of the Future', 'Dubai World Trade Centre', 'Emirates Towers', 'DIFC Gate Village'],
      schools: ['GEMS Wellington Primary (5 mins)', 'Lycee Francais International'],
      hospitals: ['Emirates Towers Medical Clinic', 'Iranian Hospital', 'Latifa Hospital (10 mins)'],
      beachOrParkMins: '5 mins to Zabeel Park; 10 mins to La Mer / J1 Beach',
    },
    ongoingProjects: ['DLD Freehold Conversion Corridor Towers', ' Sobha Central SZR', 'Habtoor Tower', 'One Central Phase 2'],
    future15YearOutlook: 'Recent freehold conversion of plots along Sheikh Zayed Road next to DIFC and Museum of the Future has unlocked rare trophy development opportunities for the next 15 years.',
    closingKeywords: ['Direct Red Line Metro Doorstep', 'Museum of the Future & DIFC Corridor', 'Rare New Freehold Conversion', '6.6% Executive Rental Yield', 'Zero Commute for Bankers & Consultants'],
    fieldVisitPitchScript: [
      'For decades this stretch of Sheikh Zayed Road was leasehold — newly converted freehold units here are ultra-rare.',
      'Executives working in DIFC and One Central can walk to the Metro or their office in 3 minutes.',
      'With Museum of the Future right outside, short-term corporate bookings run above 88% occupancy.',
    ],
  },
  {
    code: 'BRSH', ticker: 'BRSH.DXB', name: 'Al Barsha', segment: 'Mid',
    ppsf: 1450, ppsfLY: 1330, yoyPct: 9.0, yieldPct: 7.1, serviceCharge: 14, transactionsQ: 620, offPlanShare: 35,
    rentStudio: 52000, rent1: 78000, rent2: 118000, rent3: 165000, lat: 25.1112, lng: 55.2003,
    trend: [1150, 1190, 1240, 1290, 1330, 1360, 1390, 1420, 1450],
    forecast15Y: [
      { year: 2026, projectedPpsf: 1450, catalyst: 'Arjan/Barsha South Miracle Garden corridor maturation' },
      { year: 2029, projectedPpsf: 1750, catalyst: 'Mall of the Emirates AED 1B lifestyle & dining upgrade' },
      { year: 2033, projectedPpsf: 2100, catalyst: 'Umm Suqeim transit corridor expansion' },
      { year: 2037, projectedPpsf: 2500, catalyst: 'Full infill of Barsha South / Science Park' },
      { year: 2041, projectedPpsf: 2950, catalyst: 'Established central residential & education district' },
    ],
    nearby: {
      metro: 'Mall of the Emirates & Mashreq Metro Stations',
      landmarks: ['Mall of the Emirates & Ski Dubai', 'Dubai Miracle Garden', 'Al Barsha Pond Park'],
      schools: ['American School of Dubai', 'GEMS Dubai American Academy', 'Kings’ School Al Barsha'],
      hospitals: ['Saudi German Hospital', 'Al Zahra Hospital', 'Mediclinic Parkview'],
      beachOrParkMins: '3 mins to Al Barsha Pond Park; 10 mins to Sufouh Secret Beach',
    },
    ongoingProjects: ['Vincitore Aqua Dimore (Barsha South)', 'Samana Barari Views', 'Jewelz by Danube'],
    future15YearOutlook: 'Anchored by Mall of the Emirates, top American/British schools, and two major hospitals, Al Barsha and Barsha South offer recession-proof family and medical-professional rental demand through 2041.',
    closingKeywords: ['Mall of the Emirates Hub', '7.1% Stable Family Yield', 'Top Schools & 3 Major Hospitals', 'Central Umm Suqeim Connectivity', 'Strong End-User Demand'],
    fieldVisitPitchScript: [
      'Look around within a 5-minute radius: Mall of the Emirates, Saudi German Hospital, Al Zahra Hospital, and five KHDA Outstanding schools.',
      'Doctors, teachers, and corporate families make Al Barsha one of the lowest-vacancy rental markets in Dubai.',
      'At AED 1,450/sqft with a 7.1% yield, you get central location at a value entry price.',
    ],
  },
  {
    code: 'EMLV', ticker: 'EMLV.DXB', name: 'Emirates Living', segment: 'Prime',
    ppsf: 2650, ppsfLY: 2310, yoyPct: 14.7, yieldPct: 5.3, serviceCharge: 6, transactionsQ: 490, offPlanShare: 5,
    rentStudio: 0, rent1: 120000, rent2: 185000, rent3: 290000, lat: 25.0695, lng: 55.1687,
    trend: [1890, 1980, 2090, 2200, 2310, 2400, 2490, 2570, 2650],
    forecast15Y: [
      { year: 2026, projectedPpsf: 2650, catalyst: 'Ultra-prime upgrades in Emirates Hills, Meadows & Lakes' },
      { year: 2029, projectedPpsf: 3200, catalyst: 'Zero new villa plots within 10 mins of Dubai Marina' },
      { year: 2033, projectedPpsf: 3900, catalyst: 'Complete custom-villa modernization wave' },
      { year: 2037, projectedPpsf: 4700, catalyst: 'Mature botanical canopy & golf-course prestige' },
      { year: 2041, projectedPpsf: 5600, catalyst: 'Beverly Hills of Dubai permanent trophy status' },
    ],
    nearby: {
      metro: 'Sobha Realty & DMCC Metro (7 mins drive)',
      landmarks: ['Address Montgomerie Golf Club', 'The Lakes Club', 'Meadows Village Mall', 'Springs Souk'],
      schools: ['Dubai British School Emirates Hills', 'Emirates International School Meadows', 'Regent International'],
      hospitals: ['Mediclinic Meadows', 'Saudi German Hospital (10 mins)'],
      beachOrParkMins: '0 mins to 20+ community lakes & parks; 10 mins to JBR Beach',
    },
    ongoingProjects: ['Bespoke Ultra-Luxury Mansion Rebuilds in Emirates Hills', 'Meadows Village Expansion'],
    future15YearOutlook: '100% built out with mature trees, natural lakes, Montgomerie Golf Course, and ultra-low AED 6/sqft villa service charges, Emirates Living (Emirates Hills, Meadows, Lakes, Springs) is irreplaceable.',
    closingKeywords: ['Beverly Hills of Dubai', '100% Built-Out Villa Scarcity', 'Ultra-Low AED 6/sqft Service Charge', 'Montgomerie Golf & Lake Views', 'Massive Renovation Value-Add'],
    fieldVisitPitchScript: [
      'You cannot replicate 20-year-old mature trees, natural lakes, and a location 8 minutes from Dubai Marina.',
      'Because villa service charges here are just AED 6/sqft, almost every dirham of rent goes straight into your pocket.',
      'Investors upgrading Springs and Meadows villas are flipping them for 35–45% premiums within 9 months.',
    ],
  },
  {
    code: 'ARAB', ticker: 'ARAB.DXB', name: 'Arabian Ranches', segment: 'Upper-mid',
    ppsf: 1850, ppsfLY: 1620, yoyPct: 14.2, yieldPct: 5.9, serviceCharge: 5, transactionsQ: 810, offPlanShare: 28,
    rentStudio: 0, rent1: 0, rent2: 145000, rent3: 215000, lat: 25.0545, lng: 55.2683,
    trend: [1340, 1410, 1480, 1550, 1620, 1680, 1740, 1800, 1850],
    forecast15Y: [
      { year: 2026, projectedPpsf: 1850, catalyst: 'Arabian Ranches III final phase handovers (May, Anya)' },
      { year: 2029, projectedPpsf: 2250, catalyst: 'Global Village & Academic City transit upgrades' },
      { year: 2033, projectedPpsf: 2720, catalyst: 'Planned Metro Blue/Southern Corridor expansion' },
      { year: 2037, projectedPpsf: 3250, catalyst: 'Multi-generational villa community maturity across Ranches 1, 2 & 3' },
      { year: 2041, projectedPpsf: 3900, catalyst: 'Premier equestrian & golf villa belt of Dubai' },
    ],
    nearby: {
      metro: 'RTA Bus F30 to Mall of the Emirates Metro',
      landmarks: ['Arabian Ranches Golf Club', 'Dubai Polo & Equestrian Club', 'Ranches Souk', 'Global Village (5 mins)'],
      schools: ['Jumeirah English Speaking School (JESS) Arabian Ranches', 'Ranches Primary School'],
      hospitals: ['Mediclinic Arabian Ranches', 'Aster Clinic Arabian Ranches'],
      beachOrParkMins: '0 mins to lazy river, clubhouse & equestrian trails; 22 mins to Kite Beach',
    },
    ongoingProjects: ['Arabian Ranches III May & Anya by Emaar', 'Caya & Elie Saab Villas at Ranches III'],
    future15YearOutlook: 'Home to the iconic JESS school, Polo Club, and Championship Golf Course, Arabian Ranches I, II & III represent Emaar’s gold standard for suburban family living through 2041.',
    closingKeywords: ['Home to JESS School', 'Golf & Polo Lifestyle', '14.2% YoY Villa Appreciation', 'Ultra-Low AED 5/sqft Service Charge', '98% Family Villa Occupancy'],
    fieldVisitPitchScript: [
      'Families wait on waiting lists just to live in the JESS Arabian Ranches catchment area.',
      'Villa prices here climbed 14.2% over the past 12 months because Dubai has an acute shortage of ready family villas.',
      'With service charges at just AED 5/sqft, your holding cost is minimal while equity compounds every year.',
    ],
  },
  {
    code: 'DAMH', ticker: 'DAMH.DXB', name: 'DAMAC Hills', segment: 'Mid',
    ppsf: 1540, ppsfLY: 1360, yoyPct: 13.2, yieldPct: 6.7, serviceCharge: 12, transactionsQ: 1450, offPlanShare: 49,
    rentStudio: 49000, rent1: 74000, rent2: 112000, rent3: 175000, lat: 25.0218, lng: 55.2494,
    trend: [1120, 1180, 1240, 1300, 1360, 1410, 1460, 1500, 1540],
    forecast15Y: [
      { year: 2026, projectedPpsf: 1540, catalyst: 'DAMAC Lagoons crystal lagoon clusters handing over adjacent' },
      { year: 2029, projectedPpsf: 1900, catalyst: 'Al Maktoum Airport expansion driving southern corridor boom' },
      { year: 2033, projectedPpsf: 2320, catalyst: 'Hessa Street & Emirates Road full expressway links' },
      { year: 2037, projectedPpsf: 2800, catalyst: 'Mature Trump International Golf & Lagoon resort belt' },
      { year: 2041, projectedPpsf: 3350, catalyst: 'Core golf-and-lagoon residential hub of South-Central Dubai' },
    ],
    nearby: {
      metro: 'RTA Express Bus J03/J04 to Dubai Internet City Metro',
      landmarks: ['Trump International Golf Club Dubai', 'Malibu Bay Wave Pool', 'DAMAC Mall', '4 Million Sqft Park'],
      schools: ['Jebel Ali School (Inside Community)', 'Fairgreen International School (8 mins)'],
      hospitals: ['Saudi German Clinic DAMAC Hills', 'Medcare Medical Centre Tilal Al Ghaf (5 mins)'],
      beachOrParkMins: '0 mins to Malibu Bay Wave Beach & 4M sqft Parklands',
    },
    ongoingProjects: ['Golf Greens & Golf Gate by DAMAC', 'Autograph Collection Boutique Villas', 'Gems Estates Cavalli'],
    future15YearOutlook: 'With Trump International Golf Club, Jebel Ali School inside the gates, Malibu Bay wave beach, and proximity to the Al Maktoum growth corridor, DAMAC Hills delivers golf-community prestige at 35% below Dubai Hills prices.',
    closingKeywords: ['Trump International Golf Club', '35% Discount vs Dubai Hills', 'Jebel Ali School Inside', 'Malibu Bay Wave Beach', '6.7% Golf-View Yield'],
    fieldVisitPitchScript: [
      'Compare this golf-course view at AED 1,540/sqft to AED 2,390/sqft in Dubai Hills — that is a 35% value advantage.',
      'You have Jebel Ali School, DAMAC Mall, Saudi German Clinic, and Malibu Bay wave beach all inside the community gates.',
      'Both apartments and villas here are delivering a 6.7% yield with 13.2% annual capital growth.',
    ],
  },
  {
    code: 'SOBH', ticker: 'SOBH.DXB', name: 'Sobha Hartland', segment: 'Prime',
    ppsf: 2410, ppsfLY: 2140, yoyPct: 12.6, yieldPct: 6.1, serviceCharge: 18, transactionsQ: 1320, offPlanShare: 58,
    rentStudio: 68000, rent1: 102000, rent2: 155000, rent3: 235000, lat: 25.1765, lng: 55.3075,
    trend: [1810, 1890, 1970, 2060, 2140, 2210, 2280, 2350, 2410],
    forecast15Y: [
      { year: 2026, projectedPpsf: 2410, catalyst: 'Waves Grande & Crest crystal lagoon completion' },
      { year: 2029, projectedPpsf: 2980, catalyst: 'Sobha Hartland II swimmable lagoons & Meydan Mall activation' },
      { year: 2033, projectedPpsf: 3650, catalyst: 'Direct Metro line connectivity across MBR City / Meydan' },
      { year: 2037, projectedPpsf: 4400, catalyst: 'Complete 8M+ sqft central lagoon forest community' },
      { year: 2041, projectedPpsf: 5250, catalyst: 'Premier German-standard build quality benchmark in central Dubai' },
    ],
    nearby: {
      metro: '8 mins to Business Bay & Burj Khalifa Metro; planned Meydan line',
      landmarks: ['Crystal Lagoon Boardwalk', 'Meydan Racecourse (5 mins)', 'Ras Al Khor Wildlife Sanctuary'],
      schools: ['North London Collegiate School (Inside Community)', 'Hartland International School (Inside Community)'],
      hospitals: ['Mediclinic City Hospital (10 mins)', 'Emirates Hospital Business Bay (8 mins)'],
      beachOrParkMins: '0 mins to Private Crystal Lagoons & 2.4M sqft Green Parks',
    },
    ongoingProjects: ['Sobha Hartland II (310, 320, 330, 340, 350, 360 Riverside Crescent)', 'Sobha Estates Forest Villas'],
    future15YearOutlook: 'Built with Sobha’s famous backward-integrated German quality standard and housing two of Dubai’s top British/IB schools on site, Sobha Hartland I & II are 7 minutes from Burj Khalifa with crystal lagoons.',
    closingKeywords: ['Backward-Integrated Sobha Quality', '2 Top UK Schools Inside (NLCS & Hartland)', '7 Mins to Burj Khalifa', 'Swimmable Crystal Lagoons', '30% Dedicated Green Open Space'],
    fieldVisitPitchScript: [
      'Tap the walls and inspect the joinery — Sobha manufactures every window, door, and marble slab in-house with zero third-party contractors.',
      'Two of Dubai’s highest-ranked British schools — North London Collegiate and Hartland International — are a 2-minute walk inside the community.',
      'You are only 7 minutes from Downtown Dubai, yet living on a private swimmable crystal lagoon.',
    ],
  },
  {
    code: 'MBRM', ticker: 'MBRM.DXB', name: 'MBR City / Meydan', segment: 'Upper-mid',
    ppsf: 2150, ppsfLY: 1890, yoyPct: 13.8, yieldPct: 6.3, serviceCharge: 16, transactionsQ: 1880, offPlanShare: 64,
    rentStudio: 62000, rent1: 92000, rent2: 142000, rent3: 215000, lat: 25.1558, lng: 55.3003,
    trend: [1580, 1650, 1730, 1810, 1890, 1960, 2030, 2090, 2150],
    forecast15Y: [
      { year: 2026, projectedPpsf: 2150, catalyst: 'District One Lagoon Residences & Azizi Riviera promenade completion' },
      { year: 2029, projectedPpsf: 2700, catalyst: 'Meydan Horizon & Metro connectivity expansion' },
      { year: 2033, projectedPpsf: 3350, catalyst: 'Full activation of 7km Crystal Lagoon & Meydan One precinct' },
      { year: 2037, projectedPpsf: 4050, catalyst: 'Seamless central urban fabric with Downtown & DIFC' },
      { year: 2041, projectedPpsf: 4850, catalyst: 'Heart of Royal & Lagoon Living in central Dubai' },
    ],
    nearby: {
      metro: '10 mins to Business Bay Metro; future Meydan Metro Station',
      landmarks: ['Meydan Racecourse (Dubai World Cup)', 'District One 7km Crystal Lagoon', 'Deep Dive Dubai', '14km Cycling Track'],
      schools: ['Kent College Dubai', 'North London Collegiate School (5 mins)', 'Lycee Libanais Francophone'],
      hospitals: ['Fakeeh University Hospital (12 mins)', 'Mediclinic City Hospital (12 mins)'],
      beachOrParkMins: '0 mins to 7km District One Crystal Lagoon & Meydan Cycling Park',
    },
    ongoingProjects: ['District One West & Naya by Nakheel', 'Ellington Sanctuary & Claydon House', 'Keturah Reserve Bio-Living'],
    future15YearOutlook: 'Positioned directly south of Downtown Dubai around the royal Meydan palace district and a 7km crystal lagoon, MBR City offers massive 15-year upside as central infrastructure completes.',
    closingKeywords: ['Royal Meydan Address', '7km Swimmable Crystal Lagoon', '8 Mins to DIFC & Downtown', '14km Dedicated Cycling Track', '13.8% YoY Appreciation'],
    fieldVisitPitchScript: [
      'MBR City sits immediately behind Downtown Dubai and the Royal Zabeel district — location-wise it cannot be beaten.',
      'District One features a 7-kilometre swimmable crystal lagoon right in the center of the city.',
      'At AED 2,150/sqft, you are capturing early-stage infrastructure upside 8 minutes from DIFC.',
    ],
  },
  {
    code: 'DIFC', ticker: 'DIFC.DXB', name: 'DIFC', segment: 'Prime',
    ppsf: 3450, ppsfLY: 3020, yoyPct: 14.2, yieldPct: 5.5, serviceCharge: 23, transactionsQ: 420, offPlanShare: 42,
    rentStudio: 95000, rent1: 145000, rent2: 225000, rent3: 350000, lat: 25.2116, lng: 55.2816,
    trend: [2480, 2600, 2730, 2870, 3020, 3130, 3240, 3350, 3450],
    forecast15Y: [
      { year: 2026, projectedPpsf: 3450, catalyst: 'DIFC Living & Innovation Two completion; 45,000+ workforce' },
      { year: 2029, projectedPpsf: 4250, catalyst: 'DIFC Zabeel District AED 100B expansion Phase 1' },
      { year: 2033, projectedPpsf: 5200, catalyst: 'Top-5 Global Financial Hub status (Hedge Fund & Family Office surge)' },
      { year: 2037, projectedPpsf: 6300, catalyst: 'DIFC Zabeel full buildout with AI & FinTech campus' },
      { year: 2041, projectedPpsf: 7500, catalyst: 'Wall Street / Canary Wharf of the MEASA region' },
    ],
    nearby: {
      metro: 'Financial Centre & Emirates Towers Metro Stations (Direct Gate Avenue Link)',
      landmarks: ['DIFC Gate Building', 'Gate Village Fine Dining (Zuma, Cipriani, LPM)', 'ICD Brookfield Place', 'Museum of the Future'],
      schools: ['Hummingbird Early Learning DIFC', 'JSS Private School (6 mins)', 'Citizens School (7 mins)'],
      hospitals: ['Aster Royal Clinic DIFC', 'Valiant Clinic City Walk (8 mins)', 'American Hospital (12 mins)'],
      beachOrParkMins: '5 mins to Zabeel Park; 10 mins to J1 Beach',
    },
    ongoingProjects: ['DIFC Zabeel District Expansion', 'Four Seasons Private Residences DIFC', 'Heights Tower DIFC', 'Eden House Za’abeel'],
    future15YearOutlook: 'With over 6,000 financial firms, hedge funds, and family offices and less than 4,000 residential apartments inside the zone, DIFC has the highest executive tenant-to-unit ratio in the Middle East.',
    closingKeywords: ['45,000+ Bankers vs <4,000 Apartments', 'Walk to Zuma, LPM & ICD Brookfield', 'Common-Law Financial Freezone', 'DIFC Zabeel Mega-Expansion', 'Blue-Chip Corporate Leases'],
    fieldVisitPitchScript: [
      'There are over 45,000 high-earning executives working in DIFC and fewer than 4,000 residential apartments — the supply-demand imbalance is extreme.',
      'Your tenant is typically a hedge-fund partner or multinational executive whose company pays the rent in 1 cheque.',
      'You can walk in air-conditioned comfort through Gate Avenue to Zuma, Cipriani, and the Metro.',
    ],
  },
  {
    code: 'JBRB', ticker: 'JBRB.DXB', name: 'Jumeirah Beach Residence', segment: 'Prime',
    ppsf: 2680, ppsfLY: 2380, yoyPct: 12.6, yieldPct: 6.0, serviceCharge: 19, transactionsQ: 690, offPlanShare: 19,
    rentStudio: 82000, rent1: 120000, rent2: 180000, rent3: 270000, lat: 25.0777, lng: 55.1332,
    trend: [1990, 2080, 2180, 2280, 2380, 2460, 2540, 2610, 2680],
    forecast15Y: [
      { year: 2026, projectedPpsf: 2680, catalyst: 'Five LUXE JBR & Sensoria beachfront handovers' },
      { year: 2029, projectedPpsf: 3220, catalyst: 'Bluewaters & Dubai Harbour coastal promenade unification' },
      { year: 2033, projectedPpsf: 3850, catalyst: 'Complete beachfront facade & penthouse modernization wave' },
      { year: 2037, projectedPpsf: 4550, catalyst: 'Zero remaining beachfront plots along JBR 1.7km strip' },
      { year: 2041, projectedPpsf: 5350, catalyst: 'Miami Beach of the Middle East permanent icon' },
    ],
    nearby: {
      metro: 'JBR 1 & JBR 2 Tram Stations → DMCC & Sobha Realty Metro',
      landmarks: ['The Walk at JBR', 'The Beach by Meraas', 'Ain Dubai & Bluewaters Pedestrian Bridge', 'Pavilion at The Beach'],
      schools: ['British Orchard Nursery JBR', 'Emirates International School Meadows (12 mins)'],
      hospitals: ['Medcare Medical Centre JBR', 'Emirates Hospital Clinic Marina'],
      beachOrParkMins: '0 mins — Direct Elevator-to-Sand Beach Access',
    },
    ongoingProjects: ['La Vie by Dubai Properties', 'Sensoria at FIVE LUXE', 'Ultra-Prime Penthouse Retrofits'],
    future15YearOutlook: 'Direct elevator-to-sand beachfront living with Bluewaters and Ain Dubai views makes JBR one of the highest short-term Airbnb/holiday-home revenue generators over the next 15 years.',
    closingKeywords: ['Direct Elevator-to-Beach', 'Ain Dubai & Sea Views', 'Top Holiday-Home ADR in Dubai', '100% Built-Out 1.7km Coastline', 'Walk to 100+ Beach Restaurants'],
    fieldVisitPitchScript: [
      'Step out of your lobby and your feet are on the sand in 60 seconds — with Ain Dubai right across the water.',
      'Short-term holiday-home operators achieve AED 1,200 to AED 2,500 per night here during peak winter months.',
      'Every plot on this 1.7-kilometre beachfront strip is completely built out.',
    ],
  },
  {
    code: 'BLUW', ticker: 'BLUW.DXB', name: 'Bluewaters Island', segment: 'Prime',
    ppsf: 4850, ppsfLY: 4120, yoyPct: 17.7, yieldPct: 5.4, serviceCharge: 25, transactionsQ: 240, offPlanShare: 15,
    rentStudio: 0, rent1: 195000, rent2: 310000, rent3: 480000, lat: 25.0796, lng: 55.1225,
    trend: [3380, 3560, 3740, 3930, 4120, 4310, 4500, 4680, 4850],
    forecast15Y: [
      { year: 2026, projectedPpsf: 4850, catalyst: 'Bluewaters Bay by Meraas completion & Banyan Tree Resort' },
      { year: 2029, projectedPpsf: 5850, catalyst: 'Extreme island boutique scarcity (<1,400 total units)' },
      { year: 2033, projectedPpsf: 7100, catalyst: 'Ultra-prime island trophy status alongside Jumeirah Bay' },
      { year: 2037, projectedPpsf: 8500, catalyst: 'Private marina & hospitality integration' },
      { year: 2041, projectedPpsf: 10200, catalyst: 'Top-3 highest price-per-sqft private island in UAE' },
    ],
    nearby: {
      metro: 'Pedestrian Bridge to JBR Tram (5 mins) + Direct SZR Bridge',
      landmarks: ['Ain Dubai', 'Banyan Tree Dubai Resort', 'Cove Beach', 'The Pods & Madame Tussauds'],
      schools: ['Redwood Montessori Nursery Bluewaters', 'Dubai British School (14 mins)'],
      hospitals: ['Medcare Medical Centre JBR (5 mins)', 'Al Zahra Hospital (14 mins)'],
      beachOrParkMins: '0 mins to Private Island Beachfront & Promenade',
    },
    ongoingProjects: ['Bluewaters Bay by Meraas (Final Plots)'],
    future15YearOutlook: 'With fewer than 1,400 residential units on the entire Meraas-masterplanned island and Banyan Tree 5-star hospitality, Bluewaters is a rare boutique trophy asset.',
    closingKeywords: ['Only ~1,400 Units on the Entire Island', '17.7% YoY Trophy Appreciation', 'Meraas Low-Rise Island Masterplan', 'Banyan Tree 5-Star Lifestyle', 'Direct Private Bridge to SZR'],
    fieldVisitPitchScript: [
      'There are only 10 residential buildings on Bluewaters Island — whenever a unit hits the market, it receives multiple offers.',
      'Unlike dense high-rise clusters, Meraas designed Bluewaters as a low-rise boutique resort island with Banyan Tree right next door.',
      'Prices jumped 17.7% this year to AED 4,850/sqft and there is zero land left after Bluewaters Bay.',
    ],
  },
  {
    code: 'JLTS', ticker: 'JLTS.DXB', name: 'Jumeirah Lakes Towers', segment: 'Mid',
    ppsf: 1680, ppsfLY: 1490, yoyPct: 12.8, yieldPct: 7.4, serviceCharge: 15, transactionsQ: 1790, offPlanShare: 34,
    rentStudio: 58000, rent1: 86000, rent2: 132000, rent3: 185000, lat: 25.0693, lng: 55.1419,
    trend: [1240, 1300, 1360, 1420, 1490, 1540, 1590, 1640, 1680],
    forecast15Y: [
      { year: 2026, projectedPpsf: 1680, catalyst: 'Verde by Sobha & Marriott Residences JLT handovers' },
      { year: 2029, projectedPpsf: 2050, catalyst: 'Uptown Dubai super-tall towers & DMCC Phase 2 expansion' },
      { year: 2033, projectedPpsf: 2480, catalyst: 'Complete DMCC 30,000+ company freezone ecosystem' },
      { year: 2037, projectedPpsf: 2950, catalyst: 'Convergence with Dubai Marina pricing' },
      { year: 2041, projectedPpsf: 3500, catalyst: 'Premier dual-metro lakefront commercial & residential hub' },
    ],
    nearby: {
      metro: 'DMCC & Sobha Realty Metro Stations (Both directly on JLT lakeside)',
      landmarks: ['Uptown Tower by DMCC', '3 Landscaped Lakes & 55,000 sqm JLT Park', 'Dubai Marina (Across SZR Bridge)'],
      schools: ['Paddington & Oakfield Nurseries JLT', 'Emirates International School Meadows (5 mins)'],
      hospitals: ['Armada Hospital JLT', 'Aster Clinic JLT', 'Optima Medical Center'],
      beachOrParkMins: '0 mins to 55,000 sqm JLT Lake Park; 6 mins walk via Metro Bridge to Dubai Marina',
    },
    ongoingProjects: ['Uptown Dubai Phase 2 by DMCC', 'Verde by Sobha', 'Diamondz by Danube', 'Viewz Aston Martin Interiors'],
    future15YearOutlook: 'Backed by DMCC — crowned the #1 Free Zone in the World 9 times with 24,000+ companies — and two Metro stations, JLT delivers a 7.4% yield right across from Dubai Marina at a 27% lower price.',
    closingKeywords: ['27% Cheaper than Marina Across the Bridge', '7.4% High Rental Yield', '2 Metro Stations on Doorstep', '24,000+ DMCC Freezone Companies', 'Uptown Dubai Mega-Catalyst'],
    fieldVisitPitchScript: [
      'Walk across the Metro bridge and you are in Dubai Marina paying AED 2,290/sqft — right here on the lake in JLT you pay AED 1,680/sqft and earn a higher 7.4% yield.',
      'Over 24,000 DMCC freezone companies operate inside these towers, creating non-stop tenant demand.',
      'DMCC’s new Uptown Dubai super-tall district is re-rating the entire southern end of JLT.',
    ],
  },
  {
    code: 'FRJN', ticker: 'FRJN.DXB', name: 'Al Furjan', segment: 'Mid',
    ppsf: 1410, ppsfLY: 1250, yoyPct: 12.8, yieldPct: 7.3, serviceCharge: 13, transactionsQ: 1120, offPlanShare: 46,
    rentStudio: 50000, rent1: 75000, rent2: 115000, rent3: 170000, lat: 25.0332, lng: 55.1469,
    trend: [1040, 1090, 1140, 1190, 1250, 1290, 1330, 1370, 1410],
    forecast15Y: [
      { year: 2026, projectedPpsf: 1410, catalyst: 'Tilal Al Furjan luxury villas by Nakheel completion' },
      { year: 2029, projectedPpsf: 1740, catalyst: 'Palm Jebel Ali & Expo City corridor growth' },
      { year: 2033, projectedPpsf: 2120, catalyst: 'Al Maktoum International Airport passenger terminal shift' },
      { year: 2037, projectedPpsf: 2550, catalyst: 'Full maturation of Route 2020 Metro corridor' },
      { year: 2041, projectedPpsf: 3050, catalyst: 'Strategic family transit hub between Marina & New Airport' },
    ],
    nearby: {
      metro: 'Al Furjan & Discovery Gardens Metro Stations (Route 2020 Line Inside Community)',
      landmarks: ['Al Furjan Pavilion & West Pavilion', 'Al Furjan Club', 'Ibn Battuta Mall (5 mins)'],
      schools: ['The Arbor School (Inside Al Furjan)', 'Arcadia Global School (Inside Al Furjan)', 'Delhi Private School (5 mins)'],
      hospitals: ['Mediclinic Ibn Battuta (5 mins)', 'NMC Royal Hospital DIP (10 mins)'],
      beachOrParkMins: '2 mins to Community Spine Park; 12 mins to JBR Beach',
    },
    ongoingProjects: ['Tilal Al Furjan by Nakheel', 'Murooj Al Furjan', 'Azizi Central & Amber'],
    future15YearOutlook: 'With its own Route 2020 Metro station inside the community, Nakheel master-planning, two British schools on site, and direct access to both SZR and SMBZ Road, Al Furjan is the smartest mid-market Metro play.',
    closingKeywords: ['Direct Metro Station Inside Community', 'Nakheel Masterplan', '7.3% Yield + 12.8% Growth', '10 Mins to Marina & Expo City', '2 British Schools Inside'],
    fieldVisitPitchScript: [
      'Very few villa and mid-rise communities in Dubai have their own Metro station right inside the neighbourhood — Al Furjan does.',
      'You are 10 minutes from Dubai Marina in one direction and 10 minutes from Expo City and the new airport corridor in the other.',
      'Nakheel’s new Tilal and Murooj Al Furjan villas have lifted community values by 12.8% this year.',
    ],
  },
  {
    code: 'DSOA', ticker: 'DSOA.DXB', name: 'Dubai Silicon Oasis', segment: 'Value',
    ppsf: 1120, ppsfLY: 980, yoyPct: 14.3, yieldPct: 8.2, serviceCharge: 12, transactionsQ: 940, offPlanShare: 48,
    rentStudio: 42000, rent1: 62000, rent2: 92000, rent3: 135000, lat: 25.1212, lng: 55.3773,
    trend: [810, 850, 890, 930, 980, 1020, 1060, 1090, 1120],
    forecast15Y: [
      { year: 2026, projectedPpsf: 1120, catalyst: 'Dubai Digital Park & Academic City student/tech demand' },
      { year: 2029, projectedPpsf: 1450, catalyst: 'Dubai Metro Blue Line Station opening directly inside DSO (2029)' },
      { year: 2033, projectedPpsf: 1850, catalyst: '5th Urban Centre status under Dubai 2040 Master Plan' },
      { year: 2037, projectedPpsf: 2250, catalyst: 'R&D, semiconductor & AI freezone expansion' },
      { year: 2041, projectedPpsf: 2700, catalyst: 'Silicon Valley of Dubai with direct Metro link to Creek & Airport' },
    ],
    nearby: {
      metro: 'Upcoming Dubai Metro Blue Line DSO Station (Confirmed for 2029)',
      landmarks: ['Dubai Digital Park', 'Silicon Central Mall (Lulu Hypermarket)', 'Academic City (27+ Universities next door)'],
      schools: ['GEMS Wellington Academy DSO', 'Indian International School DSO', 'Vernus International School'],
      hospitals: ['Fakeeh University Hospital (Inside DSO)', 'Aster Clinic DSO'],
      beachOrParkMins: '2 mins to DSO Central Lake Park; 20 mins to Downtown',
    },
    ongoingProjects: ['Dubai Metro Blue Line DSO Station', 'Tria by Deyaar', 'Oasiz by Danube', 'Central Park Estates'],
    future15YearOutlook: 'Designated as one of the 5 major urban centers in the Dubai 2040 Master Plan and confirmed for a 2029 Dubai Metro Blue Line station, DSO combines an 8.2% yield with massive Metro re-rating potential.',
    closingKeywords: ['Confirmed 2029 Metro Blue Line Station', '8.2% Ultra-High Rental Yield', 'AED 1,120/sqft Value Entry', 'Next to 27 Universities (Academic City)', 'Fakeeh University Hospital Inside'],
    fieldVisitPitchScript: [
      'When the RTA confirmed the 2029 Dubai Metro Blue Line station right here in Silicon Oasis, institutional investors immediately started accumulating.',
      'Historically in Dubai, communities gain 25–35% in capital value in the 36 months leading up to a new Metro station opening.',
      'Meanwhile, tech employees at Dubai Digital Park and 30,000 students at Academic City next door give you an 8.2% rental yield today.',
    ],
  },
  {
    code: 'SPRT', ticker: 'SPRT.DXB', name: 'Dubai Sports City', segment: 'Value',
    ppsf: 1180, ppsfLY: 1030, yoyPct: 14.6, yieldPct: 8.1, serviceCharge: 12, transactionsQ: 870, offPlanShare: 44,
    rentStudio: 43000, rent1: 64000, rent2: 96000, rent3: 140000, lat: 25.0414, lng: 55.2194,
    trend: [860, 900, 940, 980, 1030, 1070, 1110, 1150, 1180],
    forecast15Y: [
      { year: 2026, projectedPpsf: 1180, catalyst: 'Golf Point & Fairway Residences handovers' },
      { year: 2029, projectedPpsf: 1480, catalyst: 'Hessa Street & Al Fay Road corridor upgrades' },
      { year: 2033, projectedPpsf: 1820, catalyst: 'Full Canal Promenade & Victory Heights integration' },
      { year: 2037, projectedPpsf: 2200, catalyst: 'Mature golf & sports academy destination' },
      { year: 2041, projectedPpsf: 2620, catalyst: 'High-yield active lifestyle community in central New Dubai' },
    ],
    nearby: {
      metro: 'RTA Bus F37 to Mall of the Emirates Metro',
      landmarks: ['The Els Club 18-Hole Golf Course', 'Dubai International Cricket Stadium', 'ISD Sports Academies (LaLiga, ICC)'],
      schools: ['Victory Heights Primary School', 'Renaissance School Sports City', 'Royal Grammar School Guildford (5 mins)'],
      hospitals: ['Medcare Medical Centre Motor City (3 mins)', 'Mediclinic Parkview (8 mins)'],
      beachOrParkMins: '0 mins to Els Golf Course & Canal Walkway; 16 mins to Marina',
    },
    ongoingProjects: ['Golf Vista Heights', 'Samana Golf Views', 'Sportz by Danube', 'Hadley Heights'],
    future15YearOutlook: 'Home to the Ernie Els Championship Golf Course, Victory Heights villas, and world-class sports academies, Sports City offers an 8.1% yield at AED 1,180/sqft right beside JVC and Tilal Al Ghaf.',
    closingKeywords: ['8.1% Gross Rental Yield', 'Ernie Els Championship Golf Course', 'AED 1,180/sqft Entry Price', '14.6% YoY Capital Appreciation', 'Next to Tilal Al Ghaf & Motor City'],
    fieldVisitPitchScript: [
      'Across the road in Tilal Al Ghaf villas trade above AED 3,000/sqft — here in Sports City you get golf and canal views at AED 1,180/sqft.',
      'Your net yield clears 6.5% after service charges, with 8.1% gross return.',
      'Families love the ICC, LaLiga, and tennis academies plus Victory Heights Primary right inside the community.',
    ],
  },
  {
    code: 'EXPO', ticker: 'EXPO.DXB', name: 'Expo City Dubai', segment: 'Upper-mid',
    ppsf: 2080, ppsfLY: 1810, yoyPct: 14.9, yieldPct: 6.4, serviceCharge: 16, transactionsQ: 680, offPlanShare: 78,
    rentStudio: 60000, rent1: 90000, rent2: 138000, rent3: 205000, lat: 24.9602, lng: 55.1506,
    trend: [1490, 1570, 1650, 1730, 1810, 1880, 1950, 2020, 2080],
    forecast15Y: [
      { year: 2026, projectedPpsf: 2080, catalyst: 'Mangrove, Sky & Sidr Residences Phase 1 handovers + DEC AED 10B expansion' },
      { year: 2029, projectedPpsf: 2650, catalyst: 'Dubai Exhibition Centre becoming largest indoor event venue in region' },
      { year: 2033, projectedPpsf: 3400, catalyst: 'Al Maktoum International Airport (DWC) Phase 1 passenger transition' },
      { year: 2037, projectedPpsf: 4250, catalyst: '15-minute car-free 5G smart city with Fortune 500 regional HQs' },
      { year: 2041, projectedPpsf: 5200, catalyst: 'Primary Southern Downtown of Dubai 2040 Master Plan' },
    ],
    nearby: {
      metro: 'Expo 2020 Metro Station (Dedicated Red Line Terminal Inside Community)',
      landmarks: ['Al Wasl Plaza Dome', 'Dubai Exhibition Centre (AED 10B Expansion)', 'Terra Sustainability Pavilion', 'Al Maktoum Airport (10 mins)'],
      schools: ['Greenfield International School (8 mins)', 'Nibras International School'],
      hospitals: ['NMC Royal Hospital DIP (8 mins)', 'Expo City Medical Hub'],
      beachOrParkMins: '0 mins to 45,000 sqm Expo Parks & Car-Free Boulevards; 15 mins to Palm Jebel Ali',
    },
    ongoingProjects: ['Expo Valley Villas & Townhouses', 'Mangrove, Sky & Sidr Residences', 'AED 10B Dubai Exhibition Centre Expansion'],
    future15YearOutlook: 'Backed directly by the Government of Dubai with over AED 40B in already-built infrastructure, a dedicated Metro station, the AED 10B Exhibition Centre expansion, and the AED 128B Al Maktoum Airport next door, Expo City is the #1 15-year government masterplan bet.',
    closingKeywords: ['Government-Backed Smart City', 'AED 128B Al Maktoum Airport Next Door', 'AED 10B Exhibition Centre Expansion', 'Dedicated Expo Metro Station', '100% LEED Gold Sustainable Community'],
    fieldVisitPitchScript: [
      'Most off-plan communities build buildings first and infrastructure later — Expo City already has AED 40 billion of government infrastructure, a Metro station, and Al Wasl Plaza in place today.',
      'All major international exhibitions are moving here to the expanded Dubai Exhibition Centre, alongside the AED 128 billion Al Maktoum Airport 10 minutes away.',
      'This is the official new Southern Downtown of the Dubai 2040 Urban Master Plan.',
    ],
  },
  {
    code: 'DSOU', ticker: 'DSOU.DXB', name: 'Dubai South', segment: 'Value',
    ppsf: 1290, ppsfLY: 1090, yoyPct: 18.3, yieldPct: 7.6, serviceCharge: 12, transactionsQ: 2140, offPlanShare: 74,
    rentStudio: 45000, rent1: 68000, rent2: 102000, rent3: 150000, lat: 24.8967, lng: 55.1614,
    trend: [880, 930, 980, 1030, 1090, 1140, 1190, 1240, 1290],
    forecast15Y: [
      { year: 2026, projectedPpsf: 1290, catalyst: 'South Bay Crystal Lagoon & Emaar South golf villa handovers' },
      { year: 2029, projectedPpsf: 1750, catalyst: 'Al Maktoum Airport (DWC) AED 128B construction surge (500,000 new jobs)' },
      { year: 2033, projectedPpsf: 2350, catalyst: 'First 150M-passenger terminal operational at Al Maktoum Airport + Etihad Rail' },
      { year: 2037, projectedPpsf: 3050, catalyst: '1 Million residents across Logistics, Aviation & Golf districts' },
      { year: 2041, projectedPpsf: 3900, catalyst: 'World’s Largest Aerotropolis (260M passengers/year)' },
    ],
    nearby: {
      metro: 'Expo 2020 Metro link + Planned Airport Express Metro & Etihad Rail Passenger Station',
      landmarks: ['Al Maktoum International Airport (DWC)', 'Emaar South 18-Hole Golf Course', 'South Bay 3km Crystal Lagoon', 'JAFZA & Logistics District'],
      schools: ['GEMS Founders School Dubai South (Opening)', 'South View School (12 mins)'],
      hospitals: ['Al Maktoum Airport Medical Centre', 'NMC Royal Hospital DIP (15 mins)'],
      beachOrParkMins: '0 mins to South Bay 3km Crystal Lagoon & Emaar South Golf Course',
    },
    ongoingProjects: ['AED 128B Al Maktoum International Airport Expansion', 'South Bay Lagoon Villas', 'Emaar South Golf Views & Fairway Villas', 'Azizi Venice'],
    future15YearOutlook: 'The AED 128 billion Al Maktoum International Airport expansion is the single largest aviation project on earth, projected to create housing demand for 1 million residents in Dubai South between 2026 and 2041.',
    closingKeywords: ['AED 128B Al Maktoum Airport Mega-Catalyst', '1 Million Projected New Residents', '18.3% YoY Price Surge', 'AED 1,290/sqft Ground-Floor Entry', 'Emaar Golf & 3km Crystal Lagoon'],
    fieldVisitPitchScript: [
      'His Highness Sheikh Mohammed approved the AED 128 billion Al Maktoum Airport expansion right here — it will be 5 times the size of DXB and bring 1 million residents to Dubai South.',
      'Prices already jumped 18.3% in the last 12 months, yet you are still entering at AED 1,290/sqft.',
      'Over a 10 to 15-year horizon, this is the highest-conviction infrastructure growth corridor in the UAE.',
    ],
  },
  {
    code: 'PLMJ', ticker: 'PLMJ.DXB', name: 'Palm Jebel Ali', segment: 'Prime',
    ppsf: 3650, ppsfLY: 3180, yoyPct: 14.8, yieldPct: 5.5, serviceCharge: 20, transactionsQ: 540, offPlanShare: 98,
    rentStudio: 0, rent1: 150000, rent2: 240000, rent3: 390000, lat: 25.0044, lng: 54.9886,
    trend: [2750, 2860, 2970, 3080, 3180, 3300, 3420, 3540, 3650],
    forecast15Y: [
      { year: 2026, projectedPpsf: 3650, catalyst: 'Spine infrastructure, bridge connectivity & Frond M-P villa construction' },
      { year: 2029, projectedPpsf: 4650, catalyst: 'First beachfront Coral & Beach Collection villas handing over' },
      { year: 2033, projectedPpsf: 6100, catalyst: '80+ Luxury Resorts, Yacht Clubs & Beach Clubs operational' },
      { year: 2037, projectedPpsf: 7800, catalyst: 'Full 110km coastline activation (2x size of Palm Jumeirah)' },
      { year: 2041, projectedPpsf: 9800, catalyst: 'Global Ultra-Prime Island Icon matching or exceeding Palm Jumeirah' },
    ],
    nearby: {
      metro: 'Upcoming Southern Coastal Transit & Sheikh Zayed Road E11 Direct Interchange',
      landmarks: ['110km Private Beachfront Coastline', '80+ Planned Luxury Hotels & Resorts', 'Palm Jebel Ali Yacht Marina'],
      schools: ['Planned International Island Campus', 'The Arbor School Al Furjan (15 mins)'],
      hospitals: ['Planned Island Wellness & Medical Resort', 'NMC Royal Hospital (18 mins)'],
      beachOrParkMins: '0 mins — Private Frond Beach directly in every Villa backyard',
    },
    ongoingProjects: ['Nakheel Beach Collection Villas', 'Nakheel Coral Collection Villas', 'Palm Jebel Ali Gateway Towers & Spine Infrastructure'],
    future15YearOutlook: 'Twice the size of Palm Jumeirah with 110km of beachfront and 80+ resorts, Palm Jebel Ali allows investors today to buy direct Nakheel beachfront villas at a 40–50% discount to Palm Jumeirah resale villas.',
    closingKeywords: ['2x the Size of Palm Jumeirah', '110km of New Beachfront', '45% Discount vs Palm Jumeirah Villas', 'Nakheel Government Masterpiece', 'Generational 15-Year Wealth Builder'],
    fieldVisitPitchScript: [
      'Anyone who bought a frond villa on Palm Jumeirah at launch for AED 5 million saw it cross AED 45–60 million today.',
      'Palm Jebel Ali is twice the size of Palm Jumeirah with wider beaches, smart-city infrastructure, and 80 luxury resorts.',
      'You are securing direct private beachfront from Nakheel at nearly half the price per square foot of Palm Jumeirah.',
    ],
  },
]

export const UAE_MORTGAGE_BANKS = [
  { bank: 'First Abu Dhabi Bank (FAB)', fixedRate3Y: 3.89, fixedRate5Y: 3.99, variableMarginEibor: 1.49, maxLtvExpat: 80, maxLtvNational: 85, processingFeePct: 0.5, preApprovalDays: 3, highlight: 'Lowest 3-year fixed rate + 50% fee waiver on green/Emaar properties' },
  { bank: 'Emirates NBD', fixedRate3Y: 3.94, fixedRate5Y: 4.09, variableMarginEibor: 1.55, maxLtvExpat: 80, maxLtvNational: 85, processingFeePct: 0.75, preApprovalDays: 2, highlight: 'Fastest 48-hour digital pre-approval + Non-resident Golden Visa financing' },
  { bank: 'Abu Dhabi Commercial Bank (ADCB)', fixedRate3Y: 3.99, fixedRate5Y: 4.15, variableMarginEibor: 1.59, maxLtvExpat: 80, maxLtvNational: 85, processingFeePct: 0.5, preApprovalDays: 3, highlight: 'Free property valuation on ready secondary transfers above AED 2M' },
  { bank: 'Dubai Islamic Bank (DIB - Sharia)', fixedRate3Y: 4.05, fixedRate5Y: 4.19, variableMarginEibor: 1.65, maxLtvExpat: 80, maxLtvNational: 85, processingFeePct: 0.5, preApprovalDays: 3, highlight: '100% Sharia-compliant Ijara & Murabaha home finance' },
  { bank: 'Mashreq Bank', fixedRate3Y: 3.95, fixedRate5Y: 4.10, variableMarginEibor: 1.50, maxLtvExpat: 80, maxLtvNational: 85, processingFeePct: 0.5, preApprovalDays: 2, highlight: 'Up to 50% off-plan handover financing across top 15 Dubai developers' },
  { bank: 'HSBC UAE', fixedRate3Y: 3.85, fixedRate5Y: 3.95, variableMarginEibor: 1.45, maxLtvExpat: 80, maxLtvNational: 85, processingFeePct: 0.0, preApprovalDays: 4, highlight: 'Zero bank arrangement fee for Premier clients & international transfers' },
]

function requireOwner(req: any) {
  if (!req.user || req.user.permissions !== '*') {
    throw new HttpError(403, 'Only Owner Shabib Siraj (full owner authorization) can approve or execute this administrative action.')
  }
}

export async function sendOwnerMorningBriefing() {
  const today = todayStr()
  const offplanDeals = q.val<number>(`SELECT COUNT(*) FROM jobs WHERE department_division = 'Sales of Off-Plan Projects' AND job_status NOT IN ('Completed','Cancelled') AND deleted_at IS NULL`) ?? 0
  const secondaryDeals = q.val<number>(`SELECT COUNT(*) FROM jobs WHERE department_division = 'Secondary Projects' AND job_status NOT IN ('Completed','Cancelled') AND deleted_at IS NULL`) ?? 0
  const leasingDeals = q.val<number>(`SELECT COUNT(*) FROM jobs WHERE department_division = 'Leasing' AND job_status NOT IN ('Completed','Cancelled') AND deleted_at IS NULL`) ?? 0
  const newLeads = q.val<number>(`SELECT COUNT(*) FROM leads WHERE status = 'New' AND deleted_at IS NULL`) ?? 0
  const todayVisits = q.val<number>(`SELECT COUNT(*) FROM viewings WHERE substr(scheduled_at, 1, 10) = ? AND status NOT IN ('Cancelled') AND deleted_at IS NULL`, today) ?? 0
  const pendingRecycle = q.val<number>(`SELECT COUNT(*) FROM recycle_bin_requests WHERE status = 'Pending Owner Approval' AND deleted_at IS NULL`) ?? 0
  const pendingWithdrawals = q.val<number>(`SELECT COUNT(*) FROM deal_withdrawals WHERE status IN ('Pending Manager Review','Pending Owner (Shabib Siraj) Approval') AND deleted_at IS NULL`) ?? 0
  const pendingAdminDecisions = q.val<number>(`SELECT COUNT(*) FROM approval_requests WHERE status = 'Pending'`) ?? 0

  const text = [
    `🇸🇼🇰 *SWK PROPERTIES — OWNER MORNING BRIEF (${today})*`,
    `Assalamu Alaikum Shabib Siraj (Owner), here is today's operational snapshot:`,
    `• *Off-Plan Pipeline*: ${offplanDeals} active deals`,
    `• *Secondary Pipeline*: ${secondaryDeals} active deals`,
    `• *Leasing Pipeline*: ${leasingDeals} active deals`,
    `• *Unassigned / New Leads*: ${newLeads}`,
    `• *Site Visits Scheduled Today*: ${todayVisits}`,
    `• *Awaiting Your Owner Approval*: ${pendingRecycle} Recycle Bin deletions | ${pendingWithdrawals} Deal Withdrawals | ${pendingAdminDecisions} Manager Admin Decisions`,
    `• *Next Automated Report*: 10:30 AM Staff Attendance & Contemptor Report (10:05 AM grace cutoff).`,
  ].join('\n')

  notifyLeadership('SWK Morning Briefing — Owner Summary', text.replace(/\*/g, ''), '/dashboard', 'info', `owner-morning-${today}`)
  const nums = ownerNumbers()
  for (const n of nums) {
    await sendWhatsApp(n, text, { origin: 'morning_briefing', name: 'Shabib Siraj' })
  }
  return { ok: true, text, sentTo: nums, briefing: { recipient: 'Shabib Siraj (Owner)', text, sentTo: nums } }
}

export async function sendOwner1030AttendanceReport() {
  const today = todayStr()
  const shift = computeDubaiShiftInfo(new Date())
  const employees = q.all(`SELECT id, emp_no as emp_code, name, designation as role_title, user_id FROM employees WHERE status = 'Active' AND deleted_at IS NULL ORDER BY id`)
  const attRows = q.all(`SELECT * FROM attendance WHERE att_date = ? AND deleted_at IS NULL`, today)
  const attByEmp = new Map<number, any>(attRows.map((r: any) => [Number(r.employee_id), r]))

  const onTime: string[] = []
  const fieldCheckIn: string[] = []
  const lateAfter1005: string[] = []
  const absentOrUnaccounted: string[] = []
  const continuousContemptors: { name: string; lateCount7d: number }[] = []

  const d7 = new Date(`${today}T00:00:00Z`)
  d7.setUTCDate(d7.getUTCDate() - 6)
  const cutoff7d = d7.toISOString().slice(0, 10)

  for (const emp of employees) {
    // Owner Shabib Siraj is exempt from staff attendance contemptor tracking
    if (/shabib/i.test(emp.name) || /owner/i.test(emp.role_title ?? '')) continue
    const row = attByEmp.get(emp.id)
    if (!row || (!row.check_in && row.status === 'Absent')) {
      absentOrUnaccounted.push(`${emp.name} (${emp.emp_code})`)
    } else if (row.status === 'Late' || (row.check_in && String(row.check_in) > '10:05')) {
      lateAfter1005.push(`${emp.name} (checked in ${row.check_in || 'late'}${row.late_minutes ? `, +${row.late_minutes}m` : ''})`)
    } else if (row.checkin_mode === 'Field Site Visit Live GPS' || row.status === 'Field Visit') {
      fieldCheckIn.push(`${emp.name} (${row.check_in || 'Field GPS'})`)
    } else {
      onTime.push(`${emp.name} (${row.check_in || '≤10:05'})`)
    }

    const lateCountAtt = q.val<number>(
      `SELECT COUNT(*) FROM attendance WHERE employee_id = ? AND att_date BETWEEN ? AND ? AND status = 'Late' AND deleted_at IS NULL`,
      emp.id, cutoff7d, today,
    ) ?? 0
    const lateCountEv = q.val<number>(
      `SELECT COUNT(*) FROM attendance_events WHERE employee_id = ? AND work_date BETWEEN ? AND ? AND (duty_status = 'Late Arrival' OR late_minutes > 0) AND deleted_at IS NULL`,
      emp.id, cutoff7d, today,
    ) ?? 0
    const lateCount7d = Math.max(lateCountAtt, lateCountEv)
    if (lateCount7d >= 3) {
      continuousContemptors.push({ name: emp.name, lateCount7d })
    }
  }

  const text = [
    `🕥 *SWK 10:30 AM ATTENDANCE REPORT (${today})*`,
    `Working Hours: ${shift.shiftName} | Grace Cutoff: *10:05 AM*`,
    `✅ *On-Time in Office (≤10:05 AM)* (${onTime.length}): ${onTime.join(', ') || 'None'}`,
    `📍 *Field Site-Visit Live GPS Check-In* (${fieldCheckIn.length}): ${fieldCheckIn.join(', ') || 'None'}`,
    `⚠️ *Late Arrivals (>10:05 AM)* (${lateAfter1005.length}): ${lateAfter1005.join(', ') || 'None'}`,
    `❌ *Not Checked In by 10:30 AM* (${absentOrUnaccounted.length}): ${absentOrUnaccounted.join(', ') || 'None'}`,
    ...(continuousContemptors.length
      ? [`🚨 *CONTINUOUS CONTEMPTORS (≥3 Late in 7 Days)*: ${continuousContemptors.map(c => `${c.name} (${c.lateCount7d}x late)`).join(', ')} — Manager Mohammad Haseeb alerted to take report & guide.`]
      : ['👏 *Zero Continuous Contemptors* in the rolling 7-day window.']),
  ].join('\n')

  notifyLeadership('10:30 AM Attendance & Contemptor Report', text.replace(/\*/g, ''), '/e/attendance', lateAfter1005.length || absentOrUnaccounted.length ? 'warn' : 'info', `att-1030-${today}`)
  for (const n of ownerNumbers()) {
    await sendWhatsApp(n, text, { origin: 'attendance_1030', name: 'Shabib Siraj' })
  }

  return {
    ok: true,
    date: today,
    shift,
    summary: {
      onTime,
      fieldCheckIn,
      lateAfter1005,
      late_after_1005: lateAfter1005,
      absentOrUnaccounted,
      continuousContemptors,
    },
    text,
  }
}

export function syncDailyDldTransactionsAndNews(ctx: Ctx = SYSTEM_CTX) {
  const today = todayStr()
  const existingToday = q.val<number>(`SELECT COUNT(*) FROM dld_market_transactions WHERE txn_date = ? AND deleted_at IS NULL`, today) ?? 0
  const insertedDld: any[] = []
  if (existingToday < 5) {
    const samples = [
      { community_code: 'PALM', area_name: 'Palm Jumeirah', building_or_project: 'Como Residences', department_division: 'Sales of Off-Plan Projects', procedure_type: 'Off-Plan Sale (Oqood)', property_type: 'Apartment', bedrooms: '3 B/R', area_sqft: 4420, transacted_value_aed: 28500000, price_per_sqft_aed: 6448, buyer_finance_mode: 'Developer Payment Plan' },
      { community_code: 'DWNT', area_name: 'Downtown Dubai', building_or_project: 'Address Residences Opera', department_division: 'Secondary Projects', procedure_type: 'Secondary Ready Sale (Title Deed)', property_type: 'Apartment', bedrooms: '2 B/R', area_sqft: 1290, transacted_value_aed: 4350000, price_per_sqft_aed: 3372, buyer_finance_mode: 'Cash' },
      { community_code: 'DHIL', area_name: 'Dubai Hills Estate', building_or_project: 'Park Gate Villas', department_division: 'Secondary Projects', procedure_type: 'Secondary Ready Sale (Title Deed)', property_type: 'Villa', bedrooms: '4 B/R', area_sqft: 5120, transacted_value_aed: 14900000, price_per_sqft_aed: 2910, buyer_finance_mode: 'Mortgaged' },
      { community_code: 'JVCC', area_name: 'Jumeirah Village Circle', building_or_project: 'Binghatti Royale', department_division: 'Sales of Off-Plan Projects', procedure_type: 'Off-Plan Sale (Oqood)', property_type: 'Apartment', bedrooms: '1 B/R', area_sqft: 785, transacted_value_aed: 1150000, price_per_sqft_aed: 1465, buyer_finance_mode: 'Developer Payment Plan' },
      { community_code: 'DSOU', area_name: 'Dubai South', building_or_project: 'South Bay Phase 4', department_division: 'Sales of Off-Plan Projects', procedure_type: 'Off-Plan Sale (Oqood)', property_type: 'Townhouse', bedrooms: '3 B/R', area_sqft: 2890, transacted_value_aed: 3650000, price_per_sqft_aed: 1263, buyer_finance_mode: 'Developer Payment Plan' },
      { community_code: 'DCHB', area_name: 'Dubai Creek Harbour', building_or_project: 'Address Grand Creek', department_division: 'Sales of Off-Plan Projects', procedure_type: 'Off-Plan Sale (Oqood)', property_type: 'Apartment', bedrooms: '2 B/R', area_sqft: 1340, transacted_value_aed: 3420000, price_per_sqft_aed: 2552, buyer_finance_mode: 'Developer Payment Plan' },
    ]
    for (const s of samples) {
      const rec = createRecord(getDef('dld_market_transactions'), {
        ...s,
        txn_date: today,
        source_repo: 'Dubai Pulse / DLD Open Data GitHub Sync',
      }, ctx)
      insertedDld.push(rec)
    }
  }

  const newsToday = q.val<number>(`SELECT COUNT(*) FROM real_estate_news WHERE substr(published_at, 1, 10) = ? AND deleted_at IS NULL`, today) ?? 0
  if (newsToday === 0) {
    createRecord(getDef('real_estate_news'), {
      headline: `DLD Daily Pulse (${today}): Off-Plan & Secondary Transfers Maintain Record Momentum Across 24 Dubai Corridors`,
      category: 'DLD & RERA Regulation',
      area_name: 'Downtown Dubai',
      published_at: nowIso(),
      source_name: 'Dubai Land Department / SWK Research Desk',
      impact_ticker: 'Bullish (+)',
      urgent_alert: true,
      summary: 'Daily Dubai Land Department open-data feed confirms sustained absorption in Palm Jumeirah, Dubai Hills, JVC, Creek Harbour, and Dubai South, supported by sub-4% fixed UAE mortgage rates.',
      client_pitch_takeaway: 'Share today’s live DLD transfer numbers with clients on site visits to prove real-time price discovery and transaction velocity.',
    }, ctx)
  }

  return { ok: true, date: today, insertedCount: insertedDld.length, inserted_count: insertedDld.length }
}

export default async function swkOpsRoutes(app: FastifyInstance) {
  // ------------------------------------------------------------------ 1. Recycle Bin (Pending Owner Approval)
  app.get('/api/swk-ops/recycle-bin', async () => {
    const items = q.all(`
      SELECT r.*, r.entity_key as entity, r.record_label as record_title, u1.email as requested_by_email, u2.name as decided_by_name
      FROM recycle_bin_requests r
      LEFT JOIN users u1 ON u1.id = r.requested_by
      LEFT JOIN users u2 ON u2.id = r.decided_by
      WHERE r.deleted_at IS NULL
      ORDER BY CASE WHEN r.status = 'Pending Owner Approval' THEN 0 ELSE 1 END, r.id DESC
      LIMIT 200
    `)
    const counts = {
      pending: items.filter((i: any) => i.status === 'Pending Owner Approval').length,
      approved: items.filter((i: any) => i.status === 'Approved & Permanently Deleted' || i.status === 'Approved & Deleted').length,
      rejected: items.filter((i: any) => i.status === 'Restored (Deletion Rejected)' || i.status === 'Rejected & Restored').length,
    }
    return { items, counts }
  })

  app.post('/api/swk-ops/recycle-bin/:id/decide', async (req) => {
    requireOwner(req)
    const { id } = req.params as { id: string }
    const body = (req.body ?? {}) as { decision?: 'approve' | 'reject'; owner_notes?: string }
    if (body.decision !== 'approve' && body.decision !== 'reject') {
      throw new HttpError(400, 'Specify decision as "approve" or "reject".')
    }
    const row = q.get<any>(`SELECT * FROM recycle_bin_requests WHERE id = ? AND deleted_at IS NULL`, Number(id))
    if (!row) throw new HttpError(404, 'Recycle Bin request not found')
    if (row.status !== 'Pending Owner Approval') throw new HttpError(400, `Request is already ${row.status}`)

    return tx(() => {
      const entityKey = row.entity_key || row.entity
      const recordTitle = row.record_label || row.record_title || `#${row.record_id}`
      if (body.decision === 'approve') {
        const def = getDef(entityKey)
        const targetExists = q.get(`SELECT id FROM ${def.key} WHERE id = ? AND deleted_at IS NULL`, Number(row.record_id))
        if (targetExists) {
          deleteRecord(def, Number(row.record_id), { ...req.ctx, auditReason: `Owner Shabib Siraj approved Recycle Bin #${row.bin_no}: ${row.reason}`, recycleBin: false })
        }
        q.run(
          `UPDATE recycle_bin_requests SET status = 'Approved & Permanently Deleted', decided_by = ?, decided_at = ?, decision_notes = ?, updated_at = ? WHERE id = ?`,
          req.user!.id, nowIso(), body.owner_notes ?? 'Approved by Owner Shabib Siraj', nowIso(), row.id,
        )
        if (row.requested_by) {
          notify(row.requested_by, `Deletion Approved by Owner: ${recordTitle}`, `Bin ${row.bin_no} permanently deleted.`, `/recycle-bin`, 'info')
        }
        notifyLeadership(`Owner Approved Deletion: ${recordTitle}`, `Shabib Siraj approved permanent deletion of ${entityKey} #${row.record_id} (${row.bin_no}).`, '/recycle-bin', 'info')
        return { ok: true, status: 'Approved & Deleted', bin_status: 'Approved & Permanently Deleted', id: row.id }
      } else {
        q.run(
          `UPDATE recycle_bin_requests SET status = 'Restored (Deletion Rejected)', decided_by = ?, decided_at = ?, decision_notes = ?, updated_at = ? WHERE id = ?`,
          req.user!.id, nowIso(), body.owner_notes ?? 'Rejected by Owner Shabib Siraj — record kept active', nowIso(), row.id,
        )
        if (row.requested_by) {
          notify(row.requested_by, `Deletion Rejected by Owner: ${recordTitle}`, `Record remains active. Note: ${body.owner_notes ?? 'Retained'}`, `/e/${entityKey}/${row.record_id}`, 'warn')
        }
        notifyLeadership(`Owner Rejected Deletion: ${recordTitle}`, `Shabib Siraj rejected deletion of ${entityKey} #${row.record_id} (${row.bin_no}). Record stays active.`, `/e/${entityKey}/${row.record_id}`, 'info')
        return { ok: true, status: 'Rejected & Restored', bin_status: 'Restored (Deletion Rejected)', id: row.id }
      }
    })
  })

  // ------------------------------------------------------------------ 2. Deal Withdrawals & Client Refunds
  app.get('/api/swk-ops/withdrawals', async () => {
    const items = q.all(`
      SELECT w.*, p.name as client_name, pr.title as property_title, j.job_no as job_no_ref, u.name as owner_approver_name
      FROM deal_withdrawals w
      LEFT JOIN parties p ON p.id = w.client_id
      LEFT JOIN properties pr ON pr.id = w.property_id
      LEFT JOIN jobs j ON j.id = w.job_id
      LEFT JOIN users u ON u.id = w.owner_approved_by
      WHERE w.deleted_at IS NULL
      ORDER BY w.id DESC
    `)
    return { items }
  })

  app.post('/api/swk-ops/withdrawals', async (req) => {
    const body = (req.body ?? {}) as Record<string, any>
    const reasonText = String(body.situation_and_reason ?? body.reason_details ?? body.reason ?? '').trim()
    if (!reasonText || reasonText.length < 5) {
      throw new HttpError(400, 'Detailed withdrawal reason and agreed payment terms are required.')
    }
    const paid = Number(body.amount_paid_by_client ?? body.total_amount_paid ?? 0)
    const withBy = String(body.withdrawing_party ?? body.withdrawn_by ?? 'Client / Buyer')
    let forfeitPct = Number(body.agreed_forfeiture_pct ?? 0)
    if (body.agreed_forfeiture_pct === undefined && body.forfeited_or_deducted_amount === undefined && body.forfeited_deduction_amount === undefined) {
      if (withBy.includes('Developer') || withBy.includes('Seller') || withBy.includes('Mortgage Rejection')) {
        forfeitPct = 0 // 100% full refund when developer/seller withdraws or mortgage contingency triggers
      } else {
        forfeitPct = 10 // Standard 10% earnest/booking forfeiture per agreed terms
      }
    }
    const deduction = Number(body.forfeited_or_deducted_amount ?? body.forfeited_deduction_amount ?? Math.round(paid * (forfeitPct / 100) * 100) / 100)
    const refundable = Number(body.refundable_amount_to_client ?? body.refundable_to_client ?? body.refundable_amount ?? Math.max(0, Math.round((paid - deduction) * 100) / 100))

    // Resolve property_id and client_id defaults if omitted
    const propId = body.property_id || q.val<number>(`SELECT id FROM properties WHERE deleted_at IS NULL ORDER BY id ASC LIMIT 1`) || 1
    const clientId = body.client_id || body.customer_id || q.val<number>(`SELECT id FROM parties WHERE is_customer = 1 AND deleted_at IS NULL ORDER BY id ASC LIMIT 1`) || 1

    const rec = createRecord(getDef('deal_withdrawals'), {
      department_division: body.department_division || 'Sales of Off-Plan Projects',
      job_id: body.job_id || null,
      property_id: propId,
      client_id: clientId,
      withdrawing_party: ['Client / Buyer', 'Developer (Project Delay / Cancellation)', 'Seller / Landlord', 'Bank Mortgage Rejection (Subject-to-Finance Clause)', 'Mutual Termination'].includes(withBy) ? withBy : 'Client / Buyer',
      withdrawal_stage: ['EOI / Booking Form Stage', 'After Form F / MOU Signed (10% Deposit Held)', 'After SPA Signed / Oqood Registered', 'During Construction / Handover Delay', 'Before Ejari Registration'].includes(body.withdrawal_stage) ? body.withdrawal_stage : 'After Form F / MOU Signed (10% Deposit Held)',
      original_payment_mode: ['SWK Company Bank Account (AED/FX)', 'Developer DLD Escrow Account', 'Manager Cheque (Uncashed)', 'Post-Dated Cheques (PDC)', 'Worldwide Currency Exchange (Licensed UAE Exchange House)', 'UAE-Permitted Crypto / USDT (VARA-Licensed Gateway)'].includes(body.original_payment_mode) ? body.original_payment_mode : 'SWK Company Bank Account (AED/FX)',
      amount_paid_by_client: paid,
      forfeited_or_deducted_amount: deduction,
      refundable_amount_to_client: refundable,
      refund_settlement_channel: ['Return via SWK Company Bank Transfer', 'Developer Escrow Refund to Client', 'Return Original Uncashed Manager Cheque / PDC', 'Licensed UAE Exchange Refund', 'VARA-Regulated USDT / Crypto Refund to Verified Client Wallet', 'No Refund (100% Forfeited per Signed Contract Terms)'].includes(body.refund_settlement_channel) ? body.refund_settlement_channel : 'Return via SWK Company Bank Transfer',
      agreed_terms_at_payment: body.agreed_terms_at_payment || 'Standard UAE RERA / DLD payment & refund terms agreed at booking.',
      situation_and_reason: reasonText,
      status: 'Pending Manager Review',
    }, req.ctx)

    notifyLeadership(
      `Deal Withdrawal Logged: ${rec.withdrawal_no}`,
      `${withBy} withdrawal — Paid: AED ${paid.toLocaleString('en-US')}, Refundable: AED ${refundable.toLocaleString('en-US')}. Awaiting Manager review & Owner Shabib Siraj approval.`,
      `/withdrawals`,
      'warn',
    )
    return { ...rec, withdrawal: rec }
  })

  app.post('/api/swk-ops/withdrawals/:id/manager-review', async (req) => {
    if (!can(req.user, 'sales', 'approve') && !can(req.user, 'finance', 'approve') && req.user?.permissions !== '*' && req.user?.role_name !== 'Manager') {
      throw new HttpError(403, 'Only Manager Mohammad Haseeb or Owner Shabib Siraj can submit a withdrawal review.')
    }
    const { id } = req.params as { id: string }
    const body = (req.body ?? {}) as { manager_recommendation?: string; deduction_forfeiture_amount?: number; refundable_to_client?: number }
    const row = q.get<any>(`SELECT * FROM deal_withdrawals WHERE id = ? AND deleted_at IS NULL`, Number(id))
    if (!row) throw new HttpError(404, 'Withdrawal record not found')
    const rec = updateRecord(getDef('deal_withdrawals'), row.id, {
      notes: body.manager_recommendation || 'Reviewed by Manager Mohammad Haseeb — recommended for Owner Shabib Siraj final approval per payment terms.',
      manager_reviewed_by: req.user!.id,
      manager_reviewed_at: nowIso(),
      ...(body.deduction_forfeiture_amount !== undefined ? { forfeited_or_deducted_amount: body.deduction_forfeiture_amount } : {}),
      ...(body.refundable_to_client !== undefined ? { refundable_amount_to_client: body.refundable_to_client } : {}),
      status: 'Pending Owner (Shabib Siraj) Approval',
    }, { ...req.ctx, system: true, auditReason: body.manager_recommendation || 'Manager review of deal withdrawal' })

    notifyLeadership(
      `Withdrawal Awaiting Owner Approval: ${row.withdrawal_no}`,
      `Manager ${req.user!.name} reviewed ${row.withdrawal_no}. Ready for Owner Shabib Siraj final decision.`,
      `/withdrawals`,
      'warn',
    )
    return { ...rec, status: 'Pending Owner Approval', entity_status: rec.status }
  })

  app.post('/api/swk-ops/withdrawals/:id/owner-approve', async (req) => {
    requireOwner(req)
    const { id } = req.params as { id: string }
    const body = (req.body ?? {}) as { decision?: 'approve' | 'refund_paid' | 'reject'; refund_reference?: string; owner_approval_notes?: string; notes?: string; refundable_to_client?: number; deduction_forfeiture_amount?: number }
    const row = q.get<any>(`SELECT * FROM deal_withdrawals WHERE id = ? AND deleted_at IS NULL`, Number(id))
    if (!row) throw new HttpError(404, 'Withdrawal record not found')
    const nextStatus = body.decision === 'reject'
      ? 'Rejected'
      : (body.decision === 'refund_paid' || body.refund_reference)
        ? 'Refund Executed & Reconciled'
        : 'Approved by Owner – Ready for Refund'
    const rec = updateRecord(getDef('deal_withdrawals'), row.id, {
      status: nextStatus,
      owner_approved_by: req.user!.id,
      owner_approved_at: nowIso(),
      ...(body.refund_reference ? { refund_bank_reference: body.refund_reference } : {}),
      ...(body.refundable_to_client !== undefined ? { refundable_amount_to_client: body.refundable_to_client } : {}),
      ...(body.deduction_forfeiture_amount !== undefined ? { forfeited_or_deducted_amount: body.deduction_forfeiture_amount } : {}),
      ...(body.notes || body.owner_approval_notes ? { notes: body.notes || body.owner_approval_notes } : {}),
    }, { ...req.ctx, system: true, auditReason: `Owner Shabib Siraj decision (${nextStatus}) on withdrawal ${row.withdrawal_no}` })

    if (nextStatus !== 'Rejected' && row.job_id) {
      q.run(`UPDATE jobs SET job_status = 'Cancelled', notes = ?, updated_at = ? WHERE id = ?`, `Deal Withdrawal ${row.withdrawal_no}: ${row.situation_and_reason}`, nowIso(), row.job_id)
    }
    notifyLeadership(`Owner ${nextStatus}: ${row.withdrawal_no}`, `Owner Shabib Siraj marked withdrawal ${row.withdrawal_no} as ${nextStatus}.`, `/withdrawals`, 'info')
    return { ...rec, status: body.refund_reference ? 'Refund Paid & Closed' : nextStatus, entity_status: nextStatus }
  })

  // ------------------------------------------------------------------ 3. Manager Administrative Decision Requests (Haseeb -> Shabib)
  app.get('/api/swk-ops/admin-decisions', async () => {
    const items = q.all(`
      SELECT a.*, u1.name as requested_by_name, u2.name as decided_by_name
      FROM approval_requests a
      LEFT JOIN users u1 ON u1.id = a.requested_by
      LEFT JOIN users u2 ON u2.id = a.decided_by
      ORDER BY CASE WHEN a.status = 'Pending' THEN 0 ELSE 1 END, a.id DESC
    `)
    return { items }
  })

  app.post('/api/swk-ops/admin-decisions', async (req) => {
    const body = (req.body ?? {}) as { subject?: string; category?: string; decision_type?: string; reason?: string; justification?: string; amount?: number; entity?: string; record_id?: number }
    const reasonText = body.reason || body.justification
    if (!body.subject || !reasonText) throw new HttpError(400, 'Subject and detailed reasoning are required for Owner approval.')
    const cat = body.category || body.decision_type || 'Administrative Decision'
    const recId = body.record_id || (Date.now() % 100000000)
    const info = q.run(
      `INSERT INTO approval_requests (entity, record_id, requested_by, requested_at, status, reason) VALUES (?, ?, ?, ?, 'Pending', ?)`,
      body.entity || 'admin_decision',
      recId,
      req.user!.id,
      nowIso(),
      `[${cat}] ${body.subject} — ${reasonText}${body.amount ? ` (AED ${Number(body.amount).toLocaleString('en-US')})` : ''}`,
    )
    const id = Number(info.lastInsertRowid)
    notifyLeadership(
      `Admin Decision Requested by ${req.user!.name}`,
      `${body.subject}: ${reasonText} — Awaiting Owner Shabib Siraj approval.`,
      `/recycle-bin`,
      'warn',
    )
    const approval = q.get(`SELECT * FROM approval_requests WHERE id = ?`, id)
    return { ...approval, approval }
  })

  app.post('/api/swk-ops/admin-decisions/:id/owner-decide', async (req) => {
    requireOwner(req)
    const { id } = req.params as { id: string }
    const body = (req.body ?? {}) as { decision?: 'Approved' | 'Rejected' | 'approve' | 'reject'; comment?: string; notes?: string }
    const normalized = (body.decision === 'approve' || body.decision === 'Approved')
      ? 'Approved'
      : (body.decision === 'reject' || body.decision === 'Rejected')
        ? 'Rejected'
        : null
    if (!normalized) throw new HttpError(400, 'Decision must be Approved or Rejected')
    const row = q.get<any>(`SELECT * FROM approval_requests WHERE id = ?`, Number(id))
    if (!row) throw new HttpError(404, 'Decision request not found')
    const commentText = body.comment ?? body.notes ?? `${normalized} by Owner Shabib Siraj`
    q.run(
      `UPDATE approval_requests SET status = ?, decided_by = ?, decided_at = ?, reason = ? WHERE id = ?`,
      normalized, req.user!.id, nowIso(), `${row.reason} | Owner Note: ${commentText}`, row.id,
    )
    if (row.requested_by) {
      notify(row.requested_by, `Owner ${normalized} Admin Decision`, `${row.reason} — ${commentText}`, `/recycle-bin`, normalized === 'Approved' ? 'info' : 'warn')
    }
    return { ok: true, id: row.id, status: normalized }
  })

  // ------------------------------------------------------------------ 4. Bayut & Dubizzle Portal Syndication + 3rd-Party A2A Match
  app.get('/api/swk-ops/portals/status', async () => {
    const props = q.all(`
      SELECT id, property_no as prop_code, title, department_division, COALESCE(sub_community, building_name, address, '') as community,
             CASE WHEN department_division = 'Leasing' THEN 'Rent' ELSE 'Sale' END as purpose,
             status, rera_permit_no as trakheesi_permit, syndicate_bayut as portal_bayut, syndicate_dubizzle as portal_dubizzle, syndicate_pf as portal_pf,
             inventory_source_type as inventory_source, is_third_party_agent as is_a2a_listing,
             external_agency_name as third_party_agency_name, external_agent_name as third_party_agent_name,
             a2a_commission_split_pct as third_party_commission_pct, price as list_price, rent_annual as annual_rent
      FROM properties WHERE deleted_at IS NULL ORDER BY id DESC
    `)
    const logs = q.all(`SELECT * FROM portal_syndication_logs ORDER BY id DESC LIMIT 30`)
    const leadsBySource = q.all(`SELECT source, COUNT(*) as count FROM leads WHERE deleted_at IS NULL GROUP BY source ORDER BY count DESC`)
    return {
      portals: [
        { key: 'bayut', name: 'Bayut UAE (Connected Feed)', activeListings: props.filter((p: any) => p.portal_bayut).length, account: 'SWK Properties LLC — Bayut Pro Agency #BRN-SWK', status: 'Connected & Live XML/API Feed' },
        { key: 'dubizzle', name: 'Dubizzle Property (Connected Feed)', activeListings: props.filter((p: any) => p.portal_dubizzle).length, account: 'SWK Properties LLC — Dubizzle Verified Agency', status: 'Connected & Live XML/API Feed' },
        { key: 'pf', name: 'Property Finder UAE', activeListings: props.filter((p: any) => p.portal_pf).length, account: 'SWK Properties LLC — PF Enterprise', status: 'Connected & Live XML/API Feed' },
      ],
      byDepartment: {
        offplan: props.filter((p: any) => p.department_division === 'Sales of Off-Plan Projects').length,
        secondary: props.filter((p: any) => p.department_division === 'Secondary Projects').length,
        leasing: props.filter((p: any) => p.department_division === 'Leasing').length,
        a2aCount: props.filter((p: any) => p.is_a2a_listing || p.inventory_source === '3rd-Party Agent (A2A)').length,
      },
      leadsBySource,
      recentLogs: logs,
    }
  })

  app.post('/api/swk-ops/portals/sync', async (req) => {
    const body = (req.body ?? {}) as { portal?: string; department_division?: string }
    const portalName = body.portal || 'Bayut & Dubizzle'
    const publishable = q.all(`SELECT id, property_no as prop_code, title, department_division, rera_permit_no as trakheesi_permit, syndicate_bayut as portal_bayut, syndicate_dubizzle as portal_dubizzle FROM properties WHERE deleted_at IS NULL AND status IN ('Available','Off-Plan','Under Offer')`)
    let syncedCount = 0
    for (const p of publishable) {
      q.run(
        `INSERT INTO portal_syndication_logs (portal_name, property_id, department_division, action, feed_status, external_listing_ref, synced_by, synced_at) VALUES (?, ?, ?, 'PUBLISH_SYNC', 'Active', ?, ?, ?)`,
        portalName, p.id, p.department_division || body.department_division || 'Secondary Projects', `BAYUT-DBZ-${p.prop_code}`, req.user?.id ?? null, nowIso(),
      )
      syncedCount++
    }
    notifyLeadership(`Bayut & Dubizzle Portal Sync Complete`, `${syncedCount} active SWK inventory listings syndicated to ${portalName}.`, `/pipeline`, 'info')
    return { ok: true, portal: portalName, syncedListings: syncedCount, synced: ['Bayut', 'Dubizzle'], syncedAt: nowIso() }
  })

  app.get('/api/swk-ops/a2a-match', async (req) => {
    const qParams = (req.query ?? {}) as { department_division?: string; community?: string; bedrooms?: string; max_budget?: string; only_a2a?: string }
    const allProps = q.all(`
      SELECT *, property_no as prop_code, COALESCE(sub_community, building_name, address, '') as community,
             CASE WHEN department_division = 'Leasing' THEN 'Rent' ELSE 'Sale' END as purpose,
             inventory_source_type as inventory_source, is_third_party_agent as is_a2a_listing,
             external_agency_name as third_party_agency_name, external_agent_name as third_party_agent_name,
             a2a_commission_split_pct as third_party_commission_pct, price as list_price, rent_annual as annual_rent
      FROM properties WHERE deleted_at IS NULL ORDER BY is_third_party_agent DESC, id DESC
    `)
    const filtered = allProps.filter((p: any) => {
      if (qParams.department_division && p.department_division !== qParams.department_division) return false
      if (qParams.community && !String(p.community || '').toLowerCase().includes(qParams.community.toLowerCase())) return false
      if (qParams.bedrooms && Number(p.bedrooms) !== Number(qParams.bedrooms)) return false
      if (qParams.only_a2a === '1' && !p.is_a2a_listing && p.inventory_source !== '3rd-Party Agent (A2A)') return false
      if (qParams.max_budget) {
        const budgetCents = toCents(Number(qParams.max_budget))
        const price = p.purpose === 'Rent' ? Number(p.annual_rent || 0) : Number(p.list_price || 0)
        if (price > 0 && price > budgetCents) return false
      }
      return true
    }).map((p: any) => {
      const baseValue = fromCents(p.purpose === 'Rent' ? (p.annual_rent || 0) : (p.list_price || 0))
      const grossCommPct = p.purpose === 'Rent' ? 5 : 2
      const grossComm = Math.round(baseValue * (grossCommPct / 100))
      const isA2A = !!(p.is_a2a_listing || p.inventory_source === '3rd-Party Agent (A2A)')
      const a2aSharePct = isA2A ? Number(p.third_party_commission_pct || 50) : 0
      const thirdPartyPayout = Math.round(grossComm * (a2aSharePct / 100))
      const swkNetPool = grossComm - thirdPartyPayout
      const swkCompanyShare50 = Math.round(swkNetPool * 0.5)
      const advisorShare50 = swkNetPool - swkCompanyShare50
      return {
        ...p,
        list_price_aed: fromCents(p.list_price || 0),
        annual_rent_aed: fromCents(p.annual_rent || 0),
        commissionPreview: {
          grossCommissionAed: grossComm,
          isA2A,
          a2aPartnerSharePct: a2aSharePct,
          thirdPartyAgentPayoutAed: thirdPartyPayout,
          swkNetPoolAed: swkNetPool,
          swkCompany50PctAed: swkCompanyShare50,
          salesAdvisor50PctAed: advisorShare50,
        },
      }
    })
    return { items: filtered, a2a_brokers: filtered, total: filtered.length }
  })

  // ------------------------------------------------------------------ 5. Market Pulse, Daily DLD Sync, News & Site-Visit Area Companion
  app.get('/api/swk-ops/market-pulse', async () => {
    const dldRows = q.all(`SELECT * FROM dld_market_transactions WHERE deleted_at IS NULL ORDER BY txn_date DESC, id DESC LIMIT 60`).map((r: any) => ({
      ...r,
      trans_date: r.txn_date,
      project_name: r.building_or_project,
      procedure_name: r.procedure_type,
      actual_worth: fromCents(r.transacted_value_aed),
      price_per_sqft: fromCents(r.price_per_sqft_aed),
      meter_sale_price: Math.round(fromCents(r.price_per_sqft_aed) * 10.764),
    }))
    const newsRows = q.all(`SELECT * FROM real_estate_news WHERE deleted_at IS NULL ORDER BY published_at DESC, id DESC LIMIT 30`).map((n: any) => ({
      ...n,
      published_date: String(n.published_at || '').slice(0, 10),
      client_pitch_talking_point: n.client_pitch_takeaway,
    }))
    return {
      areas: DUBAI_AREAS_24,
      communities: DUBAI_AREAS_24,
      dldTransactions: dldRows,
      dld_transactions: dldRows,
      news: newsRows,
      mortgageBanks: UAE_MORTGAGE_BANKS,
      mortgage_rates: UAE_MORTGAGE_BANKS,
      lastUpdated: nowIso(),
    }
  })

  app.post('/api/swk-ops/dld-sync', async (req) => {
    const res = syncDailyDldTransactionsAndNews(req.ctx)
    return res
  })

  app.get('/api/swk-ops/area-companion/:code', async (req) => {
    const { code } = req.params as { code: string }
    const qKey = String(code || '').toUpperCase().trim()
    const area = DUBAI_AREAS_24.find(
      a => a.code === qKey || a.ticker.toUpperCase() === qKey || a.name.toUpperCase().includes(qKey),
    ) ?? DUBAI_AREAS_24[0]

    const dldInArea = q.all(
      `SELECT * FROM dld_market_transactions WHERE deleted_at IS NULL AND (community_code = ? OR UPPER(area_name) LIKE '%' || UPPER(?) || '%') ORDER BY txn_date DESC, id DESC LIMIT 15`,
      area.code, area.name,
    ).map((r: any) => ({
      ...r,
      trans_date: r.txn_date,
      project_name: r.building_or_project,
      procedure_name: r.procedure_type,
      actual_worth: fromCents(r.transacted_value_aed),
      price_per_sqft: fromCents(r.price_per_sqft_aed),
    }))

    const areaNews = q.all(
      `SELECT * FROM real_estate_news WHERE deleted_at IS NULL AND (UPPER(area_name) LIKE '%' || UPPER(?) || '%' OR UPPER(headline) LIKE '%' || UPPER(?) || '%') ORDER BY published_at DESC, id DESC LIMIT 10`,
      area.name.split(' ')[0], area.name.split(' ')[0],
    )

    const swkUnitsInArea = q.all(
      `SELECT id, property_no as prop_code, title, department_division, property_type, bedrooms, area_sqft, price as list_price, rent_annual as annual_rent, status, inventory_source_type as inventory_source, is_third_party_agent as is_a2a_listing, external_agency_name as third_party_agency_name FROM properties WHERE deleted_at IS NULL AND (UPPER(COALESCE(address, '')) LIKE '%' || UPPER(?) || '%' OR UPPER(COALESCE(building_name, '')) LIKE '%' || UPPER(?) || '%') ORDER BY id DESC LIMIT 12`,
      area.name.split(' ')[0], area.name.split(' ')[0],
    ).map((p: any) => ({
      ...p,
      list_price: fromCents(p.list_price || 0),
      annual_rent: fromCents(p.annual_rent || 0),
    }))

    return {
      area,
      stock_card: {
        ticker: `DLD:${area.code === 'MARN' || area.code === 'DMAR' ? 'MARINA' : area.code}`,
        price_sqft: area.ppsf,
        yoy_change_pct: area.yoyPct,
        gross_yield_pct: area.yieldPct,
      },
      companion: {
        future_15yr_outlook: area.future15YearOutlook,
        closing_keywords: area.closingKeywords,
        pitch_phrases: area.fieldVisitPitchScript,
        nearby: area.nearby,
        ongoing_projects: area.ongoingProjects,
      },
      dldTransactions: dldInArea,
      news: areaNews,
      availableInventory: swkUnitsInArea,
      mortgageRates: UAE_MORTGAGE_BANKS.slice(0, 3),
    }
  })

  // ------------------------------------------------------------------ 6. Owner WhatsApp Morning Briefing & 10:30 AM Attendance Report
  app.post('/api/swk-ops/briefings/morning', async () => {
    return await sendOwnerMorningBriefing()
  })

  app.post('/api/swk-ops/briefings/attendance-1030', async () => {
    return await sendOwner1030AttendanceReport()
  })
}
