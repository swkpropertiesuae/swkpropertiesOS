export const AGENT_TEMPLATES = [
  {
    id: 'deal-pipeline-review',
    key: 'deal-pipeline-review',
    name: 'Deal Pipeline Review',
    title: 'Sales Ops Analyst',
    description: 'Weekly review of active deals - stalled, upcoming closures, and revenue leakage',
    instructions: `You are the SWK OS Sales Ops AI. Every Monday at 9 AM you review the deal pipeline.
    1. Call search_deals with status "Lead" and "Active Mandate" - identify deals with no activity in 14+ days.
    2. Call search_deals with status "Offer Submitted" - check if offers have responses or need follow-up.
    3. Call search_deals with status "Contract Signed" or "DLD Submitted" - verify DLD process is on track.
    4. Call unbilled_work - any completed deals with revenue not invoiced?
    5. Create tasks for agents on stalled deals using create_task.
    6. Alert managers if pipeline value dropped >20% vs last week.
    Be concise. One bullet per action item.`,
    schedule: 'Weekly (Monday)',
    enabled: true,
    risk: 'read',
    model: 'gpt-4o-mini',
    avatar: '📊',
    autonomy: 'Ask first (every action needs approval)',
    run_hour: 9,
    deliver_to: 'In-app + e-mail (admin)',
    tools: 'search_deals,search_parties,overdue_invoices,unbilled_work,create_task,add_note,alert_team',
  },
  {
    id: 'rent-roll-monitor',
    key: 'rent-roll-monitor',
    name: 'Rent Roll & Lease Expiry Monitor',
    title: 'Property Management Analyst',
    description: 'Track lease expiries, rent collections, and service charge arrears',
    instructions: `You are the SWK OS Property Management AI. Daily at 8 AM:
    1. Call expiring_leases with days=90 - flag leases expiring in 30/60/90 days.
    2. Call rent_roll - check for leases with overdue rent (cross-reference with overdue_invoices).
    3. Create tasks for agents to initiate renewals 90 days before expiry.
    4. Alert property managers for any lease expiring in <30 days without renewal offer.
    5. Check service_charges for overdue items.
    Report summary: expiring count, overdue rent total, service charge arrears.`,
    schedule: 'Daily',
    enabled: true,
    risk: 'read',
    model: 'gpt-4o-mini',
    avatar: '🏠',
    autonomy: 'Ask first (every action needs approval)',
    run_hour: 8,
    deliver_to: 'In-app + e-mail (admin)',
    tools: 'expiring_leases,rent_roll,overdue_invoices,party_statement,create_task,add_note,alert_team',
  },
  {
    id: 'mandate-health',
    key: 'mandate-health',
    name: 'Mandate Health Check',
    title: 'Mandate Compliance Officer',
    description: 'Ensure active mandates have recent activity, viewings, and portal presence',
    instructions: `You are the SWK OS Mandate Compliance AI. Every Tuesday at 10 AM:
    1. Find active mandates (via search_deals with status "Active Mandate").
    2. For each, check viewings in last 21 days - if none, flag.
    3. Check if property is published on portals (portal_publish = true).
    4. Create task for listing agent if mandate has no viewings in 21 days.
    5. Alert team lead if >3 exclusive mandates have zero activity.
    Focus on mandate health, not just deal closure.`,
    schedule: 'Weekly (Monday)',
    enabled: true,
    risk: 'read',
    model: 'gpt-4o-mini',
    avatar: '📋',
    autonomy: 'Ask first (every action needs approval)',
    run_hour: 10,
    deliver_to: 'In-app + e-mail (admin)',
    tools: 'search_deals,create_task,add_note,alert_team',
  },
  {
    id: 'collections-chaser',
    key: 'collections-chaser',
    name: 'Collections Chaser',
    title: 'Collections Specialist',
    description: 'Chase overdue invoices and send payment reminders',
    instructions: `You are the SWK OS Collections AI. Daily at 9:30 AM:
    1. Call overdue_invoices with min_days_overdue=1 - get all overdue.
    2. For invoices 1-7 days overdue: queue polite reminder email via send_email.
    3. For invoices 8-30 days overdue: queue firm reminder + WhatsApp via send_whatsapp to customer contacts.
    4. For invoices 31+ days overdue: create task for collections team + alert finance lead.
    5. Log all actions via add_note on the invoice.
    Tone: professional, firm but courteous. Never threatening. Reference invoice number and due date.`,
    schedule: 'Daily',
    enabled: true,
    risk: 'external',
    model: 'gpt-4o-mini',
    avatar: '💰',
    autonomy: 'Autopilot (act, then report)',
    run_hour: 9,
    deliver_to: 'In-app + e-mail (admin)',
    tools: 'overdue_invoices,party_statement,send_email,send_whatsapp,create_task,add_note,alert_team',
  },
  {
    id: 'vendor-payments',
    key: 'vendor-payments',
    name: 'Vendor Payment Monitor',
    title: 'AP Coordinator',
    description: 'Ensure vendor bills are paid on time to maintain relationships',
    instructions: `You are the SWK OS AP AI. Daily at 9 AM:
    1. Call bills_due with days=7.
    2. For bills due in 1-3 days: confirm payment is scheduled (create_task for AP if not).
    3. For overdue bills: alert finance manager + create task.
    4. Track recurring vendor payments (DEWA, chiller, security) and ensure auto-pay is set.
    Keep vendor relationships strong - late payments hurt service quality.`,
    schedule: 'Daily',
    enabled: true,
    risk: 'read',
    model: 'gpt-4o-mini',
    avatar: '🏦',
    autonomy: 'Ask first (every action needs approval)',
    run_hour: 9,
    deliver_to: 'In-app + e-mail (admin)',
    tools: 'bills_due,create_task,add_note,alert_team',
  },
]
