import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  QrCode, MapPin, Building2, FileText, Users, Eye, MessageSquare, Percent,
  ShieldCheck, Wifi, WifiOff, BatteryCharging, Lock, Smartphone, Monitor,
  Sparkles, RefreshCw, Compass, TrendingUp, CheckCircle2, ArrowUpRight,
  Radio, Flame, Award, Layers,
} from 'lucide-react'
import { get, post } from '../lib/api'
import { AnimatedNumber } from '../swk/ui'
import {
  SWK_BRAND,
  COMMUNITIES,
  DEVELOPERS,
  resolvePropertyPhoto,
} from './SwkOneBrandAssets'
import {
  getDeviceIdentity,
  getCurrentGpsPosition,
  getBatteryAndNetworkTelemetry,
  startNativeForegroundDutyService,
  stopNativeForegroundDutyService,
  getOfflineQueue,
  enqueueOfflineAction,
  removeSyncedOfflineItems,
  isNativeAndroid,
  getStoredServerUrl,
  setStoredServerUrl,
  type DeviceIdentity,
  type OfflineQueueItem,
} from './native-bridge'
import {
  BiometricLockModal,
  ReceptionQrScannerModal,
  PropertyComparisonModal,
  OfflineAndApkModal,
} from './SwkOneModals'
import {
  DutyAndViewingsTab,
  InventoryAndNocTab,
  CrmAndDealsTab,
  PayHrAndSecurityTab,
} from './SwkOneTabs'

export type SwkOneTabId = 'command' | 'duty' | 'inventory' | 'crm' | 'pay'

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

const containerStagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.055, delayChildren: 0.04 },
  },
}

const cardRise = {
  hidden: { opacity: 0, y: 14, filter: 'blur(4px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.48, ease: EASE },
  },
}

