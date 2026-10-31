import type { ReactNode } from 'react'
import { post, put, get } from './api'

export interface ActionHelpers {
  rec: any; entity: string; userId?: number
  toast: { ok: (t: string) => void; error: (t: string) => void }
  dlg: { confirm: (o: any) => Promise<boolean>; prompt: (o: any) => Promise<string | null> }
  nav: (to: string) => void; reload: () => void; can: (module: string, a?: any) => boolean
  dialog: (name: string, props?: any) => void
}
export interface ActionDef { key: string; label: ReactNode; tone?: 'green' | 'red' | 'violet' | 'blue' | 'orange' | 'outline' | 'dark' | 'teal'; show: (r: any, h: ActionHelpers) => boolean; run: (h: ActionHelpers) => Promise<void> | void; more?: boolean }

const run = async (h: ActionHelpers, fn: () => Promise<any>, ok: string) => { try { await fn(); h.toast.ok(ok); h.reload() } catch (e: any) { h.toast.error(e.message) } }
const fin = (h: ActionHelpers) => h.can('finance', 'edit')

export const ACTIONS: Record<string, ActionDef[]> = {
  attachments:[{key:'download',label:'Open source file',tone:'outline',show:()=>true,run:h=>{window.open(`/api/files/${h.rec.id}/download`,'_blank','noopener')}},{key:'extract',label:'Extract text and match deal',tone:'outline',show:(r,h)=>h.can('documents','edit')&&h.can('jobs','view'),run:async h=>{try{const r=await post<any>(`/api/files/${h.rec.id}/extract`);h.nav(`/extractions/${r.id}`)}catch(e:any){h.toast.error(e.message)}}}],
  document_extractions:[{key:'review',label:'Review extraction',tone:'outline',show:()=>true,run:h=>h.nav(`/extractions/${h.rec.id}`)}],
  knowledge_articles:[
    {key:'publish',label:'Publish reviewed revision',tone:'green',show:(r,h)=>r.status==='Draft'&&h.can('projects','approve')&&r.owner_id!==h.userId&&r.updated_by!==h.userId,run:h=>run(h,()=>post(`/api/knowledge/${h.rec.id}/publish`),'Reviewed version published')},
    {key:'revise',label:'Start new revision',tone:'outline',show:(r,h)=>r.status==='Published'&&h.can('projects','edit'),run:async h=>{const reason=await h.dlg.prompt({title:'Start a new revision',label:'Reason (at least 10 characters)',required:true,multiline:true});if(reason)await run(h,()=>post(`/api/knowledge/${h.rec.id}/revise`,{reason}),'Draft revision opened; published history retained')}},
    {key:'acknowledge',label:'Acknowledge this version',tone:'outline',show:r=>r.status==='Published',run:h=>run(h,()=>post(`/api/knowledge/${h.rec.id}/acknowledge`),'Your acknowledgement recorded')},
  ],
  staff_qualifications:[
    {key:'verify',label:'Verify assessment',tone:'green',show:(r,h)=>r.status==='Pending'&&h.can('hr','approve')&&r.user_id!==h.userId&&r.created_by!==h.userId,run:h=>run(h,()=>post(`/api/qualifications/${h.rec.id}/verify`),'Qualification independently verified')},
    {key:'revoke',label:'Revoke qualification',tone:'red',show:(r,h)=>r.status==='Verified'&&h.can('hr','approve')&&r.user_id!==h.userId,run:async h=>{const reason=await h.dlg.prompt({title:'Revoke qualification',label:'Reason (at least 10 characters)',required:true,multiline:true});if(reason)await run(h,()=>post(`/api/qualifications/${h.rec.id}/revoke`,{reason}),'Qualification revoked')}},
  ],
  workflow_runs:[
    {key:'retry',label:'Retry internal workflow',tone:'orange',show:(r,h)=>r.status==='Failed'&&h.can('admin','edit'),run:async h=>{const reason=await h.dlg.prompt({title:'Retry workflow',label:'Reason (at least 10 characters)',required:true,multiline:true});if(reason)await run(h,()=>post(`/api/workflow-runs/${h.rec.id}/retry`,{reason}),'Retry queued')}},
    ...(['Succeeded','Cancelled'] as const).map(outcome=>({key:outcome,label:outcome==='Succeeded'?'Confirm completed':'Cancel after review',tone:'outline' as const,show:(r:any,h:ActionHelpers)=>r.status==='Needs review'&&h.can('admin','edit'),run:async(h:ActionHelpers)=>{const reason=await h.dlg.prompt({title:'Resolve uncertain external outcome',label:'Verification evidence (at least 10 characters)',required:true,multiline:true,message:'Check the integration/provider log before resolving. This action records the outcome and does not replay the send.'});if(reason)await run(h,()=>post(`/api/workflow-runs/${h.rec.id}/resolve`,{outcome,reason}),'Review recorded')}})),
  ],

  invoices: [
    { key: 'post', label: 'Post', tone: 'green', show: (r, h) => r.status === 'Draft' && fin(h), run: async h => { if (await h.dlg.confirm({ title: `Post ${h.rec.doc_type.toLowerCase()}?`, message: h.rec.doc_type === 'Proforma Invoice' ? 'The proforma will be issued with its final number. No ledger entry is created.' : 'This assigns the final sequential number and creates the ledger entry. Posted documents can only be voided or credited.', ok: 'Post' })) await run(h, () => post(`/api/finance/invoices/${h.rec.id}/post`), 'Posted') } },
    { key: 'receipt', label: 'Record receipt', tone: 'violet', show: (r, h) => ['Posted', 'Partially paid'].includes(r.status) && r.balance > 0 && ['Tax Invoice', 'Debit Note'].includes(r.doc_type) && h.can('finance', 'create'), run: h => h.dialog('pay', { kind: 'receipt', doc: h.rec }) },
    { key: 'cn', label: 'Issue credit note', tone: 'outline', show: (r, h) => ['Posted', 'Partially paid', 'Paid'].includes(r.status) && r.doc_type === 'Tax Invoice' && h.can('finance', 'create'), run: async h => {
      if (!(await h.dlg.confirm({ title: 'Create credit note?', message: 'A draft credit note for the full invoice is created. Edit the lines for a partial credit, then post it.', ok: 'Create draft' }))) return
      try { const r = h.rec; const full = await get<any>(`/api/e/invoices/${r.id}`); const cn = await post<any>('/api/e/invoices', { doc_type: 'Credit Note', party_id: r.party_id, job_id: r.job_id, branch_id: r.branch_id, currency: r.currency, ex_rate: r.ex_rate, original_invoice_id: r.id, invoice_date: new Date().toLocaleDateString('sv-SE'), notes: `Credit note against ${r.invoice_no}`, round_total: r.round_total, children: { lines: full.children.lines.map((l: any) => ({ charge_code_id: l.charge_code_id, description: l.description, unit: l.unit, qty: l.qty, rate: l.rate, line_ccy: l.line_ccy, line_roe: l.line_roe, vat_code_id: l.vat_code_id })) } }); h.nav(`/e/invoices/${cn.id}`) } catch (e: any) { h.toast.error(e.message) } } },
    { key: 'conv', label: 'Convert to tax invoice', tone: 'violet', show: (r, h) => r.doc_type === 'Proforma Invoice' && r.status !== 'Void' && h.can('finance', 'create'), run: async h => { try { const n = await post<any>(`/api/invoices/${h.rec.id}/convert-proforma`); h.toast.ok('Draft tax invoice created'); h.nav(`/e/invoices/${n.id}`) } catch (e: any) { h.toast.error(e.message) } } },
    { key: 'einv', label: 'E-invoice XML (PINT AE)', tone: 'outline', more: true, show: (r, h) => r.status !== 'Draft' && r.status !== 'Void' && r.doc_type !== 'Proforma Invoice' && h.can('finance', 'export'), run: h => { window.location.href = `/api/invoices/${h.rec.id}/einvoice.xml` } },
    { key: 'einvsub', label: 'Submit e-invoice to provider', tone: 'outline', more: true, show: (r, h) => r.status !== 'Draft' && r.status !== 'Void' && r.doc_type !== 'Proforma Invoice' && h.can('finance', 'edit'), run: async h => { if (await h.dlg.confirm({ title: 'Submit e-invoice?', message: `Sends ${h.rec.invoice_no} as UBL (PINT AE) to your accredited service provider.`, ok: 'Submit' })) await run(h, () => post(`/api/invoices/${h.rec.id}/einvoice/submit`), 'E-invoice submitted') } },
    { key: 'void', label: 'Void', tone: 'red', more: true, show: (r, h) => r.status !== 'Void' && fin(h) && !(r.paid_amount > 0 && r.doc_type !== 'Credit Note'), run: async h => { const reason = await h.dlg.prompt({ title: 'Void document', label: 'Reason', required: true, message: 'The ledger entry is reversed and linked job charges become unbilled again.', ok: 'Void' }); if (reason) await run(h, () => post(`/api/finance/invoices/${h.rec.id}/void`, { reason }), 'Voided') } },
  ],
  bills: [
    { key: 'req', label: 'Request approval', tone: 'orange', show: (r, h) => r.status === 'Draft' && r.approval_status === 'Not required' && h.can('finance', 'edit'), run: h => run(h, () => post(`/api/approvals/bills/${h.rec.id}/request`), 'Approval requested') },
    { key: 'approve', label: 'Approve', tone: 'violet', show: (r, h) => r.approval_status === 'Pending' && r._approval?.requested_by !== h.userId && r.created_by !== h.userId && h.can('finance', 'approve'), run: h => run(h, () => post(`/api/approvals/bills/${h.rec.id}/approve`), 'Approved') },
    { key: 'post', label: 'Post', tone: 'green', show: (r, h) => r.status === 'Draft' && fin(h), run: async h => { if (await h.dlg.confirm({ title: 'Post vendor bill?', message: 'Creates the payable and expense entries in the ledger.', ok: 'Post' })) await run(h, () => post(`/api/finance/bills/${h.rec.id}/post`), 'Posted') } },
    { key: 'pay', label: 'Pay', tone: 'violet', show: (r, h) => ['Posted', 'Partially paid'].includes(r.status) && r.balance > 0 && h.can('finance', 'create'), run: h => h.dialog('pay', { kind: 'payment', doc: h.rec }) },
    { key: 'void', label: 'Void', tone: 'red', more: true, show: (r, h) => r.status !== 'Void' && fin(h) && !(r.paid_amount > 0), run: async h => { const reason = await h.dlg.prompt({ title: 'Void bill', label: 'Reason', required: true, ok: 'Void' }); if (reason) await run(h, () => post(`/api/finance/bills/${h.rec.id}/void`, { reason }), 'Voided') } },
  ],
  receipts: [
    { key: 'post', label: 'Post', tone: 'green', show: (r, h) => r.status === 'Draft' && fin(h), run: h => run(h, () => post(`/api/finance/receipts/${h.rec.id}/post`), 'Receipt posted') },
    { key: 'alloc', label: 'Allocate on-account balance', tone: 'violet', show: (r, h) => r.status === 'Posted' && r.unallocated > 0 && fin(h), run: h => h.dialog('allocate', { kind: 'receipt', rec: h.rec }) },
    { key: 'void', label: 'Void', tone: 'red', more: true, show: (r, h) => r.status !== 'Void' && fin(h), run: async h => { const reason = await h.dlg.prompt({ title: 'Void receipt', label: 'Reason', required: true, ok: 'Void' }); if (reason) await run(h, () => post(`/api/finance/receipts/${h.rec.id}/void`, { reason }), 'Voided') } },
  ],
  payments: [
    { key: 'req', label: 'Request approval', tone: 'orange', show: (r, h) => r.status === 'Draft' && r.approval_status === 'Not required' && h.can('finance', 'edit'), run: h => run(h, () => post(`/api/approvals/payments/${h.rec.id}/request`), 'Approval requested') },
    { key: 'approve', label: 'Approve', tone: 'violet', show: (r, h) => r.approval_status === 'Pending' && r._approval?.requested_by !== h.userId && r.created_by !== h.userId && h.can('finance', 'approve'), run: h => run(h, () => post(`/api/approvals/payments/${h.rec.id}/approve`), 'Approved') },
    { key: 'post', label: 'Post', tone: 'green', show: (r, h) => r.status === 'Draft' && fin(h), run: h => run(h, () => post(`/api/finance/payments/${h.rec.id}/post`), 'Payment posted') },
    { key: 'alloc', label: 'Allocate advance', tone: 'violet', show: (r, h) => r.status === 'Posted' && r.unallocated > 0 && fin(h), run: h => h.dialog('allocate', { kind: 'payment', rec: h.rec }) },
    { key: 'void', label: 'Void', tone: 'red', more: true, show: (r, h) => r.status !== 'Void' && fin(h), run: async h => { const reason = await h.dlg.prompt({ title: 'Void payment', label: 'Reason', required: true, ok: 'Void' }); if (reason) await run(h, () => post(`/api/finance/payments/${h.rec.id}/void`, { reason }), 'Voided') } },
  ],
  journal_entries: [
    { key: 'rev', label: 'Reverse entry', tone: 'red', show: (r, h) => r.status === 'Posted' && r.source_type !== 'Reversal' && fin(h), run: async h => { if (await h.dlg.confirm({ title: 'Reverse this journal?', message: 'Posts an equal and opposite entry dated today.', danger: true, ok: 'Reverse' })) await run(h, async () => { const r = await post<any>(`/api/finance/journals/${h.rec.id}/reverse`); h.nav(`/e/journal_entries/${r.reversal_id}`) }, 'Reversed') } },
  ],
  expenses: [
    { key: 'submit', label: 'Submit for approval', tone: 'violet', show: (r, h) => ['Draft', 'Rejected'].includes(r.status) && h.can('finance', 'create'), run: h => run(h, () => post(`/api/finance/expenses/${h.rec.id}/submit`), 'Submitted') },
    { key: 'approve', label: 'Approve', tone: 'green', show: (r, h) => r.status === 'Submitted' && h.can('finance', 'approve'), run: h => run(h, () => post(`/api/finance/expenses/${h.rec.id}/approve`), 'Approved and posted') },
    { key: 'reject', label: 'Reject', tone: 'red', show: (r, h) => r.status === 'Submitted' && h.can('finance', 'approve'), run: h => run(h, () => post(`/api/finance/expenses/${h.rec.id}/reject`), 'Rejected') },
    { key: 'pay', label: 'Mark paid', tone: 'violet', show: (r, h) => r.status === 'Approved' && fin(h), run: h => h.dialog('payExpense', { rec: h.rec }) },
  ],
  quotations: [
    { key: 'req', label: 'Request margin approval', tone: 'orange', show: (r, h) => r.approval_status === 'Pending' && !r._approval && r.status === 'Draft' && h.can('sales', 'edit'), run: h => run(h, () => post(`/api/approvals/quotations/${h.rec.id}/request`), 'Approval requested') },
    { key: 'approve', label: 'Approve margin', tone: 'violet', show: (r, h) => r.approval_status === 'Pending' && r._approval?.requested_by !== h.userId && r.created_by !== h.userId && h.can('sales', 'approve'), run: h => run(h, () => post(`/api/approvals/quotations/${h.rec.id}/approve`), 'Approved') },
    { key: 'send', label: 'Send to customer', tone: 'green', show: (r, h) => ['Draft', 'Approved', 'Sent'].includes(r.status) && !['Pending', 'Rejected'].includes(r.approval_status) && h.can('sales', 'edit'), run: async h => { const to = await h.dlg.prompt({ title: 'Send quotation', label: 'Send to (leave blank for the customer contact)', initial: '', ok: 'Queue e-mail', message: 'The e-mail is queued in the outbox and delivered when SMTP is configured.' }); if (to === null) return; await run(h, () => post(`/api/quotes/${h.rec.id}/send`, to ? { to } : {}), 'Quotation queued for sending') } },
    { key: 'accept', label: 'Mark accepted', tone: 'violet', show: (r, h) => ['Sent', 'Approved'].includes(r.status) && h.can('sales', 'edit') && !['Pending', 'Rejected'].includes(r.approval_status), run: h => run(h, () => post(`/api/quotes/${h.rec.id}/accept`), 'Accepted') },
    { key: 'convert', label: 'Convert to job', tone: 'blue', show: (r, h) => !r.job_id && ['Sent', 'Approved', 'Accepted'].includes(r.status) && h.can('jobs', 'create'), run: async h => { try { const j = await post<any>(`/api/quotes/${h.rec.id}/convert`); h.toast.ok(`Job ${j.job_no} created`); h.nav(`/jobs/${j.id}`) } catch (e: any) { h.toast.error(e.message) } } },
    { key: 'lost', label: 'Mark lost', tone: 'red', more: true, show: (r, h) => ['Sent', 'Approved', 'Draft'].includes(r.status) && h.can('sales', 'edit'), run: async h => { const reason = await h.dlg.prompt({ title: 'Quotation lost / rejected', label: 'Reason (optional)', ok: 'Mark lost' }); if (reason !== null) await run(h, () => post(`/api/quotes/${h.rec.id}/reject`, { reason }), 'Marked as rejected') } },
    { key: 'rev', label: 'New revision', tone: 'outline', more: true, show: (_r, h) => h.can('sales', 'create'), run: async h => { try { const n = await post<any>(`/api/quotes/${h.rec.id}/revise`); h.nav(`/e/quotations/${n.id}`) } catch (e: any) { h.toast.error(e.message) } } },
  ],
  jobs: [
    { key: 'share', label: 'Share client status link', tone: 'teal', show: (r, h) => !!h.can('sales', 'view'), run: async h => { try { const res = await post<any>(`/api/jobs/${h.rec.id}/tracking-token`); const url = res.url || `${location.origin}/t/${res.token}`; try { await navigator.clipboard.writeText(url); h.toast.ok('Client status link copied — paste it in e-mail or WhatsApp') } catch { h.toast.ok(url) } } catch (e: any) { h.toast.error(e.message) } } },
    { key: 'report', label: 'Print deal file report', tone: 'outline', show: (r, h) => !!h.can('sales', 'view'), run: h => { window.open(`/print/jobs/${h.rec.id}`, '_blank', 'noopener') } },
  ],
  leads: [{ key: 'convert', label: 'Convert to customer', tone: 'green', show: (r, h) => r.status !== 'Converted' && h.can('crm', 'create'), run: async h => { try { const r = await post<any>(`/api/leads/${h.rec.id}/convert`); h.toast.ok('Converted to customer and opportunity'); h.nav(`/e/parties/${r.party.id}`) } catch (e: any) { h.toast.error(e.message) } } }],
  opportunities: [{ key: 'quote', label: 'Create quotation', tone: 'green', show: (r, h) => !['Won', 'Lost'].includes(r.stage) && h.can('sales', 'create'), run: async h => { try { const qt = await post<any>(`/api/opportunities/${h.rec.id}/quote`); h.nav(`/e/quotations/${qt.id}`) } catch (e: any) { h.toast.error(e.message) } } }],
  leave_requests: [
    { key: 'approve', label: 'Approve', tone: 'green', show: (r, h) => r.status === 'Pending' && h.can('hr', 'approve'), run: h => run(h, () => post(`/api/hr/leave/${h.rec.id}/approve`), 'Approved') },
    { key: 'reject', label: 'Reject', tone: 'red', show: (r, h) => r.status === 'Pending' && h.can('hr', 'approve'), run: h => run(h, () => post(`/api/hr/leave/${h.rec.id}/reject`), 'Rejected') },
    { key: 'cancel', label: 'Cancel leave', tone: 'outline', more: true, show: (r, h) => ['Pending', 'Approved'].includes(r.status) && h.can('hr', 'approve'), run: h => run(h, () => post(`/api/hr/leave/${h.rec.id}/cancel`), 'Cancelled') },
  ],
  purchase_orders: [
    { key: 'req', label: 'Request approval', tone: 'orange', show: (r, h) => r.status === 'Draft' && h.can('assets', 'edit'), run: h => run(h, () => post(`/api/approvals/purchase_orders/${h.rec.id}/request`), 'Approval requested') },
    { key: 'approve', label: 'Approve', tone: 'violet', show: (r, h) => r.status === 'Pending approval' && r._approval?.requested_by !== h.userId && r.created_by !== h.userId && h.can('assets', 'approve'), run: h => run(h, () => post(`/api/approvals/purchase_orders/${h.rec.id}/approve`), 'Approved') },
    { key: 'order', label: 'Mark ordered', tone: 'green', show: (r, h) => r.status === 'Approved' && h.can('assets', 'edit'), run: h => run(h, () => put(`/api/e/purchase_orders/${h.rec.id}`, { status: 'Ordered', version: h.rec.version }), 'Marked as ordered') },
    { key: 'recv', label: 'Mark received', tone: 'violet', show: (r, h) => r.status === 'Ordered' && h.can('assets', 'edit'), run: h => run(h, () => put(`/api/e/purchase_orders/${h.rec.id}`, { status: 'Received', version: h.rec.version }), 'Marked as received') },
  ],
  tickets: [{ key: 'resolve', label: 'Resolve', tone: 'green', show: (r, h) => !['Resolved', 'Closed'].includes(r.status) && h.can('support', 'edit'), run: async h => { const res = await h.dlg.prompt({ title: 'Resolve ticket', label: 'Resolution / root cause', required: true, multiline: true, ok: 'Resolve' }); if (res) await run(h, () => put(`/api/e/tickets/${h.rec.id}`, { status: 'Resolved', resolution: res, version: h.rec.version }), 'Ticket resolved') } }],
  tasks: [{ key: 'done', label: 'Mark done', tone: 'green', show: r => r.status !== 'Done', run: h => run(h, () => put(`/api/e/tasks/${h.rec.id}`, { status: 'Done', version: h.rec.version }), 'Done') }],
  payslips: [
    { key: 'approve', label: 'Approve', tone: 'violet', show: (r, h) => r.status === 'Draft' && h.can('hr', 'edit'), run: h => run(h, () => put(`/api/e/payslips/${h.rec.id}`, { status: 'Approved', version: h.rec.version }), 'Approved') },
    { key: 'paid', label: 'Mark paid', tone: 'green', show: (r, h) => r.status === 'Approved' && h.can('hr', 'edit'), run: h => run(h, () => put(`/api/e/payslips/${h.rec.id}`, { status: 'Paid', version: h.rec.version }), 'Marked as paid') },
  ],
  bank_transactions: [{ key: 'rec', label: 'Reconcile…', tone: 'green', show: r => r.status === 'Unreconciled', run: h => h.dialog('reconcile', { txn: h.rec }) }, { key: 'undo', label: 'Un-reconcile', tone: 'outline', show: r => r.status === 'Reconciled', run: h => run(h, () => post('/api/finance/bank/reconcile', { txn_id: h.rec.id, undo: true }), 'Reopened') }],
  users: [
    { key: 'unlock', label: 'Unlock account', tone: 'outline', more: true, show: (_r, h) => h.can('admin', 'edit'), run: h => run(h, () => post(`/api/admin/users/${h.rec.id}/unlock`), 'Unlocked') },
    { key: 'signout', label: 'Sign out everywhere', tone: 'outline', more: true, show: (_r, h) => h.can('admin', 'edit'), run: h => run(h, () => post(`/api/admin/users/${h.rec.id}/sign-out`), 'Sessions ended') },
    { key: 'reset2fa', label: 'Reset 2-step verification', tone: 'outline', more: true, show: (_r, h) => h.can('admin', 'edit'), run: async h => { if (await h.dlg.confirm({ title: 'Reset 2-step verification?', message: 'The user will sign in with password only until they enable it again.', danger: true, ok: 'Reset' })) await run(h, () => post(`/api/admin/users/${h.rec.id}/reset-2fa`), '2-step verification reset') } },
  ],
  parties: [
    { key: 'job', label: 'New job', tone: 'violet', show: (r, h) => r.is_customer && h.can('jobs', 'create'), run: h => h.nav(`/e/jobs?new=1&client_id=${h.rec.id}`) },
    { key: 'quote', label: 'New quotation', tone: 'outline', show: (r, h) => r.is_customer && h.can('sales', 'create'), run: h => h.nav(`/e/quotations?new=1&customer_id=${h.rec.id}`) },
    { key: 'stmt', label: 'Statement of account', tone: 'outline', show: (_r, h) => h.can('finance', 'view'), run: h => h.nav(`/print/statement/${h.rec.id}`) },
  ],
}

