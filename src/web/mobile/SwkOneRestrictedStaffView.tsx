import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import {
  QrCode, BookOpen, TrendingUp, Compass, Clock, CheckCircle2,
  AlertTriangle, Sparkles, Wifi, Smartphone, Calendar, Send,
  ShieldCheck, Building2, Flame, Lock, LogOut, FileText,
} from 'lucide-react'
import { SWK_BRAND, COMMUNITIES, DEVELOPERS } from './SwkOneBrandAssets'
import type { DeviceIdentity } from './native-bridge'

export type RestrictedStaffTabId = 'attendance' | 'manual' | 'market' | 'general'

const COMPANY_MANUAL_SECTIONS = [
  {
    id: 'att-policy',
    category: 'Attendance & Reception QR Policy',
    title: '1. Daily Reception QR Scan & Office Wi-Fi Check-In',
    body: 'Every staff member must scan the Reception QR code upon arriving at the office using their mobile camera while connected to the official Office Wi-Fi (SWK-Properties-Office), sign in with their @swk.property account and password, and press Check-In. Working hours: Mon–Fri 10:00 AM – 7:00 PM, Saturday 10:00 AM – 4:00 PM, Sunday Holiday (grace cutoff 10:05 AM GST).',
  },
  {
    id: 'checkout-policy',
    category: 'Mandatory Checkout Gate',
    title: '2. Daily Work Summary & Check-Out Procedure',
    body: 'Before checking out at the end of the shift, staff must submit their Daily Work Summary in the Attendance tab. Early or late client appointments must be flagged with the Client-Based Variable Hours reason.',
  },
  {
    id: 'rera-ethics',
    category: 'RERA & DLD Compliance (ORN 51517)',
    title: '3. RERA Code of Ethics & Trakheesi Advertising Rules',
    body: 'All property marketing, client discussions, and market representations must strictly adhere to Dubai Land Department (DLD) and RERA regulations under ORN 51517. Never advertise a property without a valid Trakheesi permit or signed Form A.',
  },
  {
    id: 'data-security',
    category: 'Information Security & Role Access',
    title: '4. Role-Based Access & Data Confidentiality',
    body: 'Per SWK Properties OS security governance, full operational CRM, inventory, accounting, and admin modules are restricted exclusively to Admin (Shabib Siraj) and Mohammad Haseeb (Haseeb@swk.property). Staff accounts are authorised for Attendance & QR Check-In, Company Manual, Market Pulse, and General Workspace.',
  },
]

