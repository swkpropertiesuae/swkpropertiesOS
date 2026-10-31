import { useEffect, useMemo, useState } from 'react'
import { Save, X, Tags as TagsIcon, ListPlus } from 'lucide-react'
import type { FieldDef } from '@shared/types'
import { useMeta, type MetaEntity } from '../lib/meta'
import { get, post, put } from '../lib/api'
import { FieldInput, CellValue } from './Fields'
import { ChildEditor, previewRow, type Row } from './ChildEditor'
import { Modal, Loading, Badge } from '../ui/kit'
import { useToast } from '../lib/toast'
import { cls, fmtMoney, nowIsoLocal, todayIso } from '../lib/format'
import { useVatRates } from '../lib/lookups'


function initial(def: MetaEntity, record: Row | null, presets: Row | undefined, meId: number | undefined): Row {
  const v: Row = {}
  for (const f of def.fields) {
    if (record && f.name in record) { v[f.name] = record[f.name]; continue }
    let d: any = f.default
    if (d === 'today') d = todayIso(); else if (d === 'now') d = nowIsoLocal(); else if (d === 'me') d = meId ?? null
    v[f.name] = d ?? (f.type === 'bool' ? false : null)
  }
  return { ...v, ...(presets ?? {}) }
}

export function sectionsOf(fields: FieldDef[], allFields?: FieldDef[]): { name: string; fields: FieldDef[] }[] {
  const out: { name: string; fields: FieldDef[] }[] = []
  let cur = ''
  const vis = new Set(fields.map(f => f.name)); for (const f of (allFields ?? fields)) {
    if (f.section) cur = f.section; if (!vis.has(f.name)) continue
    let s = out.find(x => x.name === (cur || 'Details'))
    if (!s) { s = { name: cur || 'Details', fields: [] }; out.push(s) }
    s.fields.push(f)
  }
  return out
}

