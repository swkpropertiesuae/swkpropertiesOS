# SWK OS – SWKPROPOS

A sovereign, agentic operating system for SWK Properties' UAE real estate enterprise. A comprehensive property management and real estate OS with 14 core SME modules, agentic workflow orchestration, and full UAE regulatory compliance.

It is a purpose-built real estate operating system with sovereign agent capabilities, financial substrate, and governed intelligence layers.

---

## 🏢 What It Is

SWK OS – SWKPROPOS is a complete real estate operating system that covers every function an SME runs on: from company administration and CRM through accounting, procurement, HR, project management, and communications. It is presented as 14 core modules, branded as SWK OS, with a dashboard built on the SWK OS design system (Instrument Sans + Plus Jakarta Sans fonts, emerald `#007b52` + graphite `#161d1a` palette).

The system includes:
- **14 seeded SWK properties** across UAE locations (Dubai Marina, Palm Jumeirah, Downtown Dubai, Dubai Hills Estate, Arabian Ranches, JVC, Business Bay)
- **Agent harness** (Harnis) for tenant isolation, approval gates, and sandboxed code execution
- **Data fabric** (MCP gateway) with DLD API integration, Emirates ID and broker license validation
- **ML valuation engine** with 20+ feature-based pricing and mispricing explorer
- **ForestSwarm orchestration** — 17-stage agent tree from Lead Capture → Deal Closed, with Cowork Copilot
- **Blockchain asset rails** — hash registry, verifiable credentials, XRPL/Stacks registry
- **Governance fabric** — UAE AI Act Tier classification (Tiers 1-4), PDPL consent & DSAR workflows, RERA AI controls

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
npm run dev              # API on :8081 + web on :5173
npm run build && npm start   # production
```

The API runs on port **8081** (configurable via `.env`). The web interface runs on port **5173** with proxy to the API.

### Configuration

Copy `.env.example` to `.env` and adjust:

```
NODE_ENV=production
PORT=8081
DATA_DIR=./data
PG_SCHEMA=swk
PUBLIC_URL=http://localhost:8081
BASE_CURRENCY=AED
STARTER_DATA=false
ADMIN_EMAIL=admin@swkpropertiesuae.com
ADMIN_PASSWORD=SWK@Admin2026
MANAGER_EMAIL=manager@swkpropertiesuae.com
MANAGER_PASSWORD=SWK@Manager2026
DEMO_ENABLED=false
DEMO_EMAIL=demo@swkpropertiesuae.com
DEMO_PASSWORD=Demo@SWK2026
```

### Sign-in Accounts

| Account | Email | Password | Workspace |
|---|---|---|---|
| Administrator (all access) | admin@swkpropertiesuae.com | SWK@Admin2026 | Production – clean, zero mock data |
| Manager (all access) | manager@swkpropertiesuae.com | SWK@Manager2026 | Production – clean, zero mock data |

Production accounts must set their own password at first sign-in, or set `ADMIN_PASSWORD` / `MANAGER_PASSWORD` before the first start.

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
│   ├── server/            # Fastify API server (port 8081)
│   └── web/               # React + Vite frontend (port 5173)
├── data/                  # Runtime data directory
├── .env                   # Configuration (PORT=8081, AED currency, credentials)
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
npm test             # 135 API smoke checks
npm run test:compliance  # 65 UAE compliance rule checks
npm run test:handover  # 48 handover/approval checks
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

This operating system is tailored for **SWK Properties**, a UAE real estate enterprise. The system incorporates UAE-specific compliance (DLD regulations, 5% VAT, escrow accounts, Ejari structures, RERA BRN tracking) and is designed as a sovereign agentic OS — meaning it has agent harnessing, data fabric, intelligence layer, transaction surfaces, asset rails, and governance fabric all unified on one regulatory and financial substrate.

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
- Append-only audit trail (OpenTelemetry)
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

The API esbuild target is `node22`. The web Vite build outputs to `dist/web/`. Both builds are verified on every `npm run dev` cycle.

---

*SWK OS – SWKPROPOS. Sovereign agentic operating system for UAE real estate enterprises. 14 core SME modules.*