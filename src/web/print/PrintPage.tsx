import { documentNotice, documentRecipient, useDocumentSeal } from '@shared/document-presentation'
import { CorporateFooter } from '../components/CorporateFooter'
import { DocumentPrinter } from '../components/ui/document-printer'
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useIsFetching, useQuery } from '@tanstack/react-query'
import QRCode from 'qrcode'
import { ArrowLeft, Printer } from 'lucide-react'
import { get } from '../lib/api'
import { useMeta } from '../lib/meta'
import { ErrorBox } from '../ui/kit'
import { fmtDate, fmtMoney, fmtNum, fmtRoe, todayIso } from '../lib/format'
import { amountInWords } from '@shared/words'
import { StudioDoc } from '../pages/StudioPage'

const S = () => useMeta().meta!.settings
export function Letterhead() {
  const s = S()
  return (
    <div className="flex items-start justify-between gap-6 pb-3 mb-4" style={{ borderBottom: '3px solid #0b1a33' }}>
      <img src="/brand/swk-logo-ink.png" alt={s.company_name} style={{ height: 52 }} />
      <div style={{ textAlign: 'right', fontSize: 10.5, lineHeight: 1.45 }}><b style={{ fontSize: 12.5 }}>{s.company_name}</b><div style={{ whiteSpace: 'pre-line' }}>{s.company_address}</div>{s.company_phone && <div>Tel {s.company_phone}</div>}<div>{s.company_email}{s.company_info_email && s.company_info_email !== s.company_email ? ` · ${s.company_info_email}` : ''}{s.company_website ? ` · ${String(s.company_website).replace(/^https?:\/\//, '')}` : ''}</div></div>
    </div>
  )
}
const Title = ({ children, sub, watermark }: { children: ReactNode; sub?: ReactNode; watermark?: string }) => <div className="flex items-end justify-between mb-3 relative"><h1>{children}</h1><div style={{ textAlign: 'right' }}>{sub}</div>{watermark && <div style={{ position: 'absolute', left: '28%', top: 40, transform: 'rotate(-12deg)', fontSize: 54, fontWeight: 800, color: '#c32135', opacity: 0.12, pointerEvents: 'none', whiteSpace: 'nowrap' }}>{watermark}</div>}</div>
const Box = ({ label, children, className }: { label: string; children: ReactNode; className?: string }) => <div className={`box ${className ?? ''}`}><div className="lbl">{label}</div><div style={{ whiteSpace: 'pre-line' }}>{children || ' '}</div></div>
const Grid = ({ cols = 3, children }: { cols?: number; children: ReactNode }) => <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8, marginBottom: 10 }}>{children}</div>
const Kv = ({ items }: { items: [string, ReactNode][] }) => <div className="box" style={{ padding: 0 }}><table style={{ margin: 0 }}><tbody>{items.filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => <tr key={k}><td className="lbl" style={{ width: '42%', border: 0, padding: '3px 10px' }}>{k}</td><td style={{ border: 0, padding: '3px 10px', fontWeight: 600 }}>{v}</td></tr>)}</tbody></table></div>
const R = ({ children }: { children: ReactNode }) => <td style={{ textAlign: 'right' }}>{children}</td>
function Sign({ labels }: { labels: string[] }) { labels = labels.filter(l => !['For SWK Properties L.L.C.', 'Prepared by', 'Reviewed by', 'Approved by', 'Received by'].includes(l)); if (!labels.length) return null; return <div style={{ display: 'grid', gridTemplateColumns: `repeat(${labels.length}, 1fr)`, gap: 28, marginTop: 46 }}>{labels.map(l => <div key={l} style={{ borderTop: '1px solid #444', paddingTop: 4, fontSize: 10, textAlign: 'center' }}>{l}</div>)}</div> }
const Presentation = createContext<{ entity: string; record?: any; seal: boolean }>({ entity: '', seal: false })
function Foot({ children }: { children?: ReactNode }) {
  const settings = S(), presentation = useContext(Presentation)
  const footer = children ?? settings.invoice_footer
  return <footer className="document-footer">
    {footer && footer !== 'This is a computer-generated document.' && <div>{footer}</div>}
    <div className="document-issuance"><div><strong>{documentNotice(presentation.entity, presentation.record)}</strong></div>
      {presentation.seal && settings.document_seal && <img className="document-seal" src={settings.document_seal} alt="SWK Properties L.L.C. company seal" />}
    </div>
    <CorporateFooter />
  </footer>
}
function Recipient({ record }: { record: any }) {
  return <div className="document-recipient"><span>To</span><strong>{documentRecipient(record)}</strong>{record?._labels?.contact_id && <div>Attention: {record._labels.contact_id}</div>}</div>
}
const addr = (p: any) => [p?.address1, p?.address2, [p?.city, p?.state].filter(Boolean).join(', '), p?._labels?.country_id, p?.po_box && `PO Box ${p.po_box}`].filter(Boolean).join('\n')
const party = (p: any, includeTrn = false) => p ? `${p.name}\n${addr(p)}${includeTrn && p.trn ? `\nTRN ${p.trn}` : ''}${p.phone ? `\nTel ${p.phone}` : ''}${p.email ? `\nEmail ${p.email}` : ''}` : ''