export function EntityForm({ def, record, presets, onSaved, onCancel, lockedOnEdit = [], childKeys, title }: { def: MetaEntity; record: Row | null; presets?: Row; onSaved: (rec: Row) => void; onCancel: () => void; lockedOnEdit?: string[]; childKeys?: string[]; title?: string }) {
  const { me, def: getDef } = useMeta()
  const toast = useToast()
  const vat = useVatRates()
  const edit = !!record?.id
  const [vals, setVals] = useState<Row>(() => initial(def, record, presets, me?.id))
  const [labels, setLabels] = useState<Record<string, string>>(record?._labels ?? {})
  const [custom, setCustom] = useState<Row>(record?.custom ?? {})
  const [kids, setKids] = useState<Record<string, Row[]>>(() => {
    const o: Record<string, Row[]> = {}
    for (const c of def.children ?? []) if (!childKeys || childKeys.includes(c.key)) o[c.key] = (record?.children?.[c.key] ?? []).map((r: Row) => ({ ...r }))
    return o
  })
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  const [banner, setBanner] = useState('')
  const [saving, setSaving] = useState(false)
  const [picker, setPicker] = useState<null | 'docs'>(null)
  const [auditReason, setAuditReason] = useState('')

  const fields = useMemo(() => def.fields.filter(f => {
    if (f.hidden || f.secret) return false
    if (!edit && (f.readonly || f.computed)) return false
    return true
  }), [def, edit])
  const sections = useMemo(() => sectionsOf(fields, def.fields), [fields, def.fields])
  const kidDefs = (def.children ?? []).filter(c => !childKeys || childKeys.includes(c.key))
  const set = (name: string, v: any, label?: string) => { setVals(x => ({ ...x, [name]: v })); setErrors(e => (e[name] ? { ...e, [name]: false } : e)); if (label !== undefined) setLabels(l => ({ ...l, [name]: label })) }
  const parentView = { ...vals, __currency: vals.currency }

  const submit = async () => {
    const miss: Record<string, boolean> = {}
    for (const f of fields) if (f.required && !f.readonly && !f.computed && (vals[f.name] === null || vals[f.name] === undefined || vals[f.name] === '')) miss[f.name] = true
    for (const f of customDefs) if (f.required && (custom[f.name] === null || custom[f.name] === undefined || custom[f.name] === '')) miss['cf:' + f.name] = true
    if (Object.keys(miss).length) { setErrors(miss); setBanner('Please complete the highlighted required fields.'); return }
    if (edit && auditReason.trim().length < 3) {
      setBanner('Please specify the reason for editing this record (recorded in Audit Log and alerted to Owner, Manager & IT).')
      return
    }
    setSaving(true); setBanner('')
    try {
      const body: Row = {}
      for (const f of def.fields) {
        if (f.secret || f.hidden) continue
        if (f.readonly || f.computed) continue
        const v = vals[f.name]
        if (f.virtual && (v === null || v === undefined || v === '')) continue
        body[f.name] = v === '' ? null : v
      }
      if (customDefs.length) body.custom = custom
      if (kidDefs.length) body.children = Object.fromEntries(kidDefs.map(c => [c.key, kids[c.key].map(r => { const { _labels, ...rest } = r; return Object.fromEntries(Object.entries(rest).filter(([k]) => !k.startsWith('__'))) })]))
      if (edit) {
        body.version = record!.version
        body._audit_reason = auditReason.trim()
      }
      const saved = edit
        ? await put<Row>(`/api/e/${def.key}/${record!.id}`, body, { 'x-swk-audit-reason': encodeURIComponent(auditReason.trim()) })
        : await post<Row>(`/api/e/${def.key}`, body)
      toast.ok(edit ? `${def.label} updated & logged to Audit Trail` : `${def.label} created`)
      onSaved(saved)
    } catch (e: any) { setBanner(e.message ?? 'Could not save'); if (e.details?.field) setErrors({ [e.details.field]: true }) }
    finally { setSaving(false) }
  }

  const customDefs = def.customFieldDefs ?? []
  const locked = (f: FieldDef) => edit && (lockedOnEdit.includes(f.name) || false)

  return (
    <form className="entity-form" onSubmit={e => { e.preventDefault(); void submit() }}>
      <div className="entity-form-content">
      {banner && <div role="alert" className="mb-4 px-3 py-2.5 rounded-lg bg-blush border border-[#f2bcc3] text-[#8f1325] text-sm font-medium">{banner}</div>}
      {def.description && !edit && <p className="text-sm text-muted mb-4 mt-0">{def.description}</p>}
      {sections.map((s, si) => (
        <div key={s.name} className={cls('swk-form-section', si > 0 && 'mt-6')}>
          {(sections.length > 1 || s.name !== 'Details') && <div className="swk-form-section-title">{s.name}</div>}
          <div className="swk-form-grid">
            {s.fields.map(f => {
              const ro = f.computed || f.readonly
              return (
                <div key={f.name} className={cls('swk-form-field', f.span === 3 && 'span-3', f.span === 2 && 'span-2')}>
                  <label className="label" htmlFor={`f-${f.name}`}>{f.label}{f.required && !ro && <span className="req">*</span>}</label>
                  <div className="swk-control-wrap">
                    {ro || locked(f) ? <div className="min-h-[42px] flex items-center font-bold text-ink text-[14px] px-3 rounded-xl bg-soft border border-line"><CellValue f={f} rec={{ ...vals, _labels: labels }} /></div>
                      : <FieldInput writingModule={def.module} f={f} value={vals[f.name]} label={labels[f.name]} invalid={errors[f.name]} onChange={(v, l) => set(f.name, v, l)} />}
                  </div>
                  <div className="swk-field-foot">{f.help && <div className="help">{f.help}</div>}</div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
      {customDefs.length > 0 && (
        <div className="swk-form-section mt-6">
          <div className="swk-form-section-title">Custom fields</div>
          <div className="swk-form-grid">
            {customDefs.map(f => <div key={f.name} className="swk-form-field"><label className="label">{f.label}{f.required && <span className="req">*</span>}</label><div className="swk-control-wrap"><FieldInput writingModule={def.module} f={f} value={custom[f.name]} invalid={errors['cf:' + f.name]} onChange={v => setCustom(c => ({ ...c, [f.name]: v }))} /></div><div className="swk-field-foot" /></div>)}
          </div>
        </div>
      )}
      {kidDefs.map(c => (
        <div key={c.key} className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <div className="font-display font-extrabold text-[13px] uppercase tracking-wider text-fold">{c.label}</div>
            <div className="flex gap-2">
              {(def.key === 'receipts' || def.key === 'payments') && <button type="button" className="btn outline sm" disabled={!(vals.party_id || vals.vendor_id)} onClick={() => setPicker('docs')}><ListPlus /> Pick open {def.key === 'receipts' ? 'invoices' : 'bills'}</button>}
            </div>
          </div>
          <ChildEditor child={c} rows={kids[c.key] ?? []} onChange={r => setKids(k => ({ ...k, [c.key]: r }))} parent={parentView} />
        </div>
      ))}
      {edit && (
        <div className="swk-form-section mt-6" style={{ borderColor: 'rgba(190, 152, 76, 0.45)', background: 'rgba(190, 152, 76, 0.06)' }}>
          <div className="swk-form-section-title">Mandatory Edit Reason — Audit Log & Leadership Notification</div>
          <div className="swk-form-field">
            <label className="label" htmlFor="f-audit-reason">Reason for editing this record <span className="req">*</span></label>
            <input
              id="f-audit-reason"
              className="input"
              required
              placeholder="Explain why this record is being modified (sent to Owner Shabib Siraj, Manager Mohammad Haseeb & IT Talha Shabbir)…"
              value={auditReason}
              onChange={e => setAuditReason(e.target.value)}
            />
            <div className="help mt-1">Every edit is permanently timestamped in the Audit Log and notifies Owner, Manager & IT Admin.</div>
          </div>
        </div>
      )}
      </div>
      <div className="entity-form-actions flex items-center gap-3 border-t border-line bg-card">
        <button type="submit" className="btn green" disabled={saving}><Save /> {saving ? 'Saving…' : edit ? 'Save Changes' : `Create ${def.label}`}</button>
        <button type="button" className="btn red" onClick={onCancel}><X /> Cancel</button>
        <span className="text-xs text-muted ml-auto hidden md:block">Fields marked <span className="text-signal font-bold">*</span> are required</span>
      </div>
      {picker === 'docs' && <OpenDocsPicker kind={def.key === 'receipts' ? 'receipt' : 'payment'} partyId={vals.party_id ?? vals.vendor_id} currency={vals.currency} existing={kids.allocations ?? []} onClose={() => setPicker(null)} onPick={rows => { setKids(k => ({ ...k, allocations: rows })); const sum = rows.reduce((s, r) => s + Number(r.amount || 0), 0); if (!vals.amount || vals.amount < sum) set('amount', Math.round(sum * 100) / 100); setPicker(null) }} />}
    </form>
  )
}

function OpenDocsPicker({ kind, partyId, currency, existing, onClose, onPick }: { kind: 'receipt' | 'payment'; partyId: number; currency?: string; existing: Row[]; onClose: () => void; onPick: (rows: Row[]) => void }) {
  const [docs, setDocs] = useState<Row[] | null>(null)
  const [amt, setAmt] = useState<Record<number, number>>({})
  useEffect(() => { get<Row[]>(kind === 'receipt' ? '/api/finance/open-invoices' : '/api/finance/open-bills', { [kind === 'receipt' ? 'party_id' : 'vendor_id']: partyId, currency }).then(d => { setDocs(d); const m: Record<number, number> = {}; for (const x of existing) m[x[kind === 'receipt' ? 'invoice_id' : 'bill_id']] = x.amount; setAmt(m) }).catch(() => setDocs([])) }, [])
  const key = kind === 'receipt' ? 'invoice_id' : 'bill_id'
  return (
    <Modal open onClose={onClose} title={kind === 'receipt' ? 'Open invoices' : 'Open bills'} width={760} footer={<><div className="flex-1" /><button className="btn outline" onClick={onClose}>Close</button><button className="btn green" onClick={() => onPick((docs ?? []).filter(d => amt[d.id] > 0).map(d => ({ [key]: d.id, amount: amt[d.id], _labels: { [key]: d.invoice_no ?? d.bill_no } })))}>Apply allocation</button></>}>
      {!docs ? <Loading /> : docs.length === 0 ? <div className="text-center text-muted py-8">No open documents{currency ? ` in ${currency}` : ''} for this party.</div> : (
        <table className="grid"><thead><tr><th>Document</th><th>Date</th><th>Due</th><th>Cur</th><th className="num">Balance</th><th className="num" style={{ width: 150 }}>Allocate</th></tr></thead><tbody>
          {docs.map(d => <tr key={d.id}><td className="font-bold">{d.invoice_no ?? d.bill_no}{d.vendor_invoice_no && <div className="text-xs text-muted">{d.vendor_invoice_no}</div>}</td><td>{d.invoice_date ?? d.bill_date}</td><td>{d.due_date}</td><td>{d.currency}</td><td className="num">{fmtMoney(d.balance)}</td>
            <td><div className="flex gap-1"><input className="input text-right" type="number" step="0.01" min="0" max={d.balance} value={amt[d.id] ?? ''} onChange={e => setAmt(a => ({ ...a, [d.id]: Number(e.target.value) }))} /><button type="button" className="btn outline sm" onClick={() => setAmt(a => ({ ...a, [d.id]: d.balance }))}>Full</button></div></td></tr>)}
        </tbody></table>)}
    </Modal>
  )
}

export function EntityFormModal({ entity, id, presets, onClose, onSaved, lockedOnEdit, childKeys, title, width }: { entity: string; id?: number; presets?: Row; onClose: () => void; onSaved: (r: Row) => void; lockedOnEdit?: string[]; childKeys?: string[]; title?: string; width?: number }) {
  const { def } = useMeta()
  const d = def(entity)
  const [rec, setRec] = useState<Row | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => { if (id) get<Row>(`/api/e/${entity}/${id}`).then(setRec).catch(e => setErr(e.message)) }, [id, entity])
  return (
    <Modal open onClose={onClose} persistent title={title ?? (id ? `Edit ${d.label}` : `New ${d.label}`)} width={width ?? (d.fields.filter(f => !f.hidden).length > 10 || (d.children?.length ?? 0) > 0 ? 960 : 720)}>
      {err ? <div className="text-signal">{err}</div> : id && !rec ? <Loading /> : <EntityForm def={d} record={rec} presets={presets} onCancel={onClose} onSaved={onSaved} lockedOnEdit={lockedOnEdit} childKeys={childKeys} />}
    </Modal>
  )
}
void Badge

