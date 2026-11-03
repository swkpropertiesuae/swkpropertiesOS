import { getSetting } from '../settings'
import { http } from '../integrations/log'
import { inDemo } from '../db'

export interface Preset { key: string; label: string; base: string; model: string; keyRequired: boolean; free: string; notes: string }
export const PRESETS: Preset[] = [
  { key: 'groq', label: 'Groq (free tier)', base: 'https://api.groq.com/openai/v1', model: 'openai/gpt-oss-20b', keyRequired: true, free: 'Free tier with rate limits', notes: 'Create a key at console.groq.com. Use openai/gpt-oss-20b; check your account for current free limits.' },
  { key: 'openrouter', label: 'OpenRouter (free models)', base: 'https://openrouter.ai/api/v1', model: 'openrouter/free', keyRequired: true, free: 'Free router with usage limits', notes: 'Create a key at openrouter.ai/keys. Use openrouter/free to select an available free model with the capabilities requested. Free availability and limits can change.' },
  { key: 'ollama', label: 'Ollama (SWK Internal Qwen 3.5 Server)', base: 'http://127.0.0.1:11434/v1', model: 'qwen3.5:4b', keyRequired: false, free: 'Free – runs on your internal hardware', notes: 'Local Ollama server with qwen3.5:4b (Fast) & qwen3.5:9b (Pro + Vision). Accessible to @swkpropertiesuae.com staff on web & mobile.' },
  { key: 'opencode', label: 'OpenCode Zen', base: 'https://opencode.ai/zen/v1', model: '', keyRequired: true, free: 'Some models are free', notes: 'Enter the model id shown in your OpenCode Zen dashboard.' },
  { key: 'xai', label: 'xAI Grok', base: 'https://api.x.ai/v1', model: 'grok-3-mini', keyRequired: true, free: 'Paid / promotional credits', notes: 'console.x.ai' },
  { key: 'gemini', label: 'Google Gemini (free tier)', base: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.0-flash', keyRequired: true, free: 'Free tier with limits', notes: 'aistudio.google.com/apikey' },
  { key: 'cloudflare', label: 'Cloudflare Workers AI', base: 'https://api.cloudflare.com/client/v4/accounts/ACCOUNT_ID/ai/v1', model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', keyRequired: true, free: 'Daily free allowance', notes: 'Replace ACCOUNT_ID in the base URL; the key is a Workers AI API token.' },
  { key: 'openai', label: 'OpenAI', base: 'https://api.openai.com/v1', model: 'gpt-4o-mini', keyRequired: true, free: 'Paid', notes: '' },
  { key: 'custom', label: 'Custom OpenAI-compatible', base: '', model: '', keyRequired: false, free: '', notes: 'Any server exposing /chat/completions (LM Studio, vLLM, LiteLLM…).' },
]
export interface Endpoint { base: string; key: string; model: string; label: string }

export function endpoints(modelOverride?: string): Endpoint[] {
  const out: Endpoint[] = []
  const mk = (pre: string, label: string) => {
    const provider = String(getSetting(pre ? 'ai_fallback_provider' : 'ai_provider') || '')
    if (!provider) return
    const p = PRESETS.find(x => x.key === provider)
    const base = String(getSetting(pre ? 'ai_fallback_base_url' : 'ai_base_url') || p?.base || '').trim().replace(/\/+$/, '')
    const model = String((!pre && modelOverride) || getSetting(pre ? 'ai_fallback_model' : 'ai_model') || p?.model || '').trim()
    const key = String(getSetting(pre ? 'ai_fallback_api_key' : 'ai_api_key') || '').trim()
    if (base && model) out.push({ base, key, model, label })
  }
  mk('', 'primary'); mk('f', 'fallback')
  return out
}
export const aiConfigured = () => inDemo() || (!!getSetting('ai_enabled') && endpoints().length > 0)

export interface ChatMsg { role: 'system' | 'user' | 'assistant' | 'tool'; content: string | null; tool_calls?: any[]; tool_call_id?: string; name?: string }
export interface ToolDef { name: string; description: string; parameters: any }
export interface ChatResult { content: string; tool_calls: { id: string; name: string; args: any }[]; tokens: number; model: string }

function extractToolJson(text: string): { json: any; raw: string } | null {
  const at = text.search(/\{\s*"tool"\s*:/)
  if (at < 0) return null
  let depth = 0
  for (let i = at; i < text.length; i++) {
    if (text[i] === '{') depth++
    else if (text[i] === '}' && --depth === 0) { const raw = text.slice(at, i + 1); try { return { json: JSON.parse(raw), raw } } catch { return null } }
  }
  return null
}

async function callOne(e: Endpoint, messages: ChatMsg[], tools: ToolDef[] | undefined, opts: { maxTokens?: number; temperature?: number } = {}): Promise<ChatResult> {
  if (e.base.includes('11434') && !tools?.length) {
    const nativeBase = e.base.replace(/\/v1\/?$/, '').replace(/\/+$/, '')
    const nr = await http(`${nativeBase}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: e.model, messages: messages.map(m => ({ role: m.role, content: m.content ?? '' })), think: false, stream: false }),
      timeoutMs: 90000,
    })
    if (nr.ok && nr.data?.message) {
      const text = String(nr.data.message.content ?? '').replace(/<think>[\s\S]*?<\/think>/g, '').trim()
      return { content: text, tool_calls: [], tokens: Number(nr.data?.eval_count ?? 0), model: e.model }
    }
  }
  const body: any = { model: e.model, messages, temperature: opts.temperature ?? 0.2, max_tokens: opts.maxTokens ?? 1500 }
  if (tools?.length) { body.tools = tools.map(t => ({ type: 'function', function: t })); body.tool_choice = 'auto' }
  const r = await http(`${e.base}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(e.key ? { Authorization: `Bearer ${e.key}` } : {}) }, body: JSON.stringify(body), timeoutMs: 90000 })
  if (!r.ok) {
    const hint = r.status === 404 ? 'Check the model ID and base URL in Integrations → AI. The provider may have retired this model. For OpenRouter, use model openrouter/free and base URL https://openrouter.ai/api/v1.'
      : r.status === 401 || r.status === 403 ? 'Check that the API key belongs to the selected provider and has permission to use this model.'
      : r.status === 429 ? 'The provider has reached its usage limit. Wait for the allowance to reset or configure a separate free fallback provider.' : ''
    throw new Error(`${e.label} model ${e.model}: HTTP ${r.status} ${r.data?.error?.message ?? r.data?.message ?? r.text.slice(0, 160)} ${hint}`.trim())
  }
  const msg = r.data?.choices?.[0]?.message
  if (!msg) throw new Error(`${e.label}: empty response`)
  let content: string = typeof msg.content === 'string' ? msg.content : ''
  let calls = (msg.tool_calls ?? []).map((c: any) => { let a: any = {}; try { a = JSON.parse(c.function?.arguments || '{}') } catch { /* keep empty */ } return { id: c.id ?? Math.random().toString(36).slice(2), name: c.function?.name, args: a } })
  // models without native tool calling: accept {"tool":"name","args":{...}} written in the text
  if (!calls.length && tools?.length) {
    const found = extractToolJson(content)
    if (found && tools.some(t => t.name === found.json.tool)) { calls = [{ id: 't' + Date.now(), name: found.json.tool, args: found.json.args ?? {} }]; content = content.replace(found.raw, '').replace(/```(json)?/g, '').trim() }
  }
  return { content: content.replace(/<think>[\s\S]*?<\/think>/g, '').trim(), tool_calls: calls, tokens: r.data?.usage?.total_tokens ?? 0, model: e.model }
}

/** Try the primary provider, then the fallback (e.g. when a free tier is rate limited). */
/** Demo workspace only: a scripted assistant that really calls the read tools and writes a briefing from their output. */
function demoChat(messages: ChatMsg[], tools?: ToolDef[]): ChatResult {
  const lastUser = [...messages].map((m, i) => ({ m, i })).filter(x => x.m.role === 'user').pop()?.i ?? 0
  const results = messages.slice(lastUser).filter(m => m.role === 'tool')
  const ask = String(messages[lastUser]?.content ?? '').toLowerCase()
  if (!results.length && tools?.length) {
    const want = ['business_snapshot', 'overdue_invoices', 'stalled_jobs', 'open_tickets', 'list_leads'].filter(n => tools.some(t => t.name === n))
    if (want.length) return { content: '', tokens: 0, model: 'demo-assistant', tool_calls: want.map((n, i) => ({ id: 'demo' + i, name: n, args: {} })) }
  }
  const get = (n: string) => { const m = results.find(r => r.name === n); try { return JSON.parse(m?.content ?? 'null') } catch { return null } }
  const snap = get('business_snapshot'), od = get('overdue_invoices') ?? [], st = get('stalled_jobs') ?? {}, tk = get('open_tickets') ?? [], ld = get('list_leads') ?? []
  const lines = [`Here is where things stand (live data from this demo workspace).`]
  if (snap) lines.push(`• ${snap.open_jobs} open deals, revenue this month AED ${Math.round(snap.revenue_month_aed).toLocaleString('en-US')}, commission to bill AED ${Math.round(snap.unbilled_revenue_aed).toLocaleString('en-US')}.`, `• Receivables AED ${Math.round(snap.ar_outstanding_aed).toLocaleString('en-US')}, of which AED ${Math.round(snap.ar_overdue_aed).toLocaleString('en-US')} is overdue. Cash and bank AED ${Math.round(snap.cash_aed).toLocaleString('en-US')}.`)
  if (od.length) lines.push(`• Chase first: ${od.slice(0, 3).map((o: any) => `${o.customer} (${o.invoice_no}, ${o.days_overdue} days, ${o.balance.toLocaleString('en-US')})`).join('; ')}.`)
  const late = (st.no_update_5d ?? []).length
  if (late) lines.push(`• ${late} stalled deals need attention: ${[(st.no_update_5d ?? []).map((j: any) => j.job_no)].flat().slice(0, 3).join(', ')}.`)
  if (tk.length) lines.push(`• ${tk.length} open tickets, oldest: “${tk[tk.length - 1].subject}”.`)
  if (ld.length) lines.push(`• ${ld.length} recent leads; newest is ${ld[0].company}.`)
  lines.push(`Suggested next actions: call the largest overdue customer today, book the pending viewings, and follow up the newest lead.`, `(Demo mode: this assistant is scripted. In your production workspace Jarvis uses the AI model you connect under Integrations.)`)
  void ask
  return { content: lines.join('\n'), tool_calls: [], tokens: 0, model: 'demo-assistant' }
}

export async function chat(messages: ChatMsg[], tools?: ToolDef[], modelOverride?: string, opts: { maxTokens?: number; temperature?: number } = {}): Promise<ChatResult> {
  if (inDemo()) return demoChat(messages, tools)
  const eps = endpoints(modelOverride)
  if (!eps.length) throw new Error('AI is not configured. Choose a provider under Integrations → AI.')
  const errors: string[] = []
  for (const e of eps) { try { return await callOne(e, messages, tools, opts) } catch (err: any) { errors.push(String(err?.message ?? err)) } }
  throw new Error(errors.join('\n'))
}
export async function testLlm(): Promise<{ ok: boolean; error?: string; model?: string; reply?: string }> {
  if (inDemo()) return { ok: false, error: 'The demo assistant is scripted. Sign into your real workspace to test an external AI connection.' }
  try { const r = await chat([{ role: 'user', content: 'Reply with the single word: ready' }]); return { ok: true, model: r.model, reply: r.content.slice(0, 40) } } catch (e: any) { return { ok: false, error: String(e?.message ?? e) } }
}

export function ollamaBaseUrl(): string {
  const raw = String(getSetting('ai_ollama_url') || getSetting('ai_base_url') || 'http://127.0.0.1:11434').trim()
  return (raw || 'http://127.0.0.1:11434').replace(/\/v1\/?$/, '').replace(/\/+$/, '')
}

export function isEmailInStaffDomains(email: string | undefined | null): boolean {
  if (!email || !email.includes('@')) return false
  const domain = email.slice(email.lastIndexOf('@') + 1).trim().toLowerCase()
  if (!domain) return false
  const raw = String(getSetting('ai_staff_domains') || 'swkpropertiesuae.com').trim()
  if (raw === '*') return true
  const allowed = raw.split(/[,;\s]+/).map(s => s.trim().replace(/^@/, '').toLowerCase()).filter(Boolean)
  return allowed.includes('*') || allowed.includes(domain)
}

export interface OllamaModelInfo {
  name: string
  parameterSize: string
  quantization: string
  family: string
  sizeMb: number
}

export async function fetchOllamaStatus(): Promise<{ online: boolean; ollamaUrl: string; models: OllamaModelInfo[]; defaultModel: string }> {
  const base = ollamaBaseUrl()
  const fallbackModels: OllamaModelInfo[] = [
    { name: 'qwen3.5:4b', parameterSize: '4.2B', quantization: 'Q4_K_M', family: 'qwen35', sizeMb: 3170 },
    { name: 'qwen3.5:9b', parameterSize: '9.0B', quantization: 'Q4_K_M', family: 'qwen35', sizeMb: 6247 },
  ]
  try {
    const r = await http(`${base}/api/tags`, { method: 'GET', timeoutMs: 3500 })
    if (!r.ok || !Array.isArray(r.data?.models)) {
      return { online: false, ollamaUrl: base, models: fallbackModels, defaultModel: String(getSetting('ai_model') || 'qwen3.5:4b') }
    }
    const models: OllamaModelInfo[] = r.data.models.map((m: any) => ({
      name: String(m.name || m.model || ''),
      parameterSize: String(m.details?.parameter_size || ''),
      quantization: String(m.details?.quantization_level || ''),
      family: String(m.details?.family || ''),
      sizeMb: Math.round(Number(m.size || 0) / (1024 * 1024)),
    })).filter((m: OllamaModelInfo) => !!m.name)
    const def = String(getSetting('ai_model') || '').trim()
    const defaultModel = models.some(m => m.name === def) ? def : (models.find(m => m.name.includes('4b'))?.name || models[0]?.name || 'qwen3.5:4b')
    return { online: true, ollamaUrl: base, models: models.length ? models : fallbackModels, defaultModel }
  } catch {
    return { online: false, ollamaUrl: base, models: fallbackModels, defaultModel: String(getSetting('ai_model') || 'qwen3.5:4b') }
  }
}

export async function ollamaChatDirect(opts: {
  model?: string
  messages: { role: 'system' | 'user' | 'assistant'; content: string; images?: string[] }[]
  think?: boolean
}): Promise<{ ok: boolean; model: string; content: string; thinking: string; durationMs: number; evalCount: number }> {
  const base = ollamaBaseUrl()
  const model = (opts.model || String(getSetting('ai_model') || 'qwen3.5:4b')).trim() || 'qwen3.5:4b'
  const companyName = String(getSetting('company_name') || 'SWK Properties L.L.C')
  const companyCtx = String(getSetting('ai_company_context') || '')
  const sysContent = [
    `You are the internal AI assistant for ${companyName} staff (RERA-licensed Dubai real estate brokerage & property management, ORN 51517).`,
    companyCtx ? `Company context: ${companyCtx}` : '',
    `Provide accurate, well-structured, concise help for ${companyName} team members across property listings, RERA forms (Form A, Form F, Ejari), DLD fee calculations, client communications, and internal operations.`,
  ].filter(Boolean).join('\n')

  const finalMessages = opts.messages.some(m => m.role === 'system')
    ? opts.messages
    : [{ role: 'system' as const, content: sysContent }, ...opts.messages]

  if (inDemo()) {
    return {
      ok: true,
      model,
      content: `[Demo Workspace · ${model}] Ready to assist ${companyName} staff. Connect to your production workspace to run live against ${base}.`,
      thinking: opts.think ? 'Checked internal SWK Properties context and prepared response.' : '',
      durationMs: 45,
      evalCount: 24,
    }
  }

  const t0 = Date.now()
  const r = await http(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: finalMessages,
      think: !!opts.think,
      stream: false,
    }),
    timeoutMs: 180000,
  })
  if (!r.ok) {
    throw new Error(`Ollama (${model}) returned HTTP ${r.status}: ${r.data?.error ?? r.text?.slice(0, 200) ?? 'unavailable'}`)
  }
  const msg = r.data?.message ?? {}
  let content = String(msg.content ?? '')
  let thinking = String(msg.thinking ?? '')
  const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/)
  if (thinkMatch) {
    if (!thinking) thinking = thinkMatch[1].trim()
    content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
  }
  const durationMs = r.data?.total_duration ? Math.round(Number(r.data.total_duration) / 1e6) : (Date.now() - t0)
  return {
    ok: true,
    model: String(r.data?.model || model),
    content: content.trim(),
    thinking: thinking.trim(),
    durationMs,
    evalCount: Number(r.data?.eval_count ?? 0),
  }
}
