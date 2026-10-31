# SWK OS – SWKPROPOS

An operating system for SWK Properties' UAE real estate business: property management, brokerage, finance and HR in one app, with 14 core modules, workflow automation, AI assistants and UAE regulatory controls.

---

## 🏢 What It Is

SWK OS – SWKPROPOS is a complete real estate operating system that covers every function an SME runs on: from company administration and CRM through accounting, procurement, HR, project management, and communications. It is presented as 14 core modules, branded as SWK OS, with a dashboard built on the SWK OS design system (Instrument Sans + Plus Jakarta Sans fonts, emerald `#007b52` + graphite `#161d1a` palette).

The system includes:
- **UAE brokerage workflows**: listings and mandates, leads and viewings, transactions, leases and PDC cheques, owner statements, commissions, DLD filings, KYC and goAML/AML logging, RERA permit tracking
- **Finance**: invoices, VAT, bank import and feeds, UAE PINT AE e-invoicing, WPS salary files, year-end close
- **AI employees** (Jarvis and role agents) with a reviewed tool list: read tools run freely, internal writes follow the agent's autonomy setting, and anything external (e-mail, WhatsApp) needs approval
- **Integrations**: Resend/SMTP, Cloudflare R2, Supabase mirror, WhatsApp Cloud API, voice receptionist
- **SWK ONE**: native Android app (WebView shell + foreground location service) with duty-location sharing, reception QR check-in and offline queue; see [docs/ANDROID.md](docs/ANDROID.md)
- **Installable web app (PWA)** with an offline page

---

## 📦 14 Core Modules

| # | Module | Category |
|---|--------|----------|
| 01 | Company & Administration | administration |
| 02 | CRM | sales |
| 03 | Sales Management | sales |
| 04 | Accounting & Finance | finance |
| 05 | Tax & e-Invoicing | finance |
| 06 | Procurement | operations |
| 07 | Inventory & Warehousing | operations |
| 08 | HR & Payroll | hr |
| 09 | Project Management | projects |
| 10 | Document Management | documentation |
| 11 | Universal Approval Engine | approvals |
| 12 | Workflow Automation | automation |
| 13 | Communications & Dashboards | communications |
| 14 | Complete Service Catalogue | catalogue |

Each module is in `packages/ID/` with a `module.json` containing its description, key features, and brand flag.

---

## ▶️ Running the OS

```bash
npm install
npm run dev              # API on :8080 + web on :5173
npm run build && npm start   # production
```

The API runs on port **8080** (set `PORT` in `.env` to change it; the dev web server follows `PORT`). The web interface runs on port **5173** with proxy to the API.

### Configuration

Copy `.env.example` to `.env` and adjust:

```
NODE_ENV=production
PORT=8080
DATA_DIR=./data
PG_SCHEMA=swk
PUBLIC_URL=http://localhost:8080
BASE_CURRENCY=AED
STARTER_DATA=false
ADMIN_EMAIL=admin@swkpropertiesuae.com
ADMIN_PASSWORD=<choose a strong password>
MANAGER_EMAIL=manager@swkpropertiesuae.com
MANAGER_PASSWORD=<choose a strong password>
APP_SECRET=<long random string>
DEMO_ENABLED=false
```

### Sign-in accounts

The first start creates an Administrator and a Manager account (`ADMIN_EMAIL` / `MANAGER_EMAIL`) with a clean, empty workspace.

- **Production** (`NODE_ENV=production`): set `ADMIN_PASSWORD` / `MANAGER_PASSWORD` before the first start. If you do not, a random one-time password is generated and printed once in the server log. Either way the account must change its password at first sign-in.
- **Development** (any other `NODE_ENV`): the documented development defaults in `src/server/config.ts` apply. Never expose a development instance to a network.

---

## 🎨 Design System

The dashboard and UI follow the **SWK OS** design system:

- **Body font**: `Instrument Sans` — used across all UI text, tables, forms
- **Heading font**: `Plus Jakarta Sans` — used for all section headers, page titles, badges
- **Primary color**: Emerald `#007b52` — action buttons, KPI accents, success states
- **Accent color**: Graphite `#161d1a` — card borders, dividers, dark mode surface
- **Neutral surface**: `#fafafa` — light background, card backgrounds
- **Dark mode**: Full theme support with swapped palette for night operation

All CSS in `src/web/index.css` follows this system — buttons, cards, tables, alerts, modals, badges, avatars, progress bars, and the dashboard grid layout all use this palette and typography.

---

## 📁 Repository Structure

```
SWK OS/
├── packages/              # 14 core SWKPROPOS modules (packages/01 → packages/14)
├── src/                   # Source code
│   ├── server/            # Fastify API server (port 8080)
│   └── web/               # React + Vite frontend (port 5173)
├── data/                  # Runtime data directory
├── .env                   # Configuration (see .env.example)
├── package.json           # swkpropos / SWK OS
├── vite.config.ts         # Vite config
├── index.css              # Complete SWK OS design system stylesheet
├── .impeccable/design.json  # Design system metadata
├── deploy/                # Deployment configs
└── README.md              # You are here
```

---

## 🔧 Development

```bash
npm run typecheck    # TypeScript validation
npm test             # API smoke checks (needs a running server)
npm run test:compliance  # UAE compliance rule checks
npm run test:handover  # handover/approval checks
npm run test:all     # Complete acceptance runner
npm run build:api    # Build API to dist/server/index.mjs
npm run build:web    # Build web frontend to dist/web/
```

---

## 📄 Documentation

Key docs are available in the `docs/` directory and referenced from the app:

- `docs/DASHBOARD.md` — Dashboard section layout and data refresh (2-min intervals)
- `docs/FEATURES.md` — Feature catalog and limits
- `docs/UAE-REAL-ESTATE.md` — UAE rules the app applies (rent cap, permits, DLD filings, KYC/AML) and their limits
- `docs/AI-TEAM.md` — AI employees (Jarvis) and audited tooling
- `docs/INTEGRATIONS.md` — Resend, R2, Supabase, WhatsApp, e-invoicing integrations
- `docs/CALENDAR.md` — Company calendar and meeting scheduling
- `docs/HANDOVER.md` — Demo/production isolation and reset procedures
- `docs/STUDIO.md` — Document Studio and startup data options

---

## 🏢 About SWK Properties

This operating system is tailored for **SWK Properties**, a UAE real estate enterprise. The system incorporates UAE-specific compliance (DLD regulations, 5% VAT, escrow accounts, Ejari structures, RERA BRN tracking). Rules are indicative defaults: confirm them with RERA, DLD and your adviser (see `docs/UAE-REAL-ESTATE.md`).

The OS is branded as **SWK OS** and presents 14 SME modules that any growing company can run on, from a single-entity startup to a multi-branch real estate enterprise.

---

## 🛡️ Security

- scrypt password hashing
- httpOnly session cookie
- CSRF header validation
- Login lockout after failed attempts
- Optional TOTP two-factor
- API key support
- Helmet HTTP security headers
- Rate limiting per endpoint
- Audit trail of every create, update, delete and sign-in
- Secrets saved in Integrations are encrypted (AES-256-GCM)
- Security details and reporting: see `SECURITY.md`
- Backups via Administration → Backup
- Optional PostgreSQL production deployment

---

## 📦 Build & Deploy

```bash
# Build everything
npm run build

# Start production
npm start

# Docker (if needed)
docker compose up -d --build
```

The API esbuild target is `node22`. The web Vite build outputs to `dist/web/`. CI typechecks, builds and runs the acceptance suites on every push.

---

*SWK OS – SWKPROPOS. Operating system for UAE real estate businesses.*