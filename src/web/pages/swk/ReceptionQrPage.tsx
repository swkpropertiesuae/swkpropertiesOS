import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'motion/react'
import QRCode from 'qrcode'
import {
  ShieldCheck, RefreshCw, Smartphone, Wifi, Clock, CheckCircle2,
  AlertTriangle, Building2, QrCode, Users,
} from 'lucide-react'
import { get, post } from '../../lib/api'
import { useToast } from '../../lib/toast'
import { Loading } from '../../ui/kit'
import { SWK_BRAND } from '../../mobile/SwkOneBrandAssets'

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

export default function ReceptionQrPage() {
  const qc = useQueryClient()
  const toast = useToast()
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [countdown, setCountdown] = useState<number>(45)
  const [simulatingScan, setSimulatingScan] = useState(false)

  const qrQuery = useQuery({
    queryKey: ['reception-qr-current'],
    queryFn: () => get<any>('/api/swk-one/reception-qr/current?branch_id=1'),
    refetchInterval: 15000,
  })

  const data = qrQuery.data

  useEffect(() => {
    if (!data?.qr_payload) return
    setCountdown(data.ttl_seconds || 45)
    QRCode.toDataURL(data.qr_payload, {
      width: 320,
      margin: 2,
      color: {
        dark: '#0b1a33',
        light: '#ffffff',
      },
    })
      .then(url => setQrDataUrl(url))
      .catch(() => {})
  }, [data?.qr_payload, data?.ttl_seconds])

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          void qc.invalidateQueries({ queryKey: ['reception-qr-current'] })
          return 45
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [qc])

  const simulateEmployeeScan = async () => {
    if (!data?.token_code) return
    setSimulatingScan(true)
    try {
      const res = await post('/api/swk-one/attendance/office-check-in', {
        qr_code_or_token: data.token_code,
        device_id: 'AND-SWK-RECEPTION-TEST',
        network_ssid: 'SWK-CORP-WIFI-DXB',
      })
      toast.ok(`Verified check-in recorded (${res.attendance_event?.event_no})`)
      void qc.invalidateQueries({ queryKey: ['reception-qr-current'] })
    } catch (e: any) {
      toast.error(e?.message || 'Check-in failed')
    } finally {
      setSimulatingScan(false)
    }
  }

  if (qrQuery.isLoading && !data) return <Loading label="Starting Office Reception QR Terminal…" />

  return (
    <div className="max-w-6xl mx-auto py-4 px-4 space-y-6">
      {/* Header Banner in SWK Midnight & Champagne with Dubai Skyline */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="relative overflow-hidden rounded-3xl text-white p-6 shadow-xl flex flex-wrap items-center justify-between gap-4 border border-[#c9a96e]/40"
        style={{ background: 'linear-gradient(135deg, #08142a 0%, #0b1a33 55%, #14305c 100%)' }}
      >
        <div
          className="absolute inset-0 bg-cover bg-center opacity-22 pointer-events-none"
          style={{ backgroundImage: `url(${SWK_BRAND.heroDubai})` }}
          aria-hidden
        />
        <img
          src={SWK_BRAND.skylineFront}
          alt=""
          aria-hidden
          className="absolute bottom-0 left-0 right-0 w-full h-20 object-cover opacity-15 pointer-events-none"
        />

        <div className="relative z-10 flex items-center gap-4 min-w-0">
          <img
            src={SWK_BRAND.logoWhite}
            alt="SWK Properties"
            className="h-12 w-auto shrink-0 hidden sm:block"
          />
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#c9a96e]/20 border border-[#c9a96e]/50 text-[#f3ead8] text-[11px] font-bold tracking-wider uppercase">
              <QrCode size={13} className="text-[#c9a96e]" /> Controlled Physical Verification Point · Zero Extra Hardware
            </div>
            <h1 className="text-2xl font-bold font-display tracking-tight text-white">
              SWK Properties — Office Reception <span className="swk-shimmer-text">QR Terminal</span>
            </h1>
            <p className="text-sm text-[#c8d3e6] max-w-2xl">
              Employees open the <b className="text-white">SWK ONE Android App</b>, unlock with device biometrics, and scan this rotating short-lived QR code upon entering the office.
            </p>
          </div>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-3">
          <Link
            to="/swk-one"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-[#0b1a33] font-bold text-sm transition shadow-md no-underline"
            style={{ background: 'linear-gradient(135deg, #f1e3c2 0%, #c9a96e 100%)' }}
          >
            <Smartphone size={16} />
            Open SWK ONE Android Workspace
          </Link>
          <button
            onClick={() => void qc.invalidateQueries({ queryKey: ['reception-qr-current'] })}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/10 text-[#f3ead8] font-semibold text-sm hover:bg-white/20 transition cursor-pointer border border-white/20"
          >
            <RefreshCw size={15} /> Refresh Token
          </button>
        </div>
      </motion.div>

      {/* Main Grid: Rotating QR Terminal + Live Verified Attendance Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: QR Display Card */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08, ease: EASE }}
          className="lg:col-span-5 rounded-3xl bg-white border border-[#e7e1d4] p-6 shadow-[0_16px_40px_-24px_rgba(11,26,51,0.35)] flex flex-col items-center text-center space-y-5"
        >
          <div className="w-full flex items-center justify-between text-xs font-semibold text-[#6b7488] border-b border-[#efe9dc] pb-3">
            <span className="inline-flex items-center gap-1.5 text-[#0b1a33] font-bold">
              <Building2 size={15} className="text-[#9a7a42]" />
              {data?.branch?.name || 'Dubai – Head Office'}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f3ead8] text-[#7d5f2c] font-bold">
              <Clock size={13} /> Rotates in {countdown}s
            </span>
          </div>

          {/* QR Image Container */}
          <div className="relative p-4 rounded-3xl bg-[#fbf8f2] border-2 border-[#c9a96e]/50 shadow-inner">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="SWK Office Reception Attendance QR Code"
                className="w-64 h-64 rounded-2xl bg-white p-2 shadow-xs"
              />
            ) : (
              <div className="w-64 h-64 grid place-items-center text-sm text-[#6b7488]">
                Generating QR…
              </div>
            )}
            <div className="mt-2.5 text-[11px] font-mono text-[#6b7488]">
              TOKEN: {data?.token_code}
            </div>
          </div>

          {/* Manual 6-digit Backup Code */}
          <div className="w-full rounded-2xl bg-[#fbf8f2] p-4 border border-[#e7e1d4]">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[#9a7a42] font-bold">
              Reception Terminal 6-Digit Verification Code
            </div>
            <div className="text-3xl font-extrabold font-display tracking-[0.28em] text-[#0b1a33] mt-1">
              {data?.short_code || '------'}
            </div>
            <div className="text-xs text-[#6b7488] mt-1">
              Valid only with enrolled SWK ONE Android device & office network evidence
            </div>
          </div>

          {/* Security Evidence Pills */}
          <div className="w-full grid grid-cols-2 gap-2.5 text-left">
            <div className="p-3 rounded-2xl bg-[#fbf8f2] border border-[#e7e1d4]">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#14305c]">
                <Wifi size={14} className="text-[#9a7a42]" /> Office Network
              </div>
              <div className="text-xs font-semibold text-[#0b1a33] mt-0.5 truncate">
                {data?.office_network_hint || 'SWK-CORP-WIFI-DXB'}
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-[#fbf8f2] border border-[#e7e1d4]">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#14305c]">
                <ShieldCheck size={14} className="text-[#9a7a42]" /> Device Binding
              </div>
              <div className="text-xs font-semibold text-[#0b1a33] mt-0.5">
                Enrolled Android Handsets
              </div>
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={simulateEmployeeScan}
            disabled={simulatingScan}
            className="w-full py-3.5 px-4 rounded-2xl text-white font-bold text-sm transition cursor-pointer border-0 flex items-center justify-center gap-2 shadow-md"
            style={{ background: 'linear-gradient(135deg, #1b3a6b, #0b1a33)' }}
          >
            <Smartphone size={16} className="text-[#c9a96e]" />
            {simulatingScan ? 'Verifying QR & Device…' : 'Test Scan with Current Logged-in Account'}
          </motion.button>
        </motion.div>

        {/* Right: Live Verified Check-Ins & 4-Factor Validation Rules */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.14, ease: EASE }}
          className="lg:col-span-7 space-y-5"
        >
          <div className="rounded-3xl bg-white border border-[#e7e1d4] p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Users size={18} className="text-[#9a7a42]" />
                <h2 className="text-lg font-bold font-display text-[#0b1a33]">
                  Today’s Verified Reception Check-Ins
                </h2>
              </div>
              <span className="px-3 py-1 rounded-full bg-[#f3ead8] text-[#7d5f2c] text-xs font-bold">
                {data?.today_checkins?.length || 0} Recorded Today
              </span>
            </div>

            {!data?.today_checkins?.length ? (
              <div className="p-8 rounded-2xl bg-[#fbf8f2] border border-[#efe9dc] text-center space-y-2">
                <img src={SWK_BRAND.logoInk} alt="" className="h-7 w-auto mx-auto opacity-25" />
                <div className="text-sm font-bold text-[#0b1a33]">No office QR scans recorded yet today</div>
                <p className="text-xs text-[#6b7488]">
                  Scan the QR code from the SWK ONE Android app or click &ldquo;Test Scan&rdquo; on the left to verify the attendance pipeline.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#efe9dc]">
                {data.today_checkins.map((row: any) => (
                  <div key={row.id} className="py-3.5 flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold font-display text-sm text-[#0b1a33]">
                          {row.employee_name || `Employee #${row.employee_id}`}
                        </span>
                        <span className="text-xs font-mono text-[#6b7488]">{row.event_no}</span>
                      </div>
                      <div className="text-xs text-[#3a4660]">
                        Method: <b>{row.terminal_type}</b> · Shift: {row.shift_name}
                      </div>
                      {row.notes && <div className="text-[11px] text-[#6b7488]">{row.notes}</div>}
                    </div>
                    <div className="text-right space-y-1">
                      <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#e3f4ec] text-[#157a52]">
                        {row.manager_verified ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                        {row.duty_status}
                      </div>
                      <div className="text-xs font-mono text-[#6b7488]">
                        In: {String(row.check_in_at || '').slice(11, 16) || '09:00'}
                        {row.check_out_at ? ` · Out: ${String(row.check_out_at).slice(11, 16)}` : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* How SWK Office Check-In Verification Works */}
          <div className="rounded-3xl bg-white border border-[#e7e1d4] p-6 shadow-xs space-y-3">
            <h3 className="text-base font-bold font-display text-[#0b1a33]">
              How SWK ONE 4-Point Office Attendance Verification Works
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[#3a4660]">
              <div className="p-3.5 rounded-2xl bg-[#fbf8f2] border border-[#efe9dc]">
                <b className="text-[#0b1a33] block mb-1">1. Enrolled Android Handset</b>
                Each employee’s SWK ONE app binds to their registered Android device ID and requires biometric/device-credential unlock.
              </div>
              <div className="p-3.5 rounded-2xl bg-[#fbf8f2] border border-[#efe9dc]">
                <b className="text-[#0b1a33] block mb-1">2. Short-Lived Reception QR</b>
                This reception screen rotates its cryptographic token every 60 seconds so photos of old QR codes cannot be reused remotely.
              </div>
              <div className="p-3.5 rounded-2xl bg-[#fbf8f2] border border-[#efe9dc]">
                <b className="text-[#0b1a33] block mb-1">3. Trusted Office Network & GPS</b>
                SWK OS cross-checks office Wi-Fi / IP evidence and reception geofence coordinates at the moment of scan.
              </div>
              <div className="p-3.5 rounded-2xl bg-[#fbf8f2] border border-[#efe9dc]">
                <b className="text-[#0b1a33] block mb-1">4. Exception Review (Never Silent Reject)</b>
                Doubtful check-ins are logged and routed for manager review; employees can also submit correction requests with audit reasons.
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
