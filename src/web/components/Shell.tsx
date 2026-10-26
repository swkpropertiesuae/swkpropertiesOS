import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { Bell, Search, Plus, Check, ChevronDown, ChevronRight, LogOut, UserRound, LifeBuoy, LayoutGrid, Languages, Download, RefreshCw, ArrowLeft } from 'lucide-react'
import { useMeta } from '../lib/meta'
import { get, post } from '../lib/api'
import { cls, fmtIsoStamp } from '../lib/format'
import { Modal, useClickOutside } from '../ui/kit'
import { applyUpdate, isIosBrowser, promptInstall, usePwa } from '../lib/pwa'
import { useToast } from '../lib/toast'
import { CommandPalette } from './CommandPalette'
import { APP_META, QUICK_CREATE, findNav, rememberVisit } from '../swk/nav'

/** Live Dubai time (Gulf Standard Time). */
function DubaiClock() {
  const [t, setT] = useState(new Date())
  useEffect(() => { const i = setInterval(() => setT(new Date()), 20000); return () => clearInterval(i) }, [])
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dubai', hour: '2-digit', minute: '2-digit', hour12: true }).format(t).toUpperCase()
  const day = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dubai', weekday: 'short', day: '2-digit', month: 'short' }).format(t)
  return <span className="swk-chip swk-hide-md" title="Gulf Standard Time (GST, UTC+4)"><span className="dot" />Dubai <b>{time}</b><span className="text-muted">· {day}</span></span>
}

function NotificationBell() {
  const nav = useNavigate(), qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false))
  const q = useQuery({ queryKey: ['notifications'], queryFn: () => get<{ unread: number; rows: any[] }>('/api/notifications'), refetchInterval: 60000 })
  const unread = q.data?.unread ?? 0
  const read = async (ids?: number[]) => { await post('/api/notifications/read', ids ? { ids } : { all: true }); void qc.invalidateQueries({ queryKey: ['notifications'] }) }
  return (
    <div className="relative" ref={ref}>
      <button className="swk-tbtn" onClick={() => setOpen(o => !o)} aria-label={`Notifications, ${unread} unread`}><Bell size={17} />{unread > 0 && <span className="count">{unread > 99 ? '99+' : unread}</span>}</button>
      <AnimatePresence>{open && (
        <motion.div className="swk-menu" style={{ width: 380, padding: 0, overflow: 'hidden' }} initial={{ opacity: 0, y: -6, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: .98 }} transition={{ duration: .18 }}>
          <div className="flex items-center px-4 py-3 border-b border-line"><b className="font-display text-[15px] text-ink">Notifications</b><div className="flex-1" />{unread > 0 && <button className="swk-btn swk-btn-ghost" style={{ height: 30, padding: '0 10px', fontSize: 12 }} onClick={() => void read()}><Check size={14} /> Mark all read</button>}</div>
          <div className="max-h-[60vh] overflow-auto">
            {!q.data?.rows.length ? <div className="p-8 text-center text-muted text-sm">You're all caught up.</div> : q.data.rows.map(n => (
              <button key={n.id} className={cls('w-full text-start px-4 py-3 border-0 border-b border-line bg-transparent cursor-pointer hover:bg-[#faf6ee]', !n.read_at && 'bg-[#fbf6ea]')} onClick={() => { void read([n.id]); setOpen(false); if (n.link) nav(n.link) }}>
                <div className="flex gap-2 items-start">{!n.read_at && <span className="w-2 h-2 rounded-full bg-[#c9a96e] mt-1.5 flex-none" />}<div className="min-w-0"><div className="text-[13.5px] font-semibold text-ink">{n.title}</div>{n.body && <div className="text-xs text-muted line-clamp-2">{n.body}</div>}<div className="text-[11px] text-muted mt-0.5">{fmtIsoStamp(n.created_at)}</div></div></div>
              </button>))}
          </div>
        </motion.div>)}</AnimatePresence>
    </div>
  )
}

function QuickCreate() {
  const { can } = useMeta()
  const [open, setOpen] = useState(false)
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false))
  const items = QUICK_CREATE.filter(i => can(i.module, 'create'))
  if (!items.length) return null
  return (
    <div className="relative" ref={ref}>
      <button className="swk-create" onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open}><Plus size={16} /><span className="swk-hide-sm">Quick Add</span><ChevronDown size={14} className="opacity-70 swk-hide-sm" /></button>
      <AnimatePresence>{open && (
        <motion.div role="menu" className="swk-menu" initial={{ opacity: 0, y: -6, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: .98 }} transition={{ duration: .18 }}>
          {items.map((i, idx) => (
            <motion.div key={i.to} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * .03 }}>
              <Link role="menuitem" to={i.to} onClick={() => setOpen(false)}><span className="ic"><i.icon size={16} /></span><span><b className="font-semibold">{i.label}</b><small>{i.desc}</small></span></Link>
            </motion.div>))}
        </motion.div>)}</AnimatePresence>
    </div>
  )
}

