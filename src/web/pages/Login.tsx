import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowRight, Check, Eye, EyeOff, KeyRound, Loader2, Lock, Mail, ShieldCheck } from 'lucide-react'
import { get, post } from '../lib/api'
import { useMeta } from '../lib/meta'
import { COMMUNITIES } from '../swk/uae'

/**
 * SWK OS sign-in — split-screen layout adapted from the 21st.dev "Sign In Page" (easemize) pattern:
 * staggered blur-in form on the left, full-bleed rounded hero on the right with glass overlays.
 * Re-skinned in SWK Midnight & Champagne, with live Dubai market moments instead of testimonials.
 */
const ease = [0.16, 1, 0.3, 1] as const
const item = { hidden: { opacity: 0, y: 12, filter: 'blur(6px)' }, show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.7, ease } } }

function DubaiTime() {
  const [t, setT] = useState(new Date())
  useEffect(() => { const i = setInterval(() => setT(new Date()), 30000); return () => clearInterval(i) }, [])
  return <>{new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dubai', hour: '2-digit', minute: '2-digit', hour12: true }).format(t).toUpperCase()}</>
}

function MarketMoments() {
  const moments = useMemo(() => COMMUNITIES.map(c => ({ name: c.name, ppsf: c.ppsf, yoy: ((c.ppsf - c.ppsfLY) / c.ppsfLY) * 100, yieldPct: c.yieldPct })), [])
  const [i, setI] = useState(0)
  const reduce = useReducedMotion()
  useEffect(() => { if (reduce) return; const t = setInterval(() => setI(v => (v + 1) % moments.length), 4200); return () => clearInterval(t) }, [moments.length, reduce])
  const m = moments[i]!
  return (
    <div className="swk-glass p-6 w-full max-w-[560px]">
      <div className="flex items-center justify-between gap-3 mb-4">
        <span className="text-[10.5px] font-semibold tracking-[.24em] uppercase text-[#dcc8a2]">Dubai market pulse</span>
        <span className="flex gap-1">{moments.map((_, k) => <span key={k} className="h-1 rounded-full transition-all duration-500" style={{ width: k === i ? 18 : 6, background: k === i ? '#c9a96e' : 'rgba(255,255,255,.25)' }} />)}</span>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={m.name} initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }} transition={{ duration: 0.5, ease }}>
          <div className="font-display text-white text-[26px] font-semibold leading-tight">{m.name}</div>
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div><div className="text-[11px] text-white/55 uppercase tracking-wider">Price / sq ft</div><div className="font-display text-white text-[19px] font-semibold mt-0.5">AED {m.ppsf.toLocaleString()}</div></div>
            <div><div className="text-[11px] text-white/55 uppercase tracking-wider">Year on year</div><div className="font-display text-[19px] font-semibold mt-0.5 text-[#8fe3bd]">+{m.yoy.toFixed(1)}%</div></div>
            <div><div className="text-[11px] text-white/55 uppercase tracking-wider">Gross yield</div><div className="font-display text-white text-[19px] font-semibold mt-0.5">{m.yieldPct.toFixed(1)}%</div></div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

export function Login() {
  const { reload } = useMeta(); const nav = useNavigate()
  const reduce = useReducedMotion()
  const [email, setEmail] = useState(() => localStorage.getItem('swk.remember') || '')
  const [pw, setPw] = useState(''); const [totp, setTotp] = useState(''); const [needTotp, setNeedTotp] = useState(false)
  const [remember, setRemember] = useState(() => !!localStorage.getItem('swk.remember'))
  const [show, setShow] = useState(false); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false)
  const [help, setHelp] = useState(false); const [caps, setCaps] = useState(false)
  const [demo, setDemo] = useState<{ enabled: boolean; email: string; password: string } | null>(null)
  useEffect(() => { void get<any>('/api/demo/status').then(setDemo).catch(() => {}) }, [])

  const signIn = async (em: string, pass: string) => {
    setErr(''); setBusy(true)
    try {
      const r = await post<any>('/api/auth/login', { email: em, password: pass, totp: needTotp ? totp : undefined })
      if (r.needsTotp) { setNeedTotp(true); return }
      if (remember && em === email) localStorage.setItem('swk.remember', em); else if (!remember) localStorage.removeItem('swk.remember')
      setDone(true)
      await new Promise(res => setTimeout(res, reduce ? 0 : 550))
      await reload(); nav('/dashboard', { replace: true })
    } catch (e: any) { setErr(e.message || 'Sign-in failed. Check your details and try again.') } finally { setBusy(false) }
  }
  const submit = (e: React.FormEvent) => { e.preventDefault(); void signIn(email, pw) }

  return (
    <div className="swk-login">
      {/* ---------------------------------------------------------------- form side */}
      <section className="swk-login-form-side">
        <div className="swk-login-grid" aria-hidden />
        <img src="/brand/skyline-front.svg" alt="" aria-hidden className="absolute left-0 right-0 bottom-0 w-full h-[120px] opacity-[.07] pointer-events-none" />

        <motion.header className="relative flex items-center gap-3" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }}>
          <img src="/brand/swk-logo-white.png" alt="SWK Properties" className="h-[54px] w-auto" />
          <div className="h-8 w-px bg-white/15" />
          <div><div className="font-display text-white text-[18px] font-semibold leading-none">SWK OS</div><div className="text-[10px] tracking-[.26em] uppercase text-[#c9a96e] mt-1.5">Real Estate Operating System</div></div>
        </motion.header>

        <motion.div className="relative w-full max-w-[430px] mx-auto lg:mx-0 py-10" variants={{ show: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } } }} initial="hidden" animate="show">
          <motion.div variants={item} className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[.26em] uppercase text-[#c9a96e]"><span className="w-6 h-px bg-[#c9a96e]" />Private office · Dubai</motion.div>
          <motion.h1 variants={item} className="mt-4 mb-0 text-white font-display font-medium leading-[1.04] text-[44px] sm:text-[52px]">
            Welcome <span className="swk-shimmer-text font-semibold">back</span>
          </motion.h1>
          <motion.p variants={item} className="mt-3 text-[15.5px] text-[#a9b6cd]">Sign in to continue to your SWK OS workspace.</motion.p>

          <AnimatePresence>{err && (
            <motion.div role="alert" initial={{ opacity: 0, height: 0, marginTop: 0 }} animate={{ opacity: 1, height: 'auto', marginTop: 22 }} exit={{ opacity: 0, height: 0, marginTop: 0 }} className="overflow-hidden">
              <div className="px-4 py-3 rounded-2xl text-[13.5px] font-medium text-[#ffcfc3] bg-[rgba(196,73,47,.14)] border border-[rgba(196,73,47,.4)]">{err}</div>
            </motion.div>)}</AnimatePresence>

          <form onSubmit={submit} className="mt-7 grid gap-4" aria-label="Sign in" noValidate={false}>
            <motion.div variants={item}>
              <label htmlFor="email" className="block text-[12.5px] font-medium text-[#a9b6cd] mb-2">Email address</label>
              <div className="swk-login-input"><Mail size={18} /><input id="email" type="email" autoComplete="username" required autoFocus={!email} value={email} onChange={e => setEmail(e.target.value)} placeholder="name@swkpropertiesuae.com" /></div>
            </motion.div>
            <motion.div variants={item}>
              <div className="flex items-center justify-between mb-2"><label htmlFor="pw" className="text-[12.5px] font-medium text-[#a9b6cd]">Password</label><button type="button" onClick={() => setHelp(h => !h)} className="text-[12.5px] font-medium text-[#c9a96e] hover:text-[#e6d3a9] bg-transparent border-0 cursor-pointer p-0">Forgot password?</button></div>
              <div className="swk-login-input"><Lock size={18} />
                <input id="pw" type={show ? 'text' : 'password'} autoComplete="current-password" required autoFocus={!!email} value={pw} onChange={e => setPw(e.target.value)} onKeyUp={e => setCaps(e.getModifierState?.('CapsLock'))} placeholder="••••••••••" />
                <button type="button" className="bg-transparent border-0 cursor-pointer p-1 text-[#8a9ab5] hover:text-white" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div>
              <AnimatePresence>{caps && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-[12px] text-[#e6c88f] mt-2">Caps Lock is on</motion.div>}</AnimatePresence>
              <AnimatePresence>{help && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="mt-3 text-[12.5px] leading-relaxed text-[#b9c4d8] rounded-xl px-3.5 py-3 bg-white/[.04] border border-white/10">Password resets are handled by the SWK IT desk. Email <a className="text-[#dcc8a2] underline underline-offset-2" href="mailto:info@swkpropertiesuae.com?subject=SWK%20OS%20password%20reset">info@swkpropertiesuae.com</a> or call +971 56 433 0448.</div>
                </motion.div>)}</AnimatePresence>
            </motion.div>

            <AnimatePresence>{needTotp && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <label htmlFor="totp" className="block text-[12.5px] font-medium text-[#a9b6cd] mb-2">Authenticator code</label>
                <div className="swk-login-input"><KeyRound size={18} /><input id="totp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus required value={totp} onChange={e => setTotp(e.target.value.replace(/\D/g, ''))} placeholder="6-digit code" className="tracking-[.5em] text-[17px]" /></div>
                <p className="text-[12px] text-[#8a9ab5] mt-2 mb-0">Open your authenticator app and enter the code for SWK OS.</p>
              </motion.div>)}</AnimatePresence>

            <motion.label variants={item} className="flex items-center gap-3 text-[13.5px] text-[#c3cde0] cursor-pointer select-none w-fit">
              <input type="checkbox" className="swk-check" checked={remember} onChange={e => setRemember(e.target.checked)} />Keep me signed in on this device
            </motion.label>

            <motion.div variants={item} className="pt-1">
              <button className="swk-login-btn" disabled={busy || done}>
                <span className="relative z-[1] inline-flex items-center justify-center gap-2">
                  <AnimatePresence mode="wait" initial={false}>
                    {done ? <motion.span key="ok" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="inline-flex items-center gap-2"><Check size={19} />Welcome</motion.span>
                      : busy ? <motion.span key="busy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="inline-flex items-center gap-2"><Loader2 size={18} className="animate-spin" />Signing in…</motion.span>
                      : <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="inline-flex items-center gap-2">{needTotp ? 'Verify & sign in' : 'Sign in'}<ArrowRight size={18} /></motion.span>}
                  </AnimatePresence>
                </span>
              </button>
            </motion.div>

            {demo?.enabled && (
              <motion.div variants={item}>
                <button type="button" className="w-full h-[50px] rounded-2xl border border-white/12 bg-white/[.03] text-[#dfe5f0] font-semibold text-[14px] cursor-pointer hover:border-[#c9a96e]/60 hover:bg-white/[.06] transition-colors" disabled={busy} onClick={() => void signIn(demo.email, demo.password)}>Explore the demo workspace</button>
                <p className="text-[12px] text-[#7f90ad] mt-2 mb-0 text-center">Fictional company and sample records — never touches live data.</p>
              </motion.div>
            )}
          </form>
        </motion.div>

        <motion.footer className="relative flex items-center justify-between gap-4 flex-wrap text-[12px] text-[#7f90ad]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9, duration: 0.6 }}>
          <span className="inline-flex items-center gap-2"><ShieldCheck size={15} className="text-[#c9a96e]" />Encrypted session · activity is audited</span>
          <span>© {new Date().getFullYear()} SWK Properties L.L.C · RERA ORN 51517</span>
        </motion.footer>
      </section>

      {/* ---------------------------------------------------------------- hero side */}
      <section className="swk-login-hero" aria-hidden>
        <motion.div className="swk-login-hero-img" style={{ backgroundImage: 'url(/media/hero/dubai-skyline-hero.webp)' }}
          initial={{ opacity: 0, scale: 1.08, x: -20, filter: 'blur(8px)' }} animate={{ opacity: 1, scale: 1, x: 0, filter: 'blur(0px)' }} transition={{ duration: 1.4, ease }}>
          {!reduce && <motion.div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: 'url(/media/hero/dubai-skyline-hero.webp)', backgroundPosition: 'center 35%' }} animate={{ scale: [1, 1.07, 1] }} transition={{ duration: 32, repeat: Infinity, ease: 'easeInOut' }} />}
        </motion.div>
        <div className="swk-login-hero-shade" />
        {/* drifting champagne light */}
        {!reduce && <motion.div className="absolute rounded-full pointer-events-none" style={{ width: 520, height: 520, right: '8%', top: '12%', background: 'radial-gradient(circle, rgba(201,169,110,.22), transparent 65%)' }} animate={{ x: [0, -40, 0], y: [0, 30, 0] }} transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }} />}

        <motion.div className="absolute top-10 right-10 swk-glass px-4 py-2.5 flex items-center gap-3 text-[13px] text-white" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8, duration: 0.6, ease }}>
          <span className="w-2 h-2 rounded-full bg-[#4fd39a] shadow-[0_0_0_4px_rgba(79,211,154,.2)]" />Dubai · <b className="font-semibold"><DubaiTime /></b>
        </motion.div>

        <div className="absolute left-10 right-10 bottom-10 flex flex-col gap-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.8, ease }}>
            <div className="text-[11px] tracking-[.3em] uppercase text-[#dcc8a2] mb-3">Luxury real estate in Dubai</div>
            <div className="font-display text-white text-[40px] xl:text-[48px] leading-[1.04] font-medium max-w-[620px]">Every listing, viewing, lease and transfer — <span className="text-[#dcc8a2]">in one place.</span></div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 1.0, duration: 0.7, ease }}>
            <MarketMoments />
          </motion.div>
        </div>
      </section>
    </div>
  )
}