export const PRINTABLE = new Set(['invoices', 'quotations', 'receipts', 'payments', 'payslips', 'purchase_orders', 'parties', 'studio_documents'])
export const RELATED: Record<string, { key: string; label: string; entity: string; field: string }[]> = {
  parties: [
    { key: 'contacts', label: 'Contacts', entity: 'contacts', field: 'party_id' }, { key: 'jobs', label: 'Deals', entity: 'jobs', field: 'client_id' }, { key: 'quotes', label: 'Quotations', entity: 'quotations', field: 'customer_id' },
    { key: 'invoices', label: 'Invoices', entity: 'invoices', field: 'party_id' }, { key: 'receipts', label: 'Receipts', entity: 'receipts', field: 'party_id' }, { key: 'bills', label: 'Vendor bills', entity: 'bills', field: 'vendor_id' },
    { key: 'opps', label: 'Opportunities', entity: 'opportunities', field: 'party_id' }, { key: 'acts', label: 'Calls & activities', entity: 'activities', field: 'party_id' }, { key: 'tickets', label: 'Tickets', entity: 'tickets', field: 'customer_id' },
    { key: 'contracts', label: 'Contracts', entity: 'contracts', field: 'party_id' }, { key: 'mandates', label: 'Mandates', entity: 'mandates', field: 'owner_id' },
  ],
  employees: [{ key: 'leave', label: 'Leave', entity: 'leave_requests', field: 'employee_id' }, { key: 'att', label: 'Attendance', entity: 'attendance', field: 'employee_id' }, { key: 'pay', label: 'Payslips', entity: 'payslips', field: 'employee_id' }, { key: 'exp', label: 'Expense claims', entity: 'expenses', field: 'employee_id' }],
  branches: [{ key: 'jobs', label: 'Deals', entity: 'jobs', field: 'branch_id' }],
  campaigns: [{ key: 'leads', label: 'Leads', entity: 'leads', field: 'campaign_id' }],
  opportunities: [{ key: 'quotes', label: 'Quotations', entity: 'quotations', field: 'opportunity_id' }],
  properties: [{ key: 'mandates', label: 'Mandates', entity: 'mandates', field: 'property_id' }, { key: 'viewings', label: 'Viewings', entity: 'viewings', field: 'property_id' }, { key: 'offers', label: 'Offers', entity: 'offers', field: 'property_id' }],
  leases: [{ key: 'rent', label: 'Rent schedule', entity: 'rent_schedules', field: 'lease_id' }, { key: 'maint', label: 'Maintenance', entity: 'maintenance', field: 'lease_id' }],
  projects: [{ key: 'tasks', label: 'Tasks', entity: 'tasks', field: 'project_id' }],
}

