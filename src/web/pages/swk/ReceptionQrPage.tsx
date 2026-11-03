import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'motion/react'
import QRCode from 'qrcode'
import {
  ShieldCheck, RefreshCw, Wifi, Clock, CheckCircle2,
  AlertTriangle, Building2, QrCode, Users, Printer, Maximize2,
  Minimize2, LogIn, LogOut, MapPin, FileCheck2, PowerOff, Sparkles,
} from 'lucide-react'
import { get, post } from '../../lib/api'
import { Loading } from '../../ui/kit'
import { SWK_BRAND } from '../../mobile/SwkOneBrandAssets'

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

function getStandaloneDeviceId(): string {
  const key = 'swk_reception_standalone_device_id'
  try {
    const existing = localStorage.getItem(key)
    if (existing) return existing
    const created = `SWK-REC-${Math.random().toString(36).slice(2, 10).toUpperCase()}`
    localStorage.setItem(key, created)
    return created
  } catch {
    return 'SWK-REC-HANDSET'
  }
}

export default function ReceptionQrPage() {
  const qc = useQueryClient()
  const [searchParams] = useSearchParams()
  const scannedTokenParam = searchParams.get('token') || searchParams.get('stand') || searchParams.get('code') || ''

  const [qrMode, setQrMode] = useState<'rotating' | 'permanent_stand'>('rotating')
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [standQrDataUrl, setStandQrDataUrl] = useState<string>('')
  const [countdown, setCountdown] = useState<number>(45)
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)

  // Standalone Employee Check-In / Check-Out State (Works Without OS Login & When Office PCs Are Off)
  const [selectedEmpId, setSelectedEmpId] = useState<string>('')
  const [manualEmail, setManualEmail] = useState<string>('')
  const [verificationCodeInput, setVerificationCodeInput] = useState<string>(scannedTokenParam)
  const [clientVarHours, setClientVarHours] = useState<boolean>(false)
  const [varHoursReason, setVarHoursReason] = useState<string>('')
  const [busyAction, setBusyAction] = useState<'checkin' | 'checkout' | 'daily_report' | null>(null)
  const [feedbackBanner, setFeedbackBanner] = useState<{
    tone: 'ok' | 'warn' | 'err'
    title: string
    detail: string
  } | null>(null)

  // Quick Daily Report drawer state when Checkout Gate blocks check-out
  const [showQuickReportForm, setShowQuickReportForm] = useState<boolean>(false)
  const [dailySummary, setDailySummary] = useState<string>('')
  const [dailyBlockers, setDailyBlockers] = useState<string>('None')
  const [dailyNextPriorities, setDailyNextPriorities] = useState<string>('Follow up active leads and scheduled viewings')

  const qrQuery = useQuery({
    queryKey: ['reception-qr-current'],
    queryFn: () => get<any>('/api/public/reception-qr/current?branch_id=1'),
    refetchInterval: 15000,
  })

  const data = qrQuery.data

  // Select first employee by default once roster loads
  useEffect(() => {
    if (!selectedEmpId && data?.staff_roster?.length) {
      setSelectedEmpId(String(data.staff_roster[0].id))
    }
  }, [data?.staff_roster, selectedEmpId])

  // Keep verification code pre-populated with scanned token or live short code
  useEffect(() => {
    if (scannedTokenParam) {
      setVerificationCodeInput(scannedTokenParam)
    } else if (data?.short_code && !verificationCodeInput) {
      setVerificationCodeInput(data.short_code)
    }
  }, [scannedTokenParam, data?.short_code])

  const baseOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://os.swkpropertiesuae.com'

  const rotatingScanUrl = useMemo(() => {
    if (!data?.token_code) return ''
    return `${baseOrigin}/reception-qr?checkin=1&token=${encodeURIComponent(data.token_code)}&code=${encodeURIComponent(data.short_code || '')}&stand=${encodeURIComponent(data.stand_code || 'SWK-RECEPTION-STAND-DXB-1')}`
  }, [baseOrigin, data?.token_code, data?.short_code, data?.stand_code])

  const permanentStandUrl = useMemo(() => {
    const stand = data?.stand_code || 'SWK-RECEPTION-STAND-DXB-1'
    return `${baseOrigin}/reception-qr?checkin=1&stand=${encodeURIComponent(stand)}`
  }, [baseOrigin, data?.stand_code])

  useEffect(() => {
    if (!rotatingScanUrl) return
    setCountdown(data?.ttl_seconds || 45)
    QRCode.toDataURL(rotatingScanUrl, {
      width: 340,
      margin: 2,
      color: {
        dark: '#0b1a33',
        light: '#ffffff',
      },
    })
      .then(url => setQrDataUrl(url))
      .catch(() => {})
  }, [rotatingScanUrl, data?.ttl_seconds])

  useEffect(() => {
    if (!permanentStandUrl) return
    QRCode.toDataURL(permanentStandUrl, {
      width: 340,
      margin: 2,
      color: {
        dark: '#0b1a33',
        light: '#ffffff',
      },
    })
      .then(url => setStandQrDataUrl(url))
      .catch(() => {})
  }, [permanentStandUrl])

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

  // Request Screen Wake Lock in kiosk/reception mode so the reception display stays awake
  useEffect(() => {
    let wakeLock: any = null
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen')
        }
      } catch {
        // ignore if unsupported
      }
    }
    void requestWakeLock()
    return () => {
      if (wakeLock?.release) void wakeLock.release().catch(() => {})
    }
  }, [])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }

  const getOptionalGps = (): Promise<{ lat?: number; lng?: number; accuracy_m?: number }> =>
    new Promise(resolve => {
      if (!navigator.geolocation) return resolve({})
      navigator.geolocation.getCurrentPosition(
        pos =>
          resolve({
            lat: Math.round(pos.coords.latitude * 1e6) / 1e6,
            lng: Math.round(pos.coords.longitude * 1e6) / 1e6,
            accuracy_m: Math.round(pos.coords.accuracy || 10),
          }),
        () => resolve({}),
        { enableHighAccuracy: true, timeout: 3500, maximumAge: 30000 },
      )
    })

  const selectedStaff = useMemo(() => {
    if (!data?.staff_roster) return null
    return data.staff_roster.find((s: any) => String(s.id) === String(selectedEmpId)) || null
  }, [data?.staff_roster, selectedEmpId])

  const handleStandaloneCheckIn = async () => {
    setBusyAction('checkin')
    setFeedbackBanner(null)
    try {
      const gps = await getOptionalGps()
      const qrTokenToUse =
        verificationCodeInput.trim() ||
        (qrMode === 'permanent_stand' ? data?.stand_code : data?.token_code) ||
        data?.short_code ||
        'SWK-RECEPTION-STAND-DXB-1'

      const res = await post<any>('/api/public/reception-qr/check-in', {
        employee_id: selectedEmpId ? Number(selectedEmpId) : undefined,
        email: manualEmail.trim() || undefined,
        qr_code_or_token: qrTokenToUse,
        device_id: getStandaloneDeviceId(),
        device_name: 'SWK Standalone Reception QR Terminal',
        network_ssid: 'SWK-CORP-WIFI-DXB',
        client_variable_hours: clientVarHours,
        variable_hours_reason: varHoursReason.trim() || undefined,
        ...gps,
      })

      await qc.invalidateQueries({ queryKey: ['reception-qr-current'] })
      const empName = res?.employee?.name || selectedStaff?.name || 'Employee'
      const ev = res?.attendance_event || res?.event
      const isLate = res?.verification_summary?.is_late
      const lateMins = res?.verification_summary?.late_minutes || 0

      setFeedbackBanner({
        tone: isLate ? 'warn' : 'ok',
        title: isLate
          ? `Checked In (Late Arrival +${lateMins}m after 10:05 AM): ${empName}`
          : `Checked In On-Time: ${empName}`,
        detail: `Event ${ev?.event_no || ''} recorded in SWK OS at ${String(ev?.check_in_at || '').slice(11, 16) || 'now'} GST · Shift: ${ev?.shift_name || 'Standard'} · Synced with Owner 10:30 AM Report.`,
      })
    } catch (e: any) {
      setFeedbackBanner({
        tone: 'err',
        title: 'Check-In Failed',
        detail: e?.message || 'Could not record reception check-in.',
      })
    } finally {
      setBusyAction(null)
    }
  }

  const handleStandaloneCheckOut = async () => {
    setBusyAction('checkout')
    setFeedbackBanner(null)
    try {
      const gps = await getOptionalGps()
      const res = await post<any>('/api/public/reception-qr/check-out', {
        employee_id: selectedEmpId ? Number(selectedEmpId) : undefined,
        email: manualEmail.trim() || undefined,
        client_variable_hours: clientVarHours,
        variable_hours_reason: varHoursReason.trim() || undefined,
        ...gps,
      })
      await qc.invalidateQueries({ queryKey: ['reception-qr-current'] })
      setShowQuickReportForm(false)
      setFeedbackBanner({
        tone: 'ok',
        title: `Checked Out Successfully: ${res?.employee?.name || selectedStaff?.name || 'Employee'}`,
        detail: `Departure recorded in SWK OS at ${String(res?.check_out_at || '').slice(11, 16) || 'now'} GST.`,
      })
    } catch (e: any) {
      const msg = String(e?.message || 'Check-out failed')
      if (msg.includes('Checkout Gate Blocked') || msg.includes('Daily Report')) {
        setShowQuickReportForm(true)
      }
      setFeedbackBanner({
        tone: 'warn',
        title: 'Checkout Gate Requirement',
        detail: msg,
      })
    } finally {
      setBusyAction(null)
    }
  }

  const handleSubmitQuickReportAndCheckOut = async () => {
    if (dailySummary.trim().length < 5) {
      setFeedbackBanner({
        tone: 'err',
        title: 'Daily Report Summary Required',
        detail: 'Enter a brief summary of today’s completed calls, viewings, and outcomes to unlock checkout.',
      })
      return
    }
    setBusyAction('daily_report')
    try {
      await post<any>('/api/public/reception-qr/daily-report', {
        employee_id: selectedEmpId ? Number(selectedEmpId) : undefined,
        email: manualEmail.trim() || undefined,
        self_summary: dailySummary.trim(),
        blockers: dailyBlockers.trim() || 'None',
        next_day_priorities: dailyNextPriorities.trim() || 'Follow up active leads and viewings',
      })
      await handleStandaloneCheckOut()
    } catch (e: any) {
      setFeedbackBanner({
        tone: 'err',
        title: 'Could Not Submit Daily Report',
        detail: e?.message || 'Please retry.',
      })
      setBusyAction(null)
    }
  }

  if (qrQuery.isLoading && !data) {
    return (
      <div className="min-h-screen bg-[#08142a] text-white grid place-items-center p-6">
        <Loading label="Starting Standalone SWK Reception QR Terminal…" />
      </div>
    )
  }

  const roster: any[] = data?.staff_roster || []
  const checkedInCount = roster.filter(r => r.checked_in && !r.checked_out).length
  const checkedOutCount = roster.filter(r => r.checked_out).length
  const lateCount = roster.filter(r => r.late_minutes > 5 || r.duty_status === 'Late Arrival').length

  return (
    <div className="min-h-screen bg-[#f6f3ec] text-[#0b1a33] py-5 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Standalone Header Banner */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE }}
          className="relative overflow-hidden rounded-3xl text-white p-6 shadow-xl flex flex-wrap items-center justify-between gap-4 border border-[#c9a96e]/50 print:hidden"
          style={{ background: 'linear-gradient(135deg, #08142a 0%, #0b1a33 55%, #14305c 100%)' }}
        >
          <div
            className="absolute inset-0 bg-cover bg-center opacity-20 pointer-events-none"
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
              className="h-13 w-auto shrink-0 hidden sm:block"
            />
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#c9a96e]/25 border border-[#c9a96e]/60 text-[#f3ead8] text-[11px] font-bold tracking-wider uppercase">
                  <QrCode size={13} className="text-[#c9a96e]" /> Standalone Reception QR · No Login Required
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#157a52]/35 border border-[#4fd39a]/50 text-[#d1fae5] text-[11px] font-bold tracking-wider uppercase">
                  <PowerOff size={12} className="text-[#4fd39a]" /> Works When Office Systems Are Off
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-white">
                SWK Properties — Standalone <span className="swk-shimmer-text">Reception QR Terminal</span>
              </h1>
              <p className="text-xs sm:text-sm text-[#c8d3e6] max-w-3xl">
                Operates independently without OS login so the <b className="text-white">first person arriving in the morning</b> can scan or check in immediately even when office PCs are turned off — directly connected to the <b className="text-[#f3ead8]">SWK Properties OS Backend</b>.
              </p>
            </div>
          </div>

          <div className="relative z-10 flex flex-wrap items-center gap-2.5">
            <div className="px-3.5 py-2 rounded-2xl bg-white/10 border border-white/15 text-right">
              <div className="text-[10px] uppercase tracking-wider text-[#dcc8a2] font-bold">
                Dubai Time · Grace Cutoff 10:05 AM
              </div>
              <div className="text-sm font-bold font-mono text-white">
                {data?.shift_info?.dubai_time || 'Asia/Dubai GST'}
              </div>
            </div>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-[#0b1a33] font-bold text-xs sm:text-sm transition shadow-md cursor-pointer border-0"
              style={{ background: 'linear-gradient(135deg, #f1e3c2 0%, #c9a96e 100%)' }}
            >
              <Printer size={15} /> Print Desk QR Stand
            </button>
            <button
              onClick={toggleFullscreen}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-full bg-white/10 text-[#f3ead8] font-semibold text-xs sm:text-sm hover:bg-white/20 transition cursor-pointer border border-white/20"
            >
              {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              {isFullscreen ? 'Exit Kiosk' : 'Kiosk Fullscreen'}
            </button>
            <button
              onClick={() => void qc.invalidateQueries({ queryKey: ['reception-qr-current'] })}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-full bg-white/10 text-[#f3ead8] font-semibold text-xs sm:text-sm hover:bg-white/20 transition cursor-pointer border border-white/20"
            >
              <RefreshCw size={15} /> Refresh
            </button>
          </div>
        </motion.div>

        {/* Printable Reception Stand Placard (Visible When Printing A4 Stand for When Office Screens Are Off) */}
        <div className="hidden print:block p-8 rounded-3xl border-2 border-[#0b1a33] bg-white text-center space-y-5">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#9a7a42]">
            SWK Properties L.L.C. · Dubai Head Office Reception
          </div>
          <h1 className="text-3xl font-extrabold text-[#0b1a33]">
            Official Office Reception QR Check-In Stand
          </h1>
          <p className="text-sm text-[#3a4660] max-w-xl mx-auto">
            Works 24/7 even when all office computers and monitors are turned OFF. Scan with your phone camera or the <b>SWK ONE Android App</b> upon entering the office.
          </p>
          {standQrDataUrl && (
            <img
              src={standQrDataUrl}
              alt="Permanent Reception Stand QR"
              className="w-72 h-72 mx-auto border-2 border-[#c9a96e] p-3 rounded-2xl"
            />
          )}
          <div className="text-lg font-mono font-bold text-[#0b1a33]">
            STAND CODE: {data?.stand_code || 'SWK-RECEPTION-STAND-DXB-1'}
          </div>
          <div className="text-xs text-[#3a4660]">
            Working Hours: Mon–Fri 10:00 AM – 7:00 PM · Saturday 10:00 AM – 4:00 PM · Grace Period Until 10:05 AM GST
          </div>
        </div>

        {/* Main Grid: Left = Standalone QR Terminal | Right = Instant Self Check-In/Out + Live OS Roll Call */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start print:hidden">
          {/* Left Column (5 cols): Dual-Mode Reception QR Card */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.06, ease: EASE }}
            className="lg:col-span-5 rounded-3xl bg-white border border-[#e7e1d4] p-6 shadow-[0_16px_40px_-24px_rgba(11,26,51,0.35)] flex flex-col items-center text-center space-y-5"
          >
            <div className="w-full flex items-center justify-between text-xs font-semibold text-[#6b7488] border-b border-[#efe9dc] pb-3">
              <span className="inline-flex items-center gap-1.5 text-[#0b1a33] font-bold">
                <Building2 size={15} className="text-[#9a7a42]" />
                {data?.branch?.name || 'Dubai – Head Office'}
              </span>
              {qrMode === 'rotating' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f3ead8] text-[#7d5f2c] font-bold">
                  <Clock size={13} /> Rotates in {countdown}s
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#e3f4ec] text-[#157a52] font-bold">
                  <PowerOff size={13} /> Always Active (Systems-Off Stand)
                </span>
              )}
            </div>

            {/* Mode Switcher: Rotating Screen QR vs Permanent Systems-Off Stand QR */}
            <div className="w-full grid grid-cols-2 gap-1.5 p-1.5 rounded-2xl bg-[#fbf8f2] border border-[#e7e1d4]">
              <button
                type="button"
                onClick={() => setQrMode('rotating')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer border-0 ${
                  qrMode === 'rotating'
                    ? 'bg-[#0b1a33] text-[#f3ead8] shadow-xs'
                    : 'bg-transparent text-[#6b7488] hover:text-[#0b1a33]'
                }`}
              >
                Live Rotating QR (60s)
              </button>
              <button
                type="button"
                onClick={() => setQrMode('permanent_stand')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer border-0 ${
                  qrMode === 'permanent_stand'
                    ? 'bg-[#0b1a33] text-[#f3ead8] shadow-xs'
                    : 'bg-transparent text-[#6b7488] hover:text-[#0b1a33]'
                }`}
              >
                Systems-Off Stand QR
              </button>
            </div>

            {/* QR Image Container */}
            <div className="relative p-4 rounded-3xl bg-[#fbf8f2] border-2 border-[#c9a96e]/50 shadow-inner">
              {(qrMode === 'rotating' ? qrDataUrl : standQrDataUrl) ? (
                <img
                  src={qrMode === 'rotating' ? qrDataUrl : standQrDataUrl}
                  alt="SWK Office Reception Attendance QR Code"
                  className="w-64 h-64 rounded-2xl bg-white p-2 shadow-xs"
                />
              ) : (
                <div className="w-64 h-64 grid place-items-center text-sm text-[#6b7488]">
                  Generating QR…
                </div>
              )}
              <div className="mt-2.5 text-[11px] font-mono text-[#6b7488] break-all">
                {qrMode === 'rotating'
                  ? `TOKEN: ${data?.token_code}`
                  : `PERMANENT STAND: ${data?.stand_code || 'SWK-RECEPTION-STAND-DXB-1'}`}
              </div>
            </div>

            {/* 6-Digit Reception Code / Permanent Stand Code */}
            <div className="w-full rounded-2xl bg-[#fbf8f2] p-4 border border-[#e7e1d4]">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[#9a7a42] font-bold">
                {qrMode === 'rotating'
                  ? 'Reception Terminal 6-Digit Verification Code'
                  : 'Permanent Reception Stand Code (When PCs Are Off)'}
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold font-display tracking-[0.22em] text-[#0b1a33] mt-1">
                {qrMode === 'rotating' ? data?.short_code || '------' : data?.stand_code || 'SWK-RECEPTION-STAND-DXB-1'}
              </div>
              <div className="text-xs text-[#6b7488] mt-1">
                {qrMode === 'rotating'
                  ? 'Scan with phone camera or SWK ONE Android app, or check in on the right'
                  : 'Print & place at reception entrance — works 24/7 even when all office computers are turned off'}
              </div>
            </div>

            {/* Working Hours & Security Pills */}
            <div className="w-full grid grid-cols-2 gap-2.5 text-left">
              <div className="p-3 rounded-2xl bg-[#fbf8f2] border border-[#e7e1d4]">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#14305c]">
                  <Clock size={14} className="text-[#9a7a42]" /> UAE Working Hours
                </div>
                <div className="text-[11px] font-semibold text-[#0b1a33] mt-0.5">
                  Mon–Fri 10:00–19:00 · Sat 10:00–16:00 (Grace ≤10:05 AM)
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-[#fbf8f2] border border-[#e7e1d4]">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#14305c]">
                  <Wifi size={14} className="text-[#9a7a42]" /> OS Backend Link
                </div>
                <div className="text-[11px] font-semibold text-[#157a52] mt-0.5 truncate">
                  Connected · Live Attendance Sync
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right Column (7 cols): Standalone Self-Service Check-In/Out + Today's Verified Roll Call */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.12, ease: EASE }}
            className="lg:col-span-7 space-y-5"
          >
            {/* Card 1: Standalone Reception Check-In / Check-Out (Works Without OS Login) */}
            <div className="rounded-3xl bg-white border-2 border-[#c9a96e]/50 p-6 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#efe9dc] pb-3">
                <div>
                  <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#9a7a42]">
                    <Sparkles size={13} /> First-Arrival & Standalone Reception Check-In
                  </div>
                  <h2 className="text-lg font-bold font-display text-[#0b1a33]">
                    Instant Staff Check-In & Check-Out (Connected to SWK OS)
                  </h2>
                </div>
                <span className="px-3 py-1 rounded-full bg-[#e3f4ec] text-[#157a52] text-xs font-bold">
                  Zero Login Needed
                </span>
              </div>

              {feedbackBanner && (
                <div
                  role="status"
                  className={`p-4 rounded-2xl border text-xs space-y-1 ${
                    feedbackBanner.tone === 'ok'
                      ? 'bg-[#e3f4ec] border-[#157a52]/30 text-[#0d5236]'
                      : feedbackBanner.tone === 'warn'
                        ? 'bg-[#fff8e6] border-[#d97706]/40 text-[#92400e]'
                        : 'bg-[#fde8e8] border-[#dc2626]/30 text-[#991b1b]'
                  }`}
                >
                  <div className="font-bold text-sm">{feedbackBanner.title}</div>
                  <div>{feedbackBanner.detail}</div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-[#0b1a33] mb-1">
                    Select SWK Properties Staff Member
                  </label>
                  <select
                    value={selectedEmpId}
                    onChange={e => {
                      setSelectedEmpId(e.target.value)
                      setManualEmail('')
                    }}
                    className="w-full rounded-xl border border-[#d8d0c0] bg-[#fbf8f2] px-3 py-2.5 text-sm font-semibold text-[#0b1a33]"
                  >
                    {roster.map((emp: any) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} — {emp.designation} ({emp.checked_out ? 'Checked Out' : emp.checked_in ? `In ${String(emp.check_in_at || '').slice(11, 16)}` : 'Not Checked In'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0b1a33] mb-1">
                    Or Enter @swkpropertiesuae.com Email
                  </label>
                  <input
                    type="email"
                    value={manualEmail}
                    onChange={e => setManualEmail(e.target.value)}
                    placeholder={selectedStaff?.email || 'advisor@swkpropertiesuae.com'}
                    className="w-full rounded-xl border border-[#d8d0c0] bg-[#fbf8f2] px-3 py-2.5 text-sm text-[#0b1a33]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-end">
                <div>
                  <label className="block text-xs font-bold text-[#0b1a33] mb-1">
                    Reception QR Token / 6-Digit Code (Auto-Verified)
                  </label>
                  <input
                    type="text"
                    value={verificationCodeInput}
                    onChange={e => setVerificationCodeInput(e.target.value)}
                    placeholder={data?.short_code || 'SWK-RECEPTION-STAND-DXB-1'}
                    className="w-full rounded-xl border border-[#d8d0c0] bg-[#fbf8f2] px-3 py-2 text-xs font-mono font-bold text-[#0b1a33]"
                  />
                </div>

                <label className="flex items-center gap-2 text-xs font-semibold text-[#3a4660] bg-[#fbf8f2] p-2.5 rounded-xl border border-[#efe9dc] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clientVarHours}
                    onChange={e => setClientVarHours(e.target.checked)}
                  />
                  <span>Sunday / Client-Based Variable Hours</span>
                </label>
              </div>

              {clientVarHours && (
                <div>
                  <label className="block text-xs font-bold text-[#0b1a33] mb-1">
                    Client Meeting / Variable Hours Reason
                  </label>
                  <input
                    type="text"
                    value={varHoursReason}
                    onChange={e => setVarHoursReason(e.target.value)}
                    placeholder="e.g., Sunday client viewing at Palm Jumeirah / late developer launch"
                    className="w-full rounded-xl border border-[#d8d0c0] bg-[#fbf8f2] px-3 py-2 text-xs text-[#0b1a33]"
                  />
                </div>
              )}

              {/* Quick Daily Report Drawer when Checkout Gate requires Daily Report */}
              {showQuickReportForm && (
                <div className="p-4 rounded-2xl bg-[#fbf8f2] border-2 border-[#c9a96e] space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#0b1a33]">
                    <FileCheck2 size={16} className="text-[#9a7a42]" />
                    Mandatory Checkout Gate: Submit Today’s Daily Report to Unlock Check-Out
                  </div>
                  <textarea
                    rows={2}
                    value={dailySummary}
                    onChange={e => setDailySummary(e.target.value)}
                    placeholder="Summarize today’s completed calls, client viewings, and deal follow-ups…"
                    className="w-full rounded-xl border border-[#d8d0c0] bg-white p-2.5 text-xs text-[#0b1a33]"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      value={dailyBlockers}
                      onChange={e => setDailyBlockers(e.target.value)}
                      placeholder="Blockers (or None)"
                      className="w-full rounded-xl border border-[#d8d0c0] bg-white px-3 py-2 text-xs text-[#0b1a33]"
                    />
                    <input
                      type="text"
                      value={dailyNextPriorities}
                      onChange={e => setDailyNextPriorities(e.target.value)}
                      placeholder="Tomorrow’s top priorities"
                      className="w-full rounded-xl border border-[#d8d0c0] bg-white px-3 py-2 text-xs text-[#0b1a33]"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() => void handleSubmitQuickReportAndCheckOut()}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#0b1a33] text-[#f3ead8] font-bold text-xs cursor-pointer border-0"
                  >
                    {busyAction === 'daily_report'
                      ? 'Submitting Daily Report & Checking Out…'
                      : 'Submit Daily Report & Complete Check-Out'}
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => void handleStandaloneCheckIn()}
                  className="py-3 px-4 rounded-2xl text-[#0b1a33] font-bold text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer border-0 transition"
                  style={{ background: 'linear-gradient(135deg, #f1e3c2 0%, #c9a96e 100%)' }}
                >
                  <LogIn size={17} />
                  {busyAction === 'checkin' ? 'Recording Check-In…' : 'Check In at Reception'}
                </button>

                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => void handleStandaloneCheckOut()}
                  className="py-3 px-4 rounded-2xl bg-[#0b1a33] text-[#f3ead8] font-bold text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer border-0 hover:bg-[#14305c] transition"
                >
                  <LogOut size={17} />
                  {busyAction === 'checkout' ? 'Verifying Checkout Gate…' : 'Check Out from Office'}
                </button>
              </div>
            </div>

            {/* Card 2: Today's Live Office Attendance Roll Call (Synced with SWK OS) */}
            <div className="rounded-3xl bg-white border border-[#e7e1d4] p-6 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <Users size={18} className="text-[#9a7a42]" />
                  <h2 className="text-lg font-bold font-display text-[#0b1a33]">
                    Today’s Verified Reception Check-Ins (SWK OS Live Feed)
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                  <span className="px-2.5 py-1 rounded-full bg-[#e3f4ec] text-[#157a52]">
                    {checkedInCount} In Office
                  </span>
                  {lateCount > 0 && (
                    <span className="px-2.5 py-1 rounded-full bg-[#fff8e6] text-[#b45309]">
                      {lateCount} Late (&gt;10:05)
                    </span>
                  )}
                  <span className="px-2.5 py-1 rounded-full bg-[#f3ead8] text-[#7d5f2c]">
                    {checkedOutCount} Checked Out
                  </span>
                </div>
              </div>

              {!data?.today_checkins?.length ? (
                <div className="p-7 rounded-2xl bg-[#fbf8f2] border border-[#efe9dc] text-center space-y-2">
                  <img src={SWK_BRAND.logoInk} alt="" className="h-7 w-auto mx-auto opacity-25" />
                  <div className="text-sm font-bold text-[#0b1a33]">
                    Ready for First Arrival — No Office Scans Recorded Yet Today
                  </div>
                  <p className="text-xs text-[#6b7488]">
                    The first person arriving in the morning can scan the QR code or use the Standalone Reception Check-In box above even while all office computers are turned off.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#efe9dc]">
                  {data.today_checkins.map((row: any) => (
                    <div key={row.id} className="py-3 flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold font-display text-sm text-[#0b1a33]">
                            {row.employee_name || `Employee #${row.employee_id}`}
                          </span>
                          <span className="text-xs font-mono text-[#6b7488]">{row.event_no}</span>
                        </div>
                        <div className="text-xs text-[#3a4660]">
                          {row.designation ? `${row.designation} · ` : ''}Method: <b>{row.terminal_type}</b> · Shift: {row.shift_name}
                        </div>
                        {row.notes && <div className="text-[11px] text-[#6b7488]">{row.notes}</div>}
                      </div>
                      <div className="text-right space-y-1 shrink-0">
                        <div
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            row.duty_status === 'Late Arrival'
                              ? 'bg-[#fff8e6] text-[#b45309]'
                              : 'bg-[#e3f4ec] text-[#157a52]'
                          }`}
                        >
                          {row.manager_verified ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                          {row.duty_status}
                          {row.late_minutes > 0 ? ` (+${row.late_minutes}m)` : ''}
                        </div>
                        <div className="text-xs font-mono text-[#6b7488]">
                          In: {String(row.check_in_at || '').slice(11, 16) || '10:00'}
                          {row.check_out_at ? ` · Out: ${String(row.check_out_at).slice(11, 16)}` : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Card 3: How Standalone Systems-Off Reception QR Works */}
            <div className="rounded-3xl bg-white border border-[#e7e1d4] p-6 shadow-xs space-y-3">
              <h3 className="text-base font-bold font-display text-[#0b1a33]">
                How SWK Standalone Reception QR Works When Office Systems Are Off
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[#3a4660]">
                <div className="p-3.5 rounded-2xl bg-[#fbf8f2] border border-[#efe9dc]">
                  <b className="text-[#0b1a33] flex items-center gap-1.5 mb-1">
                    <PowerOff size={14} className="text-[#9a7a42]" /> 1. Zero Login & PC-Independent
                  </b>
                  Operates as a dedicated standalone reception endpoint (`/reception-qr`) with no ERP login required and no exposure of internal OS modules.
                </div>
                <div className="p-3.5 rounded-2xl bg-[#fbf8f2] border border-[#efe9dc]">
                  <b className="text-[#0b1a33] flex items-center gap-1.5 mb-1">
                    <QrCode size={14} className="text-[#9a7a42]" /> 2. First-Person Morning Arrival
                  </b>
                  When the first staff member arrives and office PCs are off, they scan the printed Reception Stand QR (`SWK-RECEPTION-STAND-DXB-1`) or tablet QR with their phone.
                </div>
                <div className="p-3.5 rounded-2xl bg-[#fbf8f2] border border-[#efe9dc]">
                  <b className="text-[#0b1a33] flex items-center gap-1.5 mb-1">
                    <MapPin size={14} className="text-[#9a7a42]" /> 3. Direct SWK OS Backend Sync
                  </b>
                  Every check-in writes directly to `attendance_events` and `attendance` in SWK OS, enforcing the 10:05 AM grace period and feeding the 10:30 AM Owner WhatsApp report.
                </div>
                <div className="p-3.5 rounded-2xl bg-[#fbf8f2] border border-[#efe9dc]">
                  <b className="text-[#0b1a33] flex items-center gap-1.5 mb-1">
                    <ShieldCheck size={14} className="text-[#9a7a42]" /> 4. Mandatory Checkout Gate
                  </b>
                  Staff cannot check out until scheduled site visits are completed and today’s Daily Report is submitted (available right from this reception screen).
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
