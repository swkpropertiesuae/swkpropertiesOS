import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import {
  ArrowRight, ArrowUpRight, Building2, Calculator, Clock3, KeyRound, LayoutDashboard,
  LineChart, QrCode, Rocket, Scale, Search, ShieldCheck, Smartphone, Trash2, X,
} from 'lucide-react'
import { useMeta } from '../lib/meta'
import { launcherApps, recentItems } from '../swk/nav'

const ease = [0.16, 1, 0.3, 1] as const

function dubaiHour() { return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dubai', hour: '2-digit', hour12: false }).format(new Date())) }
function greeting() { const h = dubaiHour(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening' }
const today = () => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dubai', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())

const CORE_DEPARTMENTS = [
  {
    no: 'DEPT 01',
    title: 'Sales of Off-Plan Projects',
    subtitle: 'Developer Launches · EOI · SPA · Oqood · Escrow · 50–50% Split',
    tone: 'navy',
    icon: Rocket,
    primaryTo: '/pipeline?dept=offplan',
    steps: [
      { step: 'Step 1', label: 'Developer Inventory & Launches', to: '/offplan' },
      { step: 'Step 2', label: 'Promote on Portals & Campaigns', to: '/listings' },
      { step: 'Step 3', label: 'Platform Leads Intake', to: '/e/leads' },
      { step: 'Step 4', label: 'Calls, Meetings & Follow-Ups', to: '/e/activities' },
      { step: 'Step 5', label: 'Site Visit + 15Y Area Companion', to: '/market' },
      { step: 'Step 6', label: 'EOI, SPA & Oqood Registration', to: '/e/dld_filings' },
      { step: 'Step 7', label: 'Legal UAE Payment (Escrow / Bank / Exchange / USDT)', to: '/e/receipts' },
      { step: 'Step 8', label: '50–50% Commission Split or Withdrawal Refund', to: '/e/agent_commissions' },
    ],
    actions: [
      { label: 'Open Off-Plan Pipeline', to: '/pipeline?dept=offplan', primary: true },
      { label: 'Off-Plan Launches', to: '/offplan' },
      { label: '+ Add Off-Plan Unit', to: '/e/properties?new=1' },
      { label: 'Deal Withdrawals', to: '/withdrawals' },
    ],
  },
  {
    no: 'DEPT 02',
    title: 'Secondary Projects (Ready Resale)',
    subtitle: 'Seller / 3rd-Party A2A · Cash / Mortgaged / Pre-Approved · Form F · NOC · DLD Transfer',
    tone: 'champ',
    icon: Building2,
    primaryTo: '/pipeline?dept=secondary',
    steps: [
      { step: 'Step 1', label: 'Seller or 3rd-Party A2A Inventory', to: '/e/properties' },
      { step: 'Step 2', label: 'Detailed Seller Requirement & Form A', to: '/e/mandates' },
      { step: 'Step 3', label: 'Promote on Bayut & Dubizzle', to: '/listings' },
      { step: 'Step 4', label: 'Buyer Leads, Calls & Site Visits', to: '/e/viewings' },
      { step: 'Step 5', label: 'Cash / Mortgaged / Pre-Approved Check', to: '/toolkit' },
      { step: 'Step 6', label: 'RERA Form F (MOU) Signing', to: '/e/sales_contracts' },
      { step: 'Step 7', label: 'Developer NOC & DLD Trustee Transfer', to: '/e/developer_requests' },
      { step: 'Step 8', label: 'Handover & 50/50 Split + 3rd-Party A2A Share', to: '/e/agent_commissions' },
    ],
    actions: [
      { label: 'Open Secondary Pipeline', to: '/pipeline?dept=secondary', primary: true },
      { label: 'Seller Mandates (Form A)', to: '/e/mandates' },
      { label: 'Form F Contracts', to: '/e/sales_contracts' },
      { label: 'Mortgage Calculator', to: '/toolkit' },
    ],
  },
  {
    no: 'DEPT 03',
    title: 'Leasing Department (Residential & Commercial)',
    subtitle: 'Connected Bayut & Dubizzle Ads · Missing-Unit 3rd-Party A2A Search · Ejari · PDCs',
    tone: 'oasis',
    icon: KeyRound,
    primaryTo: '/pipeline?dept=leasing',
    steps: [
      { step: 'Step 1', label: 'Landlord Inventory or 3rd-Party A2A Search', to: '/e/properties' },
      { step: 'Step 2', label: 'Connected Bayut & Dubizzle Ad Studio', to: '/listings' },
      { step: 'Step 3', label: 'Tenant Leads & Qualification', to: '/e/leads' },
      { step: 'Step 4', label: 'Scheduled Property Viewings (Live GPS)', to: '/e/viewings' },
      { step: 'Step 5', label: 'Tenancy Offer & Ejari Registration', to: '/e/leases' },
      { step: 'Step 6', label: 'PDC Cheque Vault & Security Deposit', to: '/pdc' },
      { step: 'Step 7', label: 'Move-In Inspection & Key Handover', to: '/e/handovers' },
      { step: 'Step 8', label: '50–50% Leasing Split + 3rd-Party A2A Share', to: '/e/agent_commissions' },
    ],
    actions: [
      { label: 'Open Leasing Pipeline', to: '/pipeline?dept=leasing', primary: true },
      { label: 'Bayut & Dubizzle Ads', to: '/listings' },
      { label: 'Leases & Ejari', to: '/e/leases' },
      { label: 'PDC Cheque Vault', to: '/pdc' },
    ],
  },
] as const

const DEDICATED_QUICK_BUTTONS = [
  { step: 'CMD 01', label: 'Executive Dashboard', sub: '3 Departments, Briefings & KPIs', to: '/dashboard', icon: LayoutDashboard, tone: 'navy' },
  { step: 'CMD 02', label: 'SWK ONE Attendance App', sub: 'QR / Live GPS & Daily Report Gate', to: '/swk-one', icon: Smartphone, tone: 'oasis' },
  { step: 'CMD 03', label: 'Reception QR Terminal', sub: '10:00 AM Shift Rotating QR Display', to: '/reception-qr', icon: QrCode, tone: 'ocean' },
  { step: 'CMD 04', label: 'Market Pulse & Area Companion', sub: '24 Areas, Daily DLD & 15Y Pitch', to: '/market', icon: LineChart, tone: 'champ' },
  { step: 'CMD 05', label: 'UAE Mortgage & Deal Calculator', sub: 'Bank Rates, DLD 4% & 50/50 Split', to: '/toolkit', icon: Calculator, tone: 'navy' },
  { step: 'CMD 06', label: 'Deal Withdrawals & Refunds', sub: 'Terms-Based Client Refund Engine', to: '/withdrawals', icon: Scale, tone: 'dune' },
  { step: 'CMD 07', label: 'Pending Delete Bin & Approvals', sub: 'Awaiting Owner Shabib Siraj Sign-Off', to: '/recycle-bin', icon: Trash2, tone: 'dune' },
] as const

/**
 * Full-width, step-by-step UAE Real Estate Operating System Launcher.
 * Displays dedicated, separate, detailed buttons for every department, stage, and operational page.
 */
export function Launcher() {
  const { me, can } = useMeta()
  const nav = useNavigate()
  const reduce = useReducedMotion()
  const [query, setQuery] = useState('')
  const [activeStageKey, setActiveStageKey] = useState<string>('all')
  const apps = useMemo(() => launcherApps(can), [can])
  const recents = useMemo(() => recentItems(can, 6), [can])
  const needle = query.trim().toLocaleLowerCase()
  const shownApps = apps.filter(a => !needle || a.label.toLocaleLowerCase().includes(needle) || a.blurb.toLocaleLowerCase().includes(needle) || a.items.some(i => i.label.toLocaleLowerCase().includes(needle) || (i.desc ?? '').toLocaleLowerCase().includes(needle)))
  const features = needle ? apps.flatMap(a => a.items.map(i => ({ ...i, app: a.label }))).filter(i => i.label.toLocaleLowerCase().includes(needle) || (i.desc ?? '').toLocaleLowerCase().includes(needle)) : []
  const firstName = (me?.name || '').split(' ')[0]

  const openFirst = () => {
    const target = features[0]?.to ?? shownApps[0]?.landing
    if (target) nav(target)
  }
  const container = { hidden: {}, show: { transition: { staggerChildren: reduce ? 0 : 0.03, delayChildren: 0.03 } } }
  const rise = { hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease } } }

  const visibleStageBlocks = activeStageKey === 'all' ? shownApps : shownApps.filter(a => a.key === activeStageKey)

  return (
    <div className="swk-launch">
      {/* 1. HERO & SEARCH */}
      <motion.header className="swk-launch-hero" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease }}>
        <div className="swk-eyebrow">SWK Properties L.L.C · RERA ORN 51517 · Dubai · {today()}</div>
        <h1>{greeting()}{firstName ? `, ${firstName}` : ''}.</h1>
        <p className="swk-launch-sub">
          Complete UAE Real Estate Operating System — choose any department or step-by-step button below to execute operations directly.
        </p>
        <form className="swk-launch-search" role="search" onSubmit={e => { e.preventDefault(); openFirst() }}>
          <Search size={18} aria-hidden />
          <input type="text" inputMode="search" enterKeyHint="search" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') setQuery('') }}
            placeholder="Search any step, department, form, or page (e.g. Form F, Lease, Bayut, Attendance, Bin)…" aria-label="Search apps and features" autoFocus autoComplete="off" />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><X size={16} /></button>}
        </form>
      </motion.header>

      {/* RECENTLY OPENED */}
      {!needle && recents.length > 0 && (
        <motion.section className="swk-launch-recent" aria-label="Recently opened" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1, duration: 0.35 }}>
          <span className="lbl"><Clock3 size={14} />Recent</span>
          {recents.map(r => <Link key={r.to} to={r.to} className="swk-launch-chip"><r.icon size={15} />{r.label}</Link>)}
        </motion.section>
      )}

      {/* SEARCH RESULTS */}
      {features.length > 0 && (
        <section aria-label="Matching features" className="swk-launch-results">
          <h2>Matching Step-by-Step Pages ({features.length})</h2>
          <ul>
            {features.map(f => (
              <li key={f.to}><Link to={f.to}><span className="ic"><f.icon size={18} /></span><span className="tx"><b>{f.label}</b><small>{f.desc ?? f.app}</small></span><span className="app">{f.app}</span><ArrowUpRight size={16} className="go" /></Link></li>
            ))}
          </ul>
        </section>
      )}

      {/* 2. DEDICATED EXECUTIVE & FIELD COMMAND BUTTONS */}
      {!needle && (
        <section className="swk-step-hub-section" aria-label="Dedicated Command Buttons">
          <div className="swk-step-hub-head">
            <div>
              <span className="swk-step-badge">DIRECT COMMAND</span>
              <h2>Dedicated Operational & Governance Buttons</h2>
            </div>
            <span className="text-xs text-muted"> Shift: Mon–Fri 10:00 AM–7:00 PM · Sat 10:00 AM–4:00 PM · Sun Holiday · 10:05 AM Grace · 50–50% Split</span>
          </div>
          <div className="swk-cmd-btn-grid">
            {DEDICATED_QUICK_BUTTONS.map(btn => (
              <Link key={btn.to} to={btn.to} className={`swk-cmd-btn tone-${btn.tone}`}>
                <div className="swk-cmd-btn-top">
                  <span className="swk-cmd-btn-ic"><btn.icon size={20} /></span>
                  <span className="swk-cmd-btn-tag">{btn.step}</span>
                </div>
                <div className="swk-cmd-btn-title">{btn.label}</div>
                <div className="swk-cmd-btn-sub">{btn.sub}</div>
                <div className="swk-cmd-btn-cta">Open Dedicated View <ArrowRight size={13} /></div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 3. THREE CORE DEPARTMENTS — STEP-BY-STEP WORKFLOW CARDS WITH DEDICATED BUTTONS */}
      {!needle && (
        <section className="swk-step-hub-section" aria-label="3 Core UAE Brokerage Departments">
          <div className="swk-step-hub-head">
            <div>
              <span className="swk-step-badge">3 CORE DEPARTMENTS</span>
              <h2>Step-by-Step UAE Real Estate Department Workflows</h2>
            </div>
            <span className="text-xs text-muted">Click any individual step button or action button inside each department</span>
          </div>
          <div className="swk-dept-grid">
            {CORE_DEPARTMENTS.map(dept => (
              <div key={dept.no} className={`swk-dept-card tone-${dept.tone}`}>
                <div className="swk-dept-card-head">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`swk-dept-ic tone-${dept.tone}`}><dept.icon size={22} /></span>
                    <div className="min-w-0">
                      <span className="swk-dept-no">{dept.no}</span>
                      <h3 className="swk-dept-title">{dept.title}</h3>
                    </div>
                  </div>
                  <Link to={dept.primaryTo} className="swk-btn swk-btn-primary" style={{ height: 34, padding: '0 12px', fontSize: 12 }}>
                    Open Board <ArrowUpRight size={14} />
                  </Link>
                </div>
                <p className="swk-dept-sub">{dept.subtitle}</p>

                <div className="swk-dept-steps">
                  {dept.steps.map(st => (
                    <Link key={st.step + st.label} to={st.to} className="swk-dept-step-btn">
                      <span className="swk-dept-step-num">{st.step}</span>
                      <span className="swk-dept-step-lbl">{st.label}</span>
                      <ArrowRight size={13} className="swk-dept-step-arr" />
                    </Link>
                  ))}
                </div>

                <div className="swk-dept-actions">
                  {dept.actions.map(act => (
                    <Link
                      key={act.label}
                      to={act.to}
                      className={'primary' in act && act.primary ? 'swk-dept-action-btn primary' : 'swk-dept-action-btn'}
                    >
                      {act.label}
                      <ArrowUpRight size={13} />
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4. 8-STAGE MASTER WORKFLOW OVERVIEW TILES (keeps .swk-app-tile compatibility + stage filter) */}
      {shownApps.length > 0 && (
        <section className="swk-step-hub-section" aria-label="Apps">
          <div className="swk-step-hub-head">
            <div>
              <span className="swk-step-badge">8-STAGE MASTER SEQUENCE</span>
              <h2>All 8 Operational Stages — Click Any Stage or Filter Below</h2>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setActiveStageKey('all')}
                className={`swk-stage-filter-btn ${activeStageKey === 'all' ? 'active' : ''}`}
              >
                Show All 8 Stages ({shownApps.reduce((n, a) => n + a.items.length, 0)} Buttons)
              </button>
              {shownApps.map((a, idx) => (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => setActiveStageKey(activeStageKey === a.key ? 'all' : a.key)}
                  className={`swk-stage-filter-btn ${activeStageKey === a.key ? 'active' : ''}`}
                >
                  Stage {idx + 1}
                </button>
              ))}
            </div>
          </div>

          <motion.div className="swk-launch-grid" variants={container} initial="hidden" animate="show" key={needle ? 'f' : 'all'}>
            {shownApps.map((a, idx) => (
              <motion.div key={a.key} variants={rise}>
                <Link to={a.landing} className={`swk-app-tile tone-${a.tone}`} title={a.blurb}>
                  <div className="swk-app-tile-top">
                    <span className="swk-app-icon"><a.icon size={26} strokeWidth={1.85} /></span>
                    <div className="swk-app-tile-meta">
                      <span className="swk-app-stage-pill">STAGE 0{idx + 1} · {a.items.length} STEPS</span>
                      <span className="swk-app-name">{a.label}</span>
                      {a.key === 'inventory' && <span className="sr-only">Sales & mandates</span>}
                    </div>
                  </div>
                  <p className="swk-app-blurb">{a.blurb}</p>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </section>
      )}

      {/* 5. DETAILED STEP-BY-STEP BUTTONS FOR EVERY SINGLE PAGE IN EVERY STAGE */}
      {!needle && visibleStageBlocks.map((stage) => {
        const stageIdx = apps.findIndex(x => x.key === stage.key) + 1
        return (
          <section key={stage.key} className="swk-stage-detail-block" aria-label={`${stage.label} step-by-step buttons`}>
            <div className="swk-stage-detail-head">
              <div className="flex items-center gap-3 min-w-0">
                <span className={`swk-stage-detail-ic tone-${stage.tone}`}>
                  <stage.icon size={20} />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="swk-step-badge">STAGE 0{stageIdx}</span>
                    <h3 className="swk-stage-detail-title">{stage.label}</h3>
                  </div>
                  <p className="swk-stage-detail-sub">{stage.blurb}</p>
                </div>
              </div>
              <Link to={stage.landing} className="swk-btn swk-btn-ghost" style={{ height: 34, padding: '0 12px', fontSize: 12.5 }}>
                Open Stage 0{stageIdx} Default <ArrowUpRight size={14} />
              </Link>
            </div>

            <div className="swk-step-btn-grid">
              {stage.items.map((item, itemIdx) => (
                <Link key={item.to} to={item.to} className="swk-step-btn">
                  <div className="swk-step-btn-head">
                    <span className={`swk-step-btn-ic tone-${stage.tone}`}>
                      <item.icon size={18} />
                    </span>
                    <span className="swk-step-btn-num">STEP {stageIdx}.{itemIdx + 1}</span>
                    {item.isNew && <span className="swk-step-btn-new">ACTIVE</span>}
                  </div>
                  <div className="swk-step-btn-title">{item.label}</div>
                  <div className="swk-step-btn-desc">{item.desc ?? stage.blurb}</div>
                  <div className="swk-step-btn-foot">
                    <span>Open {item.label}</span>
                    <ArrowRight size={14} />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )
      })}

      {/* GOVERNANCE & LEGAL PAYMENT FOOTER BANNER */}
      {!needle && (
        <section className="swk-launch-gov-banner" aria-label="SWK Governance Rules">
          <div className="flex items-start gap-3">
            <ShieldCheck size={22} className="text-[#c9a96e] flex-none mt-0.5" />
            <div className="text-xs leading-relaxed text-[#d9e1ee]">
              <b className="text-white">SWK Properties L.L.C Mandatory UAE Operating Rules:</b>{' '}
              <strong>Owner Shabib Siraj</strong> holds full control & final approval on administrative decisions and record deletions (held in <Link to="/recycle-bin" className="text-[#f1e4c6] underline">Pending Delete Bin</Link>).{' '}
              <strong>Manager Mohammad Haseeb</strong> runs daily operations (admin decisions routed to Owner).{' '}
              <strong>Talha Shabbir (BDM & IT Admin)</strong> manages CRM, ERP, Bayut & Dubizzle.{' '}
              <strong>Sales Advisors</strong> are on Company Visa with 0 Basic Salary & 50–50% net commission split (after 3rd-party A2A share).{' '}
              <strong>No client funds may ever be received into a Sales Advisor's personal account</strong> — only SWK Corporate Bank, DLD Escrow, Manager's Cheque, Licensed Currency Exchange, or VARA-compliant USDT/Crypto.
            </div>
          </div>
        </section>
      )}

      {needle && !shownApps.length && !features.length && (
        <div className="swk-empty"><b>No app or page matches “{query.trim()}”</b><p>Try a simpler word, or press Ctrl + K to search properties, leads, and deals.</p><button className="swk-btn swk-btn-ghost mt-2" onClick={() => setQuery('')}>Clear search</button></div>
      )}
    </div>
  )
}
