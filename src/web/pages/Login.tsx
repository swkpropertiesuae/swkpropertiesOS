import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  Activity,
  ArrowRight,
  BarChart3,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Flame,
  KeyRound,
  Landmark,
  Loader2,
  Lock,
  Mail,
  Percent,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react'
import { get, post } from '../lib/api'
import { useMeta } from '../lib/meta'
import { COMMUNITIES, QUARTERS } from '../swk/uae'

/**
 * SWK OS sign-in — split-screen layout with Royal Midnight Navy & Champagne Gold branding
 * and a live DLD Market Pulse & 24-Corridor Intelligence showcase on the right side.
 */
const ease = [0.16, 1, 0.3, 1] as const
const item = {
  hidden: { opacity: 0, y: 12, filter: 'blur(6px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.7, ease } },
}

interface DeveloperCatalyst {
  areaId: string
  project: string
  developer: string
  plan: string
  highlight: string
}

const DEVELOPER_CATALYSTS: Record<string, DeveloperCatalyst> = {
  'palm-jumeirah': {
    areaId: 'palm-jumeirah',
    project: 'Palm Jumeirah Signature Frond Beach Villas',
    developer: 'Nakheel · Omniyat',
    plan: 'Ready & Bespoke Editions · Golden Visa',
    highlight: 'Private Beachfront · +17.7% YoY Capital Appreciation',
  },
  'downtown-dubai': {
    areaId: 'downtown-dubai',
    project: 'Burj District & Opera Grand Sky Residences',
    developer: 'Emaar Properties',
    plan: '70/30 Construction Plan · High Liquidity',
    highlight: 'Direct Burj Khalifa & Fountain Boulevard Views',
  },
  'dubai-marina': {
    areaId: 'dubai-marina',
    project: 'Marina Gate & Six Senses Sky Penthouses',
    developer: 'Select Group · Sobha Realty',
    plan: '60/40 Plan · Prime Waterfront',
    highlight: 'Full Marina & Arabian Gulf Horizon · 6.4% Gross Yield',
  },
  'business-bay': {
    areaId: 'business-bay',
    project: 'Marasi Bay & Canal Executive Sky Residences',
    developer: 'Omniyat · Binghatti',
    plan: '60/40 Payment Plan · 6.8% Gross Yield',
    highlight: 'Private Sky Pools & Dubai Water Canal Frontage',
  },
  'dubai-hills-estate': {
    areaId: 'dubai-hills-estate',
    project: 'Fairway Signature Golf Course Mansions',
    developer: 'Emaar Properties',
    plan: '70/30 Construction Linked · Master Community',
    highlight: '18-Hole Championship Golf & Central Park Panorama',
  },
  'dubai-creek-harbour': {
    areaId: 'dubai-creek-harbour',
    project: 'Creek Waterside Residences & Marina Penthouses',
    developer: 'Emaar Properties',
    plan: '80/20 Payment Plan · Handover Q4 2027',
    highlight: 'Direct Creek Marina & Downtown Skyline Views',
  },
  jvc: {
    areaId: 'jvc',
    project: 'Circle Boulevard & High-Yield Investor Suites',
    developer: 'Ellington · Binghatti · Danube',
    plan: '60/40 & Post-Handover Plans',
    highlight: '#1 DLD Transaction Volume · 7.9% Gross Rental Yield',
  },
  difc: {
    areaId: 'difc',
    project: 'DIFC Gate Avenue & Financial District Residences',
    developer: 'DIFC Developments · Omniyat',
    plan: '60/40 Institutional Grade',
    highlight: 'Walk-to-Gate Village · Trophy Executive Tenant Demand',
  },
  'dubai-south': {
    areaId: 'dubai-south',
    project: 'Al Maktoum Aerotropolis & Lagoon Masterplan',
    developer: 'Emaar · Azizi · Dubai South',
    plan: '80/20 & 50/50 Flexible Plans',
    highlight: 'Next to AED 128B Al Maktoum International Airport Expansion',
  },
}

const FEATURED_PULSE_IDS = [
  'palm-jumeirah',
  'downtown-dubai',
  'dubai-marina',
  'business-bay',
  'dubai-hills-estate',
  'dubai-creek-harbour',
  'jvc',
  'difc',
  'dubai-south',
]

function DubaiTime() {
  const [t, setT] = useState(new Date())
  useEffect(() => {
    const i = setInterval(() => setT(new Date()), 30000)
    return () => clearInterval(i)
  }, [])
  return (
    <>
      {new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Dubai',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
        .format(t)
        .toUpperCase()}
    </>
  )
}

export function Login() {
  const { reload } = useMeta()
  const nav = useNavigate()
  const reduce = useReducedMotion()
  const [email, setEmail] = useState(() => localStorage.getItem('swk.remember') || '')
  const [pw, setPw] = useState('')
  const [totp, setTotp] = useState('')
  const [needTotp, setNeedTotp] = useState(false)
  const [remember, setRemember] = useState(() => !!localStorage.getItem('swk.remember'))
  const [show, setShow] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [help, setHelp] = useState(false)
  const [caps, setCaps] = useState(false)
  const [demo, setDemo] = useState<{ enabled: boolean; email: string; password: string } | null>(null)
  const [pulseIdx, setPulseIdx] = useState(0)

  const pulseCommunities = useMemo(() => {
    const picked = FEATURED_PULSE_IDS.map(id => COMMUNITIES.find(c => c.id === id)).filter(Boolean) as typeof COMMUNITIES
    return picked.length ? picked : COMMUNITIES.slice(0, 8)
  }, [])

  const macroKpi = useMemo(() => {
    const totalTx = COMMUNITIES.reduce((s, c) => s + c.transactionsQ, 0)
    const avgPpsf = Math.round(COMMUNITIES.reduce((s, c) => s + c.ppsf, 0) / COMMUNITIES.length)
    const avgPpsfLY = COMMUNITIES.reduce((s, c) => s + c.ppsfLY, 0) / COMMUNITIES.length
    const avgYoY = ((avgPpsf - avgPpsfLY) / avgPpsfLY) * 100
    const avgYield = COMMUNITIES.reduce((s, c) => s + c.yieldPct, 0) / COMMUNITIES.length
    const offPlanWeighted =
      COMMUNITIES.reduce((s, c) => s + c.offPlanShare * c.transactionsQ, 0) / Math.max(1, totalTx)
    return {
      totalTx,
      avgPpsf,
      avgYoY,
      avgYield,
      offPlanWeighted,
    }
  }, [])

  useEffect(() => {
    void get<any>('/api/demo/status')
      .then(setDemo)
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (reduce) return
    const timer = setInterval(() => setPulseIdx(v => (v + 1) % pulseCommunities.length), 5200)
    return () => clearInterval(timer)
  }, [pulseCommunities.length, reduce])

  const activeArea = pulseCommunities[pulseIdx]!
  const activeYoY = ((activeArea.ppsf - activeArea.ppsfLY) / activeArea.ppsfLY) * 100
  const activeCatalyst = DEVELOPER_CATALYSTS[activeArea.id] ?? {
    areaId: activeArea.id,
    project: `${activeArea.name} Prime Residences`,
    developer: 'Emaar · Nakheel · Sobha',
    plan: '60/40 & 80/20 Construction Plans',
    highlight: `Strong institutional demand · ${activeArea.yieldPct.toFixed(1)}% gross rental yield`,
  }
  const trendMin = Math.min(...activeArea.trend) * 0.92
  const trendMax = Math.max(...activeArea.trend)

  const signIn = async (em: string, pass: string, targetPath?: string) => {
    setErr('')
    setBusy(true)
    try {
      const r = await post<any>('/api/auth/login', {
        email: em,
        password: pass,
        totp: needTotp ? totp : undefined,
      })
      if (r.needsTotp) {
        setNeedTotp(true)
        return
      }
      if (remember && em === email) localStorage.setItem('swk.remember', em)
      else if (!remember) localStorage.removeItem('swk.remember')
      setDone(true)
      await new Promise(res => setTimeout(res, reduce ? 0 : 550))
      const dest = targetPath || '/home'
      await reload()
      nav(dest, { replace: true })
    } catch (e: any) {
      setErr(e.message || 'Sign-in failed. Check your details and try again.')
    } finally {
      setBusy(false)
    }
  }
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    void signIn(email, pw)
  }

  return (
    <div className="swk-login">
      {/* ---------------------------------------------------------------- form side */}
      <section className="swk-login-form-side">
        <div className="swk-login-grid" aria-hidden />
        <img
          src="/brand/skyline-front.svg"
          alt=""
          aria-hidden
          className="absolute left-0 right-0 bottom-0 w-full h-[120px] opacity-[.07] pointer-events-none"
        />

        <motion.header
          className="relative flex items-center gap-3 rounded-2xl px-4 py-2.5 border border-[#c9a96e]/35 bg-[#08142a]/90 shadow-[0_12px_32px_rgba(0,0,0,.4)] w-fit"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease }}
        >
          <span className="w-9 h-9 rounded-xl grid place-items-center bg-gradient-to-br from-[#f3dfb8] to-[#c9a96e] text-[#08142a] font-display font-bold text-[13px] tracking-wider shadow-sm">
            SWK
          </span>
          <div>
            <div className="font-display text-white text-[15px] font-semibold leading-none tracking-tight">
              SWK Properties LLC
            </div>
            <div className="text-[10px] tracking-[.2em] uppercase text-[#e6c88f] mt-1 font-semibold">
              Operating System · Dubai
            </div>
          </div>
        </motion.header>

        <motion.div
          className="relative w-full max-w-[430px] mx-auto lg:mx-0 py-10"
          variants={{ show: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } } }}
          initial="hidden"
          animate="show"
        >
          <motion.div
            variants={item}
            className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[.26em] uppercase text-[#c9a96e]"
          >
            <span className="w-6 h-px bg-[#c9a96e]" />
            SWK Properties LLC · Dubai
          </motion.div>
          <motion.h1
            variants={item}
            className="mt-4 mb-0 text-white font-display font-medium leading-[1.04] text-[44px] sm:text-[52px]"
          >
            Welcome <span className="swk-shimmer-text font-semibold">back</span>
          </motion.h1>
          <motion.p variants={item} className="mt-3 text-[15.5px] text-[#a9b6cd]">
            Sign in to continue to your SWK Properties OS workspace.
          </motion.p>

          <AnimatePresence>
            {err && (
              <motion.div
                role="alert"
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 22 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                className="overflow-hidden"
              >
                <div className="px-4 py-3 rounded-2xl text-[13.5px] font-medium text-[#ffcfc3] bg-[rgba(196,73,47,.14)] border border-[rgba(196,73,47,.4)]">
                  {err}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={submit} className="mt-7 grid gap-4" aria-label="Sign in" noValidate={false}>
            <motion.div variants={item}>
              <label htmlFor="email" className="block text-[12.5px] font-medium text-[#b8c3d7] mb-2">
                Email address (@swk.property or @swkpropertiesuae.com)
              </label>
              <div className="swk-login-input">
                <Mail size={18} />
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  required
                  autoFocus={!email}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Talha@swk.property or admin@swkpropertiesuae.com"
                />
              </div>
            </motion.div>
            <motion.div variants={item}>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="pw" className="text-[12.5px] font-medium text-[#b8c3d7]">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setHelp(h => !h)}
                  className="text-[12.5px] font-medium text-[#c9a96e] hover:text-[#e8d29c] bg-transparent border-0 cursor-pointer p-0"
                >
                  Forgot password?
                </button>
              </div>
              <div className="swk-login-input">
                <Lock size={18} />
                <input
                  id="pw"
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  autoFocus={!!email}
                  value={pw}
                  onChange={e => setPw(e.target.value)}
                  onKeyUp={e => setCaps(e.getModifierState?.('CapsLock'))}
                  placeholder="••••••••••"
                />
                <button
                  type="button"
                  className="bg-transparent border-0 cursor-pointer p-1 text-[#8a9ab5] hover:text-white"
                  onClick={() => setShow(s => !s)}
                  aria-label={show ? 'Hide password' : 'Show password'}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <AnimatePresence>
                {caps && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-[12px] text-[#e8d29c] mt-2"
                  >
                    Caps Lock is on
                  </motion.div>
                )}
              </AnimatePresence>
              <AnimatePresence>
                {help && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 text-[12.5px] leading-relaxed text-[#c6d1e3] rounded-xl px-3.5 py-3 bg-white/[.04] border border-white/10">
                      Password resets are handled by the SWK IT desk. Email{' '}
                      <a
                        className="text-[#e8d29c] underline underline-offset-2"
                        href="mailto:info@swkpropertiesuae.com?subject=SWK%20OS%20password%20reset"
                      >
                        info@swkpropertiesuae.com
                      </a>{' '}
                      or call +971 56 433 0448.
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            <AnimatePresence>
              {needTotp && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <label htmlFor="totp" className="block text-[12.5px] font-medium text-[#b8c3d7] mb-2">
                    Authenticator code
                  </label>
                  <div className="swk-login-input">
                    <KeyRound size={18} />
                    <input
                      id="totp"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      autoFocus
                      required
                      value={totp}
                      onChange={e => setTotp(e.target.value.replace(/\D/g, ''))}
                      placeholder="6-digit code"
                      className="tracking-[.5em] text-[17px]"
                    />
                  </div>
                  <p className="text-[12px] text-[#8a9ab5] mt-2 mb-0">
                    Open your authenticator app and enter the code for SWK OS.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.label
              variants={item}
              className="flex items-center gap-3 text-[13.5px] text-[#d1d9e8] cursor-pointer select-none w-fit"
            >
              <input
                type="checkbox"
                className="swk-check"
                checked={remember}
                onChange={e => setRemember(e.target.checked)}
              />
              Keep me signed in on this device
            </motion.label>

            <motion.div variants={item} className="pt-1">
              <button type="submit" className="swk-login-btn" disabled={busy || done}>
                <span className="relative z-[1] inline-flex items-center justify-center gap-2">
                  <AnimatePresence mode="wait" initial={false}>
                    {done ? (
                      <motion.span
                        key="ok"
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="inline-flex items-center gap-2"
                      >
                        <Check size={19} />
                        Welcome
                      </motion.span>
                    ) : busy ? (
                      <motion.span
                        key="busy"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="inline-flex items-center gap-2"
                      >
                        <Loader2 size={18} className="animate-spin" />
                        Signing in…
                      </motion.span>
                    ) : (
                      <motion.span
                        key="idle"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="inline-flex items-center gap-2"
                      >
                        {needTotp ? 'Verify & sign in' : 'Sign in'}
                        <ArrowRight size={18} />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
              </button>
            </motion.div>

            {demo?.enabled && (
              <motion.div variants={item}>
                <button
                  type="button"
                  className="w-full h-[50px] rounded-2xl border border-white/12 bg-white/[.03] text-[#e7e1d4] font-semibold text-[14px] cursor-pointer hover:border-[#c9a96e]/60 hover:bg-white/[.06] transition-colors"
                  disabled={busy}
                  onClick={() => void signIn(demo.email, demo.password)}
                >
                  Explore the demo workspace
                </button>
                <p className="text-[12px] text-[#8a9ab5] mt-2 mb-0 text-center">
                  Fictional company and sample records — never touches live data.
                </p>
              </motion.div>
            )}
          </form>
        </motion.div>

        <motion.footer
          className="relative flex flex-col gap-1.5 text-[11.5px] text-[#7f8fa8]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.6 }}
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck size={15} className="text-[#c9a96e]" />
              Encrypted session · activity is audited
            </span>
            <span className="font-semibold text-[#d6be8c]">
              © {new Date().getFullYear()} SWK Properties LLC
            </span>
          </div>
          <div className="text-[11px] text-[#9aabc6]">
            www.swk.properties · www.swkpropertiesuae.com · www.swk.rent
          </div>
        </motion.footer>
      </section>

      {/* ---------------------------------------------------------------- hero side: DLD Live Market Pulse & 24-Corridor Intelligence */}
      <section className="swk-login-hero" aria-label="DLD Live Market Pulse & Dubai Corridor Intelligence">
        <div
          className="swk-login-hero-img"
          style={{
            backgroundImage: `url(${activeArea.image || '/media/hero/dubai-skyline-hero.webp'})`,
            backgroundPosition: 'center center',
            backgroundSize: 'cover',
            backgroundRepeat: 'no-repeat',
            opacity: 0.28,
          }}
        />
        <div
          className="swk-login-hero-shade"
          style={{
            background:
              'linear-gradient(165deg, rgba(8,20,42,.92) 0%, rgba(11,26,51,.84) 45%, rgba(8,20,42,.96) 100%)',
          }}
        />

        <div className="relative z-[2] h-full flex flex-col justify-between p-8 xl:p-10 gap-5 overflow-y-auto">
          {/* Top Bar */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="swk-glass px-4 py-2.5 flex items-center gap-3 text-[12.5px] text-white">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#c9a96e]/25 border border-[#c9a96e]/50 text-[#f3dfb8] text-[10.5px] font-bold uppercase tracking-wider">
                <Activity size={13} className="text-[#f3dfb8]" /> DLD Market Pulse
              </span>
              <span className="text-white/85 font-medium">24 Dubai Corridors · Live Intelligence</span>
            </div>

            <div className="swk-glass px-4 py-2.5 flex items-center gap-3 text-[12.5px] text-white">
              <span className="w-2 h-2 rounded-full bg-[#4fd39a] shadow-[0_0_0_4px_rgba(79,211,154,.2)]" />
              <span>
                Dubai · <b className="font-semibold"><DubaiTime /></b>
              </span>
              <span className="text-white/30">·</span>
              <span className="text-[#f3dfb8] font-semibold">RERA ORN 51517</span>
            </div>
          </div>

          {/* Center & Bottom Market Pulse Details Stack */}
          <div className="flex flex-col gap-4 my-auto">
            <div>
              <div className="text-[11px] font-bold tracking-[.26em] uppercase text-[#c9a96e] mb-1.5">
                Dubai Land Department · Real-Time Market Pulse
              </div>
              <h2 className="m-0 font-display text-white text-[26px] xl:text-[32px] leading-[1.1] font-semibold">
                24-Corridor Stock-Market Intelligence,{' '}
                <span className="text-[#f3dfb8]">RERA Yields & Daily Transfers</span>
              </h2>
            </div>

            {/* 4 Macro Market KPI Tiles */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              <div className="swk-glass p-3.5 border border-[#c9a96e]/25">
                <div className="flex items-center justify-between text-[10.5px] text-white/65 uppercase tracking-wider">
                  <span>Avg Price / Sq Ft</span>
                  <Landmark size={13} className="text-[#c9a96e]" />
                </div>
                <div className="font-display text-white text-[20px] font-semibold mt-1">
                  AED {macroKpi.avgPpsf.toLocaleString()}
                </div>
                <div className="text-[11px] text-[#8fe3bd] font-semibold mt-0.5">
                  ▲ +{macroKpi.avgYoY.toFixed(1)}% YoY (24 Areas)
                </div>
              </div>

              <div className="swk-glass p-3.5 border border-[#c9a96e]/25">
                <div className="flex items-center justify-between text-[10.5px] text-white/65 uppercase tracking-wider">
                  <span>Avg Gross Yield</span>
                  <Percent size={13} className="text-[#c9a96e]" />
                </div>
                <div className="font-display text-white text-[20px] font-semibold mt-1">
                  {macroKpi.avgYield.toFixed(2)}%
                </div>
                <div className="text-[11px] text-[#f3dfb8] font-semibold mt-0.5">
                  RERA Rental Index Verified
                </div>
              </div>

              <div className="swk-glass p-3.5 border border-[#c9a96e]/25">
                <div className="flex items-center justify-between text-[10.5px] text-white/65 uppercase tracking-wider">
                  <span>Quarterly DLD Volume</span>
                  <BarChart3 size={13} className="text-[#c9a96e]" />
                </div>
                <div className="font-display text-white text-[20px] font-semibold mt-1">
                  {macroKpi.totalTx.toLocaleString()}
                </div>
                <div className="text-[11px] text-[#8fe3bd] font-semibold mt-0.5">
                  Registered DLD Transfers / Qtr
                </div>
              </div>

              <div className="swk-glass p-3.5 border border-[#c9a96e]/25">
                <div className="flex items-center justify-between text-[10.5px] text-white/65 uppercase tracking-wider">
                  <span>Off-Plan Share</span>
                  <Building2 size={13} className="text-[#c9a96e]" />
                </div>
                <div className="font-display text-white text-[20px] font-semibold mt-1">
                  {macroKpi.offPlanWeighted.toFixed(1)}%
                </div>
                <div className="text-[11px] text-white/75 font-semibold mt-0.5">
                  Oqood vs Ready Title Deeds
                </div>
              </div>
            </div>

            {/* Active Corridor Market Pulse Spotlight */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeArea.id}
                className="swk-glass p-5 xl:p-6 border border-[#c9a96e]/40"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4, ease }}
              >
                <div className="flex items-center justify-between gap-3 flex-wrap pb-3.5 border-b border-white/12">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="px-2.5 py-1 rounded-lg bg-[#c9a96e] text-[#08142a] font-mono text-[11px] font-extrabold tracking-wider">
                      {activeArea.ticker ?? activeArea.code}
                    </span>
                    <span className="font-display text-white text-[22px] xl:text-[25px] font-semibold leading-none">
                      {activeArea.name}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold uppercase tracking-wider bg-white/10 text-[#f3dfb8] border border-[#c9a96e]/35">
                      {activeArea.segment} Corridor
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setPulseIdx(v => (v - 1 + pulseCommunities.length) % pulseCommunities.length)
                      }
                      className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border-0 cursor-pointer transition-colors"
                      aria-label="Previous corridor"
                    >
                      <ChevronLeft size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPulseIdx(v => (v + 1) % pulseCommunities.length)}
                      className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border-0 cursor-pointer transition-colors"
                      aria-label="Next corridor"
                    >
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </div>

                {/* 4 Key Corridor Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3.5">
                  <div>
                    <div className="text-[10.5px] text-white/60 uppercase tracking-wider">Current Median</div>
                    <div className="font-display text-[#f3dfb8] text-[20px] font-semibold mt-0.5">
                      AED {activeArea.ppsf.toLocaleString()}{' '}
                      <span className="text-[11px] font-normal text-white/60">/sq ft</span>
                    </div>
                    <div className="text-[11px] text-white/55">
                      Last Year: AED {activeArea.ppsfLY.toLocaleString()}/sq ft
                    </div>
                  </div>

                  <div>
                    <div className="text-[10.5px] text-white/60 uppercase tracking-wider">YoY Capital Growth</div>
                    <div className="font-display text-[#8fe3bd] text-[20px] font-semibold mt-0.5 inline-flex items-center gap-1">
                      <TrendingUp size={16} /> +{activeYoY.toFixed(1)}%
                    </div>
                    <div className="text-[11px] text-white/55">DLD Verified Appreciation</div>
                  </div>

                  <div>
                    <div className="text-[10.5px] text-white/60 uppercase tracking-wider">Gross Rental Yield</div>
                    <div className="font-display text-white text-[20px] font-semibold mt-0.5">
                      {activeArea.yieldPct.toFixed(1)}%
                    </div>
                    <div className="text-[11px] text-white/55">
                      Service Charge: AED {activeArea.serviceCharge}/sq ft
                    </div>
                  </div>

                  <div>
                    <div className="text-[10.5px] text-white/60 uppercase tracking-wider">Quarterly Volume</div>
                    <div className="font-display text-white text-[20px] font-semibold mt-0.5">
                      {activeArea.transactionsQ.toLocaleString()} deals
                    </div>
                    <div className="text-[11px] text-[#f3dfb8]">
                      {activeArea.offPlanShare}% Off-Plan · {100 - activeArea.offPlanShare}% Ready
                    </div>
                  </div>
                </div>

                {/* 9-Quarter Trajectory + RERA Rental Index */}
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 mt-4 pt-3.5 border-t border-white/12">
                  {/* 9-Quarter Price Trajectory Bars */}
                  <div className="xl:col-span-6">
                    <div className="flex items-center justify-between text-[10.5px] uppercase tracking-wider text-white/65 mb-2">
                      <span>9-Quarter Price / Sq Ft Trajectory ({QUARTERS[0]} → {QUARTERS[QUARTERS.length - 1]})</span>
                      <span className="text-[#8fe3bd] font-bold">
                        AED {activeArea.trend[0]} → AED {activeArea.trend[activeArea.trend.length - 1]}
                      </span>
                    </div>
                    <div className="grid grid-cols-9 gap-1.5 items-end h-[54px] pt-2">
                      {activeArea.trend.map((val, idx) => {
                        const heightPct = Math.max(
                          22,
                          Math.round(((val - trendMin) / Math.max(1, trendMax - trendMin)) * 100)
                        )
                        const isLatest = idx === activeArea.trend.length - 1
                        return (
                          <div key={QUARTERS[idx]} className="flex flex-col items-center gap-1 h-full justify-end">
                            <div
                              className="w-full rounded-t transition-all duration-500"
                              style={{
                                height: `${heightPct}%`,
                                background: isLatest
                                  ? 'linear-gradient(180deg, #f3dfb8 0%, #c9a96e 100%)'
                                  : 'rgba(201,169,110,0.35)',
                              }}
                              title={`${QUARTERS[idx]}: AED ${val}/sq ft`}
                            />
                            <span className="text-[9px] font-mono text-white/55">{QUARTERS[idx]}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* RERA Annual Rent Index Benchmarks */}
                  <div className="xl:col-span-6">
                    <div className="text-[10.5px] uppercase tracking-wider text-white/65 mb-2">
                      RERA Annual Rent Index Benchmarks ({activeArea.name})
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: 'Studio', val: activeArea.rentStudio },
                        { label: '1 BR', val: activeArea.rent1 },
                        { label: '2 BR', val: activeArea.rent2 },
                        { label: '3 BR', val: activeArea.rent3 },
                      ].map(r => (
                        <div
                          key={r.label}
                          className="rounded-xl bg-white/[.05] border border-white/10 px-2.5 py-2 text-center"
                        >
                          <div className="text-[10px] text-white/60 uppercase">{r.label}</div>
                          <div className="font-mono text-[12.5px] font-bold text-[#f3dfb8] mt-0.5">
                            AED {Math.round(r.val / 1000)}k
                          </div>
                          <div className="text-[9.5px] text-white/45">per year</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Active Developer Catalyst */}
                <div className="mt-3.5 pt-3 border-t border-white/12 flex items-center justify-between gap-3 flex-wrap text-[12px]">
                  <div className="flex items-center gap-2 text-white/90">
                    <Flame size={14} className="text-[#c9a96e] flex-none" />
                    <span className="font-semibold text-[#f3dfb8]">{activeCatalyst.developer}:</span>
                    <span className="font-medium">{activeCatalyst.project}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11.5px]">
                    <span className="px-2 py-0.5 rounded bg-white/10 text-white/85 font-medium">
                      {activeCatalyst.plan}
                    </span>
                    <span className="text-[#8fe3bd] font-semibold">{activeCatalyst.highlight}</span>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Interactive Corridor Ticker Selector */}
            <div className="swk-glass p-3 border border-[#c9a96e]/25">
              <div className="flex items-center justify-between gap-2 mb-2 px-1">
                <span className="text-[10px] font-bold uppercase tracking-[.2em] text-[#c9a96e]">
                  Select Dubai Corridor to Inspect Live Market Pulse
                </span>
                <span className="text-[10.5px] text-white/60">
                  Showing {pulseIdx + 1} of {pulseCommunities.length} Featured Corridors
                </span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 xl:grid-cols-9 gap-1.5">
                {pulseCommunities.map((c, idx) => {
                  const cYoY = ((c.ppsf - c.ppsfLY) / c.ppsfLY) * 100
                  const active = idx === pulseIdx
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setPulseIdx(idx)}
                      className="text-left rounded-xl px-2.5 py-2 border transition-all cursor-pointer"
                      style={{
                        background: active
                          ? 'linear-gradient(135deg, rgba(201,169,110,.28), rgba(20,48,92,.85))'
                          : 'rgba(255,255,255,.04)',
                        borderColor: active ? '#c9a96e' : 'rgba(255,255,255,.1)',
                      }}
                    >
                      <div className="font-mono text-[10px] font-extrabold text-[#f3dfb8] truncate">
                        {c.code ?? c.ticker}
                      </div>
                      <div className="text-[11px] font-semibold text-white truncate mt-0.5">
                        AED {c.ppsf.toLocaleString()}
                      </div>
                      <div className="text-[10px] font-semibold text-[#8fe3bd]">+{cYoY.toFixed(1)}%</div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
