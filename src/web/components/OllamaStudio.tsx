import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bot, Send, Sparkles, Zap, Brain, Image as ImageIcon, Plus, Trash2,
  Copy, Check, Globe, ShieldCheck, RefreshCw, ChevronDown, ChevronRight, X, Loader2, Smartphone,
} from 'lucide-react'
import { get, post } from '../lib/api'
import { useToast } from '../lib/toast'
import { useMeta } from '../lib/meta'
import { Badge, Modal } from '../ui/kit'
import { cls } from '../lib/format'

export interface OllamaModelInfo {
  name: string
  parameterSize: string
  quantization: string
  family: string
  sizeMb: number
}

export interface OllamaStatusResponse {
  online: boolean
  ollamaUrl: string
  models: OllamaModelInfo[]
  defaultModel: string
  allowedDomains: string
  cloudflareAccessEnabled: boolean
  cfEmail: string | null
  userEmail: string
  domainVerified: boolean
  aiEnabled: boolean
  publicUrl: string
  lanUrls: string[]
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  thinking?: string
  images?: string[]
  model?: string
  durationMs?: number
}

interface ChatThread {
  id: string
  title: string
  updatedAt: number
  messages: ChatMessage[]
}

const SWK_PROMPTS = [
  {
    title: '🏢 Bayut & Dubizzle Listing Copy',
    desc: 'Write a luxury RERA-compliant listing description',
    prompt: 'Write a compelling, RERA-compliant luxury property listing description for Bayut and Property Finder for a 3-bedroom sea-view apartment in Dubai Marina (1,950 sqft, AED 4,800,000, vacant on transfer). Include key highlights and call to action for SWK Properties L.L.C.',
  },
  {
    title: '🧮 DLD Transfer & Commission Breakdown',
    desc: 'Calculate 4% DLD, trustee fee, 2% commission & 5% VAT',
    prompt: 'Calculate the full buyer and seller closing cost breakdown in Dubai for a secondary market villa sale at AED 6,500,000 (4% DLD transfer fee, DLD admin fee, trustee office fee, and 2% brokerage commission + 5% UAE VAT). Present it as a clear client table.',
  },
  {
    title: '💬 Post-Viewing WhatsApp Follow-Up',
    desc: 'Polite client follow-up & offer invitation',
    prompt: 'Draft a warm, professional WhatsApp message from an SWK Properties advisor to a buyer who just viewed a 2BR residence in Downtown Dubai today, thanking them and outlining the simple steps to submit a formal Form F offer.',
  },
  {
    title: '📋 RERA Form A / Form F Checklist',
    desc: 'Documents required from Seller & Buyer before MOU',
    prompt: 'List the complete RERA & DLD compliance checklist of documents needed from both Seller and Buyer in Dubai before signing Form A, Form F (MOU), and applying for the developer NOC.',
  },
]

