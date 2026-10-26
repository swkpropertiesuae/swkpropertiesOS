import { useState } from 'react'
import {
  MapPin, Navigation, ShieldAlert, CheckCircle2, Clock, PhoneCall, MessageSquare, Building2, Camera,
  KeyRound, FileCheck2, Sparkles, Scale, HandCoins, Percent, Plane, BookOpen, Award, AlertTriangle,
  Send, Languages, UserCheck, Eye, Lock, Check, Plus, RefreshCw, ArrowUpRight, Star, Briefcase,
} from 'lucide-react'
import { openAndroidMapsNavigation } from './native-bridge'

/**
 * TAB 2: Field Duty, Safety, Location Privacy & Verified Viewing Journey (Features 17–20, 40–50)
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

  return (
    <div className="space-y-4">
      {/* 1. Explicit Start / End Field Duty Card (Foreground Service Control) */}
      <div className="rounded-2xl bg-white border border-[#e6ebe7] p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${activeSession ? 'bg-[#007b52] animate-ping' : 'bg-[#53655b]'}`} />
            <h3 className="font-bold font-display text-sm text-[#161d1a]">
              Android Field Duty & Foreground Location Service
            </h3>
          </div>
          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
            activeSession ? 'bg-[#dcf1e6] text-[#025e3d]' : 'bg-[#f1f6f3] text-[#53655b]'
          }`}>
            {activeSession ? activeSession.status : 'Off Duty (No Tracking)'}
          </span>
        </div>

        {activeSession ? (
          <div className="p-3.5 rounded-2xl bg-[#edf5f0] border border-[#007b52]/30 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-[#025e3d]">
                  Active Session: {activeSession.session_no} · {activeSession.assigned_location}
                </div>
                <div className="text-[11px] text-[#3f4f47] mt-0.5">
                  Persistent Android Notification active · Last coords: {activeSession.last_lat}, {activeSession.last_lng} (±{activeSession.gps_accuracy_m || 8}m)
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => void onSendLocationBatch(activeSession.id)}
                className="py-2 px-2.5 rounded-full bg-white text-[#007b52] border border-[#007b52]/30 text-xs font-semibold cursor-pointer"
              >
                Send Batch Update
              </button>
              <button
                onClick={() => void onSafetyCheckIn(activeSession.id)}
                className="py-2 px-2.5 rounded-full bg-white text-[#161d1a] border border-[#cbd6ce] text-xs font-semibold cursor-pointer"
              >
                ✓ I Am Safe
              </button>
              <button
                onClick={() => void onEndDuty(activeSession.id, 'Completed scheduled field duty')}
                className="py-2 px-2.5 rounded-full bg-[#161d1a] text-white text-xs font-semibold border-0 cursor-pointer"
              >
                End Field Duty
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            <p className="text-xs text-[#53655b]">
              Location is <b>never</b> shared when off duty. Starting Field Duty launches the Android Foreground Service with a visible notification until you end duty.
            </p>
            <input
              type="text"
              value={dutyLoc}
              onChange={e => setDutyLoc(e.target.value)}
              placeholder="Assigned community / building (e.g. Dubai Marina Gate 1)"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#cbd6ce] text-xs"
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
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#cbd6ce] text-xs bg-white"
              >
                <option value="">Link to an assigned viewing appointment (optional)…</option>
                {viewings.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.viewing_no} – {v.property_title} ({String(v.scheduled_at || '').slice(11, 16)})
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={() => {
                const v = viewings.find(x => x.id === selectedViewingId)
                void onStartDuty(dutyLoc, v?.id ?? null, v?.property_id ?? null)
              }}
              className="w-full py-3 rounded-full bg-[#007b52] hover:bg-[#025e3d] text-white font-bold text-xs border-0 cursor-pointer flex items-center justify-center gap-2"
            >
              <MapPin size={15} /> Start Approved Field Duty (Enable Foreground Service)
            </button>
          </div>
        )}

        {/* Emergency SOS Bar (Feature #46) */}
        <div className="pt-2 border-t border-[#e6ebe7] flex items-center justify-between">
          <span className="text-[11px] text-[#53655b]">Field Safety & Emergency Escalation (46–47)</span>
          <button
            onClick={() => setShowSosBox(s => !s)}
            className="px-3 py-1.5 rounded-full bg-[#fbe1e4] text-[#c32135] font-bold text-xs border-0 cursor-pointer flex items-center gap-1"
          >
            <ShieldAlert size={13} /> Emergency SOS
          </button>
        </div>
        {showSosBox && (
          <div className="p-3 rounded-xl bg-[#fbe1e4]/60 border border-[#c32135]/40 space-y-2">
            <input
              type="text"
              value={sosReason}
              onChange={e => setSosReason(e.target.value)}
              placeholder="Describe emergency or safety concern (alerts management immediately)…"
              className="w-full px-3 py-2 rounded-lg bg-white border border-[#c32135]/40 text-xs"
            />
            <button
              onClick={async () => {
                await onTriggerSos(sosReason || 'Urgent field safety assistance needed')
                setShowSosBox(false)
                setSosReason('')
              }}
              className="w-full py-2.5 rounded-full bg-[#c32135] text-white font-bold text-xs border-0 cursor-pointer"
            >
              🚨 Dispatch Immediate SOS Alert + Live Coordinates
            </button>
          </div>
        )}
      </div>

      {/* 2. Scheduled Route Overview & Verified Viewing Journey (Features 17–20, 41–45) */}
      <div className="rounded-2xl bg-white border border-[#e6ebe7] p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold font-display text-sm text-[#161d1a]">
              Verified Viewing Journey & Daily Route ({viewings.length})
            </h3>
            <p className="text-[11px] text-[#53655b]">
              Appointment → Maps Navigation → GPS Arrival → Client Feedback → CRM Follow-up
            </p>
          </div>
        </div>

        {viewings.length === 0 ? (
          <div className="p-6 rounded-xl bg-[#f1f6f3] text-center text-xs text-[#53655b]">
            No viewings scheduled yet. Tap "Initialize Field Workspace" on the Command tab or book a viewing in CRM.
          </div>
        ) : (
          <div className="space-y-3">
            {viewings.map((v, idx) => (
              <div key={v.id} className="p-3.5 rounded-2xl bg-[#f1f6f3] border border-[#e6ebe7] space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white text-[#007b52] text-[10px] font-bold border border-[#cbd6ce]">
                      Stop #{idx + 1} · {v.viewing_no}
                    </span>
                    <div className="font-bold text-sm text-[#161d1a] mt-1">{v.property_title || `Property #${v.property_id}`}</div>
                    <div className="text-xs text-[#53655b]">
                      Time: <b>{String(v.scheduled_at || '').replace('T', ' ')}</b> · Meet: {v.meeting_point || 'Main Lobby'}
                    </div>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    v.status === 'Completed'
                      ? 'bg-[#dcf1e6] text-[#025e3d]'
                      : v.status === 'No-Show'
                        ? 'bg-[#fbe1e4] text-[#c32135]'
                        : 'bg-[#dfecfa] text-[#15526b]'
                  }`}>
                    {v.status}
                  </span>
                </div>

                {v.feedback && (
                  <div className="p-2 rounded-xl bg-white text-[11px] text-[#3f4f47] border border-[#e6ebe7]">
                    <b>Outcome:</b> {v.feedback}
                  </div>
                )}

                {/* Action buttons for Viewing Journey */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <button
                    onClick={() => openAndroidMapsNavigation(null, null, v.property_title || v.meeting_point)}
                    className="px-3 py-1.5 rounded-full bg-white text-[#161d1a] border border-[#cbd6ce] text-[11px] font-semibold cursor-pointer flex items-center gap-1"
                  >
                    <Navigation size={12} className="text-[#007b52]" /> Navigate (Maps)
                  </button>
                  <button
                    onClick={() => void onViewingArrive(v.id)}
                    className="px-3 py-1.5 rounded-full bg-[#007b52] text-white text-[11px] font-semibold border-0 cursor-pointer flex items-center gap-1"
                  >
                    <MapPin size={12} /> Confirm Arrival
                  </button>
                  <button
                    onClick={() => setFeedbackViewingId(feedbackViewingId === v.id ? null : v.id)}
                    className="px-3 py-1.5 rounded-full bg-[#161d1a] text-white text-[11px] font-semibold border-0 cursor-pointer"
                  >
                    Checkout & Feedback
                  </button>
                  <button
                    onClick={() => void onViewingEvent(v.id, 'client_confirmed', 'Client confirmed via WhatsApp')}
                    className="px-2.5 py-1.5 rounded-full bg-white text-[#3f4f47] border border-[#cbd6ce] text-[11px] cursor-pointer"
                  >
                    Client Confirmed
                  </button>
                  <button
                    onClick={() => void onViewingEvent(v.id, 'late_notice', '15 min traffic delay on SZR')}
                    className="px-2.5 py-1.5 rounded-full bg-white text-[#8c4329] border border-[#cbd6ce] text-[11px] cursor-pointer"
                  >
                    Send 15m Delay Alert
                  </button>
                  <button
                    onClick={() => void onViewingEvent(v.id, 'no_show', 'Client did not attend; GPS arrival logged')}
                    className="px-2.5 py-1.5 rounded-full bg-white text-[#c32135] border border-[#cbd6ce] text-[11px] cursor-pointer"
                  >
                    Log Client No-Show
                  </button>
                </div>

                {/* Structured Client Feedback Drawer (Feature #20) */}
                {feedbackViewingId === v.id && (
                  <div className="p-3 rounded-xl bg-white border border-[#007b52] space-y-2.5 mt-2">
                    <div className="text-xs font-bold text-[#161d1a]">Record Client Viewing Feedback & Objections</div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="block text-[10px] font-semibold text-[#53655b]">Client Interest (1–10)</label>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={interest}
                          onChange={e => setInterest(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-[#cbd6ce] text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-[#53655b]">Client Decision</label>
                        <select
                          value={decision}
                          onChange={e => setDecision(e.target.value as any)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-[#cbd6ce] text-xs bg-white"
                        >
                          <option value="Make Offer">Ready to Make Offer</option>
                          <option value="Second Viewing">Request Second Viewing</option>
                          <option value="Send Alternatives">Send Verified Alternatives</option>
                          <option value="Not Interested">Not Interested</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold text-[#53655b] mb-1">Client Objections (Tap to tag)</div>
                      <div className="flex flex-wrap gap-1">
                        {['Asking Price High', 'Service Charges', 'Floor / View', 'Kitchen Layout', 'Needs Mortgage', 'Handover Date'].map(obj => (
                          <button
                            key={obj}
                            type="button"
                            onClick={() => toggleObjection(obj)}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border cursor-pointer ${
                              objections.includes(obj)
                                ? 'bg-[#007b52] text-white border-[#007b52]'
                                : 'bg-[#f1f6f3] text-[#3f4f47] border-[#cbd6ce]'
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
                      className="w-full px-3 py-2 rounded-lg border border-[#cbd6ce] text-xs"
                    />
                    <button
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
                      className="w-full py-2 rounded-full bg-[#007b52] text-white font-bold text-xs border-0 cursor-pointer"
                    >
                      Save Outcome & Create CRM Follow-up Task
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Employee Location Privacy Dashboard (Feature #50) */}
      <div className="rounded-2xl bg-white border border-[#e6ebe7] p-4 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye size={16} className="text-[#007b52]" />
            <h3 className="font-bold font-display text-sm text-[#161d1a]">
              Location Privacy Dashboard (Transparency Log)
            </h3>
          </div>
          <span className="text-[11px] font-semibold text-[#007b52]">Off-Hours Access Blocked</span>
        </div>
        <p className="text-[11px] text-[#53655b]">
          Every manager lookup of your field duty location is audited below. Lookups outside scheduled duty hours are automatically blocked.
        </p>
        {privacyLogs.length === 0 ? (
          <div className="p-3 rounded-xl bg-[#f1f6f3] text-xs text-[#53655b]">
            No manager location lookups recorded. Your off-duty coordinates are private.
          </div>
        ) : (
          <div className="space-y-1.5">
            {privacyLogs.slice(0, 6).map((log: any) => (
              <div key={log.id} className="p-2.5 rounded-xl bg-[#f1f6f3] flex items-center justify-between text-xs">
                <div>
                  <div className="font-semibold text-[#161d1a]">{log.access_outcome}</div>
                  <div className="text-[10px] text-[#53655b]">{log.exception_reason || 'Standard active-duty coordination'}</div>
                </div>
                <span className="text-[10px] font-mono text-[#53655b]">{String(log.accessed_at || '').slice(0, 16)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * TAB 3: Inventory Acquisition, Camera OCR, Duplicate Guard, Key Handover & Developer NOC (Features 28–39)
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
  const [purpose, setPurpose] = useState('Sale')
  const [askingPrice, setAskingPrice] = useState('3450000')
  const [areaSqft, setAreaSqft] = useState('1485')
  const [bedrooms, setBedrooms] = useState('2')
  const [ownerName, setOwnerName] = useState('')
  const [ownerPhone, setOwnerPhone] = useState('+971 50 ')
  const [formARef, setFormARef] = useState('')
  const [trakheesiNo, setTrakheesiNo] = useState('')
  const [conditionNotes, setConditionNotes] = useState('AC tested, freshly painted, balcony view clear, keys verified.')

  const [dupResult, setDupResult] = useState<any>(null)
  const [ocrStatus, setOcrStatus] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)

  // Key Vault form
  const [keyBuilding, setKeyBuilding] = useState('Marina Gate Tower 1')
  const [keyUnit, setKeyUnit] = useState('3402')
  const [keyAction, setKeyAction] = useState<'Received from Owner' | 'Checked Out for Viewing' | 'Returned to Office Vault' | 'Handed to Buyer/Tenant'>('Checked Out for Viewing')

  const handleCheckDup = async (b: string, u: string) => {
    if (b.trim().length > 2 && u.trim().length > 0) {
      const res = await onCheckDuplicate(b, u)
      setDupResult(res)
    } else {
      setDupResult(null)
    }
  }

  const handleCameraOcr = async (docType: 'title_deed' | 'form_a' | 'passport') => {
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
  }

  return (
    <div className="space-y-4">
      {/* 1. Quick Property Sourcing + Camera-Assisted Entry + Real-Time Duplicate Warning (Features 28–35) */}
      <div className="rounded-2xl bg-white border border-[#e6ebe7] p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold font-display text-sm text-[#161d1a]">
              Quick Property Sourcing (Under 60 Seconds)
            </h3>
            <p className="text-[11px] text-[#53655b]">
              Camera OCR extraction · Duplicate unit guard · Owner Form A & Trakheesi check
            </p>
          </div>
          <Building2 size={18} className="text-[#007b52]" />
        </div>

        {/* Camera-Assisted Document Scan Bar (Feature #29 & #35) */}
        <div className="p-3 rounded-xl bg-[#edf5f0] border border-[#007b52]/25 space-y-2">
          <div className="text-xs font-bold text-[#025e3d] flex items-center gap-1.5">
            <Camera size={14} /> Camera-Assisted Entry & Image Quality Assistant
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => void handleCameraOcr('title_deed')}
              className="px-3 py-1.5 rounded-full bg-[#007b52] text-white text-[11px] font-semibold border-0 cursor-pointer"
            >
              📷 Scan Title Deed / Oqood
            </button>
            <button
              type="button"
              onClick={() => void handleCameraOcr('form_a')}
              className="px-3 py-1.5 rounded-full bg-white text-[#007b52] border border-[#007b52]/40 text-[11px] font-semibold cursor-pointer"
            >
              📄 Scan Signed Form A
            </button>
            <button
              type="button"
              onClick={() => void handleCameraOcr('passport')}
              className="px-3 py-1.5 rounded-full bg-white text-[#161d1a] border border-[#cbd6ce] text-[11px] font-semibold cursor-pointer"
            >
              🪪 Scan Owner EID / Passport
            </button>
          </div>
          {ocrStatus && (
            <div className="text-[11px] text-[#025e3d] bg-white/80 p-2 rounded-lg">
              ✓ <b>{ocrStatus.image_quality_check?.verdict}</b> ({ocrStatus.image_quality_check?.resolution}, Sharpness {ocrStatus.image_quality_check?.sharpness_score}%)
            </div>
          )}
        </div>

        {/* Duplicate Warning Banner (Feature #30) */}
        {dupResult?.duplicate && (
          <div className="p-3 rounded-xl bg-[#f6e9c3] border border-[#8c4329]/40 text-xs text-[#8c4329] flex items-start gap-2">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <div>
              <b>Duplicate Unit Warning (Control 3.07):</b> Another broker already registered <b>{buildingName} – Unit {unitNo}</b>. Submitting will place this record in <i>Duplicate / Conflict Hold</i> for manager attribution review.
            </div>
          </div>
        )}

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
              className="col-span-2 px-3 py-2 rounded-xl border border-[#cbd6ce]"
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
              className="px-3 py-2 rounded-xl border border-[#cbd6ce]"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <select
              value={propertyType}
              onChange={e => setPropertyType(e.target.value)}
              className="px-2.5 py-2 rounded-xl border border-[#cbd6ce] bg-white"
            >
              {['Apartment', 'Villa', 'Townhouse', 'Penthouse', 'Studio', 'Office'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <input
              type="number"
              value={askingPrice}
              onChange={e => setAskingPrice(e.target.value)}
              placeholder="Price (AED)"
              className="px-3 py-2 rounded-xl border border-[#cbd6ce]"
            />
            <input
              type="number"
              value={areaSqft}
              onChange={e => setAreaSqft(e.target.value)}
              placeholder="Area sq ft"
              className="px-3 py-2 rounded-xl border border-[#cbd6ce]"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              required
              value={ownerName}
              onChange={e => setOwnerName(e.target.value)}
              placeholder="Verified Owner Name *"
              className="px-3 py-2 rounded-xl border border-[#cbd6ce]"
            />
            <input
              type="text"
              value={ownerPhone}
              onChange={e => setOwnerPhone(e.target.value)}
              placeholder="Owner Mobile (+971…)"
              className="px-3 py-2 rounded-xl border border-[#cbd6ce]"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={formARef}
              onChange={e => setFormARef(e.target.value)}
              placeholder="Signed DLD Form A Ref."
              className="px-3 py-2 rounded-xl border border-[#cbd6ce]"
            />
            <input
              type="text"
              value={trakheesiNo}
              onChange={e => setTrakheesiNo(e.target.value)}
              placeholder="Trakheesi Permit No."
              className="px-3 py-2 rounded-xl border border-[#cbd6ce]"
            />
          </div>
          <input
            type="text"
            value={conditionNotes}
            onChange={e => setConditionNotes(e.target.value)}
            placeholder="Property condition checklist & site inspection notes…"
            className="w-full px-3 py-2 rounded-xl border border-[#cbd6ce]"
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-full bg-[#007b52] hover:bg-[#025e3d] text-white font-bold text-xs border-0 cursor-pointer"
          >
            {submitting ? 'Submitting to SWK OS…' : 'Submit Sourced Inventory to SWK OS Pipeline'}
          </button>
        </form>
      </div>

      {/* 2. My Sourced Inventory Pipeline Dashboard (Features 32, 33, 37, 39) */}
      <div className="rounded-2xl bg-white border border-[#e6ebe7] p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold font-display text-sm text-[#161d1a]">
              My Sourced Inventory Pipeline ({submissions.length})
            </h3>
            <p className="text-[11px] text-[#53655b]">
              Submitted → Inventory Verified → Compliance Verified → Published to Stock
            </p>
          </div>
        </div>

        {submissions.length === 0 ? (
          <div className="p-4 rounded-xl bg-[#f1f6f3] text-xs text-[#53655b] text-center">
            No sourced inventory submitted yet. Use the 60-second sourcing form above.
          </div>
        ) : (
          <div className="space-y-2.5">
            {submissions.map(sub => (
              <div key={sub.id} className="p-3.5 rounded-2xl bg-[#f1f6f3] border border-[#e6ebe7] space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-mono text-[#53655b]">
                      {sub.submission_no} · Conflict Check: <b>{sub.conflict_status}</b>
                    </div>
                    <div className="font-bold text-sm text-[#161d1a]">
                      {sub.building_name} – Unit {sub.unit_no} ({sub.property_type})
                    </div>
                    <div className="text-xs text-[#007b52] font-bold">
                      AED {Number(sub.asking_price || 0).toLocaleString()} · {sub.area_sqft} sq ft · Owner: {sub.owner_name}
                    </div>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    sub.status === 'Published to Stock'
                      ? 'bg-[#dcf1e6] text-[#025e3d]'
                      : sub.status === 'Rejected' || sub.status === 'Duplicate / Conflict Hold'
                        ? 'bg-[#fbe1e4] text-[#c32135]'
                        : 'bg-[#f6e9c3] text-[#8c4329]'
                  }`}>
                    {sub.status}
                  </span>
                </div>

                {/* Why listing remains on hold (Feature #37) */}
                {sub.status !== 'Published to Stock' && (
                  <div className="p-2 rounded-lg bg-white text-[11px] text-[#3f4f47] border border-[#e6ebe7]">
                    <b>Publication Gate Status:</b>{' '}
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
                  <button
                    onClick={() => void onReconfirmPrice(sub.id, Number(sub.asking_price || 0))}
                    className="px-3 py-1 rounded-full bg-white text-[#007b52] border border-[#007b52]/40 text-[11px] font-semibold cursor-pointer"
                  >
                    ✓ Reconfirm Owner Price ({sub.price_confirmed_date || 'Today'})
                  </button>
                  <button
                    onClick={() => void onOwnerWithdraw(sub.id, 'Owner instructed withdrawal from marketing')}
                    className="px-3 py-1 rounded-full bg-white text-[#c32135] border border-[#cbd6ce] text-[11px] font-semibold cursor-pointer"
                  >
                    Owner Withdrawal Alert
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Property Key Handover Log (Feature #36) */}
      <div className="rounded-2xl bg-white border border-[#e6ebe7] p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound size={16} className="text-[#007b52]" />
            <h3 className="font-bold font-display text-sm text-[#161d1a]">Property Key Handover Vault</h3>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <input
            type="text"
            value={keyBuilding}
            onChange={e => setKeyBuilding(e.target.value)}
            placeholder="Building"
            className="px-2.5 py-2 rounded-xl border border-[#cbd6ce]"
          />
          <input
            type="text"
            value={keyUnit}
            onChange={e => setKeyUnit(e.target.value)}
            placeholder="Unit No."
            className="px-2.5 py-2 rounded-xl border border-[#cbd6ce]"
          />
          <select
            value={keyAction}
            onChange={e => setKeyAction(e.target.value as any)}
            className="px-2 py-2 rounded-xl border border-[#cbd6ce] bg-white"
          >
            <option value="Received from Owner">Received from Owner</option>
            <option value="Checked Out for Viewing">Checked Out for Viewing</option>
            <option value="Returned to Office Vault">Returned to Office Vault</option>
            <option value="Handed to Buyer/Tenant">Handed to Buyer/Tenant</option>
          </select>
        </div>
        <button
          onClick={() => void onLogKey({ building_name: keyBuilding, unit_no: keyUnit, action: keyAction })}
          className="w-full py-2.5 rounded-full bg-[#161d1a] text-white font-semibold text-xs border-0 cursor-pointer"
        >
          Record Key Custody Event
        </button>
        {keyLogs.length > 0 && (
          <div className="space-y-1 pt-1">
            {keyLogs.slice(0, 4).map((k: any) => (
              <div key={k.id} className="p-2 rounded-xl bg-[#f1f6f3] flex items-center justify-between text-[11px]">
                <span><b>{k.key_tag}</b> · {k.building_name} #{k.unit_no}</span>
                <span className="font-semibold text-[#007b52]">{k.action}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Developer NOC Status Tracker (Feature #38) */}
      <div className="rounded-2xl bg-white border border-[#e6ebe7] p-4 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCheck2 size={16} className="text-[#007b52]" />
            <h3 className="font-bold font-display text-sm text-[#161d1a]">
              Developer NOC Clearance Tracker ({nocRequests.length})
            </h3>
          </div>
        </div>
        {nocRequests.length === 0 ? (
          <div className="p-3 rounded-xl bg-[#f1f6f3] text-xs text-[#53655b]">
            No active Developer NOC clearances pending. NOCs are triggered once Form F / Sales Contract is signed.
          </div>
        ) : (
          nocRequests.map(n => (
            <div key={n.id} className="p-3 rounded-xl bg-[#f1f6f3] border border-[#e6ebe7] text-xs space-y-1">
              <div className="flex items-center justify-between">
                <b>{n.request_no} · {n.transaction_type}</b>
                <span className="px-2 py-0.5 rounded-full bg-white text-[#007b52] text-[10px] font-bold">{n.status}</span>
              </div>
              <div className="text-[11px] text-[#53655b]">
                Service Charges Cleared: <b>{n.service_charges_cleared ? 'Yes' : 'Pending'}</b> · Closing Stage Unlocked: <b>{n.closing_stage_unlocked ? 'Unlocked' : 'Locked'}</b>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
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
    <div className="space-y-4">
      {/* 1. Assigned Business WhatsApp Conversations + Multilingual AI Reply Drafts (Features 51–60) */}
      <div className="rounded-2xl bg-white border border-[#e6ebe7] p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold font-display text-sm text-[#161d1a]">
              Company WhatsApp Business (WABA) Inbox ({communications.length})
            </h3>
            <p className="text-[11px] text-[#53655b]">
              Official supervised channel · SLA countdown · Multilingual AI drafts (EN/AR/RU/ZH/FR)
            </p>
          </div>
          <MessageSquare size={18} className="text-[#007b52]" />
        </div>

        {communications.length === 0 ? (
          <div className="p-4 rounded-xl bg-[#f1f6f3] text-xs text-[#53655b] text-center">
            No unassigned or open WABA conversations.
          </div>
        ) : (
          <div className="space-y-3">
            {communications.map(c => {
              const lang = langById[c.id] || 'en'
              const replyText = replyTextById[c.id] || ''
              return (
                <div key={c.id} className="p-3.5 rounded-2xl bg-[#f1f6f3] border border-[#e6ebe7] space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-mono text-[#53655b]">
                        {c.comm_no} · {c.business_account_ref}
                      </span>
                      <div className="font-bold text-sm text-[#161d1a]">{c.customer_phone}</div>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      c.status === 'Responded' ? 'bg-[#dcf1e6] text-[#025e3d]' : 'bg-[#f6e9c3] text-[#8c4329]'
                    }`}>
                      {c.status} {c.escalation_tag && c.escalation_tag !== 'None' ? `· ${c.escalation_tag}` : ''}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white text-xs text-[#161d1a] border border-[#e6ebe7]">
                    {c.message_summary}
                  </div>
                  {c.ai_summary && (
                    <div className="text-[11px] text-[#007b52] flex items-center gap-1">
                      <Sparkles size={12} /> <b>AI Briefing:</b> {c.ai_summary}
                    </div>
                  )}

                  {/* Multilingual AI Draft Selector (Features #54 & #55) */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-[#53655b] flex items-center gap-1">
                      <Languages size={12} /> AI Draft:
                    </span>
                    {(['en', 'ar', 'ru', 'zh', 'fr'] as const).map(l => (
                      <button
                        key={l}
                        type="button"
                        onClick={async () => {
                          setLangById(prev => ({ ...prev, [c.id]: l }))
                          const draft = await onGetAiDraft(c.id, l)
                          setReplyTextById(prev => ({ ...prev, [c.id]: draft }))
                        }}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border cursor-pointer ${
                          lang === l ? 'bg-[#007b52] text-white border-[#007b52]' : 'bg-white text-[#3f4f47] border-[#cbd6ce]'
                        }`}
                      >
                        {l.toUpperCase()}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => void onEscalateComm(c.id, `Client Escalation on ${c.comm_no}`, c.message_summary)}
                      className="ml-auto px-2.5 py-0.5 rounded-full bg-[#fbe1e4] text-[#c32135] text-[10px] font-bold border-0 cursor-pointer"
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
                      className="flex-1 px-3 py-2 rounded-xl bg-white border border-[#cbd6ce] text-xs"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        if (!replyText.trim()) return
                        await onReplyComm(c.id, replyText, lang)
                        setReplyTextById(prev => ({ ...prev, [c.id]: '' }))
                      }}
                      className="px-3.5 py-2 rounded-full bg-[#007b52] text-white text-xs font-bold border-0 cursor-pointer flex items-center gap-1"
                    >
                      <Send size={12} /> Send
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 2. Lead Priority Queue, AI Lead Briefing & One-Tap Call Logging (Features 14–16, 56) */}
      <div className="rounded-2xl bg-white border border-[#e6ebe7] p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold font-display text-sm text-[#161d1a]">
              Assigned CRM Leads & One-Tap Call Logger ({leads.length})
            </h3>
            <p className="text-[11px] text-[#53655b]">
              Tap any call outcome to log activity and progress lead automatically
            </p>
          </div>
          <button
            onClick={onOpenComparison}
            className="px-3 py-1.5 rounded-full bg-[#edf5f0] text-[#007b52] font-bold text-xs border border-[#007b52]/30 cursor-pointer flex items-center gap-1"
          >
            <Scale size={13} /> Compare Properties
          </button>
        </div>

        <div className="space-y-2.5">
          {leads.map(l => (
            <div key={l.id} className="p-3.5 rounded-2xl bg-[#f1f6f3] border border-[#e6ebe7] space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-mono text-[#53655b]">{l.lead_no} · {l.source}</span>
                  <div className="font-bold text-sm text-[#161d1a]">{l.contact_name || l.company}</div>
                  <div className="text-xs text-[#007b52] font-semibold">
                    {l.interest || 'Property Purchase'} · {l.destination || 'Dubai Marina'} · Budget AED {Number(l.est_value || 0).toLocaleString()}
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-white text-[#161d1a] border border-[#cbd6ce] text-[10px] font-bold">
                  {l.status}
                </span>
              </div>

              {/* AI Lead Briefing (Feature #14) */}
              {l.notes && (
                <div className="p-2 rounded-xl bg-white text-[11px] text-[#3f4f47] border border-[#e6ebe7]">
                  <b className="text-[#007b52]">AI Lead Briefing:</b> {l.notes}
                </div>
              )}

              {/* One-Tap Call Logging Buttons (Feature #16) */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <button
                  onClick={() => void onQuickLogLead(l.id, 'Connected', 'Call', 'Qualified buyer requirements & confirmed viewing slot')}
                  className="px-2.5 py-1 rounded-full bg-[#007b52] text-white text-[11px] font-semibold border-0 cursor-pointer"
                >
                  📞 Connected – Interested
                </button>
                <button
                  onClick={() => void onQuickLogLead(l.id, 'Callback requested', 'Call', 'Client in meeting; requested callback at 5 PM')}
                  className="px-2.5 py-1 rounded-full bg-white text-[#161d1a] border border-[#cbd6ce] text-[11px] font-semibold cursor-pointer"
                >
                  🕒 Callback Queue
                </button>
                <button
                  onClick={() => void onQuickLogLead(l.id, 'No answer', 'Call', 'No answer; sent official WABA brochure')}
                  className="px-2.5 py-1 rounded-full bg-white text-[#53655b] border border-[#cbd6ce] text-[11px] cursor-pointer"
                >
                  No Answer
                </button>
                <button
                  onClick={() => void onQuickLogLead(l.id, 'Quote requested', 'WhatsApp', 'Sent side-by-side comparison & ROI calculation')}
                  className="px-2.5 py-1 rounded-full bg-[#edf5f0] text-[#025e3d] border border-[#007b52]/30 text-[11px] font-semibold cursor-pointer"
                >
                  💬 WABA Brochure Sent
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Digital Offer Submission (Feature #23) */}
      <div className="rounded-2xl bg-white border border-[#e6ebe7] p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HandCoins size={16} className="text-[#007b52]" />
            <h3 className="font-bold font-display text-sm text-[#161d1a]">Digital Offer Submission</h3>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <select
            value={offerPropId}
            onChange={e => setOfferPropId(Number(e.target.value))}
            className="px-3 py-2 rounded-xl border border-[#cbd6ce] bg-white"
          >
            {properties.map(p => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
          <input
            type="number"
            value={offerPrice}
            onChange={e => setOfferPrice(e.target.value)}
            placeholder="Offer Price (AED)"
            className="px-3 py-2 rounded-xl border border-[#cbd6ce]"
          />
          <select
            value={paymentTerms}
            onChange={e => setPaymentTerms(e.target.value)}
            className="px-3 py-2 rounded-xl border border-[#cbd6ce] bg-white"
          >
            <option value="Cash">Cash Buyer</option>
            <option value="Mortgage">Mortgage Pre-Approved</option>
            <option value="50/50">Developer 50/50 Plan</option>
          </select>
        </div>
        <button
          onClick={() =>
            void onSubmitOffer({
              property_id: offerPropId || properties[0]?.id,
              lead_id: leads[0]?.id,
              offer_price: Number(offerPrice || 5000000),
              payment_terms: paymentTerms,
              subject_to_finance: paymentTerms === 'Mortgage',
            })
          }
          className="w-full py-2.5 rounded-full bg-[#007b52] text-white font-bold text-xs border-0 cursor-pointer"
        >
          Submit Formal Digital Offer to SWK OS
        </button>
      </div>

      {/* 4. Personal Deal Pipeline, Mortgage Readiness & Closing Checklist (Features 24–27, 60) */}
      <div className="rounded-2xl bg-white border border-[#e6ebe7] p-4 shadow-xs space-y-2.5">
        <h3 className="font-bold font-display text-sm text-[#161d1a]">
          Personal Deal Pipeline & Closing Gate Checklist ({transactions.length})
        </h3>
        {transactions.map(t => (
          <div key={t.id} className="p-3.5 rounded-2xl bg-[#f1f6f3] border border-[#e6ebe7] space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <b>{t.transaction_no} · AED {Number(t.deal_value || 0).toLocaleString()}</b>
              <span className="px-2.5 py-0.5 rounded-full bg-[#dcf1e6] text-[#025e3d] text-[10px] font-bold">{t.stage}</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <div className="p-1.5 rounded-lg bg-white">
                {t.kyc_cleared ? '✅' : '⏳'} Buyer/Seller KYC & AML
              </div>
              <div className="p-1.5 rounded-lg bg-white">
                {t.forms_completed ? '✅' : '⏳'} RERA Forms A / B / F
              </div>
              <div className="p-1.5 rounded-lg bg-white">
                {t.noc_verified ? '✅' : '⏳'} Developer NOC Verified
              </div>
              <div className="p-1.5 rounded-lg bg-white">
                {t.financially_reconciled ? '✅' : '⏳'} Invoice & Bank Receipt
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * TAB 5: Commissions, HR Wallet, Attendance Corrections, Knowledge Assistant & Coaching (Features 5, 7–13, 59, 61–65)
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
    <div className="space-y-4">
      {/* 1. Personal Commission Tracker — 6 Separate Stage Balances (Feature #62 & Priority #4) */}
      <div className="rounded-2xl bg-[#025e3d] text-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-[#d3eee0] font-semibold">
              Commission & Deal Transparency (Control 3.17)
            </div>
            <h3 className="text-lg font-bold font-display">Personal Commission Tracker</h3>
          </div>
          <Percent size={20} className="text-[#d3eee0]" />
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="p-2.5 rounded-xl bg-white/10">
            <div className="text-[10px] text-[#d3eee0]">1. Entitlement</div>
            <div className="font-bold text-sm">AED {Number(commSummary.entitlement_total || 0).toLocaleString()}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-white/10">
            <div className="text-[10px] text-[#d3eee0]">2. Earned</div>
            <div className="font-bold text-sm">AED {Number(commSummary.earned_total || 0).toLocaleString()}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-white/10">
            <div className="text-[10px] text-[#d3eee0]">3. Invoiced</div>
            <div className="font-bold text-sm">AED {Number(commSummary.invoiced_total || 0).toLocaleString()}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-white/10">
            <div className="text-[10px] text-[#d3eee0]">4. Cash Collected</div>
            <div className="font-bold text-sm">AED {Number(commSummary.collected_total || 0).toLocaleString()}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-white/15 border border-white/30">
            <div className="text-[10px] text-[#d3eee0]">5. Net Payable</div>
            <div className="font-extrabold text-sm text-[#34d399]">AED {Number(commSummary.payable_total || 0).toLocaleString()}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-white/10">
            <div className="text-[10px] text-[#d3eee0]">6. Paid Out</div>
            <div className="font-bold text-sm">AED {Number(commSummary.paid_total || 0).toLocaleString()}</div>
          </div>
        </div>

        {commissions.map(c => (
          <div key={c.id} className="p-3 rounded-xl bg-white/10 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <b>{c.entitlement_no} · {c.deal_type} ({c.split_pct}% Split)</b>
              <span className="px-2 py-0.5 rounded-full bg-white text-[#025e3d] text-[10px] font-bold">{c.status}</span>
            </div>
            <div className="text-[11px] text-[#d3eee0]">
              Why Pending / Next Gate: {c.dispute_notes || 'Awaiting bank receipt reconciliation & 3-way treasury sign-off'}
            </div>
          </div>
        ))}
      </div>

      {/* 2. Verified Activity Score & QA Coaching Feedback (Features 59, 61, 64, 65) */}
      <div className="rounded-2xl bg-white border border-[#e6ebe7] p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold font-display text-sm text-[#161d1a]">
              Verified Activity Score & Quality Coaching
            </h3>
            <p className="text-[11px] text-[#53655b]">{score.policy_note}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#edf5f0] border border-[#007b52] grid place-items-center font-extrabold text-base text-[#007b52]">
            {score.total_score || 92}
          </div>
        </div>
        {qaReviews.map(q => (
          <div key={q.id} className="p-3 rounded-xl bg-[#f1f6f3] text-xs space-y-1">
            <div className="flex items-center justify-between">
              <b>{q.qa_no} · {q.channel}</b>
              <span className="font-bold text-[#007b52]">Overall Score: {q.overall_score}/100</span>
            </div>
            <div className="text-[11px] text-[#3f4f47]"><b>Findings:</b> {q.findings}</div>
            {q.coaching_plan && <div className="text-[11px] text-[#007b52]"><b>Coaching:</b> {q.coaching_plan}</div>}
          </div>
        ))}
      </div>

      {/* 3. HR Document Wallet & Expiry Reminders (Features 9 & 10) */}
      <div className="rounded-2xl bg-white border border-[#e6ebe7] p-4 shadow-xs space-y-2.5">
        <h3 className="font-bold font-display text-sm text-[#161d1a]">
          HR Document Wallet & Permit Expiry Reminders
        </h3>
        <div className="space-y-2">
          {(hrWallet.expiry_reminders || []).map((doc: any) => (
            <div key={doc.id} className="p-3 rounded-xl bg-[#f1f6f3] flex items-center justify-between text-xs">
              <div>
                <div className="font-bold text-[#161d1a]">{doc.title}</div>
                <div className="text-[11px] font-mono text-[#53655b]">Ref: {doc.ref} · Expires: {doc.expiry_date}</div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-[#dcf1e6] text-[#025e3d] text-[10px] font-bold">
                {doc.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Attendance History & Challenge / Correction Request (Feature #5) */}
      <div className="rounded-2xl bg-white border border-[#e6ebe7] p-4 shadow-xs space-y-2.5">
        <h3 className="font-bold font-display text-sm text-[#161d1a]">
          Attendance History & Correction Requests ({attendanceHistory.length})
        </h3>
        <div className="space-y-2">
          {attendanceHistory.slice(0, 5).map(att => (
            <div key={att.id} className="p-3 rounded-xl bg-[#f1f6f3] text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <b>{att.work_date} · {att.terminal_type} ({att.event_no})</b>
                <button
                  onClick={() => setCorrId(corrId === att.id ? null : att.id)}
                  className="px-2.5 py-0.5 rounded-full bg-white border border-[#cbd6ce] text-[10px] font-semibold cursor-pointer"
                >
                  Challenge / Correct
                </button>
              </div>
              <div className="text-[11px] text-[#53655b]">
                In: {String(att.check_in_at || '').slice(11, 16) || '09:00'} · Out: {String(att.check_out_at || '').slice(11, 16) || 'Active'} · Status: {att.duty_status}
              </div>
              {corrId === att.id && (
                <div className="flex gap-1.5 pt-1">
                  <input
                    type="text"
                    value={corrReason}
                    onChange={e => setCorrReason(e.target.value)}
                    placeholder="Reason for attendance correction (e.g. client morning meeting at DLD)…"
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-white border border-[#cbd6ce] text-xs"
                  />
                  <button
                    onClick={async () => {
                      await onRequestAttendanceCorrection(att.id, corrReason)
                      setCorrId(null)
                      setCorrReason('')
                    }}
                    className="px-3 py-1.5 rounded-full bg-[#007b52] text-white text-xs font-bold border-0 cursor-pointer"
                  >
                    Submit
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 5. Leave Request & Shift Handover (Features #7 & #8) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white border border-[#e6ebe7] p-4 shadow-xs space-y-2.5 text-xs">
          <div className="font-bold font-display text-sm text-[#161d1a] flex items-center gap-1.5">
            <Plane size={15} className="text-[#007b52]" /> Leave & Emergency Absence
          </div>
          <select
            value={leaveType}
            onChange={e => setLeaveType(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-[#cbd6ce] bg-white"
          >
            <option value="Annual">Annual Leave</option>
            <option value="Sick">Medical / Sick Leave</option>
            <option value="Compassionate">Emergency / Compassionate</option>
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={leaveFrom} onChange={e => setLeaveFrom(e.target.value)} className="px-2.5 py-2 rounded-xl border border-[#cbd6ce]" />
            <input type="date" value={leaveTo} onChange={e => setLeaveTo(e.target.value)} className="px-2.5 py-2 rounded-xl border border-[#cbd6ce]" />
          </div>
          <input
            type="text"
            value={leaveReason}
            onChange={e => setLeaveReason(e.target.value)}
            placeholder="Reason & cover notes…"
            className="w-full px-3 py-2 rounded-xl border border-[#cbd6ce]"
          />
          <button
            onClick={() => void onSubmitLeave({ type: leaveType, from_date: leaveFrom, to_date: leaveTo, reason: leaveReason })}
            className="w-full py-2.5 rounded-full bg-[#007b52] text-white font-bold border-0 cursor-pointer"
          >
            Submit Leave Request
          </button>
        </div>

        <div className="rounded-2xl bg-white border border-[#e6ebe7] p-4 shadow-xs space-y-2.5 text-xs">
          <div className="font-bold font-display text-sm text-[#161d1a] flex items-center gap-1.5">
            <UserCheck size={15} className="text-[#007b52]" /> Shift Handover
          </div>
          <select
            value={handoverUser}
            onChange={e => setHandoverUser(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-xl border border-[#cbd6ce] bg-white"
          >
            {colleagues.map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
            ))}
          </select>
          <textarea
            rows={2}
            value={handoverNotes}
            onChange={e => setHandoverNotes(e.target.value)}
            placeholder="Pending viewings, hot leads, or key custody notes for next shift…"
            className="w-full px-3 py-2 rounded-xl border border-[#cbd6ce]"
          />
          <button
            onClick={() => void onShiftHandover(handoverUser, handoverNotes || 'Standard EOD shift handover')}
            className="w-full py-2.5 rounded-full bg-[#161d1a] text-white font-bold border-0 cursor-pointer"
          >
            Hand Over Unfinished Work
          </button>
        </div>
      </div>

      {/* 6. Company Knowledge Assistant (Feature #11) */}
      <div className="rounded-2xl bg-white border border-[#e6ebe7] p-4 shadow-xs space-y-2.5 text-xs">
        <div className="font-bold font-display text-sm text-[#161d1a] flex items-center gap-1.5">
          <BookOpen size={15} className="text-[#007b52]" /> Company Policy & Knowledge Assistant
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={kbQuery}
            onChange={e => setKbQuery(e.target.value)}
            placeholder="Ask about commission splits, location privacy, NOC rules, WABA policy…"
            className="flex-1 px-3 py-2 rounded-xl border border-[#cbd6ce]"
          />
          <button
            onClick={async () => {
              const res = await onAskKnowledge(kbQuery || 'commission policy')
              setKbAnswer(res.answer)
            }}
            className="px-4 py-2 rounded-full bg-[#007b52] text-white font-bold border-0 cursor-pointer"
          >
            Ask
          </button>
        </div>
        {kbAnswer && (
          <div className="p-3 rounded-xl bg-[#edf5f0] text-[#161d1a] border border-[#007b52]/30">
            {kbAnswer}
          </div>
        )}
      </div>

      {/* 7. Onboarding & Exit Checklists (Features #12 & #13) */}
      <div className="rounded-2xl bg-white border border-[#e6ebe7] p-4 shadow-xs space-y-3 text-xs">
        <h3 className="font-bold font-display text-sm text-[#161d1a]">
          Employee Onboarding & Asset Exit Checklists
        </h3>
        <div className="space-y-1.5">
          {(workday.onboarding || []).map((item: any) => (
            <label key={item.id} className="flex items-center gap-2 p-2 rounded-xl bg-[#f1f6f3] cursor-pointer">
              <input
                type="checkbox"
                checked={!!item.done}
                onChange={e => void onToggleChecklist('onboarding', item.id, e.target.checked)}
              />
              <span className={item.done ? 'line-through text-[#53655b]' : 'font-semibold text-[#161d1a]'}>
                {item.label}
              </span>
              <span className="ml-auto text-[10px] text-[#007b52] font-semibold">{item.owner}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
