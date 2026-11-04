import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowRight, Building2, Check, ChevronLeft, ChevronRight, Eye, EyeOff, Flame, KeyRound, Loader2, Lock, Mail, MapPin, ShieldCheck } from 'lucide-react'
import { get, post } from '../lib/api'
import { useMeta } from '../lib/meta'
import { COMMUNITIES } from '../swk/uae'

/**
 * SWK OS sign-in — split-screen layout with official SWK Properties LLC branding
 * and full-screen Dubai Developer Project Hot Images showcase on the right side.
 */
const ease = [0.16, 1, 0.3, 1] as const
const item = { hidden: { opacity: 0, y: 12, filter: 'blur(6px)' }, show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.7, ease } } }

interface HotDeveloperProject {
  id: string
  project: string
  developer: string
  community: string
  tag: string
  priceFrom: string
  plan: string
  roiOrHighlight: string
  image: string
}

const HOT_DEVELOPER_PROJECTS: readonly HotDeveloperProject[] = [
  {
    id: 'creek-harbour',
    project: 'Creek Waterside Residences & Marina Penthouses',
    developer: 'Emaar Properties',
    community: 'Dubai Creek Harbour',
    tag: 'Hot Waterfront Launch',
    priceFrom: 'AED 3.8M',
    plan: '80/20 Payment Plan · Handover Q4 2027',
    roiOrHighlight: 'Direct Creek Marina & Downtown Skyline Views',
    image: '/media/properties/creek-harbour-waterside-townhouse-1.webp',
  },
  {
    id: 'palm-jumeirah',
    project: 'Palm Jumeirah Signature Frond Beach Villas',
    developer: 'Nakheel',
    community: 'Palm Jumeirah',
    tag: 'Ultra-Prime Trophy Asset',
    priceFrom: 'AED 38.5M',
    plan: 'Ready & Custom Bespoke Editions',
    roiOrHighlight: 'Private Beachfront · +13.7% YoY Capital Growth',
    image: '/media/properties/palm-garden-homes-1.webp',
  },
  {
    id: 'dubai-hills',
    project: 'Fairway Signature Golf Course Mansions',
    developer: 'Emaar Properties',
    community: 'Dubai Hills Estate',
    tag: 'High-Demand Master Community',
    priceFrom: 'AED 26.0M',
    plan: '70/30 Construction Linked',
    roiOrHighlight: '18-Hole Championship Golf & Park Panorama',
    image: '/media/properties/hills-estate-golf-mansion-1.webp',
  },
  {
    id: 'dubai-marina',
    project: 'Marina Gate & Six Senses Sky Penthouses',
    developer: 'Select Group · Sobha Realty',
    community: 'Dubai Marina',
    tag: 'Prime Waterfront',
    priceFrom: 'AED 14.5M',
    plan: '60/40 Plan · Golden Visa Eligible',
    roiOrHighlight: 'Full Marina & Arabian Gulf Horizon Views',
    image: '/media/properties/marina-sky-penthouse-1.webp',
  },
  {
    id: 'business-bay',
    project: 'Marasi Bay & Canal Executive Sky Residences',
    developer: 'Omniyat · Binghatti',
    community: 'Business Bay & Burj District',
    tag: 'Investor Hot Pick',
    priceFrom: 'AED 2.95M',
    plan: '60/40 Payment Plan · 7.4% Gross Yield',
    roiOrHighlight: 'Private Sky Pools & Dubai Water Canal Frontage',
    image: '/media/properties/business-bay-executive-tower-1.webp',
  },
  {
    id: 'dubai-islands',
    project: 'Dubai Islands Beachfront Resort Residences',
    developer: 'Nakheel',
    community: 'Dubai Islands',
    tag: 'New Coastal Masterplan',
    priceFrom: 'AED 2.4M',
    plan: '80/20 Payment Plan · Handover Q2 2028',
    roiOrHighlight: '20 km Blue Flag Beaches & Yacht Marina Access',
    image: '/media/properties/islands-2-1.webp',
  },
] as const

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
    <div className="swk-glass p-4 w-full">
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="text-[10px] font-semibold tracking-[.22em] uppercase text-[#dcc8a2]">DLD Live Market Pulse · {m.name}</span>
        <span className="flex gap-1">{moments.map((_, k) => <span key={k} className="h-1 rounded-full transition-all duration-500" style={{ width: k === i ? 16 : 5, background: k === i ? '#c9a96e' : 'rgba(255,255,255,.25)' }} />)}</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><div className="text-[10px] text-white/60 uppercase tracking-wider">Price / sq ft</div><div className="font-display text-white text-[16px] font-semibold mt-0.5">AED {m.ppsf.toLocaleString()}</div></div>
        <div><div className="text-[10px] text-white/60 uppercase tracking-wider">Year on year</div><div className="font-display text-[16px] font-semibold mt-0.5 text-[#8fe3bd]">+{m.yoy.toFixed(1)}%</div></div>
        <div><div className="text-[10px] text-white/60 uppercase tracking-wider">Gross yield</div><div className="font-display text-white text-[16px] font-semibold mt-0.5">{m.yieldPct.toFixed(1)}%</div></div>
      </div>
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
  const [slideIdx, setSlideIdx] = useState(0)

  useEffect(() => { void get<any>('/api/demo/status').then(setDemo).catch(() => {}) }, [])
  useEffect(() => {
    if (reduce) return
    const timer = setInterval(() => setSlideIdx(v => (v + 1) % HOT_DEVELOPER_PROJECTS.length), 5400)
    return () => clearInterval(timer)
  }, [reduce])

  const activeProject = HOT_DEVELOPER_PROJECTS[slideIdx]!

  const signIn = async (em: string, pass: string, targetPath?: string) => {
    setErr(''); setBusy(true)
    try {
      const r = await post<any>('/api/auth/login', { email: em, password: pass, totp: needTotp ? totp : undefined })
      if (r.needsTotp) { setNeedTotp(true); return }
      if (remember && em === email) localStorage.setItem('swk.remember', em); else if (!remember) localStorage.removeItem('swk.remember')
      setDone(true)
      await new Promise(res => setTimeout(res, reduce ? 0 : 550))
      const dest = targetPath || '/home'
      await reload(); nav(dest, { replace: true })
    } catch (e: any) { setErr(e.message || 'Sign-in failed. Check your details and try again.') } finally { setBusy(false) }
  }
  const submit = (e: React.FormEvent) => { e.preventDefault(); void signIn(email, pw) }

  return (
    <div className="swk-login">
      {/* ---------------------------------------------------------------- form side */}
      <section className="swk-login-form-side">
        <div className="swk-login-grid" aria-hidden />
        <img src="/brand/skyline-front.svg" alt="" aria-hidden className="absolute left-0 right-0 bottom-0 w-full h-[120px] opacity-[.07] pointer-events-none" />

        <motion.header
          className="relative flex items-center gap-3.5 rounded-2xl px-4 py-3 border border-[#c9a96e]/35 bg-[#050d1c]/95 shadow-[0_12px_32px_rgba(0,0,0,.45)] w-fit"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease }}
        >
          <img src="/brand/swk-os-emblem.svg" alt="SWK Tower Monogram" className="h-[46px] w-[46px] object-contain drop-shadow-[0_2px_8px_rgba(201,169,110,.35)]" />
          <img src="/brand/swk-os-wordmark.svg" alt="SWK OS" className="h-[44px] w-auto drop-shadow-[0_2px_8px_rgba(201,169,110,.25)]" />
          <div className="h-8 w-px bg-[#c9a96e]/30 mx-0.5" />
          <div>
            <div className="font-display text-white text-[15.5px] font-semibold leading-none tracking-tight">SWK Properties LLC</div>
            <div className="text-[10px] tracking-[.2em] uppercase text-[#e6c88f] mt-1.5 font-semibold">Operating System · Dubai</div>
          </div>
        </motion.header>

        <motion.div className="relative w-full max-w-[430px] mx-auto lg:mx-0 py-10" variants={{ show: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } } }} initial="hidden" animate="show">
          <motion.div variants={item} className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[.26em] uppercase text-[#c9a96e]"><span className="w-6 h-px bg-[#c9a96e]" />SWK Properties LLC · Dubai</motion.div>
          <motion.h1 variants={item} className="mt-4 mb-0 text-white font-display font-medium leading-[1.04] text-[44px] sm:text-[52px]">
            Welcome <span className="swk-shimmer-text font-semibold">back</span>
          </motion.h1>
          <motion.p variants={item} className="mt-3 text-[15.5px] text-[#a9b6cd]">Sign in to continue to your SWK Properties OS workspace.</motion.p>

          <AnimatePresence>{err && (
            <motion.div role="alert" initial={{ opacity: 0, height: 0, marginTop: 0 }} animate={{ opacity: 1, height: 'auto', marginTop: 22 }} exit={{ opacity: 0, height: 0, marginTop: 0 }} className="overflow-hidden">
              <div className="px-4 py-3 rounded-2xl text-[13.5px] font-medium text-[#ffcfc3] bg-[rgba(196,73,47,.14)] border border-[rgba(196,73,47,.4)]">{err}</div>
            </motion.div>)}</AnimatePresence>

          <form onSubmit={submit} className="mt-7 grid gap-4" aria-label="Sign in" noValidate={false}>
            <motion.div variants={item}>
              <label htmlFor="email" className="block text-[12.5px] font-medium text-[#a9b6cd] mb-2">Email address (@swk.property or @swkpropertiesuae.com)</label>
              <div className="swk-login-input"><Mail size={18} /><input id="email" type="email" autoComplete="username" required autoFocus={!email} value={email} onChange={e => setEmail(e.target.value)} placeholder="Talha@swk.property or admin@swkpropertiesuae.com" /></div>
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

        <motion.footer className="relative flex flex-col gap-1.5 text-[11.5px] text-[#8a9ab5]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9, duration: 0.6 }}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <span className="inline-flex items-center gap-2"><ShieldCheck size={15} className="text-[#c9a96e]" />Encrypted session · activity is audited</span>
            <span className="font-semibold text-[#dcc8a2]">© {new Date().getFullYear()} SWK Properties LLC</span>
          </div>
          <div className="text-[11px] text-[#9eb0cc]">www.swk.properties · www.swkpropertiesuae.com · www.swk.rent</div>
        </motion.footer>
      </section>

      {/* ---------------------------------------------------------------- hero side: developer project hot images */}
      <section className="swk-login-hero" aria-label="Featured Dubai Developer Projects">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeProject.id}
            className="swk-login-hero-img"
            style={{
              backgroundImage: `url(${activeProject.image})`,
              backgroundPosition: 'center center',
              backgroundSize: 'cover',
              backgroundRepeat: 'no-repeat',
            }}
            initial={{ opacity: 0, scale: 1.06 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.95, ease }}
          />
        </AnimatePresence>
        <div
          className="swk-login-hero-shade"
          style={{
            background:
              'linear-gradient(180deg, rgba(6,13,26,.62) 0%, rgba(6,13,26,.22) 38%, rgba(6,13,26,.82) 78%, rgba(6,13,26,.96) 100%)',
          }}
        />

        <motion.div className="absolute top-8 left-10 swk-glass px-4 py-2.5 flex items-center gap-3 text-[12.5px] text-white" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.5, ease }}>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#c9a96e]/25 border border-[#c9a96e]/50 text-[#f5e3be] text-[10.5px] font-bold uppercase tracking-wider">
            <Flame size={13} className="text-[#f5c77e]" /> Developer Hot Projects
          </span>
          <span className="text-white/85 font-medium">SWK Properties LLC · Dubai</span>
        </motion.div>

        <motion.div className="absolute top-8 right-10 swk-glass px-4 py-2.5 flex items-center gap-3 text-[13px] text-white" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.5, ease }}>
          <span className="w-2 h-2 rounded-full bg-[#4fd39a] shadow-[0_0_0_4px_rgba(79,211,154,.2)]" />Dubai · <b className="font-semibold"><DubaiTime /></b>
        </motion.div>

        <div className="absolute left-10 right-10 bottom-8 flex flex-col gap-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeProject.id}
              className="swk-glass p-6 border border-[#c9a96e]/35"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5, ease }}
            >
              <div className="flex items-center justify-between gap-3 flex-wrap mb-2.5">
                <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.18em] text-[#f3dfb8]">
                  <Building2 size={14} className="text-[#c9a96e]" />
                  <span>{activeProject.developer}</span>
                  <span className="text-white/35">·</span>
                  <span className="inline-flex items-center gap-1 text-[#8fe3bd]"><MapPin size={12} /> {activeProject.community}</span>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10.5px] font-bold uppercase tracking-wider bg-[#c9a96e] text-[#08142a]">
                  {activeProject.tag}
                </span>
              </div>

              <div className="font-display text-white text-[28px] xl:text-[34px] leading-[1.1] font-semibold">
                {activeProject.project}
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3.5 border-t border-white/12">
                <div>
                  <div className="text-[10.5px] text-white/60 uppercase tracking-wider">Starting From</div>
                  <div className="font-display text-[#f3dfb8] text-[20px] font-semibold mt-0.5">{activeProject.priceFrom}</div>
                </div>
                <div>
                  <div className="text-[10.5px] text-white/60 uppercase tracking-wider">Payment Structure</div>
                  <div className="text-white text-[13px] font-semibold mt-1">{activeProject.plan}</div>
                </div>
                <div>
                  <div className="text-[10.5px] text-white/60 uppercase tracking-wider">Project Highlight</div>
                  <div className="text-[#8fe3bd] text-[13px] font-semibold mt-1">{activeProject.roiOrHighlight}</div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-4 items-center">
            <MarketMoments />

            <div className="swk-glass p-2.5 flex items-center gap-2 self-stretch">
              <button
                type="button"
                onClick={() => setSlideIdx(v => (v - 1 + HOT_DEVELOPER_PROJECTS.length) % HOT_DEVELOPER_PROJECTS.length)}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border-0 cursor-pointer transition-colors"
                aria-label="Previous developer project"
              >
                <ChevronLeft size={17} />
              </button>
              <div className="flex items-center gap-1.5 px-1">
                {HOT_DEVELOPER_PROJECTS.map((proj, idx) => (
                  <button
                    key={proj.id}
                    type="button"
                    onClick={() => setSlideIdx(idx)}
                    aria-label={`Show ${proj.project}`}
                    className="relative rounded-xl overflow-hidden border transition-all cursor-pointer p-0 bg-black"
                    style={{
                      width: idx === slideIdx ? 58 : 42,
                      height: 40,
                      borderColor: idx === slideIdx ? '#c9a96e' : 'rgba(255,255,255,.2)',
                      opacity: idx === slideIdx ? 1 : 0.65,
                    }}
                  >
                    <img src={proj.image} alt={proj.project} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setSlideIdx(v => (v + 1) % HOT_DEVELOPER_PROJECTS.length)}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border-0 cursor-pointer transition-colors"
                aria-label="Next developer project"
              >
                <ChevronRight size={17} />
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
