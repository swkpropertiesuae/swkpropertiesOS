import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import QRCode from 'qrcode'
import { ShieldCheck, RefreshCw, Smartphone, Wifi, Clock, CheckCircle2, AlertTriangle, Building2, QrCode, Users } from 'lucide-react'
import { get, post } from '../../lib/api'
import { useToast } from '../../lib/toast'
import { Loading } from '../../ui/kit'

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
        dark: '#161d1a',
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
      toast.err(e?.message || 'Check-in failed')
    } finally {
      setSimulatingScan(false)
    }
  }

  if (qrQuery.isLoading && !data) return <Loading label="Starting Office Reception QR Terminal…" />

  return (
    <div className="max-w-6xl mx-auto py-4 px-4 space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl bg-[#025e3d] text-white p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-xs font-semibold tracking-wide uppercase">
            <QrCode size={14} /> Controlled Physical Verification Point · Zero Extra Hardware
          </div>
          <h1 className="text-2xl font-bold font-display tracking-tight">
            SWK Properties — Office Reception Check-In Terminal
          </h1>
          <p className="text-sm text-[#d3eee0] max-w-2xl">
            Employees open the <b>SWK ONE Android App</b>, unlock with device biometrics, and scan this rotating short-lived QR code upon entering the office.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/swk-one"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white text-[#161d1a] font-semibold text-sm hover:bg-[#f1f6f3] transition"
          >
            <Smartphone size={16} className="text-[#007b52]" />
            Open SWK ONE Android Workspace
          </Link>
          <button
            onClick={() => void qc.invalidateQueries({ queryKey: ['reception-qr-current'] })}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/15 text-white font-semibold text-sm hover:bg-white/25 transition cursor-pointer border-0"
          >
            <RefreshCw size={15} /> Refresh Token
          </button>
        </div>
      </div>

      {/* Main Grid: Rotating QR Terminal + Live Verified Attendance Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: QR Display Card */}
        <div className="lg:col-span-5 rounded-2xl bg-white border border-[#e6ebe7] p-6 shadow-xs flex flex-col items-center text-center space-y-5">
          <div className="w-full flex items-center justify-between text-xs font-semibold text-[#53655b] border-b border-[#e6ebe7] pb-3">
            <span className="inline-flex items-center gap-1.5 text-[#161d1a]">
              <Building2 size={15} className="text-[#007b52]" />
              {data?.branch?.name || 'Dubai – Head Office'}
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#edf5f0] text-[#007b52]">
              <Clock size={13} /> Rotates in {countdown}s
            </span>
          </div>

          {/* QR Image Container */}
          <div className="relative p-4 rounded-2xl bg-[#f1f6f3] border-2 border-[#007b52]/30 shadow-inner">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="SWK Office Reception Attendance QR Code"
                className="w-64 h-64 rounded-xl bg-white p-2"
              />
            ) : (
              <div className="w-64 h-64 grid place-items-center text-sm text-[#53655b]">Generating QR…</div>
            )}
            <div className="mt-2 text-[11px] font-mono text-[#53655b]">
              TOKEN: {data?.token_code}
            </div>
          </div>

          {/* Manual 6-digit Backup Code */}
          <div className="w-full rounded-xl bg-[#f1f6f3] p-4 border border-[#e6ebe7]">
            <div className="text-xs uppercase tracking-wider text-[#53655b] font-semibold">
              Reception Terminal 6-Digit Verification Code
            </div>
            <div className="text-3xl font-extrabold font-display tracking-[0.25em] text-[#161d1a] mt-1">
              {data?.short_code || '------'}
            </div>
            <div className="text-xs text-[#53655b] mt-1">
              Valid only with enrolled SWK ONE Android device & office network evidence
            </div>
          </div>

          {/* Security Evidence Pills */}
          <div className="w-full grid grid-cols-2 gap-2.5 text-left">
            <div className="p-3 rounded-xl bg-[#edf5f0] border border-[#cbd6ce]/60">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#007b52]">
                <Wifi size={14} /> Office Network
              </div>
              <div className="text-xs text-[#161d1a] mt-0.5 truncate">
                {data?.office_network_hint || 'SWK-CORP-WIFI-DXB'}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[#edf5f0] border border-[#cbd6ce]/60">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#007b52]">
                <ShieldCheck size={14} /> Device Binding
              </div>
              <div className="text-xs text-[#161d1a] mt-0.5">
                Enrolled Android Handsets
              </div>
            </div>
          </div>

          <button
            onClick={simulateEmployeeScan}
            disabled={simulatingScan}
            className="w-full py-3 px-4 rounded-full bg-[#007b52] hover:bg-[#025e3d] text-white font-semibold text-sm transition cursor-pointer border-0 flex items-center justify-center gap-2"
          >
            <Smartphone size={16} />
            {simulatingScan ? 'Verifying QR & Device…' : 'Test Scan with Current Logged-in Account'}
          </button>
        </div>

        {/* Right: Live Verified Check-Ins & 4-Factor Validation Rules */}
        <div className="lg:col-span-7 space-y-5">
          <div className="rounded-2xl bg-white border border-[#e6ebe7] p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-[#007b52]" />
                <h2 className="text-lg font-bold font-display text-[#161d1a]">
                  Today’s Verified Reception Check-Ins
                </h2>
              </div>
              <span className="px-3 py-1 rounded-full bg-[#edf5f0] text-[#007b52] text-xs font-semibold">
                {data?.today_checkins?.length || 0} Recorded Today
              </span>
            </div>

            {!data?.today_checkins?.length ? (
              <div className="p-8 rounded-xl bg-[#f1f6f3] text-center space-y-2">
                <div className="text-sm font-semibold text-[#161d1a]">No office QR scans recorded yet today</div>
                <p className="text-xs text-[#53655b]">
                  Scan the QR code from the SWK ONE Android app or click "Test Scan" on the left to verify the attendance pipeline.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#e6ebe7]">
                {data.today_checkins.map((row: any) => (
                  <div key={row.id} className="py-3.5 flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#161d1a]">
                          {row.employee_name || `Employee #${row.employee_id}`}
                        </span>
                        <span className="text-xs font-mono text-[#53655b]">{row.event_no}</span>
                      </div>
                      <div className="text-xs text-[#53655b]">
                        Method: <b>{row.terminal_type}</b> · Shift: {row.shift_name}
                      </div>
                      {row.notes && <div className="text-[11px] text-[#53655b]">{row.notes}</div>}
                    </div>
                    <div className="text-right space-y-1">
                      <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#dcf1e6] text-[#025e3d]">
                        {row.manager_verified ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                        {row.duty_status}
                      </div>
                      <div className="text-xs font-mono text-[#53655b]">
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
          <div className="rounded-2xl bg-white border border-[#e6ebe7] p-6 shadow-xs space-y-3">
            <h3 className="text-base font-bold font-display text-[#161d1a]">
              How SWK ONE 4-Point Office Attendance Verification Works
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[#3f4f47]">
              <div className="p-3.5 rounded-xl bg-[#f1f6f3]">
                <b className="text-[#161d1a] block mb-1">1. Enrolled Android Handset</b>
                Each employee’s SWK ONE app binds to their registered Android device ID and requires biometric/device-credential unlock.
              </div>
              <div className="p-3.5 rounded-xl bg-[#f1f6f3]">
                <b className="text-[#161d1a] block mb-1">2. Short-Lived Reception QR</b>
                This reception screen rotates its cryptographic token every 60 seconds so photos of old QR codes cannot be reused remotely.
              </div>
              <div className="p-3.5 rounded-xl bg-[#f1f6f3]">
                <b className="text-[#161d1a] block mb-1">3. Trusted Office Network & GPS</b>
                SWK OS cross-checks office Wi-Fi / IP evidence and reception geofence coordinates at the moment of scan.
              </div>
              <div className="p-3.5 rounded-xl bg-[#f1f6f3]">
                <b className="text-[#161d1a] block mb-1">4. Exception Review (Never Silent Reject)</b>
                Doubtful check-ins are logged and routed for manager review; employees can also submit correction requests with audit reasons.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
