# SWK Properties OS & SWK ONE Android v1.0

<p align="center">
  <img src="public/brand/logo-png/swk-logo-gold-512.png" alt="SWK Properties LLC" width="180" />
</p>

**Complete UAE Real Estate Operating System (ERP, CRM, Portal Syndication, DLD Market Pulse & Native Android Field App)** built for **SWK Properties LLC (Dubai, UAE)** — live at **[https://os.swkpropertiesuae.com](https://os.swkpropertiesuae.com)**.

---

## 🏛️ 1. Company Hierarchy, Roles & Governance

| Role | Account Holder | Email | Access & Governance Rules |
| :--- | :--- | :--- | :--- |
| **Owner & Managing Director** | **Shabib Siraj** | `admin@swkpropertiesuae.com`<br/>`shabib@swkpropertiesuae.com` | **Complete System Control (`*`)**. Receives automated WhatsApp **Morning Briefing (09:30 AM)** and **10:30 AM Attendance & Contemptor Report**. Sole final approver for **Manager Administrative Decisions**, **Pending Delete Bin (`Recycle Bin`)** permanent deletions, and **Deal Withdrawal Client Refunds**. |
| **Operations Manager** | **Mohammad Haseeb** | `manager@swkpropertiesuae.com`<br/>`haseeb@swkpropertiesuae.com` | **Majority Operational Access** across all 3 departments, CRM, Sales, Mandates, Transactions, Leases, HR, and Finance. Any administrative decision (`manager_admin_decisions`) or record deletion requires **Owner (Shabib Siraj)** approval before execution. |
| **BDM & IT Admin** | **Talha Shabbir** | `talha@swkpropertiesuae.com` | Manages CRM & ERP operations, **Bayut & Dubizzle** XML/API portal syndication, digital marketing campaigns, AI employee workflows, and IT administration. |
| **Sales Advisors** | DLD-Registered Brokers | `@swkpropertiesuae.com` | Sponsored on **SWK Properties Company Visa** with **AED 0 Basic Salary (`basic_salary = 0`)** and a **50–50% Net Commission Split** between SWK Properties and the Sales Advisor (after deducting any 3rd-Party A2A partner broker share). |

---

## 🏢 2. Three Core Operational Departments & Step-by-Step UAE Workflow

The entire web OS (`/home` Launcher, `AppSidebar`, `/dashboard`, and `/swk/pipeline`) is organized into **3 Core Operational Departments** following the exact sequential UAE brokerage workflow:

1. **DEPT 01 — Sales of Off-Plan Projects (`OFFPLAN`)**
   - Developer Inventory & Launches → Promote & Campaign Syndication → Platform Leads Intake → Calls, Meetings & Follow-Ups → Site Visit & Show-Apartment Companion → EOI, Booking, SPA & Oqood (or Mandatory Non-Conversion Reason) → Legal UAE Payment / Escrow Collection → Handover & 50/50 Commission Split.
2. **DEPT 02 — Secondary Projects (`SECONDARY`)**
   - Seller / 3rd-Party A2A Inventory & Detailed Seller Requirements → Bayut, Dubizzle & Portal Promotion → Leads Intake → Qualification & Follow-Ups → Property Site Visits & Live Area Companion → Buyer Finance Status (`Cash`, `Mortgaged`, `Mortgage Pre-Approved`), **RERA Form F (MOU)**, Developer NOC & DLD Trustee Transfer (or Non-Conversion Reason) → Legal UAE Payment & Deal Withdrawal/Refund Protection → Title Deed Handover & 50/50 Commission Split (after 3rd-Party A2A share).
3. **DEPT 03 — Leasing Department (`LEASING`)**
   - Landlord Mandate or 3rd-Party A2A Partner Search (when direct inventory doesn't match client requirements) → **Bayut & Dubizzle** Live Portal Promotion → Tenant Leads Intake → Calls & Qualification → Property Viewings & Area Companion → Tenancy Contract, **Ejari Registration** & PDC Cheques → Legal Rent & Deposit Collection → Key Handover & 50/50 + A2A Commission Settlement.

---

## 📱 3. SWK ONE Android v1.0 (`ae.swkproperties.one`) — Attendance, Live GPS & Checkout Gate

- **Official UAE Working Hours**:
  - **Monday – Friday**: `10:00 AM – 7:00 PM` (`19:00` GST)
  - **Saturday**: `10:00 AM – 4:00 PM` (`16:00` GST)
  - **Sunday**: Official Holiday (client-based variable working hours are automatically logged when an advisor attends scheduled Sunday client meetings/viewings)
  - **Grace Period**: Until **10:05 AM**. Check-ins up to `10:05 AM` are recorded as **On-Time**; `10:06 AM+` is marked **Late** with exact late minutes.
- **Dual Check-In Modes**:
  1. **Office Reception QR Scan**: Advisors in the office scan the rotating Reception QR terminal (`/swk/reception-qr` → `POST /api/swk-one/attendance/qr-check-in`).
  2. **Out-of-Office Site Visit (Live GPS Check-In)**: Advisors outside the office for a scheduled site visit check in via live GPS (`POST /api/swk-one/viewings/:id/arrive` or `POST /api/swk-one/field-duty/start`), which automatically registers their daily attendance (`Field Site Visit Live GPS`) tied to the scheduled visit.
- **Mandatory Checkout Gate (`getCheckoutGateStatus`)**:
  - Advisors **cannot check out** (from office or field) until:
    1. All scheduled site visits (`viewings`) for today have their arrival and client outcome logged, **AND**
    2. Today's **Daily Report (`daily_reports`)** has been submitted.
- **Owner WhatsApp Briefings & Continuous Contemptor Alerts**:
  - **09:30 AM Morning Briefing**: Automated WhatsApp summary sent to Owner **Shabib Siraj**.
  - **10:30 AM Attendance Report**: Automated roll call of on-time (`≤10:05 AM`), field GPS, late (`>10:05 AM`), and absent staff sent to Owner **Shabib Siraj**.
  - **Continuous Contemptor Alert**: Any staff member with **≥3 late arrivals (`>10:05 AM`) in a rolling 7-day window** triggers a `late_contemptor_alerts` record and alerts **Owner Shabib Siraj** and **Manager Mohammad Haseeb** to take a report and guide the employee.

---

## 💳 4. Strictly Legal UAE Payment Modes, 50/50 Split & Deal Withdrawal Refunds

- **Zero Tolerance for Personal Accounts**: No client funds may ever be received in a Sales Advisor's personal bank account (`400 Bad Request` domain guard across `receipts`, `jobs`, and `transactions`).
- **Permitted Legal UAE Payment Channels**:
  - `SWK Company Bank Account (AED/FX)`
  - `Developer DLD Escrow Account`
  - `Manager's Cheque` / `Post-Dated Cheques (PDC)`
  - `Worldwide Currency Exchange (Licensed UAE Exchange House)`
  - `UAE-Permitted Crypto / USDT (VARA-Licensed Gateway)`
- **50–50% Net Commission Formula**:
  $$\text{Company Net Pool} = \text{Gross Commission (excl. VAT)} - \text{3rd-Party A2A Partner Share}$$
  $$\text{SWK Company Share (50\%)} = 0.50 \times \text{Company Net Pool}, \quad \text{Sales Advisor Share (50\%)} = 0.50 \times \text{Company Net Pool}$$
- **Deal Withdrawals & Client Refunds (`/swk/withdrawals` / `deal_withdrawals`)**:
  - Tracks developer/seller or client/buyer withdrawals post-booking or post-closing, computes the refundable amount vs. forfeiture/deduction based on payment stage and agreed SPA/Form F terms, routes through Manager review, and requires **Owner Shabib Siraj** approval before refund release.

---

## 🛡️ 5. Universal Audit Log, Mandatory Edit/Delete Reason & Pending Delete Bin (`Recycle Bin`)

- Every create, edit, delete request, status change, and approval is recorded in `audit_log`.
- **Mandatory Reason on Edit & Delete**: Any edit or delete requires a specific reason and immediately notifies **Owner (Shabib Siraj)**, **Manager (Mohammad Haseeb)**, and **IT/BDM (Talha Shabbir)**.
- **Pending Delete Bin (`/swk/recycle-bin` / `recycle_bin_requests`)**: When a non-Owner user deletes a record, it is held in the **Pending Delete Bin** (`Pending Owner Approval`) with a full snapshot and is **only permanently deleted after Owner Shabib Siraj approves**.

---

## 📈 6. Market Pulse (24 Dubai Areas), Daily DLD Sync, Site-Visit Companion & UAE Mortgage Calculator

- **24 Dubai Communities with Stock-Style Tickers (`/swk/market`)**: Covers Palm Jumeirah, Downtown Dubai, Dubai Marina, Business Bay, Dubai Hills Estate, Dubai Creek Harbour, JVC, JLT, Emaar Beachfront, MBR City / Sobha Hartland, DIFC, Arabian Ranches, DAMAC Hills & Lagoons, Dubai South & Expo City, Palm Jebel Ali, Al Furjan, City Walk, Bluewaters Island, Dubai Islands, Al Barari, Jumeirah Golf Estates, Arjan, Sheikh Zayed Road, and Motor City / Sports City.
- **Daily DLD Open-Data Transactions Sync (`dld_market_transactions`) & Real Estate News (`real_estate_news`)**.
- **Site-Visit Area Companion**: Provides Sales Advisors on a field visit with the community's stock-style price/sqft & yield ticker, nearby landmarks/metro/schools, ongoing projects, **15-year future outlook (2026–2041)**, and **top closing keywords & pitch phrases** tailored to the client.
- **UAE Mortgage Calculator**: Interactive calculator with Expat (80% LTV) / UAE National (85% LTV) / Off-Plan rules, DLD 4% fee + trustee/agency fee breakdown, and live UAE bank rates (FAB, Emirates NBD, ADCB, DIB, Mashreq, HSBC UAE).

---

## 🎨 7. SWK Properties Brand Kit (`SWK_Properties_Logo_Kit`)

All web and Android surfaces use the official **SWK Properties** luxury gold & obsidian identity (`public/brand/`):
- **Primary Gold**: `#B89040` / `#D6B46C`
- **Obsidian Surface**: `#17191C`
- **Warm Ivory Canvas**: `#FBF8F1`
- Complete favicons, PWA icons, OpenGraph banners, and adaptive Android launcher icons.

---

## ▶️ 8. Running & Verifying Locally

```bash
npm install
npm run dev                  # API on :8080 + Web on :5173
npm run typecheck            # TypeScript validation (0 errors)
npm run build                # Build Web (dist/web) + API (dist/server/index.mjs)
npx tsx tests/swk-overhaul.ts      # 36/36 SWK Properties UAE Overhaul checks
npx tsx tests/swk-one-android.ts   # 29/29 SWK ONE Android checks
npm run test:all             # Complete 23-suite acceptance runner
```

See [docs/ANDROID.md](docs/ANDROID.md) for building the **SWK ONE Android APK** and [docs/DEPLOY-CLOUDFLARE.md](docs/DEPLOY-CLOUDFLARE.md) for Cloudflare Containers deployment.
