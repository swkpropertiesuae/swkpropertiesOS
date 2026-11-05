import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { CheckCircle2, Eye, EyeOff, Loader2, Lock, Mail, Printer, QrCode, Wifi, WifiOff } from 'lucide-react'
import { get, post } from '../../lib/api'
import { useMeta } from '../../lib/meta'
import { canPrintReceptionQr } from '@shared/swk-staff-access'
import { SWK_OFFICIAL_WEBSITES_TEXT } from '@shared/corporate-footer'

const PRINTED_QR_CODE = 'SWK-RECEPTION-STAND-DXB-1'

interface BrowserDeviceIdentity {
  device_id: string
  device_name: string
}

function getBrowserDeviceIdentity(): BrowserDeviceIdentity {
  const storageKey = 'swk.browser.device_id'
  let id = ''
  try {
    id = localStorage.getItem(storageKey) || ''
    if (!id) {
      id = `WEB-${Math.random().toString(36).slice(2, 10).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`
      localStorage.setItem(storageKey, id)
    }
  } catch {
    id = 'WEB-BROWSER'
  }
  return {
    device_id: id,
    device_name: typeof navigator !== 'undefined' ? navigator.platform || 'Web Browser' : 'Web Browser',
  }
}

export default function ReceptionQrPage() {
  const { me } = useMeta()
  const [searchParams, setSearchParams] = useSearchParams()
  // HARD RULE: Only Owner (Shabib Siraj) and Haseeb (Mohammad Haseeb) can view or print the QR code.
  const allowPrintQr = canPrintReceptionQr(me)
  const isPrintMode = allowPrintQr && searchParams.get('print') === '1'

  useEffect(() => {
    if (searchParams.get('print') === '1' && !allowPrintQr) {
      const next = new URLSearchParams(searchParams)
      next.delete('print')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, allowPrintQr, setSearchParams])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkInResult, setCheckInResult] = useState<any | null>(null)

  const [device, setDevice] = useState<BrowserDeviceIdentity | null>(null)
  const [connectionType, setConnectionType] = useState<string>('wifi')
  const [networkInfo, setNetworkInfo] = useState<{
    ssid: string
    detected_client_ip: string
    ip_matches_office: boolean
    strict_ip: boolean
  } | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string>('')

  useEffect(() => {
    setDevice(getBrowserDeviceIdentity())

    const detectConn = () => {
      const navConn =
        (navigator as any).connection ||
        (navigator as any).mozConnection ||
        (navigator as any).webkitConnection
      const rawType = String(navConn?.type || navConn?.effectiveType || 'wifi').toLowerCase()
      if (rawType.includes('cellular') || rawType === '3g' || rawType === '2g') {
        setConnectionType('cellular')
      } else {
        setConnectionType('wifi')
      }
    }
    detectConn()

    void get<any>('/api/public/reception-qr/wifi-config')
      .then(cfg => setNetworkInfo(cfg))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!isPrintMode) return
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://os.swkpropertiesuae.com'
    const scanUrl = `${origin}/reception-qr?scan=1&stand=${PRINTED_QR_CODE}`
    void QRCode.toDataURL(scanUrl, {
      width: 420,
      margin: 2,
      color: { dark: '#0b1a33', light: '#ffffff' },
      errorCorrectionLevel: 'H',
    }).then(setQrDataUrl)
  }, [isPrintMode])

  const isCellular = connectionType === 'cellular'
  const isIpBlocked = Boolean(networkInfo?.strict_ip && networkInfo?.ip_matches_office === false)
  const networkApproved = !isCellular && !isIpBlocked

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!networkApproved) {
      setError(
        `Please connect your phone to the Office Wi-Fi (${networkInfo?.ssid || 'SWK-Properties-Office'}) or approved office network to check in.`
      )
      return
    }

    if (!email.trim() || !password) {
      setError('Please enter your company email and password.')
      return
    }

    setBusy(true)
    try {
      const res = await post<any>('/api/public/reception-qr/scan-login-checkin', {
        email: email.trim(),
        password,
        require_login: true,
        strict_anti_loophole: true,
        qr_code_or_token: searchParams.get('stand') || PRINTED_QR_CODE,
        device_id: device?.device_id || undefined,
        device_name: device?.device_name || undefined,
        network_ssid: networkInfo?.ssid || 'SWK-Properties-Office',
        connection_type: connectionType,
        camera_verified: true,
      })
      setCheckInResult(res)
    } catch (err: any) {
      setError(err?.message || 'Sign-in or network verification failed. Please check your credentials and Office Wi-Fi.')
    } finally {
      setBusy(false)
    }
  }

  // Printable single QR sheet mode (?print=1) — Strictly restricted to Owner & Haseeb
  if (isPrintMode) {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://os.swkpropertiesuae.com'
    const scanUrl = `${origin}/reception-qr?scan=1&stand=${PRINTED_QR_CODE}`
    return (
      <div className="min-h-screen bg-[#08142a] text-white flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-white text-[#0b1a33] rounded-3xl p-8 shadow-2xl border-4 border-[#c9a96e] text-center space-y-5">
          <div
            className="flex flex-col items-center justify-center gap-2 rounded-2xl px-5 py-3.5 mx-auto"
            style={{
              background: 'linear-gradient(135deg, #08142a 0%, #102445 100%)',
              border: '1px solid rgba(201,169,110,.55)',
              WebkitPrintColorAdjust: 'exact',
              printColorAdjust: 'exact',
            }}
          >
            <img src="/brand/swk-os/horizontal-portal-lockup-transparent.png?v=swk-os-navy-2" alt="SWK Properties LLC" className="h-12 w-auto object-contain" />
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#e6c88f] font-bold">
              SWK Properties LLC · Office Attendance QR
            </div>
          </div>

          <div className="p-4 bg-white rounded-2xl border-2 border-[#e7e1d4] inline-block mx-auto">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="SWK Properties LLC Office Attendance QR Code" className="w-64 h-64 mx-auto block" />
            ) : (
              <div className="w-64 h-64 grid place-items-center text-xs text-slate-400">Generating QR…</div>
            )}
          </div>

          <div className="space-y-1.5">
            <h1 className="font-display font-bold text-xl text-[#0b1a33]">Scan to Sign In &amp; Check In</h1>
            <p className="text-xs text-[#5a6578] leading-relaxed">
              1. Connect your phone to <b>{networkInfo?.ssid || 'SWK-Properties-Office'}</b> Wi-Fi.
              <br />
              2. Scan this QR code with your phone camera.
              <br />
              3. Sign in with your SWK email &amp; password.
            </p>
            <div className="pt-1 text-[11px] font-bold text-[#08142a]">
              SWK Properties LLC
            </div>
            <div className="text-[10px] font-semibold text-[#8d6e35]">
              {SWK_OFFICIAL_WEBSITES_TEXT}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-center gap-3 print:hidden">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-5 py-2.5 rounded-xl bg-[#0b1a33] text-[#f3ead8] font-bold text-xs border-0 cursor-pointer inline-flex items-center gap-2"
            >
              <Printer size={15} /> Print QR Code
            </button>
            <button
              type="button"
              onClick={() => setSearchParams({}, { replace: true })}
              className="px-4 py-2.5 rounded-xl bg-slate-100 text-[#0b1a33] font-semibold text-xs border border-slate-300 cursor-pointer"
            >
              Scan &amp; Check-In View
            </button>
          </div>
          <div className="text-[10px] font-mono text-slate-400 break-all">{scanUrl}</div>
        </div>
      </div>
    )
  }

  // Scanned from camera -> ONLY Sign-In page, then ONLY Check-In confirmation message
  return (
    <div className="min-h-screen bg-[#08142a] text-white flex items-center justify-center p-4">
      <div className="w-full max-w-[400px] rounded-3xl bg-[#0d1f3c] border border-[#c9a96e]/35 p-6 shadow-2xl">
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="flex items-center justify-center px-4 py-2.5 rounded-2xl bg-[#061022] border border-[#c9a96e]/35 mb-3">
            <img src="/brand/swk-os/horizontal-portal-lockup-transparent.png?v=swk-os-navy-2" alt="SWK Properties LLC" className="h-10 w-auto object-contain" />
          </div>
          <h1 className="font-display font-bold text-xl text-white m-0">
            {checkInResult ? 'Attendance Confirmed' : 'Office Attendance Sign-In'}
          </h1>
          <div className="text-[11px] text-[#dcc8a2] font-semibold mt-1">
            SWK Properties LLC
          </div>
        </div>

        {checkInResult ? (
          /* ONLY the Check-In message after signing in on approved network */
          <div className="text-center space-y-4 py-2">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 text-emerald-300 flex items-center justify-center mx-auto">
              <CheckCircle2 size={34} />
            </div>

            <div className="space-y-1">
              <div className="text-lg font-bold text-emerald-300">Checked In Successfully</div>
              <div className="text-sm font-semibold text-white">
                {checkInResult.employee?.name || checkInResult.user?.name || email}
              </div>
              {checkInResult.employee?.designation && (
                <div className="text-xs text-[#a9b6cd]">{checkInResult.employee.designation}</div>
              )}
            </div>

            <div className="rounded-2xl bg-[#08142a]/90 border border-white/10 p-4 text-xs space-y-2 text-left">
              <div className="flex items-center justify-between">
                <span className="text-[#8a9ab5]">Check-In Time (GST)</span>
                <span className="font-mono font-bold text-white">
                  {String(
                    checkInResult.attendance_event?.check_in_at ||
                      checkInResult.verification_summary?.timestamp_gst ||
                      new Date().toISOString()
                  )
                    .slice(0, 16)
                    .replace('T', ' ')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#8a9ab5]">Status</span>
                <span
                  className={`font-bold ${
                    checkInResult.verification_summary?.is_late ? 'text-amber-300' : 'text-emerald-300'
                  }`}
                >
                  {checkInResult.verification_summary?.is_late
                    ? `Late (+${checkInResult.verification_summary.late_minutes} min)`
                    : 'On Time ✓'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#8a9ab5]">Network</span>
                <span className="font-semibold text-emerald-300">
                  {checkInResult.verification_summary?.office_wifi_ssid ||
                    networkInfo?.ssid ||
                    'Office Wi-Fi Verified'}
                </span>
              </div>
              {checkInResult.attendance_event?.event_no && (
                <div className="flex items-center justify-between">
                  <span className="text-[#8a9ab5]">Reference</span>
                  <span className="font-mono text-[#dcc8a2]">{checkInResult.attendance_event.event_no}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ONLY the Sign-In form before check-in */
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Network Status Indicator */}
            <div
              className={`px-3.5 py-2.5 rounded-2xl border text-xs flex items-center gap-2.5 ${
                networkApproved
                  ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
                  : 'bg-rose-950/60 border-rose-500/50 text-rose-200'
              }`}
            >
              {networkApproved ? (
                <Wifi size={16} className="text-emerald-400 shrink-0" />
              ) : (
                <WifiOff size={16} className="text-rose-400 shrink-0" />
              )}
              <div className="leading-snug">
                {networkApproved ? (
                  <>
                    Connected to <b>{networkInfo?.ssid || 'Office Wi-Fi / Approved Network'}</b>
                  </>
                ) : (
                  <>
                    Not on Office Wi-Fi. Connect to <b>{networkInfo?.ssid || 'SWK-Properties-Office'}</b> to check in.
                  </>
                )}
              </div>
            </div>

            {error && (
              <div className="px-3.5 py-2.5 rounded-2xl bg-rose-950/70 border border-rose-500/50 text-rose-200 text-xs font-medium">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="qr-email" className="block text-xs font-semibold text-[#c3cde0] mb-1.5">
                Email Address
              </label>
              <div className="relative flex items-center">
                <Mail size={16} className="absolute left-3.5 text-[#8a9ab5] pointer-events-none" />
                <input
                  id="qr-email"
                  type="email"
                  required
                  autoComplete="username"
                  autoFocus
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@swk.property"
                  className="w-full pl-10 pr-3.5 py-3 rounded-xl bg-[#08142a] border border-white/15 text-white text-sm outline-none focus:border-[#c9a96e]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="qr-password" className="block text-xs font-semibold text-[#c3cde0] mb-1.5">
                Password
              </label>
              <div className="relative flex items-center">
                <Lock size={16} className="absolute left-3.5 text-[#8a9ab5] pointer-events-none" />
                <input
                  id="qr-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-3 rounded-xl bg-[#08142a] border border-white/15 text-white text-sm outline-none focus:border-[#c9a96e]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="absolute right-3 bg-transparent border-0 text-[#8a9ab5] hover:text-white cursor-pointer p-1"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={busy || !networkApproved}
              className="w-full py-3.5 rounded-xl font-bold text-sm text-[#0b1a33] border-0 cursor-pointer flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #f1e3c2 0%, #c9a96e 100%)' }}
            >
              {busy ? (
                <>
                  <Loader2 size={17} className="animate-spin" /> Checking In…
                </>
              ) : (
                'Sign In & Check In'
              )}
            </button>
          </form>
        )}

        {allowPrintQr && (
          <div className="mt-4 pt-3 border-t border-white/10 text-center">
            <button
              type="button"
              onClick={() => setSearchParams({ print: '1' }, { replace: true })}
              className="w-full py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 border border-[#c9a96e]/35 text-[#f3dfb8] font-semibold text-xs cursor-pointer inline-flex items-center justify-center gap-2"
            >
              <QrCode size={15} /> Print Office Attendance QR (Owner &amp; Haseeb Only)
            </button>
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-white/10 text-center text-[10px] text-[#8a9ab5]">
          {SWK_OFFICIAL_WEBSITES_TEXT}
        </div>
      </div>
    </div>
  )
}
