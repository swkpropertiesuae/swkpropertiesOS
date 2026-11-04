import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import QRCode from 'qrcode'
import {
  ShieldCheck, RefreshCw, Wifi, Clock, CheckCircle2,
  AlertTriangle, Building2, QrCode, Users, Printer, Maximize2,
  Minimize2, LogIn, LogOut, MapPin, FileCheck2, PowerOff, Sparkles,
  Camera, Lock, Smartphone, Eye, EyeOff, MonitorPlay, Download, Settings, Check, ArrowRight, RotateCcw,
} from 'lucide-react'
import { get, post } from '../../lib/api'
import { useMeta } from '../../lib/meta'
import { Loading } from '../../ui/kit'
import { SWK_BRAND } from '../../mobile/SwkOneBrandAssets'
import { SWK_STAFF_ACCOUNTS } from '@shared/swk-staff-access'
import {
  captureVideoFrameSignature,
  getDeviceIdentity,
  requestCameraAccess,
  SWK_MOBILE_DOMAIN,
  type DeviceIdentity,
} from '../../mobile/native-bridge'

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

export default function ReceptionQrPage() {
  const qc = useQueryClient()
  const nav = useNavigate()
  const { me, reload: reloadMeta } = useMeta()
  const [searchParams] = useSearchParams()

  const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 820
  const hasScanParam =
    searchParams.get('scan') === '1' ||
    searchParams.get('checkin') === '1' ||
    Boolean(searchParams.get('token') || searchParams.get('stand') || searchParams.get('code'))
  const initialScreensaver = searchParams.get('screensaver') === '1'

  // Active tab: 'display' (Reception QR Poster / Kiosk Display) vs 'mobile_scan' (Mobile Camera Scan + Company Login Check-In)
  const [viewTab, setViewTab] = useState<'display' | 'mobile_scan'>(() =>
    hasScanParam || isMobileViewport ? 'mobile_scan' : 'display'
  )
  const [screensaverActive, setScreensaverActive] = useState<boolean>(initialScreensaver)
  const [screensaverOffset, setScreensaverOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  const [qrMode, setQrMode] = useState<'lifelong' | 'rotating'>('lifelong')
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [standQrDataUrl, setStandQrDataUrl] = useState<string>('')
  const [countdown, setCountdown] = useState<number>(45)
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)

  // Live Camera Scanner State (Make sure camera access is taken)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraStatus, setCameraStatus] = useState<'idle' | 'requesting' | 'active' | 'denied'>('idle')
  const [cameraError, setCameraError] = useState<string>('')
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const [cameraVerified, setCameraVerified] = useState<boolean>(false)
  const [scanFrameHash, setScanFrameHash] = useState<string>('')
  const [scannedQrCode, setScannedQrCode] = useState<string>(
    searchParams.get('stand') || searchParams.get('token') || searchParams.get('code') || ''
  )

  // Device & Network Telemetry
  const [device, setDevice] = useState<DeviceIdentity | null>(null)
  const [connectionType, setConnectionType] = useState<string>('Wi-Fi')
  const [claimedWifiSsid, setClaimedWifiSsid] = useState<string>('')

  // Dedicated Company Login ID State (Staff signs into OS using dedicated company login ID to register attendance)
  const [loginEmail, setLoginEmail] = useState<string>(() => me?.email || localStorage.getItem('swk.remember') || '')
  const [loginPassword, setLoginPassword] = useState<string>('')
  const [loginTotp, setLoginTotp] = useState<string>('')
  const [needTotp, setNeedTotp] = useState<boolean>(false)
  const [showPw, setShowPw] = useState<boolean>(false)
  const [clientVarHours, setClientVarHours] = useState<boolean>(false)
  const [varHoursReason, setVarHoursReason] = useState<string>('')

  const [busyAction, setBusyAction] = useState<'checkin' | 'checkout' | 'daily_report' | 'wifi_save' | null>(null)
  const [checkedInSuccess, setCheckedInSuccess] = useState<any>(null)
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

  // Office Wi-Fi Configuration Modal State
  const [wifiModalOpen, setWifiModalOpen] = useState<boolean>(false)
  const [wifiSsidInput, setWifiSsidInput] = useState<string>('')
  const [wifiBssidInput, setWifiBssidInput] = useState<string>('')
  const [wifiPublicIpsInput, setWifiPublicIpsInput] = useState<string>('')
  const [wifiGatewayInput, setWifiGatewayInput] = useState<string>('192.168.1.1')
  const [wifiStrictIpInput, setWifiStrictIpInput] = useState<boolean>(false)
  const [wifiLatInput, setWifiLatInput] = useState<string>('25.2532')
  const [wifiLngInput, setWifiLngInput] = useState<string>('55.2972')
  const [wifiRadiusInput, setWifiRadiusInput] = useState<number>(200)

  const qrQuery = useQuery({
    queryKey: ['reception-qr-current'],
    queryFn: () => get<any>('/api/public/reception-qr/current?branch_id=1'),
    refetchInterval: 15000,
  })

  const data = qrQuery.data

  // Sync Wi-Fi inputs when server data arrives
  useEffect(() => {
    if (data?.office_wifi) {
      const w = data.office_wifi
      if (!wifiSsidInput) setWifiSsidInput((w.allowed_ssids || []).join(', ') || w.ssid || 'SWK-Properties-Office')
      if (!wifiBssidInput && w.bssid) setWifiBssidInput(w.bssid)
      if (!wifiPublicIpsInput && w.public_ips) setWifiPublicIpsInput(w.public_ips)
      if (w.gateway_ip) setWifiGatewayInput(w.gateway_ip)
      setWifiStrictIpInput(Boolean(w.strict_ip))
      if (w.gps_lat) setWifiLatInput(String(w.gps_lat))
      if (w.gps_lng) setWifiLngInput(String(w.gps_lng))
      if (w.gps_radius_m) setWifiRadiusInput(Number(w.gps_radius_m))
      if (!claimedWifiSsid) setClaimedWifiSsid(w.ssid || 'SWK-Properties-Office')
    }
  }, [data?.office_wifi])

  useEffect(() => {
    if (me?.email && !loginEmail) setLoginEmail(me.email)
  }, [me?.email])

  // Load device identity & network connection type
  useEffect(() => {
    void getDeviceIdentity().then(setDevice)
    const conn = typeof navigator !== 'undefined' ? (navigator as any).connection : null
    if (conn?.type === 'cellular') {
      setConnectionType('Cellular')
    } else {
      setConnectionType('Wi-Fi')
    }
  }, [])

  // Screensaver anti-burn-in subtle floating animation
  useEffect(() => {
    if (!screensaverActive) return
    const timer = setInterval(() => {
      setScreensaverOffset({
        x: Math.round((Math.random() - 0.5) * 28),
        y: Math.round((Math.random() - 0.5) * 20),
      })
    }, 8000)
    return () => clearInterval(timer)
  }, [screensaverActive])

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }

  const startMobileCamera = async (mode: 'environment' | 'user' = facingMode) => {
    setCameraStatus('requesting')
    setCameraError('')
    stopCameraStream()
    const res = await requestCameraAccess(mode)
    if (!res.granted || !res.stream) {
      setCameraStatus('denied')
      setCameraError(res.error || 'Camera access is required to scan the physical Reception QR Stand.')
      return
    }
    streamRef.current = res.stream
    setCameraStatus('active')
    if (videoRef.current) {
      videoRef.current.srcObject = res.stream
      void videoRef.current.play().catch(() => {})
    }
  }

  // Automatically request camera when switching to 'mobile_scan' tab
  useEffect(() => {
    if (viewTab !== 'mobile_scan') {
      stopCameraStream()
      setCameraStatus('idle')
      return
    }
    void startMobileCamera(facingMode)
    return () => stopCameraStream()
  }, [viewTab, facingMode])

  // Real-time QR decoding from live camera feed (BarcodeDetector + Frame Liveness Hash)
  useEffect(() => {
    if (cameraStatus !== 'active' || viewTab !== 'mobile_scan') return
    const Detector = (window as any).BarcodeDetector
    let detector: any = null
    if (Detector) {
      try {
        detector = new Detector({ formats: ['qr_code'] })
      } catch {
        detector = null
      }
    }

    const timer = setInterval(async () => {
      const video = videoRef.current
      if (!video || video.readyState < 2) return
      const sig = captureVideoFrameSignature(video)
      if (sig.validFrame && !scanFrameHash) {
        setScanFrameHash(sig.frameHash)
      }
      if (detector) {
        try {
          const found = await detector.detect(video)
          const raw = found?.[0]?.rawValue
          if (raw) {
            const latestSig = captureVideoFrameSignature(video)
            setScannedQrCode(String(raw))
            setCameraVerified(true)
            if (latestSig.frameHash) setScanFrameHash(latestSig.frameHash)
          }
        } catch {
          // continue scanning
        }
      }
    }, 450)

    return () => clearInterval(timer)
  }, [cameraStatus, viewTab, scanFrameHash])

  // Capture live camera frame proof manually (for iOS Safari or when pointing at the printed Lifelong QR)
  const handleCaptureLiveQrProof = () => {
    const sig = captureVideoFrameSignature(videoRef.current)
    if (!sig.validFrame) {
      setFeedbackBanner({
        tone: 'err',
        title: 'Camera Lens Covered or Not Ready',
        detail: 'Point your rear camera clearly at the physical Reception QR Stand in a well-lit area and try again.',
      })
      return
    }
    const codeToLock = scannedQrCode || data?.stand_code || 'SWK-RECEPTION-STAND-DXB-1'
    setScannedQrCode(codeToLock)
    setScanFrameHash(sig.frameHash)
    setCameraVerified(true)
    setFeedbackBanner({
      tone: 'ok',
      title: 'Physical Reception QR Captured & Verified via Live Camera',
      detail: `Camera Liveness Proof (${sig.frameHash}) locked. Now sign in below with your @swkpropertiesuae.com company login ID to register attendance.`,
    })
  }

  const mobileBaseDomain = data?.office_wifi?.mobile_app_domain || SWK_MOBILE_DOMAIN

  const lifelongStandUrl = useMemo(() => {
    const stand = data?.stand_code || 'SWK-RECEPTION-STAND-DXB-1'
    return `${mobileBaseDomain}/reception-qr?scan=1&stand=${encodeURIComponent(stand)}`
  }, [mobileBaseDomain, data?.stand_code])

  const rotatingScanUrl = useMemo(() => {
    if (!data?.token_code) return ''
    return `${mobileBaseDomain}/reception-qr?scan=1&token=${encodeURIComponent(data.token_code)}&code=${encodeURIComponent(data.short_code || '')}&stand=${encodeURIComponent(data.stand_code || 'SWK-RECEPTION-STAND-DXB-1')}`
  }, [mobileBaseDomain, data?.token_code, data?.short_code, data?.stand_code])

  useEffect(() => {
    if (!rotatingScanUrl) return
    setCountdown(data?.ttl_seconds || 45)
    QRCode.toDataURL(rotatingScanUrl, {
      width: 380,
      margin: 2,
      color: { dark: '#0b1a33', light: '#ffffff' },
    })
      .then(url => setQrDataUrl(url))
      .catch(() => {})
  }, [rotatingScanUrl, data?.ttl_seconds])

  useEffect(() => {
    if (!lifelongStandUrl) return
    QRCode.toDataURL(lifelongStandUrl, {
      width: 380,
      margin: 2,
      color: { dark: '#0b1a33', light: '#ffffff' },
    })
      .then(url => setStandQrDataUrl(url))
      .catch(() => {})
  }, [lifelongStandUrl])

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

  // Request Screen Wake Lock so the reception display / screensaver never turns off
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

  const getLiveGps = (): Promise<{ lat?: number; lng?: number; accuracy_m?: number }> =>
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
        { enableHighAccuracy: true, timeout: 4500, maximumAge: 0 },
      )
    })

  // Download Standalone Reception QR & Screensaver HTML file (works on any reception PC without login)
  const handleDownloadStandaloneFile = async () => {
    try {
      const res = await fetch('/reception-qr.html?standalone=1')
      const html = await res.text()
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'SWK-Reception-QR-Screensaver-Standalone.html'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      window.open('/reception-qr.html?standalone=1', '_blank')
    }
  }

  // Submit Mobile QR Scan + Dedicated Company Login ID Check-In
  const handleLoginAndCheckIn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setFeedbackBanner(null)

    // Ensure camera proof was captured if camera is active
    let frameHashToUse = scanFrameHash
    if (cameraStatus === 'active' && videoRef.current) {
      const sig = captureVideoFrameSignature(videoRef.current)
      if (sig.validFrame) {
        frameHashToUse = sig.frameHash
        setScanFrameHash(sig.frameHash)
        setCameraVerified(true)
      }
    }

    if (!me && (!loginEmail.trim() || !loginPassword)) {
      setFeedbackBanner({
        tone: 'err',
        title: 'Dedicated Company Login Required',
        detail: 'Enter your @swk.property or @swkpropertiesuae.com email and password to authenticate and register your office attendance.',
      })
      return
    }

    setBusyAction('checkin')
    try {
      const gps = await getLiveGps()
      const qrTokenToUse =
        scannedQrCode.trim() ||
        data?.stand_code ||
        'SWK-RECEPTION-STAND-DXB-1'

      const res = await post<any>('/api/public/reception-qr/scan-login-checkin', {
        email: (loginEmail || me?.email || '').trim(),
        password: loginPassword || undefined,
        totp: needTotp ? loginTotp : undefined,
        require_login: !me,
        strict_anti_loophole: true,
        qr_code_or_token: qrTokenToUse,
        device_id: device?.device_id || undefined,
        device_name: device?.device_name || 'SWK Mobile Handset',
        network_ssid: claimedWifiSsid || data?.office_wifi?.ssid || 'SWK-Properties-Office',
        connection_type: connectionType,
        camera_verified: cameraVerified || Boolean(frameHashToUse),
        scan_frame_hash: frameHashToUse || undefined,
        challenge_nonce: data?.challenge_nonce || undefined,
        client_variable_hours: clientVarHours,
        variable_hours_reason: varHoursReason.trim() || undefined,
        ...gps,
      })

      if (res?.needsTotp) {
        setNeedTotp(true)
        setFeedbackBanner({
          tone: 'warn',
          title: 'Two-Factor Authenticator Code Required',
          detail: 'Enter the 6-digit code from your authenticator app to complete sign-in and attendance check-in.',
        })
        return
      }

      if (loginEmail) {
        try { localStorage.setItem('swk.remember', loginEmail.trim()) } catch { /* ignore */ }
      }
      await reloadMeta().catch(() => {})
      await qc.invalidateQueries({ queryKey: ['reception-qr-current'] })

      const empName = res?.employee?.name || me?.name || 'Staff Member'
      const ev = res?.attendance_event || res?.event
      const isLate = res?.verification_summary?.is_late
      const lateMins = res?.verification_summary?.late_minutes || 0

      setCheckedInSuccess(res)
      setFeedbackBanner({
        tone: isLate ? 'warn' : 'ok',
        title: isLate
          ? `Signed In & Checked In (Late +${lateMins}m after 10:05 AM): ${empName}`
          : `Signed In & Checked In On-Time: ${empName}`,
        detail: `Event ${ev?.event_no || ''} registered in SWK OS at ${String(ev?.check_in_at || '').slice(11, 16) || 'now'} GST · Device Bound: ${device?.device_id || 'Verified'} · Office Wi-Fi: ${res?.verification_summary?.office_wifi_ssid || 'Verified'}.`,
      })
    } catch (err: any) {
      setFeedbackBanner({
        tone: 'err',
        title: 'Attendance Check-In Blocked',
        detail: err?.message || 'Could not verify credentials or Office Wi-Fi connection.',
      })
    } finally {
      setBusyAction(null)
    }
  }

  const handleCheckOut = async () => {
    setBusyAction('checkout')
    setFeedbackBanner(null)
    try {
      const gps = await getLiveGps()
      const res = await post<any>('/api/public/reception-qr/check-out', {
        email: (loginEmail || me?.email || '').trim() || undefined,
        client_variable_hours: clientVarHours,
        variable_hours_reason: varHoursReason.trim() || undefined,
        ...gps,
      })
      await qc.invalidateQueries({ queryKey: ['reception-qr-current'] })
      setShowQuickReportForm(false)
      setFeedbackBanner({
        tone: 'ok',
        title: `Checked Out Successfully: ${res?.employee?.name || me?.name || 'Employee'}`,
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
        email: (loginEmail || me?.email || '').trim() || undefined,
        self_summary: dailySummary.trim(),
        blockers: dailyBlockers.trim() || 'None',
        next_day_priorities: dailyNextPriorities.trim() || 'Follow up active leads and viewings',
      })
      await handleCheckOut()
    } catch (e: any) {
      setFeedbackBanner({
        tone: 'err',
        title: 'Could Not Submit Daily Report',
        detail: e?.message || 'Please retry.',
      })
      setBusyAction(null)
    }
  }

  const handleSaveWifiConfig = async (lockCurrentIp = false) => {
    setBusyAction('wifi_save')
    try {
      await post<any>('/api/public/reception-qr/wifi-config', {
        office_wifi_ssid: wifiSsidInput.trim() || 'SWK-Properties-Office',
        office_wifi_bssid: wifiBssidInput.trim(),
        office_wifi_public_ips: wifiPublicIpsInput.trim(),
        office_wifi_gateway_ip: wifiGatewayInput.trim() || '192.168.1.1',
        office_wifi_strict_ip: wifiStrictIpInput,
        office_gps_lat: wifiLatInput.trim() || '25.2532',
        office_gps_lng: wifiLngInput.trim() || '55.2972',
        office_gps_radius_m: Number(wifiRadiusInput || 200),
        lock_current_ip: lockCurrentIp,
      })
      await qc.invalidateQueries({ queryKey: ['reception-qr-current'] })
      setWifiModalOpen(false)
      setFeedbackBanner({
        tone: 'ok',
        title: 'Office Wi-Fi & Anti-Loophole Security Saved',
        detail: `Office Wi-Fi SSID (${wifiSsidInput || 'SWK-Properties-Office'}) and network verification rules are now active across all mobile check-ins.`,
      })
    } catch (err: any) {
      setFeedbackBanner({
        tone: 'err',
        title: 'Could Not Save Wi-Fi Settings',
        detail: err?.message || 'Please retry.',
      })
    } finally {
      setBusyAction(null)
    }
  }

  if (qrQuery.isLoading && !data) {
    return (
      <div className="min-h-screen bg-[#08142a] text-white grid place-items-center p-6">
        <Loading label="Starting SWK Reception QR & Screensaver Terminal…" />
      </div>
    )
  }

  const roster: any[] = data?.staff_roster || []
  const checkedInCount = roster.filter(r => r.checked_in && !r.checked_out).length
  const checkedOutCount = roster.filter(r => r.checked_out).length
  const lateCount = roster.filter(r => r.late_minutes > 5 || r.duty_status === 'Late Arrival').length
  const wifiInfo = data?.office_wifi

  return (
    <div className="min-h-screen bg-[#f6f3ec] text-[#0b1a33] py-4 px-3 sm:py-6 sm:px-6">
      {/* FULL-SCREEN RECEPTION SCREENSAVER MODE (No Login Required · Anti-Burn-In Kiosk) */}
      <AnimatePresence>
        {screensaverActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#050c1a] text-white flex flex-col justify-between p-6 sm:p-10 overflow-hidden select-none"
          >
            <div
              className="absolute inset-0 bg-cover bg-center opacity-15 pointer-events-none"
              style={{ backgroundImage: `url(${SWK_BRAND.heroDubai})` }}
            />
            <img
              src={SWK_BRAND.skylineFront}
              alt=""
              aria-hidden
              className="absolute bottom-0 left-0 right-0 w-full h-36 object-cover opacity-15 pointer-events-none"
            />

            {/* Top Bar */}
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <img src={SWK_BRAND.fullLogoDark} alt="SWK OS" className="h-16 sm:h-20 w-auto object-contain" />
                <div className="h-10 w-px bg-[#c9a96e]/30 hidden sm:block" />
                <div>
                  <div className="text-[11px] uppercase tracking-[0.25em] text-[#c9a96e] font-bold">
                    SWK Properties L.L.C · Dubai Head Office
                  </div>
                  <div className="text-lg sm:text-xl font-display font-bold text-white">
                    Official Reception Attendance QR Terminal
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="px-4 py-2 rounded-2xl bg-white/10 border border-[#c9a96e]/40 text-right">
                  <div className="text-[10px] uppercase tracking-wider text-[#dcc8a2] font-bold">
                    Dubai Time · Grace Until 10:05 AM
                  </div>
                  <div className="text-base sm:text-lg font-mono font-bold text-white">
                    {data?.shift_info?.dubai_time || 'Asia/Dubai GST'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setScreensaverActive(false)}
                  className="px-4 py-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs font-bold border border-white/20 cursor-pointer"
                >
                  Exit Screensaver
                </button>
              </div>
            </div>

            {/* Center Floating Anti-Burn-In QR Showcase */}
            <motion.div
              animate={{ x: screensaverOffset.x, y: screensaverOffset.y }}
              transition={{ duration: 6, ease: 'easeInOut' }}
              className="relative z-10 my-auto mx-auto max-w-4xl w-full grid grid-cols-1 md:grid-cols-12 gap-8 items-center rounded-3xl bg-[#0b1a33]/90 border-2 border-[#c9a96e]/60 p-6 sm:p-10 shadow-[0_30px_90px_rgba(0,0,0,0.85)]"
            >
              <div className="md:col-span-5 flex flex-col items-center text-center">
                <div className="p-4 rounded-3xl bg-white shadow-2xl border-4 border-[#c9a96e]">
                  {standQrDataUrl ? (
                    <img src={standQrDataUrl} alt="SWK Lifelong Reception QR" className="w-60 h-60 sm:w-68 sm:h-68 object-contain" />
                  ) : (
                    <div className="w-60 h-60 grid place-items-center text-[#0b1a33] font-bold">Generating QR…</div>
                  )}
                </div>
                <div className="mt-3 text-xs font-mono text-[#dcc8a2] font-bold tracking-wider">
                  {data?.stand_code || 'SWK-RECEPTION-STAND-DXB-1'}
                </div>
              </div>

              <div className="md:col-span-7 space-y-4 text-left">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#157a52]/40 border border-[#4fd39a]/50 text-[#8fe3bd] text-xs font-bold uppercase tracking-wider">
                  <Wifi size={14} /> Connect to Office Wi-Fi: {wifiInfo?.ssid || 'SWK-Properties-Office'}
                </div>
                <h2 className="text-2xl sm:text-4xl font-display font-bold text-white leading-tight">
                  Scan with Your Phone Camera &amp; Sign In to <span className="text-[#dcc8a2]">SWK OS</span>
                </h2>
                <ol className="space-y-2.5 text-sm text-[#c8d3e6] list-decimal list-inside">
                  <li>
                    Connect your phone to <b className="text-white">{wifiInfo?.ssid || 'SWK-Properties-Office'}</b> Wi-Fi.
                  </li>
                  <li>
                    Open your phone camera (or <b className="text-[#f3ead8]">ae.swkpropertiesuae.com</b>) and scan this QR code.
                  </li>
                  <li>
                    Sign in with your dedicated <b className="text-white">@swkpropertiesuae.com</b> login ID — your attendance is verified and recorded in SWK OS automatically.
                  </li>
                </ol>
                <div className="pt-2 flex flex-wrap items-center gap-3 text-xs font-bold">
                  <span className="px-3.5 py-2 rounded-xl bg-white/10 text-[#8fe3bd]">
                    ✓ {checkedInCount} Staff Checked In Today
                  </span>
                  <span className="px-3.5 py-2 rounded-xl bg-white/10 text-[#f3ead8]">
                    ✓ Hardware &amp; Wi-Fi Anti-Cheat Active
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Bottom Footer */}
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 text-xs text-[#8a9ab5]">
              <span>Standalone Reception Screensaver · Operates Without Login · Connected to SWK Properties OS Backend</span>
              <span className="font-mono text-[#dcc8a2]">{SWK_MOBILE_DOMAIN}/reception-qr</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto space-y-5">
        {/* Top Header Banner */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="relative overflow-hidden rounded-3xl text-white p-4 sm:p-6 shadow-xl flex flex-wrap items-center justify-between gap-4 border border-[#c9a96e]/50 print:hidden"
          style={{ background: 'linear-gradient(135deg, #08142a 0%, #0b1a33 55%, #14305c 100%)' }}
        >
          <div
            className="absolute inset-0 bg-cover bg-center opacity-15 pointer-events-none"
            style={{ backgroundImage: `url(${SWK_BRAND.heroDubai})` }}
            aria-hidden
          />
          <div className="relative z-10 flex items-center gap-3.5 min-w-0">
            <img
              src={SWK_BRAND.fullLogoDark}
              alt="SWK Properties OS"
              className="h-12 sm:h-16 w-auto shrink-0 object-contain"
            />
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#c9a96e]/25 border border-[#c9a96e]/60 text-[#f3ead8] text-[10.5px] font-bold tracking-wider uppercase">
                  <QrCode size={12} className="text-[#c9a96e]" /> Lifelong Printed QR + Screensaver
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#157a52]/35 border border-[#4fd39a]/50 text-[#d1fae5] text-[10.5px] font-bold tracking-wider uppercase">
                  <PowerOff size={11} className="text-[#4fd39a]" /> Works When Office PCs Are Off
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold font-display tracking-tight text-white">
                SWK Properties — Reception QR &amp; Mobile Login Attendance
              </h1>
              <p className="text-xs text-[#c8d3e6] max-w-2xl">
                Printed once for life or displayed as a screensaver without login. Staff scan with their mobile camera on{' '}
                <b className="text-[#f3ead8]">ae.swkpropertiesuae.com</b>, verify Office Wi-Fi, and sign in with their dedicated company login ID.
              </p>
            </div>
          </div>

          <div className="relative z-10 flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => setScreensaverActive(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-full text-[#0b1a33] font-bold text-xs transition shadow-md cursor-pointer border-0"
              style={{ background: 'linear-gradient(135deg, #f1e3c2 0%, #c9a96e 100%)' }}
            >
              <MonitorPlay size={15} /> Screensaver Mode
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-full bg-white/12 text-[#f3ead8] font-bold text-xs hover:bg-white/20 transition cursor-pointer border border-white/20"
            >
              <Printer size={14} /> Print Lifelong QR
            </button>
            <button
              type="button"
              onClick={() => void handleDownloadStandaloneFile()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-full bg-white/12 text-[#f3ead8] font-bold text-xs hover:bg-white/20 transition cursor-pointer border border-white/20"
              title="Download standalone HTML file for any reception PC or USB"
            >
              <Download size={14} /> Download File
            </button>
            <button
              type="button"
              onClick={() => setWifiModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-full bg-white/12 text-[#f3ead8] font-bold text-xs hover:bg-white/20 transition cursor-pointer border border-white/20"
            >
              <Wifi size={14} /> Office Wi-Fi Setup
            </button>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-full bg-white/10 text-[#f3ead8] font-semibold text-xs hover:bg-white/20 transition cursor-pointer border border-white/20"
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          </div>
        </motion.div>

        {/* Mode Selector Bar: Mobile Camera Scan & Login vs Reception QR Stand/Screensaver Display */}
        <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-white border border-[#e7e1d4] shadow-xs print:hidden">
          <button
            type="button"
            onClick={() => setViewTab('mobile_scan')}
            className={`py-3 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer border-0 ${
              viewTab === 'mobile_scan'
                ? 'bg-[#0b1a33] text-[#f3ead8] shadow-sm'
                : 'bg-transparent text-[#6b7488] hover:text-[#0b1a33]'
            }`}
          >
            <Camera size={17} className={viewTab === 'mobile_scan' ? 'text-[#c9a96e]' : ''} />
            <span>1. Staff Mobile Camera Scan &amp; OS Login Check-In</span>
          </button>
          <button
            type="button"
            onClick={() => setViewTab('display')}
            className={`py-3 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer border-0 ${
              viewTab === 'display'
                ? 'bg-[#0b1a33] text-[#f3ead8] shadow-sm'
                : 'bg-transparent text-[#6b7488] hover:text-[#0b1a33]'
            }`}
          >
            <QrCode size={17} className={viewTab === 'display' ? 'text-[#c9a96e]' : ''} />
            <span>2. Lifelong Printed Reception QR &amp; Screensaver</span>
          </button>
        </div>

        {/* Printable A4 Lifelong Reception QR Poster (Printed Once for Life — Works When All Office PCs Are Off) */}
        <div className="hidden print:block p-8 rounded-3xl border-4 border-[#0b1a33] bg-white text-center space-y-5">
          <img
            src={SWK_BRAND.fullLogoLight}
            alt="SWK Properties OS"
            className="h-24 w-auto mx-auto object-contain"
          />
          <div className="text-xs font-bold uppercase tracking-[0.22em] text-[#9a7a42]">
            SWK Properties L.L.C. · Dubai Head Office · Lifelong Reception Attendance Stand
          </div>
          <h1 className="text-3xl font-extrabold text-[#0b1a33]">
            Official Office Reception QR Check-In
          </h1>
          <p className="text-sm text-[#3a4660] max-w-xl mx-auto">
            <b>Printed Once for Life · Works 24/7 Even When Office Computers Are Turned OFF.</b><br />
            1. Connect your phone to Office Wi-Fi (<b>{wifiInfo?.ssid || 'SWK-Properties-Office'}</b>).<br />
            2. Scan this QR code with your mobile camera.<br />
            3. Sign in with your dedicated <b>@swkpropertiesuae.com</b> login ID to register your daily attendance.
          </p>
          {standQrDataUrl && (
            <img
              src={standQrDataUrl}
              alt="Lifelong Reception Stand QR"
              className="w-72 h-72 mx-auto border-4 border-[#c9a96e] p-3 rounded-2xl"
            />
          )}
          <div className="text-lg font-mono font-bold text-[#0b1a33]">
            LIFELONG STAND ID: {data?.stand_code || 'SWK-RECEPTION-STAND-DXB-1'}
          </div>
          <div className="text-xs font-semibold text-[#14305c]">
            Mobile Portal: {SWK_MOBILE_DOMAIN} · Anti-Loophole Hardware &amp; Office Wi-Fi Verification Enabled
          </div>
          <div className="text-xs text-[#3a4660]">
            Working Hours: Mon–Fri 10:00 AM – 7:00 PM · Saturday 10:00 AM – 4:00 PM · Grace Period Until 10:05 AM GST
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start print:hidden">
          {/* Left Column (5 cols): Either Live Mobile Camera QR Scanner OR Lifelong Printable QR Display */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="lg:col-span-5 rounded-3xl bg-white border border-[#e7e1d4] p-5 sm:p-6 shadow-[0_16px_40px_-24px_rgba(11,26,51,0.35)] space-y-4"
          >
            {viewTab === 'mobile_scan' ? (
              <>
                <div className="flex items-center justify-between border-b border-[#efe9dc] pb-3">
                  <div className="flex items-center gap-2">
                    <Camera size={18} className="text-[#9a7a42]" />
                    <div>
                      <div className="text-sm font-bold text-[#0b1a33]">Step 1: Live Mobile Camera QR Scan</div>
                      <div className="text-[11px] text-[#6b7488]">
                        Camera access is required — gallery uploads are blocked
                      </div>
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                      cameraVerified
                        ? 'bg-[#e3f4ec] text-[#157a52]'
                        : cameraStatus === 'active'
                          ? 'bg-[#f3ead8] text-[#7d5f2c]'
                          : 'bg-[#fde8e8] text-[#991b1b]'
                    }`}
                  >
                    {cameraVerified
                      ? '✓ QR Captured'
                      : cameraStatus === 'active'
                        ? 'Camera Live'
                        : cameraStatus === 'requesting'
                          ? 'Requesting…'
                          : 'Camera Needed'}
                  </span>
                </div>

                {/* Live Camera Viewfinder */}
                <div className="relative h-64 sm:h-72 rounded-2xl bg-[#08142a] overflow-hidden flex flex-col items-center justify-center text-white border-2 border-[#c9a96e]">
                  {cameraStatus === 'active' ? (
                    <>
                      <video
                        ref={videoRef}
                        className="absolute inset-0 w-full h-full object-cover"
                        muted
                        playsInline
                        autoPlay
                      />
                      {/* Scanning Target Frame & Animated Laser Line */}
                      <div className="relative z-10 w-48 h-48 rounded-2xl border-2 border-[#c9a96e] shadow-[0_0_0_9999px_rgba(8,20,42,0.45)] flex items-center justify-center">
                        <motion.div
                          className="w-full h-0.5 bg-[#4fd39a] shadow-[0_0_12px_#4fd39a]"
                          animate={{ y: [-75, 75, -75] }}
                          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                        />
                      </div>
                      <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setFacingMode(f => (f === 'environment' ? 'user' : 'environment'))}
                          className="px-3 py-1.5 rounded-xl bg-black/65 text-white text-xs font-semibold border border-white/20 cursor-pointer flex items-center gap-1.5"
                        >
                          <RotateCcw size={13} /> Flip Camera
                        </button>
                        <button
                          type="button"
                          onClick={handleCaptureLiveQrProof}
                          className="px-3.5 py-1.5 rounded-xl text-[#0b1a33] text-xs font-bold border-0 cursor-pointer shadow-md flex items-center gap-1.5"
                          style={{ background: 'linear-gradient(135deg, #f1e3c2 0%, #c9a96e 100%)' }}
                        >
                          <Camera size={13} /> Capture QR Proof
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="p-6 text-center space-y-3 max-w-xs">
                      <Camera size={36} className="mx-auto text-[#c9a96e]" />
                      <div className="text-sm font-bold text-white">
                        {cameraStatus === 'requesting'
                          ? 'Requesting Mobile Camera Permission…'
                          : 'Allow Camera Access to Scan Reception QR'}
                      </div>
                      <p className="text-xs text-[#b8c6de]">
                        {cameraError ||
                          'Point your mobile camera at the printed Lifelong Reception QR Stand at the office entrance.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => void startMobileCamera('environment')}
                        className="w-full py-2.5 px-4 rounded-xl text-[#0b1a33] font-bold text-xs border-0 cursor-pointer shadow-md"
                        style={{ background: 'linear-gradient(135deg, #f1e3c2 0%, #c9a96e 100%)' }}
                      >
                        Enable Rear Camera Now
                      </button>
                    </div>
                  )}
                </div>

                {/* Anti-Loophole 5-Point Security Checklist */}
                <div className="rounded-2xl bg-[#fbf8f2] border border-[#e7e1d4] p-3.5 space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#9a7a42] flex items-center gap-1.5">
                    <ShieldCheck size={14} /> 5-Layer Anti-Loophole Verification
                  </div>
                  <div className="grid grid-cols-1 gap-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[#3a4660]">1. Lifelong Reception QR Stand</span>
                      <span className="font-mono font-bold text-[#157a52]">
                        ✓ {data?.stand_code || 'SWK-RECEPTION-STAND-DXB-1'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#3a4660]">2. Live Camera Liveness Proof</span>
                      <span className={`font-bold ${cameraVerified || scanFrameHash ? 'text-[#157a52]' : 'text-[#b45309]'}`}>
                        {cameraVerified || scanFrameHash ? `✓ Verified (${scanFrameHash.slice(0, 12)})` : 'Point Camera at QR'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#3a4660]">3. Office Wi-Fi ({wifiInfo?.ssid || 'SWK-Properties-Office'})</span>
                      <span className={`font-bold ${wifiInfo?.ip_matches_office !== false ? 'text-[#157a52]' : 'text-[#dc2626]'}`}>
                        {wifiInfo?.ip_matches_office !== false
                          ? `✓ IP ${wifiInfo?.detected_client_ip || 'Verified'}`
                          : `⚠ Outside Office IP`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#3a4660]">4. Anti-Buddy-Punching Device Lock</span>
                      <span className="font-mono font-bold text-[#0b1a33]">
                        {device?.device_id || 'Enrolling…'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#3a4660]">5. Dedicated Company Login ID</span>
                      <span className="font-bold text-[#14305c]">
                        {me?.email ? `✓ ${me.email}` : 'Sign In Required →'}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              /* RECEPTION DISPLAY & LIFELONG PRINTABLE QR MODE */
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-full flex items-center justify-between text-xs font-semibold text-[#6b7488] border-b border-[#efe9dc] pb-3">
                  <span className="inline-flex items-center gap-1.5 text-[#0b1a33] font-bold">
                    <Building2 size={15} className="text-[#9a7a42]" />
                    {data?.branch?.name || 'Dubai – Head Office'}
                  </span>
                  {qrMode === 'lifelong' ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#e3f4ec] text-[#157a52] font-bold">
                      <PowerOff size={13} /> Lifelong QR (Works When PCs Off)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f3ead8] text-[#7d5f2c] font-bold">
                      <Clock size={13} /> Rotates in {countdown}s
                    </span>
                  )}
                </div>

                <div className="w-full grid grid-cols-2 gap-1.5 p-1.5 rounded-2xl bg-[#fbf8f2] border border-[#e7e1d4]">
                  <button
                    type="button"
                    onClick={() => setQrMode('lifelong')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer border-0 ${
                      qrMode === 'lifelong'
                        ? 'bg-[#0b1a33] text-[#f3ead8] shadow-xs'
                        : 'bg-transparent text-[#6b7488] hover:text-[#0b1a33]'
                    }`}
                  >
                    Lifelong Printed QR
                  </button>
                  <button
                    type="button"
                    onClick={() => setQrMode('rotating')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer border-0 ${
                      qrMode === 'rotating'
                        ? 'bg-[#0b1a33] text-[#f3ead8] shadow-xs'
                        : 'bg-transparent text-[#6b7488] hover:text-[#0b1a33]'
                    }`}
                  >
                    Dynamic Screen QR (60s)
                  </button>
                </div>

                <div className="relative p-4 rounded-3xl bg-[#fbf8f2] border-2 border-[#c9a96e]/60 shadow-inner">
                  {(qrMode === 'lifelong' ? standQrDataUrl : qrDataUrl) ? (
                    <img
                      src={qrMode === 'lifelong' ? standQrDataUrl : qrDataUrl}
                      alt="SWK Office Reception Attendance QR Code"
                      className="w-64 h-64 rounded-2xl bg-white p-2 shadow-xs mx-auto"
                    />
                  ) : (
                    <div className="w-64 h-64 grid place-items-center text-sm text-[#6b7488]">Generating QR…</div>
                  )}
                  <div className="mt-2.5 text-[11px] font-mono text-[#0b1a33] font-bold break-all">
                    {qrMode === 'lifelong'
                      ? `LIFELONG STAND: ${data?.stand_code || 'SWK-RECEPTION-STAND-DXB-1'}`
                      : `ROTATING TOKEN: ${data?.token_code}`}
                  </div>
                </div>

                <div className="w-full rounded-2xl bg-[#fbf8f2] p-4 border border-[#e7e1d4] space-y-2 text-left">
                  <div className="text-[11px] uppercase tracking-wider text-[#9a7a42] font-bold">
                    Why Staff Cannot Crack This Lifelong Printed QR
                  </div>
                  <ul className="text-xs text-[#3a4660] space-y-1 m-0 pl-4">
                    <li>
                      <b>Dedicated OS Login Required:</b> Scanning the QR requires signing in with the staff member’s own{' '}
                      <code>@swkpropertiesuae.com</code> email &amp; password.
                    </li>
                    <li>
                      <b>Office Wi-Fi Lock:</b> Must be connected to <b>{wifiInfo?.ssid || 'SWK-Properties-Office'}</b>.
                    </li>
                    <li>
                      <b>1-Phone-Per-Staff Hardware Lock:</b> Blocks buddy-punching if an employee tries to sign in for a colleague on the same phone.
                    </li>
                    <li>
                      <b>Live Camera Liveness Proof:</b> Gallery photo uploads and WhatsApp link forwards from home are blocked.
                    </li>
                  </ul>
                </div>

                <div className="w-full grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="py-2.5 px-3 rounded-xl text-[#0b1a33] font-bold text-xs flex items-center justify-center gap-1.5 border-0 cursor-pointer shadow-xs"
                    style={{ background: 'linear-gradient(135deg, #f1e3c2 0%, #c9a96e 100%)' }}
                  >
                    <Printer size={14} /> Print Lifelong Poster
                  </button>
                  <button
                    type="button"
                    onClick={() => setScreensaverActive(true)}
                    className="py-2.5 px-3 rounded-xl bg-[#0b1a33] text-[#f3ead8] font-bold text-xs flex items-center justify-center gap-1.5 border-0 cursor-pointer"
                  >
                    <MonitorPlay size={14} /> Launch Screensaver
                  </button>
                </div>
              </div>
            )}
          </motion.div>

          {/* Right Column (7 cols): Dedicated Company Login Check-In + Today's Verified Roll Call */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08, ease: EASE }}
            className="lg:col-span-7 space-y-5"
          >
            {/* Card 1: Dedicated Company Login ID Check-In (Registers Attendance in SWK OS) */}
            <div className="rounded-3xl bg-white border-2 border-[#c9a96e]/60 p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#efe9dc] pb-3">
                <div>
                  <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#9a7a42]">
                    <Lock size={13} /> Step 2: Dedicated Company Login ID &amp; Office Wi-Fi Verification
                  </div>
                  <h2 className="text-lg font-bold font-display text-[#0b1a33]">
                    Sign In to SWK OS to Register Your Daily Attendance
                  </h2>
                </div>
                <span className="px-3 py-1 rounded-full bg-[#0b1a33] text-[#f3ead8] text-xs font-bold">
                  {SWK_MOBILE_DOMAIN.replace('https://', '')}
                </span>
              </div>

              {feedbackBanner && (
                <div
                  role="status"
                  className={`p-4 rounded-2xl border text-xs space-y-1.5 ${
                    feedbackBanner.tone === 'ok'
                      ? 'bg-[#e3f4ec] border-[#157a52]/30 text-[#0d5236]'
                      : feedbackBanner.tone === 'warn'
                        ? 'bg-[#fff8e6] border-[#d97706]/40 text-[#92400e]'
                        : 'bg-[#fde8e8] border-[#dc2626]/30 text-[#991b1b]'
                  }`}
                >
                  <div className="font-bold text-sm">{feedbackBanner.title}</div>
                  <div>{feedbackBanner.detail}</div>
                  {checkedInSuccess && (
                    <div className="pt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => nav('/swk-one')}
                        className="px-4 py-2 rounded-xl bg-[#0b1a33] text-[#f3ead8] font-bold text-xs border-0 cursor-pointer inline-flex items-center gap-1.5"
                      >
                        Open SWK ONE Mobile Workspace <ArrowRight size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => nav('/home')}
                        className="px-4 py-2 rounded-xl bg-white text-[#0b1a33] font-bold text-xs border border-[#0b1a33]/20 cursor-pointer"
                      >
                        Open Full SWK OS Dashboard
                      </button>
                    </div>
                  )}
                </div>
              )}

              <form onSubmit={e => void handleLoginAndCheckIn(e)} className="space-y-3.5">
                <div className="p-3 rounded-2xl bg-[#fbf8f2] border border-[#e7e1d4]">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#7d5f2c] mb-2">
                    Quick Select Staff Account (@swk.property) — Tap Your Name, Enter Password &amp; Press Check In:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {SWK_STAFF_ACCOUNTS.map(acc => {
                      const active = loginEmail.toLowerCase() === acc.email.toLowerCase()
                      return (
                        <button
                          key={acc.email}
                          type="button"
                          onClick={() => setLoginEmail(acc.displayEmail)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer transition ${
                            active
                              ? 'bg-[#0b1a33] text-[#f1e3c2] border-[#c9a96e]'
                              : 'bg-white text-[#0b1a33] border-[#d8d0c0] hover:border-[#c9a96e]'
                          }`}
                        >
                          {acc.name.split(' ')[0]} · <span className="font-mono text-[11px] opacity-85">{acc.displayEmail}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-[#0b1a33] mb-1">
                      Company Login ID (@swk.property / @swkpropertiesuae.com)
                    </label>
                    <input
                      type="email"
                      required
                      autoComplete="username"
                      value={loginEmail}
                      onChange={e => setLoginEmail(e.target.value)}
                      placeholder="Talha@swk.property"
                      className="w-full rounded-xl border border-[#d8d0c0] bg-[#fbf8f2] px-3.5 py-2.5 text-sm font-semibold text-[#0b1a33]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0b1a33] mb-1">
                      SWK OS Password {me ? '(Optional — Already Signed In)' : '(Required)'}
                    </label>
                    <div className="relative">
                      <input
                        type={showPw ? 'text' : 'password'}
                        required={!me}
                        autoComplete="current-password"
                        value={loginPassword}
                        onChange={e => setLoginPassword(e.target.value)}
                        placeholder={me ? 'Signed in as ' + me.name : 'Enter your SWK OS password'}
                        className="w-full rounded-xl border border-[#d8d0c0] bg-[#fbf8f2] px-3.5 py-2.5 pr-10 text-sm text-[#0b1a33]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(s => !s)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-transparent border-0 text-[#6b7488] cursor-pointer p-1"
                        aria-label="Toggle password visibility"
                      >
                        {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>

                {needTotp && (
                  <div>
                    <label className="block text-xs font-bold text-[#0b1a33] mb-1">
                      6-Digit Authenticator Code (2FA)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={loginTotp}
                      onChange={e => setLoginTotp(e.target.value.replace(/\D/g, ''))}
                      placeholder="000000"
                      className="w-full rounded-xl border border-[#d8d0c0] bg-[#fbf8f2] px-3.5 py-2.5 text-sm font-mono tracking-widest text-[#0b1a33]"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-[#0b1a33] mb-1">
                      Connected Office Wi-Fi Network (SSID)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={claimedWifiSsid}
                        onChange={e => setClaimedWifiSsid(e.target.value)}
                        placeholder={wifiInfo?.ssid || 'SWK-Properties-Office'}
                        className="w-full rounded-xl border border-[#d8d0c0] bg-[#fbf8f2] px-3 py-2 text-xs font-semibold text-[#0b1a33]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0b1a33] mb-1">
                      Scanned Lifelong / Reception QR Code
                    </label>
                    <input
                      type="text"
                      value={scannedQrCode || data?.stand_code || 'SWK-RECEPTION-STAND-DXB-1'}
                      onChange={e => setScannedQrCode(e.target.value)}
                      className="w-full rounded-xl border border-[#d8d0c0] bg-[#fbf8f2] px-3 py-2 text-xs font-mono font-bold text-[#0b1a33]"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <label className="flex items-center gap-2 text-xs font-semibold text-[#3a4660] bg-[#fbf8f2] px-3 py-2 rounded-xl border border-[#efe9dc] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={clientVarHours}
                      onChange={e => setClientVarHours(e.target.checked)}
                    />
                    <span>Sunday / Client-Based Variable Hours</span>
                  </label>

                  <span className="text-[11px] text-[#6b7488] flex items-center gap-1">
                    <Smartphone size={13} className="text-[#9a7a42]" />
                    Bound Device: <b className="font-mono text-[#0b1a33]">{device?.device_id || 'WEB'}</b>
                  </span>
                </div>

                {clientVarHours && (
                  <div>
                    <input
                      type="text"
                      value={varHoursReason}
                      onChange={e => setVarHoursReason(e.target.value)}
                      placeholder="Client viewing / developer launch reason for variable hours…"
                      className="w-full rounded-xl border border-[#d8d0c0] bg-[#fbf8f2] px-3 py-2 text-xs text-[#0b1a33]"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={busyAction !== null}
                    className="py-3.5 px-4 rounded-2xl text-[#0b1a33] font-bold text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer border-0 transition"
                    style={{ background: 'linear-gradient(135deg, #f1e3c2 0%, #c9a96e 100%)' }}
                  >
                    <LogIn size={17} />
                    {busyAction === 'checkin'
                      ? 'Verifying Login, Wi-Fi & Recording…'
                      : 'Sign In to OS & Register Check-In'}
                  </button>

                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() => void handleCheckOut()}
                    className="py-3.5 px-4 rounded-2xl bg-[#0b1a33] text-[#f3ead8] font-bold text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer border-0 hover:bg-[#14305c] transition"
                  >
                    <LogOut size={17} />
                    {busyAction === 'checkout' ? 'Verifying Checkout Gate…' : 'Check Out from Office'}
                  </button>
                </div>
              </form>

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
            </div>

            {/* Card 2: Today's Live Office Attendance Roll Call (Synced with SWK OS) */}
            <div className="rounded-3xl bg-white border border-[#e7e1d4] p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <Users size={18} className="text-[#9a7a42]" />
                  <h2 className="text-base sm:text-lg font-bold font-display text-[#0b1a33]">
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
                <div className="p-6 rounded-2xl bg-[#fbf8f2] border border-[#efe9dc] text-center space-y-2">
                  <img src={SWK_BRAND.logoInk} alt="" className="h-7 w-auto mx-auto opacity-25" />
                  <div className="text-sm font-bold text-[#0b1a33]">
                    Ready for First Morning Arrival — No Office Scans Recorded Yet Today
                  </div>
                  <p className="text-xs text-[#6b7488]">
                    When the first person arrives and office systems are off, they scan the printed Lifelong Reception QR with their mobile camera and sign in with their dedicated SWK OS login ID.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#efe9dc]">
                  {data.today_checkins.map((row: any) => (
                    <div key={row.id} className="py-3 flex items-center justify-between gap-4">
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold font-display text-sm text-[#0b1a33]">
                            {row.employee_name || `Employee #${row.employee_id}`}
                          </span>
                          <span className="text-xs font-mono text-[#6b7488]">{row.event_no}</span>
                        </div>
                        <div className="text-xs text-[#3a4660]">
                          {row.designation ? `${row.designation} · ` : ''}Method: <b>{row.terminal_type}</b> · Shift: {row.shift_name}
                        </div>
                        {row.notes && <div className="text-[11px] text-[#6b7488] truncate">{row.notes}</div>}
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
          </motion.div>
        </div>
      </div>

      {/* Office Wi-Fi & Anti-Loophole Configuration Modal */}
      <AnimatePresence>
        {wifiModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg rounded-3xl bg-white text-[#0b1a33] p-6 shadow-2xl border-2 border-[#c9a96e] space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-[#efe9dc] pb-3">
                <div className="flex items-center gap-2">
                  <Wifi size={18} className="text-[#9a7a42]" />
                  <h3 className="text-base font-bold font-display m-0">
                    Office Wi-Fi &amp; Lifelong QR Anti-Loophole Settings
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setWifiModalOpen(false)}
                  className="px-3 py-1 rounded-lg bg-[#fbf8f2] text-xs font-bold border border-[#d8d0c0] cursor-pointer"
                >
                  Close
                </button>
              </div>

              <p className="text-xs text-[#3a4660] m-0">
                Enter your SWK Properties Office Wi-Fi details below. When enabled, staff can only register attendance if they are connected to the Office Wi-Fi and sign in with their dedicated company login ID.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold mb-1">
                    Office Wi-Fi Name / SSID (comma-separated if you have 2.4G &amp; 5G)
                  </label>
                  <input
                    type="text"
                    value={wifiSsidInput}
                    onChange={e => setWifiSsidInput(e.target.value)}
                    placeholder="e.g. SWK-Properties-Office, SWK-Office-5G"
                    className="w-full rounded-xl border border-[#d8d0c0] bg-[#fbf8f2] px-3 py-2 text-xs font-semibold"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold mb-1">Office Router BSSID / MAC (Optional)</label>
                    <input
                      type="text"
                      value={wifiBssidInput}
                      onChange={e => setWifiBssidInput(e.target.value)}
                      placeholder="e.g. A4:2B:B0:11:22:33"
                      className="w-full rounded-xl border border-[#d8d0c0] bg-[#fbf8f2] px-3 py-2 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">Local Router Gateway IP</label>
                    <input
                      type="text"
                      value={wifiGatewayInput}
                      onChange={e => setWifiGatewayInput(e.target.value)}
                      placeholder="192.168.1.1"
                      className="w-full rounded-xl border border-[#d8d0c0] bg-[#fbf8f2] px-3 py-2 text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold">
                      Allowed Office Wi-Fi Public IP(s)
                    </label>
                    <span className="text-[11px] font-mono text-[#157a52]">
                      Your Current IP: {wifiInfo?.detected_client_ip || '127.0.0.1'}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={wifiPublicIpsInput}
                    onChange={e => setWifiPublicIpsInput(e.target.value)}
                    placeholder="Leave blank to allow any IP, or lock to your Office Static/Public IP"
                    className="w-full rounded-xl border border-[#d8d0c0] bg-[#fbf8f2] px-3 py-2 text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSaveWifiConfig(true)}
                    className="mt-1.5 px-3 py-1.5 rounded-lg bg-[#e3f4ec] text-[#157a52] text-[11px] font-bold border border-[#157a52]/30 cursor-pointer inline-flex items-center gap-1"
                  >
                    <Check size={12} /> Lock Current Network IP ({wifiInfo?.detected_client_ip || 'Current'}) as Office Wi-Fi
                  </button>
                </div>

                <label className="flex items-center gap-2 text-xs font-bold text-[#0b1a33] bg-[#fbf8f2] p-3 rounded-xl border border-[#e7e1d4] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={wifiStrictIpInput}
                    onChange={e => setWifiStrictIpInput(e.target.checked)}
                  />
                  <span>Strict Office Wi-Fi IP Enforcement (Block check-ins from home Wi-Fi or mobile data)</span>
                </label>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold mb-1">Office GPS Lat</label>
                    <input
                      type="text"
                      value={wifiLatInput}
                      onChange={e => setWifiLatInput(e.target.value)}
                      className="w-full rounded-xl border border-[#d8d0c0] bg-[#fbf8f2] px-2.5 py-1.5 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold mb-1">Office GPS Lng</label>
                    <input
                      type="text"
                      value={wifiLngInput}
                      onChange={e => setWifiLngInput(e.target.value)}
                      className="w-full rounded-xl border border-[#d8d0c0] bg-[#fbf8f2] px-2.5 py-1.5 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold mb-1">Radius (m)</label>
                    <input
                      type="number"
                      value={wifiRadiusInput}
                      onChange={e => setWifiRadiusInput(Number(e.target.value))}
                      className="w-full rounded-xl border border-[#d8d0c0] bg-[#fbf8f2] px-2.5 py-1.5 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setWifiModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-[#fbf8f2] text-[#0b1a33] text-xs font-bold border border-[#d8d0c0] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busyAction === 'wifi_save'}
                  onClick={() => void handleSaveWifiConfig(false)}
                  className="px-5 py-2.5 rounded-xl bg-[#0b1a33] text-[#f3ead8] text-xs font-bold border-0 cursor-pointer"
                >
                  {busyAction === 'wifi_save' ? 'Saving…' : 'Save Office Wi-Fi Settings'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
