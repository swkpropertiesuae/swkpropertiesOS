import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowUpRight, Clock3, Search, X } from 'lucide-react'
import { useMeta } from '../lib/meta'
import { launcherApps, recentItems } from '../swk/nav'

const ease = [0.16, 1, 0.3, 1] as const

function dubaiHour() { return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dubai', hour: '2-digit', hour12: false }).format(new Date())) }
function greeting() { const h = dubaiHour(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening' }
const today = () => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dubai', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())

/**
 * Post-sign-in launcher. Replaces the old always-on sidebar: staff pick the area they want to work in,
 * and the top bar then offers that area's pages. Tiles are permission-filtered via the same RBAC as the nav.
 */
export function Launcher() {
  const { me, can } = useMeta()
  const nav = useNavigate()
  const reduce = useReducedMotion()
  const [query, setQuery] = useState('')
  const apps = useMemo(() => launcherApps(can), [can])
  const recents = useMemo(() => recentItems(can), [can])
  const needle = query.trim().toLocaleLowerCase()
  const shownApps = apps.filter(a => !needle || a.label.toLocaleLowerCase().includes(needle) || a.blurb.toLocaleLowerCase().includes(needle))
  const features = needle ? apps.flatMap(a => a.items.map(i => ({ ...i, app: a.label }))).filter(i => i.label.toLocaleLowerCase().includes(needle) || (i.desc ?? '').toLocaleLowerCase().includes(needle)) : []
  const firstName = (me?.name || '').split(' ')[0]
  const total = apps.reduce((n, a) => n + a.items.length, 0)

  const openFirst = () => {
    const target = features[0]?.to ?? shownApps[0]?.landing
    if (target) nav(target)
  }
  const container = { hidden: {}, show: { transition: { staggerChildren: reduce ? 0 : 0.045, delayChildren: 0.05 } } }
  const rise = { hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease } } }

  return (
    <div className="swk-launch">
      <motion.header className="swk-launch-hero" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease }}>
        <div className="swk-eyebrow">Dubai · {today()}</div>
        <h1>{greeting()}{firstName ? `, ${firstName}` : ''}.</h1>
        <p>Where would you like to work today?</p>
        <form className="swk-launch-search" role="search" onSubmit={e => { e.preventDefault(); openFirst() }}>
          <Search size={18} aria-hidden />
          <input type="text" inputMode="search" enterKeyHint="search" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') setQuery('') }}
            placeholder={`Search ${apps.length} apps and ${total} features…`} aria-label="Search apps and features" autoFocus autoComplete="off" />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><X size={16} /></button>}
        </form>
      </motion.header>

      {!needle && recents.length > 0 && (
        <motion.section className="swk-launch-recent" aria-label="Recently opened" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.5 }}>
          <span className="lbl"><Clock3 size={14} />Pick up where you left off</span>
          {recents.map(r => <Link key={r.to} to={r.to} className="swk-launch-chip"><r.icon size={15} />{r.label}</Link>)}
        </motion.section>
      )}

      {features.length > 0 && (
        <section aria-label="Matching features" className="swk-launch-results">
          <h2>Features</h2>
          <ul>
            {features.map(f => (
              <li key={f.to}><Link to={f.to}><span className="ic"><f.icon size={18} /></span><span className="tx"><b>{f.label}</b><small>{f.desc ?? f.app}</small></span><span className="app">{f.app}</span><ArrowUpRight size={16} className="go" /></Link></li>
            ))}
          </ul>
        </section>
      )}

      {shownApps.length > 0 && (
        <motion.section className="swk-launch-grid" aria-label="Apps" variants={container} initial="hidden" animate="show" key={needle ? 'f' : 'all'}>
          {shownApps.map(a => (
            <motion.div key={a.key} variants={rise}>
              <Link to={a.landing} className={`swk-app-tile tone-${a.tone}`}>
                <span className="swk-app-icon"><a.icon size={28} strokeWidth={1.6} /></span>
                <span className="swk-app-name">{a.label}</span>
                <span className="swk-app-blurb">{a.blurb}</span>
                <span className="swk-app-foot"><span>{a.items.length} {a.items.length === 1 ? 'feature' : 'features'}</span><ArrowUpRight size={16} /></span>
              </Link>
            </motion.div>
          ))}
        </motion.section>
      )}

      {needle && !shownApps.length && !features.length && (
        <div className="swk-empty"><b>Nothing matches “{query.trim()}”</b><p>Try a shorter word, or open the search bar (Ctrl K) to look across properties, leads and deals.</p><button className="swk-btn swk-btn-ghost mt-2" onClick={() => setQuery('')}>Clear search</button></div>
      )}
    </div>
  )
}
