import { PRESETS } from '../ai/llm'

export interface CField { key: string; label: string; type: 'text' | 'password' | 'select' | 'bool' | 'number' | 'textarea'; options?: { value: string; label: string }[]; help?: string; placeholder?: string }
export interface Section { key: string; title: string; icon: string; summary: string; setup?: string; fields: CField[]; test?: boolean; webhooks?: { key: string; label: string; path: string; secret?: boolean }[] }
const opt = (...v: string[]) => v.map(x => { const [value, label] = x.split('|'); return { value, label: label ?? value } })

export const CATALOG: Section[] = [
  { key: 'mail', title: 'E-mail (Resend / SMTP)', icon: 'Mail', test: true, summary: 'All customer e-mails, quotations, invoices (with PDF attached) and agent messages.',
    setup: 'For Sales, Accounts, Info, Contact and Support, open Email → Sender settings and connect each address. This section sets the default automation sender. SMTP needs the mailbox host, port, username and password; Resend needs a sending API key and a verified From domain. Save and test, then send to your own address to confirm delivery.',
    fields: [
      { key: 'mail_provider', label: 'Provider', type: 'select', options: opt('auto|Automatic (Resend if a key is set, else SMTP)', 'resend|Resend only', 'smtp|SMTP only') },
      { key: 'resend_api_key', label: 'Resend API key', type: 'password', placeholder: 're_…' }, { key: 'resend_from', label: 'From address (verified domain)', type: 'text', placeholder: 'SWK Properties <ops@yourdomain.com>' },
      { key: 'smtp_host', label: 'SMTP host (optional fallback)', type: 'text' }, { key: 'smtp_port', label: 'SMTP port', type: 'number' }, { key: 'smtp_user', label: 'SMTP user', type: 'text' }, { key: 'smtp_pass', label: 'SMTP password', type: 'password' }, { key: 'smtp_from', label: 'SMTP from', type: 'text' }, { key: 'smtp_secure', label: 'SMTP uses TLS (port 465)', type: 'bool' },
    ] },
  { key: 'storage', title: 'File storage & backups (Cloudflare R2)', icon: 'Cloud', test: true, summary: 'Attachments and nightly database backups live in R2 instead of the server disk (zero egress fees, 10 GB free).',
    setup: 'Cloudflare dashboard → R2 → create a bucket → Manage R2 API tokens → create a token with Object Read & Write → copy account id, access key id and secret.',
    fields: [
      { key: 'storage_provider', label: 'Store new uploads in', type: 'select', options: opt('local|Server disk', 'r2|Cloudflare R2') },
      { key: 'r2_account_id', label: 'Account ID', type: 'text' }, { key: 'r2_bucket', label: 'Bucket name', type: 'text' }, { key: 'r2_access_key_id', label: 'Access key ID', type: 'text' }, { key: 'r2_secret_access_key', label: 'Secret access key', type: 'password' },
      { key: 'r2_backup_nightly', label: 'Upload a database backup to R2 every night (02:00 Dubai)', type: 'bool' },
    ] },
  { key: 'supabase', title: 'Supabase (live Postgres replica)', icon: 'Database', test: true, summary: 'Every record is mirrored to your Supabase Postgres every 15 minutes – use it for Metabase / Looker dashboards, SQL, or as an off-site copy. The app itself keeps running on its own database.',
    setup: 'Optional reporting mirror; this does not change the primary database. Run the downloaded schema in a separate Supabase project. Under Settings → API Keys obtain the legacy service_role JWT and enter the project URL. The current adapter requires the legacy JWT, not a new sb_secret key. Save, test, then Sync now; keep database backups separately.',
    fields: [{ key: 'supabase_url', label: 'Project URL', type: 'text', placeholder: 'https://xxxx.supabase.co' }, { key: 'supabase_service_key', label: 'service_role key', type: 'password' }, { key: 'supabase_sync', label: 'Sync automatically every 15 minutes', type: 'bool' }] },
  { key: 'whatsapp', title: 'WhatsApp (Cloud API)', icon: 'MessageCircle', test: true, summary: 'Lead capture, staff command bot, customer self-service, milestone alerts, overdue reminders and owner daily report.',
    setup: 'developers.facebook.com → create a Business app → add WhatsApp → copy the Phone number ID and a permanent System-User access token. In WhatsApp → Configuration set the callback URL and verify token shown below, and subscribe to "messages". Business-initiated messages outside 24h need approved templates with ONE body variable {{1}} – enter their names below.',
    webhooks: [{ key: 'wa', label: 'Callback URL', path: '/api/public/whatsapp' }],
    fields: [
      { key: 'wa_enabled', label: 'Enable WhatsApp', type: 'bool' }, { key: 'wa_phone_number_id', label: 'Phone number ID', type: 'text' }, { key: 'wa_access_token', label: 'Access token', type: 'password' },
      { key: 'wa_verify_token', label: 'Webhook verify token (any text you choose)', type: 'text' }, { key: 'wa_app_secret', label: 'App secret (verifies webhook signatures)', type: 'password' },
      { key: 'wa_owner_numbers', label: 'Owner / manager numbers (staff bot + reports)', type: 'text', placeholder: '9715XXXXXXXX, 9715YYYYYYYY' }, { key: 'wa_default_country_code', label: 'Default country code', type: 'text' },
      { key: 'wa_staff_bot', label: 'Staff bot: owners can text "report", "overdue", "leads", "deal …", or ask Jarvis anything', type: 'bool' },
      { key: 'wa_customer_bot', label: 'Customer bot: known clients can text "statement" / "viewings"', type: 'bool' },
      { key: 'wa_auto_leads', label: 'Create a lead + auto-reply for new unknown WhatsApp numbers', type: 'bool' },
      { key: 'wa_auto_milestones', label: 'Send deal and lease milestones to client contacts', type: 'bool' },
      { key: 'wa_auto_overdue', label: 'Send polite overdue-invoice reminders (max weekly per invoice)', type: 'bool' },
      { key: 'wa_owner_daily_report', label: 'Send the owner brief every morning (07:30)', type: 'bool' },
      { key: 'wa_template_lang', label: 'Template language code', type: 'text' }, { key: 'wa_tpl_notify', label: 'Template: notifications', type: 'text', help: 'Approved template with a single {{1}} body variable' }, { key: 'wa_tpl_reminder', label: 'Template: payment reminders', type: 'text' }, { key: 'wa_tpl_report', label: 'Template: owner reports', type: 'text' },
    ] },
  { key: 'ai', title: 'AI employees (free-friendly)', icon: 'Bot', test: true, summary: 'Jarvis and the AI team call this model. Use a free tier (Groq, OpenRouter ":free" models, Gemini, Cloudflare Workers AI) or your own Ollama server for near-zero cost. A fallback provider is used automatically when the first is rate-limited.',
    setup: 'Pick a provider, paste its API key (Ollama needs none), optionally change the model, Save, then Test. Then open "Jarvis & Employees" and switch on the employees you want.',
    fields: [
      { key: 'ai_enabled', label: 'Enable AI', type: 'bool' }, { key: 'ai_provider', label: 'Provider', type: 'select', options: PRESETS.map(p => ({ value: p.key, label: p.label })) },
      { key: 'ai_base_url', label: 'Base URL (blank = provider default)', type: 'text' }, { key: 'ai_api_key', label: 'API key', type: 'password' }, { key: 'ai_model', label: 'Model (blank = provider default)', type: 'text' },
      { key: 'ai_fallback_provider', label: 'Fallback provider (optional)', type: 'select', options: [{ value: '', label: '— none —' }, ...PRESETS.map(p => ({ value: p.key, label: p.label }))] },
      { key: 'ai_fallback_base_url', label: 'Fallback base URL', type: 'text' }, { key: 'ai_fallback_api_key', label: 'Fallback API key', type: 'password' }, { key: 'ai_fallback_model', label: 'Fallback model', type: 'text' },
      { key: 'ai_company_context', label: 'About your business (shared with every AI employee)', type: 'textarea', help: 'Target communities and developments, service standards, credit policy, tone of voice, anything they should always know.' },
    ] },
  { key: 'voice', title: 'Voice – AI receptionist (phone line via du SIP)', icon: 'PhoneCall', summary: 'Lets the AI Receptionist answer your office line 24/7 in English and Arabic: qualifies buyers and tenants, logs maintenance problems, transfers urgent calls to staff and records every call under AI → Voice calls.',
    setup: 'The OS handles the conversation; a voice platform handles the phone audio. 1) Ask du Business for a SIP trunk with your office number(s). 2) Connect that trunk to a SIP-capable voice-AI platform. 3) Generate the base URL below and give it to the platform: it calls <base>/greeting when the call connects, <base>/turn with each thing the caller says (JSON: call_id, from, text) and speaks the "reply" it gets back; if "action" is "transfer" it forwards the call to "transfer_to"; it calls <base>/end when the call finishes. 4) Switch on the AI Receptionist under AI → Employees. Use "Try the receptionist" first. See docs/VOICE.md.',
    webhooks: [{ key: 'voice_secret', label: 'Voice gateway base URL', path: '/api/public/voice/', secret: true }],
    fields: [
      { key: 'voice_enabled', label: 'Enable the voice gateway', type: 'bool' },
      { key: 'voice_transfer_number', label: 'Staff number for call transfers (leave empty to take call-backs instead)', type: 'text', placeholder: '+9714XXXXXXX' },
      { key: 'voice_record_notice', label: 'Tell callers the call may be recorded (PDPL transparency – keep on if the platform records)', type: 'bool' },
      { key: 'voice_retention_days', label: 'Delete call transcripts after this many days (0 = keep forever)', type: 'number', help: 'Removes what callers said from the call log and the AI activity log. The call record, outcome and summary stay as your CRM history.' },
      { key: 'voice_greeting_en', label: 'Opening line – English (blank = default)', type: 'textarea', help: 'Always say that the caller is speaking with an AI assistant.' },
      { key: 'voice_greeting_ar', label: 'Opening line – Arabic (blank = default)', type: 'textarea' },
    ] },
  { key: 'einvoice', title: 'E-invoicing (UAE PINT AE / Peppol)', icon: 'ReceiptText', summary: 'Generates UBL 2.1 e-invoices in the UAE PINT AE structure and submits them to your accredited service provider (ASP) endpoint.',
    setup: 'Choose a Ministry-of-Finance accredited ASP, ask for their REST submission URL and token, enter them here. Download-only use works without an endpoint. Validate sample files with your ASP before go-live.',
    fields: [{ key: 'einv_enabled', label: 'Enable submission to ASP', type: 'bool' }, { key: 'einv_endpoint', label: 'ASP submission URL', type: 'text' }, { key: 'einv_api_key', label: 'ASP token', type: 'password' }, { key: 'einv_endpoint_id', label: 'Your Peppol endpoint ID (defaults to TRN)', type: 'text' }, { key: 'einv_scheme_id', label: 'Endpoint scheme ID', type: 'text' }] },
  { key: 'bank', title: 'Bank feed webhook', icon: 'Landmark', summary: 'Push bank transactions from an open-banking aggregator or automation tool (Zapier, Make, n8n) straight into Bank Reconciliation, with automatic matching. Statement files (CSV / MT940) can be imported manually under Accounts.',
    webhooks: [{ key: 'bank_webhook_secret', label: 'Bank feed webhook', path: '/api/public/bank/', secret: true }],
    setup: 'POST JSON: {"iban":"AE…","transactions":[{"date":"2026-10-01","description":"…","reference":"…","amount":-1200.50}]}  (negative = withdrawal). The bank account is found by IBAN.', fields: [] },
  { key: 'wps', title: 'Payroll / WPS', icon: 'FileSpreadsheet', summary: 'Employer details printed in the UAE WPS salary file (SIF).',
    fields: [{ key: 'wps_employer_id', label: 'Employer establishment ID (MOHRE)', type: 'text' }, { key: 'wps_bank_routing', label: 'Employer bank routing code (9 digits)', type: 'text' }, { key: 'wps_employer_ref', label: 'Employer reference (optional)', type: 'text' }] },
]
