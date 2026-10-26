import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  QrCode, MapPin, Building2, FileText, Users, Eye, MessageSquare, Percent,
  ShieldCheck, Wifi, WifiOff, BatteryCharging, Lock, Smartphone, Monitor,
  Sparkles, RefreshCw, Compass,
} from 'lucide-react'
import { get, post } from '../lib/api'
import {
  getDeviceIdentity,
  getCurrentGpsPosition,
  getBatteryAndNetworkTelemetry,
  startNativeForegroundDutyService,
  stopNativeForegroundDutyService,
  getOfflineQueue,
  enqueueOfflineAction,
  clearAllOfflineQueue,
  authenticateBiometricSession,
  isCapacitorAndroid,
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

export default function SwkOneApp() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [toast, setToast] = useState<{ text: string; tone?: 'ok' | 'warn' } | null>(null)
  const [activeTab, setActiveTab] = useState<SwkOneTabId>('command')

  // Device & native bridge states
  const [device, setDevice] = useState<DeviceIdentity | null>(null)
  const [telemetry, setTelemetry] = useState<{ battery_pct: number; network_type: string; online: boolean }>({
    battery_pct: 94,
    network_type: '5G_WIFI_OFFICE',
    online: true,
  })
  const [offlineMode, setOfflineMode] = useState(false)
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueueItem[]>([])
  const [apiBaseUrl, setApiBaseUrlState] = useState(getStoredServerUrl())

  // Modals & frame mode
  const [phoneFrameMode, setPhoneFrameMode] = useState(() => !isCapacitorAndroid() && window.innerWidth >= 900)
  const [biometricLocked, setBiometricLocked] = useState(false)
  const [qrModalOpen, setQrModalOpen] = useState(false)
  const [compareModalOpen, setCompareModalOpen] = useState(false)
  const [apkModalOpen, setApkModalOpen] = useState(false)

  // Daily report local inputs
  const [eodSummary, setEodSummary] = useState('')
  const [eodBlockers, setEodBlockers] = useState('None — all viewings and client follow-ups logged.')
  const [eodPriorities, setEodPriorities] = useState('Follow up on Marina Gate offer & confirm Dubai Hills viewing.')

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
      // Register / heartbeat device silently once bootstrapped
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

  // Helper that executes an API call or queues it when offlineMode is enabled
  const runOrQueue = async (
    actionType: OfflineQueueItem['action_type'],
    label: string,
    endpoint: string,
    payload: Record<string, any>,
    successMsg: string
  ) => {
    if (offlineMode || !navigator.onLine) {
      enqueueOfflineAction(actionType, label, payload)
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

  // 1. Office Reception QR Check-In
  const handleOfficeScanSubmit = async (tokenOrCode: string, networkSsid: string) => {
    const dev = device || (await getDeviceIdentity())
    const coords = await getCurrentGpsPosition()
    setBusyAction('Verifying Reception QR & Device…')
    try {
      const res = await post<any>('/api/swk-one/attendance/qr-check-in', {
        qr_token: tokenOrCode,
        short_code: tokenOrCode,
        network_type: networkSsid.includes('SWK') ? 'Office Wi-Fi' : 'External Network',
        wifi_ssid: networkSsid,
        device_id: dev.device_id,
        device_name: dev.device_name,
        lat: coords.lat,
        lng: coords.lng,
      })
      await loadBootstrap()
      showNotice(
        res?.verification === 'Verified'
          ? `Verified Office Check-In (${res.event?.event_no})`
          : `Recorded with Doubtful Flag for HR Review (${res?.doubtful_reasons?.join(', ')})`,
        res?.verification === 'Verified' ? 'ok' : 'warn'
      )
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
    const coords = await getCurrentGpsPosition()
    setBusyAction('Starting Android Foreground Duty Service…')
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
      if (res?.session?.id) {
        await startNativeForegroundDutyService({
          sessionId: res.session.id,
          assignedLocation: location,
          deviceId: dev.device_id,
        })
      }
      await loadBootstrap()
      showNotice(`Field Duty Started (${res?.session?.session_no}) · Persistent Location Notification Active`)
    } finally {
      setBusyAction(null)
    }
  }

  const handleSendLocationBatch = async (sessionId: number) => {
    const coords = await getCurrentGpsPosition()
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
            recorded_at: new Date().toISOString(),
          },
        ],
        battery_pct: tel.battery_pct,
        network_type: tel.network_type,
      },
      `Batched GPS update synced (±${coords.accuracy_m}m · Battery ${tel.battery_pct}%)`
    )
  }

  const handleEndFieldDuty = async (sessionId: number, notes?: string) => {
    const coords = await getCurrentGpsPosition()
    setBusyAction('Stopping Foreground Location Service…')
    try {
      await stopNativeForegroundDutyService()
      await post(`/api/swk-one/field-duty/${sessionId}/end`, {
        lat: coords.lat,
        lng: coords.lng,
        notes,
      })
      await loadBootstrap()
      showNotice('Field Duty Ended · Android Location Service Stopped (Zero Off-Duty Tracking)')
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
    const coords = await getCurrentGpsPosition()
    setBusyAction('Broadcasting SOS Alert…')
    try {
      const res = await post<any>('/api/swk-one/field-duty/sos', {
        session_id: data?.active_field_session?.id || null,
        lat: coords.lat,
        lng: coords.lng,
        reason,
      })
      await loadBootstrap()
      showNotice(`EMERGENCY SOS DISPATCHED (${res?.incident_no}) — Duty Manager & HR alerted`, 'warn')
    } finally {
      setBusyAction(null)
    }
  }

  // 4. One-Tap Daily Report
  const handleOneTapDailyReport = async () => {
    await runOrQueue(
      'daily_report',
      'End-of-Day Work Report',
      '/api/swk-one/daily-report/one-tap',
      {
        self_summary:
          eodSummary ||
          'Completed Marina Gate & Downtown viewings, verified 2 owner mandates, and responded to WABA inquiries.',
        blockers: eodBlockers,
        next_day_priorities: eodPriorities,
      },
      'End-of-Day Report verified & synced with SWK OS system counters!'
    )
  }

  // 5. Sync Offline Queue
  const handleSyncOfflineQueue = async () => {
    const current = getOfflineQueue()
    if (current.length === 0) {
      showNotice('Offline queue is already empty and synced.')
      return
    }
    setBusyAction('Syncing encrypted offline queue…')
    try {
      const dev = device || (await getDeviceIdentity())
      await post('/api/swk-one/offline/sync', {
        device_id: dev.device_id,
        items: current.map(i => ({
          client_queue_id: i.idempotency_key,
          action_type: i.action_type,
          payload: i.payload,
        })),
      })
      clearAllOfflineQueue()
      setOfflineQueue(getOfflineQueue())
      setOfflineMode(false)
      await loadBootstrap()
      showNotice(`Synced ${current.length} offline queued item(s) into SWK OS!`)
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

  // 8 Core SWK ONE Quick-Launch Tiles (matching Section 1 of the user specification)
  const quickLaunchTiles = [
    {
      id: 'office-checkin',
      label: 'Office Check-In',
      sub: todayAtt?.check_in_at ? 'Checked In ✓' : 'Scan Reception QR',
      icon: QrCode,
      badge: todayAtt?.verification_status || 'QR + Wi-Fi',
      onClick: () => setQrModalOpen(true),
    },
    {
      id: 'field-duty',
      label: 'Field Duty',
      sub: activeSession ? 'Active Session' : 'Start Duty Session',
      icon: MapPin,
      badge: activeSession ? 'LIVE GPS' : 'Off-Duty Safe',
      onClick: () => setActiveTab('duty'),
    },
    {
      id: 'add-inventory',
      label: 'Add Inventory',
      sub: '60s Camera & OCR',
      icon: Building2,
      badge: `${data?.inventory_submissions?.length || 0} Units`,
      onClick: () => setActiveTab('inventory'),
    },
    {
      id: 'daily-report',
      label: 'Daily Report',
      sub: data?.today_report ? 'Submitted Today' : '1-Tap Auto Journal',
      icon: FileText,
      badge: `${journal.sys_calls_count} Calls`,
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
      onClick: () => setActiveTab('crm'),
    },
    {
      id: 'my-viewings',
      label: 'My Viewings',
      sub: 'Check-In & Feedback',
      icon: Eye,
      badge: `${briefing.counts.viewings_today} Today`,
      onClick: () => setActiveTab('duty'),
    },
    {
      id: 'client-messages',
      label: 'Client Messages',
      sub: 'Official WABA + AI',
      icon: MessageSquare,
      badge: `${briefing.counts.unread_whatsapp} Open`,
      onClick: () => setActiveTab('crm'),
    },
    {
      id: 'my-commissions',
      label: 'My Commissions',
      sub: '6-Stage Payouts',
      icon: Percent,
      badge: `AED ${Math.round((data?.commission_summary?.payable_total || 0) / 1000)}k`,
      onClick: () => setActiveTab('pay'),
    },
  ]

  return (
    <div
      className={`min-h-screen bg-[#161d1a] text-[#161d1a] flex flex-col items-center justify-start ${
        phoneFrameMode ? 'py-6 px-3' : ''
      }`}
    >
      {/* Top Desktop Workspace Bar (only shown when previewing in Phone Frame Mode on desktop) */}
      {phoneFrameMode && (
        <div className="w-full max-w-[460px] mb-3 px-4 py-2.5 rounded-2xl bg-[#1e2824] border border-white/10 text-white flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#34d399]" />
            <span className="font-bold font-display">SWK ONE · Native Android Workspace</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/reception-qr"
              className="px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/15 text-[#d3eee0] text-[11px] font-semibold no-underline"
            >
              Reception QR Kiosk
            </Link>
            <button
              onClick={() => setPhoneFrameMode(false)}
              className="px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/15 text-white text-[11px] font-semibold border-0 cursor-pointer flex items-center gap-1"
              title="Expand to full screen"
            >
              <Monitor size={12} /> Full Screen
            </button>
            <Link
              to="/home"
              className="px-2.5 py-1 rounded-full bg-[#007b52] text-white text-[11px] font-semibold no-underline"
            >
              SWK OS Admin
            </Link>
          </div>
        </div>
      )}

      {/* Main Android App Container */}
      <div
        className={`w-full bg-[#f1f6f3] flex flex-col overflow-hidden ${
          phoneFrameMode
            ? 'max-w-[460px] rounded-[38px] border-[7px] border-[#26332d] shadow-2xl min-h-[860px]'
            : 'min-h-screen'
        }`}
      >
        {/* 1. Android System Status Bar */}
        <div className="bg-[#025e3d] text-white px-4 pt-2.5 pb-2 flex items-center justify-between text-[11px] font-medium select-none">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold">
              {new Date().toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit', hour12: false })} GST
            </span>
            <span className="px-1.5 py-0.2 rounded bg-white/15 text-[10px] font-mono">
              ae.swkproperties.one
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setApkModalOpen(true)}
              className="px-2 py-0.5 rounded-full bg-white/15 hover:bg-white/25 text-[10px] font-semibold text-white border-0 cursor-pointer flex items-center gap-1"
            >
              {offlineMode ? <WifiOff size={11} className="text-[#fde047]" /> : <Wifi size={11} />}
              {offlineMode ? `Offline (${offlineQueue.length})` : telemetry.network_type}
            </button>
            <span className="flex items-center gap-0.5 text-[10px]">
              <BatteryCharging size={12} /> {telemetry.battery_pct}%
            </span>
            <button
              onClick={() => setBiometricLocked(true)}
              className="p-1 rounded-full bg-white/15 hover:bg-white/25 text-white border-0 cursor-pointer"
              title="Lock with Android Biometrics"
            >
              <Lock size={11} />
            </button>
            {!phoneFrameMode && (
              <button
                onClick={() => setPhoneFrameMode(true)}
                className="p-1 rounded-full bg-white/15 hover:bg-white/25 text-white border-0 cursor-pointer"
                title="Switch to Android Handset Frame"
              >
                <Smartphone size={11} />
              </button>
            )}
          </div>
        </div>

        {/* 2. SWK ONE App Top Header */}
        <header className="bg-gradient-to-b from-[#025e3d] to-[#007b52] text-white px-4 pt-2 pb-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-white text-[#007b52] font-extrabold font-display text-sm grid place-items-center shadow-sm">
                SWK
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="text-base font-extrabold font-display tracking-tight leading-none">
                    SWK ONE
                  </h1>
                  <span className="px-2 py-0.5 rounded-full bg-white/15 text-[10px] font-bold uppercase tracking-wider">
                    Android 2.0
                  </span>
                </div>
                <p className="text-[11px] text-[#d3eee0] mt-0.5">
                  {data?.user?.name || 'Staff & Agent'} · {data?.agent?.rera_brn || 'RERA Certified'} · {data?.employee?.emp_no || 'SWK Staff'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setQrModalOpen(true)}
                className="px-3 py-1.5 rounded-full bg-white text-[#025e3d] font-bold text-xs border-0 cursor-pointer flex items-center gap-1 shadow-xs"
              >
                <QrCode size={13} /> Check-In
              </button>
              <button
                onClick={() => void loadBootstrap()}
                className="p-2 rounded-full bg-white/15 hover:bg-white/25 text-white border-0 cursor-pointer"
                title="Sync with SWK OS"
              >
                <RefreshCw size={13} className={loading || busyAction ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* 3. Persistent Android Foreground Location Notification Banner OR Off-Duty Privacy Guarantee */}
          {activeSession ? (
            <div className="p-3 rounded-2xl bg-[#161d1a]/90 border border-[#34d399]/50 text-white flex items-center justify-between gap-2 shadow-md">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-[#34d399] animate-ping shrink-0" />
                <div>
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <span>Android Foreground Service Active</span>
                    <span className="px-1.5 py-0.2 rounded bg-[#007b52] text-[10px]">
                      {activeSession.session_no}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#d3eee0]">
                    Sharing live duty location: <b>{activeSession.assigned_location}</b>
                  </div>
                </div>
              </div>
              <button
                onClick={() => void handleEndFieldDuty(activeSession.id, 'Stopped from persistent banner')}
                className="px-3 py-1.5 rounded-full bg-[#c32135] text-white text-[11px] font-bold border-0 cursor-pointer shrink-0"
              >
                Stop Sharing
              </button>
            </div>
          ) : (
            <div className="px-3 py-2 rounded-xl bg-white/10 border border-white/15 flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-2 text-[#d3eee0]">
                <ShieldCheck size={14} className="text-[#34d399] shrink-0" />
                <span>
                  <b>Privacy Guarantee:</b> Off-duty GPS tracking is strictly disabled.
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-white/15 text-white font-semibold text-[10px]">
                {workday.current_mode}
              </span>
            </div>
          )}
        </header>

        {/* Toast / Feedback Banner */}
        {toast && (
          <div
            className={`mx-4 mt-3 px-3.5 py-2.5 rounded-2xl text-xs font-semibold flex items-center justify-between shadow-sm ${
              toast.tone === 'warn'
                ? 'bg-[#f6e9c3] text-[#8c4329] border border-[#8c4329]/30'
                : 'bg-[#dcf1e6] text-[#025e3d] border border-[#007b52]/30'
            }`}
          >
            <span>{toast.text}</span>
            <button
              onClick={() => setToast(null)}
              className="text-[11px] underline bg-transparent border-0 cursor-pointer text-current ml-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Main Scrollable Content Area */}
        <main className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
          {activeTab === 'command' && (
            <>
              {/* A. Agent Morning Briefing Card (SWK ONE 2.0 Priority #1) */}
              <div className="rounded-2xl bg-white border border-[#e6ebe7] p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider font-bold text-[#007b52]">
                      SWK ONE 2.0 · Daily Command Centre
                    </div>
                    <h2 className="text-base font-bold font-display text-[#161d1a]">
                      {briefing.greeting || 'Good day'} · Dubai Workday Briefing
                    </h2>
                  </div>
                  {(briefing.counts.viewings_today === 0 && (data?.leads?.length || 0) === 0) && (
                    <button
                      onClick={() => void handleInitializeDemoData()}
                      className="px-3 py-1.5 rounded-full bg-[#007b52] text-white text-[11px] font-bold border-0 cursor-pointer shadow-xs"
                    >
                      + Load Sample Field Data
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-2 text-center">
                  <button
                    onClick={() => setActiveTab('duty')}
                    className="p-2.5 rounded-xl bg-[#edf5f0] border border-[#007b52]/20 cursor-pointer text-left"
                  >
                    <div className="text-lg font-extrabold font-display text-[#007b52]">
                      {briefing.counts.viewings_today}
                    </div>
                    <div className="text-[10px] font-semibold text-[#3f4f47]">Viewings</div>
                  </button>
                  <button
                    onClick={() => setActiveTab('crm')}
                    className="p-2.5 rounded-xl bg-[#f1f6f3] border border-[#e6ebe7] cursor-pointer text-left"
                  >
                    <div className="text-lg font-extrabold font-display text-[#161d1a]">
                      {briefing.counts.urgent_follow_ups}
                    </div>
                    <div className="text-[10px] font-semibold text-[#53655b]">Follow-Ups</div>
                  </button>
                  <button
                    onClick={() => setActiveTab('inventory')}
                    className="p-2.5 rounded-xl bg-[#f1f6f3] border border-[#e6ebe7] cursor-pointer text-left"
                  >
                    <div className="text-lg font-extrabold font-display text-[#161d1a]">
                      {briefing.counts.inventory_tasks}
                    </div>
                    <div className="text-[10px] font-semibold text-[#53655b]">Inventory</div>
                  </button>
                  <button
                    onClick={() => setActiveTab('crm')}
                    className="p-2.5 rounded-xl bg-[#f1f6f3] border border-[#e6ebe7] cursor-pointer text-left"
                  >
                    <div className="text-lg font-extrabold font-display text-[#8c4329]">
                      {briefing.counts.deal_blockers}
                    </div>
                    <div className="text-[10px] font-semibold text-[#53655b]">Deal Gates</div>
                  </button>
                </div>

                {briefing.priorities?.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {briefing.priorities.map((p: string, idx: number) => (
                      <div
                        key={idx}
                        className="px-3 py-2 rounded-xl bg-[#f1f6f3] text-xs text-[#161d1a] flex items-center gap-2"
                      >
                        <Sparkles size={13} className="text-[#007b52] shrink-0" />
                        <span>{p}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* B. 8 Core SWK ONE Quick-Launch Modules (Section 1 Specification) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold font-display text-[#161d1a]">
                    SWK ONE Mobile Workspace Modules
                  </span>
                  <span className="text-[11px] text-[#53655b]">Connected to SWK Properties OS</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {quickLaunchTiles.map(tile => {
                    const Icon = tile.icon
                    return (
                      <button
                        key={tile.id}
                        onClick={tile.onClick}
                        className="p-3.5 rounded-2xl bg-white hover:bg-[#edf5f0] border border-[#e6ebe7] hover:border-[#007b52]/40 text-left transition shadow-xs cursor-pointer flex flex-col justify-between gap-2"
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="w-9 h-9 rounded-xl bg-[#edf5f0] text-[#007b52] grid place-items-center">
                            <Icon size={18} />
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-[#f1f6f3] text-[#025e3d] text-[10px] font-bold">
                            {tile.badge}
                          </span>
                        </div>
                        <div>
                          <div className="font-bold font-display text-xs text-[#161d1a]">{tile.label}</div>
                          <div className="text-[10px] text-[#53655b] mt-0.5">{tile.sub}</div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* C. Office Attendance & Workday Presence Switch (Features 1, 2, 4, 49) */}
              <div className="rounded-2xl bg-white border border-[#e6ebe7] p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold font-display text-sm text-[#161d1a]">
                      Office Attendance & Workday Presence Switch
                    </h3>
                    <p className="text-[11px] text-[#53655b]">
                      {todayAtt
                        ? `Checked in at ${String(todayAtt.check_in_at || '').slice(11, 16) || '09:00'} via ${todayAtt.terminal_type} (${todayAtt.event_no})`
                        : 'Not checked into office reception yet today'}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setQrModalOpen(true)}
                      className="px-3 py-1.5 rounded-full bg-[#007b52] text-white text-xs font-bold border-0 cursor-pointer"
                    >
                      Scan Office QR
                    </button>
                    {todayAtt && !todayAtt.check_out_at && (
                      <button
                        onClick={() => void handleOfficeCheckOut()}
                        className="px-3 py-1.5 rounded-full bg-[#161d1a] text-white text-xs font-bold border-0 cursor-pointer"
                      >
                        Check Out
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {(['Office Work', 'On Break', 'Approved Travel', 'Active Field Duty', 'Off Duty'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => void handleSetWorkdayMode(mode)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border cursor-pointer transition ${
                        workday.current_mode === mode
                          ? 'bg-[#007b52] text-white border-[#007b52]'
                          : 'bg-[#f1f6f3] text-[#3f4f47] border-[#cbd6ce]'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* D. Automatic Daily Activity Journal & One-Tap End-of-Day Report (Features 3, 4, 57, 58) */}
              <div
                id="swk-one-daily-report"
                className="rounded-2xl bg-white border border-[#e6ebe7] p-4 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold font-display text-sm text-[#161d1a]">
                      Automatic Daily Activity Journal & 1-Tap EOD Report
                    </h3>
                    <p className="text-[11px] text-[#53655b]">
                      System counters auto-verify against your calls, viewings, inventory & offers
                    </p>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#dcf1e6] text-[#025e3d] text-[10px] font-bold">
                    {data?.today_report ? `Verified (${data.today_report.report_no})` : 'Auto-Draft Ready'}
                  </span>
                </div>

                {/* Live System Counters */}
                <div className="grid grid-cols-5 gap-1.5 text-center">
                  <div className="p-2 rounded-xl bg-[#f1f6f3]">
                    <div className="font-extrabold text-sm text-[#007b52]">{journal.sys_calls_count}</div>
                    <div className="text-[10px] text-[#53655b]">Calls</div>
                  </div>
                  <div className="p-2 rounded-xl bg-[#f1f6f3]">
                    <div className="font-extrabold text-sm text-[#007b52]">{journal.sys_leads_contacted}</div>
                    <div className="text-[10px] text-[#53655b]">Leads</div>
                  </div>
                  <div className="p-2 rounded-xl bg-[#f1f6f3]">
                    <div className="font-extrabold text-sm text-[#007b52]">{journal.sys_viewings_completed}</div>
                    <div className="text-[10px] text-[#53655b]">Viewings</div>
                  </div>
                  <div className="p-2 rounded-xl bg-[#f1f6f3]">
                    <div className="font-extrabold text-sm text-[#007b52]">{journal.sys_offers_logged}</div>
                    <div className="text-[10px] text-[#53655b]">Offers</div>
                  </div>
                  <div className="p-2 rounded-xl bg-[#f1f6f3]">
                    <div className="font-extrabold text-sm text-[#007b52]">{journal.sys_tasks_completed}</div>
                    <div className="text-[10px] text-[#53655b]">Tasks</div>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <textarea
                    rows={2}
                    value={eodSummary}
                    onChange={e => setEodSummary(e.target.value)}
                    placeholder="Workday narrative (auto-filled if left blank)…"
                    className="w-full px-3 py-2 rounded-xl border border-[#cbd6ce]"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={eodBlockers}
                      onChange={e => setEodBlockers(e.target.value)}
                      placeholder="Blockers / Exceptions"
                      className="px-3 py-2 rounded-xl border border-[#cbd6ce]"
                    />
                    <input
                      type="text"
                      value={eodPriorities}
                      onChange={e => setEodPriorities(e.target.value)}
                      placeholder="Tomorrow's Top Priorities"
                      className="px-3 py-2 rounded-xl border border-[#cbd6ce]"
                    />
                  </div>
                  <button
                    onClick={() => void handleOneTapDailyReport()}
                    className="w-full py-3 rounded-full bg-[#007b52] hover:bg-[#025e3d] text-white font-bold text-xs border-0 cursor-pointer shadow-xs"
                  >
                    ✓ Submit 1-Tap Verified Daily Report to SWK OS
                  </button>
                </div>
              </div>

              {/* E. Role-Specific Workday Checklist (Feature #6) */}
              <div className="rounded-2xl bg-white border border-[#e6ebe7] p-4 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold font-display text-sm text-[#161d1a]">
                    Role-Specific Daily Workday Checklist
                  </h3>
                  <span className="text-[11px] font-semibold text-[#007b52]">
                    {(workday.checklist || []).filter((i: any) => i.done).length}/{(workday.checklist || []).length} Done
                  </span>
                </div>
                <div className="space-y-1.5 text-xs">
                  {(workday.checklist || []).map((item: any) => (
                    <label
                      key={item.id}
                      className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#f1f6f3] cursor-pointer"
                    >
                      <input
                        type="checkbox"
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
                      <span className={item.done ? 'line-through text-[#53655b]' : 'font-semibold text-[#161d1a]'}>
                        {item.label}
                      </span>
                      <span className="ml-auto px-2 py-0.5 rounded-full bg-white text-[10px] text-[#53655b]">
                        {item.category}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === 'duty' && (
            <DutyAndViewingsTab
              data={data}
              onStartDuty={handleStartFieldDuty}
              onEndDuty={handleEndFieldDuty}
              onSendLocationBatch={handleSendLocationBatch}
              onSafetyCheckIn={handleSafetyCheckIn}
              onTriggerSos={handleTriggerSos}
              onViewingArrive={async viewingId => {
                const coords = await getCurrentGpsPosition()
                await runOrQueue(
                  'viewing_arrive',
                  `Viewing Arrival #${viewingId}`,
                  `/api/swk-one/viewings/${viewingId}/arrive`,
                  { lat: coords.lat, lng: coords.lng },
                  `Verified GPS Viewing Check-In recorded!`
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
          )}

          {activeTab === 'inventory' && (
            <InventoryAndNocTab
              data={data}
              onCheckDuplicate={async (building, unit) => {
                return get(`/api/swk-one/inventory/check-duplicate?building=${encodeURIComponent(building)}&unit=${encodeURIComponent(unit)}`)
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
          )}

          {activeTab === 'crm' && (
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
          )}

          {activeTab === 'pay' && (
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
          )}
        </main>

        {/* Bottom Android App Navigation Bar */}
        <nav className="sticky bottom-0 z-30 bg-white border-t border-[#e6ebe7] px-2 py-1.5 grid grid-cols-5 gap-1">
          {[
            { id: 'command', label: 'Command', icon: Compass, badge: 0 },
            { id: 'duty', label: 'Duty & View', icon: MapPin, badge: activeSession ? 'LIVE' : briefing.counts.viewings_today },
            { id: 'inventory', label: 'Inventory', icon: Building2, badge: data?.inventory_submissions?.length || 0 },
            { id: 'crm', label: 'CRM & WABA', icon: MessageSquare, badge: briefing.counts.unread_whatsapp },
            { id: 'pay', label: 'Pay & HR', icon: Percent, badge: 0 },
          ].map(tab => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as SwkOneTabId)}
                className={`relative py-2 px-1 rounded-2xl flex flex-col items-center justify-center gap-0.5 border-0 cursor-pointer transition ${
                  active ? 'bg-[#edf5f0] text-[#007b52] font-bold' : 'bg-transparent text-[#53655b] font-medium'
                }`}
              >
                <Icon size={18} />
                <span className="text-[10px] leading-tight">{tab.label}</span>
                {tab.badge ? (
                  <span
                    className={`absolute top-1 right-2 px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                      tab.badge === 'LIVE' ? 'bg-[#007b52] text-white' : 'bg-[#025e3d] text-white'
                    }`}
                  >
                    {tab.badge}
                  </span>
                ) : null}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Modals */}
      <BiometricLockModal
        open={biometricLocked}
        device={device}
        userName={data?.user?.name || 'SWK Agent'}
        onUnlock={async () => {
          const res = await authenticateBiometricSession()
          if (res.verified) {
            setBiometricLocked(false)
            showNotice(`Android Biometric Session Verified (${res.method})`)
          }
        }}
      />

      <ReceptionQrScannerModal
        open={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        device={device}
        receptionQrPreview={data?.reception_qr}
        onScanSubmit={handleOfficeScanSubmit}
      />

      <PropertyComparisonModal
        open={compareModalOpen}
        onClose={() => setCompareModalOpen(false)}
        properties={data?.properties || []}
        onSelectForOffer={() => setActiveTab('crm')}
      />

      <OfflineAndApkModal
        open={apkModalOpen}
        onClose={() => setApkModalOpen(false)}
        device={device}
        offlineQueue={offlineQueue}
        offlineSimulated={offlineMode}
        onToggleOfflineSimulated={(val: boolean) => {
          setOfflineMode(val)
          showNotice(
            val
              ? 'Offline Mode Enabled — All actions will be queued locally on handset'
              : 'Online Mode Restored — Ready to sync queued actions to SWK OS',
            val ? 'warn' : 'ok'
          )
        }}
        onSyncNow={handleSyncOfflineQueue}
        serverUrl={apiBaseUrl}
        onSaveServerUrl={(url: string) => {
          setStoredServerUrl(url)
          setApiBaseUrlState(url)
          showNotice(`SWK OS Backend URL updated`)
        }}
      />
    </div>
  )
}
