import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Bot, Plus, ArrowRight, AlertTriangle, Info, TriangleAlert, Home, KeyRound, Workflow, Wallet, FileText, CalendarDays, LayoutGrid, ChevronLeft, ChevronRight, Mail } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { get } from '../lib/api'
import { useMeta } from '../lib/meta'
import { Badge, ErrorBox, Kpi, Loading, Panel, Empty } from '../ui/kit'
import { fmtCompact, fmtDate, fmtDateTime, fmtMoney, cls } from '../lib/format'

const C = { emerald: '#f23a1d', ocean: '#c9260e', teal: '#ff7a45', aviation: '#8a6a52', copper: '#b9741f', violet: '#566058', champagne: '#e0c9a8', red: '#c32135', graphite: '#0f1714' }
const PIE = [C.emerald, C.ocean, C.copper, C.violet, C.teal, C.aviation, C.champagne]
const money = (v: any) => fmtMoney(Number(v), 0)

export function Dashboard() {
  const { me, can, meta } = useMeta()
  const nav = useNavigate()
  const q = useQuery({ queryKey: ['dashboard'], queryFn: () => get<any>('/api/dashboard'), refetchInterval: 120000 })
  if (q.error) return <ErrorBox error={q.error} onRetry={() => void q.refetch()} />
  if (!q.data) return <Loading />
  const d = q.data, k = d.kpis ?? {}
  const base = meta?.settings.base_currency ?? 'AED'

  if (d.portal) return (
    <div className="fade-in dashboard-page">
      <Welcome name={me?.name} portal />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5"><Kpi label="Open deals" value={k.open_jobs} /><Kpi label="Completed deals" value={k.delivered} /><Kpi label={`Outstanding (${base})`} value={fmtMoney(k.outstanding)} /></div>
      <Panel title="Your recent deals" color={C.teal} bodyClass="table-wrap"><table className="grid"><thead><tr><th>Deal no.</th><th>Deal</th><th>Property</th><th>Date</th><th>Stage</th></tr></thead><tbody>{d.recent_jobs.map((j: any) => <tr key={j.id} className="clickable" onClick={() => nav(`/jobs/${j.id}`)}><td><Link className="link" to={`/jobs/${j.id}`}>{j.job_no}</Link></td><td>{j.deal_name}</td><td>{j.property}</td><td>{fmtDate(j.deal_date)}</td><td><Badge value={j.operational_status ?? j.job_status} /></td></tr>)}</tbody></table></Panel>
    </div>
  )

  const tiles: { label: string; value: any; hint?: any; tone?: any; surface?: string; to?: string; show: boolean; desk?: boolean }[] = [
    { label: 'Open deals', surface: 'ocean', value: k.open_jobs, hint: `${k.jobs_month ?? 0} opened this month`, to: '/e/jobs?filters=' + encodeURIComponent(JSON.stringify([{ field: 'job_status', op: 'in', value: ['Lead', 'Active Mandate', 'Offer Submitted', 'Offer Accepted', 'Contract Signed', 'DLD Submitted', 'DLD Approved', 'On Hold'] }])), show: k.open_jobs !== undefined },
    { label: 'In pipeline', surface: 'transit', value: k.in_transit, to: '/e/jobs?filters=' + encodeURIComponent(JSON.stringify([{ field: 'operational_status', op: 'in', value: ['Viewing', 'Offer', 'Negotiation', 'Contract', 'DLD Process', 'Handover'] }])), show: k.in_transit !== undefined },
    { label: `Revenue this month (${base})`, surface: 'revenue', value: fmtMoney(k.revenue_month, 0), hint: `Deal profit ${fmtMoney(k.profit_month, 0)}`, show: k.revenue_month !== undefined },
    { label: `Receivables (${base})`, surface: 'collections', value: fmtMoney(k.ar_outstanding, 0), hint: k.ar_overdue > 0 ? `${fmtMoney(k.ar_overdue, 0)} overdue` : 'Nothing overdue', tone: k.ar_overdue > 0 ? 'amber' : undefined, to: '/reports?r=ar_aging', show: k.ar_outstanding !== undefined },
    { label: `Payables (${base})`, value: fmtMoney(k.ap_outstanding, 0), to: '/reports?r=ap_aging', show: k.ap_outstanding !== undefined },
    { label: `Cash & bank (${base})`, value: fmtMoney(k.cash, 0), to: '/e/bank_accounts', show: k.cash !== undefined },
    { label: `Unbilled work (${base})`, surface: 'collections', value: fmtMoney(k.unbilled, 0), tone: k.unbilled > 0 ? 'amber' : undefined, to: '/reports?r=unbilled_charges', show: k.unbilled !== undefined },
    { label: 'Open quotations', value: k.quotes_open, to: '/e/quotations', show: k.quotes_open !== undefined },
    { label: 'New leads', value: k.leads_new, hint: `Pipeline ${fmtMoney(k.pipeline, 0)}`, to: '/e/leads', show: k.leads_new !== undefined },
    { label: 'Open tickets', value: k.tickets_open, to: '/e/tickets', show: k.tickets_open !== undefined },
    { label: 'My open tasks', value: k.my_tasks, to: '/e/tasks', show: k.my_tasks !== undefined },
    // §11 CEO desk strip — always rendered above the rest
    { label: 'Leads today', desk: true, value: k.leads_today, hint: k.leads_qualified !== undefined ? `${k.leads_qualified} qualified leads` : undefined, to: '/e/leads', show: k.leads_today !== undefined },
    { label: 'Viewings next 7 days', desk: true, value: k.viewings_week, hint: k.viewings_missed !== undefined ? `${k.viewings_missed} no-shows in 30 days` : undefined, to: '/e/viewings', show: k.viewings_week !== undefined },
    { label: 'Offers pending', desk: true, value: k.offers_pending, to: '/e/offers', show: k.offers_pending !== undefined },
    { label: `Pipeline value (${base})`, desk: true, surface: 'revenue', value: fmtMoney(k.pipeline_value, 0), hint: k.open_jobs !== undefined ? `${k.open_jobs} open deals` : undefined, to: '/e/jobs', show: k.pipeline_value !== undefined },
    { label: 'Available properties', desk: true, value: k.properties_available, hint: k.properties_reserved !== undefined ? `${k.properties_reserved} reserved or under offer` : undefined, to: '/e/properties?filters=' + encodeURIComponent(JSON.stringify([{ field: 'status', op: 'eq', value: 'Available' }])), show: k.properties_available !== undefined },
    { label: 'Renewals due (90 days)', desk: true, value: k.renewals_due, hint: k.vacant_units !== undefined ? `${k.vacant_units} vacant units` : undefined, to: '/e/leases', show: k.renewals_due !== undefined },
    { label: `Rent arrears (${base})`, desk: true, value: fmtMoney(k.arrears_aed, 0), hint: k.arrears_count !== undefined ? `${k.arrears_count} schedules overdue` : undefined, to: '/e/rent_schedules?filters=' + encodeURIComponent(JSON.stringify([{ field: 'status', op: 'eq', value: 'Overdue' }])), show: k.arrears_aed !== undefined },
    { label: `Commissions received (${base})`, desk: true, value: fmtMoney(k.received_month, 0), hint: k.commission_expected !== undefined ? `AED ${fmtMoney(k.commission_expected, 0)} still to invoice` : undefined, to: '/e/receipts', show: k.received_month !== undefined },
    // supporting mandate + compliance figures in "More business figures"
    { label: 'Open maintenance', value: k.maintenance_open, hint: k.maintenance_exceptions !== undefined ? `${k.maintenance_exceptions} urgent or emergency` : undefined, to: '/e/maintenance', show: k.maintenance_open !== undefined },
    { label: 'Mandates expiring (14 days)', value: k.mandates_expiring, hint: k.mandates_active !== undefined ? `${k.mandates_active} active mandates` : undefined, to: '/e/mandates', show: k.mandates_expiring !== undefined },
    { label: 'Stale mandates (21+ days)', value: k.stale_listings, to: '/e/mandates', show: k.stale_listings !== undefined },
    { label: 'Compliance issues', value: k.compliance_issues, to: '/reports?r=document_expiries', show: k.compliance_issues !== undefined },
  ].filter(t => t.show)

  const ch = d.charts ?? {}, ls = d.lists ?? {}
  const deskTiles = tiles.filter(t => t.desk), stdTiles = tiles.filter(t => !t.desk)
  const kpiClick = (t: (typeof tiles)[number]) => t.to && (!t.to.startsWith('/reports') || (can('reports', 'view') && can('finance', 'view'))) ? () => nav(t.to!) : undefined
  return (
    <div className="fade-in dashboard-page">
      <Welcome name={me?.name} />
      {deskTiles.length > 0 && <section className="dashboard-desk" aria-label="Real estate desk today"><h2 className="dashboard-section-title">Real estate desk today</h2><div className="dashboard-metrics">{deskTiles.map(t => <Kpi key={t.label} className={t.surface ? `metric-${t.surface}` : undefined} label={t.label} value={t.value ?? 0} hint={t.hint} onClick={kpiClick(t)} />)}</div></section>}
      <section aria-label="Business at a glance"><div className="dashboard-metrics">{stdTiles.slice(0, 4).map(t => <Kpi key={t.label} className={t.surface ? `metric-${t.surface}` : undefined} label={t.label} value={t.value ?? 0} hint={t.hint} onClick={kpiClick(t)} />)}</div></section>
      {d.alerts?.length > 0 && <details className="dashboard-disclosure dashboard-attention" open><summary>Needs attention <span>{d.alerts.length}</span></summary><div className="dashboard-alerts">{d.alerts.map((a: any, i: number) => (
        <Link key={i} to={a.link} data-level={a.level} className="dashboard-alert flex items-center gap-3 px-4 py-2.5 text-[13.5px]">
          {a.level === 'danger' ? <AlertTriangle size={17} /> : a.level === 'warn' ? <TriangleAlert size={17} /> : <Info size={17} />}<span className="flex-1" dir="auto">{a.text}</span><ArrowRight size={15} /></Link>))}</div></details>}


      <OperationsDesk data={d} />
        {ls.recent_jobs && (
          <Panel className="xl:col-span-7" title="Latest deals" color={C.teal} tools={can('jobs', 'create') && <button onClick={() => nav('/e/jobs?new=1')} aria-label="New deal"><Plus size={17} /></button>} bodyClass="table-wrap max-h-[380px]">
            <table className="grid"><thead><tr><th>Client</th><th>Deal no.</th><th>Property</th><th>Type</th><th>Date</th><th>Stage</th></tr></thead><tbody>
              {ls.recent_jobs.length === 0 && <tr><td colSpan={6}><Empty title="No deals yet" hint="Open a deal file from a customer or an accepted quotation." action={can('jobs', 'create') && <button className="btn green" onClick={() => nav('/e/jobs?new=1')}><Plus /> New deal</button>} /></td></tr>}
              {ls.recent_jobs.map((j: any) => <tr key={j.id} className="clickable" onClick={() => nav(`/jobs/${j.id}`)}><td className="max-w-[240px] truncate">{j.client}</td><td><Link className="link" to={`/jobs/${j.id}`} onClick={e => e.stopPropagation()}>{j.job_no}</Link></td><td className="max-w-[220px] truncate">{j.property}</td><td>{j.deal_type}</td><td className="whitespace-nowrap">{fmtDate(j.deal_date)}</td><td><Badge value={j.operational_status ?? j.job_status} /></td></tr>)}</tbody></table>
          </Panel>)}

      <details className="dashboard-disclosure dashboard-workflow"><summary>Deal workflow <span>Enquiry through completion</span></summary><DailyWorkflow data={d} base={base} /></details>
      {can('ai', 'view') && <AiBrief />}
      <details className="dashboard-disclosure dashboard-business"><summary>Business details and reports <span>Figures, charts and recent activity</span></summary>
      <h2 className="dashboard-section-title">Deal activity and business results</h2>
      <DashboardOverview data={d} base={base} />

      <div className="grid gap-4 xl:grid-cols-12">
        {ch.pipeline_funnel && (
          <Panel className="xl:col-span-7" title="Deal pipeline funnel" color={C.emerald} tools={<span className="text-xs opacity-80 mr-1">deals · value ({base})</span>}>
            <div className="p-3" style={{ height: 300 }}>
              {ch.pipeline_funnel.every((s: any) => !s.count) ? <Empty title="No deals in the pipeline yet" hint="Open a deal file and it will travel through these stages." /> : (
                <ResponsiveContainer><ComposedChart data={ch.pipeline_funnel} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2dfd5" vertical={false} />
                  <XAxis dataKey="stage" tick={{ fontSize: 12.5 }} interval={0} angle={-16} textAnchor="end" height={54} />
                  <YAxis yAxisId="count" tick={{ fontSize: 13 }} width={40} allowDecimals={false} />
                  <YAxis yAxisId="value" orientation="right" tickFormatter={fmtCompact} tick={{ fontSize: 13 }} width={58} />
                  <Tooltip formatter={(v: any, name: any) => (name === 'Deals' ? v : money(v))} />
                  <Legend />
                  <Bar yAxisId="count" dataKey="count" name="Deals" fill={C.emerald} radius={[6, 6, 0, 0]} maxBarSize={54} />
                  <Bar yAxisId="value" dataKey="value" name="Value" fill={C.champagne} radius={[6, 6, 0, 0]} maxBarSize={54} />
                </ComposedChart></ResponsiveContainer>)}
            </div>
          </Panel>)}
        {ch.properties_status && (
          <Panel className="xl:col-span-5" title="Properties by status" color={C.teal}>
            <div className="p-3" style={{ height: 300 }}>
              {ch.properties_status.length === 0 ? <Empty title="No properties yet" hint="Add mandates and properties to see the portfolio mix." /> : <ResponsiveContainer><PieChart><Pie data={ch.properties_status} dataKey="value" nameKey="name" innerRadius={62} outerRadius={94} cornerRadius={6} paddingAngle={4}>{ch.properties_status.map((_: any, i: number) => <Cell key={i} fill={PIE[i % PIE.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer>}
            </div>
          </Panel>)}
        {ls.upcoming_viewings && (
          <Panel className="xl:col-span-7" title={<span className="flex items-center gap-2"><CalendarDays size={16} /> Upcoming viewings – next 7 days</span>} color={C.violet} tools={can('mandates', 'create') && <button onClick={() => nav('/e/viewings?new=1')} aria-label="New viewing"><Plus size={17} /></button>} bodyClass="table-wrap max-h-[330px]">
            {ls.upcoming_viewings.length === 0 ? <Empty title="No viewings booked" hint="Book a viewing against a mandate or a lead and it appears here." /> : <table className="grid"><thead><tr><th>When</th><th>Property</th><th>Client</th><th>Agent</th><th>Status</th></tr></thead><tbody>{ls.upcoming_viewings.map((v: any) => <tr key={v.id} className="clickable" onClick={() => nav(`/e/viewings/${v.id}`)}><td className="whitespace-nowrap text-xs">{fmtDateTime(v.scheduled_at)}</td><td className="max-w-[220px] truncate">{v.property_title}</td><td>{v.contact}</td><td>{v.agent}</td><td><Badge value={v.status} />{v.follow_up_required ? <span className="text-xs text-muted"> · follow-up</span> : null}</td></tr>)}</tbody></table>}
          </Panel>)}
        {ch.viewings_outcome && ch.viewings_outcome.length > 0 && (
          <Panel className="xl:col-span-5" title="Viewing outcomes – last 30 days" color={C.graphite}>
            <div className="p-3" style={{ height: 300 }}><ResponsiveContainer><PieChart><Pie data={ch.viewings_outcome} dataKey="value" nameKey="name" innerRadius={62} outerRadius={94} cornerRadius={6} paddingAngle={4}>{ch.viewings_outcome.map((_: any, i: number) => <Cell key={i} fill={PIE[i % PIE.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></div>
          </Panel>)}
        {ls.offers_pipeline && (
          <Panel className="xl:col-span-6" title="Offers awaiting a decision" color={C.copper} bodyClass="table-wrap max-h-[300px]">
            {ls.offers_pipeline.length === 0 ? <Empty title="No pending offers" hint="Offers submitted or under negotiation appear here." /> : <table className="grid"><thead><tr><th>Date</th><th>Property</th><th>Buyer</th><th className="num">Price ({base})</th><th>Status</th></tr></thead><tbody>{ls.offers_pipeline.map((o: any) => <tr key={o.id} className="clickable" onClick={() => nav(`/e/offers/${o.id}`)}><td className="whitespace-nowrap text-xs">{fmtDate(o.offer_date)}</td><td className="max-w-[200px] truncate">{o.property_title}</td><td>{o.buyer}</td><td className="num">{money(o.offer_price)}</td><td><Badge value={o.status} /></td></tr>)}</tbody></table>}
          </Panel>)}
        {ls.renewals && (
          <Panel className="xl:col-span-6" title="Lease renewals – next 90 days" color={C.aviation} bodyClass="table-wrap max-h-[300px]">
            {ls.renewals.length === 0 ? <Empty title="Nothing expiring soon" hint="Leases ending in the next 90 days appear here to start renewals." /> : <table className="grid"><thead><tr><th>Ends</th><th>Unit</th><th>Tenant</th><th className="num">Annual rent ({base})</th><th>Status</th></tr></thead><tbody>{ls.renewals.map((l: any) => <tr key={l.id} className="clickable" onClick={() => nav(`/e/leases/${l.id}`)}><td className="whitespace-nowrap text-xs">{fmtDate(l.end_date)}</td><td className="max-w-[200px] truncate">{l.unit_title}</td><td>{l.tenant}</td><td className="num">{money(l.annual_rent)}</td><td><Badge value={l.status} /></td></tr>)}</tbody></table>}
          </Panel>)}
        {ls.lead_queue && (
          <Panel className="xl:col-span-6" title="Lead queue – newest first" color={C.emerald} tools={can('crm', 'create') && <button onClick={() => nav('/e/leads?new=1')} aria-label="New lead"><Plus size={17} /></button>} bodyClass="table-wrap max-h-[300px]">
            {ls.lead_queue.length === 0 ? <Empty title="No open leads" hint="New enquiries queue here until they convert or close." /> : <table className="grid"><thead><tr><th>Lead</th><th>Source</th><th className="num">Est. value ({base})</th><th>Status</th></tr></thead><tbody>{ls.lead_queue.map((l: any) => <tr key={l.id} className="clickable" onClick={() => nav(`/e/leads/${l.id}`)}><td><div className="font-semibold max-w-[220px] truncate">{l.company || l.contact_name}</div>{l.contact_name && l.company ? <div className="text-xs text-muted">{l.contact_name}{l.phone ? ` · ${l.phone}` : ''}</div> : null}</td><td>{l.source}</td><td className="num">{l.est_value ? money(l.est_value) : '—'}</td><td><Badge value={l.status} /></td></tr>)}</tbody></table>}
          </Panel>)}
        {ch.sales_branch && (
          <Panel className="xl:col-span-7 dashboard-sales-panel" title="Sales by branch" color={C.ocean} tools={<span className="text-xs opacity-80 mr-1">invoiced this month · {base}</span>}>
            <div className="p-3" style={{ height: 290 }}>
              {ch.sales_branch.length === 0 ? <Empty title="No sales yet this month" hint="Invoiced revenue and unbilled deal work appear here by branch." /> : (
                <ResponsiveContainer><BarChart data={ch.sales_branch} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2dfd5" vertical={false} /><XAxis dataKey="branch" tick={{ fontSize: 14 }} /><YAxis tickFormatter={fmtCompact} tick={{ fontSize: 14 }} width={62} /><Tooltip formatter={money} /><Legend /><Bar dataKey="invoiced" name="Invoiced" fill={C.emerald} radius={[6, 6, 0, 0]} maxBarSize={90} /><Bar dataKey="unbilled" name="All work waiting to invoice" fill={C.champagne} radius={[6, 6, 0, 0]} maxBarSize={90} /></BarChart></ResponsiveContainer>)}
            </div>
          </Panel>)}
        {ls.recent_calls && (
          <Panel className="xl:col-span-5" title="Recent customer calls" color={C.violet} tools={can('crm', 'create') && <button onClick={() => nav('/e/activities?new=1&type=Call')} aria-label="Log a call"><Plus size={17} /></button>} bodyClass="max-h-[290px] overflow-auto">
            {ls.recent_calls.length === 0 ? <Empty title="No calls logged" hint="Log calls from CRM → Calls & Activities." /> : <table className="grid"><thead><tr><th>Contact / company</th><th>When</th><th>Outcome</th></tr></thead><tbody>{ls.recent_calls.map((c: any) => <tr key={c.id} className="clickable" onClick={() => nav(`/e/activities/${c.id}`)}><td><div className="font-semibold">{c.contact_name || c.company || c.subject}</div><div className="text-xs text-muted">{c.company ?? ''} {c.phone ? '· ' + c.phone : ''}</div></td><td className="whitespace-nowrap text-xs">{fmtDateTime(c.start_at)}<div className="text-muted">{c.direction}</div></td><td>{c.outcome ? <Badge value={c.outcome} tone="grey" /> : ''}</td></tr>)}</tbody></table>}
          </Panel>)}
        {ch.revenue_trend && (
          <Panel className="xl:col-span-12 dashboard-financial-panel" title="Revenue, cost & profit by deal month" color={C.emerald}>
            <div className="p-3" style={{ height: 280 }}>{ch.revenue_trend.length === 0 ? <Empty title="No deal financials yet" /> : (
              <ResponsiveContainer><ComposedChart data={ch.revenue_trend}><CartesianGrid strokeDasharray="3 3" stroke="#e2dfd5" vertical={false} /><XAxis dataKey="month" tick={{ fontSize: 14 }} /><YAxis tickFormatter={fmtCompact} tick={{ fontSize: 14 }} width={62} /><Tooltip formatter={money} /><Legend /><Bar dataKey="revenue" name="Revenue" fill={C.emerald} radius={[5, 5, 0, 0]} maxBarSize={44} /><Bar dataKey="cost" name="Cost" fill={C.copper} radius={[5, 5, 0, 0]} maxBarSize={44} /><Line type="monotone" dataKey="profit" name="Profit" stroke="var(--ink)" strokeWidth={2.5} dot={{ r: 3 }} /></ComposedChart></ResponsiveContainer>)}</div>
          </Panel>)}
        {ls.target_closes && (
          <Panel className="xl:col-span-6" title={<span className="flex items-center gap-2"><CalendarDays size={16} /> Target closes – next 10 days</span>} color={C.ocean} bodyClass="max-h-[300px] overflow-auto">
            {ls.target_closes.length === 0 ? <Empty title="No target closes in this window" hint="Set a target close date on a deal to plan the week." /> : <table className="grid"><tbody>{ls.target_closes.map((j: any) => <tr key={j.id} className="clickable" onClick={() => nav(`/jobs/${j.id}`)}><td><span className="link">{j.job_no}</span><div className="text-xs text-muted">{j.client}</div></td><td className="max-w-[220px] truncate">{j.property ?? '—'}</td><td className="whitespace-nowrap text-xs">{fmtDate(j.target_close)}</td></tr>)}</tbody></table>}
          </Panel>)}
        {ch.top_customers && ch.top_customers.length > 0 && (
          <Panel className="xl:col-span-6" title="Top customers – revenue, last 90 days" color={C.copper}>
            <div className="p-3" style={{ height: 280 }}><ResponsiveContainer><BarChart data={ch.top_customers} layout="vertical" margin={{ left: 20 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2dfd5" horizontal={false} /><XAxis type="number" tickFormatter={fmtCompact} tick={{ fontSize: 14 }} /><YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 14 }} /><Tooltip formatter={money} /><Bar dataKey="value" name="Revenue" fill={C.copper} radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer></div>
          </Panel>)}
        {ch.ar_aging && (
          <Panel className="xl:col-span-6" title="Receivables ageing" color={C.violet}>
            <div className="p-3" style={{ height: 280 }}><ResponsiveContainer><BarChart data={ch.ar_aging}><CartesianGrid strokeDasharray="3 3" stroke="#e2dfd5" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 14 }} /><YAxis tickFormatter={fmtCompact} tick={{ fontSize: 14 }} width={62} /><Tooltip formatter={money} /><Bar dataKey="value" name={`Outstanding ${base}`} radius={[6, 6, 0, 0]}>{ch.ar_aging.map((_: any, i: number) => <Cell key={i} fill={['#e3cbb5', '#c8a689', '#a37f63', '#7c5a3d', '#c32135'][i]} />)}</Bar></BarChart></ResponsiveContainer></div>
          </Panel>)}
        {ls.my_tasks && ls.my_tasks.length > 0 && (
          <Panel className="xl:col-span-12" title="My tasks & follow-ups" color={C.graphite} tools={<button onClick={() => nav('/e/tasks')} aria-label="All tasks"><ArrowRight size={16} /></button>}>
            <table className="grid"><tbody>{ls.my_tasks.map((t: any) => <tr key={t.id} className="clickable" onClick={() => nav(t.link_entity ? (t.link_entity === 'jobs' ? `/jobs/${t.link_id}` : `/e/${t.link_entity}/${t.link_id}`) : `/e/tasks/${t.id}`)}><td className="font-semibold">{t.title}</td><td className="text-muted text-xs">{t.link_label}</td><td className="whitespace-nowrap">{fmtDate(t.due_date)}</td><td><Badge value={t.priority} /></td></tr>)}</tbody></table>
          </Panel>)}
      </div>
      {stdTiles.length > 4 && <section className="mt-8" aria-label="More business figures"><h2 className="dashboard-section-title">More business figures</h2><div className="dashboard-metrics">{stdTiles.slice(4).map(t => <Kpi key={t.label} className={t.surface ? `metric-${t.surface}` : undefined} label={t.label} value={t.value ?? 0} hint={t.hint} onClick={kpiClick(t)} />)}</div></section>}
      </details>
    </div>
  )
}

function Welcome({ name, portal }: { name?: string; portal?: boolean }) {
  const { can } = useMeta()
  return <div className={cls('dashboard-welcome flex items-center gap-4 flex-wrap', !portal && 'control-welcome')}>
    <div><h1 className="m-0">{portal ? 'Your deals & documents' : 'Your business desk'}</h1><div className="text-muted">{name ? `Hello, ${name.split(' ')[0]}. ` : ''}{portal ? 'Your deals, documents and invoices in one place.' : 'See what needs attention, keep deals moving and stay on top of payments.'}</div></div>
    {!portal && <nav className="flex gap-2 flex-wrap" aria-label="Dashboard actions">{(can('crm', 'view') || can('finance', 'view') || can('admin', 'view')) && <Link className="btn outline" to="/email"><Mail size={16} />Email</Link>}<Link className="btn outline" to="/calendar"><CalendarDays size={16} />Schedule</Link>{can('jobs', 'create') && <Link className="btn dark" to="/e/jobs?new=1"><Plus size={16} />New deal</Link>}</nav>}
  </div>
}

function DashboardOverview({ data: d, base }: { data: any; base: string }) {
  const { can } = useMeta()
  const k = d.kpis ?? {}, ch = d.charts ?? {}
  const modes = ch.jobs_by_mode ?? []
  const total = modes.reduce((n: number, m: any) => n + Number(m.value || 0), 0)
  const shortcuts = [
    { label: 'Deals', to: '/e/jobs', module: 'jobs', Icon: Home },
    { label: 'Quotations', to: '/e/quotations', module: 'sales', Icon: FileText },
    { label: 'Calendar', to: '/calendar', module: '', Icon: CalendarDays },
    { label: 'All workspaces', to: '/', module: '', Icon: LayoutGrid },
  ].filter(a => !a.module || can(a.module, 'view'))
  return <section className="dashboard-top" aria-label="Business overview">
    <section className="card overview-mix"><header><h2>Open deals by type</h2><span>{total} open deals</span></header>
      {modes.length ? <><div style={{ height: 230 }}><ResponsiveContainer><PieChart><Pie data={modes} dataKey="value" nameKey="name" innerRadius={66} outerRadius={96} cornerRadius={7} paddingAngle={5}>{modes.map((_: any, i: number) => <Cell key={i} fill={PIE[i % PIE.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div><ul className="mode-legend">{modes.map((m: any, i: number) => <li key={m.name}><i style={{ background: PIE[i % PIE.length] }} />{m.name}<strong>{m.value}</strong></li>)}</ul></> : <Empty title="No open deals" hint="Your deal mix appears as deal files are opened." />}
    </section>
    <aside className="overview-account">
      <section className="card quick-work"><h2>Quick actions</h2><div>{shortcuts.map(({ label, to, Icon }) => <Link key={to} to={to} title={label} aria-label={label}><Icon size={18} /><span>{label}</span></Link>)}</div></section>
    </aside>
  </section>
}

function AiBrief() {
  const q = useQuery({ queryKey: ['ai-brief'], queryFn: () => get<{ output: string; started_at: string; name: string }>('/api/ai/brief'), retry: false })
  if (!q.data?.output) return null
  return (
    <details className="dashboard-disclosure"><summary>AI briefing <span>{q.data.name}</span></summary><Link to="/ai" className="dashboard-brief block px-4 py-3 no-underline text-ink">
      <div className="flex items-center gap-2 text-[12.5px] font-bold text-fold mb-1"><Bot size={16} /> {q.data.name} · today’s briefing <span className="font-normal text-muted">{String(q.data.started_at).replace('T', ' ').slice(0, 16)}</span><span className="flex-1" /><span className="underline">Open AI Team</span></div>
      <div dir="auto" className="text-[13.5px] whitespace-pre-line leading-relaxed brief-output">{q.data.output}</div>
    </Link></details>
  )
}



function DailyWorkflow({ data, base }: { data: any; base: string }) {
  const { can } = useMeta(), rail = useRef<HTMLDivElement>(null), [position, setPosition] = useState({ start: true, end: false })
  const k = data.kpis || {}, ls = data.lists || {}
  const steps = [
    { title: 'Enquiry and quotation', surface: 'sales', detail: 'Follow up enquiries, agree the rate and confirm the customer’s acceptance.', value: `${k.quotes_open ?? 0} open quotations`, to: '/e/quotations', module: 'sales', Icon: FileText },
    { title: 'Viewing and offer', surface: 'deal', detail: 'Open the deal file, arrange viewings and record the customer’s offer.', value: `${k.open_jobs ?? 0} open deals`, to: '/e/jobs', module: 'jobs', Icon: Home },
    { title: 'DLD and documents', surface: 'documents', detail: 'Prepare the contract and ID documents for DLD registration and escrow.', value: 'Review deal documents', to: '/documents', module: 'documents', Icon: FileText },
    { title: 'Transfer and handover', surface: 'delivery', detail: 'Arrange the transfer at the developer or the handover of keys to the tenant.', value: 'Check property handovers', to: '/e/handovers', module: 'properties', Icon: KeyRound },
    { title: 'Invoice the customer', surface: 'billing', detail: 'Check deal charges and supplier costs, then prepare and send the invoice.', value: k.unbilled === undefined ? 'Review charges waiting to invoice' : `${fmtMoney(k.unbilled, 0)} ${base} waiting to invoice`, to: '/reports?r=unbilled_charges', module: 'finance', Icon: FileText },
    { title: 'Collect payment and close', surface: 'collections', detail: 'Follow up overdue invoices, record the receipt and check the deal before closing it.', value: k.ar_overdue === undefined ? 'Review customer balances' : `${fmtMoney(k.ar_overdue, 0)} ${base} overdue`, to: '/reports?r=ar_aging', module: 'finance', Icon: Wallet },
  ].filter(s => can(s.module, 'view') && (!s.to.startsWith('/reports') || can('reports', 'view')))
  const move = (direction: number) => rail.current?.scrollBy({ left: direction * (rail.current.clientWidth * .8), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  return <section className="daily-workflow" aria-label="Daily workflow"><header className="workflow-header"><div><h2>Move each deal forward</h2><p>Start with anything that needs attention, then follow the deal through to payment.</p></div><div className="flex gap-2"><button className="btn outline icon" aria-label="Previous workflow steps" disabled={position.start} onClick={() => move(-1)}><ChevronLeft /></button><button className="btn outline icon" aria-label="Next workflow steps" disabled={position.end || steps.length < 2} onClick={() => move(1)}><ChevronRight /></button></div></header>
    <div className="workflow-carousel" ref={rail} tabIndex={0} aria-label="Deal workflow steps" onScroll={e => { const r = e.currentTarget; setPosition({ start: r.scrollLeft < 2, end: r.scrollLeft + r.clientWidth >= r.scrollWidth - 2 }) }}>{steps.map((s, i) => <Link key={s.title} to={s.to} className={`workflow-step workflow-${s.surface}`}><div className="workflow-step-head"><span>{i + 1}</span><s.Icon size={22} /></div><h3>{s.title}</h3><p>{s.detail}</p><strong>{s.value}</strong><span className="workflow-open">Open <ArrowRight size={16} /></span></Link>)}</div>
    {(ls.target_closes || ls.my_tasks) && <div className="daily-schedule"><h3>Plan deals and follow-ups</h3><div>{ls.target_closes && <Link to="/calendar"><CalendarDays size={18} /><span><b>Upcoming target closes</b><small>Confirm documents and transfers</small></span><ArrowRight size={16} /></Link>}{ls.my_tasks && can('projects', 'view') && <Link to="/e/tasks"><CalendarDays size={18} /><span><b>{k.my_tasks ?? ls.my_tasks.length} open tasks</b><small>Check your follow-ups and due dates</small></span><ArrowRight size={16} /></Link>}</div></div>}
  </section>
}

function OperationsDesk({ data }: { data: any }) {
  const { can } = useMeta()
  const lists = data.lists ?? {}, k = data.kpis ?? {}
  const events = [
    ...(lists.target_closes ?? []).map((j: any) => ({ ...j, direction: 'Target close', at: j.target_close, Icon: CalendarDays })),
    ...(lists.upcoming_viewings ?? []).map((v: any) => ({ ...v, property: v.property_title, job_no: v.viewing_no, direction: 'Viewing', at: v.scheduled_at, Icon: CalendarDays, deal_type: 'Viewing' })),
  ].sort((a, b) => String(a.at ?? '').localeCompare(String(b.at ?? ''))).slice(0, 5)
  return <section className="operations-desk" aria-label="Deal desk">
    <div className="desk-heading"><div><h2>Next on the deal desk</h2><p>Target closes and viewings planned over the next ten days.</p></div><Link className="btn outline" to="/calendar"><CalendarDays size={17} />Open schedule</Link></div>
    {can('jobs', 'view') && <div className="movement-rail" aria-label="Upcoming deal milestones">{events.length ? events.map((j, i) => <Link className="movement-ticket" key={`${j.direction}-${j.id}-${i}`} to={j.direction === 'Viewing' ? `/e/viewings/${j.id}` : `/jobs/${j.id}`}><span className="movement-kind"><j.Icon size={19} />{j.direction}<span>{fmtDate(j.at)}</span></span><strong>{j.property || 'Property pending'}<ArrowRight size={18} />{j.deal_type || 'Deal'}</strong><span className="movement-client">{j.contact || j.client || 'Customer'}{j.job_no ? `· ${j.job_no}` : ''}</span><span className="movement-action">{j.direction === 'Viewing' ? 'Open viewing' : 'Review deal'} <ChevronRight size={16} /></span></Link>) : <div className="movement-empty"><Home size={28} /><div><strong>Your next target closes will appear here</strong><p>Add a target close date to a deal to plan the week ahead.</p></div>{can('jobs', 'create') && <Link className="btn dark" to="/e/jobs?new=1">Open a deal <ArrowRight size={16} /></Link>}</div>}</div>}
    <div className="desk-summary">{k.open_jobs !== undefined && <span><Home size={17} /><b>{k.open_jobs}</b> open deals</span>}{k.in_transit !== undefined && <span><Workflow size={17} /><b>{k.in_transit}</b> in pipeline</span>}{k.viewings_week !== undefined && <span><CalendarDays size={17} /><b>{k.viewings_week}</b> viewings this week</span>}{k.my_tasks !== undefined && <span><CalendarDays size={17} /><b>{k.my_tasks}</b> follow-ups to do</span>}<span className="desk-owner">SWK Properties L.L.C.</span></div>
  </section>
}
