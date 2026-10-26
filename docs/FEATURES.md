# Feature coverage

SWK OS is a real estate operating system for a UAE brokerage and property-management company. Reference products reviewed for scope: Zoho (CRM/Books/Projects/Desk) and Odoo (CRM/Sales/Accounting/HR/Helpdesk).

| Area | SWK OS |
|---|---|
| Deal files | Sale, lease, off-plan, commercial and bulk deals with stage, deal value, commission, linked property, unit, client, owner and agents; charges and a timeline per deal; generate invoices from deal charges |
| Search | Filter-based record search and global Ctrl+K search |
| Dashboard | Pipeline and revenue figures, recent deals, calls, tasks, expiring leases and documents |
| CRM | Parties, contacts, leads, opportunities, calls and activities, campaigns, contracts |
| Sales | Quotations with approval, e-mail and print, conversion into deals |
| Properties | Properties, units, communities, developers, viewings, snagging and handover |
| Leasing | Leases, rent schedules and receipts, service charges, maintenance requests, inspections, owner statements |
| Mandates and offers | Listing mandates, offers, agent commissions |
| Transactions | Sales contracts, escrow accounts and escrow transactions, DLD filings tracker (broker forms, NOC, Oqood, title deed, mortgage, Ejari) |
| Accounting | Invoices, bills, receipts, payments, expenses, double-entry ledger, VAT codes, FX gain/loss, lock date, statements, year-end close, multiple legal entities |
| People | Employees, registered agents, attendance, leave, payroll records |
| Support | Tickets, disputes and claims |
| Work | Projects, tasks, work queues, calendar |
| Documents | Document Studio template library, server-rendered PDF (download and e-mail with attachment), bilingual EN/AR document headings |
| Install | Installable web app (PWA) on desktop, Android and iPhone/iPad: home-screen icon, own window, shortcuts, offline page, update prompt. Private data is never stored on the device (see docs/INSTALL-APP.md) |
| Platform | Roles and permissions, audit log, automation rules, webhooks (HMAC), API keys, custom fields, e-mail outbox, backups, customer portal role, TOTP |

## Integrations and automation

| Area | What it does |
|---|---|
| Banking | CSV and MT940 import, bank-feed webhook, automatic matching |
| E-invoicing | UBL 2.1 PINT AE XML, ASP submission, status on the invoice |
| Payroll | UAE WPS SIF file with validation of every employee's IBAN, routing code and person ID |
| Language | Arabic UI with right-to-left layout and Arabic web font (navigation and field labels) |
| Storage and data | Resend mail, Cloudflare R2 files and backups, PostgreSQL primary or optional Supabase replica, encrypted secrets |
| WhatsApp | Lead capture, staff and customer bots, overdue reminders, owner daily report, inbox, automation actions |
| AI | Jarvis chat plus AI employees, approvals queue, schedules, free-provider presets with fallback |

## UAE compliance

Trakheesi permit expiry checks, RERA rent-increase cap and renewal notice deadline, KYC checklists, PEP and beneficial-owner records, goAML report log with cash-threshold scan (see UAE-REAL-ESTATE.md; indicative, verify with RERA/DLD), Compliance Centre, licences and registrations register, licensed-activity guard, statutory calendar, exceptions log, UAE tax-invoice rules, sanctions-screening control, gratuity and related-party reports.

## Limits you should know about

- Integrations were verified against mock providers, not live services (see INTEGRATIONS.md). Credentials and provider approvals (Meta templates, ASP accreditation, bank WPS onboarding) are yours to obtain.
- The primary database is PostgreSQL when `DATABASE_URL` is configured, otherwise SQLite. The optional Supabase replica is separate and should stay disabled when PostgreSQL is primary. MongoDB is not used.
- WPS SIF follows the common bank layout – confirm with your bank before first upload. Deductions are netted into the fixed component.
- Arabic translation covers navigation, buttons, statuses and field labels; free-text data, error messages and some long help texts stay in English. Printed documents are English with Arabic titles.
- PDF engine is Chromium (included in the Docker image; set `CHROME_PATH` otherwise).
- Default passwords must be changed; set `APP_SECRET`.