export function OllamaStudio({ compact = false }: { compact?: boolean }) {
  const toast = useToast()
  const qc = useQueryClient()
  const { me, can } = useMeta()

  const stQuery = useQuery({
    queryKey: ['ollama-status'],
    queryFn: () => get<OllamaStatusResponse>('/api/ai/ollama/status'),
    refetchInterval: 25000,
  })

  const [selectedModel, setSelectedModel] = useState<string>('qwen3.5:4b')
  const [thinkMode, setThinkMode] = useState<boolean>(false)
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string>('')
  const [input, setInput] = useState<string>('')
  const [attachments, setAttachments] = useState<{ dataUrl: string; base64: string }[]>([])
  const [busy, setBusy] = useState<boolean>(false)
  const [activating, setActivating] = useState<boolean>(false)
  const [domainModalOpen, setDomainModalOpen] = useState<boolean>(false)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [expandedThink, setExpandedThink] = useState<Record<number, boolean>>({})

  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const storageKey = `swk_ollama_threads_${me?.email || 'staff'}`

  useEffect(() => {
    if (stQuery.data?.defaultModel && !selectedModel) {
      setSelectedModel(stQuery.data.defaultModel)
    }
  }, [stQuery.data?.defaultModel])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      const parsed: ChatThread[] = raw ? JSON.parse(raw) : []
      if (parsed.length > 0) {
        setThreads(parsed)
        setActiveThreadId(parsed[0]!.id)
        return
      }
    } catch { /* ignore */ }
    const initial: ChatThread = {
      id: 't_' + Date.now(),
      title: 'New Conversation',
      updatedAt: Date.now(),
      messages: [],
    }
    setThreads([initial])
    setActiveThreadId(initial.id)
  }, [storageKey])

  const saveThreads = (next: ChatThread[]) => {
    setThreads(next)
    try {
      localStorage.setItem(storageKey, JSON.stringify(next.slice(0, 30)))
    } catch { /* ignore */ }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [threads, activeThreadId, busy])

  const activeThread = threads.find(t => t.id === activeThreadId) ?? threads[0]

  const createNewThread = () => {
    const t: ChatThread = {
      id: 't_' + Date.now(),
      title: 'New Conversation',
      updatedAt: Date.now(),
      messages: [],
    }
    const next = [t, ...threads]
    saveThreads(next)
    setActiveThreadId(t.id)
  }

  const deleteThread = (id: string) => {
    const filtered = threads.filter(t => t.id !== id)
    if (filtered.length === 0) {
      createNewThread()
      return
    }
    saveThreads(filtered)
    if (activeThreadId === id) {
      setActiveThreadId(filtered[0]!.id)
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, 4 - attachments.length)
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = () => {
        const res = String(reader.result || '')
        const base64 = res.includes(',') ? res.split(',')[1]! : res
        setAttachments(prev => [...prev, { dataUrl: res, base64 }].slice(0, 4))
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  const sendMessage = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim()
    if ((!text && attachments.length === 0) || busy || !activeThread) return

    const userMsg: ChatMessage = {
      role: 'user',
      content: text || 'Analyze the attached image.',
      ...(attachments.length > 0 ? { images: attachments.map(a => a.base64) } : {}),
    }

    const updatedMsgs = [...activeThread.messages, userMsg]
    const updatedTitle = activeThread.messages.length === 0 && text
      ? text.slice(0, 42) + (text.length > 42 ? '…' : '')
      : activeThread.title

    const nextThreads = threads.map(t =>
      t.id === activeThread.id ? { ...t, title: updatedTitle, updatedAt: Date.now(), messages: updatedMsgs } : t
    )
    saveThreads(nextThreads)
    if (!overrideText) setInput('')
    setAttachments([])
    setBusy(true)

    try {
      const payloadMessages = updatedMsgs.slice(-14).map(m => ({
        role: m.role,
        content: m.content,
        ...(m.images?.length ? { images: m.images } : {}),
      }))

      const res = await post<{
        ok: boolean
        model: string
        content: string
        thinking: string
        durationMs: number
        evalCount: number
      }>('/api/ai/ollama/chat', {
        model: selectedModel,
        think: thinkMode,
        messages: payloadMessages,
      })

      const aiMsg: ChatMessage = {
        role: 'assistant',
        content: res.content || '(No response generated)',
        thinking: res.thinking || undefined,
        model: res.model || selectedModel,
        durationMs: res.durationMs,
      }

      saveThreads(
        nextThreads.map(t =>
          t.id === activeThread.id
            ? { ...t, updatedAt: Date.now(), messages: [...updatedMsgs, aiMsg] }
            : t
        )
      )
    } catch (err: any) {
      toast.error(err?.message || 'Ollama request failed')
      const errMsg: ChatMessage = {
        role: 'assistant',
        content: `⚠ ${err?.message || 'Could not reach internal Ollama server.'}`,
        model: selectedModel,
      }
      saveThreads(
        nextThreads.map(t =>
          t.id === activeThread.id
            ? { ...t, updatedAt: Date.now(), messages: [...updatedMsgs, errMsg] }
            : t
        )
      )
    } finally {
      setBusy(false)
    }
  }

  const handleActivateOsAi = async () => {
    setActivating(true)
    try {
      await post('/api/ai/ollama/activate', { model: selectedModel })
      toast.ok(`Connected ${selectedModel} as the active SWK OS AI provider for Jarvis & AI Writing!`)
      void stQuery.refetch()
      void qc.invalidateQueries({ queryKey: ['ai-status'] })
    } catch (err: any) {
      toast.error(err?.message || 'Could not activate Ollama')
    } finally {
      setActivating(false)
    }
  }

  const st = stQuery.data
  const models = st?.models?.length
    ? st.models
    : [
        { name: 'qwen3.5:4b', parameterSize: '4.2B', quantization: 'Q4_K_M', family: 'qwen35', sizeMb: 3170 },
        { name: 'qwen3.5:9b', parameterSize: '9.0B', quantization: 'Q4_K_M', family: 'qwen35', sizeMb: 6247 },
      ]

  return (
    <div className="grid gap-3">
      {/* Top Status & Controls Bar */}
      <div className="rounded-2xl border border-line bg-soft p-3 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0b1a33] text-white text-xs font-semibold">
            <span className={cls('w-2 h-2 rounded-full', st?.online ? 'bg-[#4fd39a]' : 'bg-[#f59e0b]')} />
            <span>{st?.online ? 'Ollama Live' : 'Ollama Standby'}</span>
          </div>

          <select
            className="select !w-auto !py-1.5 !text-[13px] font-semibold"
            value={selectedModel}
            onChange={e => setSelectedModel(e.target.value)}
            aria-label="Select Ollama Model"
          >
            {models.map(m => (
              <option key={m.name} value={m.name}>
                {m.name} {m.parameterSize ? `(${m.parameterSize})` : ''} {m.name.includes('4b') ? '· Fast' : m.name.includes('9b') ? '· Pro' : ''}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setThinkMode(v => !v)}
            className={cls(
              'btn sm',
              thinkMode ? 'green' : 'outline'
            )}
            title="Fast Mode replies in ~1 second. Deep Think shows step-by-step reasoning."
          >
            {thinkMode ? <Brain size={14} /> : <Zap size={14} />}
            {thinkMode ? 'Deep Think: ON' : 'Fast Mode (1s)'}
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            value={st?.cfEmail ? `CF Zero Trust: ${st.cfEmail}` : `Staff: ${me?.email || 'Verified'}`}
            tone={st?.domainVerified !== false ? 'green' : 'amber'}
          />
          {can('admin', 'edit') && !st?.aiEnabled && (
            <button
              type="button"
              className="btn outline sm"
              disabled={activating}
              onClick={() => void handleActivateOsAi()}
            >
              {activating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              Connect to Jarvis &amp; OS
            </button>
          )}
          <button
            type="button"
            className="btn outline sm"
            onClick={() => setDomainModalOpen(true)}
            title="Company Domain & Mobile Access Setup"
          >
            <Globe size={14} /> Domain &amp; Mobile
          </button>
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => void stQuery.refetch()}
            title="Refresh Ollama models"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Main Workspace Grid */}
      <div className={cls('grid gap-3', compact ? 'grid-cols-1' : 'lg:grid-cols-[240px_1fr]')}>
        {/* Sidebar threads (desktop mode) */}
        {!compact && (
          <div className="rounded-2xl border border-line bg-card p-3 flex flex-col gap-2 max-h-[64vh]">
            <button type="button" className="btn green w-full justify-center" onClick={createNewThread}>
              <Plus size={15} /> New Chat
            </button>
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted px-1 mt-1">
              Recent Threads
            </div>
            <div className="flex-1 overflow-y-auto grid gap-1 content-start">
              {threads.map(t => (
                <div
                  key={t.id}
                  onClick={() => setActiveThreadId(t.id)}
                  className={cls(
                    'group flex items-center justify-between gap-1.5 px-2.5 py-2 rounded-xl text-[13px] cursor-pointer transition',
                    t.id === activeThread?.id
                      ? 'bg-[#0b1a33] text-white font-semibold'
                      : 'hover:bg-soft text-ink'
                  )}
                >
                  <span className="truncate flex-1">{t.title}</span>
                  <button
                    type="button"
                    onClick={ev => {
                      ev.stopPropagation()
                      deleteThread(t.id)
                    }}
                    className={cls(
                      'opacity-60 hover:opacity-100 bg-transparent border-0 p-0.5 cursor-pointer',
                      t.id === activeThread?.id ? 'text-white' : 'text-muted'
                    )}
                    title="Delete chat"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
            <div className="border-t border-line pt-2 text-[11.5px] text-muted flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-fold shrink-0" />
              <span className="truncate">@{st?.allowedDomains || 'swkpropertiesuae.com'} only</span>
            </div>
          </div>
        )}

        {/* Chat Area */}
        <div className="rounded-2xl border border-line bg-card flex flex-col overflow-hidden">
          <div
            className={cls(
              'p-3 md:p-4 overflow-y-auto grid gap-3 content-start',
              compact ? 'min-h-[280px] max-h-[48vh]' : 'min-h-[380px] max-h-[54vh]'
            )}
          >
            {(!activeThread || activeThread.messages.length === 0) && (
              <div className="grid gap-3 py-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <div className="text-[16px] font-display font-bold text-ink flex items-center gap-2">
                      <Bot size={19} className="text-fold" />
                      SWK Internal Ollama Workspace ({selectedModel})
                    </div>
                    <div className="text-[13px] text-muted mt-0.5">
                      100% private on-premise model for <b>@{st?.allowedDomains || 'swkpropertiesuae.com'}</b> staff. Supports English, Arabic, Vision photos, and instant 1-second Fast Mode.
                    </div>
                  </div>
                  {compact && (
                    <button type="button" className="btn outline sm" onClick={createNewThread}>
                      <Plus size={13} /> Clear
                    </button>
                  )}
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {SWK_PROMPTS.map(p => (
                    <button
                      key={p.title}
                      type="button"
                      onClick={() => void sendMessage(p.prompt)}
                      disabled={busy}
                      className="text-start rounded-xl border border-line bg-soft hover:bg-mint/40 p-3 transition cursor-pointer grid gap-0.5"
                    >
                      <div className="text-[13px] font-bold text-ink">{p.title}</div>
                      <div className="text-[12px] text-muted">{p.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeThread?.messages.map((m, idx) => (
              <div
                key={idx}
                className={cls(
                  'max-w-[92%] rounded-2xl px-4 py-3 text-[14px] leading-relaxed',
                  m.role === 'user'
                    ? 'justify-self-end bg-[#0b1a33] text-white'
                    : 'justify-self-start bg-soft border border-line text-ink w-full'
                )}
              >
                {m.images && m.images.length > 0 && (
                  <div className="flex gap-2 flex-wrap mb-2">
                    {m.images.map((b64, i) => (
                      <img
                        key={i}
                        src={`data:image/jpeg;base64,${b64}`}
                        alt="Uploaded attachment"
                        className="h-20 w-20 object-cover rounded-lg border border-white/20"
                      />
                    ))}
                  </div>
                )}

                {m.thinking && (
                  <div className="mb-2.5 rounded-xl border border-[#d5ddeb] bg-card overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedThink(prev => ({ ...prev, [idx]: !prev[idx] }))}
                      className="w-full px-3 py-1.5 text-xs font-semibold text-fold bg-mint/40 border-0 flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <Brain size={13} /> Thought Process
                      </span>
                      {expandedThink[idx] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    {expandedThink[idx] && (
                      <div className="p-3 text-[12px] text-muted font-mono whitespace-pre-wrap max-h-52 overflow-y-auto border-t border-line">
                        {m.thinking}
                      </div>
                    )}
                  </div>
                )}

                <div className="whitespace-pre-wrap break-words">{m.content}</div>

                {m.role === 'assistant' && (
                  <div className="mt-2 pt-1.5 border-t border-line/60 flex items-center justify-between text-[11px] text-muted">
                    <span>
                      {m.model || selectedModel}
                      {m.durationMs ? ` · ${(m.durationMs / 1000).toFixed(1)}s` : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard?.writeText(m.content)
                        setCopiedIdx(idx)
                        setTimeout(() => setCopiedIdx(null), 1500)
                      }}
                      className="bg-transparent border-0 text-muted hover:text-ink cursor-pointer flex items-center gap-1 text-[11px]"
                    >
                      {copiedIdx === idx ? <Check size={12} /> : <Copy size={12} />}
                      {copiedIdx === idx ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                )}
              </div>
            ))}

            {busy && (
              <div className="flex items-center gap-2 text-muted text-sm px-2">
                <Loader2 size={16} className="animate-spin text-fold" />
                <span>
                  {selectedModel} is {thinkMode ? 'thinking deeply…' : 'generating reply…'}
                </span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Attachment Previews */}
          {attachments.length > 0 && (
            <div className="px-3 pt-2 flex gap-2 flex-wrap border-t border-line bg-soft">
              {attachments.map((att, i) => (
                <div key={i} className="relative w-14 h-14 rounded-lg overflow-hidden border border-line">
                  <img src={att.dataUrl} alt="preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                    className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/75 text-white border-0 grid place-items-center text-[10px] cursor-pointer"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Composer */}
          <form
            className="p-3 border-t border-line bg-soft flex items-center gap-2"
            onSubmit={e => {
              e.preventDefault()
              void sendMessage()
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleImageUpload}
            />
            <button
              type="button"
              className="btn outline sm"
              onClick={() => fileInputRef.current?.click()}
              title="Attach image for Qwen 3.5 Vision (Title Deed, floorplan, property photo)"
              disabled={busy}
            >
              <ImageIcon size={16} />
            </button>
            <input
              className="input flex-1"
              placeholder={`Ask ${selectedModel} anything… (English or Arabic)`}
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={busy}
            />
            <button
              type="submit"
              className="btn green"
              disabled={busy || (!input.trim() && attachments.length === 0)}
            >
              <Send size={15} /> Send
            </button>
          </form>
        </div>
      </div>

      {/* Domain & Mobile Access Modal */}
      <Modal
        open={domainModalOpen}
        onClose={() => setDomainModalOpen(false)}
        title="Company Domain & Mobile Access (SWK Properties Staff)"
        width={640}
        footer={
          <>
            <div className="flex-1" />
            <button className="btn green" onClick={() => setDomainModalOpen(false)}>
              Done
            </button>
          </>
        }
      >
        <div className="grid gap-3 text-[13.5px] leading-relaxed">
          <div className="rounded-xl border border-line bg-soft p-3.5">
            <div className="font-bold text-ink flex items-center gap-1.5 mb-1">
              <Smartphone size={16} className="text-fold" />
              1. Instant Office Wi-Fi &amp; SWK ONE Mobile Access
            </div>
            <div className="text-muted">
              Staff on the office network can open SWK OS or <b>SWK ONE Mobile (<code>/swk-one</code>)</b> on their phones using:
            </div>
            <div className="mt-2 flex gap-2 flex-wrap">
              {(st?.lanUrls?.length ? st.lanUrls : [window.location.origin]).map(u => (
                <code key={u} className="px-2.5 py-1 rounded-lg bg-card border border-line font-mono text-xs text-ink">
                  {u}/ai
                </code>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-line bg-soft p-3.5">
            <div className="font-bold text-ink flex items-center gap-1.5 mb-1">
              <Globe size={16} className="text-fold" />
              2. Worldwide Mobile Access via <code>@swkpropertiesuae.com</code> (Cloudflare Zero Trust)
            </div>
            <div className="text-muted">
              Run <code>start-ollama-tunnel.bat</code> in the repository root to expose this SWK OS + Ollama server through Cloudflare Tunnel to your company domain (e.g. <code>os.swkpropertiesuae.com</code> or <code>ai.swkpropertiesuae.com</code>):
            </div>
            <ol className="mt-2 pl-5 grid gap-1 text-muted">
              <li>
                In <b>Cloudflare Zero Trust → Networks → Tunnels</b>, point <code>os.swkpropertiesuae.com</code> to <code>http://localhost:8080</code>.
              </li>
              <li>
                In <b>Access → Applications</b>, add a self-hosted policy allowing <b>Emails ending in <code>@{st?.allowedDomains || 'swkpropertiesuae.com'}</code></b> (One-Time PIN).
              </li>
              <li>
                SWK OS automatically verifies the <code>Cf-Access-Authenticated-User-Email</code> header and signs staff directly into their <code>@swkpropertiesuae.com</code> workspace!
              </li>
            </ol>
          </div>
        </div>
      </Modal>
    </div>
  )
}
