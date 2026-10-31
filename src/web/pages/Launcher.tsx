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
 * Clean, simple post-sign-in App Launcher grid (icon + short title).
 * Selecting any app opens that app with its dedicated left sidebar navigation.
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

  const openFirst = () => {
    const target = features[0]?.to ?? shownApps[0]?.landing
    if (target) nav(target)
  }
  const container = { hidden: {}, show: { transition: { staggerChildren: reduce ? 0 : 0.035, delayChildren: 0.04 } } }
  const rise = { hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease } } }

  return (
    <div className="swk-launch">
      <motion.header className="swk-launch-hero" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease }}>
        <div className="swk-eyebrow">Dubai · {today()}</div>
        <h1>{greeting()}{firstName ? `, ${firstName}` : ''}.</h1>
        <form className="swk-launch-search" role="search" onSubmit={e => { e.preventDefault(); openFirst() }}>
          <Search size={18} aria-hidden />
          <input type="text" inputMode="search" enterKeyHint="search" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') setQuery('') }}
            placeholder="Search apps or pages…" aria-label="Search apps and features" autoFocus autoComplete="off" />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><X size={16} /></button>}
        </form>
      </motion.header>

      {!needle && recents.length > 0 && (
        <motion.section className="swk-launch-recent" aria-label="Recently opened" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15, duration: 0.4 }}>
          <span className="lbl"><Clock3 size={14} />Recent</span>
          {recents.map(r => <Link key={r.to} to={r.to} className="swk-launch-chip"><r.icon size={15} />{r.label}</Link>)}
        </motion.section>
      )}

      {features.length > 0 && (
        <section aria-label="Matching features" className="swk-launch-results">
          <h2>Pages</h2>
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
              <Link to={a.landing} className={`swk-app-tile tone-${a.tone}`} title={a.blurb}>
                <span className="swk-app-icon"><a.icon size={32} strokeWidth={1.75} /></span>
                <span className="swk-app-name">{a.key === 'sales' ? 'Sales' : a.key === 'leasing' ? 'Leasing' : a.label}</span>
                {(a.key === 'sales' || a.key === 'leasing') && <span className="sr-only"> {a.label}</span>}
              </Link>
            </motion.div>
          ))}
        </motion.section>
      )}

      {needle && !shownApps.length && !features.length && (
        <div className="swk-empty"><b>No app or page matches “{query.trim()}”</b><p>Try a simpler word, or press Ctrl + K to search properties, leads, and deals.</p><button className="swk-btn swk-btn-ghost mt-2" onClick={() => setQuery('')}>Clear search</button></div>
      )}
    </div>
  )
}
