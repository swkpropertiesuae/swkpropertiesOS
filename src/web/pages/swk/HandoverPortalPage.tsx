import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Award,
  BookOpen,
  Building2,
  CheckCircle2,
  Code2,
  Cpu,
  Database,
  FileCheck2,
  Film,
  Globe,
  Layers,
  Lock,
  PlayCircle,
  Printer,
  QrCode,
  ShieldCheck,
  Sparkles,
  Server,
  Terminal,
  Users,
  Workflow,
  ArrowLeft,
} from 'lucide-react'
import { SWK_COMPANY_NAME, SWK_OFFICIAL_WEBSITES_TEXT } from '@shared/corporate-footer'

type DocTab = 'video' | 'owner-dossier' | 'tech-manual' | 'staff-guide' | 'certificate'

export default function HandoverPortalPage() {
  const [tab, setTab] = useState<DocTab>('owner-dossier')

  const printCurrentDocument = (targetTab: DocTab) => {
    setTab(targetTab)
    setTimeout(() => window.print(), 120)
  }

  return (
    <div className="min-h-screen bg-[#f6f2ea] text-[#0b1a33] pb-16">
      {/* Top Executive Banner (hidden when printing individual document) */}
      <header
        className="print:hidden border-b border-[#c9a96e]/35 text-white"
        style={{ background: 'linear-gradient(135deg, #061022 0%, #0b1a33 55%, #14305c 100%)' }}
      >
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-[#050c1b]/85 border border-[#c9a96e]/40">
                <img
                  src="/brand/swk-os/portal-arch-emblem-transparent.png"
                  alt="SWK OS Emblem"
                  className="h-10 w-10 object-contain"
                />
                <img
                  src="/brand/swk-os/primary-logo-transparent.png"
                  alt="SWK OS"
                  className="h-9 w-auto object-contain"
                />
              </div>
              <div>
                <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[#e8d4a2]">
                  <Sparkles size={13} /> Official Software Agency Handover &amp; Training Suite
                </div>
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-white m-0 mt-0.5">
                  SWK OS — Complete Enterprise System Handover Package
                </h1>
                <div className="text-xs sm:text-sm text-[#c7d2e4] mt-1">
                  Architected, Engineered &amp; Delivered Pin-to-Pin by{' '}
                  <strong className="text-[#f3dfb8]">SHAMEEM HARFATH S M</strong> for{' '}
                  <strong className="text-white">{SWK_COMPANY_NAME}</strong>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <Link
                to="/home"
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white text-xs font-semibold no-underline inline-flex items-center gap-1.5"
              >
                <ArrowLeft size={14} /> Back to Workspace
              </Link>
              <a
                href="/handover/SWK_Properties_OS_Complete_Workflow_And_Logic_Booklet.pdf"
                download
                className="px-4 py-2.5 rounded-xl font-bold text-xs text-[#08142a] no-underline inline-flex items-center gap-2 shadow-lg"
                style={{ background: 'linear-gradient(135deg, #f1e3c2 0%, #c9a96e 100%)' }}
              >
                <BookOpen size={15} /> Download Workflow &amp; Logic Booklet (PDF)
              </a>
              <a
                href="/handover/SWK_Properties_OS_Interactive_Workflow_Booklet.html"
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-[#c9a96e]/50 text-[#f3dfb8] text-xs font-bold no-underline inline-flex items-center gap-1.5"
              >
                <Workflow size={14} /> Open Interactive Booklet
              </a>
              <a
                href="/handover/SWK_OS_Office_Attendance_QR_Code_And_Method.pdf"
                download
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-[#c9a96e]/50 text-[#f3dfb8] text-xs font-bold no-underline inline-flex items-center gap-1.5"
              >
                <QrCode size={14} /> Attendance QR &amp; Method PDF
              </a>
              <a
                href="/handover/SWK_OS_Complete_Software_Handover_And_Staff_Credentials_By_Shameem_Harfath.pdf"
                download
                className="px-4 py-2.5 rounded-xl font-bold text-xs text-[#08142a] no-underline inline-flex items-center gap-2 shadow-lg"
                style={{ background: 'linear-gradient(135deg, #f1e3c2 0%, #c9a96e 100%)' }}
              >
                <Printer size={15} /> Download Complete Handover PDF
              </a>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5"
              >
                <Printer size={14} /> Print Active Tab
              </button>
            </div>
          </div>

          {/* Quick Engineering Telemetry Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6">
            {[
              { label: 'Total Source Code', val: '39,599 LOC', sub: '240 Engineered Files' },
              { label: 'Backend API Routes', val: '317 Endpoints', sub: 'Fastify 5 + Zod Validated' },
              { label: 'Database Schema', val: '75+ Tables', sub: 'PostgreSQL + SQLite Dual-DB' },
              { label: 'Departmental Apps', val: '9 Core Suites', sub: '79 React 19 UI Modules' },
              { label: 'UAE Compliance', val: '100% RERA/DLD', sub: 'Form A/B/I/F, Oqood, Ejari, VAT' },
              { label: 'Automated QA Suites', val: '34 Test Suites', sub: '3,086 Lines of E2E/API Tests' },
            ].map(stat => (
              <div
                key={stat.label}
                className="rounded-2xl bg-white/[0.06] border border-[#c9a96e]/30 px-3.5 py-3 backdrop-blur-sm"
              >
                <div className="text-[10px] uppercase tracking-[0.16em] text-[#e8d4a2] font-bold">{stat.label}</div>
                <div className="font-display text-lg sm:text-xl font-bold text-white mt-0.5">{stat.val}</div>
                <div className="text-[11px] text-[#b8c3d7]">{stat.sub}</div>
              </div>
            ))}
          </div>

          {/* Document Selector Tabs */}
          <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-white/10">
            {[
              {
                id: 'owner-dossier' as const,
                icon: Award,
                label: 'Doc 01 · Owner Executive Dossier (Pin-to-Pin)',
              },
              {
                id: 'tech-manual' as const,
                icon: Cpu,
                label: 'Doc 02 · Technical Architecture & Security Manual',
              },
              {
                id: 'staff-guide' as const,
                icon: BookOpen,
                label: 'Doc 03 · All-Staff Operations & SOP User Guide',
              },
              {
                id: 'certificate' as const,
                icon: FileCheck2,
                label: 'Doc 04 · Official Handover Certificate & Sign-Off',
              },
              {
                id: 'video' as const,
                icon: Film,
                label: 'Explanatory Walkthrough Video (Full HD)',
              },
            ].map(t => {
              const active = tab === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-2 border ${
                    active
                      ? 'bg-[#c9a96e] text-[#08142a] border-[#e8d4a2] shadow-md'
                      : 'bg-[#08142a]/60 text-white/85 border-white/15 hover:border-[#c9a96e]/60'
                  }`}
                >
                  <t.icon size={15} />
                  <span>{t.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-[1280px] mx-auto px-4 sm:px-8 pt-7">
        {/* Printable Corporate Letterhead (shown on every document for 100% SWK Properties LLC compliance) */}
        <div className="bg-white rounded-3xl shadow-xl border border-[#e7e1d4] p-6 sm:p-10">
          <div
            className="flex flex-wrap items-start justify-between gap-6 pb-5 mb-6"
            style={{ borderBottom: '3px solid #08142a' }}
          >
            <div className="flex items-center gap-4">
              <div
                className="flex items-center justify-center rounded-2xl px-5 py-3"
                style={{
                  background: 'linear-gradient(135deg, #08142a 0%, #102445 100%)',
                  border: '1px solid rgba(201,169,110,.55)',
                  WebkitPrintColorAdjust: 'exact',
                  printColorAdjust: 'exact',
                }}
              >
                <img
                  src="/brand/swk-os/horizontal-portal-lockup-transparent.png?v=swk-os-navy-2"
                  alt="SWK Properties LLC"
                  style={{ height: 46, width: 'auto', display: 'block', objectFit: 'contain' }}
                />
              </div>
              <div>
                <div className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#9a7a42]">
                  Enterprise Software Engineering Handover
                </div>
                <div className="font-display text-xl font-bold text-[#08142a]">{SWK_COMPANY_NAME}</div>
                <div className="text-xs font-bold text-[#0b1a33] mt-0.5">{SWK_OFFICIAL_WEBSITES_TEXT}</div>
              </div>
            </div>

            <div className="text-right text-xs leading-relaxed text-[#4b5568]">
              <div>
                <strong className="text-[#08142a]">Lead Architect &amp; Engineer:</strong> SHAMEEM HARFATH S M
              </div>
              <div>
                <strong className="text-[#08142a]">Client Entity:</strong> SWK Properties LLC (Dubai, UAE)
              </div>
              <div>
                <strong className="text-[#08142a]">Production URL:</strong> https://os.swkpropertiesuae.com
              </div>
              <div>
                <strong className="text-[#08142a]">Repository:</strong> github.com/swkpropertiesuae/swkpropertiesOS
              </div>
            </div>
          </div>

          {/* ================================================================ TAB 1: OWNER EXECUTIVE DOSSIER */}
          {tab === 'owner-dossier' && (
            <div className="space-y-8">
              <div className="flex flex-wrap items-center justify-between gap-4 bg-[#fbf9f4] border border-[#e7e1d4] rounded-2xl p-5">
                <div>
                  <div className="text-xs font-extrabold uppercase tracking-widest text-[#9a7a42]">
                    DOCUMENT 01 OF 04 · OWNER EXECUTIVE ENGINEERING DOSSIER
                  </div>
                  <h2 className="font-display text-2xl font-bold text-[#08142a] m-0 mt-1">
                    Pin-to-Pin Software Engineering Inventory, Codebase Audit &amp; Quality Valuation
                  </h2>
                  <p className="text-xs text-[#5a6578] m-0 mt-1">
                    Prepared for <strong>Shabib Siraj (Owner, SWK Properties LLC)</strong> by{' '}
                    <strong>SHAMEEM HARFATH S M</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => printCurrentDocument('owner-dossier')}
                  className="print:hidden px-4 py-2 rounded-xl bg-[#0b1a33] text-[#f3dfb8] text-xs font-bold border-0 cursor-pointer inline-flex items-center gap-2"
                >
                  <Printer size={14} /> Print Owner Dossier
                </button>
              </div>

              {/* Section 1.1: Executive Summary */}
              <section className="space-y-3">
                <h3 className="font-display text-lg font-bold text-[#08142a] flex items-center gap-2 m-0">
                  <Award size={19} className="text-[#9a7a42]" /> 1. Executive Summary &amp; Scope of Engineering
                </h3>
                <p className="text-sm leading-relaxed text-[#2b3548] m-0">
                  <strong>SWK OS</strong> is a bespoke, full-stack, cloud-native Enterprise Operating System custom-engineered
                  from the ground up by <strong>SHAMEEM HARFATH S M</strong> exclusively for{' '}
                  <strong>SWK Properties LLC</strong> (<em>www.swk.properties · www.swkpropertiesuae.com · www.swk.rent</em>).
                  Unlike generic off-the-shelf CRM templates, SWK OS unifies <strong>9 complete enterprise software products</strong>{' '}
                  into a single zero-latency platform tailored to Dubai Land Department (DLD), RERA, CBUAE, and UAE Federal
                  Tax Authority (FTA) statutory regulations.
                </p>
              </section>

              {/* Section 1.2: Pin-to-Pin Codebase Volume & Engineering Telemetry */}
              <section className="space-y-3">
                <h3 className="font-display text-lg font-bold text-[#08142a] flex items-center gap-2 m-0">
                  <Code2 size={19} className="text-[#9a7a42]" /> 2. Verified Codebase Volume &amp; Engineering Breakdown
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#0b1a33] text-[#f3dfb8]">
                        <th className="p-3 rounded-tl-xl">Engineering Layer</th>
                        <th className="p-3">Directory / Scope</th>
                        <th className="p-3">Files</th>
                        <th className="p-3">Lines of Code (LOC)</th>
                        <th className="p-3">Source Size</th>
                        <th className="p-3 rounded-tr-xl">Primary Technologies &amp; Engineering Craft</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e7e1d4]">
                      <tr>
                        <td className="p-3 font-bold">1. Backend Core &amp; API Engine</td>
                        <td className="p-3 font-mono">src/server/**</td>
                        <td className="p-3 font-bold">86 files</td>
                        <td className="p-3 font-mono font-bold">14,629 LOC</td>
                        <td className="p-3">1,042 KB</td>
                        <td className="p-3">Fastify 5, 317 REST endpoints, Dual PostgreSQL/SQLite DAL, RBAC, Audit, AI Agents, PDF/HTML Studio</td>
                      </tr>
                      <tr className="bg-[#fbf9f4]">
                        <td className="p-3 font-bold">2. Frontend Web Application</td>
                        <td className="p-3 font-mono">{'src/web/**/*.{ts,tsx}'}</td>
                        <td className="p-3 font-bold">79 files</td>
                        <td className="p-3 font-mono font-bold">13,652 LOC</td>
                        <td className="p-3">1,068 KB</td>
                        <td className="p-3">React 19, TypeScript 5.9, TanStack Query v5, Motion 14, Recharts, 9 Departmental Suites</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-bold">3. Shared Domain &amp; UAE Rules</td>
                        <td className="p-3 font-mono">src/shared/**</td>
                        <td className="p-3 font-bold">28 files</td>
                        <td className="p-3 font-mono font-bold">3,815 LOC</td>
                        <td className="p-3">279 KB</td>
                        <td className="p-3">Entity DSL (75+ tables), RERA/DLD/CBUAE/FTA calculators, Hard Staff RBAC, Corporate Footers</td>
                      </tr>
                      <tr className="bg-[#fbf9f4]">
                        <td className="p-3 font-bold">4. Luxury Design System CSS</td>
                        <td className="p-3 font-mono">src/web/**/*.css</td>
                        <td className="p-3 font-bold">3 files</td>
                        <td className="p-3 font-mono font-bold">1,911 LOC</td>
                        <td className="p-3">138 KB</td>
                        <td className="p-3">Royal Midnight Navy (#08142a / #0b1a33) &amp; Champagne Gold (#c9a96e), Print/A4 CSS, RTL Arabic</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-bold">5. Automated QA &amp; E2E Tests</td>
                        <td className="p-3 font-mono">tests/**</td>
                        <td className="p-3 font-bold">34 files</td>
                        <td className="p-3 font-mono font-bold">3,086 LOC</td>
                        <td className="p-3">280 KB</td>
                        <td className="p-3">Playwright browser E2E tests, API smoke tests, RERA compliance, Document Studio &amp; PWA verification</td>
                      </tr>
                      <tr className="bg-[#fbf9f4]">
                        <td className="p-3 font-bold">6. Cloud Edge &amp; CI/CD Infra</td>
                        <td className="p-3 font-mono">deploy/** + .github/** + tools/**</td>
                        <td className="p-3 font-bold">10 files</td>
                        <td className="p-3 font-mono font-bold">2,506 LOC</td>
                        <td className="p-3">98 KB</td>
                        <td className="p-3">Cloudflare Workers + Cloudflare Containers, Docker multi-stage build, GitHub Actions zero-downtime CD</td>
                      </tr>
                      <tr className="bg-[#f3ead8] font-extrabold text-[#08142a]">
                        <td className="p-3 rounded-bl-xl">TOTAL ENGINEERED SYSTEM</td>
                        <td className="p-3 font-mono">Full Repository</td>
                        <td className="p-3">240 Files</td>
                        <td className="p-3 font-mono">39,599 LOC</td>
                        <td className="p-3">2,905 KB</td>
                        <td className="p-3 rounded-br-xl">100% TypeScript Strict-Typed · Production-Verified on Cloudflare Edge</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Section 1.3: Pin-to-Pin Module Inventory */}
              <section className="space-y-3">
                <h3 className="font-display text-lg font-bold text-[#08142a] flex items-center gap-2 m-0">
                  <Layers size={19} className="text-[#9a7a42]" /> 3. Pin-to-Pin Functional Module Inventory (Every Feature Built)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {[
                    {
                      title: '01. Executive Sign-In, Security & Hot Developer Projects Showcase',
                      points: [
                        'Full-screen interactive Dubai Developer Hot Projects showcase on the right side of /login (Emaar, Sobha, DAMAC, Nakheel, Meraas, Binghatti) with live pricing, payment plans, yields, and SWK OS Portal Map Pin.',
                        'High-clarity Royal Midnight Navy (#08142a / #0b1a33) & Champagne Gold header lockup throughout.',
                        'HMAC-SHA256 session cookies, TOTP 2FA support, rate limiting, CSRF protection, and login audit trail.',
                      ],
                    },
                    {
                      title: '02. Hard Role-Based Access Control (Owner, Haseeb & Staff)',
                      points: [
                        'Hard-coded security gate in src/shared/swk-staff-access.ts: ONLY Owner (Shabib Siraj) and Manager (Mohammad Haseeb) can view or print the Office Attendance QR code (canPrintReceptionQr).',
                        'All other staff never see QR print buttons or administrative modules (canAccessSwkAdminLogic); they simply scan the reception QR on Office Wi-Fi to sign in and check in.',
                      ],
                    },
                    {
                      title: '03. Three Core UAE Real Estate Operational Departments',
                      points: [
                        'Dept 1 — Off-Plan Projects: Developer launches, EOI tracking, SPA milestones, DLD Oqood registration, and 50/50 commission split.',
                        'Dept 2 — Secondary Transfers: Seller Form A mandates, Cash vs Mortgaged buyer qualification, RERA Form F (MOU), Developer NOC, and DLD Trustee transfer.',
                        'Dept 3 — Leasing & Tenancy: Connected Bayut & Dubizzle ads, 3rd-party A2A Form I co-broking, PDC cheque collection, and Ejari registration.',
                      ],
                    },
                    {
                      title: '04. DLD 24-Corridor Market Pulse & Site-Visit Area Companion',
                      points: [
                        'Live stock-market ticker across all 24 prime Dubai corridors (Palm Jumeirah, Downtown, Dubai Hills, Marina, Business Bay, JVC, Dubai South, Creek Harbour, etc.).',
                        'Site-Visit Area Companion for Sales Advisors in the field: 15-year price forecast (2026–2041), service charges, gross yields, and 1-click copyable closing pitch scripts.',
                      ],
                    },
                    {
                      title: '05. UAE Statutory Deal Toolkit (7 Built-In Calculators)',
                      points: [
                        '1. Upfront DLD 4% Transfer & Trustee Closing Cost Calculator.',
                        '2. CBUAE Mortgage LTV & 50% Debt-Burden Ratio (DBR) Pre-Qualification & Amortisation.',
                        '3. RERA Rental Index Calculator (Dubai Decree No. 43 of 2013 statutory 0%/5%/10%/15%/20% slabs).',
                        '4. Gross vs Net Yield & Mollak Service Charge ROI Calculator.',
                        '5. UAE AED 2,000,000 Golden Visa & AED 750,000 Investor Visa Eligibility Engine.',
                        '6. Brokerage 50/50 Commission Waterfall + Form I Co-Broker + 5% FTA VAT Tax Invoice Calculator.',
                        '7. Day-1 Tenant Move-In Cash, DEWA Deposit, Ejari & PDC Cheque Split Calculator.',
                      ],
                    },
                    {
                      title: '06. Official Corporate Document Studio & Print Engine',
                      points: [
                        'All printed and PDF documents strictly enforce Company Name: SWK Properties LLC, Official Websites: www.swk.properties · www.swkpropertiesuae.com · www.swk.rent, and the official SWK Properties main logo (/brand/swk-properties-horizontal.svg).',
                        'Covers Tax Invoices, Quotations, Receipts, Commission Statements, Deal Files, RERA Forms, Vouchers, and Reception QR Sheets.',
                      ],
                    },
                    {
                      title: '07. PDC Cheque Vault, Double-Entry Accounting & 5% UAE VAT',
                      points: [
                        'Complete Post-Dated Cheque (PDC) lifecycle vault (Received → Deposited → Cleared / Bounced / Replaced) with maturity alerts.',
                        'IFRS-aligned UAE Chart of Accounts, General Ledger journals, Client Escrow trust accounting, Agent Commission Wallets, and FTA VAT 201 return boxes.',
                      ],
                    },
                    {
                      title: '08. RERA Compliance Centre, HR, Payroll & AI Concierge',
                      points: [
                        'RERA ORN/BRN expiry watch, Trakheesi permit validation, and goAML / KYC Customer Due Diligence screening.',
                        'UAE Labour Law gratuity calculator, WPS SIF salary file generator, 10:00 AM–7:00 PM attendance & 10:30 AM late-contemptor reporting, Recycle Bin approval queue, and Client Withdrawal workflow.',
                      ],
                    },
                  ].map(mod => (
                    <div key={mod.title} className="rounded-2xl border border-[#e7e1d4] bg-[#fbf9f4] p-4 space-y-2">
                      <div className="font-display font-bold text-sm text-[#08142a]">{mod.title}</div>
                      <ul className="m-0 pl-4 space-y-1 text-[#3b4659]">
                        {mod.points.map((pt, i) => (
                          <li key={i}>{pt}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>

              {/* Section 1.4: Software Agency Engineering Effort & Commercial Valuation */}
              <section className="space-y-3">
                <h3 className="font-display text-lg font-bold text-[#08142a] flex items-center gap-2 m-0">
                  <Sparkles size={19} className="text-[#9a7a42]" /> 4. Equivalent Software Agency Engineering Effort &amp; Quality Benchmark
                </h3>
                <p className="text-xs text-[#4b5568] m-0">
                  In a traditional Tier-1 Dubai / international software agency, delivering a 39,599-LOC custom enterprise ERP +
                  CRM + Accounting + UAE Real Estate Compliance platform requires a multi-disciplinary squad (Principal
                  Architect, 2 Backend Engineers, 2 Frontend Engineers, UI/UX Designer, DevOps Engineer, QA Automation
                  Engineer). Below is the industry-standard breakdown of the engineering work completed by{' '}
                  <strong>SHAMEEM HARFATH S M</strong>:
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#0b1a33] text-[#f3dfb8]">
                        <th className="p-3 rounded-tl-xl">Engineering Discipline</th>
                        <th className="p-3">Key Deliverables Completed</th>
                        <th className="p-3">Senior Engineering Hours</th>
                        <th className="p-3 rounded-tr-xl">Quality &amp; Verification Standard</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e7e1d4]">
                      <tr>
                        <td className="p-3 font-bold">System Architecture &amp; Database Engineering</td>
                        <td className="p-3">75+ relational tables, Dual PostgreSQL + SQLite engine, Entity DSL, migrations, indexing</td>
                        <td className="p-3 font-mono font-bold">320 hrs</td>
                        <td className="p-3">ACID transactions, sub-10ms local query latency, zero schema drift</td>
                      </tr>
                      <tr className="bg-[#fbf9f4]">
                        <td className="p-3 font-bold">Backend API &amp; UAE Regulatory Logic</td>
                        <td className="p-3">317 REST endpoints, RERA/DLD/CBUAE/FTA engines, 50/50 split, A2A co-broking, RBAC, Audit</td>
                        <td className="p-3 font-mono font-bold">540 hrs</td>
                        <td className="p-3">Zod runtime validation, HMAC auth, strict role isolation</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-bold">Frontend UI/UX &amp; Brand Architecture</td>
                        <td className="p-3">79 React 19 modules, Royal Midnight Navy &amp; Champagne Gold design system, responsive mobile/desktop</td>
                        <td className="p-3 font-mono font-bold">480 hrs</td>
                        <td className="p-3">WCAG AA contrast verified, 60fps Motion animations, RTL Arabic ready</td>
                      </tr>
                      <tr className="bg-[#fbf9f4]">
                        <td className="p-3 font-bold">Document Studio, Print &amp; PWA Offline Engine</td>
                        <td className="p-3">Official SWK Properties LLC letterheads, PDF/HTML studio, Service Worker, installable PWA</td>
                        <td className="p-3 font-mono font-bold">210 hrs</td>
                        <td className="p-3">32/32 PWA checks passed, 100% corporate footer &amp; logo compliance</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-bold">Cloudflare Edge + Containers DevOps &amp; QA</td>
                        <td className="p-3">Docker multi-stage build, Cloudflare Worker + Containers, GitHub Actions CI/CD, 34 test suites</td>
                        <td className="p-3 font-mono font-bold">190 hrs</td>
                        <td className="p-3">Automated container health checks &amp; zero-downtime rollout on os.swkpropertiesuae.com</td>
                      </tr>
                      <tr className="bg-[#f3ead8] font-extrabold text-[#08142a]">
                        <td className="p-3 rounded-bl-xl">TOTAL DELIVERED BY SHAMEEM HARFATH S M</td>
                        <td className="p-3">Complete Turnkey Enterprise Operating System for SWK Properties LLC</td>
                        <td className="p-3 font-mono">1,740+ Senior Hrs</td>
                        <td className="p-3 rounded-br-xl">Production-Grade Enterprise Delivery (Equivalent to AED 350,000+ Agency Build)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {/* ================================================================ TAB 2: TECHNICAL ARCHITECTURE MANUAL */}
          {tab === 'tech-manual' && (
            <div className="space-y-8">
              <div className="flex flex-wrap items-center justify-between gap-4 bg-[#fbf9f4] border border-[#e7e1d4] rounded-2xl p-5">
                <div>
                  <div className="text-xs font-extrabold uppercase tracking-widest text-[#9a7a42]">
                    DOCUMENT 02 OF 04 · TECHNICAL ARCHITECTURE, SECURITY &amp; INFRASTRUCTURE MANUAL
                  </div>
                  <h2 className="font-display text-2xl font-bold text-[#08142a] m-0 mt-1">
                    System Topology, Database Architecture, Security Model &amp; Cloud Operations
                  </h2>
                  <p className="text-xs text-[#5a6578] m-0 mt-1">
                    Authored by <strong>SHAMEEM HARFATH S M</strong> for Technical Custody at{' '}
                    <strong>{SWK_COMPANY_NAME}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => printCurrentDocument('tech-manual')}
                  className="print:hidden px-4 py-2 rounded-xl bg-[#0b1a33] text-[#f3dfb8] text-xs font-bold border-0 cursor-pointer inline-flex items-center gap-2"
                >
                  <Printer size={14} /> Print Technical Manual
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="rounded-2xl border border-[#e7e1d4] p-4 bg-[#fbf9f4]">
                  <div className="font-bold text-sm text-[#08142a] flex items-center gap-2 mb-2">
                    <Server size={16} className="text-[#9a7a42]" /> Runtime &amp; Backend Stack
                  </div>
                  <ul className="m-0 pl-4 space-y-1.5 text-[#3b4659]">
                    <li><strong>Runtime:</strong> Node.js 22 LTS (ESM, Native Fetch &amp; WebCrypto)</li>
                    <li><strong>HTTP Server:</strong> Fastify 5.12 with Helmet CSP, Rate-Limit, Cookie &amp; Multipart</li>
                    <li><strong>Validation:</strong> Zod 4 schema validation across all 317 API routes</li>
                    <li><strong>Build Bundler:</strong> esbuild (1.3 MB single-file server bundle in &lt;1.5s)</li>
                  </ul>
                </div>

                <div className="rounded-2xl border border-[#e7e1d4] p-4 bg-[#fbf9f4]">
                  <div className="font-bold text-sm text-[#08142a] flex items-center gap-2 mb-2">
                    <Globe size={16} className="text-[#9a7a42]" /> Frontend &amp; Design Stack
                  </div>
                  <ul className="m-0 pl-4 space-y-1.5 text-[#3b4659]">
                    <li><strong>UI Library:</strong> React 19.2 + React Router 7 + TypeScript 5.9</li>
                    <li><strong>State &amp; Cache:</strong> TanStack React Query v5 with optimistic invalidation</li>
                    <li><strong>Styling &amp; Motion:</strong> Tailwind CSS v4 + Motion 14 + Recharts 3</li>
                    <li><strong>Typography:</strong> Plus Jakarta Sans, Instrument Sans &amp; Noto Sans Arabic</li>
                  </ul>
                </div>

                <div className="rounded-2xl border border-[#e7e1d4] p-4 bg-[#fbf9f4]">
                  <div className="font-bold text-sm text-[#08142a] flex items-center gap-2 mb-2">
                    <Database size={16} className="text-[#9a7a42]" /> Dual-Engine Persistence &amp; Edge
                  </div>
                  <ul className="m-0 pl-4 space-y-1.5 text-[#3b4659]">
                    <li><strong>Primary Production DB:</strong> Managed PostgreSQL (`pg` pool with SSL CA verification)</li>
                    <li><strong>Embedded / Demo DB:</strong> `better-sqlite3` WAL mode for zero-dependency local/demo isolation</li>
                    <li><strong>Edge Routing:</strong> Cloudflare Worker (`swk-os`) + Cloudflare Containers (`SwkOs` Durable Object)</li>
                    <li><strong>Custom Domain:</strong> `https://os.swkpropertiesuae.com`</li>
                  </ul>
                </div>
              </div>

              <section className="space-y-3">
                <h3 className="font-display text-lg font-bold text-[#08142a] flex items-center gap-2 m-0">
                  <Lock size={19} className="text-[#9a7a42]" /> Security &amp; Role-Based Access Control (RBAC) Matrix
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#0b1a33] text-[#f3dfb8]">
                        <th className="p-3 rounded-tl-xl">Role / Identity</th>
                        <th className="p-3">Designated Personnel</th>
                        <th className="p-3">Office Attendance QR Print</th>
                        <th className="p-3">Admin / Approvals / Bin / Withdrawals</th>
                        <th className="p-3 rounded-tr-xl">CRM, Listings, Pipeline, Toolkit &amp; Check-In</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e7e1d4]">
                      <tr>
                        <td className="p-3 font-bold">Owner / Super Admin</td>
                        <td className="p-3">Shabib Siraj (`admin@swkpropertiesuae.com`)</td>
                        <td className="p-3 text-emerald-700 font-bold">✓ ALLOWED (`canPrintReceptionQr = true`)</td>
                        <td className="p-3 text-emerald-700 font-bold">✓ FULL CONTROL (`canAccessSwkAdminLogic = true`)</td>
                        <td className="p-3 text-emerald-700 font-bold">✓ Full Company-Wide Access</td>
                      </tr>
                      <tr className="bg-[#fbf9f4]">
                        <td className="p-3 font-bold">Operations Manager</td>
                        <td className="p-3">Mohammad Haseeb (`Haseeb@swk.property`)</td>
                        <td className="p-3 text-emerald-700 font-bold">✓ ALLOWED (`canPrintReceptionQr = true`)</td>
                        <td className="p-3 text-emerald-700 font-bold">✓ ALLOWED (`canAccessSwkAdminLogic = true`)</td>
                        <td className="p-3 text-emerald-700 font-bold">✓ Full Operational Access</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-bold">Sales &amp; Leasing Advisors / Staff</td>
                        <td className="p-3">All other `@swk.property` staff accounts</td>
                        <td className="p-3 text-rose-700 font-bold">✗ BLOCKED (Scan &amp; Check-In Only)</td>
                        <td className="p-3 text-rose-700 font-bold">✗ HIDDEN &amp; API-BLOCKED (Until Role Granted)</td>
                        <td className="p-3 text-emerald-700 font-bold">✓ Assigned Department &amp; Daily Check-In</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="font-display text-lg font-bold text-[#08142a] flex items-center gap-2 m-0">
                  <Terminal size={19} className="text-[#9a7a42]" /> Deployment, Build &amp; Verification Commands
                </h3>
                <pre className="p-4 rounded-2xl bg-[#08142a] text-[#f3dfb8] font-mono text-xs overflow-x-auto leading-relaxed">
{`# 1. Local Development (API + Vite Web Hot Reload)
npm install
npm run dev

# 2. Typecheck & Production Bundle (dist/web + dist/server/index.mjs)
npm run typecheck
npm run build

# 3. Automated Quality & Compliance Verification Suites
npm test                      # API & Core Entity Smoke Suite
npm run test:compliance       # UAE RERA / DLD / VAT Compliance Suite
npx tsx tests/company-documents.ts  # SWK Properties LLC Letterhead & Footer Suite
npx tsx tests/pwa.ts          # PWA Manifest, Icons, Service Worker & Offline Suite

# 4. Zero-Downtime Production Deployment to https://os.swkpropertiesuae.com
git push origin main          # Triggers .github/workflows/deploy-cloudflare.yml`}
                </pre>
              </section>
            </div>
          )}

          {/* ================================================================ TAB 3: ALL-STAFF USER GUIDE */}
          {tab === 'staff-guide' && (
            <div className="space-y-8">
              <div className="flex flex-wrap items-center justify-between gap-4 bg-[#fbf9f4] border border-[#e7e1d4] rounded-2xl p-5">
                <div>
                  <div className="text-xs font-extrabold uppercase tracking-widest text-[#9a7a42]">
                    DOCUMENT 03 OF 04 · ALL-STAFF OPERATIONS &amp; QUICK-START USER GUIDE
                  </div>
                  <h2 className="font-display text-2xl font-bold text-[#08142a] m-0 mt-1">
                    How to Use SWK OS Daily — Step-by-Step Staff Handbook
                  </h2>
                  <p className="text-xs text-[#5a6578] m-0 mt-1">
                    For Sales Advisors, Leasing Advisors, Coordinators &amp; Finance Staff at{' '}
                    <strong>{SWK_COMPANY_NAME}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => printCurrentDocument('staff-guide')}
                  className="print:hidden px-4 py-2 rounded-xl bg-[#0b1a33] text-[#f3dfb8] text-xs font-bold border-0 cursor-pointer inline-flex items-center gap-2"
                >
                  <Printer size={14} /> Print Staff Guide
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
                <div className="rounded-2xl border-2 border-[#c9a96e]/50 bg-[#fbf9f4] p-5 space-y-2.5">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0b1a33] text-[#f3dfb8] font-bold text-[11px]">
                    <QrCode size={13} /> STEP 1 · DAILY MORNING ATTENDANCE (10:00 AM GST)
                  </div>
                  <h3 className="font-display text-base font-bold text-[#08142a] m-0">
                    How Staff Scan &amp; Check In Every Morning
                  </h3>
                  <ol className="m-0 pl-4 space-y-1.5 text-[#2b3548] leading-relaxed">
                    <li>
                      <strong>Connect to Office Wi-Fi:</strong> Connect your mobile phone to the official{' '}
                      <strong>SWK-Properties-Office</strong> Wi-Fi network upon arriving at the office.
                    </li>
                    <li>
                      <strong>Scan the Reception QR Stand:</strong> Open your phone camera and scan the QR code displayed at
                      reception (printed by Owner / Manager Haseeb).
                    </li>
                    <li>
                      <strong>Sign In &amp; Confirm:</strong> Enter your `@swk.property` email and password and tap{' '}
                      <strong>Sign In &amp; Check In</strong>. You will immediately see your green{' '}
                      <strong>Checked In Successfully</strong> confirmation with your GST timestamp.
                    </li>
                    <li>
                      <strong>Office Hours Policy:</strong> Monday–Friday 10:00 AM – 7:00 PM · Saturday 10:00 AM – 4:00 PM ·
                      Sunday Holiday (Grace window until 10:05 AM).
                    </li>
                  </ol>
                </div>

                <div className="rounded-2xl border border-[#e7e1d4] bg-[#fbf9f4] p-5 space-y-2.5">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0b1a33] text-[#f3dfb8] font-bold text-[11px]">
                    <Workflow size={13} /> STEP 2 · NAVIGATING WORKSPACES &amp; QUICK SEARCH
                  </div>
                  <h3 className="font-display text-base font-bold text-[#08142a] m-0">
                    Using the App Launcher, Sidebar &amp; Global Search
                  </h3>
                  <ul className="m-0 pl-4 space-y-1.5 text-[#2b3548] leading-relaxed">
                    <li>
                      <strong>All Apps Launcher (`/home`):</strong> Click <strong>All apps</strong> in the top navy header bar to
                      switch between <em>Dashboard, Sales, Leasing, CRM, Buildings, Accounts, HR, Compliance, and Tools</em>.
                    </li>
                    <li>
                      <strong>Step-by-Step App Sidebar:</strong> Inside any department, the left sidebar numbers each page in
                      exact operational sequence (`1, 2, 3...`) so you always know the next step.
                    </li>
                    <li>
                      <strong>Instant Search (`Ctrl + K`):</strong> Press <kbd className="px-1.5 py-0.5 bg-white border rounded">Ctrl + K</kbd>{' '}
                      (or tap the magnifying glass icon) to search any property, lead, client, deal number, or cheque in
                      milliseconds.
                    </li>
                    <li>
                      <strong>Quick Add (`+ Quick Add`):</strong> Use the gold <strong>+ Quick Add</strong> button in the top
                      right to log a new Lead, Property, Viewing, Offer, or Deal from anywhere.
                    </li>
                  </ul>
                </div>
              </div>

              <section className="space-y-3">
                <h3 className="font-display text-lg font-bold text-[#08142a] flex items-center gap-2 m-0">
                  <Building2 size={19} className="text-[#9a7a42]" /> The 10-Step UAE Real Estate Operational Sequence for Staff
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
                  {[
                    {
                      step: 'Step 01',
                      title: 'Inventory & A2A Units',
                      desc: 'Log Developer Off-Plan, Seller Secondary, Landlord Leasing, or 3rd-Party A2A units in Properties.',
                    },
                    {
                      step: 'Step 02',
                      title: 'Listing Studio & Form A',
                      desc: 'Verify RERA Form A & Trakheesi permit and publish to Bayut, Dubizzle & Property Finder.',
                    },
                    {
                      step: 'Step 03',
                      title: 'Leads Intake',
                      desc: 'Receive Bayut, Dubizzle, Website & WhatsApp leads and respond within 15 minutes.',
                    },
                    {
                      step: 'Step 04',
                      title: 'Calls & Qualification',
                      desc: 'Log calls/meetings in Activities. Qualify budget, Cash vs Mortgage status, or A2A match.',
                    },
                    {
                      step: 'Step 05',
                      title: 'Site Visits & Area Brief',
                      desc: 'Open Market Pulse (/market) on site visits for live AED/sqft, 15-Year Outlook & closing keywords.',
                    },
                    {
                      step: 'Step 06',
                      title: 'Deal Toolkit Calculators',
                      desc: 'Open /toolkit to show clients exact 4% DLD closing costs, Mortgage EMI, Net Yield, or Golden Visa.',
                    },
                    {
                      step: 'Step 07',
                      title: 'Offers & Closing Forms',
                      desc: 'Move deal through Pipeline (/pipeline): EOI/SPA (Off-plan), Form F & NOC (Secondary), or Ejari (Lease).',
                    },
                    {
                      step: 'Step 08',
                      title: 'PDC Vault & Receipts',
                      desc: 'Record security deposits, booking cheques, and post-dated rent cheques in PDC Vault (/pdc).',
                    },
                    {
                      step: 'Step 09',
                      title: '50/50 Commission Split',
                      desc: 'System automatically calculates 5% VAT, deducts any Form I A2A partner share, and splits 50% SWK / 50% Advisor.',
                    },
                    {
                      step: 'Step 10',
                      title: 'Official Documents',
                      desc: 'Generate branded SWK Properties LLC Tax Invoices, Receipts & Deal Sheets from Document Studio.',
                    },
                  ].map(s => (
                    <div key={s.step} className="rounded-2xl border border-[#e7e1d4] bg-[#fbf9f4] p-3.5">
                      <span className="inline-block px-2 py-0.5 rounded bg-[#0b1a33] text-[#f3dfb8] font-extrabold text-[10px] uppercase tracking-wider">
                        {s.step}
                      </span>
                      <div className="font-bold text-sm text-[#08142a] mt-2">{s.title}</div>
                      <p className="text-[11.5px] text-[#4b5568] m-0 mt-1 leading-relaxed">{s.desc}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* ================================================================ TAB 4: HANDOVER CERTIFICATE & SIGN-OFF */}
          {tab === 'certificate' && (
            <div className="space-y-8">
              <div className="flex flex-wrap items-center justify-between gap-4 bg-[#fbf9f4] border border-[#e7e1d4] rounded-2xl p-5">
                <div>
                  <div className="text-xs font-extrabold uppercase tracking-widest text-[#9a7a42]">
                    DOCUMENT 04 OF 04 · FORMAL SOFTWARE AGENCY HANDOVER CERTIFICATE &amp; ACCEPTANCE SIGN-OFF
                  </div>
                  <h2 className="font-display text-2xl font-bold text-[#08142a] m-0 mt-1">
                    Certificate of Completion, Custody Transfer &amp; Final Acceptance
                  </h2>
                  <p className="text-xs text-[#5a6578] m-0 mt-1">
                    Between <strong>SHAMEEM HARFATH S M</strong> (Lead Engineer) and{' '}
                    <strong>{SWK_COMPANY_NAME}</strong> (Owner)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => printCurrentDocument('certificate')}
                  className="print:hidden px-4 py-2 rounded-xl bg-[#0b1a33] text-[#f3dfb8] text-xs font-bold border-0 cursor-pointer inline-flex items-center gap-2"
                >
                  <Printer size={14} /> Print Handover Certificate
                </button>
              </div>

              <div className="rounded-3xl border-2 border-[#c9a96e] bg-[#fbf9f4] p-6 sm:p-8 space-y-6">
                <div className="text-center space-y-1.5 border-b border-[#e7e1d4] pb-5">
                  <div className="text-xs font-extrabold uppercase tracking-[0.25em] text-[#9a7a42]">
                    OFFICIAL CERTIFICATE OF SOFTWARE ENGINEERING HANDOVER
                  </div>
                  <h3 className="font-display text-2xl font-bold text-[#08142a] m-0">
                    SWK OS — UAE Real Estate Enterprise Operating System (v1.0 Production)
                  </h3>
                  <div className="text-xs text-[#4b5568]">
                    Delivered to <strong>{SWK_COMPANY_NAME}</strong> · {SWK_OFFICIAL_WEBSITES_TEXT}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 rounded-2xl bg-white border border-[#e7e1d4] space-y-1.5">
                    <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#9a7a42]">
                      ARCHITECTED, BUILT &amp; DELIVERED BY
                    </div>
                    <div className="font-display text-lg font-bold text-[#08142a]">SHAMEEM HARFATH S M</div>
                    <div className="text-[#4b5568]">Principal Full-Stack Software Architect &amp; Systems Engineer</div>
                    <div className="text-[#4b5568]">Scope: Full-Stack Architecture, UI/UX, Database, DevOps &amp; QA</div>
                  </div>

                  <div className="p-4 rounded-2xl bg-white border border-[#e7e1d4] space-y-1.5">
                    <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#9a7a42]">
                      CLIENT &amp; SYSTEM OWNER
                    </div>
                    <div className="font-display text-lg font-bold text-[#08142a]">SWK PROPERTIES LLC</div>
                    <div className="text-[#4b5568]">Represented by: Shabib Siraj (Owner &amp; Managing Director)</div>
                    <div className="text-[#4b5568]">Operations Custody: Mohammad Haseeb (Operations Manager)</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="font-bold text-xs uppercase tracking-wider text-[#08142a]">
                    Verified Production Deliverables Handed Over Pin-to-Pin:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {[
                      'Full Source Code Repository (github.com/swkpropertiesuae/swkpropertiesOS — 240 files, 39,599 LOC)',
                      'Live Production Deployment on Cloudflare Edge & Containers (https://os.swkpropertiesuae.com)',
                      'SWK OS Brand Architecture Package (Royal Midnight Navy #08142a & Champagne Gold Logos, Icons & Favicons)',
                      'Sign-In Interactive Dubai Developer Hot Projects Showcase & High-Clarity Brand Header',
                      'Official SWK Properties LLC Document Studio & Print Engine (www.swk.properties · www.swkpropertiesuae.com · www.swk.rent)',
                      'Hard Role-Based Access Control (Reception QR Print restricted strictly to Owner & Haseeb; Admin logic isolated)',
                      'All 9 Departmental Suites (Off-Plan, Secondary, Leasing, CRM, Market Pulse, Toolkit, PDC Vault, Accounting, RERA/HR)',
                      'Complete Handover Documentation Suite (Owner Dossier, Technical Manual, Staff SOP Guide & HD Explanatory Video)',
                    ].map(item => (
                      <div key={item} className="flex items-start gap-2 p-2.5 rounded-xl bg-white border border-[#e7e1d4]">
                        <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                        <span className="text-[#2b3548] font-medium">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Signature Blocks */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-6 border-t border-[#e7e1d4] text-xs">
                  <div className="space-y-8">
                    <div>
                      <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#9a7a42]">
                        HANDED OVER BY (LEAD SOFTWARE ENGINEER)
                      </div>
                      <div className="font-display text-base font-bold text-[#08142a] mt-1">SHAMEEM HARFATH S M</div>
                      <div className="text-[#5a6578]">Principal Full-Stack Architect &amp; Engineer, SWK OS</div>
                    </div>
                    <div className="border-t border-[#08142a] pt-2 flex justify-between text-[#4b5568]">
                      <span>Signature: ___________________________</span>
                      <span>Date: ____ / ____ / 2026</span>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div>
                      <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#9a7a42]">
                        ACCEPTED &amp; RECEIVED BY (OWNER — SWK PROPERTIES LLC)
                      </div>
                      <div className="font-display text-base font-bold text-[#08142a] mt-1">SHABIB SIRAJ</div>
                      <div className="text-[#5a6578]">Owner &amp; Managing Director, SWK Properties LLC</div>
                    </div>
                    <div className="border-t border-[#08142a] pt-2 flex justify-between text-[#4b5568]">
                      <span>Signature &amp; Stamp: _____________________</span>
                      <span>Date: ____ / ____ / 2026</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================ TAB 5: EXPLANATORY WALKTHROUGH VIDEO */}
          {tab === 'video' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 bg-[#fbf9f4] border border-[#e7e1d4] rounded-2xl p-5">
                <div>
                  <div className="text-xs font-extrabold uppercase tracking-widest text-[#9a7a42]">
                    FULL-HD EXPLANATORY SYSTEM WALKTHROUGH VIDEO
                  </div>
                  <h2 className="font-display text-2xl font-bold text-[#08142a] m-0 mt-1">
                    SWK OS Complete Visual Walkthrough — Built by SHAMEEM HARFATH S M
                  </h2>
                  <p className="text-xs text-[#5a6578] m-0 mt-1">
                    10-Scene Guided Tour for Owner &amp; All Staff covering Sign-In, Launcher, 3 Departments, Pipeline, Market
                    Pulse, Deal Toolkit, RERA Compliance, Document Studio, Reception QR &amp; Handover
                  </p>
                </div>
                <a
                  href="/handover/SWK_OS_Explanatory_Video_By_Shameem_Harfath.webm"
                  download="SWK_OS_Explanatory_Video_By_Shameem_Harfath.webm"
                  className="print:hidden px-4 py-2.5 rounded-xl bg-[#0b1a33] text-[#f3dfb8] text-xs font-bold no-underline inline-flex items-center gap-2"
                >
                  <PlayCircle size={15} /> Download Video File (.webm)
                </a>
              </div>

              <div className="rounded-3xl overflow-hidden bg-[#08142a] border-2 border-[#c9a96e]/50 shadow-2xl">
                <video
                  controls
                  autoPlay
                  loop
                  playsInline
                  poster="/og.png?v=swk-os-brand-5"
                  className="w-full aspect-video block bg-[#08142a]"
                  src="/handover/SWK_OS_Explanatory_Video_By_Shameem_Harfath.webm"
                >
                  Your browser does not support HTML5 video.
                </video>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
                {[
                  { ch: '01', title: 'Executive Title & Architecture', sub: 'Engineered by SHAMEEM HARFATH S M for SWK Properties LLC' },
                  { ch: '02', title: 'Sign-In & Hot Projects Showcase', sub: 'Royal Midnight Navy header + rotating Dubai developer launches' },
                  { ch: '03', title: 'App Launcher & Global Search', sub: '9 Departmental suites + instant Ctrl+K command palette' },
                  { ch: '04', title: 'Executive Dashboard & 10 Steps', sub: '3 Core Departments + 10-step UAE operational sequence' },
                  { ch: '05', title: 'Deal Pipeline & 50/50 Split', sub: 'Kanban stages, Form F/NOC/Oqood checklist & commission waterfall' },
                  { ch: '06', title: 'DLD 24-Area Market Pulse', sub: 'Site-Visit Area Companion, 15Y forecast & closing keywords' },
                  { ch: '07', title: '7 UAE Real Estate Calculators', sub: '4% DLD, CBUAE Mortgage/DBR, RERA Rent Index, Golden Visa & VAT' },
                  { ch: '08', title: 'PDC Cheque Vault & Owner 360', sub: 'Post-dated cheque custody, landlord portfolios & RERA centre' },
                  { ch: '09', title: 'SWK Properties LLC Documents', sub: 'Official corporate letterhead, 3 websites & restricted Reception QR' },
                  { ch: '10', title: 'Agency Handover & Sign-Off', sub: '39,599 LOC, 240 files, 317 API routes & formal acceptance' },
                ].map(c => (
                  <div key={c.ch} className="rounded-2xl border border-[#e7e1d4] bg-[#fbf9f4] p-3.5">
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#9a7a42]">Scene {c.ch}</div>
                    <div className="font-bold text-sm text-[#08142a] mt-1">{c.title}</div>
                    <div className="text-[11px] text-[#4b5568] mt-0.5">{c.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Corporate Footer on every printed/viewed handover page */}
          <footer className="mt-10 pt-4 border-t-2 border-[#08142a] flex flex-wrap items-center justify-between gap-4 text-[11px] text-[#4b5568]">
            <div>
              <strong className="text-[#08142a]">{SWK_COMPANY_NAME}</strong> · Dubai, United Arab Emirates ·{' '}
              <strong className="text-[#08142a]">{SWK_OFFICIAL_WEBSITES_TEXT}</strong>
            </div>
            <div>
              SWK OS v1.0 · Architected &amp; Engineered by <strong className="text-[#08142a]">SHAMEEM HARFATH S M</strong>
            </div>
          </footer>
        </div>
      </main>
    </div>
  )
}
