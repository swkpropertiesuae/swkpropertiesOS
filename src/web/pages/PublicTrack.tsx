import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Building2, MapPin, CircleCheck } from 'lucide-react'
import { get } from '../lib/api'
import { fmtDate, fmtDateTime } from '../lib/format'
import { Badge, Loading } from '../ui/kit'

// Client-facing deal status behind a share token: stage progress and customer-visible updates only.
export function PublicTrack() {
  const { token = '' } = useParams()
  const q = useQuery({ queryKey: ['public-deal', token], queryFn: () => get<any>(`/api/public/deal/${token}`), retry: false, refetchInterval: 120000 })
  const d = q.data
  const stages: string[] = d?.stages ?? []
  const idx = d ? Math.max(0, stages.indexOf(d.operational_status ?? d.job_status)) : 0
  const pct = stages.length ? Math.round(((idx + 1) / stages.length) * 100) : 0
  return (
    <div className="min-h-full bg-pearl">
      <header className="bg-white border-b border-line"><div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3"><img src="/brand/swk-logo-ink.png" alt="SWK Properties" className="h-10 w-auto" /><div className="flex-1" /><span className="text-sm text-muted font-semibold">Deal status</span></div></header>
      <main className="max-w-3xl mx-auto px-4 py-6">
        {q.isLoading ? <Loading /> : q.error ? <div className="card p-8 text-center"><h1 className="text-[22px] m-0">Status link not found</h1><p className="text-muted">This link is invalid or has been switched off. Please contact your SWK Properties representative.</p></div> : (
          <div className="grid gap-4 fade-in">
            <div className="card p-5"><div className="flex items-center gap-3 flex-wrap"><div className="w-11 h-11 rounded-xl bg-mint text-fold grid place-items-center"><Building2 size={22} /></div><div className="flex-1 min-w-0"><div className="text-xs text-muted font-semibold">Deal reference</div><h1 className="m-0 text-[24px]">{d.job_no}</h1></div><Badge value={d.operational_status ?? d.job_status} /></div>
              <div className="grid gap-x-6 gap-y-2 mt-4 sm:grid-cols-2 text-sm">{([['Deal', d.deal_name], ['Type', d.deal_type], ['Client', d.client], ['Property', [d.property, d.community].filter(Boolean).join(' · ')], ['Deal date', d.deal_date ? fmtDate(d.deal_date) : ''], ['Target close', d.target_close ? fmtDate(d.target_close) : '']] as [string, string][]).filter(([, v]) => v).map(([k, v]) => <div key={k}><div className="text-[11.5px] font-semibold text-muted">{k}</div><div className="font-semibold text-ink">{v}</div></div>)}</div>
              {stages.length > 0 && <div className="mt-5">
                <div className="flex justify-between text-xs text-muted mb-1"><span>Current stage: <b className="text-ink">{d.operational_status ?? d.job_status}</b></span><span>{idx + 1} of {stages.length}</span></div>
                <div className="h-2.5 rounded-full bg-soft border border-line overflow-hidden"><div className="h-full bg-emerald transition-all" style={{ width: pct + '%' }} /></div>
                <div className="grid mt-3 gap-1" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}>{stages.map((s, i) => <div key={s} className="flex items-center gap-1 min-w-0" title={s}><CircleCheck size={13} className={i <= idx ? 'text-emerald' : 'text-[#b3aca0]'} style={{ flex: 'none' }} /><span className={`text-[10.5px] truncate ${i <= idx ? 'font-semibold text-ink' : 'text-muted'}`}>{s}</span></div>)}</div>
              </div>}
            </div>
            <div className="card p-5"><h2 className="m-0 mb-3 text-[16px] flex items-center gap-2"><MapPin size={17} /> Progress updates</h2>
              {d.events.length === 0 ? <p className="text-muted text-sm m-0">No updates have been published yet. Your representative will update this page as the deal progresses.</p> : <ol className="list-none m-0 p-0 border-l-2 border-line ml-2">{d.events.map((e: any, i: number) => <li key={i} className="relative pl-6 pb-4"><span className={`absolute -left-[9px] top-0.5 w-4 h-4 rounded-full border-2 border-white ${i === 0 ? 'bg-emerald' : 'bg-[#b3aca0]'}`} /><div className="font-bold text-ink">{e.event_type}</div><div className="text-xs text-muted">{fmtDateTime(e.event_at)}</div>{e.description && <div className="text-[13.5px]">{e.description}</div>}</li>)}</ol>}
            </div>
            <p className="text-xs text-muted text-center">Status shown is the latest information recorded by {d.company}. Target dates can change. Contact your account representative for details.</p>
          </div>)}
      </main>
    </div>
  )
}