function useRec(entity: string, id: string) { return useQuery({ queryKey: ['print', entity, id], queryFn: () => get<any>(`/api/e/${entity}/${id}`) }) }

function InvoiceDoc({ r }: { r: any }) {
  const s = S(); const p = useQuery({ queryKey: ['print-party', r.party_id], queryFn: async () => (await get<any>(`/api/print/invoices/${r.id}/parties`))[r.party_id] })
  const bank = useQuery({ queryKey: ['print-bank', r.bank_account_id], enabled: !!r.bank_account_id, queryFn: () => get<any>(`/api/e/bank_accounts/${r.bank_account_id}`) })
  if (p.error || bank.error) return <ErrorBox error={p.error || bank.error} />
  const lines = r.children.lines as any[]; const credit = r.doc_type === 'Credit Note'
  const fx = lines.some(l => l.line_ccy)
  const taxed = lines.some(l => Number(l.vat_pct) > 0) || r.vat_total > 0
  const includeTrn = s.vat_registered !== false && ['Tax Invoice', 'Credit Note', 'Debit Note'].includes(r.doc_type)
  const title = r.doc_type === 'Tax Invoice' ? (s.vat_registered === false ? 'INVOICE' : 'TAX INVOICE') : r.doc_type.toUpperCase()
  return (<>
    <Title watermark={r.status === 'Draft' ? 'DRAFT' : r.status === 'Void' ? 'VOID' : undefined} sub={<><div style={{ fontSize: 15, fontWeight: 800 }}>{r.invoice_no}</div><div style={{ color: '#6b7488' }}>{fmtDate(r.invoice_date)}{r.status !== 'Posted' ? ` · ${r.status}` : ''}</div></>}>{title}</Title>
    <Grid cols={2}><Box label="Bill to">{p.data ? party(p.data, includeTrn) : r._labels.party_id}</Box><Kv items={[['Document no.', r.invoice_no], ['Date', fmtDate(r.invoice_date)], ['Date of supply', r.supply_date ? fmtDate(r.supply_date) : ''], ['Due date', fmtDate(r.due_date)], ['Currency', r.currency], ['Our deal ref.', r._labels.job_id], ['Customer ref.', r.reference], ['Against invoice', r._labels.original_invoice_id], ['Reason', r.credit_reason], ['Exchange rate', r.currency !== 'AED' ? `1 ${r.currency} = ${fmtRoe(r.ex_rate)} AED` : ''], ['Supplier TRN', includeTrn ? s.company_trn : '']]} /></Grid>
    <table><thead><tr><th style={{ width: 24 }}>#</th><th>Charge description</th>{fx ? <><th>Ccy</th><th style={{ textAlign: 'right' }}>Unit rate</th><th style={{ textAlign: 'right' }}>Qty</th><th style={{ textAlign: 'right' }}>ROE</th><th style={{ textAlign: 'right' }}>Amount</th></> : <><th style={{ textAlign: 'right' }}>Qty</th><th>Unit</th><th style={{ textAlign: 'right' }}>Rate</th><th style={{ textAlign: 'right' }}>Net</th></>}<th style={{ textAlign: 'right' }}>VAT %</th>{taxed && <th style={{ textAlign: 'right' }}>VAT</th>}<th style={{ textAlign: 'right' }}>Total {r.currency}</th></tr></thead><tbody>
      {lines.map((l, i) => <tr key={l.id}><td>{i + 1}</td><td>{l.description}</td>{fx ? <><td>{l.line_ccy || r.currency}</td><R>{fmtMoney(l.rate)}</R><R>{fmtNum(l.qty)}</R><R>{l.line_ccy ? fmtRoe(l.line_roe) : ''}</R><R>{fmtMoney(l.line_ccy ? Math.round(l.qty * l.rate * 100) / 100 : l.amount)}</R></> : <><R>{fmtNum(l.qty)}</R><td>{l.unit}</td><R>{fmtMoney(l.rate)}</R><R>{fmtMoney(l.amount)}</R></>}<R>{fmtNum(l.vat_pct)}%</R>{taxed && <R>{fmtMoney(l.vat_amount)}</R>}<R>{fmtMoney(l.line_total)}</R></tr>)}</tbody></table>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, marginTop: 10, alignItems: 'flex-start' }}>
      <div style={{ flex: 1, fontSize: 11 }}><div className="lbl" style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.06em', color: '#6b7488', fontWeight: 700 }}>Amount in words</div><div style={{ fontWeight: 600, marginTop: 2 }}>{amountInWords(r.total, r.currency)}</div></div>
      <table style={{ width: '46%' }}><tbody><tr><td>{credit ? 'Total credit' : 'Total charges'} ({r.currency})</td><R>{fmtMoney(r.subtotal)}</R></tr><tr><td>VAT amount ({r.currency})</td><R>{fmtMoney(r.vat_total)}</R></tr>{r.currency !== 'AED' && r.vat_total > 0 && <tr><td>VAT in AED @ {fmtRoe(r.ex_rate)}</td><R>{fmtMoney(r.vat_total * r.ex_rate)}</R></tr>}{!!r.rounding && <tr><td>Rounding adjustment ({r.currency})</td><R>{fmtMoney(r.rounding)}</R></tr>}<tr style={{ fontWeight: 800, fontSize: 13, background: '#f2ede2' }}><td>{credit ? 'TOTAL CREDIT' : 'TOTAL DUE'} {r.currency}</td><R>{fmtMoney(r.total)}</R></tr>{r.currency !== 'AED' && <tr><td style={{ color: '#6b7488' }}>Total in AED @ {fmtRoe(r.ex_rate)}</td><R>{fmtMoney(r.base_total)}</R></tr>}{r.paid_amount > 0 && <tr><td>Paid</td><R>{fmtMoney(r.paid_amount)}</R></tr>}{r.balance > 0 && r.paid_amount > 0 && <tr style={{ fontWeight: 700 }}><td>Balance</td><R>{fmtMoney(r.balance)}</R></tr>}</tbody></table></div>
    <Grid cols={2}>{(bank.data || s.bank_details) && <Box label="Payment details">{bank.data ? `${bank.data.name}\n${bank.data.bank_name ?? ''}\nIBAN ${bank.data.iban ?? ''}  SWIFT ${bank.data.swift ?? ''}\nCurrency ${bank.data.currency}` : s.bank_details}</Box>}<Box label="Terms & notes">{[r.notes, r.terms].filter(Boolean).join('\n\n')}</Box></Grid>
    <Foot />
  </>)
}