export function AdminAttendanceRollCallCard({
  roster,
  onOpenReceptionQr,
}: {
  roster: any[]
  onOpenReceptionQr?: () => void
}) {
  if (!roster || roster.length === 0) return null
  const checkedInCount = roster.filter(r => r.today_status === 'Checked In' || r.today_status === 'Checked Out').length
  const lateCount = roster.filter(r => r.is_late).length

  return (
    <div className="rounded-3xl bg-white border-2 border-[#c9a96e]/50 p-4 shadow-[0_14px_34px_-22px_rgba(11,26,51,0.32)] space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] font-extrabold text-[#9a7a42]">
            <ShieldCheck size={13} className="text-[#c9a96e]" />
            Admin &amp; Manager Live Roll-Call (Shabib Siraj &amp; Haseeb)
          </div>
          <h3 className="font-bold font-display text-sm text-[#0b1a33] mt-0.5">
            Staff Reception QR Attendance Board (@swk.property)
          </h3>
        </div>
        <div className="flex items-center gap-1.5 text-[10.5px] font-bold">
          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
            {checkedInCount}/{roster.length} Checked In
          </span>
          {lateCount > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
              {lateCount} Late
            </span>
          )}
        </div>
      </div>

      <div className="divide-y divide-[#efe9dc] rounded-2xl bg-[#fbf8f2] border border-[#e7e1d4] px-3">
        {roster.map((staff: any) => {
          const isPresent = staff.today_status === 'Checked In' || staff.today_status === 'Checked Out'
          return (
            <div key={staff.id || staff.email} className="py-2.5 flex items-center justify-between gap-2 text-xs">
              <div className="min-w-0">
                <div className="font-bold text-[#0b1a33] truncate flex items-center gap-1.5">
                  <span>{staff.name}</span>
                  <span className="text-[10px] font-mono text-[#6b7488]">{staff.email}</span>
                </div>
                <div className="text-[10.5px] text-[#6b7488]">
                  {staff.designation || 'Staff'} · {staff.emp_no}
                  {staff.check_in_at ? ` · In: ${String(staff.check_in_at).slice(11, 16)} GST` : ''}
                  {staff.check_out_at ? ` · Out: ${String(staff.check_out_at).slice(11, 16)} GST` : ''}
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-1.5">
                {isPresent ? (
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                      staff.is_late
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                    }`}
                  >
                    {staff.today_status} {staff.is_late ? '(Late)' : '✓'}
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full bg-slate-200/75 text-slate-600 text-[10px] font-bold">
                    Not Checked In
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between gap-2 pt-0.5">
        <Link
          to="/reception-qr"
          className="text-[11px] font-bold text-[#14305c] underline no-underline hover:underline"
        >
          Open Reception QR Display →
        </Link>
        {onOpenReceptionQr && (
          <button
            type="button"
            onClick={onOpenReceptionQr}
            className="px-3 py-1.5 rounded-xl bg-[#0b1a33] text-[#f3ead8] text-[11px] font-bold border-0 cursor-pointer"
          >
            Scan Reception QR
          </button>
        )}
      </div>
    </div>
  )
}

export function SwkOneRestrictedStaffView({
  data,
  activeCommunity,
  communityYoY,
  pulseIndex,
  setPulseIndex,
  areaCompanionCode,
  setAreaCompanionCode,
  areaCompanionData,
  eodSummary,
  setEodSummary,
  eodBlockers,
  setEodBlockers,
  eodPriorities,
  setEodPriorities,
  clientVarHours,
  setClientVarHours,
  varHoursReason,
  setVarHoursReason,
  onOpenQrScanner,
  onOfficeCheckOut,
  onSubmitDailyReport,
  onSubmitLeave,
  onAskKnowledge,
  onOpenAiStudio,
  onOpenApkModal,
  device,
  telemetry,
}: {
  data: any
  activeCommunity: any
  communityYoY: number
  pulseIndex: number
  setPulseIndex: (idx: number) => void
  areaCompanionCode: string
  setAreaCompanionCode: (code: string) => void
  areaCompanionData: any
  eodSummary: string
  setEodSummary: (v: string) => void
  eodBlockers: string
  setEodBlockers: (v: string) => void
  eodPriorities: string
  setEodPriorities: (v: string) => void
  clientVarHours: boolean
  setClientVarHours: (v: boolean) => void
  varHoursReason: string
  setVarHoursReason: (v: string) => void
  onOpenQrScanner: () => void
  onOfficeCheckOut: () => void
  onSubmitDailyReport: () => void
  onSubmitLeave: (payload: { leave_type: string; start_date: string; end_date: string; days: number; reason: string }) => Promise<void>
  onAskKnowledge: (question: string) => Promise<any>
  onOpenAiStudio: () => void
  onOpenApkModal: () => void
  device: DeviceIdentity | null
  telemetry: { battery_pct: number | null; network_type: string; online: boolean }
}) {
  const [tab, setTab] = useState<RestrictedStaffTabId>('attendance')
  const [manualQuery, setManualQuery] = useState('')
  const [manualAnswer, setManualAnswer] = useState<string | null>(null)
  const [askingManual, setAskingManual] = useState(false)

  const [leaveType, setLeaveType] = useState('Annual Leave')
  const [leaveStart, setLeaveStart] = useState('')
  const [leaveEnd, setLeaveEnd] = useState('')
  const [leaveReason, setLeaveReason] = useState('')

  const todayAtt = data?.today_attendance
  const history: any[] = data?.attendance_history || []
  const manualArticles: any[] = data?.company_manual || []

  const handleSearchManual = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualQuery.trim()) return
    setAskingManual(true)
    try {
      const res = await onAskKnowledge(manualQuery.trim())
      setManualAnswer(res?.answer || res?.summary || 'Refer to SWK Properties Company Manual sections below.')
    } catch {
      setManualAnswer('Standard SWK Policy: Please consult Management (Shabib Siraj or Mohammad Haseeb) for special exceptions.')
    } finally {
      setAskingManual(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Hardcoded Staff Access Scope Banner */}
      <div className="rounded-2xl bg-[#0b1a33] text-white border border-[#c9a96e]/45 p-3.5 shadow-sm flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#c9a96e]/20 border border-[#c9a96e]/50 grid place-items-center shrink-0 text-[#f1e3c2]">
            <Lock size={16} />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-[#e6c98f] font-extrabold">
              SWK Staff Portal · Attendance, Manual, Market Pulse &amp; General
            </div>
            <div className="text-xs font-bold text-white truncate">
              {data?.user?.name || 'SWK Staff'} ({data?.user?.email})
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenQrScanner}
          className="px-3.5 py-2 rounded-xl text-[#0b1a33] font-extrabold text-xs border-0 cursor-pointer flex items-center gap-1.5 shadow-xs shrink-0"
          style={{ background: 'linear-gradient(135deg, #f1e3c2 0%, #c9a96e 100%)' }}
        >
          <QrCode size={14} />
          {todayAtt ? 'Scan Reception QR Again' : 'Scan Reception QR & Check In'}
        </button>
      </div>

      {/* 4 Allowed Sub-Navigation Pills */}
      <div className="grid grid-cols-4 gap-1.5 p-1.5 rounded-2xl bg-[#0b1a33] border border-[#c9a96e]/35 text-white">
        {[
          { id: 'attendance', label: 'Attendance', icon: QrCode },
          { id: 'manual', label: 'Manual', icon: BookOpen },
          { id: 'market', label: 'Market Pulse', icon: TrendingUp },
          { id: 'general', label: 'General', icon: Compass },
        ].map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as RestrictedStaffTabId)}
              className={`py-2.5 px-2 rounded-xl text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1.5 border-0 cursor-pointer transition ${
                active
                  ? 'bg-[#c9a96e] text-[#0b1a33] shadow-xs'
                  : 'bg-transparent text-[#c8d4e8] hover:text-white'
              }`}
            >
              <Icon size={15} />
              <span className="text-[11px]">{t.label}</span>
            </button>
          )
        })}
      </div>

      {/* TAB 1: ATTENDANCE & QR CHECK-IN */}
      {tab === 'attendance' && (
        <div className="space-y-4">
          <div className="rounded-3xl bg-white border border-[#e7e1d4] p-4 shadow-xs space-y-3.5">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#9a7a42]">
                  Daily Office Reception Attendance · Saved to SWK OS
                </div>
                <h3 className="font-bold font-display text-base text-[#0b1a33] mt-0.5">
                  {todayAtt
                    ? `Checked In Today at ${String(todayAtt.check_in_at || '').slice(11, 16)} GST`
                    : 'Not Checked In Yet Today'}
                </h3>
                <p className="text-xs text-[#6b7488] mt-0.5">
                  Mon–Fri 10:00 AM – 7:00 PM · Sat 10:00 AM – 4:00 PM · Grace until 10:05 AM GST
                </p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-extrabold ${
                  todayAtt
                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                    : 'bg-amber-100 text-amber-900 border border-amber-300'
                }`}
              >
                {todayAtt ? `${todayAtt.verification_status || 'Verified'} ✓` : 'Pending Scan'}
              </span>
            </div>

            {todayAtt && (
              <div className="p-3 rounded-2xl bg-[#fbf8f2] border border-[#e7e1d4] text-xs space-y-1 text-[#0b1a33]">
                <div>
                  <b>Event Reference:</b> <span className="font-mono">{todayAtt.event_no}</span> ·{' '}
                  <b>Method:</b> {todayAtt.terminal_type || 'Reception QR'}
                </div>
                <div>
                  <b>Check-In Time:</b> {String(todayAtt.check_in_at || '').slice(0, 16).replace('T', ' ')} GST
                  {todayAtt.check_out_at ? ` · Check-Out: ${String(todayAtt.check_out_at).slice(11, 16)} GST` : ''}
                </div>
                <div className="text-[11px] text-emerald-800 font-semibold">
                  ✓ Recorded in SWK OS and visible on Admin (Shabib Siraj) &amp; Manager (Haseeb) Attendance Board.
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={onOpenQrScanner}
                className="py-3 px-4 rounded-2xl text-[#0b1a33] font-extrabold text-xs border-0 cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                style={{ background: 'linear-gradient(135deg, #f1e3c2 0%, #c9a96e 100%)' }}
              >
                <QrCode size={16} />
                Scan Reception QR &amp; Check In
              </button>

              <Link
                to="/reception-qr?scan=1"
                className="py-3 px-4 rounded-2xl bg-[#0b1a33] text-[#f3ead8] font-bold text-xs no-underline flex items-center justify-center gap-2"
              >
                <Wifi size={15} className="text-[#c9a96e]" />
                Full Reception QR Check-In Page
              </Link>
            </div>

            {todayAtt && !todayAtt.check_out_at && (
              <div className="pt-2 border-t border-[#efe9dc] space-y-2">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clientVarHours}
                    onChange={e => setClientVarHours(e.target.checked)}
                  />
                  <span className="font-semibold text-[#0b1a33]">
                    Client-Based Variable Working Hours (Late / Early Client Appointment)
                  </span>
                </label>
                {clientVarHours && (
                  <input
                    type="text"
                    value={varHoursReason}
                    onChange={e => setVarHoursReason(e.target.value)}
                    placeholder="Reason for variable hours…"
                    className="w-full px-3 py-2 rounded-xl bg-[#fbf8f2] border border-[#d8d0c0] text-xs"
                  />
                )}
                <button
                  type="button"
                  onClick={onOfficeCheckOut}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#c4492f] text-white font-bold text-xs border-0 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <LogOut size={14} />
                  Check Out from Office
                </button>
              </div>
            )}
          </div>

          {/* Daily Work Summary (For Checkout Gate) */}
          <div className="rounded-3xl bg-white border border-[#e7e1d4] p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold font-display text-sm text-[#0b1a33] flex items-center gap-1.5">
                <FileText size={15} className="text-[#9a7a42]" />
                Daily Work Summary (End-of-Day Report)
              </h3>
              <span className="text-[10.5px] font-bold text-[#6b7488]">
                {data?.today_report ? 'Submitted Today ✓' : 'Required for Checkout'}
              </span>
            </div>
            <textarea
              rows={2}
              value={eodSummary}
              onChange={e => setEodSummary(e.target.value)}
              placeholder="Summarize today’s completed tasks and attendance notes…"
              className="w-full rounded-xl border border-[#d8d0c0] bg-[#fbf8f2] p-2.5 text-xs text-[#0b1a33]"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={eodBlockers}
                onChange={e => setEodBlockers(e.target.value)}
                placeholder="Any blockers (or None)"
                className="w-full rounded-xl border border-[#d8d0c0] bg-[#fbf8f2] px-3 py-2 text-xs text-[#0b1a33]"
              />
              <input
                type="text"
                value={eodPriorities}
                onChange={e => setEodPriorities(e.target.value)}
                placeholder="Tomorrow’s top priorities"
                className="w-full rounded-xl border border-[#d8d0c0] bg-[#fbf8f2] px-3 py-2 text-xs text-[#0b1a33]"
              />
            </div>
            <button
              type="button"
              onClick={onSubmitDailyReport}
              className="w-full py-2.5 px-4 rounded-xl bg-[#0b1a33] text-[#f3ead8] font-bold text-xs border-0 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Send size={13} />
              Save &amp; Submit Daily Work Summary
            </button>
          </div>

          {/* Personal Attendance Log */}
          <div className="rounded-3xl bg-white border border-[#e7e1d4] p-4 shadow-xs space-y-3">
            <h3 className="font-bold font-display text-sm text-[#0b1a33] flex items-center gap-1.5">
              <Clock size={15} className="text-[#9a7a42]" />
              My Recent Attendance History
            </h3>
            {history.length === 0 ? (
              <div className="text-xs text-[#6b7488] py-3 text-center">
                No attendance scans recorded yet. Scan the Reception QR above to log today’s check-in.
              </div>
            ) : (
              <div className="divide-y divide-[#efe9dc]">
                {history.slice(0, 10).map((item: any) => (
                  <div key={item.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                    <div>
                      <div className="font-bold text-[#0b1a33]">
                        {item.work_date} · In: {String(item.check_in_at || '').slice(11, 16) || '—'} GST
                        {item.check_out_at ? ` · Out: ${String(item.check_out_at).slice(11, 16)} GST` : ''}
                      </div>
                      <div className="text-[10.5px] text-[#6b7488]">
                        Ref: {item.event_no} · {item.terminal_type || 'Reception QR'}
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                      {item.verification_status || 'Verified'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Leave Request */}
          <div className="rounded-3xl bg-white border border-[#e7e1d4] p-4 shadow-xs space-y-3">
            <h3 className="font-bold font-display text-sm text-[#0b1a33] flex items-center gap-1.5">
              <Calendar size={15} className="text-[#9a7a42]" />
              Request Leave
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <select
                value={leaveType}
                onChange={e => setLeaveType(e.target.value)}
                className="rounded-xl border border-[#d8d0c0] bg-[#fbf8f2] px-3 py-2 text-xs font-bold text-[#0b1a33]"
              >
                <option value="Annual Leave">Annual Leave</option>
                <option value="Sick Leave">Sick Leave</option>
                <option value="Emergency Leave">Emergency Leave</option>
              </select>
              <input
                type="date"
                value={leaveStart}
                onChange={e => setLeaveStart(e.target.value)}
                className="rounded-xl border border-[#d8d0c0] bg-[#fbf8f2] px-3 py-2 text-xs text-[#0b1a33]"
              />
              <input
                type="date"
                value={leaveEnd}
                onChange={e => setLeaveEnd(e.target.value)}
                className="rounded-xl border border-[#d8d0c0] bg-[#fbf8f2] px-3 py-2 text-xs text-[#0b1a33]"
              />
            </div>
            <input
              type="text"
              value={leaveReason}
              onChange={e => setLeaveReason(e.target.value)}
              placeholder="Reason for leave request…"
              className="w-full rounded-xl border border-[#d8d0c0] bg-[#fbf8f2] px-3 py-2 text-xs text-[#0b1a33]"
            />
            <button
              type="button"
              onClick={() => {
                if (!leaveStart || !leaveEnd) return
                void onSubmitLeave({
                  leave_type: leaveType,
                  start_date: leaveStart,
                  end_date: leaveEnd,
                  days: 1,
                  reason: leaveReason,
                })
                setLeaveReason('')
              }}
              className="px-4 py-2 rounded-xl bg-[#0b1a33] text-[#f3ead8] font-bold text-xs border-0 cursor-pointer"
            >
              Submit Leave Request to Admin
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: COMPANY MANUAL */}
      {tab === 'manual' && (
        <div className="space-y-4">
          <div className="rounded-3xl bg-white border border-[#e7e1d4] p-4 shadow-xs space-y-3">
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#9a7a42]">
                SWK Properties LLC · Official Staff Handbook
              </div>
              <h3 className="font-bold font-display text-base text-[#0b1a33] mt-0.5">
                Company Manual, SOPs &amp; RERA Guidelines
              </h3>
            </div>

            <form onSubmit={e => void handleSearchManual(e)} className="flex gap-2">
              <input
                type="text"
                value={manualQuery}
                onChange={e => setManualQuery(e.target.value)}
                placeholder="Ask a question about attendance, Wi-Fi, RERA rules, or SOPs…"
                className="flex-1 rounded-xl border border-[#d8d0c0] bg-[#fbf8f2] px-3 py-2 text-xs text-[#0b1a33]"
              />
              <button
                type="submit"
                disabled={askingManual}
                className="px-3.5 py-2 rounded-xl bg-[#0b1a33] text-[#f3ead8] font-bold text-xs border-0 cursor-pointer"
              >
                {askingManual ? 'Searching…' : 'Ask Manual'}
              </button>
            </form>

            {manualAnswer && (
              <div className="p-3 rounded-2xl bg-[#fbf8f2] border border-[#c9a96e] text-xs text-[#0b1a33] leading-relaxed">
                <b className="text-[#9a7a42] block mb-1">Company Manual Response:</b>
                {manualAnswer}
              </div>
            )}

            <div className="space-y-2.5 pt-1">
              {COMPANY_MANUAL_SECTIONS.map(sec => (
                <div key={sec.id} className="p-3.5 rounded-2xl bg-[#fbf8f2] border border-[#e7e1d4] space-y-1">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#9a7a42]">
                    {sec.category}
                  </div>
                  <div className="font-bold font-display text-xs text-[#0b1a33]">{sec.title}</div>
                  <p className="text-xs text-[#3a4660] leading-relaxed m-0">{sec.body}</p>
                </div>
              ))}

              {manualArticles.map((art: any) => (
                <div key={art.id} className="p-3.5 rounded-2xl bg-[#fbf8f2] border border-[#e7e1d4] space-y-1">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#9a7a42]">
                    {art.category || 'Company SOP'}
                  </div>
                  <div className="font-bold font-display text-xs text-[#0b1a33]">{art.title}</div>
                  <p className="text-xs text-[#3a4660] leading-relaxed m-0">
                    {art.summary || art.content || art.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MARKET PULSE */}
      {tab === 'market' && (
        <div className="space-y-4">
          {/* Live Animated Dubai Market Pulse Hero Card */}
          <div className="relative h-44 rounded-3xl overflow-hidden border border-[#1d3a66] shadow-md select-none">
            <div
              className="absolute inset-0 bg-cover bg-center transition-all duration-500"
              style={{ backgroundImage: `url(${activeCommunity.image})` }}
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(180deg, rgba(8,20,42,0.35) 0%, rgba(11,26,51,0.62) 45%, rgba(8,20,42,0.94) 100%)',
              }}
            />
            <div className="relative z-10 h-full p-4 flex flex-col justify-between text-white">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#08142a]/70 border border-[#c9a96e]/40 text-[10px] font-bold uppercase tracking-[0.16em] text-[#dcc8a2]">
                  DLD Market Pulse · {activeCommunity.segment}
                </span>
                <div className="flex items-center gap-1">
                  {COMMUNITIES.slice(0, 10).map((c, idx) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setPulseIndex(idx)}
                      className="h-1.5 rounded-full border-0 cursor-pointer p-0"
                      style={{
                        width: idx === pulseIndex ? 18 : 6,
                        background: idx === pulseIndex ? '#c9a96e' : 'rgba(255,255,255,0.32)',
                      }}
                    />
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-end justify-between gap-2">
                  <div>
                    <div className="text-lg font-bold font-display leading-tight text-white">
                      {activeCommunity.name}
                    </div>
                    <div className="text-[11px] text-[#d6deeb]">
                      {activeCommunity.transactionsQ.toLocaleString()} quarterly DLD transactions · {activeCommunity.offPlanShare}% off-plan
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-[#1f9d6b]/25 border border-[#4fd39a]/40 text-[#8fe3bd] text-xs font-bold">
                    +{communityYoY.toFixed(1)}% YoY
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
              </div>
            </div>
          </div>

          {/* Area Companion */}
          {areaCompanionData && (
            <div className="rounded-3xl bg-[#0b1a33] text-white border border-[#c9a96e]/40 p-4 shadow-md space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-[#dcc8a2] font-bold">
                    Dubai District Intelligence · 15-Year Outlook
                  </div>
                  <h3 className="font-bold font-display text-sm text-white mt-0.5">
                    {areaCompanionData.ticker} — {areaCompanionData.name} (AED {areaCompanionData.ppsf}/sqft)
                  </h3>
                </div>
                <select
                  value={areaCompanionCode}
                  onChange={e => setAreaCompanionCode(e.target.value)}
                  className="px-2.5 py-1 rounded-xl bg-white/10 border border-white/20 text-white text-xs font-bold"
                >
                  {COMMUNITIES.map(c => (
                    <option key={c.code || c.id} value={c.code || 'PALM'} className="text-black">
                      {c.ticker || c.code} · {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(areaCompanionData.closingKeywords || []).map((kw: string) => (
                  <span key={kw} className="px-2.5 py-1 rounded-full bg-[#c9a96e]/25 border border-[#c9a96e]/50 text-[#f3ead8] text-[10.5px] font-bold">
                    <Flame size={10} className="inline mr-1 text-[#f3ead8]" />
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* All Dubai Communities Grid */}
          <div className="rounded-3xl bg-white border border-[#e7e1d4] p-4 shadow-xs space-y-3">
            <h3 className="font-bold font-display text-sm text-[#0b1a33]">
              Dubai Communities Market Index ({COMMUNITIES.length} Districts)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {COMMUNITIES.slice(0, 12).map(c => (
                <div key={c.id} className="p-3 rounded-2xl bg-[#fbf8f2] border border-[#e7e1d4] flex items-center justify-between gap-2">
                  <div>
                    <div className="font-bold text-xs text-[#0b1a33]">{c.name}</div>
                    <div className="text-[10.5px] text-[#6b7488]">
                      AED {c.ppsf.toLocaleString()}/sqft · Yield {c.yieldPct.toFixed(1)}%
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10.5px] font-bold">
                    +{(((c.ppsf - c.ppsfLY) / c.ppsfLY) * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Master Developers */}
          <div className="rounded-3xl bg-white border border-[#e7e1d4] p-4 shadow-xs space-y-2.5">
            <h3 className="font-bold font-display text-sm text-[#0b1a33]">
              UAE Master Developers
            </h3>
            <div className="flex flex-wrap gap-2">
              {DEVELOPERS.map(dev => (
                <span key={dev.name} className="px-3 py-1.5 rounded-xl bg-[#fbf8f2] border border-[#e7e1d4] text-xs font-bold text-[#0b1a33]">
                  {dev.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: GENERAL WORKSPACE */}
      {tab === 'general' && (
        <div className="space-y-4">
          <div className="rounded-3xl bg-white border border-[#e7e1d4] p-4 shadow-xs space-y-3">
            <div className="flex items-center gap-3">
              <img src={SWK_BRAND.mark} alt="SWK" className="w-11 h-11 rounded-2xl object-contain bg-[#0b1a33] p-1.5" />
              <div>
                <div className="font-bold font-display text-sm text-[#0b1a33]">
                  {data?.employee?.name || data?.user?.name}
                </div>
                <div className="text-xs text-[#6b7488]">
                  {data?.user?.email} · {data?.employee?.emp_no || 'SWK Staff'}
                </div>
                <div className="text-[10.5px] font-bold text-[#9a7a42] mt-0.5">
                  Role: Staff (Attendance, Manual, Market Pulse &amp; General)
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={onOpenAiStudio}
                className="p-3 rounded-2xl bg-[#0b1a33] text-[#f3ead8] font-bold text-xs border-0 cursor-pointer flex items-center justify-center gap-2"
              >
                <Sparkles size={15} className="text-[#c9a96e]" />
                Open Internal SWK AI Assistant
              </button>
              <button
                type="button"
                onClick={onOpenApkModal}
                className="p-3 rounded-2xl bg-[#fbf8f2] text-[#0b1a33] font-bold text-xs border border-[#d8d0c0] cursor-pointer flex items-center justify-center gap-2"
              >
                <Smartphone size={15} className="text-[#9a7a42]" />
                Handset &amp; Android App Settings
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-[#fbf8f2] border border-[#e7e1d4] text-xs space-y-1 text-[#3a4660]">
              <div>
                <b>Bound Handset ID:</b> <span className="font-mono text-[#0b1a33]">{device?.device_id || 'WEB'}</span>
              </div>
              <div>
                <b>Connection Telemetry:</b> {telemetry.network_type} · {telemetry.online ? 'Online' : 'Offline'}
              </div>
              <div>
                <b>Mobile Domain:</b> <span className="font-mono text-[#0b1a33]">https://ae.swkpropertiesuae.com</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