/** Dedicated left sidebar for the currently opened app. */
function AppSidebar({ pathname }: { pathname: string }) {
  const { can } = useMeta()
  const here = findNav(pathname)
  const items = useMemo(() => (here?.section.items ?? []).filter(i => !i.module || can(i.module, 'view')), [here, can])
  if (!here || items.length < 1) return null
  const meta = APP_META[here.section.key]
  return (
    <aside className="swk-app-sidebar no-print">
      <nav className="swk-sidebar-nav" aria-label={`${here.section.label} pages`}>
        <div className="swk-sidebar-head">
          <Link to="/home" className="swk-sidebar-back" title="Back to all apps">
            <ArrowLeft size={14} />
            <span>All apps</span>
          </Link>
          <div className="swk-sidebar-app">
            <span className={`swk-sidebar-app-ic tone-${meta?.tone ?? 'navy'}`}>{meta && <meta.icon size={18} />}</span>
            <div className="min-w-0">
              <div className="swk-sidebar-app-name">{here.section.label}</div>
              <div className="swk-sidebar-app-count">{items.length} {items.length === 1 ? 'page' : 'pages'}</div>
            </div>
          </div>
        </div>
        <div className="swk-sidebar-list">
          {items.map(i => {
            const isActive = here.item.to === i.to
            return (
              <NavLink key={i.to} to={i.to} className={cls('swk-sidebar-link', isActive && 'active')} aria-current={isActive ? 'page' : undefined}>
                <span className="swk-sidebar-link-ic"><i.icon size={16} /></span>
                <span className="swk-sidebar-link-tx">
                  <span className="swk-sidebar-link-row">
                    <b>{i.label}</b>
                    {i.isNew && <em>NEW</em>}
                  </span>
                  {i.desc && <small>{i.desc}</small>}
                </span>
              </NavLink>
            )
          })}
        </div>
      </nav>
    </aside>
  )
}