function QuoteDoc({ r }: { r: any }) {
  const p = useQuery({ queryKey: ['print-party', r.customer_id], queryFn: async () => (await get<any>(`/api/print/quotations/${r.id}/parties`))[r.customer_id] })
  if (p.error) return <ErrorBox error={p.error} />
  const lines = r.children.lines as any[]; const L = r._labels
  return (<>
    <Title watermark={r.status === 'Draft' ? 'DRAFT' : undefined} sub={<><div style={{ fontSize: 15, fontWeight: 800 }}>{r.quote_no}</div><div style={{ color: '#6b7488' }}>Revision {r.revision}</div></>}>QUOTATION</Title>
    <Grid cols={2}><Box label="Prepared for">{p.data ? party(p.data) : L.customer_id}{L.contact_id ? `\nAttn: ${L.contact_id}` : ''}</Box><Kv items={[['Date', fmtDate(r.quote_date)], ['Valid until', fmtDate(r.valid_until)], ['Service', r.mode], ['Prepared by', L.salesperson_id], ['Currency', r.currency]]} /></Grid>
    {r.notes && <Grid cols={1}><Box label="Scope & notes">{r.notes}</Box></Grid>}
    <table><thead><tr><th>Charge description</th><th>Basis</th><th style={{ textAlign: 'right' }}>Qty</th><th style={{ textAlign: 'right' }}>Rate</th><th style={{ textAlign: 'right' }}>Amount</th><th style={{ textAlign: 'right' }}>VAT</th></tr></thead><tbody>{lines.map(l => <tr key={l.id}><td>{l.description}</td><td>{l.basis}</td><R>{fmtNum(l.qty)}</R><R>{fmtMoney(l.rate)}</R><R>{fmtMoney(l.amount)}</R><R>{fmtMoney(l.vat_amount)}</R></tr>)}</tbody></table>
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}><table style={{ width: '42%' }}><tbody><tr><td>Total ({r.currency})</td><R>{fmtMoney(r.subtotal)}</R></tr><tr><td>VAT</td><R>{fmtMoney(r.vat_total)}</R></tr><tr style={{ fontWeight: 800, background: '#f2ede2' }}><td>Total incl. VAT</td><R>{fmtMoney(r.total)}</R></tr></tbody></table></div>
    <Box label="Terms & conditions" className="mt-3"><span style={{ fontSize: 10 }}>{r.terms}</span></Box>
    <Sign labels={['For SWK Properties L.L.C.', 'Accepted by customer (name, signature, date)']} /><Foot>Quotation valid until {fmtDate(r.valid_until)}. Fees are as stated; government fees and disbursements are shown separately where applicable. {S().invoice_footer}</Foot>
  </>)
}

