/** Only reviewed tool capabilities may execute. New tools fail closed until reviewed here. */
const READ = new Set(['business_snapshot','search_deals','get_deal','party_statement','overdue_invoices','bills_due','search_parties','pipeline_summary','rent_roll','expiring_leases','list_leads','stale_opportunities','list_tasks','open_tickets','expiring_documents'])
const INTERNAL = new Set(['create_task','add_note','create_lead','add_deal_event','alert_team'])
const EXTERNAL = new Set(['send_email','send_whatsapp'])
export function toolPolicy(name: string, risk: string, autonomy: number): 'deny' | 'approve' | 'execute' {
  if (READ.has(name) && risk === 'read') return 'execute'
  if (INTERNAL.has(name) && risk === 'internal') return autonomy === 0 ? 'approve' : 'execute'
  if (EXTERNAL.has(name) && risk === 'external') return 'approve'
  return 'deny'
}
