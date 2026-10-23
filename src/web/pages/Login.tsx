import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogIn, Eye, EyeOff } from 'lucide-react'
import { get, post } from '../lib/api'
import { ProductBrand } from '../components/ProductBrand'
import { useMeta } from '../lib/meta'

const ROLES = ['Owner', 'Sales', 'Operations Director', 'BDM', 'IT Admin'] as const

export function Login() {
  const { reload } = useMeta(); const nav = useNavigate()
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [totp, setTotp] = useState(''); const [needTotp, setNeedTotp] = useState(false)
  const [show, setShow] = useState(false); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const [role, setRole] = useState<typeof ROLES[0]>('Owner')
  const [selectedRole, setSelectedRole] = useState<typeof ROLES[0] | null>(null)
  const [demo, setDemo] = useState<{ enabled: boolean; email: string; password: string } | null>(null)
  useEffect(() => { void get<any>('/api/demo/status').then(setDemo).catch(() => {}) }, [])
  
  const login = async (em: string, pass: string, r: typeof role) => {
    setErr(''); setBusy(true)
    try {
      const rp = await post<any>('/api/auth/login', { email: em, password: pass, totp: needTotp ? totp : undefined, role: r })
      if (rp.needsTotp) { setNeedTotp(true); return }
      await reload(); nav('/dashboard', { replace: true })
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }
  
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true)
    try {
      const r = selectedRole ? selectedRole : role
      const rem = await post<any>('/api/auth/login', { email, password: pw, totp: needTotp ? totp : undefined, role: r })
      if (rem.needsTotp) { setNeedTotp(true); return }
      await reload(); nav('/dashboard', { replace: true })
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }
  
  return (
    <div className="login-world min-h-full grid lg:grid-cols-[1.05fr_1fr]">
      <div className="login-brand hidden lg:flex flex-col justify-between text-white p-12 relative overflow-hidden" style={{ background: 'linear-gradient(160deg,#1a2620 0%,#0f1714 55%,#0d1310 100%)' }}>
        <img src="/brand/SWK OS-mark.webp" alt="" aria-hidden className="absolute -right-16 -bottom-14 w-[440px] opacity-[.13] pointer-events-none brand-invert" />
        <img src="/brand/swk-logo.png" alt="SWK Properties" className="relative w-[240px]" />
        <div className="relative max-w-[480px]">
          <h1 className="text-white text-[36px] font-extrabold leading-[1.12] m-0">SWK OS</h1>
          <p className="text-[16px] text-white/80 mt-4 leading-relaxed">The SWK OS Engine</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 mt-8 text-[13.5px]">
            {ROLES.map(x => (
              <div key={x} className="flex items-center gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald flex-none" />
                {x}
              </div>
            ))}
          </div>
        </div>
        <a className="brand-partner-wrap relative w-fit no-underline" href="https://swkpropertiesuae.com" target="_blank" rel="noopener noreferrer">
          <span className="mr-2.5 text-[11.5px] font-semibold text-white/70">Brand partner</span>
          <img src="/brand/SWK OS-wordmark.webp" alt="SWK OS Business OS" width="408" height="78" className="brand-invert inline-block h-[26px] w-auto" />
        </a>
        <div className="relative text-xs text-white/55">© {new Date().getFullYear()} SWK Properties L.L.C. · Dubai, United Arab Emirates</div>
      </div>
      <div className="flex items-center justify-center p-6 bg-pearl">
        <form onSubmit={submit} className="w-full max-w-[440px]" aria-labelledby="signin-h">
          <img src="/brand/swk-logo-ink.png" alt="SWK Properties" className="w-[140px] mb-6" />
          <h2 id="signin-h" className="text-[28px] font-extrabold m-0">Sign in to SWK OS</h2>
          <p className="text-muted mt-1 mb-6">Select your role to access the dashboard.</p>
          {err && <div role="alert" className="mb-4 px-3 py-2.5 rounded-lg bg-blush border border-[#f2bcc3] text-[#8f1325] text-sm font-medium">{err}</div>}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {ROLES.map(r => (
              <label key={r} onClick={() => setSelectedRole(selectedRole === r ? null : r as typeof role)}>
                <span className="w-2 h-2 rounded-full bg-emerald" />
                {r}
              </label>
            ))}
          </div>
          <div className="mb-4">
            <label className="label" htmlFor="email">E-mail</label>
            <input id="email" className="input mb-4" style={{ minHeight: 44 }} type="email" autoComplete="username" required autoFocus value={email} onChange={e => setEmail(e.target.value)} placeholder="you@swkpropertiesuae.com" />
          </div>
          <div className="relative mb-4">
            <label className="label" htmlFor="pw">Password</label>
            <div className="relative mb-4"><input id="pw" className="input pr-11" style={{ minHeight: 44 }} type={show ? 'text' : 'password'} autoComplete="current-password" required value={pw} onChange={e => setPw(e.target.value)} /><button type="button" className="absolute right-1 top-1 btn ghost icon" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? <EyeOff /> : <Eye />}</button></div>
          </div>
          {needTotp && <div className="mb-4"><label className="label" htmlFor="totp">Authenticator code</label><input id="totp" className="input mb-4 tracking-[.4em] text-center text-lg" style={{ minHeight: 44 }} inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus required value={totp} onChange={e => setTotp(e.target.value.replace(/\D/g, ''))} /></div>}
          <button className="btn green w-full" style={{ minHeight: 46, fontSize: 15 }} disabled={busy}>Sign in</button>
          {demo?.enabled && <div className="mt-5 pt-5 border-t border-line"><button type="button" className="btn outline w-full" style={{ minHeight: 44 }} disabled={busy} onClick={() => void login(demo.email, demo.password, role as typeof role)}>Explore the demo workspace</button><p className="text-xs text-muted mt-2 mb-0">A separate, fictional company with sample records. Never touches real data.</p></div>}
          <p className="text-xs text-muted mt-6 leading-relaxed">Access is limited to authorised SWK Properties staff. Activity is logged.</p>
        </form>
      </div>
    </div>
  )
}