function VoucherDoc({ r, kind }: { r: any; kind: 'receipt' | 'payment' }) {
  const L = r._labels; const isR = kind === 'receipt'
  return (<>
    <Title sub={<div style={{ fontSize: 15, fontWeight: 800 }}>{isR ? r.receipt_no : r.payment_no}</div>} watermark={r.status !== 'Posted' ? r.status.toUpperCase() : undefined}>{isR ? 'RECEIPT VOUCHER' : 'PAYMENT VOUCHER'}</Title>
    <Grid cols={2}><Box label={isR ? 'Received from' : 'Paid to'}>{isR ? L.party_id : L.vendor_id}</Box><Kv items={[['Date', fmtDate(isR ? r.receipt_date : r.payment_date)], ['Method', r.method], [isR ? 'Deposited to' : 'Paid from', L.bank_account_id], ['Reference', r.reference], ['Currency', r.currency]]} /></Grid>
    <div className="box" style={{ textAlign: 'center', padding: 16, marginBottom: 10 }}><div className="lbl">Amount</div><div style={{ fontSize: 26, fontWeight: 800 }}>{r.currency} {fmtMoney(r.amount)}</div></div>
    {r.children.allocations.length > 0 && <table><thead><tr><th>Applied to</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead><tbody>{r.children.allocations.map((a: any) => <tr key={a.id}><td>{a._labels.invoice_id ?? a._labels.bill_id}</td><R>{fmtMoney(a.amount)}</R></tr>)}</tbody></table>}
    {r.unallocated > 0 && <p>On account / unallocated: <b>{fmtMoney(r.unallocated)}</b></p>}{r.notes && <p>{r.notes}</p>}
    <Sign labels={[isR ? 'Received by' : 'Prepared by', isR ? 'Customer' : 'Approved by', isR ? '' : 'Received by (vendor)'].filter(Boolean)} /><Foot />
  </>)
}