export function Shell() {
  const { me, setMe, meta } = useMeta()
  const nav = useNavigate()
  const loc = useLocation()
  const [palette, setPalette] = useState(false)
  const [guide, setGuide] = useState(false)
  const [userMenu, setUserMenu] = useState(false)
  const pwa = usePwa(), toast = useToast(), ios = isIosBrowser()
  const install = async () => { setUserMenu(false); if (ios) { toast.ok('On iPhone or iPad: tap Share, then Add to Home Screen.'); return } const r = await promptInstall(); if (r === 'accepted') toast.ok('SWK OS is being installed.') }
  const userRef = useClickOutside<HTMLDivElement>(() => setUserMenu(false))
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(true) } }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [])
  useEffect(() => { rememberVisit(loc.pathname) }, [loc.pathname])
  const logout = async () => { try { await post('/api/auth/logout') } catch { /* ignore */ } setMe(null); nav('/login') }
  const isPrint = loc.pathname.startsWith('/print')
  const here = findNav(loc.pathname)
  const isHome = loc.pathname === '/home'
  const pageTitle = isHome ? 'All apps' : here?.item.label ?? titleFromPath(loc.pathname)
  if (isPrint) return <main id="main"><Outlet context={{ openGuide: () => setGuide(true), openSearch: () => setPalette(true), logout }} /></main>
  const initials = (me?.name || me?.email || 'S').split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(s => s[0]!.toUpperCase()).join('')
  return (
    <div className="swk-app">
      <div className="swk-main-col">
        <header className="swk-top no-print">
          <Link to="/home" className="swk-brand" aria-label="SWK OS home"><img src="/brand/swk-logo-ink.png" alt="SWK Properties" /></Link>
          <Link to="/home" className={cls('swk-apps-btn', isHome && 'on')} aria-label="All apps" title="All apps"><LayoutGrid size={17} /><span className="swk-hide-sm">All apps</span></Link>
          <div className="swk-top-title">
            <div className="crumb"><Link to="/home">All apps</Link>{here && <><ChevronRight size={11} /><span>{here.section.label}</span></>}</div>
            <div className="page">{pageTitle}</div>
          </div>
          <div className="flex-1" />
          <DubaiClock />
          <span className="swk-chip swk-hide-md" title="Base currency">AED</span>
          <button className="swk-tbtn" onClick={() => setPalette(true)} aria-label="Search (Ctrl K)"><Search size={17} /></button>
          <NotificationBell />
          <QuickCreate />
          <div className="relative" ref={userRef}>
            <button className="swk-avatar border-0 cursor-pointer" style={{ width: 38, height: 38 }} onClick={() => setUserMenu(o => !o)} aria-label="Account menu" aria-expanded={userMenu}>{initials}</button>
            <AnimatePresence>{userMenu && (
              <motion.div className="swk-menu" style={{ minWidth: 250 }} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: .16 }}>
                <div className="px-3 py-2"><div className="font-semibold text-ink text-[14px] truncate">{me?.name}</div><div className="text-xs text-muted truncate">{me?.email}</div></div>
                <div className="sep" />
                <Link to="/profile" onClick={() => setUserMenu(false)}><span className="ic"><UserRound size={16} /></span>My profile & password</Link>
                <Link to="/workspace-tools" onClick={() => setUserMenu(false)}><span className="ic"><Languages size={16} /></span>Language & preferences</Link>
                <Link to="/home" onClick={() => setUserMenu(false)}><span className="ic"><LayoutGrid size={16} /></span>All apps</Link>
                <button className="item" onClick={() => { setUserMenu(false); setGuide(true) }}><span className="ic"><LifeBuoy size={16} /></span>Help guide</button>
                {!pwa.installed && (pwa.canInstall || ios) && <button className="item" onClick={install}><span className="ic"><Download size={16} /></span>Install app</button>}
                <div className="sep" />
                <button className="item" onClick={logout}><span className="ic"><LogOut size={16} /></span>Sign out</button>
              </motion.div>)}</AnimatePresence>
          </div>
        </header>
        {pwa.updateReady && <div className="no-print" role="status" style={{ position: 'fixed', left: 16, right: 16, bottom: 16, zIndex: 80, maxWidth: 440, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 12, background: '#0f1714', color: '#e8efe9', boxShadow: '0 8px 30px rgba(0,0,0,.3)' }}><RefreshCw size={16} /><span style={{ flex: 1, fontSize: 13.5 }}>A new version of SWK OS is ready.</span><button className="btn sm" onClick={applyUpdate}>Reload</button></div>}
        {me?.demo && <div className="demo-notice no-print"><span><strong>Demo workspace</strong> · sample data · external messages switched off</span><details><summary>Details</summary><p>Safe practice environment. Resets every night. External email and WhatsApp messages are disabled.</p><button className="btn outline sm" onClick={async () => { if (confirm('Restore the demo to its original state and sign out?')) { await post('/api/demo/reset'); window.location.href = '/login' } }}>Reset demo</button></details></div>}
        {me?.defaultPassword && !me?.demo && <div className="no-print bg-[#f3e6c4] text-[#6b4a00] px-5 py-2 text-sm font-semibold flex items-center gap-3 flex-wrap">You are signed in with the default password. <Link to="/profile" className="underline">Change it now</Link></div>}
        <div className={cls('swk-body', !isHome && !!here && 'has-sidebar')}>
          {!isHome && <AppSidebar pathname={loc.pathname} />}
          <main className="swk-main" id="main">
            <AnimatePresence mode="wait">
              <motion.div key={loc.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: .24, ease: [0.16, 1, 0.3, 1] }}>
                <Outlet context={{ openGuide: () => setGuide(true), openSearch: () => setPalette(true), logout }} />
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
      {palette && <CommandPalette onClose={() => setPalette(false)} />}
      <Modal open={guide} onClose={() => setGuide(false)} title="How to use SWK OS" width={660}>
        <div className="grid gap-4 text-sm">
          <div><b className="font-display text-ink">All apps & sidebar</b> — Click <b>All apps</b> in the top bar to switch between departments. Inside any app, use the left sidebar to switch between its pages.</div>
          <div><b className="font-display text-ink">Quick search</b> — Press <kbd className="border border-line rounded px-1.5">Ctrl</kbd> + <kbd className="border border-line rounded px-1.5">K</kbd> anytime to find properties, leads, deals, leases, cheques, and invoices.</div>
          <div><b className="font-display text-ink">Selling a property</b> — Lead → Viewing → Buyer Offer → Sales Contract (Form F) → Developer NOC → DLD Transfer → Commission Invoice.</div>
          <div><b className="font-display text-ink">Leasing a property</b> — Owner Agreement → Viewing → Offer → Tenancy Contract → Ejari → Rent Cheques → Receipts & Renewal.</div>
          <div><b className="font-display text-ink">Off-plan sales</b> — Booking → SPA → Oqood Registration → Payment Plan → Handover.</div>
          <div className="text-muted">{meta?.settings.company_name} · Dubai, UAE · Gulf Standard Time</div>
        </div>
      </Modal>
    </div>
  )
}
export type { ReactNode }

function titleFromPath(p: string) {
  if (p.startsWith('/e/')) return p.split('/')[2]?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) ?? 'Records'
  const seg = p.split('/').filter(Boolean)[0] ?? 'Dashboard'
  return seg.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
