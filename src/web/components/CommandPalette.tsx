import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { Search, CornerDownLeft, type LucideIcon } from 'lucide-react'
import { get } from '../lib/api'
import { useMeta } from '../lib/meta'
import { iconByName } from '../lib/icons'
import { cls } from '../lib/format'
import { SWK_NAV, QUICK_CREATE } from '../swk/nav'

type Item = { group: string; label: string; link: string; Icon: LucideIcon; sub: string }

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const nav = useNavigate(); const { can } = useMeta()
  const [q, setQ] = useState(''); const [remote, setRemote] = useState<any[]>([]); const [hi, setHi] = useState(0)
  const pages = useMemo<Item[]>(() => SWK_NAV.flatMap(s => s.items.filter(i => !i.module || can(i.module, 'view')).map(i => ({ group: 'Go to', label: i.label, link: i.to, Icon: i.icon, sub: s.label }))), [can])
  const actions = useMemo<Item[]>(() => QUICK_CREATE.filter(a => can(a.module, 'create')).map(a => ({ group: 'Create', label: a.label, link: a.to, Icon: a.icon, sub: a.desc })), [can])
  useEffect(() => {
    if (q.trim().length < 2) { setRemote([]); return }
    const t = setTimeout(() => { get<any[]>('/api/search/global', { q }).then(setRemote).catch(() => setRemote([])) }, 160)
    return () => clearTimeout(t)
  }, [q])
  const needle = q.trim().toLowerCase()
  const local = needle ? [...actions, ...pages].filter(p => p.label.toLowerCase().includes(needle) || p.sub.toLowerCase().includes(needle)).slice(0, 8) : [...actions.slice(0, 4), ...pages.slice(0, 8)]
  const items: Item[] = [...remote.map(r => ({ group: r.group, label: r.label, link: r.link, Icon: iconByName(r.icon), sub: '' })), ...local]
  useEffect(() => setHi(0), [q, remote.length])
  const go = (l: string) => { onClose(); nav(l) }
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h) }, [onClose])
  let lastGroup = ''
  return (
    <motion.div className="overlay" style={{ paddingTop: '10vh', background: 'rgba(8,20,42,.45)', backdropFilter: 'blur(6px)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} onMouseDown={e => { if (e.target === e.currentTarget) onClose() }} role="dialog" aria-modal="true" aria-label="Search">
      <motion.div className="modal" style={{ maxWidth: 660, borderRadius: 22, overflow: 'hidden' }} initial={{ opacity: 0, y: 16, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 30 }}>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-line"><Search size={19} className="text-[#9a7a42]" /><input autoFocus className="flex-1 bg-transparent border-0 outline-none text-[16px] text-ink" placeholder="Search properties, leads, deals, leases… or jump anywhere" value={q} onChange={e => setQ(e.target.value)}
          onKeyDown={e => { if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, items.length - 1)) } else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(0, h - 1)) } else if (e.key === 'Enter' && items[hi]) go(items[hi].link) }} /><kbd className="text-xs border border-line rounded-md px-1.5 py-0.5 text-muted">Esc</kbd></div>
        <div className="max-h-[56vh] overflow-auto p-2">
          {items.length === 0 && <div className="p-8 text-center text-muted text-sm">No results for “{q}”.</div>}
          {items.map((it, i) => {
            const head = it.group !== lastGroup; lastGroup = it.group
            return (<div key={i}>{head && <div className="px-3 pt-3 pb-1 text-[10.5px] font-semibold uppercase tracking-[.18em] text-muted">{it.group}</div>}
              <button className={cls('w-full text-start flex items-center gap-3 px-3 py-2.5 border-0 cursor-pointer text-[14px] rounded-xl transition-colors', i === hi ? 'bg-[#f3ead8] text-ink' : 'bg-transparent text-ink')} onMouseEnter={() => setHi(i)} onClick={() => go(it.link)}>
                <span className="w-8 h-8 rounded-lg grid place-items-center flex-none bg-[#f2ede3] text-[#14305c]"><it.Icon size={16} /></span><span className="flex-1 truncate font-medium">{it.label}</span>{it.sub && <span className="text-xs text-muted truncate max-w-[45%]">{it.sub}</span>}{i === hi && <CornerDownLeft size={14} className="text-[#9a7a42]" />}</button></div>)
          })}
        </div>
      </motion.div>
    </motion.div>
  )
}
