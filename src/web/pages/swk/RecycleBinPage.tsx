import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Trash2, ShieldCheck, CheckCircle2, XCircle, AlertTriangle, Plus, ExternalLink, History, Gavel } from 'lucide-react'
import { get, post } from '../../lib/api'
import { useMeta } from '../../lib/meta'
import { Badge, Loading, Modal, PageHeader } from '../../ui/kit'
import { useToast } from '../../lib/toast'

export default function RecycleBinPage() {
  const { me } = useMeta()
  const toast = useToast()
  const qc = useQueryClient()
  const isOwner = me?.permissions === '*'
  const [tab, setTab] = useState<'bin' | 'decisions'>('bin')
  const [ownerNote, setOwnerNote] = useState('')
  const [decidingItem, setDecidingItem] = useState<{ item: any; decision: 'approve' | 'reject' } | null>(null)
  const [newDecisionOpen, setNewDecisionOpen] = useState(false)
  const [decForm, setDecForm] = useState({ subject: '', category: 'Operational Policy / Budget Decision', reason: '', amount: '' })

  const binQ = useQuery({
    queryKey: ['swk-recycle-bin'],
    queryFn: () => get<{ items: any[]; counts: { pending: number; approved: number; rejected: number } }>('/api/swk-ops/recycle-bin'),
  })

  const decQ = useQuery({
    queryKey: ['swk-admin-decisions'],
    queryFn: () => get<{ items: any[] }>('/api/swk-ops/admin-decisions'),
  })

  const reload = () => {
    void qc.invalidateQueries({ queryKey: ['swk-recycle-bin'] })
    void qc.invalidateQueries({ queryKey: ['swk-admin-decisions'] })
  }

  const executeBinDecision = async () => {
    if (!decidingItem) return
    try {
      await post(`/api/swk-ops/recycle-bin/${decidingItem.item.id}/decide`, {
        decision: decidingItem.decision,
        owner_notes: ownerNote || undefined,
      })
      toast.ok(
        decidingItem.decision === 'approve'
          ? `Owner approved permanent deletion of ${decidingItem.item.record_title}`
          : `Owner rejected deletion — ${decidingItem.item.record_title} restored`,
      )
      setDecidingItem(null)
      setOwnerNote('')
      reload()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const submitAdminDecision = async () => {
    if (!decForm.subject.trim() || !decForm.reason.trim()) {
      toast.error('Please enter both subject and detailed reasoning for Owner Shabib Siraj.')
      return
    }
    try {
      await post('/api/swk-ops/admin-decisions', {
        subject: decForm.subject.trim(),
        category: decForm.category,
        reason: decForm.reason.trim(),
        amount: Number(decForm.amount || 0),
      })
      toast.ok('Administrative decision submitted to Owner Shabib Siraj for approval')
      setNewDecisionOpen(false)
      setDecForm({ subject: '', category: 'Operational Policy / Budget Decision', reason: '', amount: '' })
      reload()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const decideAdminDecision = async (id: number, decision: 'Approved' | 'Rejected') => {
    try {
      await post(`/api/swk-ops/admin-decisions/${id}/owner-decide`, {
        decision,
        comment: `${decision} by Owner Shabib Siraj`,
      })
      toast.ok(`Administrative decision ${decision.toLowerCase()} by Owner`)
      reload()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  if (binQ.isLoading || decQ.isLoading) return <Loading />

  const items = binQ.data?.items ?? []
  const counts = binQ.data?.counts ?? { pending: 0, approved: 0, rejected: 0 }
  const decisions = decQ.data?.items ?? []

  return (
    <div className="fade-in space-y-5">
      <PageHeader
        icon={<Trash2 size={20} />}
        title="Pending Delete Bin & Owner Governance Approvals"
        subtitle="All record deletions & Manager administrative decisions require mandatory reasons, audit logging, and final approval from Owner Shabib Siraj."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <button className="btn green" onClick={() => setNewDecisionOpen(true)}>
              <Plus size={15} /> Submit Manager Decision for Owner Approval
            </button>
            <Link className="btn outline" to="/admin/audit">
              <History size={15} /> Full Audit Log
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="card p-4 border-l-4 border-[#BE984C]">
          <div className="text-xs font-bold uppercase tracking-wider text-muted">Pending Owner Deletion Approval</div>
          <div className="text-2xl font-display font-extrabold text-ink mt-1">{counts.pending}</div>
          <div className="text-xs text-muted mt-1">Held safely in Bin until Shabib Siraj approves</div>
        </div>
        <div className="card p-4 border-l-4 border-[#174B3B]">
          <div className="text-xs font-bold uppercase tracking-wider text-muted">Rejected & Restored Records</div>
          <div className="text-2xl font-display font-extrabold text-ink mt-1">{counts.rejected}</div>
          <div className="text-xs text-muted mt-1">Protected from unauthorized deletion</div>
        </div>
        <div className="card p-4 border-l-4 border-[#7E3039]">
          <div className="text-xs font-bold uppercase tracking-wider text-muted">Approved & Deleted by Owner</div>
          <div className="text-2xl font-display font-extrabold text-ink mt-1">{counts.approved}</div>
          <div className="text-xs text-muted mt-1">Permanently executed with full audit snapshot</div>
        </div>
        <div className="card p-4 border-l-4 border-blue-600">
          <div className="text-xs font-bold uppercase tracking-wider text-muted">Pending Manager Admin Decisions</div>
          <div className="text-2xl font-display font-extrabold text-ink mt-1">{decisions.filter(d => d.status === 'Pending').length}</div>
          <div className="text-xs text-muted mt-1">Mohammad Haseeb → Shabib Siraj sign-off queue</div>
        </div>
      </div>

      <div className="flex gap-2 border-b border-line pb-2">
        <button
          className={`btn ${tab === 'bin' ? 'green' : 'outline'}`}
          onClick={() => setTab('bin')}
        >
          <Trash2 size={15} /> Pending Delete Bin ({items.length})
        </button>
        <button
          className={`btn ${tab === 'decisions' ? 'green' : 'outline'}`}
          onClick={() => setTab('decisions')}
        >
          <Gavel size={15} /> Manager Admin Decisions ({decisions.length})
        </button>
      </div>

      {tab === 'bin' ? (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-line flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="font-display font-extrabold text-base text-ink">Pending Delete Bin (Recycle Bin)</div>
              <div className="text-xs text-muted">
                When any user deletes a record, they must state a specific reason. Owner (Shabib Siraj), Manager (Mohammad Haseeb), and IT/BDM (Talha Shabbir) are alerted immediately. Only Owner Shabib Siraj can approve permanent deletion.
              </div>
            </div>
            <Badge value={isOwner ? 'Signed in as Owner (Full Approval Authority)' : 'View & Request Mode (Owner Approval Required)'} tone={isOwner ? 'green' : 'amber'} />
          </div>
          {items.length === 0 ? (
            <div className="p-10 text-center text-muted">No deletion requests in the Recycle Bin.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="grid">
                <thead>
                  <tr>
                    <th>Bin Ref</th>
                    <th>Module / Record</th>
                    <th>Requested By</th>
                    <th>Mandatory Deletion Reason</th>
                    <th>Status</th>
                    <th>Owner Decision / Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r: any) => (
                    <tr key={r.id}>
                      <td className="font-mono font-bold text-xs">{r.bin_no}</td>
                      <td>
                        <div className="font-bold text-ink">{r.record_title}</div>
                        <div className="text-xs text-muted flex items-center gap-2">
                          <span>{r.entity} #{r.record_id}</span>
                          {r.status !== 'Approved & Deleted' && (
                            <Link className="text-gold hover:underline inline-flex items-center gap-0.5" to={`/e/${r.entity}/${r.record_id}`}>
                              View Record <ExternalLink size={11} />
                            </Link>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="font-semibold text-sm">{r.requested_by_name || `User #${r.requested_by_id}`}</div>
                        <div className="text-xs text-muted">{String(r.requested_at || '').replace('T', ' ').slice(0, 16)}</div>
                      </td>
                      <td className="max-w-md">
                        <div className="text-sm font-medium text-ink">{r.reason}</div>
                        {r.owner_notes && <div className="text-xs text-muted mt-0.5">Owner Note: {r.owner_notes}</div>}
                      </td>
                      <td>
                        <Badge
                          value={r.status}
                          tone={r.status === 'Pending Owner Approval' ? 'amber' : r.status === 'Approved & Deleted' ? 'red' : 'green'}
                        />
                      </td>
                      <td>
                        {r.status === 'Pending Owner Approval' ? (
                          isOwner ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                className="btn red sm"
                                onClick={() => { setOwnerNote(''); setDecidingItem({ item: r, decision: 'approve' }) }}
                              >
                                <CheckCircle2 size={13} /> Owner Approve Delete
                              </button>
                              <button
                                className="btn outline sm"
                                onClick={() => { setOwnerNote(''); setDecidingItem({ item: r, decision: 'reject' }) }}
                              >
                                <XCircle size={13} /> Reject & Keep
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted inline-flex items-center gap-1">
                              <AlertTriangle size={13} /> Awaiting Owner Shabib Siraj
                            </span>
                          )
                        ) : (
                          <div className="text-xs text-muted">
                            Decided by <strong>{r.decided_by_name || 'Owner Shabib Siraj'}</strong>
                            <div>{String(r.decided_at || '').replace('T', ' ').slice(0, 16)}</div>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-line flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="font-display font-extrabold text-base text-ink">Manager Administrative Decisions — Owner Shabib Siraj Approval Queue</div>
              <div className="text-xs text-muted">
                Mohammad Haseeb (Manager) handles day-to-day operations with majority access, and submits any administrative decision here for Owner Shabib Siraj approval before execution.
              </div>
            </div>
          </div>
          {decisions.length === 0 ? (
            <div className="p-10 text-center text-muted">No administrative decision requests found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="grid">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Category</th>
                    <th>Submitted By</th>
                    <th>Decision & Reasoning</th>
                    <th>Status</th>
                    <th>Owner Action</th>
                  </tr>
                </thead>
                <tbody>
                  {decisions.map((d: any) => (
                    <tr key={d.id}>
                      <td className="font-mono font-bold">#{d.id}</td>
                      <td className="font-semibold">{d.action}</td>
                      <td>
                        <div className="font-semibold">{d.requested_by_name || `User #${d.requested_by}`}</div>
                        <div className="text-xs text-muted">{String(d.requested_at || '').replace('T', ' ').slice(0, 16)}</div>
                      </td>
                      <td className="max-w-md">
                        <div className="text-sm text-ink">{d.reason}</div>
                        {d.decision_note && <div className="text-xs text-muted mt-0.5">Owner Note: {d.decision_note}</div>}
                      </td>
                      <td>
                        <Badge value={d.status} tone={d.status === 'Approved' ? 'green' : d.status === 'Rejected' ? 'red' : 'amber'} />
                      </td>
                      <td>
                        {d.status === 'Pending' ? (
                          isOwner ? (
                            <div className="flex items-center gap-1.5">
                              <button className="btn green sm" onClick={() => void decideAdminDecision(d.id, 'Approved')}>
                                <ShieldCheck size={13} /> Approve
                              </button>
                              <button className="btn red sm" onClick={() => void decideAdminDecision(d.id, 'Rejected')}>
                                <XCircle size={13} /> Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted">Awaiting Owner Shabib Siraj</span>
                          )
                        ) : (
                          <span className="text-xs text-muted">Decided by {d.decided_by_name || 'Owner'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {decidingItem && (
        <Modal
          open
          onClose={() => setDecidingItem(null)}
          title={decidingItem.decision === 'approve' ? `Owner Approve Permanent Deletion (${decidingItem.item.bin_no})` : `Owner Reject Deletion & Keep Record (${decidingItem.item.bin_no})`}
          width={500}
          footer={<>
            <button className="btn outline" onClick={() => setDecidingItem(null)}>Cancel</button>
            <div className="flex-1" />
            <button className={`btn ${decidingItem.decision === 'approve' ? 'red' : 'green'}`} onClick={() => void executeBinDecision()}>
              {decidingItem.decision === 'approve' ? 'Confirm Permanent Delete' : 'Reject Deletion & Keep Record'}
            </button>
          </>}
        >
          <div className="grid gap-3">
            <div className="p-3 rounded-xl bg-soft border border-line text-sm">
              <div className="font-bold">{decidingItem.item.record_title}</div>
              <div className="text-xs text-muted mt-1">Reason submitted by {decidingItem.item.requested_by_name}: "{decidingItem.item.reason}"</div>
            </div>
            <div>
              <label className="label">Owner Decision Note (Optional)</label>
              <textarea className="textarea" rows={3} value={ownerNote} onChange={e => setOwnerNote(e.target.value)} placeholder="Add Owner Shabib Siraj decision note for the Audit Log…" />
            </div>
          </div>
        </Modal>
      )}

      {newDecisionOpen && (
        <Modal
          open
          onClose={() => setNewDecisionOpen(false)}
          title="Submit Manager Administrative Decision for Owner Approval"
          width={540}
          footer={<>
            <button className="btn outline" onClick={() => setNewDecisionOpen(false)}>Cancel</button>
            <div className="flex-1" />
            <button className="btn green" onClick={() => void submitAdminDecision()}>Send to Owner Shabib Siraj</button>
          </>}
        >
          <div className="grid gap-3">
            <div>
              <label className="label">Decision Subject <span className="req">*</span></label>
              <input className="input" placeholder="e.g. Approve Q4 Bayut Featured Credits / Adjust Commission Override" value={decForm.subject} onChange={e => setDecForm(f => ({ ...f, subject: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Decision Category</label>
                <select className="input" value={decForm.category} onChange={e => setDecForm(f => ({ ...f, category: e.target.value }))}>
                  <option>Operational Policy / Budget Decision</option>
                  <option>HR / Staff Visa / Onboarding Decision</option>
                  <option>Portal Marketing Spend (Bayut / Dubizzle)</option>
                  <option>Special Commission / A2A Split Exception</option>
                  <option>Client Refund / Deal Settlement</option>
                </select>
              </div>
              <div>
                <label className="label">Financial Impact (AED)</label>
                <input className="input" type="number" placeholder="0" value={decForm.amount} onChange={e => setDecForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="label">Detailed Reasoning & Operational Justification <span className="req">*</span></label>
              <textarea className="textarea" rows={4} placeholder="Explain the operational context and recommendation for Owner Shabib Siraj…" value={decForm.reason} onChange={e => setDecForm(f => ({ ...f, reason: e.target.value }))} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