function GenericDoc({ r, title, items, lines, cols }: { r: any; title: string; items: [string, ReactNode][]; lines?: any[]; cols?: { h: string; f: (l: any) => ReactNode; right?: boolean }[] }) {
  return (<>
    <Title sub={<div style={{ fontSize: 15, fontWeight: 800 }}>{r._title}</div>}>{title}</Title>
    <Kv items={items} />
    {lines && cols && <table style={{ marginTop: 10 }}><thead><tr>{cols.map(c => <th key={c.h} style={{ textAlign: c.right ? 'right' : 'left' }}>{c.h}</th>)}</tr></thead><tbody>{lines.map((l, i) => <tr key={i}>{cols.map(c => c.right ? <R key={c.h}>{c.f(l)}</R> : <td key={c.h}>{c.f(l)}</td>)}</tr>)}</tbody></table>}
    <Foot />
  </>)
}

function DealDoc({ j }: { j: any }) {
  const L = j._labels; const [qr, setQr] = useState('')
  useEffect(() => { void QRCode.toDataURL(`${location.origin}/e/jobs/${j.id}`, { margin: 0, width: 140 }).then(setQr) }, [j.id])
  return (<>
    <Title sub={<><div style={{ fontSize: 16, fontWeight: 800 }}>{j.job_no}</div><div style={{ color: '#6b7488' }}>{j.job_status} · {fmtDate(j.deal_date)}</div></>}>DEAL FILE REPORT</Title>
    <Grid cols={3}><Kv items={[['Deal', j.deal_name], ['Type', j.deal_type], ['Client', L.client_id], ['Owner / landlord', L.owner_id], ['Branch', L.branch_id]]} /><Kv items={[['Property', L.property_id], ['Unit', L.unit_id], ['Listing agent', L.agent_id], ['Buyer agent', L.buyer_agent_id], ['Mandate', L.mandate_id]]} /><Kv items={[['Status', j.job_status], ['Stage', j.operational_status], ['Deal value', `AED ${fmtMoney(j.deal_value)}`], ['Commission', `${fmtNum(j.commission_pct)}% — AED ${fmtMoney(j.commission_amount)}`], ['Target close', fmtDate(j.target_close)], ['Actual close', fmtDate(j.actual_close)]]} /></Grid>
    <div className="lbl" style={{ margin: '10px 0 3px' }}>Commission & charges</div><table><thead><tr><th>Type</th><th>Charge</th><th>Party</th><th style={{ textAlign: 'right' }}>Qty</th><th style={{ textAlign: 'right' }}>Rate</th><th>Cur</th><th style={{ textAlign: 'right' }}>Amount</th><th style={{ textAlign: 'right' }}>AED</th><th>Status</th></tr></thead><tbody>{j.children.charges.map((c: any) => <tr key={c.id}><td>{c.kind}</td><td>{c.description}</td><td>{c._labels.party_id}</td><R>{fmtNum(c.qty)}</R><R>{fmtMoney(c.rate)}</R><td>{c.currency}</td><R>{fmtMoney(c.amount)}</R><R>{fmtMoney(c.base_amount)}</R><td>{c.status}</td></tr>)}</tbody></table>
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}><table style={{ width: '40%' }}><tbody><tr><td>Revenue (AED)</td><R>{fmtMoney(j.total_revenue)}</R></tr><tr><td>Cost (AED)</td><R>{fmtMoney(j.total_cost)}</R></tr><tr style={{ fontWeight: 800, background: '#f2ede2' }}><td>Agency profit (AED)</td><R>{fmtMoney(j.profit)}</R></tr></tbody></table></div>
    {j.children.events.length > 0 && <><div className="lbl" style={{ margin: '10px 0 3px' }}>Deal timeline</div><table><tbody>{[...j.children.events].sort((a: any, b: any) => String(a.event_date).localeCompare(String(b.event_date))).map((e: any) => <tr key={e.id}><td style={{ width: 120 }}>{fmtDate(e.event_date)}</td><td>{e.event_type}</td><td>{[e._labels.user_id, e.description].filter(Boolean).join(' – ')}</td></tr>)}</tbody></table></>}
    {j.notes && <Grid cols={1}><Box label="Internal notes">{j.notes}</Box></Grid>}
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>{qr && <img src={qr} alt="" style={{ height: 64 }} />}<div style={{ fontSize: 10.5, color: '#6b7488' }}>Scan to open the deal file in the system.<br />Cancelled deals are void for marketing purposes; values are as per posted accounting entries.</div></div>
    <Foot>Internal document — contains cost and commission information. Printed {fmtDate(todayIso())}.</Foot>
  </>)
}

