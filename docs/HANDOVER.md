# Client Handover Guide — SWK Properties OS

## Production Accounts

| Purpose | E-mail | Initial password | Data |
|---|---|---|---|
| **Administrator** – all features | admin@swkpropertiesuae.com | the `ADMIN_PASSWORD` you configured (or the one-time password printed in the server log at first start) | Production workspace, **clean (zero mock data)** |
| **Manager** – all features | manager@swkpropertiesuae.com | the `MANAGER_PASSWORD` you configured (or the one-time password printed in the server log at first start) | Production workspace, **clean (zero mock data)** |

* Administrator and Manager have full access to every module. Both can administer users, roles, settings, compliance, and integrations.
* On first sign-in each account is required to set a personal password before any business APIs can be accessed. Rotate initial passwords by setting `ADMIN_PASSWORD` / `MANAGER_PASSWORD` in `.env` before the first start if desired.
* The production workspace contains **only reference & statutory configuration**:
  - Chart of accounts (UAE real estate & IFRS aligned), VAT codes (5% Standard, Zero-Rated, Exempt, Out of Scope), currencies, countries
  - UAE master communities & developers
  - Service charge & brokerage fee codes
  - Roles, departments (`Sales`, `Leasing`, `Property Management`, `Finance`, `HR`, `Operations`), Dubai head-office branch (`DXB`), and default legal entity (`SWK` — SWK Properties L.L.C.)
  - RERA ORN (`51517`) and the licence, registration and FTA compliance items to be completed by the administrator
  - 7 AI employees (all switched off by default until enabled by an administrator)
* It contains **zero mock/sample business records** (no fictional clients, properties, units, deals, mandates, leases, cheques, or invoices).

## Enterprise Real Estate Modules Included

| Area | Features Ready for Production |
|---|---|
| **Executive Desk (`/`)** | Live KPIs, sales & leasing pipeline funnel, commission & revenue trend, portfolio occupancy ring, RERA/DLD compliance watch, upcoming viewings/transfers/renewals |
| **Deal Pipeline (`/pipeline`)** | Interactive 7-stage Kanban (`Inquiry` → `Viewing` → `Offer` → `Negotiation` → `Contract (Form F)` → `DLD Trustee` → `Handover`), one-click stage progression, + New Deal modal |
| **Listing Studio (`/listings`)** | RERA Trakheesi permit verification, 100-point listing quality score, live Property Finder / Bayut / Dubizzle syndication metrics |
| **Off-Plan Desk (`/offplan`)** | Live off-plan project inventory (`is_off_plan`), milestone payment plan simulator, DLD 4% + Oqood fee breakdown, one-click Reservation & EOI generator |
| **Market Pulse (`/market`)** | Dubai community price/sqft benchmarks, yield vs appreciation matrix, live valuation against your listed portfolio |
| **Deal Toolkit (`/toolkit`)** | DLD 4% transfer & mortgage fee sheet, UAE expat/national mortgage calculator, RERA Decree 43/2013 rent increase calculator, net yield & 10-year Golden Visa checker |
| **Leases, Ejari & PDC Vault (`/pdc`, `/e/leases`)** | Post-dated cheque vault (`Pending`, `Cleared`, `Overdue`, `Bounced`), one-click clear/bounce recording, 90-day Ejari renewal alerts, maintenance & snagging workflows |
| **Owner 360 (`/owners`)** | Landlord portfolio valuations, net yield after Mollak service charges, RERA renewal uplift signals, live maintenance quote approvals, Golden Visa status |
| **Agent Leaderboard (`/agents`)** | Live broker GCI rankings, commission slab calculator, RERA BRN expiry tracker, 90-day activity heatmap |
| **RERA & Compliance Centre (`/rera`, `/compliance`)** | Form A / Form B / Form F / NOC / Ejari status, live AML/KYC & goAML DNFBP screening queue with one-click verification, UAE VAT & Corporate Tax filing calendar |
| **Finance & Accounting (`/e/invoices`, `/reports`)** | Full double-entry general ledger, FTA tax invoices & credit notes, escrow accounts, AR/AP ageing, Trial Balance, P&L, Balance Sheet, UAE VAT 201 return |
| **HR, Payroll & WPS (`/e/employees`, `/e/payslips`)** | Employee visa/Emirates ID expiry tracking, leave management, UAE Gratuity calculator, MOHRE WPS `.SIF` batch generation |
| **Document Studio (`/studio`)** | 82 corporate templates (`SWK-001` to `SWK-082`) with live PDF/HTML preview, company seal support, and print/email dispatch |

## Go-Live Checklist (Production)
1. Set `APP_SECRET`, `PUBLIC_URL`, `TRUST_PROXY`, `COOKIE_SECURE`, `STARTER_DATA=false`, `DEMO_ENABLED=false`, and initial passwords in `.env`; run behind HTTPS.
2. Sign in as Administrator (`admin@swkpropertiesuae.com`), set your personal password, and enable 2-step verification (TOTP).
3. Open **Administration → Company Settings** (including the **UAE compliance** tab): verify your 15-digit FTA TRN, bank IBAN details, and upload your official company seal.
4. Create staff accounts and RERA broker profiles under **Users** and **Agents**.
5. Connect SMTP / Resend, Cloudflare R2, Supabase, WhatsApp, and AI provider keys under **Integrations** as needed.
6. Enable nightly backups under **Administration → Backup & Data**.
