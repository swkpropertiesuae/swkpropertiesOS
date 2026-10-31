import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Scale, Plus, CheckCircle2, ShieldCheck, XCircle, Banknote, FileText } from 'lucide-react'
import { get, post } from '../../lib/api'
import { useMeta } from '../../lib/meta'
import { RefSelect } from '../../components/RefSelect'
import { Badge, Loading, Modal, PageHeader } from '../../ui/kit'
import { useToast } from '../../lib/toast'
import { fmtMoney } from '../../lib/format'

const PAYMENT_MODES = [
  'SWK Company Bank Account (Wire / IBAN)',
  'Developer DLD Escrow Account',
  'Manager Cheque (UAE Licensed Bank)',
  'Post-Dated Cheques (PDC)',
  'Worldwide Currency Exchange (Licensed UAE Exchange House)',
  'USDT / Crypto (VARA-Licensed Gateway to Company Account)',
]

const SITUATIONS = [
  'Developer Project Delay / Modification',
  'Developer Unit Cancellation',
  'Seller Default (Form F Clause)',
  'Client Default / Change of Mind',
  'Client Mortgage Rejection (Pre-Approval Contingency)',
  'Mutual Cancellation Agreement',
  'Force Majeure / DLD Regulatory Hold',
]

export default function WithdrawalsPage() {
  const { me, can } = useMeta()
  const toast = useToast()
  const qc = useQueryClient()
  const isOwner = me?.permissions === '*'
  const canReview = isOwner || can('sales', 'approve')
  const [openNew, setOpenNew] = useState(false)
  const [form, setForm] = useState({
    department_division: 'Sales of Off-Plan Projects',
    job_id: null as number | null,
    property_id: null as number | null,
    client_id: null as number | null,
    withdrawn_by: 'Client / Buyer',
    situation_category: 'Client Default / Change of Mind',
    payment_mode_received: 'SWK Company Bank Account (Wire / IBAN)',
    amount_paid_by_client: 150000,
    agreed_forfeiture_pct: 10,
    agreed_terms_at_payment: 'Per signed Booking Form / Form F MOU: 100% full refund if Developer/Seller defaults or bank mortgage contingency triggers; 10% booking deposit forfeiture if Buyer defaults without cause.',
    reason_details: '',
    refund_payment_mode: 'SWK Company Bank Wire (IBAN)',
    refund_iban_or_wallet: '',
  })

  const q = useQuery({
    queryKey: ['swk-withdrawals'],
    queryFn: () => get<{ items: any[] }>('/api/swk-ops/withdrawals'),
  })

  const reload = () => void qc.invalidateQueries({ queryKey: ['swk-withdrawals'] })

  const computedForfeit = Math.round(Number(form.amount_paid_by_client || 0) * (Number(form.agreed_forfeiture_pct || 0) / 100))
  const computedRefund = Math.max(0, Number(form.amount_paid_by_client || 0) - computedForfeit)

  const handleSituationChange = (withdrawnBy: string, sit: string) => {
    let pct = form.agreed_forfeiture_pct
    if (withdrawnBy.includes('Developer') || withdrawnBy.includes('Seller') || sit.includes('Cancellation') || sit.includes('Delay') || sit.includes('Mortgage Rejection') || sit.includes('Force Majeure')) {
      pct = 0
    } else if (sit.includes('Mutual')) {
      pct = 5
    } else {
      pct = 10
    }
    setForm(f => ({ ...f, withdrawn_by: withdrawnBy, situation_category: sit, agreed_forfeiture_pct: pct }))
  }

  const createWithdrawal = async () => {
    if (!form.client_id || !form.reason_details.trim()) {
      toast.error('Please select the client and enter the detailed withdrawal situation and payment terms.')
      return
    }
    try {
      await post('/api/swk-ops/withdrawals', {
        ...form,
        deduction_forfeiture_amount: computedForfeit,
        refundable_to_client: computedRefund,
      })
      toast.ok('Deal withdrawal & client refund assessment logged — leadership alerted')
      setOpenNew(false)
      reload()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const managerReview = async (id: number) => {
    try {
      await post(`/api/swk-ops/withdrawals/${id}/manager-review`, {
        manager_recommendation: 'Verified payment receipt & signed agreement terms; recommended for Owner Shabib Siraj final sign-off.',
      })
      toast.ok('Manager review recorded — sent to Owner Shabib Siraj')
      reload()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const ownerDecide = async (id: number, decision: 'approve' | 'refund_paid' | 'reject') => {
    try {
      await post(`/api/swk-ops/withdrawals/${id}/owner-approve`, {
        decision,
        refund_reference: decision === 'refund_paid' ? `SWK-REF-${Date.now().toString().slice(-6)}` : undefined,
      })
      toast.ok(`Owner Shabib Siraj marked withdrawal as ${decision === 'refund_paid' ? 'Refund Paid' : decision === 'approve' ? 'Owner Approved' : 'Rejected'}`)
      reload()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  if (q.isLoading) return <Loading />
  const items = q.data?.items ?? []

  return (
    <div className="fade-in space-y-5">
      <PageHeader
        icon={<Scale size={20} />}
        title="Deal Withdrawals & Client Refund Settlement"
        subtitle="Handles post-closing or post-booking withdrawal by Developer, Seller, or Client — calculating legal refund vs forfeiture strictly per payment type, amount paid, and agreed terms."
        actions={
          <div className="flex items-center gap-2">
            <button className="btn green" onClick={() => setOpenNew(true)}>
              <Plus size={15} /> Log Deal Withdrawal & Refund Case
            </button>
            <Link className="btn outline" to="/e/deal_withdrawals">
              <FileText size={15} /> Table View
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="card p-4 border-l-4 border-[#BE984C]">
          <div className="text-xs font-bold uppercase tracking-wider text-muted">Developer / Seller Withdrawal Rule</div>
          <div className="text-sm font-semibold text-ink mt-1">100% Full Refund of Client Funds</div>
          <div className="text-xs text-muted mt-1">When a developer cancels/delays or a secondary seller defaults on Form F, 0% deduction is applied to the buyer.</div>
        </div>
        <div className="card p-4 border-l-4 border-[#174B3B]">
          <div className="text-xs font-bold uppercase tracking-wider text-muted">Client Withdrawal / Mortgage Contingency</div>
          <div className="text-sm font-semibold text-ink mt-1">Per Signed Booking / Form F Terms</div>
          <div className="text-xs text-muted mt-1">Bank rejection under pre-approval contingency = 100% refund; voluntary buyer default = agreed forfeiture % deducted.</div>
        </div>
        <div className="card p-4 border-l-4 border-[#7E3039]">
          <div className="text-xs font-bold uppercase tracking-wider text-muted">Strict UAE Legal Refund Channel</div>
          <div className="text-sm font-semibold text-ink mt-1">Company Bank / Escrow / Licensed VARA</div>
          <div className="text-xs text-muted mt-1">No funds or refunds ever pass through a Sales Advisor’s personal account. Owner Shabib Siraj approves all settlements.</div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="p-4 border-b border-line flex items-center justify-between">
          <div className="font-display font-extrabold text-base text-ink">Active & Historical Deal Withdrawals ({items.length})</div>
          <Badge value={isOwner ? 'Owner Shabib Siraj — Final Refund Approver' : 'Manager Review & Settlement Workflow'} tone={isOwner ? 'green' : 'blue'} />
        </div>
        {items.length === 0 ? (
          <div className="p-10 text-center text-muted">No deal withdrawals logged yet. Click “Log Deal Withdrawal & Refund Case” to record one.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="grid">
              <thead>
                <tr>
                  <th>Ref</th>
                  <th>Department & Client</th>
                  <th>Withdrawn By / Situation</th>
                  <th>Original Payment Mode</th>
                  <th className="num">Paid by Client</th>
                  <th className="num">Deduction</th>
                  <th className="num">Refundable</th>
                  <th>Status</th>
                  <th>Workflow Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((w: any) => {
                  const paid = Number(w.amount_paid_by_client || 0) / 100
                  const ded = Number(w.deduction_forfeiture_amount || 0) / 100
                  const ref = Number(w.refundable_to_client || 0) / 100
                  return (
                    <tr key={w.id}>
                      <td>
                        <Link className="font-mono font-bold text-gold hover:underline" to={`/e/deal_withdrawals/${w.id}`}>
                          {w.withdrawal_no}
                        </Link>
                        <div className="text-xs text-muted">{w.withdrawal_date}</div>
                      </td>
                      <td>
                        <div className="font-bold text-ink">{w.client_name || `Client #${w.client_id}`}</div>
                        <div className="text-xs text-muted">{w.department_division} {w.property_title ? `· ${w.property_title}` : ''}</div>
                      </td>
                      <td>
                        <div className="font-semibold text-sm">{w.withdrawn_by}</div>
                        <div className="text-xs text-muted">{w.situation_category}</div>
                      </td>
                      <td>
                        <div className="text-xs font-medium">{w.payment_mode_received}</div>
                        <div className="text-[11px] text-muted">Refund via: {w.refund_payment_mode}</div>
                      </td>
                      <td className="num font-semibold">{fmtMoney(paid)}</td>
                      <td className="num text-signal font-semibold">{fmtMoney(ded)} ({w.agreed_forfeiture_pct ?? 0}%)</td>
                      <td className="num font-extrabold text-[#174B3B]">{fmtMoney(ref)}</td>
                      <td>
                        <Badge
                          value={w.status}
                          tone={w.status === 'Refund Paid' || w.status === 'Owner Approved' ? 'green' : w.status === 'Rejected' ? 'red' : 'amber'}
                        />
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {w.status === 'Pending Review' && canReview && (
                            <button className="btn outline sm" onClick={() => void managerReview(w.id)}>
                              <CheckCircle2 size={13} /> Manager Review
                            </button>
                          )}
                          {(w.status === 'Pending Review' || w.status === 'Manager Reviewed - Awaiting Owner') && isOwner && (
                            <>
                              <button className="btn green sm" onClick={() => void ownerDecide(w.id, 'approve')}>
                                <ShieldCheck size={13} /> Owner Approve
                              </button>
                              <button className="btn red sm" onClick={() => void ownerDecide(w.id, 'reject')}>
                                <XCircle size={13} /> Reject
                              </button>
                            </>
                          )}
                          {w.status === 'Owner Approved' && isOwner && (
                            <button className="btn green sm" onClick={() => void ownerDecide(w.id, 'refund_paid')}>
                              <Banknote size={13} /> Mark Refund Paid
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {openNew && (
        <Modal
          open
          onClose={() => setOpenNew(false)}
          title="Log Deal Withdrawal & Calculate Legal Client Refund"
          width={760}
          footer={<>
            <button className="btn outline" onClick={() => setOpenNew(false)}>Cancel</button>
            <div className="flex-1" />
            <button className="btn green" onClick={() => void createWithdrawal()}>Submit Withdrawal & Alert Owner / Manager</button>
          </>}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label">Department Division</label>
              <select className="input" value={form.department_division} onChange={e => setForm(f => ({ ...f, department_division: e.target.value }))}>
                <option>Sales of Off-Plan Projects</option>
                <option>Secondary Projects</option>
                <option>Leasing</option>
              </select>
            </div>
            <div>
              <label className="label">Client / Buyer / Tenant <span className="req">*</span></label>
              <RefSelect entity="parties" value={form.client_id} onChange={id => setForm(f => ({ ...f, client_id: id }))} />
            </div>
            <div>
              <label className="label">Linked Deal File (Optional)</label>
              <RefSelect entity="jobs" value={form.job_id} onChange={id => setForm(f => ({ ...f, job_id: id }))} />
            </div>
            <div>
              <label className="label">Linked Property / Unit (Optional)</label>
              <RefSelect entity="properties" value={form.property_id} onChange={id => setForm(f => ({ ...f, property_id: id }))} />
            </div>
            <div>
              <label className="label">Withdrawn By</label>
              <select className="input" value={form.withdrawn_by} onChange={e => handleSituationChange(e.target.value, form.situation_category)}>
                <option>Client / Buyer</option>
                <option>Developer</option>
                <option>Secondary Seller / Landlord</option>
                <option>Mutual Agreement</option>
              </select>
            </div>
            <div>
              <label className="label">Situation Category</label>
              <select className="input" value={form.situation_category} onChange={e => handleSituationChange(form.withdrawn_by, e.target.value)}>
                {SITUATIONS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Original Legal Payment Mode Received</label>
              <select className="input" value={form.payment_mode_received} onChange={e => setForm(f => ({ ...f, payment_mode_received: e.target.value }))}>
                {PAYMENT_MODES.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Amount Paid by Client (AED) <span className="req">*</span></label>
              <input className="input" type="number" value={form.amount_paid_by_client} onChange={e => setForm(f => ({ ...f, amount_paid_by_client: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="label">Agreed Forfeiture / Deduction (%)</label>
              <input className="input" type="number" step="0.5" min="0" max="100" value={form.agreed_forfeiture_pct} onChange={e => setForm(f => ({ ...f, agreed_forfeiture_pct: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="label">Refund Settlement Channel</label>
              <select className="input" value={form.refund_payment_mode} onChange={e => setForm(f => ({ ...f, refund_payment_mode: e.target.value }))}>
                <option>SWK Company Bank Wire (IBAN)</option>
                <option>Developer Escrow Refund Cheque</option>
                <option>Manager Cheque to Client</option>
                <option>Return of Undeposited PDC Cheques</option>
                <option>Licensed UAE Exchange House Refund</option>
                <option>VARA-Licensed USDT / Crypto Return to Verified Client Wallet</option>
              </select>
            </div>
            <div className="md:col-span-2 p-3 rounded-xl bg-soft border border-line flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="text-xs text-muted uppercase font-bold">Automatic Terms-Based Settlement Calculation</div>
                <div className="text-sm mt-0.5">
                  Client Paid: <strong>{fmtMoney(form.amount_paid_by_client)}</strong> − Agreed Deduction ({form.agreed_forfeiture_pct}%): <strong className="text-signal">{fmtMoney(computedForfeit)}</strong>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted uppercase font-bold">Net Refundable to Client</div>
                <div className="text-xl font-display font-extrabold text-[#174B3B]">{fmtMoney(computedRefund)}</div>
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="label">Terms Agreed at Time of Payment</label>
              <textarea className="textarea" rows={2} value={form.agreed_terms_at_payment} onChange={e => setForm(f => ({ ...f, agreed_terms_at_payment: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <label className="label">Detailed Reason & Situation Narrative <span className="req">*</span></label>
              <textarea className="textarea" rows={3} placeholder="Describe why the withdrawal occurred, attach contract clause reference, and state refund instructions…" value={form.reason_details} onChange={e => setForm(f => ({ ...f, reason_details: e.target.value }))} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
