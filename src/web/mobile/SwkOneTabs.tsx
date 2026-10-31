import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  MapPin, Navigation, ShieldAlert, CheckCircle2, PhoneCall, MessageSquare, Building2, Camera,
  KeyRound, FileCheck2, Sparkles, Scale, HandCoins, Percent, Plane, BookOpen, AlertTriangle,
  Send, Languages, UserCheck, Eye, Radio, ScanLine, ShieldCheck, IdCard,
} from 'lucide-react'
import { AnimatedNumber } from '../swk/ui'
import {
  SWK_BRAND,
  resolvePropertyPhoto,
  resolveCommunityMedia,
  resolveDeveloperBrand,
} from './SwkOneBrandAssets'
import { openAndroidMapsNavigation } from './native-bridge'

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

const listStagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.055 } },
}

const itemRise = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.42, ease: EASE } },
}

/**
 * TAB 2: Field Duty, Live Radar, Safety, Location Privacy & Verified Viewing Journey (Features 17–20, 40–50)
 */
export function DutyAndViewingsTab({
  data,
  onStartDuty,
  onEndDuty,
  onSendLocationBatch,
  onSafetyCheckIn,
  onTriggerSos,
  onViewingArrive,
  onViewingFeedback,
  onViewingEvent,
}: {
  data: any
  onStartDuty: (location: string, viewingId?: number | null, propertyId?: number | null) => Promise<void>
  onEndDuty: (sessionId: number, notes?: string) => Promise<void>
  onSendLocationBatch: (sessionId: number) => Promise<void>
  onSafetyCheckIn: (sessionId: number) => Promise<void>
  onTriggerSos: (reason: string) => Promise<void>
  onViewingArrive: (viewingId: number) => Promise<void>
  onViewingFeedback: (viewingId: number, payload: any) => Promise<void>
  onViewingEvent: (viewingId: number, mode: 'no_show' | 'late_notice' | 'client_confirmed', note?: string) => Promise<void>
}) {
  const activeSession = data?.active_field_session
  const viewings: any[] = data?.viewings || []
  const privacyLogs: any[] = data?.location_access_logs || []

  const [dutyLoc, setDutyLoc] = useState('Dubai Marina – Marina Gate Tower 1')
  const [selectedViewingId, setSelectedViewingId] = useState<number | ''>('')
  const [sosReason, setSosReason] = useState('')
  const [showSosBox, setShowSosBox] = useState(false)
  const [feedbackViewingId, setFeedbackViewingId] = useState<number | null>(null)
  const [interest, setInterest] = useState(9)
  const [decision, setDecision] = useState<'Make Offer' | 'Second Viewing' | 'Send Alternatives' | 'Not Interested'>('Make Offer')
  const [objections, setObjections] = useState<string[]>([])
  const [feedbackNotes, setFeedbackNotes] = useState('')

  const toggleObjection = (obj: string) => {
    setObjections(prev => (prev.includes(obj) ? prev.filter(x => x !== obj) : [...prev, obj]))
  }

  const activeCommunity = resolveCommunityMedia(activeSession?.assigned_location || dutyLoc, 2)

  return (
    <motion.div variants={listStagger} initial="hidden" animate="show" className="space-y-4">
      {/* 1. Explicit Start / End Field Duty Card + Animated Live GPS Radar Visualizer */}
      <motion.div
        variants={itemRise}
        className="rounded-3xl bg-white border border-[#e7e1d4] overflow-hidden shadow-[0_14px_34px_-22px_rgba(11,26,51,0.32)]"
      >
        {/* Interactive Live Dubai GPS Telemetry & Radar Header */}
        <div className="relative h-44 bg-[#08142a] text-white overflow-hidden p-4 flex flex-col justify-between">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-28"
            style={{ backgroundImage: `url(${activeCommunity.image})` }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at 78% 50%, rgba(79,211,154,0.18), transparent 55%), linear-gradient(180deg, rgba(8,20,42,0.72) 0%, rgba(11,26,51,0.95) 100%)',
            }}
          />
          <img
            src={SWK_BRAND.skylineFront}
            alt=""
            aria-hidden
            className="absolute bottom-0 left-0 right-0 w-full h-14 object-cover opacity-15 pointer-events-none"
          />

          {/* Animated SVG Radar Rings on Right Side */}
          <div className="absolute right-5 top-1/2 -translate-y-1/2 w-28 h-28 pointer-events-none flex items-center justify-center">
            <svg width={112} height={112} viewBox="0 0 112 112" className="overflow-visible">
              <circle
                cx={56}
                cy={56}
                r={48}
                fill="none"
                stroke={activeSession ? 'rgba(79,211,154,0.28)' : 'rgba(201,169,110,0.22)'}
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <circle
                cx={56}
                cy={56}
                r={32}
                fill="none"
                stroke={activeSession ? 'rgba(79,211,154,0.4)' : 'rgba(201,169,110,0.3)'}
                strokeWidth={1}
              />
              {activeSession && (
                <>
                  <motion.circle
                    cx={56}
                    cy={56}
                    r={14}
                    fill="none"
                    stroke="#4fd39a"
                    strokeWidth={2}
                    initial={{ r: 10, opacity: 0.9 }}
                    animate={{ r: 50, opacity: 0 }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
                  />
                  <motion.circle
                    cx={56}
                    cy={56}
                    r={14}
                    fill="none"
                    stroke="#c9a96e"
                    strokeWidth={1.5}
                    initial={{ r: 10, opacity: 0.7 }}
                    animate={{ r: 46, opacity: 0 }}
                    transition={{ duration: 2.2, delay: 0.9, repeat: Infinity, ease: 'easeOut' }}
                  />
                </>
              )}
              <circle
                cx={56}
                cy={56}
                r={6}
                fill={activeSession ? '#4fd39a' : '#c9a96e'}
              />
            </svg>
          </div>

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  activeSession ? 'bg-[#4fd39a] animate-ping' : 'bg-[#c9a96e]'
                }`}
              />
              <span className="text-[10.5px] uppercase tracking-[0.18em] font-bold text-[#dcc8a2]">
                Android Foreground Location Service
              </span>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                activeSession
                  ? 'bg-[#1f9d6b]/30 border-[#4fd39a]/50 text-[#8fe3bd]'
                  : 'bg-white/10 border-white/20 text-[#f3ead8]'
              }`}
            >
              {activeSession ? activeSession.status : 'Off Duty · Private'}
            </span>
          </div>

          <div className="relative z-10 pr-24">
            <h3 className="font-display font-bold text-base text-white leading-snug">
              {activeSession
                ? activeSession.assigned_location
                : 'Authorised Field Duty & Viewing Telemetry'}
            </h3>
            <p className="text-[11px] text-[#c8d3e6] mt-1 font-mono">
              {activeSession
                ? `Session ${activeSession.session_no} · GPS ${activeSession.last_lat ?? activeCommunity.lat}°N, ${activeSession.last_lng ?? activeCommunity.lng}°E (±${activeSession.gps_accuracy_m || 8}m)`
                : `Sector: ${activeCommunity.name} (${activeCommunity.lat}°N, ${activeCommunity.lng}°E) · Zero Off-Duty Tracking`}
            </p>
          </div>
        </div>

        {/* Controls Body */}
        <div className="p-4 space-y-3">
          {activeSession ? (
            <div className="p-3.5 rounded-2xl bg-[#fbf8f2] border border-[#e3d1ad] space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#0b1a33] flex items-center gap-1.5">
                  <Radio size={14} className="text-[#1f9d6b]" />
                  Persistent Android Notification Active
                </span>
                <span className="text-[10.5px] font-semibold text-[#9a7a42]">
                  Batched Low-Battery Mode
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => void onSendLocationBatch(activeSession.id)}
                  className="py-2.5 px-2.5 rounded-xl bg-white text-[#14305c] border border-[#d9d1c1] hover:border-[#c9a96e] text-xs font-bold cursor-pointer shadow-2xs"
                >
                  Sync GPS Batch
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => void onSafetyCheckIn(activeSession.id)}
                  className="py-2.5 px-2.5 rounded-xl bg-[#e3f4ec] text-[#157a52] border border-[#b5e2cd] text-xs font-bold cursor-pointer"
                >
                  ✓ I Am Safe
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => void onEndDuty(activeSession.id, 'Completed scheduled field duty')}
                  className="py-2.5 px-2.5 rounded-xl bg-[#0b1a33] text-[#f3ead8] text-xs font-bold border-0 cursor-pointer"
                >
                  End Duty
                </motion.button>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              <p className="text-xs text-[#3a4660]">
                Location is <b className="text-[#0b1a33]">never</b> shared when off duty. Starting Field Duty launches the Android Foreground Service with a visible status notification until you end duty.
              </p>
              <input
                type="text"
                value={dutyLoc}
                onChange={e => setDutyLoc(e.target.value)}
                placeholder="Assigned community / building (e.g. Dubai Marina Gate 1)"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#fbf9f5] border border-[#d9d1c1] text-xs text-[#0b1a33] focus:outline-none focus:border-[#c9a96e]"
              />
              {viewings.length > 0 && (
                <select
                  value={selectedViewingId}
                  onChange={e => {
                    const id = e.target.value ? Number(e.target.value) : ''
                    setSelectedViewingId(id)
                    const v = viewings.find(x => x.id === id)
                    if (v) setDutyLoc(v.property_title || v.meeting_point || dutyLoc)
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#fbf9f5] border border-[#d9d1c1] text-xs text-[#0b1a33]"
                >
                  <option value="">Link to an assigned viewing appointment (optional)…</option>
                  {viewings.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.viewing_no} – {v.property_title} ({String(v.scheduled_at || '').slice(11, 16)})
                    </option>
                  ))}
                </select>
              )}
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  const v = viewings.find(x => x.id === selectedViewingId)
                  void onStartDuty(dutyLoc, v?.id ?? null, v?.property_id ?? null)
                }}
                className="w-full py-3 rounded-2xl text-[#0b1a33] font-bold text-xs border-0 cursor-pointer flex items-center justify-center gap-2 shadow-md"
                style={{ background: 'linear-gradient(135deg, #f1e3c2 0%, #c9a96e 55%, #b08d52 100%)' }}
              >
                <MapPin size={15} /> Start Approved Field Duty (Enable Foreground Service)
              </motion.button>
            </div>
          )}

          {/* Emergency SOS Bar (Feature #46) */}
          <div className="pt-2.5 border-t border-[#e7e1d4] flex items-center justify-between">
            <span className="text-[11px] font-medium text-[#6b7488]">
              Lone-Worker Field Safety & Emergency Escalation
            </span>
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={() => setShowSosBox(s => !s)}
              className="px-3 py-1.5 rounded-full bg-[#fbe4dd] text-[#a33a22] font-bold text-xs border border-[#f2bcc3] cursor-pointer flex items-center gap-1"
            >
              <ShieldAlert size={13} /> Emergency SOS
            </motion.button>
          </div>

          <AnimatePresence>
            {showSosBox && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="p-3 rounded-2xl bg-[#fbe4dd]/70 border border-[#c4492f]/40 space-y-2 mt-1">
                  <input
                    type="text"
                    value={sosReason}
                    onChange={e => setSosReason(e.target.value)}
                    placeholder="Describe emergency or safety concern (alerts management immediately)…"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[#c4492f]/40 text-xs text-[#0b1a33]"
                  />
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={async () => {
                      await onTriggerSos(sosReason || 'Urgent field safety assistance needed')
                      setShowSosBox(false)
                      setSosReason('')
                    }}
                    className="w-full py-2.5 rounded-xl bg-[#c4492f] text-white font-bold text-xs border-0 cursor-pointer shadow-sm"
                  >
                    🚨 Dispatch Immediate SOS Alert + Live Coordinates
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* 2. Scheduled Route Overview & Verified Viewing Journey with High-Res Property Photography */}
      <motion.div
        variants={itemRise}
        className="rounded-3xl bg-white border border-[#e7e1d4] p-4 shadow-[0_14px_34px_-22px_rgba(11,26,51,0.32)] space-y-3"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-[#9a7a42]">
              Verified Field Route
            </div>
            <h3 className="font-bold font-display text-sm text-[#0b1a33]">
              Viewing Journey & Daily Route ({viewings.length})
            </h3>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-[#f3ead8] text-[#7d5f2c] text-[10.5px] font-bold">
            GPS Verified
          </span>
        </div>

        {viewings.length === 0 ? (
          <div className="p-6 rounded-2xl bg-[#fbf8f2] border border-[#efe9dc] text-center space-y-2">
            <img src={SWK_BRAND.logoInk} alt="" className="h-7 w-auto mx-auto opacity-30" />
            <div className="text-xs font-bold text-[#0b1a33]">No viewings scheduled yet today</div>
            <p className="text-[11px] text-[#6b7488]">
              Tap &ldquo;Populate Live Dubai Field Workspace Data&rdquo; on the Command tab or schedule a viewing in CRM.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {viewings.map((v, idx) => {
              const photoUrl = resolvePropertyPhoto(v.property_title || v.meeting_point, idx)
              const comm = resolveCommunityMedia(v.property_title || v.meeting_point, idx)
              return (
                <motion.div
                  key={v.id}
                  layout
                  className="rounded-2xl bg-[#fbf8f2] border border-[#e7e1d4] overflow-hidden shadow-2xs"
                >
                  {/* Property Visual Banner */}
                  <div className="relative h-28 bg-[#0b1a33] overflow-hidden">
                    <div
                      className="absolute inset-0 bg-cover bg-center"
                      style={{ backgroundImage: `url(${photoUrl})` }}
                    />
                    <div
                      className="absolute inset-0"
                      style={{
                        background:
                          'linear-gradient(180deg, rgba(11,26,51,0.2) 0%, rgba(11,26,51,0.88) 100%)',
                      }}
                    />
                    <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full bg-[#0b1a33]/85 backdrop-blur-xs text-[#f3ead8] text-[10px] font-bold border border-[#c9a96e]/40">
                        Stop #{idx + 1} · {v.viewing_no}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          v.status === 'Completed'
                            ? 'bg-[#1f9d6b] text-white'
                            : v.status === 'No-Show'
                              ? 'bg-[#c4492f] text-white'
                              : 'bg-[#c9a96e] text-[#0b1a33]'
                        }`}
                      >
                        {v.status}
                      </span>
                    </div>
                    <div className="absolute bottom-2 left-3 right-3 text-white">
                      <div className="font-bold font-display text-sm truncate">
                        {v.property_title || `Property #${v.property_id}`}
                      </div>
                      <div className="text-[11px] text-[#dcc8a2] flex items-center justify-between">
                        <span>
                          {String(v.scheduled_at || '').replace('T', ' ')} · {v.meeting_point || 'Main Lobby'}
                        </span>
                        <span className="text-[10px] text-white/80">{comm.name}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Actions & Feedback */}
                  <div className="p-3.5 space-y-2.5">
                    {v.feedback && (
                      <div className="p-2.5 rounded-xl bg-white text-[11px] text-[#3a4660] border border-[#e7e1d4]">
                        <b className="text-[#0b1a33]">Recorded Outcome:</b> {v.feedback}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-1.5">
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => openAndroidMapsNavigation(comm.lat, comm.lng, v.property_title || v.meeting_point)}
                        className="px-3 py-1.5 rounded-full bg-white text-[#0b1a33] border border-[#d9d1c1] hover:border-[#c9a96e] text-[11px] font-bold cursor-pointer flex items-center gap-1"
                      >
                        <Navigation size={12} className="text-[#9a7a42]" /> Navigate (Maps)
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => void onViewingArrive(v.id)}
                        className="px-3 py-1.5 rounded-full text-white text-[11px] font-bold border-0 cursor-pointer flex items-center gap-1 shadow-2xs"
                        style={{ background: 'linear-gradient(135deg, #1b3a6b, #0b1a33)' }}
                      >
                        <MapPin size={12} className="text-[#c9a96e]" /> Confirm Arrival
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setFeedbackViewingId(feedbackViewingId === v.id ? null : v.id)}
                        className="px-3 py-1.5 rounded-full text-[#0b1a33] text-[11px] font-bold border-0 cursor-pointer"
                        style={{ background: 'linear-gradient(135deg, #f1e3c2, #c9a96e)' }}
                      >
                        Checkout & Feedback
                      </motion.button>
                      <button
                        onClick={() => void onViewingEvent(v.id, 'client_confirmed', 'Client confirmed via WhatsApp')}
                        className="px-2.5 py-1.5 rounded-full bg-white text-[#3a4660] border border-[#d9d1c1] text-[11px] font-semibold cursor-pointer"
                      >
                        Client Confirmed
                      </button>
                      <button
                        onClick={() => void onViewingEvent(v.id, 'late_notice', '15 min traffic delay on SZR')}
                        className="px-2.5 py-1.5 rounded-full bg-white text-[#9a7a42] border border-[#e3d1ad] text-[11px] font-semibold cursor-pointer"
                      >
                        15m Delay Alert
                      </button>
                      <button
                        onClick={() => void onViewingEvent(v.id, 'no_show', 'Client did not attend; GPS arrival logged')}
                        className="px-2.5 py-1.5 rounded-full bg-white text-[#c4492f] border border-[#f2bcc3] text-[11px] font-semibold cursor-pointer"
                      >
                        Log No-Show
                      </button>
                    </div>

                    {/* Structured Client Feedback Drawer (Feature #20) */}
                    <AnimatePresence>
                      {feedbackViewingId === v.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="p-3.5 rounded-2xl bg-white border border-[#c9a96e] space-y-2.5 mt-1">
                            <div className="text-xs font-bold font-display text-[#0b1a33]">
                              Record Client Viewing Feedback & Objections
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <label className="block text-[10px] font-semibold text-[#6b7488] mb-1">
                                  Client Interest (1–10)
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  max={10}
                                  value={interest}
                                  onChange={e => setInterest(Number(e.target.value))}
                                  className="w-full px-2.5 py-1.5 rounded-xl bg-[#fbf9f5] border border-[#d9d1c1] text-xs font-bold text-[#0b1a33]"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-semibold text-[#6b7488] mb-1">
                                  Client Decision
                                </label>
                                <select
                                  value={decision}
                                  onChange={e => setDecision(e.target.value as any)}
                                  className="w-full px-2.5 py-1.5 rounded-xl bg-[#fbf9f5] border border-[#d9d1c1] text-xs font-semibold text-[#0b1a33]"
                                >
                                  <option value="Make Offer">Ready to Make Offer</option>
                                  <option value="Second Viewing">Request Second Viewing</option>
                                  <option value="Send Alternatives">Send Verified Alternatives</option>
                                  <option value="Not Interested">Not Interested</option>
                                </select>
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] font-semibold text-[#6b7488] mb-1">
                                Client Objections (Tap to tag)
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {[
                                  'Asking Price High',
                                  'Service Charges',
                                  'Floor / View',
                                  'Kitchen Layout',
                                  'Needs Mortgage',
                                  'Handover Date',
                                ].map(obj => (
                                  <button
                                    key={obj}
                                    type="button"
                                    onClick={() => toggleObjection(obj)}
                                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold border cursor-pointer transition ${
                                      objections.includes(obj)
                                        ? 'bg-[#0b1a33] text-[#f3ead8] border-[#0b1a33]'
                                        : 'bg-[#fbf8f2] text-[#3a4660] border-[#d9d1c1]'
                                    }`}
                                  >
                                    {obj}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <textarea
                              rows={2}
                              value={feedbackNotes}
                              onChange={e => setFeedbackNotes(e.target.value)}
                              placeholder="Client preferences, price feedback & next follow-up step…"
                              className="w-full px-3 py-2 rounded-xl bg-[#fbf9f5] border border-[#d9d1c1] text-xs text-[#0b1a33]"
                            />
                            <motion.button
                              whileTap={{ scale: 0.97 }}
                              onClick={async () => {
                                await onViewingFeedback(v.id, {
                                  interest_level: interest,
                                  decision,
                                  objections,
                                  feedback: feedbackNotes || 'Client toured unit and reviewed floor plan.',
                                })
                                setFeedbackViewingId(null)
                                setFeedbackNotes('')
                                setObjections([])
                              }}
                              className="w-full py-2.5 rounded-xl text-[#0b1a33] font-bold text-xs border-0 cursor-pointer"
                              style={{ background: 'linear-gradient(135deg, #f1e3c2, #c9a96e)' }}
                            >
                              Save Outcome & Create CRM Follow-up Task
                            </motion.button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </motion.div>

      {/* 3. Employee Location Privacy Dashboard (Feature #50) */}
      <motion.div
        variants={itemRise}
        className="rounded-3xl bg-white border border-[#e7e1d4] p-4 shadow-xs space-y-2.5"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye size={16} className="text-[#9a7a42]" />
            <h3 className="font-bold font-display text-sm text-[#0b1a33]">
              Location Privacy Dashboard (Audit Log)
            </h3>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-[#e3f4ec] text-[#157a52] text-[10px] font-bold">
            Off-Hours Blocked
          </span>
        </div>
        <p className="text-[11px] text-[#6b7488]">
          Every manager lookup of your field duty location is audited below. Lookups outside scheduled duty hours are automatically blocked by SWK OS.
        </p>
        {privacyLogs.length === 0 ? (
          <div className="p-3 rounded-2xl bg-[#fbf8f2] border border-[#efe9dc] text-xs text-[#6b7488]">
            No manager location lookups recorded today. Your off-duty coordinates are strictly private.
          </div>
        ) : (
          <div className="space-y-1.5">
            {privacyLogs.slice(0, 6).map((log: any) => (
              <div
                key={log.id}
                className="p-2.5 rounded-2xl bg-[#fbf8f2] border border-[#efe9dc] flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-bold text-[#0b1a33]">{log.access_outcome}</div>
                  <div className="text-[10px] text-[#6b7488]">
                    {log.exception_reason || 'Standard active-duty coordination'}
                  </div>
                </div>
                <span className="text-[10px] font-mono text-[#6b7488]">
                  {String(log.accessed_at || '').slice(0, 16)}
                </span>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

/**
 * TAB 3: Inventory Acquisition, Animated Camera OCR, Duplicate Guard, Key Handover & Developer NOC (Features 28–39)
 */
export function InventoryAndNocTab({
  data,
  onCheckDuplicate,
  onCameraExtract,
  onSubmitInventory,
  onReconfirmPrice,
  onOwnerWithdraw,
  onLogKey,
}: {
  data: any
  onCheckDuplicate: (building: string, unit: string) => Promise<any>
  onCameraExtract: (docType: 'title_deed' | 'form_a' | 'passport', hint?: string) => Promise<any>
  onSubmitInventory: (payload: any) => Promise<void>
  onReconfirmPrice: (id: number, askingPrice: number) => Promise<void>
  onOwnerWithdraw: (id: number, reason: string) => Promise<void>
  onLogKey: (payload: any) => Promise<void>
}) {
  const submissions: any[] = data?.inventory_submissions || []
  const nocRequests: any[] = data?.developer_requests || []
  const keyLogs: any[] = data?.key_logs || []

  const [buildingName, setBuildingName] = useState('')
  const [unitNo, setUnitNo] = useState('')
  const [propertyType, setPropertyType] = useState('Apartment')
  const [purpose] = useState('Sale')
  const [askingPrice, setAskingPrice] = useState('3450000')
  const [areaSqft, setAreaSqft] = useState('1485')
  const [bedrooms, setBedrooms] = useState('2')
  const [ownerName, setOwnerName] = useState('')
  const [ownerPhone, setOwnerPhone] = useState('+971 50 ')
  const [formARef, setFormARef] = useState('')
  const [trakheesiNo, setTrakheesiNo] = useState('')
  const [conditionNotes, setConditionNotes] = useState(
    'AC tested, freshly painted, balcony view clear, keys verified.'
  )

  const [dupResult, setDupResult] = useState<any>(null)
  const [ocrStatus, setOcrStatus] = useState<any>(null)
  const [scanningDoc, setScanningDoc] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Key Vault form
  const [keyBuilding, setKeyBuilding] = useState('Marina Gate Tower 1')
  const [keyUnit, setKeyUnit] = useState('3402')
  const [keyAction, setKeyAction] = useState<
    'Received from Owner' | 'Checked Out for Viewing' | 'Returned to Office Vault' | 'Handed to Buyer/Tenant'
  >('Checked Out for Viewing')

  const handleCheckDup = async (b: string, u: string) => {
    if (b.trim().length > 2 && u.trim().length > 0) {
      const res = await onCheckDuplicate(b, u)
      setDupResult(res)
    } else {
      setDupResult(null)
    }
  }

  const handleCameraOcr = async (docType: 'title_deed' | 'form_a' | 'passport') => {
    setScanningDoc(docType)
    try {
      const res = await onCameraExtract(docType, buildingName)
      setOcrStatus(res)
      if (res?.extracted) {
        setBuildingName(res.extracted.building_name)
        setUnitNo(res.extracted.unit_no)
        setPropertyType(res.extracted.property_type)
        setAskingPrice(String(res.extracted.asking_price))
        setAreaSqft(String(res.extracted.area_sqft))
        setBedrooms(String(res.extracted.bedrooms))
        setOwnerName(res.extracted.owner_name)
        setOwnerPhone(res.extracted.owner_phone)
        setFormARef(res.extracted.source_permission_evidence)
        setTrakheesiNo(res.extracted.trakheesi_permit_no)
        await handleCheckDup(res.extracted.building_name, res.extracted.unit_no)
      }
    } finally {
      setTimeout(() => setScanningDoc(null), 500)
    }
  }

  return (
    <motion.div variants={listStagger} initial="hidden" animate="show" className="space-y-4">
      {/* 1. Quick Property Sourcing + Animated Camera OCR + Real-Time Duplicate Warning */}
      <motion.div
        variants={itemRise}
        className="rounded-3xl bg-white border border-[#e7e1d4] p-4 shadow-[0_14px_34px_-22px_rgba(11,26,51,0.32)] space-y-3.5"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-[#9a7a42]">
              Field Inventory Acquisition
            </div>
            <h3 className="font-bold font-display text-sm text-[#0b1a33]">
              Quick Property Sourcing (Under 60 Seconds)
            </h3>
          </div>
          <div className="w-9 h-9 rounded-xl bg-[#f3ead8] text-[#7d5f2c] grid place-items-center">
            <Building2 size={18} />
          </div>
        </div>

        {/* Animated Camera-Assisted Document Scan Bar (Feature #29 & #35) */}
        <div className="relative overflow-hidden p-3.5 rounded-2xl bg-[#0b1a33] text-white border border-[#c9a96e]/40 space-y-2.5">
          {scanningDoc && (
            <motion.div
              className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#4fd39a] to-transparent z-20 pointer-events-none"
              initial={{ top: 0 }}
              animate={{ top: ['10%', '90%', '10%'] }}
              transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
            />
          )}
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-[#f3ead8] flex items-center gap-1.5">
              <Camera size={14} className="text-[#c9a96e]" />
              Camera-Assisted DLD OCR & Image Sharpness AI
            </div>
            <ScanLine size={14} className={scanningDoc ? 'text-[#4fd39a] animate-spin' : 'text-[#c9a96e]'} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <motion.button
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={() => void handleCameraOcr('title_deed')}
              className="px-3 py-1.5 rounded-full text-[#0b1a33] text-[11px] font-bold border-0 cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #f1e3c2, #c9a96e)' }}
            >
              📷 Scan Title Deed / Oqood
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={() => void handleCameraOcr('form_a')}
              className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-[#f3ead8] border border-white/20 text-[11px] font-semibold cursor-pointer"
            >
              📄 Scan Signed Form A
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={() => void handleCameraOcr('passport')}
              className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 text-[11px] font-semibold cursor-pointer"
            >
              🪪 Scan Owner EID / Passport
            </motion.button>
          </div>
          {ocrStatus && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[11px] text-[#8fe3bd] bg-white/10 p-2 rounded-xl border border-[#4fd39a]/30"
            >
              ✓ <b>{ocrStatus.image_quality_check?.verdict}</b> ({ocrStatus.image_quality_check?.resolution}, Sharpness{' '}
              {ocrStatus.image_quality_check?.sharpness_score}%)
            </motion.div>
          )}
        </div>

        {/* Duplicate Warning Banner (Feature #30) */}
        <AnimatePresence>
          {dupResult?.duplicate && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="p-3 rounded-2xl bg-[#fbf0d9] border border-[#c9a96e] text-xs text-[#7d5f2c] flex items-start gap-2">
                <AlertTriangle size={16} className="shrink-0 mt-0.5 text-[#c4492f]" />
                <div>
                  <b>Duplicate Unit Guard (Control 3.07):</b> Another broker already registered{' '}
                  <b>
                    {buildingName} – Unit {unitNo}
                  </b>
                  . Submitting will place this record in <i>Duplicate / Conflict Hold</i> for manager attribution review.
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <form
          onSubmit={async e => {
            e.preventDefault()
            if (!buildingName.trim() || !unitNo.trim() || !ownerName.trim()) return
            setSubmitting(true)
            try {
              await onSubmitInventory({
                building_name: buildingName,
                unit_no: unitNo,
                property_type: propertyType,
                purpose,
                asking_price: Number(askingPrice || 0),
                area_sqft: Number(areaSqft || 1000),
                bedrooms: Number(bedrooms || 2),
                owner_name: ownerName,
                owner_phone: ownerPhone,
                owner_contact_verified: true,
                source_permission_evidence: formARef || 'DLD-FORMA-VERIFIED',
                trakheesi_permit_no: trakheesiNo || '714928199',
                condition_notes: conditionNotes,
              })
              setBuildingName('')
              setUnitNo('')
              setDupResult(null)
            } finally {
              setSubmitting(false)
            }
          }}
          className="space-y-2.5 text-xs"
        >
          <div className="grid grid-cols-3 gap-2">
            <input
              type="text"
              required
              value={buildingName}
              onChange={e => {
                setBuildingName(e.target.value)
                void handleCheckDup(e.target.value, unitNo)
              }}
              placeholder="Building / Tower *"
              className="col-span-2 px-3 py-2.5 rounded-xl bg-[#fbf9f5] border border-[#d9d1c1] text-[#0b1a33]"
            />
            <input
              type="text"
              required
              value={unitNo}
              onChange={e => {
                setUnitNo(e.target.value)
                void handleCheckDup(buildingName, e.target.value)
              }}
              placeholder="Unit No. *"
              className="px-3 py-2.5 rounded-xl bg-[#fbf9f5] border border-[#d9d1c1] text-[#0b1a33]"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <select
              value={propertyType}
              onChange={e => setPropertyType(e.target.value)}
              className="px-2.5 py-2.5 rounded-xl bg-[#fbf9f5] border border-[#d9d1c1] text-[#0b1a33]"
            >
              {['Apartment', 'Villa', 'Townhouse', 'Penthouse', 'Studio', 'Office'].map(t => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={askingPrice}
              onChange={e => setAskingPrice(e.target.value)}
              placeholder="Price (AED)"
              className="px-3 py-2.5 rounded-xl bg-[#fbf9f5] border border-[#d9d1c1] text-[#0b1a33]"
            />
            <input
              type="number"
              value={areaSqft}
              onChange={e => setAreaSqft(e.target.value)}
              placeholder="Area sq ft"
              className="px-3 py-2.5 rounded-xl bg-[#fbf9f5] border border-[#d9d1c1] text-[#0b1a33]"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              required
              value={ownerName}
              onChange={e => setOwnerName(e.target.value)}
              placeholder="Verified Owner Name *"
              className="px-3 py-2.5 rounded-xl bg-[#fbf9f5] border border-[#d9d1c1] text-[#0b1a33]"
            />
            <input
              type="text"
              value={ownerPhone}
              onChange={e => setOwnerPhone(e.target.value)}
              placeholder="Owner Mobile (+971…)"
              className="px-3 py-2.5 rounded-xl bg-[#fbf9f5] border border-[#d9d1c1] text-[#0b1a33]"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={formARef}
              onChange={e => setFormARef(e.target.value)}
              placeholder="Signed DLD Form A Ref."
              className="px-3 py-2.5 rounded-xl bg-[#fbf9f5] border border-[#d9d1c1] text-[#0b1a33]"
            />
            <input
              type="text"
              value={trakheesiNo}
              onChange={e => setTrakheesiNo(e.target.value)}
              placeholder="Trakheesi Permit No."
              className="px-3 py-2.5 rounded-xl bg-[#fbf9f5] border border-[#d9d1c1] text-[#0b1a33]"
            />
          </div>
          <input
            type="text"
            value={conditionNotes}
            onChange={e => setConditionNotes(e.target.value)}
            placeholder="Property condition checklist & site inspection notes…"
            className="w-full px-3 py-2.5 rounded-xl bg-[#fbf9f5] border border-[#d9d1c1] text-[#0b1a33]"
          />
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-2xl text-white font-bold text-xs border-0 cursor-pointer shadow-md"
            style={{ background: 'linear-gradient(135deg, #1b3a6b, #0b1a33)' }}
          >
            {submitting ? 'Submitting to SWK OS…' : 'Submit Sourced Inventory to SWK OS Pipeline'}
          </motion.button>
        </form>
      </motion.div>

      {/* 2. My Sourced Inventory Pipeline Dashboard with Property Photography (Features 32, 33, 37, 39) */}
      <motion.div
        variants={itemRise}
        className="rounded-3xl bg-white border border-[#e7e1d4] p-4 shadow-[0_14px_34px_-22px_rgba(11,26,51,0.32)] space-y-3"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold font-display text-sm text-[#0b1a33]">
              My Sourced Inventory Pipeline ({submissions.length})
            </h3>
            <p className="text-[11px] text-[#6b7488]">
              Submitted → Inventory Verified → Compliance Verified → Published to Stock
            </p>
          </div>
        </div>

        {submissions.length === 0 ? (
          <div className="p-5 rounded-2xl bg-[#fbf8f2] border border-[#efe9dc] text-xs text-[#6b7488] text-center">
            No sourced inventory submitted yet. Use the 60-second sourcing form or Camera OCR above.
          </div>
        ) : (
          <div className="space-y-3">
            {submissions.map((sub, idx) => {
              const photoUrl = resolvePropertyPhoto(sub.building_name, idx)
              const gateStep =
                sub.status === 'Published to Stock'
                  ? 4
                  : sub.status === 'Compliance Verified'
                    ? 3
                    : sub.status === 'Inventory Verified'
                      ? 2
                      : 1
              return (
                <div
                  key={sub.id}
                  className="p-3.5 rounded-2xl bg-[#fbf8f2] border border-[#e7e1d4] space-y-2.5"
                >
                  <div className="flex items-start gap-3">
                    <img
                      src={photoUrl}
                      alt={sub.building_name}
                      className="w-16 h-16 rounded-xl object-cover border border-[#d9d1c1] shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[10px] font-mono text-[#6b7488]">
                          {sub.submission_no} · {sub.conflict_status}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9.5px] font-bold shrink-0 ${
                            sub.status === 'Published to Stock'
                              ? 'bg-[#e3f4ec] text-[#157a52]'
                              : sub.status === 'Rejected' || sub.status === 'Duplicate / Conflict Hold'
                                ? 'bg-[#fbe4dd] text-[#a33a22]'
                                : 'bg-[#f3ead8] text-[#7d5f2c]'
                          }`}
                        >
                          {sub.status}
                        </span>
                      </div>
                      <div className="font-bold font-display text-sm text-[#0b1a33] truncate">
                        {sub.building_name} – Unit {sub.unit_no} ({sub.property_type})
                      </div>
                      <div className="text-xs text-[#14305c] font-bold mt-0.5">
                        AED {Number(sub.asking_price || 0).toLocaleString()} · {sub.area_sqft} sq ft · Owner:{' '}
                        {sub.owner_name}
                      </div>
                    </div>
                  </div>

                  {/* Animated 4-Gate Progress Indicator */}
                  <div className="grid grid-cols-4 gap-1 pt-0.5">
                    {['1. Submitted', '2. Inv Check', '3. Trakheesi', '4. Live Stock'].map((label, sIdx) => (
                      <div key={label} className="space-y-1">
                        <div
                          className={`h-1.5 rounded-full ${
                            sIdx < gateStep ? 'bg-[#14305c]' : 'bg-[#e7e1d4]'
                          }`}
                        />
                        <div className="text-[9px] font-semibold text-[#6b7488] truncate">{label}</div>
                      </div>
                    ))}
                  </div>

                  {sub.status !== 'Published to Stock' && (
                    <div className="p-2 rounded-xl bg-white text-[11px] text-[#3a4660] border border-[#e7e1d4]">
                      <b className="text-[#0b1a33]">Publication Gate:</b>{' '}
                      {sub.status === 'Submitted'
                        ? 'Waiting for Independent Inventory Team Verification of Owner Form A.'
                        : sub.status === 'Inventory Verified'
                          ? 'Waiting for Compliance Officer Trakheesi Permit Sign-off.'
                          : sub.status === 'Compliance Verified'
                            ? 'Ready for Second-Person Manager Publication Approval.'
                            : sub.rejection_reason || 'On Hold'}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => void onReconfirmPrice(sub.id, Number(sub.asking_price || 0))}
                      className="px-3 py-1 rounded-full bg-white text-[#14305c] border border-[#d9d1c1] hover:border-[#c9a96e] text-[11px] font-bold cursor-pointer"
                    >
                      ✓ Reconfirm Owner Price ({sub.price_confirmed_date || 'Today'})
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => void onOwnerWithdraw(sub.id, 'Owner instructed withdrawal from marketing')}
                      className="px-3 py-1 rounded-full bg-white text-[#c4492f] border border-[#f2bcc3] text-[11px] font-bold cursor-pointer"
                    >
                      Owner Withdrawal Alert
                    </motion.button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </motion.div>

      {/* 3. Property Key Handover Vault (Feature #36) */}
      <motion.div
        variants={itemRise}
        className="rounded-3xl bg-white border border-[#e7e1d4] p-4 shadow-xs space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound size={16} className="text-[#9a7a42]" />
            <h3 className="font-bold font-display text-sm text-[#0b1a33]">Property Key Handover Vault</h3>
          </div>
          <span className="text-[10.5px] font-semibold text-[#6b7488]">Audited Custody</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <input
            type="text"
            value={keyBuilding}
            onChange={e => setKeyBuilding(e.target.value)}
            placeholder="Building"
            className="px-2.5 py-2 rounded-xl bg-[#fbf9f5] border border-[#d9d1c1] text-[#0b1a33]"
          />
          <input
            type="text"
            value={keyUnit}
            onChange={e => setKeyUnit(e.target.value)}
            placeholder="Unit No."
            className="px-2.5 py-2 rounded-xl bg-[#fbf9f5] border border-[#d9d1c1] text-[#0b1a33]"
          />
          <select
            value={keyAction}
            onChange={e => setKeyAction(e.target.value as any)}
            className="px-2 py-2 rounded-xl bg-[#fbf9f5] border border-[#d9d1c1] text-[#0b1a33]"
          >
            <option value="Received from Owner">Received from Owner</option>
            <option value="Checked Out for Viewing">Checked Out for Viewing</option>
            <option value="Returned to Office Vault">Returned to Office Vault</option>
            <option value="Handed to Buyer/Tenant">Handed to Buyer/Tenant</option>
          </select>
        </div>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => void onLogKey({ building_name: keyBuilding, unit_no: keyUnit, action: keyAction })}
          className="w-full py-2.5 rounded-2xl bg-[#0b1a33] text-[#f3ead8] font-bold text-xs border-0 cursor-pointer"
        >
          Record Key Custody Event
        </motion.button>
        {keyLogs.length > 0 && (
          <div className="space-y-1.5 pt-1">
            {keyLogs.slice(0, 4).map((k: any) => (
              <div
                key={k.id}
                className="p-2.5 rounded-xl bg-[#fbf8f2] border border-[#efe9dc] flex items-center justify-between text-[11px]"
              >
                <span className="text-[#0b1a33]">
                  <b>{k.key_tag}</b> · {k.building_name} #{k.unit_no}
                </span>
                <span className="font-bold text-[#9a7a42]">{k.action}</span>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* 4. Developer NOC Status Tracker with Official Developer Logos (Feature #38) */}
      <motion.div
        variants={itemRise}
        className="rounded-3xl bg-white border border-[#e7e1d4] p-4 shadow-xs space-y-2.5"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCheck2 size={16} className="text-[#9a7a42]" />
            <h3 className="font-bold font-display text-sm text-[#0b1a33]">
              Developer NOC Clearance Tracker ({nocRequests.length})
            </h3>
          </div>
        </div>
        {nocRequests.length === 0 ? (
          <div className="p-3 rounded-2xl bg-[#fbf8f2] border border-[#efe9dc] text-xs text-[#6b7488]">
            No active Developer NOC clearances pending. NOCs are triggered once Form F / Sales Contract is signed.
          </div>
        ) : (
          nocRequests.map((n, idx) => {
            const devBrand = resolveDeveloperBrand(n.transaction_type || n.notes, idx)
            return (
              <div
                key={n.id}
                className="p-3.5 rounded-2xl bg-[#fbf8f2] border border-[#e7e1d4] text-xs flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-10 rounded-xl bg-white border border-[#efe9dc] p-1.5 flex items-center justify-center shrink-0">
                    <img src={devBrand.logo} alt={devBrand.name} className="max-h-full max-w-full object-contain" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-[#0b1a33] truncate">
                      {n.request_no} · {devBrand.name}
                    </div>
                    <div className="text-[11px] text-[#6b7488]">
                      Service Charges: <b>{n.service_charges_cleared ? 'Cleared ✓' : 'Pending'}</b> · Transfer Gate:{' '}
                      <b>{n.closing_stage_unlocked ? 'Unlocked' : 'Locked'}</b>
                    </div>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-[#f3ead8] text-[#7d5f2c] text-[10px] font-bold shrink-0">
                  {n.status}
                </span>
              </div>
            )
          })
        )}
      </motion.div>
    </motion.div>
  )
}

/**
 * TAB 4: CRM Leads, One-Tap Call Logger, Digital Offers, Pipeline & Official WhatsApp WABA (Features 14–16, 21–27, 51–60)
 */
export function CrmAndDealsTab({
  data,
  onQuickLogLead,
  onOpenComparison,
  onSubmitOffer,
  onGetAiDraft,
  onReplyComm,
  onEscalateComm,
}: {
  data: any
  onQuickLogLead: (leadId: number, outcome: string, channel: string, notes?: string) => Promise<void>
  onOpenComparison: () => void
  onSubmitOffer: (payload: any) => Promise<void>
  onGetAiDraft: (commId: number, lang: 'en' | 'ar' | 'ru' | 'zh' | 'fr') => Promise<string>
  onReplyComm: (commId: number, message: string, lang: string) => Promise<void>
  onEscalateComm: (commId: number, title: string, summary: string) => Promise<void>
}) {
  const leads: any[] = data?.leads || []
  const properties: any[] = data?.properties || []
  const transactions: any[] = data?.transactions || []
  const communications: any[] = data?.communications || []

  const [offerPropId, setOfferPropId] = useState<number>(properties[0]?.id || 1)
  const [offerPrice, setOfferPrice] = useState('6750000')
  const [paymentTerms, setPaymentTerms] = useState('Cash')
  const [replyTextById, setReplyTextById] = useState<Record<number, string>>({})
  const [langById, setLangById] = useState<Record<number, 'en' | 'ar' | 'ru' | 'zh' | 'fr'>>({})

  return (
    <motion.div variants={listStagger} initial="hidden" animate="show" className="space-y-4">
      {/* 1. Assigned Business WhatsApp Conversations + Multilingual AI Reply Drafts (Features 51–60) */}
      <motion.div
        variants={itemRise}
        className="rounded-3xl bg-white border border-[#e7e1d4] p-4 shadow-[0_14px_34px_-22px_rgba(11,26,51,0.32)] space-y-3"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-[#9a7a42]">
              Supervised Omnichannel Desk
            </div>
            <h3 className="font-bold font-display text-sm text-[#0b1a33]">
              Company WhatsApp Business (WABA) Inbox ({communications.length})
            </h3>
          </div>
          <div className="w-9 h-9 rounded-xl bg-[#def1ef] text-[#17625f] grid place-items-center">
            <MessageSquare size={18} />
          </div>
        </div>

        {communications.length === 0 ? (
          <div className="p-4 rounded-2xl bg-[#fbf8f2] border border-[#efe9dc] text-xs text-[#6b7488] text-center">
            No unassigned or open WABA conversations.
          </div>
        ) : (
          <div className="space-y-3">
            {communications.map(c => {
              const lang = langById[c.id] || 'en'
              const replyText = replyTextById[c.id] || ''
              return (
                <div
                  key={c.id}
                  className="p-3.5 rounded-2xl bg-[#fbf8f2] border border-[#e7e1d4] space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-mono text-[#6b7488]">
                        {c.comm_no} · {c.business_account_ref}
                      </span>
                      <div className="font-bold font-display text-sm text-[#0b1a33]">{c.customer_phone}</div>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        c.status === 'Responded'
                          ? 'bg-[#e3f4ec] text-[#157a52]'
                          : 'bg-[#f3ead8] text-[#7d5f2c]'
                      }`}
                    >
                      {c.status} {c.escalation_tag && c.escalation_tag !== 'None' ? `· ${c.escalation_tag}` : ''}
                    </span>
                  </div>

                  {/* Client Chat Bubble */}
                  <div className="p-3 rounded-2xl rounded-tl-xs bg-white text-xs text-[#0b1a33] border border-[#e7e1d4] shadow-2xs">
                    {c.message_summary}
                  </div>
                  {c.ai_summary && (
                    <div className="text-[11px] text-[#9a7a42] flex items-center gap-1.5 font-medium">
                      <Sparkles size={12} className="text-[#c9a96e] shrink-0" />
                      <span>
                        <b className="text-[#0b1a33]">AI Briefing:</b> {c.ai_summary}
                      </span>
                    </div>
                  )}

                  {/* Multilingual AI Draft Selector (Features #54 & #55) */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-bold text-[#6b7488] flex items-center gap-1">
                      <Languages size={12} className="text-[#9a7a42]" /> AI Draft:
                    </span>
                    {(['en', 'ar', 'ru', 'zh', 'fr'] as const).map(l => (
                      <motion.button
                        whileTap={{ scale: 0.92 }}
                        key={l}
                        type="button"
                        onClick={async () => {
                          setLangById(prev => ({ ...prev, [c.id]: l }))
                          const draft = await onGetAiDraft(c.id, l)
                          setReplyTextById(prev => ({ ...prev, [c.id]: draft }))
                        }}
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border cursor-pointer transition ${
                          lang === l
                            ? 'bg-[#0b1a33] text-[#f3ead8] border-[#0b1a33]'
                            : 'bg-white text-[#3a4660] border-[#d9d1c1]'
                        }`}
                      >
                        {l.toUpperCase()}
                      </motion.button>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        void onEscalateComm(c.id, `Client Escalation on ${c.comm_no}`, c.message_summary)
                      }
                      className="ml-auto px-2.5 py-0.5 rounded-full bg-[#fbe4dd] text-[#a33a22] text-[10px] font-bold border-0 cursor-pointer"
                    >
                      Escalate to Supervisor
                    </button>
                  </div>

                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={replyText}
                      onChange={e => setReplyTextById(prev => ({ ...prev, [c.id]: e.target.value }))}
                      placeholder="Type official WABA response or tap an AI Draft language above…"
                      className="flex-1 px-3 py-2 rounded-xl bg-white border border-[#d9d1c1] text-xs text-[#0b1a33]"
                    />
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      type="button"
                      onClick={async () => {
                        if (!replyText.trim()) return
                        await onReplyComm(c.id, replyText, lang)
                        setReplyTextById(prev => ({ ...prev, [c.id]: '' }))
                      }}
                      className="px-4 py-2 rounded-full text-[#0b1a33] text-xs font-bold border-0 cursor-pointer flex items-center gap-1 shadow-xs"
                      style={{ background: 'linear-gradient(135deg, #f1e3c2, #c9a96e)' }}
                    >
                      <Send size={12} /> Send
                    </motion.button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </motion.div>

      {/* 2. Lead Priority Queue, AI Lead Briefing & One-Tap Call Logging (Features 14–16, 56) */}
      <motion.div
        variants={itemRise}
        className="rounded-3xl bg-white border border-[#e7e1d4] p-4 shadow-[0_14px_34px_-22px_rgba(11,26,51,0.32)] space-y-3"
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="font-bold font-display text-sm text-[#0b1a33]">
              Assigned CRM Leads & 1-Tap Call Logger ({leads.length})
            </h3>
            <p className="text-[11px] text-[#6b7488]">
              Tap any call outcome to log activity and advance lead automatically
            </p>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onOpenComparison}
            className="px-3 py-1.5 rounded-full bg-[#f3ead8] text-[#7d5f2c] font-bold text-xs border border-[#e3d1ad] cursor-pointer flex items-center gap-1 shrink-0"
          >
            <Scale size={13} /> Compare Stock
          </motion.button>
        </div>

        <div className="space-y-2.5">
          {leads.map((l, idx) => {
            const comm = resolveCommunityMedia(l.destination || l.notes, idx)
            return (
              <div
                key={l.id}
                className="p-3.5 rounded-2xl bg-[#fbf8f2] border border-[#e7e1d4] space-y-2.5"
              >
                <div className="flex items-start gap-3">
                  <img
                    src={comm.image}
                    alt={comm.name}
                    className="w-12 h-12 rounded-xl object-cover border border-[#d9d1c1] shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[10px] font-mono text-[#6b7488]">
                        {l.lead_no} · {l.source}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-white text-[#0b1a33] border border-[#d9d1c1] text-[10px] font-bold">
                        {l.status}
                      </span>
                    </div>
                    <div className="font-bold font-display text-sm text-[#0b1a33] truncate">
                      {l.contact_name || l.company}
                    </div>
                    <div className="text-xs text-[#14305c] font-bold">
                      {l.interest || 'Property Purchase'} · {l.destination || comm.name} · Budget AED{' '}
                      {Number(l.est_value || 0).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* AI Lead Briefing (Feature #14) */}
                {l.notes && (
                  <div className="p-2.5 rounded-xl bg-white text-[11px] text-[#3a4660] border border-[#e7e1d4]">
                    <b className="text-[#9a7a42]">AI Lead Briefing:</b> {l.notes}
                  </div>
                )}

                {/* One-Tap Call Logging Buttons (Feature #16) */}
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() =>
                      void onQuickLogLead(
                        l.id,
                        'Connected',
                        'Call',
                        'Qualified buyer requirements & confirmed viewing slot'
                      )
                    }
                    className="px-3 py-1.5 rounded-full text-white text-[11px] font-bold border-0 cursor-pointer flex items-center gap-1"
                    style={{ background: 'linear-gradient(135deg, #1b3a6b, #0b1a33)' }}
                  >
                    <PhoneCall size={11} className="text-[#c9a96e]" /> Connected – Interested
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() =>
                      void onQuickLogLead(
                        l.id,
                        'Callback requested',
                        'Call',
                        'Client in meeting; requested callback at 5 PM'
                      )
                    }
                    className="px-2.5 py-1.5 rounded-full bg-white text-[#0b1a33] border border-[#d9d1c1] text-[11px] font-semibold cursor-pointer"
                  >
                    🕒 Callback Queue
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() =>
                      void onQuickLogLead(l.id, 'No answer', 'Call', 'No answer; sent official WABA brochure')
                    }
                    className="px-2.5 py-1.5 rounded-full bg-white text-[#6b7488] border border-[#d9d1c1] text-[11px] cursor-pointer"
                  >
                    No Answer
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() =>
                      void onQuickLogLead(
                        l.id,
                        'Quote requested',
                        'WhatsApp',
                        'Sent side-by-side comparison & ROI calculation'
                      )
                    }
                    className="px-2.5 py-1.5 rounded-full bg-[#f3ead8] text-[#7d5f2c] border border-[#e3d1ad] text-[11px] font-bold cursor-pointer"
                  >
                    💬 WABA Brochure Sent
                  </motion.button>
                </div>
              </div>
            )
          })}
        </div>
      </motion.div>

      {/* 3. Digital Offer Submission (Feature #23) */}
      <motion.div
        variants={itemRise}
        className="rounded-3xl bg-white border border-[#e7e1d4] p-4 shadow-xs space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HandCoins size={16} className="text-[#9a7a42]" />
            <h3 className="font-bold font-display text-sm text-[#0b1a33]">Digital Offer Submission</h3>
          </div>
          <span className="text-[10px] font-bold text-[#9a7a42] uppercase tracking-wider">DLD Form F Ready</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <select
            value={offerPropId}
            onChange={e => setOfferPropId(Number(e.target.value))}
            className="px-3 py-2.5 rounded-xl bg-[#fbf9f5] border border-[#d9d1c1] text-[#0b1a33]"
          >
            {properties.map(p => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={offerPrice}
            onChange={e => setOfferPrice(e.target.value)}
            placeholder="Offer Price (AED)"
            className="px-3 py-2.5 rounded-xl bg-[#fbf9f5] border border-[#d9d1c1] text-[#0b1a33]"
          />
          <select
            value={paymentTerms}
            onChange={e => setPaymentTerms(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-[#fbf9f5] border border-[#d9d1c1] text-[#0b1a33]"
          >
            <option value="Cash">Cash Buyer</option>
            <option value="Mortgage">Mortgage Pre-Approved</option>
            <option value="50/50">Developer 50/50 Plan</option>
          </select>
        </div>
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() =>
            void onSubmitOffer({
              property_id: offerPropId || properties[0]?.id,
              lead_id: leads[0]?.id,
              offer_price: Number(offerPrice || 5000000),
              payment_terms: paymentTerms,
              subject_to_finance: paymentTerms === 'Mortgage',
            })
          }
          className="w-full py-3 rounded-2xl text-[#0b1a33] font-bold text-xs border-0 cursor-pointer shadow-sm"
          style={{ background: 'linear-gradient(135deg, #f1e3c2 0%, #c9a96e 100%)' }}
        >
          Submit Formal Digital Offer to SWK OS
        </motion.button>
      </motion.div>

      {/* 4. Personal Deal Pipeline, Mortgage Readiness & Closing Checklist (Features 24–27, 60) */}
      <motion.div
        variants={itemRise}
        className="rounded-3xl bg-white border border-[#e7e1d4] p-4 shadow-xs space-y-2.5"
      >
        <h3 className="font-bold font-display text-sm text-[#0b1a33]">
          Personal Deal Pipeline & 4-Gate Closing Checklist ({transactions.length})
        </h3>
        {transactions.map(t => {
          const gatesDone = [
            t.kyc_cleared,
            t.forms_completed,
            t.noc_verified,
            t.financially_reconciled,
          ].filter(Boolean).length
          return (
            <div
              key={t.id}
              className="p-3.5 rounded-2xl bg-[#fbf8f2] border border-[#e7e1d4] space-y-2.5 text-xs"
            >
              <div className="flex items-center justify-between">
                <b className="text-[#0b1a33] font-display">
                  {t.transaction_no} · AED {Number(t.deal_value || 0).toLocaleString()}
                </b>
                <span className="px-2.5 py-0.5 rounded-full bg-[#0b1a33] text-[#f3ead8] text-[10px] font-bold">
                  {t.stage} ({gatesDone}/4 Gates)
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-[#e7e1d4] overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'linear-gradient(90deg, #14305c, #c9a96e)' }}
                  initial={{ width: 0 }}
                  animate={{ width: `${(gatesDone / 4) * 100}%` }}
                  transition={{ duration: 0.7 }}
                />
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                <div className="p-2 rounded-xl bg-white border border-[#efe9dc]">
                  {t.kyc_cleared ? '✅' : '⏳'} Buyer/Seller KYC & AML
                </div>
                <div className="p-2 rounded-xl bg-white border border-[#efe9dc]">
                  {t.forms_completed ? '✅' : '⏳'} RERA Forms A / B / F
                </div>
                <div className="p-2 rounded-xl bg-white border border-[#efe9dc]">
                  {t.noc_verified ? '✅' : '⏳'} Developer NOC Verified
                </div>
                <div className="p-2 rounded-xl bg-white border border-[#efe9dc]">
                  {t.financially_reconciled ? '✅' : '⏳'} Invoice & Bank Receipt
                </div>
              </div>
            </div>
          )
        })}
      </motion.div>
    </motion.div>
  )
}

/**
 * TAB 5: Commissions, Digital RERA/HR Wallet, Attendance Corrections, Knowledge Assistant & Coaching (Features 5, 7–13, 59, 61–65)
 */
export function PayHrAndSecurityTab({
  data,
  onRequestAttendanceCorrection,
  onToggleChecklist,
  onShiftHandover,
  onSubmitLeave,
  onAskKnowledge,
}: {
  data: any
  onRequestAttendanceCorrection: (id: number, reason: string) => Promise<void>
  onToggleChecklist: (listType: 'workday' | 'onboarding' | 'exit', itemId: string, done: boolean) => Promise<void>
  onShiftHandover: (toUserId: number, notes: string) => Promise<void>
  onSubmitLeave: (payload: any) => Promise<void>
  onAskKnowledge: (question: string) => Promise<any>
}) {
  const commSummary = data?.commission_summary || {}
  const commissions: any[] = data?.commissions || []
  const score = data?.verified_activity_score || {}
  const hrWallet = data?.hr_wallet || {}
  const attendanceHistory: any[] = data?.attendance_history || []
  const workday = data?.workday || {}
  const colleagues: any[] = data?.colleagues || []
  const qaReviews: any[] = data?.qa_reviews || []

  const [corrReason, setCorrReason] = useState('')
  const [corrId, setCorrId] = useState<number | null>(null)
  const [handoverUser, setHandoverUser] = useState<number>(colleagues[0]?.id || 1)
  const [handoverNotes, setHandoverNotes] = useState('')
  const [leaveType, setLeaveType] = useState('Annual')
  const [leaveFrom, setLeaveFrom] = useState(data?.work_date || '2026-11-01')
  const [leaveTo, setLeaveTo] = useState(data?.work_date || '2026-11-03')
  const [leaveReason, setLeaveReason] = useState('')
  const [kbQuery, setKbQuery] = useState('')
  const [kbAnswer, setKbAnswer] = useState<string | null>(null)

  return (
    <motion.div variants={listStagger} initial="hidden" animate="show" className="space-y-4">
      {/* 1. Personal Commission Tracker — 6 Separate Stage Balances in SWK Midnight & Champagne */}
      <motion.div
        variants={itemRise}
        className="relative overflow-hidden rounded-3xl text-white p-4 shadow-[0_18px_40px_-20px_rgba(11,26,51,0.65)] space-y-3.5 border border-[#c9a96e]/40"
        style={{ background: 'linear-gradient(145deg, #08142a 0%, #0b1a33 55%, #14305c 100%)' }}
      >
        <img
          src={SWK_BRAND.skylineFront}
          alt=""
          aria-hidden
          className="absolute bottom-0 left-0 right-0 w-full h-16 object-cover opacity-12 pointer-events-none"
        />

        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#c9a96e] font-bold">
              Commission & Deal Transparency (Control 3.17)
            </div>
            <h3 className="text-lg font-bold font-display text-white">
              6-Stage Commission Waterfall
            </h3>
          </div>
          <img src={SWK_BRAND.logoWhite} alt="SWK" className="h-7 w-auto opacity-90" />
        </div>

        <div className="relative z-10 grid grid-cols-3 gap-2 text-xs">
          <div className="p-2.5 rounded-2xl bg-white/[0.07] border border-white/10">
            <div className="text-[10px] text-[#b8c6de]">1. Entitlement</div>
            <div className="font-bold font-display text-sm text-white mt-0.5">
              AED <AnimatedNumber value={Number(commSummary.entitlement_total || 0)} />
            </div>
          </div>
          <div className="p-2.5 rounded-2xl bg-white/[0.07] border border-white/10">
            <div className="text-[10px] text-[#b8c6de]">2. Earned</div>
            <div className="font-bold font-display text-sm text-white mt-0.5">
              AED <AnimatedNumber value={Number(commSummary.earned_total || 0)} />
            </div>
          </div>
          <div className="p-2.5 rounded-2xl bg-white/[0.07] border border-white/10">
            <div className="text-[10px] text-[#b8c6de]">3. Invoiced</div>
            <div className="font-bold font-display text-sm text-white mt-0.5">
              AED <AnimatedNumber value={Number(commSummary.invoiced_total || 0)} />
            </div>
          </div>
          <div className="p-2.5 rounded-2xl bg-white/[0.07] border border-white/10">
            <div className="text-[10px] text-[#b8c6de]">4. Cash Collected</div>
            <div className="font-bold font-display text-sm text-white mt-0.5">
              AED <AnimatedNumber value={Number(commSummary.collected_total || 0)} />
            </div>
          </div>
          <div className="p-2.5 rounded-2xl bg-[#c9a96e]/20 border border-[#c9a96e]">
            <div className="text-[10px] text-[#f3ead8] font-semibold">5. Net Payable</div>
            <div className="font-extrabold font-display text-sm text-[#f3ead8] mt-0.5">
              AED <AnimatedNumber value={Number(commSummary.payable_total || 0)} />
            </div>
          </div>
          <div className="p-2.5 rounded-2xl bg-[#1f9d6b]/20 border border-[#4fd39a]/40">
            <div className="text-[10px] text-[#8fe3bd]">6. Paid Out</div>
            <div className="font-bold font-display text-sm text-[#8fe3bd] mt-0.5">
              AED <AnimatedNumber value={Number(commSummary.paid_total || 0)} />
            </div>
          </div>
        </div>

        <div className="relative z-10 space-y-2">
          {commissions.map(c => (
            <div
              key={c.id}
              className="p-3 rounded-2xl bg-white/[0.08] backdrop-blur-xs border border-white/15 text-xs space-y-1"
            >
              <div className="flex items-center justify-between">
                <b className="text-[#f3ead8]">
                  {c.entitlement_no} · {c.deal_type} ({c.split_pct}% Split)
                </b>
                <span className="px-2.5 py-0.5 rounded-full bg-[#c9a96e] text-[#0b1a33] text-[10px] font-bold">
                  {c.status}
                </span>
              </div>
              <div className="text-[11px] text-[#c8d3e6]">
                Next Payout Gate: {c.dispute_notes || 'Awaiting bank receipt reconciliation & 3-way treasury sign-off'}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* 2. Verified Activity Score & QA Coaching Feedback (Features 59, 61, 64, 65) */}
      <motion.div
        variants={itemRise}
        className="rounded-3xl bg-white border border-[#e7e1d4] p-4 shadow-xs space-y-3"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-[#9a7a42]">
              Audited Performance Index
            </div>
            <h3 className="font-bold font-display text-sm text-[#0b1a33]">
              Verified Activity Score & Quality Coaching
            </h3>
            <p className="text-[11px] text-[#6b7488]">{score.policy_note}</p>
          </div>
          <div
            className="w-14 h-14 rounded-2xl border border-[#c9a96e] grid place-items-center font-extrabold font-display text-lg text-[#0b1a33] shrink-0 shadow-xs"
            style={{ background: 'linear-gradient(135deg, #fbf5e8, #efe2c6)' }}
          >
            {score.total_score || 92}
          </div>
        </div>
        {qaReviews.map(q => (
          <div key={q.id} className="p-3 rounded-2xl bg-[#fbf8f2] border border-[#efe9dc] text-xs space-y-1">
            <div className="flex items-center justify-between">
              <b className="text-[#0b1a33]">
                {q.qa_no} · {q.channel}
              </b>
              <span className="font-bold text-[#14305c]">Score: {q.overall_score}/100</span>
            </div>
            <div className="text-[11px] text-[#3a4660]">
              <b>Findings:</b> {q.findings}
            </div>
            {q.coaching_plan && (
              <div className="text-[11px] text-[#9a7a42]">
                <b>Coaching:</b> {q.coaching_plan}
              </div>
            )}
          </div>
        ))}
      </motion.div>

      {/* 3. Digital RERA Broker Card & HR Document Wallet (Features 9 & 10) */}
      <motion.div
        variants={itemRise}
        className="rounded-3xl bg-white border border-[#e7e1d4] p-4 shadow-xs space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IdCard size={16} className="text-[#9a7a42]" />
            <h3 className="font-bold font-display text-sm text-[#0b1a33]">
              Digital RERA Broker Card & HR Document Wallet
            </h3>
          </div>
          <span className="text-[10px] font-bold text-[#157a52] bg-[#e3f4ec] px-2.5 py-0.5 rounded-full">
            DLD Verified
          </span>
        </div>

        {/* Holographic-styled Digital RERA Broker Credential Card */}
        <div
          className="relative overflow-hidden rounded-2xl p-4 text-white border border-[#c9a96e]/50 shadow-md"
          style={{ background: 'linear-gradient(135deg, #14305c 0%, #0b1a33 100%)' }}
        >
          <img
            src={SWK_BRAND.skylineFront}
            alt=""
            aria-hidden
            className="absolute bottom-0 left-0 right-0 w-full h-12 object-cover opacity-15 pointer-events-none"
          />
          <div className="relative z-10 flex items-center justify-between mb-3">
            <div>
              <div className="text-[9.5px] uppercase tracking-[0.22em] text-[#dcc8a2] font-bold">
                Dubai Land Department · RERA Pass
              </div>
              <div className="font-display font-bold text-sm text-white mt-0.5">
                {data?.user?.name || 'SWK Certified Broker'}
              </div>
            </div>
            <img src={SWK_BRAND.logoWhite} alt="SWK" className="h-6 w-auto" />
          </div>
          <div className="relative z-10 grid grid-cols-3 gap-2 text-[11px] pt-2 border-t border-white/15">
            <div>
              <div className="text-[9px] uppercase text-white/60">RERA BRN</div>
              <div className="font-mono font-bold text-[#f3ead8]">{data?.agent?.rera_brn || 'BRN-51517-DXB'}</div>
            </div>
            <div>
              <div className="text-[9px] uppercase text-white/60">ORN Licence</div>
              <div className="font-mono font-bold text-white">51517</div>
            </div>
            <div>
              <div className="text-[9px] uppercase text-white/60">Status</div>
              <div className="font-bold text-[#8fe3bd] flex items-center gap-1">
                <ShieldCheck size={11} /> Active
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {(hrWallet.expiry_reminders || []).map((doc: any) => (
            <div
              key={doc.id}
              className="p-3 rounded-2xl bg-[#fbf8f2] border border-[#efe9dc] flex items-center justify-between text-xs"
            >
              <div>
                <div className="font-bold text-[#0b1a33]">{doc.title}</div>
                <div className="text-[11px] font-mono text-[#6b7488]">
                  Ref: {doc.ref} · Expires: {doc.expiry_date}
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-[#e3f4ec] text-[#157a52] text-[10px] font-bold">
                {doc.status}
              </span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* 4. Attendance History & Challenge / Correction Request (Feature #5) */}
      <motion.div
        variants={itemRise}
        className="rounded-3xl bg-white border border-[#e7e1d4] p-4 shadow-xs space-y-2.5"
      >
        <h3 className="font-bold font-display text-sm text-[#0b1a33]">
          Attendance History & Correction Requests ({attendanceHistory.length})
        </h3>
        <div className="space-y-2">
          {attendanceHistory.slice(0, 5).map(att => (
            <div
              key={att.id}
              className="p-3 rounded-2xl bg-[#fbf8f2] border border-[#efe9dc] text-xs space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <b className="text-[#0b1a33]">
                  {att.work_date} · {att.terminal_type} ({att.event_no})
                </b>
                <button
                  onClick={() => setCorrId(corrId === att.id ? null : att.id)}
                  className="px-2.5 py-0.5 rounded-full bg-white border border-[#d9d1c1] text-[10px] font-bold text-[#14305c] cursor-pointer"
                >
                  Challenge / Correct
                </button>
              </div>
              <div className="text-[11px] text-[#6b7488]">
                In: {String(att.check_in_at || '').slice(11, 16) || '09:00'} · Out:{' '}
                {String(att.check_out_at || '').slice(11, 16) || 'Active'} · Status: {att.duty_status}
              </div>
              {corrId === att.id && (
                <div className="flex gap-1.5 pt-1">
                  <input
                    type="text"
                    value={corrReason}
                    onChange={e => setCorrReason(e.target.value)}
                    placeholder="Reason for attendance correction (e.g. client morning meeting at DLD)…"
                    className="flex-1 px-2.5 py-1.5 rounded-xl bg-white border border-[#d9d1c1] text-xs text-[#0b1a33]"
                  />
                  <button
                    onClick={async () => {
                      await onRequestAttendanceCorrection(att.id, corrReason)
                      setCorrId(null)
                      setCorrReason('')
                    }}
                    className="px-3.5 py-1.5 rounded-full bg-[#0b1a33] text-[#f3ead8] text-xs font-bold border-0 cursor-pointer"
                  >
                    Submit
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </motion.div>

      {/* 5. Leave Request & Shift Handover (Features #7 & #8) */}
      <motion.div variants={itemRise} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-3xl bg-white border border-[#e7e1d4] p-4 shadow-xs space-y-2.5 text-xs">
          <div className="font-bold font-display text-sm text-[#0b1a33] flex items-center gap-1.5">
            <Plane size={15} className="text-[#9a7a42]" /> Leave & Emergency Absence
          </div>
          <select
            value={leaveType}
            onChange={e => setLeaveType(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-[#fbf9f5] border border-[#d9d1c1] text-[#0b1a33]"
          >
            <option value="Annual">Annual Leave</option>
            <option value="Sick">Medical / Sick Leave</option>
            <option value="Compassionate">Emergency / Compassionate</option>
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={leaveFrom}
              onChange={e => setLeaveFrom(e.target.value)}
              className="px-2.5 py-2 rounded-xl bg-[#fbf9f5] border border-[#d9d1c1] text-[#0b1a33]"
            />
            <input
              type="date"
              value={leaveTo}
              onChange={e => setLeaveTo(e.target.value)}
              className="px-2.5 py-2 rounded-xl bg-[#fbf9f5] border border-[#d9d1c1] text-[#0b1a33]"
            />
          </div>
          <input
            type="text"
            value={leaveReason}
            onChange={e => setLeaveReason(e.target.value)}
            placeholder="Reason & cover notes…"
            className="w-full px-3 py-2 rounded-xl bg-[#fbf9f5] border border-[#d9d1c1] text-[#0b1a33]"
          />
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() =>
              void onSubmitLeave({ type: leaveType, from_date: leaveFrom, to_date: leaveTo, reason: leaveReason })
            }
            className="w-full py-2.5 rounded-2xl text-[#0b1a33] font-bold border-0 cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #f1e3c2, #c9a96e)' }}
          >
            Submit Leave Request
          </motion.button>
        </div>

        <div className="rounded-3xl bg-white border border-[#e7e1d4] p-4 shadow-xs space-y-2.5 text-xs">
          <div className="font-bold font-display text-sm text-[#0b1a33] flex items-center gap-1.5">
            <UserCheck size={15} className="text-[#9a7a42]" /> Shift Handover
          </div>
          <select
            value={handoverUser}
            onChange={e => setHandoverUser(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-xl bg-[#fbf9f5] border border-[#d9d1c1] text-[#0b1a33]"
          >
            {colleagues.map(u => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.email})
              </option>
            ))}
          </select>
          <textarea
            rows={2}
            value={handoverNotes}
            onChange={e => setHandoverNotes(e.target.value)}
            placeholder="Pending viewings, hot leads, or key custody notes for next shift…"
            className="w-full px-3 py-2 rounded-xl bg-[#fbf9f5] border border-[#d9d1c1] text-[#0b1a33]"
          />
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => void onShiftHandover(handoverUser, handoverNotes || 'Standard EOD shift handover')}
            className="w-full py-2.5 rounded-2xl bg-[#0b1a33] text-[#f3ead8] font-bold border-0 cursor-pointer"
          >
            Hand Over Unfinished Work
          </motion.button>
        </div>
      </motion.div>

      {/* 6. Company Knowledge Assistant (Feature #11) */}
      <motion.div
        variants={itemRise}
        className="rounded-3xl bg-white border border-[#e7e1d4] p-4 shadow-xs space-y-2.5 text-xs"
      >
        <div className="font-bold font-display text-sm text-[#0b1a33] flex items-center gap-1.5">
          <BookOpen size={15} className="text-[#9a7a42]" /> Company Policy & RERA Knowledge Assistant
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={kbQuery}
            onChange={e => setKbQuery(e.target.value)}
            placeholder="Ask about commission splits, location privacy, NOC rules, WABA policy…"
            className="flex-1 px-3 py-2 rounded-xl bg-[#fbf9f5] border border-[#d9d1c1] text-[#0b1a33]"
          />
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={async () => {
              const res = await onAskKnowledge(kbQuery || 'commission policy')
              setKbAnswer(res.answer)
            }}
            className="px-4 py-2 rounded-full bg-[#0b1a33] text-[#f3ead8] font-bold border-0 cursor-pointer"
          >
            Ask
          </motion.button>
        </div>
        {kbAnswer && (
          <div className="p-3 rounded-2xl bg-[#fbf8f2] text-[#0b1a33] border border-[#c9a96e]">
            {kbAnswer}
          </div>
        )}
      </motion.div>

      {/* 7. Onboarding & Exit Checklists (Features #12 & #13) */}
      <motion.div
        variants={itemRise}
        className="rounded-3xl bg-white border border-[#e7e1d4] p-4 shadow-xs space-y-3 text-xs"
      >
        <h3 className="font-bold font-display text-sm text-[#0b1a33]">
          Employee Onboarding & Asset Exit Checklists
        </h3>
        <div className="space-y-1.5">
          {(workday.onboarding || []).map((item: any) => (
            <label
              key={item.id}
              className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-[#fbf8f2] border border-[#efe9dc] cursor-pointer"
            >
              <input
                type="checkbox"
                className="swk-check"
                checked={!!item.done}
                onChange={e => void onToggleChecklist('onboarding', item.id, e.target.checked)}
              />
              <span className={item.done ? 'line-through text-[#6b7488]' : 'font-semibold text-[#0b1a33]'}>
                {item.label}
              </span>
              <span className="ml-auto text-[10px] text-[#9a7a42] font-bold">{item.owner}</span>
            </label>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}