export default function SwkOneApp() {
  const reduce = useReducedMotion()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [toast, setToast] = useState<{ text: string; tone?: 'ok' | 'warn' } | null>(null)
  const [activeTab, setActiveTab] = useState<SwkOneTabId>('command')

  // Live Dubai Clock & Active Community Pulse index
  const [dubaiClock, setDubaiClock] = useState(() =>
    new Intl.DateTimeFormat('en-AE', {
      timeZone: 'Asia/Dubai',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date())
  )
  const [pulseIndex, setPulseIndex] = useState(0)

  // Device & native bridge states
  const [device, setDevice] = useState<DeviceIdentity | null>(null)
  const [telemetry, setTelemetry] = useState<{ battery_pct: number | null; network_type: string; online: boolean }>({
    battery_pct: null,
    network_type: 'Checking…',
    online: true,
  })
  const [offlineMode, setOfflineMode] = useState(false)
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueueItem[]>([])
  const [apiBaseUrl, setApiBaseUrlState] = useState(getStoredServerUrl())

  // Modals & frame mode
  const [phoneFrameMode, setPhoneFrameMode] = useState(() => !isNativeAndroid() && window.innerWidth >= 900)
  const [biometricLocked, setBiometricLocked] = useState(false)
  const [qrModalOpen, setQrModalOpen] = useState(false)
  const [compareModalOpen, setCompareModalOpen] = useState(false)
  const [apkModalOpen, setApkModalOpen] = useState(false)

  // Daily report local inputs
  const [eodSummary, setEodSummary] = useState('')
  const [eodBlockers, setEodBlockers] = useState('')
  const [eodPriorities, setEodPriorities] = useState('')

  useEffect(() => {
    const t = setInterval(() => {
      setDubaiClock(
        new Intl.DateTimeFormat('en-AE', {
          timeZone: 'Asia/Dubai',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).format(new Date())
      )
    }, 15000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (reduce) return
    const timer = setInterval(() => {
      setPulseIndex(prev => (prev + 1) % COMMUNITIES.length)
    }, 4500)
    return () => clearInterval(timer)
  }, [reduce])

  const showNotice = (text: string, tone: 'ok' | 'warn' = 'ok') => {
    setToast({ text, tone })
    setTimeout(() => {
      setToast(prev => (prev?.text === text ? null : prev))
    }, 4200)
  }

  const loadBootstrap = async () => {
    try {
      const dev = device || (await getDeviceIdentity())
      if (!device) setDevice(dev)
      const tel = await getBatteryAndNetworkTelemetry()
      setTelemetry(tel)
      setOfflineQueue(getOfflineQueue())

      const res = await get<any>('/api/swk-one/bootstrap')
      setData(res)
      if (res?.today_report?.self_summary && !eodSummary) {
        setEodSummary(res.today_report.self_summary)
      }
      await post('/api/swk-one/device/register', dev).catch(() => {})
    } catch (e: any) {
      showNotice(e?.message || 'Operating in Offline Queue mode', 'warn')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadBootstrap()
  }, [])

  // The native service ended the duty (notification button, expired or rejected session): refresh so the UI matches.
  useEffect(() => {
    const onDutyEnded = () => {
      showNotice('Field duty ended · location sharing stopped')
      void loadBootstrap()
    }
    window.addEventListener('swk:duty-ended', onDutyEnded)
    return () => window.removeEventListener('swk:duty-ended', onDutyEnded)
  }, [])

  /** Real GPS fix or null (with an explanation); the app never substitutes coordinates. */
  const fixOrNotice = async (required = true) => {
    try {
      return await getCurrentGpsPosition()
    } catch (e: any) {
      if (required) showNotice(e?.message || 'Could not get your location', 'warn')
      return null
    }
  }

  // Helper that executes an API call or queues it when offlineMode is enabled
  const runOrQueue = async (
    actionType: OfflineQueueItem['action_type'],
    label: string,
    endpoint: string,
    payload: Record<string, any>,
    successMsg: string
  ) => {
    if (offlineMode || !navigator.onLine) {
      enqueueOfflineAction(actionType, label, payload, endpoint)
      setOfflineQueue(getOfflineQueue())
      showNotice(`Queued Offline: ${label} (will auto-sync when connectivity returns)`, 'warn')
      return null
    }
    setBusyAction(label)
    try {
      const res = await post<any>(endpoint, payload)
      showNotice(successMsg, 'ok')
      await loadBootstrap()
      return res
    } catch (e: any) {
      showNotice(e?.message || 'Action failed', 'warn')
      return null
    } finally {
      setBusyAction(null)
    }
  }

  const handleInitializeDemoData = async () => {
    setBusyAction('Initializing SWK ONE field data…')
    try {
      await post('/api/swk-one/initialize', {})
      await loadBootstrap()
      showNotice('SWK ONE field workspace populated with live viewings, inventory, WABA & commissions.')
    } finally {
      setBusyAction(null)
    }
  }

  // 1. Office Reception QR Check-In (the QR is read from the reception screen by the camera, or its 6-digit code is typed)
  const handleOfficeScanSubmit = async (tokenOrCode: string) => {
    const dev = device || (await getDeviceIdentity())
    const coords = await fixOrNotice(false) // used for the office-area check; the server flags the check-in if it is required and missing
    setBusyAction('Verifying reception QR & device…')
    try {
      const res = await post<any>('/api/swk-one/attendance/qr-check-in', {
        qr_token: tokenOrCode,
        short_code: tokenOrCode,
        device_id: dev.device_id,
        device_name: dev.device_name,
        ...(coords ? { lat: coords.lat, lng: coords.lng, accuracy_m: coords.accuracy_m } : {}),
      })
      await loadBootstrap()
      showNotice(
        res?.verification === 'Verified'
          ? `Verified office check-in (${res.event?.event_no})`
          : `Recorded and flagged for HR review: ${(res?.doubtful_reasons || []).join(', ') || 'could not verify'}`,
        res?.verification === 'Verified' ? 'ok' : 'warn'
      )
    } catch (e: any) {
      showNotice(e?.message || 'Check-in failed', 'warn')
    } finally {
      setBusyAction(null)
    }
  }

  const handleOfficeCheckOut = async () => {
    await runOrQueue(
      'office_check_in',
      'Office Check-Out',
      '/api/swk-one/attendance/check-out',
      {},
      'Checked out of office & ended workday shift.'
    )
  }

  // 2. Workday Mode Switch
  const handleSetWorkdayMode = async (mode: 'Off Duty' | 'Office Work' | 'On Break' | 'Approved Travel' | 'Active Field Duty') => {
    await runOrQueue(
      'office_check_in',
      `Set Workday Mode: ${mode}`,
      '/api/swk-one/workday/mode',
      { mode },
      `Workday presence updated to: ${mode}`
    )
  }

  // 3. Field Duty Start / Batch / End / Safety / SOS
  const handleStartFieldDuty = async (location: string, viewingId?: number | null, propertyId?: number | null) => {
    const dev = device || (await getDeviceIdentity())
    const coords = await fixOrNotice()
    if (!coords) return
    setBusyAction('Starting field duty…')
    try {
      const res = await post<any>('/api/swk-one/field-duty/start', {
        assigned_location: location,
        viewing_id: viewingId || null,
        property_id: propertyId || null,
        lat: coords.lat,
        lng: coords.lng,
        accuracy_m: coords.accuracy_m,
        device_id: dev.device_id,
      })
      let sharing = 'Persistent location notification active'
      if (res?.session?.id) {
        const svc = await startNativeForegroundDutyService({
          sessionId: res.session.id,
          assignedLocation: location,
          deviceId: dev.device_id,
        })
        if (!svc.fgServiceActive) {
          sharing = svc.reason === 'location_permission_required'
            ? 'Allow location for SWK ONE when asked, then end and restart the duty to share live location'
            : svc.reason === 'not_native'
              ? 'Live location sharing runs in the SWK ONE Android app'
              : 'Live location sharing could not start'
        }
      }
      await loadBootstrap()
      showNotice(`Field duty started (${res?.session?.session_no}) · ${sharing}`)
    } catch (e: any) {
      showNotice(e?.message || 'Could not start field duty', 'warn')
    } finally {
      setBusyAction(null)
    }
  }

  const handleSendLocationBatch = async (sessionId: number) => {
    const coords = await fixOrNotice()
    if (!coords) return
    const tel = await getBatteryAndNetworkTelemetry()
    await runOrQueue(
      'start_field_duty',
      `Field Location Batch #${sessionId}`,
      `/api/swk-one/field-duty/${sessionId}/location-batch`,
      {
        session_id: sessionId,
        points: [
          {
            lat: coords.lat,
            lng: coords.lng,
            accuracy_m: coords.accuracy_m,
            timestamp: coords.timestamp,
          },
        ],
        ...(tel.battery_pct !== null ? { battery_pct: tel.battery_pct } : {}),
        network_type: tel.network_type,
      },
      `Location update sent (±${coords.accuracy_m}m${tel.battery_pct !== null ? ` · battery ${tel.battery_pct}%` : ''})`
    )
  }

  const handleEndFieldDuty = async (sessionId: number, notes?: string) => {
    const coords = await fixOrNotice(false)
    setBusyAction('Ending field duty…')
    try {
      await stopNativeForegroundDutyService()
      await post(`/api/swk-one/field-duty/${sessionId}/end`, {
        ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
        notes,
      })
      await loadBootstrap()
      showNotice('Field duty ended · location sharing stopped (no off-duty tracking)')
    } catch (e: any) {
      showNotice(e?.message || 'Could not end field duty', 'warn')
    } finally {
      setBusyAction(null)
    }
  }

  const handleSafetyCheckIn = async (sessionId: number) => {
    await runOrQueue(
      'start_field_duty',
      'Lone-Worker Safety Check-In',
      `/api/swk-one/field-duty/${sessionId}/safety-check-in`,
      {},
      'Lone-worker safety check-in confirmed.'
    )
  }

  const handleTriggerSos = async (reason: string) => {
    const coords = await fixOrNotice(false) // an SOS is always sent, with or without a location fix
    setBusyAction('Broadcasting SOS Alert…')
    try {
      const res = await post<any>('/api/swk-one/field-duty/sos', {
        session_id: data?.active_field_session?.id || null,
        ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
        reason,
      })
      await loadBootstrap()
      showNotice(`EMERGENCY SOS DISPATCHED (${res?.incident_no}) — Duty Manager & HR alerted`, 'warn')
    } finally {
      setBusyAction(null)
    }
  }

  // 4. One-Tap Daily Report: the narrative is yours; when empty it is composed from verified system activity only
  const handleOneTapDailyReport = async () => {
    const priorities = eodPriorities.trim()
    if (!priorities) {
      showNotice('Add at least one priority for tomorrow before submitting your report.', 'warn')
      return
    }
    const summary = eodSummary.trim() || (() => {
      const j = data?.activity_journal
      const parts = [
        [j?.sys_calls_count, 'call(s) logged'], [j?.sys_leads_contacted, 'lead(s) contacted'], [j?.sys_viewings_completed, 'viewing(s) completed'],
        [j?.sys_tasks_completed, 'task(s) completed'], [j?.sys_offers_logged, 'offer(s) logged'],
      ].filter(([n]) => Number(n) > 0).map(([n, t]) => `${n} ${t}`)
      return parts.length ? `System-recorded activity today: ${parts.join(', ')}.` : ''
    })()
    if (summary.length < 10) {
      showNotice('Write what you achieved today (at least 10 characters) before submitting your report.', 'warn')
      return
    }
    await runOrQueue(
      'daily_report',
      'End-of-Day Work Report',
      '/api/swk-one/daily-report/one-tap',
      {
        self_summary: summary,
        blockers: eodBlockers.trim() || 'None',
        next_day_priorities: priorities,
      },
      'End-of-day report submitted and checked against SWK OS activity counters.'
    )
  }

  // 5. Sync Offline Queue: only items the server accepted are removed; failures stay queued with the reason
  const handleSyncOfflineQueue = async () => {
    const current = getOfflineQueue()
    if (current.length === 0) {
      showNotice('Offline queue is already empty and synced.')
      return
    }
    setBusyAction('Syncing offline queue…')
    try {
      const dev = device || (await getDeviceIdentity())
      const res = await post<any>('/api/swk-one/offline/sync', {
        device_id: dev.device_id,
        items: [...current].reverse().map(i => ({
          client_queue_id: i.idempotency_key,
          action_type: i.action_type,
          endpoint: i.endpoint,
          payload: i.payload,
          queued_at: i.queued_at,
        })),
      })
      const results: Array<{ idempotency_key: string; status: string; error?: string }> = res?.results || []
      const remaining = removeSyncedOfflineItems(results)
      setOfflineQueue(remaining)
      const failed = results.filter(r => r.status === 'error')
      if (remaining.length === 0) setOfflineMode(false)
      await loadBootstrap()
      showNotice(
        failed.length
          ? `${results.length - failed.length} synced, ${failed.length} need attention: ${failed[0]?.error || 'rejected'}`
          : `Synced ${current.length} queued item(s) into SWK OS.`,
        failed.length ? 'warn' : 'ok'
      )
    } catch (e: any) {
      showNotice(e?.message || 'Sync failed. Your queued items are kept.', 'warn')
    } finally {
      setBusyAction(null)
    }
  }

  const activeSession = data?.active_field_session
  const briefing = data?.morning_briefing || {
    counts: { viewings_today: 0, urgent_follow_ups: 0, inventory_tasks: 0, deal_blockers: 0, unread_whatsapp: 0 },
    priorities: [],
  }
  const journal = data?.activity_journal || {
    sys_calls_count: 0,
    sys_tasks_completed: 0,
    sys_leads_contacted: 0,
    sys_viewings_completed: 0,
    sys_offers_logged: 0,
  }
  const todayAtt = data?.today_attendance
  const workday = data?.workday || { current_mode: 'Off Duty', checklist: [] }
  const activityScore = Number(data?.verified_activity_score?.total_score ?? 0)
  const activeCommunity = COMMUNITIES[pulseIndex]!
  const communityYoY = useMemo(
    () => ((activeCommunity.ppsf - activeCommunity.ppsfLY) / activeCommunity.ppsfLY) * 100,
    [activeCommunity]
  )

  // 8 Core SWK ONE Quick-Launch Tiles (matching Section 1 of the user specification & SWK OS tones)
  const quickLaunchTiles = [
    {
      id: 'office-checkin',
      label: 'Office Check-In',
      sub: todayAtt?.check_in_at ? 'Checked In ✓' : 'Scan Reception QR',
      icon: QrCode,
      badge: todayAtt?.verification_status || 'QR + Wi-Fi',
      tone: 'linear-gradient(145deg, #1b3a6b, #0b1a33)',
      iconColor: '#c9a96e',
      onClick: () => setQrModalOpen(true),
    },
    {
      id: 'field-duty',
      label: 'Field Duty',
      sub: activeSession ? 'Active GPS Session' : 'Start Duty Session',
      icon: MapPin,
      badge: activeSession ? 'LIVE GPS' : 'Off-Duty Safe',
      tone: activeSession
        ? 'linear-gradient(145deg, #1f9d6b, #115e40)'
        : 'linear-gradient(145deg, #2a9494, #145656)',
      iconColor: '#e8fbf6',
      onClick: () => setActiveTab('duty'),
    },
    {
      id: 'add-inventory',
      label: 'Add Inventory',
      sub: '60s Camera & OCR',
      icon: Building2,
      badge: `${data?.inventory_submissions?.length || 0} Units`,
      tone: 'linear-gradient(145deg, #d8bd86, #9a7a42)',
      iconColor: '#0b1a33',
      onClick: () => setActiveTab('inventory'),
    },
    {
      id: 'daily-report',
      label: 'Daily Report',
      sub: data?.today_report ? 'Submitted Today' : '1-Tap Auto Journal',
      icon: FileText,
      badge: `${journal.sys_calls_count} Calls`,
      tone: 'linear-gradient(145deg, #2c6aa8, #123a66)',
      iconColor: '#e6f0fb',
      onClick: () => {
        setActiveTab('command')
        document.getElementById('swk-one-daily-report')?.scrollIntoView({ behavior: 'smooth' })
      },
    },
    {
      id: 'my-leads',
      label: 'My Leads',
      sub: 'Priority CRM Queue',
      icon: Users,
      badge: `${data?.leads?.length || 0} Active`,
      tone: 'linear-gradient(145deg, #6a5aa0, #36295f)',
      iconColor: '#efeaff',
      onClick: () => setActiveTab('crm'),
    },
    {
      id: 'my-viewings',
      label: 'My Viewings',
      sub: 'Check-In & Feedback',
      icon: Eye,
      badge: `${briefing.counts.viewings_today} Today`,
      tone: 'linear-gradient(145deg, #1b3a6b, #0b1a33)',
      iconColor: '#dcc8a2',
      onClick: () => setActiveTab('duty'),
    },
    {
      id: 'client-messages',
      label: 'Client Messages',
      sub: 'Official WABA + AI',
      icon: MessageSquare,
      badge: `${briefing.counts.unread_whatsapp} Open`,
      tone: 'linear-gradient(145deg, #2a9494, #145656)',
      iconColor: '#e8fbf6',
      onClick: () => setActiveTab('crm'),
    },
    {
      id: 'my-commissions',
      label: 'My Commissions',
      sub: '6-Stage Payouts',
      icon: Percent,
      badge: `AED ${Math.round((data?.commission_summary?.payable_total || 0) / 1000)}k`,
      tone: 'linear-gradient(145deg, #d9694a, #8f2f19)',
      iconColor: '#fff0ea',
      onClick: () => setActiveTab('pay'),
    },
  ]

  const featuredProperties: any[] = useMemo(() => {
    const props = data?.properties || []
    if (props.length > 0) return props.slice(0, 6)
    return COMMUNITIES.slice(0, 4).map((c, idx) => ({
      id: idx + 1,
      title: `${c.name} Signature Residence`,
      property_type: idx % 2 === 0 ? 'Penthouse' : 'Villa',
      price: c.ppsf * 2100,
      area_sqft: 2100,
      bedrooms: 3,
      roi_percent: c.yieldPct,
      status: 'Available',
      rera_permit_no: `714920${idx + 1}`,
    }))
  }, [data?.properties])

  const checklistDoneCount = (workday.checklist || []).filter((i: any) => i.done).length
  const checklistTotalCount = Math.max(1, (workday.checklist || []).length)
  const checklistPct = Math.round((checklistDoneCount / checklistTotalCount) * 100)

  return (
    <div
      className={`relative min-h-screen bg-[#08142a] text-[#0b1a33] flex flex-col items-center justify-start overflow-x-hidden ${
        phoneFrameMode ? 'py-5 px-3' : ''
      }`}
    >
      {/* Ambient SWK OS Dubai Skyline & Drifting Champagne Light Backdrop (when in Handset Frame Mode) */}
      {phoneFrameMode && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden>
          <motion.div
            className="absolute inset-0 bg-cover bg-center opacity-[0.16]"
            style={{ backgroundImage: `url(${SWK_BRAND.heroDubai})` }}
            animate={reduce ? undefined : { scale: [1, 1.06, 1] }}
            transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut' }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(75% 60% at 15% 10%, rgba(29,79,134,0.45), transparent 65%), radial-gradient(65% 55% at 85% 85%, rgba(201,169,110,0.22), transparent 65%), linear-gradient(180deg, rgba(8,20,42,0.72) 0%, rgba(8,20,42,0.95) 100%)',
            }}
          />
          {!reduce && (
            <motion.div
              className="absolute rounded-full"
              style={{
                width: 480,
                height: 480,
                right: '10%',
                top: '8%',
                background: 'radial-gradient(circle, rgba(201,169,110,0.2), transparent 68%)',
              }}
              animate={{ x: [0, -35, 0], y: [0, 25, 0] }}
              transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
          <img
            src={SWK_BRAND.skylineFront}
            alt=""
            className="absolute bottom-0 left-0 right-0 w-full h-36 object-cover opacity-[0.09]"
          />
        </div>
      )}

      {/* Top Desktop Workspace Bar (only shown when previewing in Phone Frame Mode on desktop) */}
      {phoneFrameMode && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE }}
          className="relative z-10 w-full max-w-[468px] mb-3 px-4 py-2.5 rounded-2xl bg-[#0f1f3d]/85 backdrop-blur-xl border border-white/15 text-white flex items-center justify-between text-xs shadow-xl"
        >
          <div className="flex items-center gap-2.5">
            <img src={SWK_BRAND.logoWhite} alt="SWK Properties" className="h-6 w-auto" />
            <div className="h-4 w-px bg-white/20" />
            <div>
              <div className="font-bold font-display text-[12px] tracking-tight text-white flex items-center gap-1.5">
                SWK ONE
                <span className="w-1.5 h-1.5 rounded-full bg-[#4fd39a] animate-ping" />
              </div>
              <div className="text-[9.5px] uppercase tracking-[0.18em] text-[#dcc8a2]">Android Handset Studio</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Link
              to="/reception-qr"
              className="px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-[#f3ead8] text-[10.5px] font-semibold no-underline transition"
            >
              Reception QR
            </Link>
            <button
              onClick={() => setPhoneFrameMode(false)}
              className="px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white text-[10.5px] font-semibold border-0 cursor-pointer flex items-center gap-1 transition"
              title="Expand to full screen"
            >
              <Monitor size={11} /> Full View
            </button>
            <Link
              to="/home"
              className="px-2.5 py-1 rounded-full text-[#0b1a33] text-[10.5px] font-bold no-underline shadow-xs"
              style={{ background: 'linear-gradient(135deg, #f1e3c2, #c9a96e)' }}
            >
              SWK OS
            </Link>
          </div>
        </motion.div>
      )}

      {/* Main Android App Container */}
      <motion.div
        layout
        transition={{ duration: 0.35, ease: EASE }}
        className={`relative z-10 w-full bg-[#f6f2ea] flex flex-col overflow-hidden ${
          phoneFrameMode
            ? 'max-w-[468px] rounded-[42px] border-[8px] border-[#162747] shadow-[0_32px_90px_-18px_rgba(0,0,0,0.78),0_0_0_1px_rgba(201,169,110,0.32)] min-h-[880px]'
            : 'min-h-screen'
        }`}
      >
        {/* 1. Android System Status Bar + Dynamic Camera Cutout */}
        <div className="relative bg-[#08142a] text-white px-4 pt-2.5 pb-2 flex items-center justify-between text-[11px] font-medium select-none border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-[#f3ead8]">{dubaiClock} GST</span>
            <span className="px-1.5 py-0.5 rounded-md bg-white/10 text-[9.5px] font-mono text-[#dcc8a2] border border-[#c9a96e]/30">
              ae.swkproperties.one
            </span>
          </div>

          {phoneFrameMode && (
            <div
              className="hidden sm:flex items-center justify-center w-20 h-4 rounded-full bg-black/80 border border-white/10 absolute left-1/2 -translate-x-1/2"
              aria-hidden
            >
              <span className="w-2 h-2 rounded-full bg-[#14305c] ring-1 ring-white/20 mr-2" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#4fd39a]/80" />
            </div>
          )}

          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={() => setApkModalOpen(true)}
              className="px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-[10px] font-semibold text-white border border-white/15 cursor-pointer flex items-center gap-1"
            >
              {offlineMode ? (
                <WifiOff size={11} className="text-[#ffcf5c]" />
              ) : (
                <Wifi size={11} className="text-[#4fd39a]" />
              )}
              {offlineMode ? `Offline (${offlineQueue.length})` : telemetry.network_type}
            </motion.button>
            <span className="flex items-center gap-0.5 text-[10px] text-[#d6deeb] font-mono">
              <BatteryCharging size={12} className="text-[#4fd39a]" /> {telemetry.battery_pct === null ? '–' : `${telemetry.battery_pct}%`}
            </span>
            {device?.biometric_supported && (
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setBiometricLocked(true)}
                className="p-1 rounded-full bg-white/10 hover:bg-white/20 text-[#dcc8a2] border-0 cursor-pointer"
                title="Lock SWK ONE (unlock with fingerprint, face or device PIN)"
                aria-label="Lock SWK ONE"
              >
                <Lock size={11} />
              </motion.button>
            )}
            {!phoneFrameMode && (
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setPhoneFrameMode(true)}
                className="p-1 rounded-full bg-white/10 hover:bg-white/20 text-white border-0 cursor-pointer"
                title="Switch to Android Handset Frame"
              >
                <Smartphone size={11} />
              </motion.button>
            )}
          </div>
        </div>

        {/* 2. SWK ONE Luxury Hero Header (Midnight & Champagne + Dubai Skyline + Official Brand Logo) */}
        <header className="relative overflow-hidden bg-[#0b1a33] text-white px-4 pt-3.5 pb-4 space-y-3 border-b border-[#c9a96e]/30">
          {/* Animated Dubai Skyline Hero Photography & Vector Skyline Overlay */}
          <motion.div
            className="absolute inset-0 bg-cover bg-center opacity-30 pointer-events-none"
            style={{ backgroundImage: `url(${SWK_BRAND.heroDubai})`, backgroundPosition: 'center 38%' }}
            animate={reduce ? undefined : { scale: [1, 1.08, 1] }}
            transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'linear-gradient(180deg, rgba(8,20,42,0.75) 0%, rgba(11,26,51,0.88) 65%, rgba(20,48,92,0.96) 100%)',
            }}
            aria-hidden
          />
          <img
            src={SWK_BRAND.skylineFront}
            alt=""
            aria-hidden
            className="absolute left-0 right-0 bottom-0 w-full h-16 object-cover opacity-[0.14] pointer-events-none"
          />

          {/* Top Brand Identity Row */}
          <div className="relative z-10 flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <motion.div
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                className="px-2.5 py-1.5 rounded-2xl bg-white/[0.08] backdrop-blur-md border border-[#c9a96e]/40 shadow-md flex items-center justify-center shrink-0"
              >
                <img
                  src={SWK_BRAND.logoWhite}
                  alt="SWK Properties"
                  className="h-8 w-auto object-contain"
                />
              </motion.div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h1 className="text-[17px] font-bold font-display tracking-tight leading-none text-white">
                    SWK <span className="swk-shimmer-text font-extrabold">ONE</span>
                  </h1>
                  <span className="px-2 py-0.5 rounded-full bg-[#c9a96e]/20 border border-[#c9a96e]/50 text-[#f3ead8] text-[9.5px] font-bold uppercase tracking-wider">
                    Android 2.0
                  </span>
                </div>
                <p className="text-[11px] text-[#c8d3e6] mt-1 truncate">
                  <b className="text-white">{data?.user?.name || 'Staff & Agent'}</b> ·{' '}
                  <span className="text-[#dcc8a2]">{data?.agent?.rera_brn || 'RERA BRN Certified'}</span> ·{' '}
                  {data?.employee?.emp_no || 'SWK Dubai'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setQrModalOpen(true)}
                className="px-3 py-1.5 rounded-full text-[#0b1a33] font-bold text-xs border-0 cursor-pointer flex items-center gap-1.5 shadow-md"
                style={{ background: 'linear-gradient(135deg, #f1e3c2 0%, #c9a96e 100%)' }}
              >
                <QrCode size={13} /> Check-In
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => void loadBootstrap()}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-[#f3ead8] border border-white/15 cursor-pointer"
                title="Sync with SWK OS"
              >
                <RefreshCw size={13} className={loading || busyAction ? 'animate-spin text-[#c9a96e]' : ''} />
              </motion.button>
            </div>
          </div>

          {/* 3. Persistent Android Foreground Location Notification Banner OR Off-Duty Privacy Guarantee */}
          <div className="relative z-10">
            <AnimatePresence mode="wait">
              {activeSession ? (
                <motion.div
                  key="duty-active"
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className="p-3 rounded-2xl bg-[#08142a]/90 backdrop-blur-md border border-[#4fd39a]/60 text-white flex items-center justify-between gap-2.5 shadow-lg"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-[#1f9d6b]/25 border border-[#4fd39a]/50 shrink-0">
                      <span className="absolute inset-0 rounded-xl bg-[#4fd39a]/30 animate-ping" />
                      <Radio size={16} className="text-[#4fd39a] relative z-10" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold flex items-center gap-1.5 flex-wrap">
                        <span className="text-[#8fe3bd]">Foreground Duty Service Active</span>
                        <span className="px-1.5 py-0.2 rounded bg-[#c9a96e]/25 text-[#f3ead8] text-[10px] font-mono">
                          {activeSession.session_no}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#c8d3e6] truncate">
                        Live GPS: <b className="text-white">{activeSession.assigned_location}</b>
                      </div>
                    </div>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.94 }}
                    onClick={() => void handleEndFieldDuty(activeSession.id, 'Stopped from persistent banner')}
                    className="px-3 py-1.5 rounded-full bg-[#c4492f] hover:bg-[#a83820] text-white text-[11px] font-bold border-0 cursor-pointer shrink-0 shadow-xs"
                  >
                    Stop Duty
                  </motion.button>
                </motion.div>
              ) : (
                <motion.div
                  key="duty-off"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className="px-3.5 py-2 rounded-2xl bg-white/[0.08] backdrop-blur-md border border-white/15 flex items-center justify-between text-[11px]"
                >
                  <div className="flex items-center gap-2 text-[#d6deeb]">
                    <ShieldCheck size={15} className="text-[#c9a96e] shrink-0" />
                    <span>
                      <b className="text-[#f3ead8]">Privacy Shield:</b> Zero off-duty GPS tracking active.
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#c9a96e]/20 border border-[#c9a96e]/40 text-[#f3ead8] font-semibold text-[10px]">
                    {workday.current_mode}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </header>

        {/* Animated Toast / Feedback Banner */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.97 }}
              transition={{ duration: 0.25, ease: EASE }}
              className={`mx-4 mt-3 px-4 py-2.5 rounded-2xl text-xs font-semibold flex items-center justify-between shadow-md ${
                toast.tone === 'warn'
                  ? 'bg-[#fbf0d9] text-[#8c4329] border border-[#c9a96e]'
                  : 'bg-[#0b1a33] text-[#f3ead8] border border-[#c9a96e]/60'
              }`}
            >
              <span className="flex items-center gap-2">
                <Sparkles size={14} className="text-[#c9a96e] shrink-0" />
                {toast.text}
              </span>
              <button
                onClick={() => setToast(null)}
                className="text-[11px] text-[#c9a96e] underline bg-transparent border-0 cursor-pointer ml-2 shrink-0"
              >
                Dismiss
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Scrollable Content Area with Smooth Animated Tab Transitions */}
        <main className="flex-1 overflow-y-auto p-4 pb-24">
          <AnimatePresence mode="wait">
            {activeTab === 'command' && (
              <motion.div
                key="tab-command"
                variants={containerStagger}
                initial="hidden"
                animate="show"
                exit={{ opacity: 0, y: -8, transition: { duration: 0.2 } }}
                className="space-y-4"
              >
                {/* A. Agent Morning Briefing & Verified Activity Ring (SWK ONE 2.0 Priority #1) */}
                <motion.div
                  variants={cardRise}
                  className="relative overflow-hidden rounded-3xl bg-white border border-[#e7e1d4] p-4 shadow-[0_14px_34px_-22px_rgba(11,26,51,0.32)] space-y-3.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] font-bold text-[#9a7a42]">
                        <span className="w-4 h-px bg-[#c9a96e]" />
                        SWK ONE 2.0 · Daily Command Centre
                      </div>
                      <h2 className="text-[17px] font-bold font-display text-[#0b1a33] mt-0.5">
                        {briefing.greeting || 'Good day'} · Dubai Workday Briefing
                      </h2>
                      <p className="text-[11px] text-[#6b7488] mt-0.5">
                        Real-time sync with SWK Properties OS · RERA ORN 51517
                      </p>
                    </div>

                    {/* Animated Verified Activity Score Ring */}
                    <button
                      type="button"
                      onClick={() => setActiveTab('pay')}
                      className="relative w-14 h-14 rounded-2xl bg-[#fbf8f2] border border-[#e7e1d4] flex flex-col items-center justify-center shrink-0 cursor-pointer hover:border-[#c9a96e] transition"
                      title="Verified Activity Score"
                    >
                      <svg width={48} height={48} className="-rotate-90">
                        <circle cx={24} cy={24} r={19} stroke="#efe6d4" strokeWidth={4} fill="none" />
                        <motion.circle
                          cx={24}
                          cy={24}
                          r={19}
                          stroke="#14305c"
                          strokeWidth={4}
                          fill="none"
                          strokeLinecap="round"
                          strokeDasharray={2 * Math.PI * 19}
                          initial={{ strokeDashoffset: 2 * Math.PI * 19 }}
                          animate={{
                            strokeDashoffset: 2 * Math.PI * 19 * (1 - Math.min(100, activityScore) / 100),
                          }}
                          transition={{ duration: 1.2, ease: EASE }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                        <span className="text-[12px] font-extrabold font-display text-[#0b1a33]">
                          {activityScore}
                        </span>
                        <span className="text-[7.5px] uppercase tracking-wider font-bold text-[#9a7a42]">
                          Score
                        </span>
                      </div>
                    </button>
                  </div>

                  {briefing.counts.viewings_today === 0 && (data?.leads?.length || 0) === 0 && (
                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => void handleInitializeDemoData()}
                      className="w-full py-2.5 px-4 rounded-2xl text-[#0b1a33] text-xs font-bold border-0 cursor-pointer shadow-sm flex items-center justify-center gap-2"
                      style={{ background: 'linear-gradient(135deg, #f1e3c2 0%, #c9a96e 100%)' }}
                    >
                      <Sparkles size={14} /> + Populate Live Dubai Field Workspace Data
                    </motion.button>
                  )}

                  {/* 4 Animated KPI Counters */}
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <motion.button
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setActiveTab('duty')}
                      className="p-2.5 rounded-2xl text-left cursor-pointer border border-[#1d3a66] text-white shadow-xs"
                      style={{ background: 'linear-gradient(150deg, #1b3a6b 0%, #0b1a33 100%)' }}
                    >
                      <div className="text-lg font-extrabold font-display text-[#f3ead8]">
                        <AnimatedNumber value={Number(briefing.counts.viewings_today || 0)} />
                      </div>
                      <div className="text-[10px] font-semibold text-[#b8c6de]">Viewings</div>
                    </motion.button>

                    <motion.button
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setActiveTab('crm')}
                      className="p-2.5 rounded-2xl bg-[#fbf8f2] border border-[#e7e1d4] cursor-pointer text-left hover:border-[#c9a96e] transition"
                    >
                      <div className="text-lg font-extrabold font-display text-[#0b1a33]">
                        <AnimatedNumber value={Number(briefing.counts.urgent_follow_ups || 0)} />
                      </div>
                      <div className="text-[10px] font-semibold text-[#6b7488]">Follow-Ups</div>
                    </motion.button>

                    <motion.button
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setActiveTab('inventory')}
                      className="p-2.5 rounded-2xl bg-[#fbf8f2] border border-[#e7e1d4] cursor-pointer text-left hover:border-[#c9a96e] transition"
                    >
                      <div className="text-lg font-extrabold font-display text-[#14305c]">
                        <AnimatedNumber value={Number(briefing.counts.inventory_tasks || 0)} />
                      </div>
                      <div className="text-[10px] font-semibold text-[#6b7488]">Inventory</div>
                    </motion.button>

                    <motion.button
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setActiveTab('crm')}
                      className="p-2.5 rounded-2xl bg-[#fbf5e8] border border-[#e3d1ad] cursor-pointer text-left"
                    >
                      <div className="text-lg font-extrabold font-display text-[#9a7a42]">
                        <AnimatedNumber value={Number(briefing.counts.deal_blockers || 0)} />
                      </div>
                      <div className="text-[10px] font-semibold text-[#7d5f2c]">Deal Gates</div>
                    </motion.button>
                  </div>

                  {briefing.priorities?.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      {briefing.priorities.map((p: string, idx: number) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1 + idx * 0.06 }}
                          className="px-3 py-2 rounded-xl bg-[#fbf8f2] border border-[#efe9dc] text-xs text-[#0b1a33] flex items-center gap-2"
                        >
                          <Sparkles size={13} className="text-[#c9a96e] shrink-0" />
                          <span className="font-medium">{p}</span>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>

                {/* B. Live Animated Dubai Market Pulse Hero Card (Using SWK OS Community Photography) */}
                <motion.div
                  variants={cardRise}
                  className="relative h-44 rounded-3xl overflow-hidden border border-[#1d3a66] shadow-[0_18px_40px_-22px_rgba(11,26,51,0.55)] select-none"
                >
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeCommunity.id}
                      initial={{ opacity: 0, scale: 1.06 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.65, ease: EASE }}
                      className="absolute inset-0 bg-cover bg-center"
                      style={{ backgroundImage: `url(${activeCommunity.image})` }}
                    />
                  </AnimatePresence>
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        'linear-gradient(180deg, rgba(8,20,42,0.35) 0%, rgba(11,26,51,0.62) 45%, rgba(8,20,42,0.94) 100%)',
                    }}
                  />

                  <div className="relative z-10 h-full p-4 flex flex-col justify-between text-white">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#08142a]/70 backdrop-blur-md border border-[#c9a96e]/40 text-[10px] font-bold uppercase tracking-[0.16em] text-[#dcc8a2]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#4fd39a] animate-ping" />
                        DLD Market Pulse · {activeCommunity.segment}
                      </span>
                      <div className="flex items-center gap-1">
                        {COMMUNITIES.map((c, idx) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setPulseIndex(idx)}
                            aria-label={`Show ${c.name}`}
                            className="h-1.5 rounded-full border-0 cursor-pointer transition-all duration-300 p-0"
                            style={{
                              width: idx === pulseIndex ? 18 : 6,
                              background: idx === pulseIndex ? '#c9a96e' : 'rgba(255,255,255,0.32)',
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    <AnimatePresence mode="wait">
                      <motion.div
                        key={activeCommunity.name}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.35, ease: EASE }}
                      >
                        <div className="flex items-end justify-between gap-2">
                          <div>
                            <div className="text-lg font-bold font-display leading-tight text-white">
                              {activeCommunity.name}
                            </div>
                            <div className="text-[11px] text-[#d6deeb]">
                              {activeCommunity.transactionsQ.toLocaleString()} quarterly DLD transactions ·{' '}
                              {activeCommunity.offPlanShare}% off-plan
                            </div>
                          </div>
                          <span className="px-2.5 py-1 rounded-full bg-[#1f9d6b]/25 border border-[#4fd39a]/40 text-[#8fe3bd] text-xs font-bold flex items-center gap-1">
                            <TrendingUp size={12} /> +{communityYoY.toFixed(1)}% YoY
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 mt-2.5 pt-2.5 border-t border-white/15 text-xs">
                          <div>
                            <div className="text-[9.5px] uppercase tracking-wider text-white/60">Avg Price / Sqft</div>
                            <div className="font-display font-bold text-sm text-[#f3ead8]">
                              AED {activeCommunity.ppsf.toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <div className="text-[9.5px] uppercase tracking-wider text-white/60">Gross Yield</div>
                            <div className="font-display font-bold text-sm text-[#8fe3bd]">
                              {activeCommunity.yieldPct.toFixed(1)}%
                            </div>
                          </div>
                          <div>
                            <div className="text-[9.5px] uppercase tracking-wider text-white/60">1-BR Index Rent</div>
                            <div className="font-display font-bold text-sm text-white">
                              AED {(activeCommunity.rent1 / 1000).toFixed(0)}k/yr
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </motion.div>

                {/* C. 8 Core SWK ONE Quick-Launch Modules (Animated Bento Grid with SWK Tones) */}
                <motion.div variants={cardRise} className="space-y-2.5">
                  <div className="flex items-center justify-between px-1">
                    <div>
                      <span className="text-xs font-bold font-display text-[#0b1a33]">
                        SWK ONE Mobile Workspace
                      </span>
                      <span className="text-[10.5px] text-[#6b7488] block">
                        8 Native Staff & Agent Modules · Connected to SWK OS
                      </span>
                    </div>
                    <img src={SWK_BRAND.logoInk} alt="SWK" className="h-5 w-auto opacity-80" />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {quickLaunchTiles.map(tile => {
                      const Icon = tile.icon
                      return (
                        <motion.button
                          key={tile.id}
                          whileHover={{ y: -3, scale: 1.01 }}
                          whileTap={{ scale: 0.96 }}
                          onClick={tile.onClick}
                          className="p-3.5 rounded-2xl bg-white hover:bg-[#fbf8f2] border border-[#e7e1d4] hover:border-[#c9a96e] text-left transition shadow-[0_10px_24px_-18px_rgba(11,26,51,0.35)] cursor-pointer flex flex-col justify-between gap-2.5 group"
                        >
                          <div className="flex items-center justify-between w-full">
                            <div
                              className="w-10 h-10 rounded-2xl grid place-items-center shadow-sm transition-transform group-hover:scale-105"
                              style={{ background: tile.tone, color: tile.iconColor }}
                            >
                              <Icon size={19} strokeWidth={1.9} />
                            </div>
                            <span className="px-2 py-0.5 rounded-full bg-[#f3ead8] text-[#7d5f2c] text-[9.5px] font-bold">
                              {tile.badge}
                            </span>
                          </div>
                          <div>
                            <div className="font-bold font-display text-[12.5px] text-[#0b1a33] flex items-center justify-between">
                              <span>{tile.label}</span>
                              <ArrowUpRight size={12} className="text-[#9a7a42] opacity-60 group-hover:opacity-100" />
                            </div>
                            <div className="text-[10px] text-[#6b7488] mt-0.5">{tile.sub}</div>
                          </div>
                        </motion.button>
                      )
                    })}
                  </div>
                </motion.div>

                {/* D. Featured SWK Luxury Inventory Showcase (High-Res Property Photography) */}
                <motion.div variants={cardRise} className="space-y-2.5">
                  <div className="flex items-center justify-between px-1">
                    <div>
                      <span className="text-xs font-bold font-display text-[#0b1a33]">
                        Verified SWK Luxury Stock & Viewings
                      </span>
                      <span className="text-[10.5px] text-[#6b7488] block">
                        Swipe to preview high-res stock or launch client comparison
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCompareModalOpen(true)}
                      className="px-2.5 py-1 rounded-full bg-[#f3ead8] text-[#7d5f2c] text-[10.5px] font-bold border border-[#e3d1ad] cursor-pointer"
                    >
                      Compare Stock →
                    </button>
                  </div>

                  <div className="flex gap-3 overflow-x-auto pb-1.5 snap-x snap-mandatory">
                    {featuredProperties.map((prop, idx) => {
                      const imgUrl = resolvePropertyPhoto(prop.title || prop.building_name, idx)
                      return (
                        <motion.div
                          key={prop.id || idx}
                          whileHover={{ y: -2 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setCompareModalOpen(true)}
                          className="snap-start shrink-0 w-64 h-40 relative rounded-2xl overflow-hidden border border-[#e7e1d4] shadow-sm cursor-pointer group"
                        >
                          <div
                            className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                            style={{ backgroundImage: `url(${imgUrl})` }}
                          />
                          <div
                            className="absolute inset-0"
                            style={{
                              background:
                                'linear-gradient(180deg, rgba(11,26,51,0.1) 0%, rgba(11,26,51,0.88) 100%)',
                            }}
                          />
                          <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between">
                            <span className="px-2 py-0.5 rounded-full bg-[#0b1a33]/80 backdrop-blur-xs text-[#dcc8a2] text-[9.5px] font-bold border border-[#c9a96e]/40">
                              {prop.property_type || 'Luxury Unit'}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-[#1f9d6b]/90 text-white text-[9.5px] font-bold">
                              {prop.roi_percent || 6.4}% ROI
                            </span>
                          </div>
                          <div className="absolute bottom-2.5 left-3 right-3 text-white">
                            <div className="font-display font-bold text-xs truncate">{prop.title}</div>
                            <div className="flex items-center justify-between text-[11px] text-[#f3ead8] mt-0.5">
                              <span className="font-bold">AED {Number(prop.price || 4500000).toLocaleString()}</span>
                              <span className="text-[10px] text-white/75">{prop.bedrooms ?? 2} BR · {prop.area_sqft ?? 1550} sqft</span>
                            </div>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                </motion.div>

                {/* E. Office Attendance & Workday Presence Switch (Features 1, 2, 4, 49) */}
                <motion.div
                  variants={cardRise}
                  className="rounded-3xl bg-white border border-[#e7e1d4] p-4 shadow-[0_12px_28px_-20px_rgba(11,26,51,0.28)] space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="font-bold font-display text-sm text-[#0b1a33]">
                        Office Attendance & Workday Presence Switch
                      </h3>
                      <p className="text-[11px] text-[#6b7488]">
                        {todayAtt
                          ? `Verified at ${String(todayAtt.check_in_at || '').slice(11, 16) || '09:00'} via ${todayAtt.terminal_type} (${todayAtt.event_no})`
                          : 'Scan the Office Reception PC QR to log verified attendance'}
                      </p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setQrModalOpen(true)}
                        className="px-3 py-1.5 rounded-full text-white text-xs font-bold border-0 cursor-pointer shadow-xs"
                        style={{ background: 'linear-gradient(135deg, #1b3a6b, #0b1a33)' }}
                      >
                        Scan Office QR
                      </motion.button>
                      {todayAtt && !todayAtt.check_out_at && (
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => void handleOfficeCheckOut()}
                          className="px-3 py-1.5 rounded-full bg-[#c4492f] text-white text-xs font-bold border-0 cursor-pointer"
                        >
                          Check Out
                        </motion.button>
                      )}
                    </div>
                  </div>

                  {/* Animated Sliding Presence Switch */}
                  <div className="flex flex-wrap gap-1.5 p-1.5 rounded-2xl bg-[#f6f2ea] border border-[#e7e1d4]">
                    {(['Office Work', 'On Break', 'Approved Travel', 'Active Field Duty', 'Off Duty'] as const).map(
                      mode => {
                        const active = workday.current_mode === mode
                        return (
                          <button
                            key={mode}
                            onClick={() => void handleSetWorkdayMode(mode)}
                            className={`relative px-3 py-1.5 rounded-xl text-xs font-semibold border-0 cursor-pointer transition ${
                              active ? 'text-white font-bold' : 'bg-transparent text-[#3a4660] hover:text-[#0b1a33]'
                            }`}
                          >
                            {active && (
                              <motion.span
                                layoutId="swk-workday-mode-pill"
                                className="absolute inset-0 rounded-xl shadow-xs"
                                style={{ background: 'linear-gradient(135deg, #1b3a6b, #0b1a33)' }}
                                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                              />
                            )}
                            <span className="relative z-10">{mode}</span>
                          </button>
                        )
                      }
                    )}
                  </div>
                </motion.div>

                {/* F. Automatic Daily Activity Journal & One-Tap End-of-Day Report (Features 3, 4, 57, 58) */}
                <motion.div
                  variants={cardRise}
                  id="swk-one-daily-report"
                  className="rounded-3xl bg-white border border-[#e7e1d4] p-4 shadow-[0_12px_28px_-20px_rgba(11,26,51,0.28)] space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold font-display text-sm text-[#0b1a33]">
                        Automatic Daily Activity Journal & 1-Tap EOD Report
                      </h3>
                      <p className="text-[11px] text-[#6b7488]">
                        System counters auto-verify against your calls, viewings, inventory & offers
                      </p>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#f3ead8] text-[#7d5f2c] text-[10px] font-bold border border-[#e3d1ad]">
                      {data?.today_report ? `Verified (${data.today_report.report_no})` : 'Auto-Draft Ready'}
                    </span>
                  </div>

                  {/* Live Animated System Counters */}
                  <div className="grid grid-cols-5 gap-1.5 text-center">
                    {[
                      { label: 'Calls', val: journal.sys_calls_count },
                      { label: 'Leads', val: journal.sys_leads_contacted },
                      { label: 'Viewings', val: journal.sys_viewings_completed },
                      { label: 'Offers', val: journal.sys_offers_logged },
                      { label: 'Tasks', val: journal.sys_tasks_completed },
                    ].map(stat => (
                      <div key={stat.label} className="p-2 rounded-2xl bg-[#fbf8f2] border border-[#efe9dc]">
                        <div className="font-extrabold font-display text-sm text-[#14305c]">
                          <AnimatedNumber value={Number(stat.val || 0)} />
                        </div>
                        <div className="text-[10px] font-medium text-[#6b7488]">{stat.label}</div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2 text-xs">
                    <textarea
                      rows={2}
                      value={eodSummary}
                      onChange={e => setEodSummary(e.target.value)}
                      placeholder="Workday narrative (auto-filled if left blank)…"
                      className="w-full px-3 py-2 rounded-xl bg-[#fbf9f5] border border-[#d9d1c1] text-[#0b1a33] focus:outline-none focus:border-[#c9a96e]"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={eodBlockers}
                        onChange={e => setEodBlockers(e.target.value)}
                        placeholder="Blockers / Exceptions"
                        className="px-3 py-2 rounded-xl bg-[#fbf9f5] border border-[#d9d1c1] text-[#0b1a33]"
                      />
                      <input
                        type="text"
                        value={eodPriorities}
                        onChange={e => setEodPriorities(e.target.value)}
                        placeholder="Tomorrow's Top Priorities"
                        className="px-3 py-2 rounded-xl bg-[#fbf9f5] border border-[#d9d1c1] text-[#0b1a33]"
                      />
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => void handleOneTapDailyReport()}
                      className="w-full py-3 rounded-2xl text-[#0b1a33] font-bold text-xs border-0 cursor-pointer shadow-md flex items-center justify-center gap-2"
                      style={{ background: 'linear-gradient(135deg, #f1e3c2 0%, #c9a96e 55%, #b08d52 100%)' }}
                    >
                      <CheckCircle2 size={15} /> Submit 1-Tap Verified Daily Report to SWK OS
                    </motion.button>
                  </div>
                </motion.div>

                {/* G. Role-Specific Workday Checklist (Feature #6) */}
                <motion.div
                  variants={cardRise}
                  className="rounded-3xl bg-white border border-[#e7e1d4] p-4 shadow-[0_12px_28px_-20px_rgba(11,26,51,0.28)] space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold font-display text-sm text-[#0b1a33]">
                      Role-Specific Daily Workday Checklist
                    </h3>
                    <span className="text-[11px] font-bold text-[#9a7a42]">
                      {checklistDoneCount}/{(workday.checklist || []).length} Completed ({checklistPct}%)
                    </span>
                  </div>

                  {/* Animated Progress Bar */}
                  <div className="w-full h-2 rounded-full bg-[#efe9dc] overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: 'linear-gradient(90deg, #14305c, #c9a96e)' }}
                      initial={{ width: 0 }}
                      animate={{ width: `${checklistPct}%` }}
                      transition={{ duration: 0.8, ease: EASE }}
                    />
                  </div>

                  <div className="space-y-1.5 text-xs pt-1">
                    {(workday.checklist || []).map((item: any) => (
                      <motion.label
                        key={item.id}
                        whileTap={{ scale: 0.99 }}
                        className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-[#fbf8f2] border border-[#efe9dc] cursor-pointer hover:border-[#c9a96e] transition"
                      >
                        <input
                          type="checkbox"
                          className="swk-check"
                          checked={!!item.done}
                          onChange={async e => {
                            await post('/api/swk-one/workday/checklist', {
                              list_type: 'workday',
                              item_id: item.id,
                              done: e.target.checked,
                            })
                            await loadBootstrap()
                          }}
                        />
                        <span className={item.done ? 'line-through text-[#6b7488]' : 'font-semibold text-[#0b1a33]'}>
                          {item.label}
                        </span>
                        <span className="ml-auto px-2 py-0.5 rounded-full bg-[#f3ead8] text-[10px] font-semibold text-[#7d5f2c]">
                          {item.category}
                        </span>
                      </motion.label>
                    ))}
                  </div>
                </motion.div>

                {/* H. Official UAE Developer Partners Strip (Using /media/developers/logo-*.png) */}
                <motion.div
                  variants={cardRise}
                  className="rounded-3xl bg-white border border-[#e7e1d4] p-4 shadow-xs space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-[0.16em] font-bold text-[#9a7a42]">
                      SWK Authorized UAE Developer Portal & NOC Partners
                    </span>
                    <span className="text-[10px] text-[#6b7488]">{DEVELOPERS.length} DLD Developers</span>
                  </div>
                  <div className="flex items-center gap-3 overflow-x-auto py-1">
                    {DEVELOPERS.map(dev => (
                      <div
                        key={dev.name}
                        className="shrink-0 px-3 py-2 rounded-2xl bg-[#fbf8f2] border border-[#efe9dc] flex items-center gap-2"
                        title={dev.name}
                      >
                        <img src={dev.logo} alt={dev.name} className="h-5 w-auto object-contain" />
                        <span className="text-[10.5px] font-semibold text-[#0b1a33] whitespace-nowrap">
                          {dev.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </motion.div>
            )}

            {activeTab === 'duty' && (
              <motion.div
                key="tab-duty"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.32, ease: EASE }}
              >
                <DutyAndViewingsTab
                  data={data}
                  onStartDuty={handleStartFieldDuty}
                  onEndDuty={handleEndFieldDuty}
                  onSendLocationBatch={handleSendLocationBatch}
                  onSafetyCheckIn={handleSafetyCheckIn}
                  onTriggerSos={handleTriggerSos}
                  onViewingArrive={async viewingId => {
                    const coords = await fixOrNotice()
                    if (!coords) return
                    await runOrQueue(
                      'viewing_arrive',
                      `Viewing Arrival #${viewingId}`,
                      `/api/swk-one/viewings/${viewingId}/arrive`,
                      { lat: coords.lat, lng: coords.lng, accuracy_m: coords.accuracy_m },
                      `Arrival recorded. A manager reviews it if you are not at the property.`
                    )
                  }}
                  onViewingFeedback={async (viewingId, payload) => {
                    await runOrQueue(
                      'viewing_feedback',
                      `Viewing Feedback #${viewingId}`,
                      `/api/swk-one/viewings/${viewingId}/feedback`,
                      payload,
                      'Viewing outcome & structured client feedback saved!'
                    )
                  }}
                  onViewingEvent={async (viewingId, mode, note) => {
                    await runOrQueue(
                      'viewing_feedback',
                      `Viewing Event #${viewingId}`,
                      `/api/swk-one/viewings/${viewingId}/event`,
                      { mode, note },
                      `Viewing updated (${mode.replace('_', ' ')})`
                    )
                  }}
                />
              </motion.div>
            )}

            {activeTab === 'inventory' && (
              <motion.div
                key="tab-inventory"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.32, ease: EASE }}
              >
                <InventoryAndNocTab
                  data={data}
                  onCheckDuplicate={async (building, unit) => {
                    return get(
                      `/api/swk-one/inventory/check-duplicate?building=${encodeURIComponent(building)}&unit=${encodeURIComponent(unit)}`
                    )
                  }}
                  onCameraExtract={async (docType, hint) => {
                    const res = await post<any>('/api/swk-one/inventory/camera-extract', {
                      document_type: docType,
                      building_hint: hint,
                    })
                    showNotice('Camera OCR extracted Title Deed / Form A fields & verified image sharpness!')
                    return res
                  }}
                  onSubmitInventory={async payload => {
                    await runOrQueue(
                      'inventory_submit',
                      `Inventory: ${payload.building_name} #${payload.unit_no}`,
                      '/api/swk-one/inventory/submit',
                      payload,
                      `Unit ${payload.building_name} #${payload.unit_no} submitted to SWK OS pipeline!`
                    )
                  }}
                  onReconfirmPrice={async (id, askingPrice) => {
                    await runOrQueue(
                      'inventory_submit',
                      `Reconfirm Price #${id}`,
                      `/api/swk-one/inventory/${id}/reconfirm-price`,
                      { asking_price: askingPrice },
                      'Owner price & availability reconfirmed today!'
                    )
                  }}
                  onOwnerWithdraw={async (id, reason) => {
                    await runOrQueue(
                      'inventory_submit',
                      `Owner Withdrawal #${id}`,
                      `/api/swk-one/inventory/${id}/owner-withdrawal`,
                      { reason },
                      'Urgent owner withdrawal alert logged & unit suspended.'
                    )
                  }}
                  onLogKey={async payload => {
                    await runOrQueue(
                      'inventory_submit',
                      `Key Custody: ${payload.building_name}`,
                      '/api/swk-one/inventory/key-log',
                      payload,
                      'Property key custody event logged!'
                    )
                  }}
                />
              </motion.div>
            )}

            {activeTab === 'crm' && (
              <motion.div
                key="tab-crm"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.32, ease: EASE }}
              >
                <CrmAndDealsTab
                  data={data}
                  onQuickLogLead={async (leadId, outcome, channel, notes) => {
                    await runOrQueue(
                      'lead_quick_log',
                      `Lead Call Log #${leadId}`,
                      `/api/swk-one/leads/${leadId}/quick-log`,
                      { outcome, channel, notes },
                      `Logged ${channel} outcome (${outcome}) & updated CRM activity counters!`
                    )
                  }}
                  onOpenComparison={() => setCompareModalOpen(true)}
                  onSubmitOffer={async payload => {
                    await runOrQueue(
                      'inventory_submit',
                      'Submit Digital Offer',
                      '/api/swk-one/offers/submit',
                      payload,
                      'Formal Digital Offer recorded in SWK OS!'
                    )
                  }}
                  onGetAiDraft={async (commId, lang) => {
                    const res = await post<any>('/api/swk-one/communications/ai-draft', {
                      comm_id: commId,
                      language: lang,
                    })
                    return res?.draft || ''
                  }}
                  onReplyComm={async (commId, message, lang) => {
                    await runOrQueue(
                      'comm_reply',
                      `WABA Reply #${commId}`,
                      `/api/swk-one/communications/${commId}/reply`,
                      { message, language: lang },
                      'Official WABA response sent & SLA timer cleared!'
                    )
                  }}
                  onEscalateComm={async (commId, title, summary) => {
                    await runOrQueue(
                      'comm_reply',
                      `Escalate WABA #${commId}`,
                      `/api/swk-one/communications/${commId}/escalate`,
                      { title, summary, severity: 'High' },
                      'Escalated to supervisor & created QA Incident!'
                    )
                  }}
                />
              </motion.div>
            )}

            {activeTab === 'pay' && (
              <motion.div
                key="tab-pay"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.32, ease: EASE }}
              >
                <PayHrAndSecurityTab
                  data={data}
                  onRequestAttendanceCorrection={async (id, reason) => {
                    await runOrQueue(
                      'office_check_in',
                      `Attendance Correction #${id}`,
                      `/api/swk-one/attendance/${id}/correction`,
                      { reason },
                      'Attendance correction submitted for manager sign-off.'
                    )
                  }}
                  onToggleChecklist={async (listType, itemId, done) => {
                    await post('/api/swk-one/workday/checklist', {
                      list_type: listType,
                      item_id: itemId,
                      done,
                    })
                    await loadBootstrap()
                  }}
                  onShiftHandover={async (toUserId, notes) => {
                    await runOrQueue(
                      'office_check_in',
                      'Shift Handover',
                      '/api/swk-one/workday/handover',
                      { to_user_id: toUserId, notes },
                      'Shift handover assigned to next colleague!'
                    )
                  }}
                  onSubmitLeave={async payload => {
                    await runOrQueue(
                      'office_check_in',
                      'Leave Request',
                      '/api/swk-one/hr/leave-request',
                      payload,
                      'Leave request submitted to HR!'
                    )
                  }}
                  onAskKnowledge={async question => {
                    return post('/api/swk-one/knowledge/ask', { question })
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Bottom Android App Navigation Dock with Spring-Animated Pill */}
        <nav className="sticky bottom-0 z-30 bg-[#0b1a33]/95 backdrop-blur-xl border-t border-[#c9a96e]/30 px-2 pt-2 pb-2.5 grid grid-cols-5 gap-1 text-white">
          {[
            { id: 'command', label: 'Command', icon: Compass, badge: 0 },
            {
              id: 'duty',
              label: 'Duty & View',
              icon: MapPin,
              badge: activeSession ? 'LIVE' : briefing.counts.viewings_today,
            },
            {
              id: 'inventory',
              label: 'Inventory',
              icon: Building2,
              badge: data?.inventory_submissions?.length || 0,
            },
            {
              id: 'crm',
              label: 'CRM & WABA',
              icon: MessageSquare,
              badge: briefing.counts.unread_whatsapp,
            },
            { id: 'pay', label: 'Pay & HR', icon: Percent, badge: 0 },
          ].map(tab => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <motion.button
                key={tab.id}
                whileTap={{ scale: 0.92 }}
                onClick={() => setActiveTab(tab.id as SwkOneTabId)}
                className={`relative py-2 px-1 rounded-2xl flex flex-col items-center justify-center gap-0.5 border-0 cursor-pointer transition ${
                  active ? 'text-[#0b1a33] font-bold' : 'bg-transparent text-[#a9b8d2] font-medium hover:text-white'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="swk-one-bottom-nav-pill"
                    className="absolute inset-0 rounded-2xl shadow-md"
                    style={{ background: 'linear-gradient(135deg, #f1e3c2 0%, #c9a96e 100%)' }}
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  />
                )}
                <Icon size={18} className="relative z-10" />
                <span className="relative z-10 text-[10px] leading-tight">{tab.label}</span>
                {tab.badge ? (
                  <span
                    className={`absolute top-1 right-2 z-20 px-1.5 py-0.2 rounded-full text-[8.5px] font-extrabold ${
                      tab.badge === 'LIVE'
                        ? 'bg-[#1f9d6b] text-white animate-pulse'
                        : active
                          ? 'bg-[#0b1a33] text-[#f3ead8]'
                          : 'bg-[#c9a96e] text-[#0b1a33]'
                    }`}
                  >
                    {tab.badge}
                  </span>
                ) : null}
              </motion.button>
            )
          })}
        </nav>

        {/* Modals */}
        <BiometricLockModal
          open={biometricLocked}
          device={device}
          userName={data?.user?.name || 'SWK Agent'}
          onUnlock={async () => setBiometricLocked(false)}
        />

        <ReceptionQrScannerModal
          open={qrModalOpen}
          onClose={() => setQrModalOpen(false)}
          receptionQrPreview={data?.reception_qr}
          device={device}
          onScanSubmit={handleOfficeScanSubmit}
        />

        <PropertyComparisonModal
          open={compareModalOpen}
          onClose={() => setCompareModalOpen(false)}
          properties={featuredProperties}
          onSelectForOffer={() => {
            setActiveTab('crm')
          }}
        />

        <OfflineAndApkModal
          open={apkModalOpen}
          onClose={() => setApkModalOpen(false)}
          offlineQueue={offlineQueue}
          onSyncNow={handleSyncOfflineQueue}
          apiBaseUrl={apiBaseUrl}
          onSaveApiBaseUrl={url => {
            setStoredServerUrl(url)
            setApiBaseUrlState(url)
            showNotice(`Saved SWK OS server endpoint: ${url || 'Same-Origin'}`)
          }}
          device={device}
          offlineSimulated={offlineMode}
          onToggleOfflineSimulated={val => {
            setOfflineMode(val)
            showNotice(
              val
                ? 'Offline Queue Mode ENABLED — actions will queue on handset until synced.'
                : 'Online Mode restored — ready to sync queued items.',
              val ? 'warn' : 'ok'
            )
          }}
        />
      </motion.div>
    </div>
  )
}