function StatementDoc({ partyId }: { partyId: string }) {
  const [params, setParams] = useSearchParams()
  const from = params.get('from') || todayIso().slice(0, 4) + '-01-01', to = params.get('to') || todayIso()
  const setRange = (key: string, value: string) => setParams(p => { p.set(key, value); return p }, { replace: true })
  const q = useQuery({ queryKey: ['statement', partyId, from, to], queryFn: () => get<any>(`/api/finance/statement/${partyId}`, { from, to }) })
  const s = q.data
  if (q.error) return <ErrorBox error={q.error} />
  return (<>
    <div className="no-print" style={{ display: 'flex', gap: 8, marginBottom: 12 }}><input className="input" type="date" value={from} aria-label="Statement from date" onChange={e => setRange('from', e.target.value)} style={{ width: 160 }} /><input className="input" type="date" value={to} aria-label="Statement to date" onChange={e => setRange('to', e.target.value)} style={{ width: 160 }} /></div>
    {s && <Recipient record={{ _labels: { party_id: s.party.name } }} />}
    <Title sub={<div>{fmtDate(from)} – {fmtDate(to)}</div>}>STATEMENT OF ACCOUNT</Title>
    {!s ? <DocumentPrinter /> : <><Grid cols={2}><Box label="Account">{`${s.party.name}\n${s.party.code}`}</Box><Kv items={[['Opening balance (AED)', fmtMoney(s.opening)], ['Closing balance (AED)', fmtMoney(s.closing)]]} /></Grid>
      <table><thead><tr><th>Date</th><th>Type</th><th>Document</th><th>Description</th><th style={{ textAlign: 'right' }}>Debit</th><th style={{ textAlign: 'right' }}>Credit</th><th style={{ textAlign: 'right' }}>Balance</th></tr></thead><tbody><tr><td colSpan={6}><i>Opening balance</i></td><R>{fmtMoney(s.opening)}</R></tr>{s.rows.map((r: any, i: number) => <tr key={i}><td>{fmtDate(r.date)}</td><td>{r.type}</td><td>{r.doc_no}</td><td>{r.description}</td><R>{r.debit ? fmtMoney(r.debit) : ''}</R><R>{r.credit ? fmtMoney(r.credit) : ''}</R><R>{fmtMoney(r.balance)}</R></tr>)}<tr style={{ fontWeight: 800, background: '#f2ede2' }}><td colSpan={6}>Closing balance (AED) — positive = amount due to SWK OS</td><R>{fmtMoney(s.closing)}</R></tr></tbody></table><Foot>Please notify us of any discrepancy within 7 days. {S().invoice_footer}</Foot></>}
  </>)
}

export function PrintPage() {
  const { entity = '', id = '' } = useParams(); const [sp, setSp] = useSearchParams(); const nav = useNavigate()
  const { meta } = useMeta()
  const seal = useDocumentSeal(sp.get('seal'), !!meta?.settings.document_seal_default)
  const sheet = useRef<HTMLDivElement>(null), [ready, setReady] = useState(false)
  const fetching = useIsFetching({ predicate: query => /^(print|statement)/.test(String(query.queryKey[0])) })
  useEffect(() => {
    setReady(false)
    const timer = window.setTimeout(() => setReady(!!sheet.current && !sheet.current.querySelector('.document-loading, [role=alert]') && fetching === 0), 0)
    return () => window.clearTimeout(timer)
  }, [fetching, entity, id, sp.toString(), meta])
  const ids = entity === 'jobs' ? id.split(',') : [id]
  const q = useQuery({ queryKey: ['print-all', entity, id], enabled: entity !== 'statement' && entity !== 'parties', queryFn: () => Promise.all(ids.map(i => get<any>(`/api/e/${entity}/${i}`))) })
  if (!meta) return <DocumentPrinter />
  const body = (() => {
    if (entity === 'statement' || entity === 'parties') return <Presentation.Provider value={{ entity, seal }}><Letterhead /><StatementDoc partyId={id} /></Presentation.Provider>
    if (q.error) return <ErrorBox error={q.error} />
    if (!q.data) return <DocumentPrinter />
    const rs = q.data
    return rs.map((r, i) => {
      const e = <Presentation.Provider key={r.id} value={{ entity, record: r, seal }}><div className="print-document" style={{ pageBreakAfter: i < rs.length - 1 ? 'always' : 'auto' }}>{entity === 'studio_documents' ? (r.letterhead ? <Letterhead /> : null) : <><Letterhead /><Recipient record={r} /></>}{(() => { switch (entity) {
        case 'studio_documents': return <StudioDoc r={r} seal={seal} sealImage={meta.settings.document_seal} />
        case 'invoices': return <InvoiceDoc r={r} />
        case 'quotations': return <QuoteDoc r={r} />
        case 'receipts': return <VoucherDoc r={r} kind="receipt" />
        case 'payments': return <VoucherDoc r={r} kind="payment" />
        case 'jobs': return <DealDoc j={r} />
        case 'payslips': return <GenericDoc r={r} title="PAYSLIP" items={[['Employee', r._labels.employee_id], ['Period', r.period], ['Basic', fmtMoney(r.basic)], ['Allowances', fmtMoney(r.allowances)], ['Overtime', fmtMoney(r.overtime)], ['Deductions', fmtMoney(r.deductions)], ['Net pay (AED)', fmtMoney(r.net_pay)], ['Status', r.status]]} />
        case 'purchase_orders': return <GenericDoc r={r} title="PURCHASE ORDER" items={[['PO no.', r.po_no], ['Supplier', r._labels.vendor_id], ['Date', fmtDate(r.po_date)], ['Expected', fmtDate(r.expected_date)], ['Total', `${r.currency} ${fmtMoney(r.total)}`]]} lines={r.children.lines} cols={[{ h: 'Description', f: (l: any) => l.description }, { h: 'Qty', f: (l: any) => fmtNum(l.qty), right: true }, { h: 'Rate', f: (l: any) => fmtMoney(l.rate), right: true }, { h: 'Amount', f: (l: any) => fmtMoney(l.amount), right: true }, { h: 'VAT', f: (l: any) => fmtMoney(l.vat_amount), right: true }]} />
        default: return <GenericDoc r={r} title={r._title} items={Object.entries(r).filter(([k, v]) => !k.startsWith('_') && typeof v !== 'object' && v !== null && !['id', 'version', 'created_by', 'updated_by'].includes(k)).slice(0, 24).map(([k, v]) => [k.replace(/_/g, ' '), String(v)] as [string, ReactNode])} />
      } })()}</div></Presentation.Provider>
      return e
    })
  })()
  return (
    <div>
      <div className="no-print flex gap-2 mb-4 items-center flex-wrap"><button className="btn grey" onClick={() => nav(-1)}><ArrowLeft /> Back</button><button className="btn green" disabled={!ready} onClick={() => window.print()}><Printer /> Print / Save as PDF</button><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={seal} disabled={!meta.settings.document_seal} onChange={e => setSp(p => { p.set('seal', e.target.checked ? '1' : '0'); return p }, { replace: true })} />Include company seal</label>{!meta.settings.document_seal && <span className="text-xs text-muted">Upload the seal in Company settings → Document text.</span>}<span className="text-xs text-muted">In the print dialog choose “Save as PDF” to create a file.</span></div>
      <div className="print-preview"><div ref={sheet} className={`print-sheet${entity === 'studio_documents' && q.data?.[0]?.orientation === 'Landscape' ? ' studio-landscape' : ''}`} data-print-ready={ready ? "true" : "false"}>{body}</div></div>
    </div>
  )
}


