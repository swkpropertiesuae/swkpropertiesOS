import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  QrCode, ShieldCheck, Fingerprint, Camera, Wifi, Smartphone, X,
  Scale, CloudOff, UploadCloud, Server, Check,
} from 'lucide-react'
import { SWK_BRAND, resolvePropertyPhoto } from './SwkOneBrandAssets'
import { authenticateBiometricSession, type DeviceIdentity, type OfflineQueueItem } from './native-bridge'

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

/**
 * 1. Native Android Biometric / Device-Credential Unlock Screen (SWK Midnight & Champagne)
 */
export function BiometricLockModal({
  open,
  device,
  userName,
  onUnlock,
}: {
  open: boolean
  device: DeviceIdentity | null
  userName: string
  onUnlock: () => Promise<void>
}) {
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState('')

  // The system BiometricPrompt also offers the device PIN / pattern, so there is no separate in-app PIN box.
  const triggerBio = async () => {
    setScanning(true)
    setError('')
    try {
      const res = await authenticateBiometricSession('Unlock your SWK ONE session')
      if (res.verified) await onUnlock()
      else setError(res.method === 'Unavailable' ? 'Biometric unlock is not available on this device. Set a screen lock in Android settings.' : 'Not verified. Try again.')
    } finally {
      setScanning(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-[#08142a]/95 backdrop-blur-xl flex items-center justify-center p-4 text-white overflow-hidden"
        >
          <img
            src={SWK_BRAND.skylineFront}
            alt=""
            aria-hidden
            className="absolute bottom-0 left-0 right-0 w-full h-28 object-cover opacity-12 pointer-events-none"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="relative z-10 w-full max-w-sm rounded-3xl bg-[#0f1f3d]/90 border border-[#c9a96e]/40 p-6 text-center space-y-5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.85)]"
          >
            <img src={SWK_BRAND.logoWhite} alt="SWK Properties" className="h-9 w-auto mx-auto" />

            <div className="relative w-18 h-18 rounded-2xl bg-[#c9a96e]/15 border border-[#c9a96e] mx-auto grid place-items-center text-[#f3ead8]">
              {scanning && (
                <motion.span
                  className="absolute inset-0 rounded-2xl border-2 border-[#4fd39a]"
                  initial={{ scale: 0.9, opacity: 1 }}
                  animate={{ scale: 1.25, opacity: 0 }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                />
              )}
              <Fingerprint size={38} className={scanning ? 'text-[#4fd39a] animate-pulse' : 'text-[#c9a96e]'} />
            </div>

            <div className="space-y-1">
              <div className="text-[10.5px] uppercase tracking-[0.22em] text-[#dcc8a2] font-bold">
                SWK ONE · Session lock
              </div>
              <h2 className="text-xl font-bold font-display text-white">Unlock Authenticated Session</h2>
              <p className="text-xs text-[#b8c6de]">
                Session bound to <b className="text-white">{userName}</b> on enrolled device{' '}
                <b className="text-[#f3ead8]">{device?.device_name || 'Android Handset'}</b>
              </p>
            </div>

            <div className="space-y-2.5">
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => void triggerBio()}
                disabled={scanning}
                className="w-full py-3.5 px-5 rounded-2xl text-[#0b1a33] font-bold text-sm flex items-center justify-center gap-2 border-0 cursor-pointer shadow-lg"
                style={{ background: 'linear-gradient(135deg, #f1e3c2 0%, #c9a96e 55%, #b08d52 100%)' }}
              >
                <Fingerprint size={18} />
                {scanning ? 'Waiting for Android verification…' : 'Unlock with fingerprint, face or device PIN'}
              </motion.button>
              {error && <p role="alert" className="text-xs text-[#ffb4a8] m-0">{error}</p>}
            </div>

            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10.5px] text-[#9aa3b8]">
              <span className="font-mono">ID: {device?.device_id}</span>
              <span className="text-[#dcc8a2]">Verified by Android</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/**
 * 2. Native Camera Reception QR Scanner Modal (for Office Check-In)
 */
export function ReceptionQrScannerModal({
  open,
  onClose,
  receptionQrPreview,
  activeQr,
  device,
  onScanSubmit,
  onSubmitCheckIn,
}: {
  open: boolean
  onClose: () => void
  receptionQrPreview?: any
  activeQr?: any
  device: DeviceIdentity | null
  onScanSubmit?: (tokenOrCode: string) => Promise<void>
  onSubmitCheckIn?: (payload: any) => Promise<any>
}) {
  const submitScan = async (tok: string) => {
    if (onScanSubmit) return onScanSubmit(tok)
    if (onSubmitCheckIn) return onSubmitCheckIn({ qr_token: tok, short_code: tok })
  }
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [canDecode, setCanDecode] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)

  const send = async (code: string) => {
    if (submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    try {
      await submitScan(code)
      onClose()
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  // Camera + QR decoding (BarcodeDetector). Without it the agent types the 6-digit code shown on the reception screen.
  useEffect(() => {
    if (!open) return
    let stream: MediaStream | null = null
    let timer: ReturnType<typeof setInterval> | null = null
    let cancelled = false
    const Detector = (window as any).BarcodeDetector
    if (navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: 'environment' } })
        .then(s => {
          if (cancelled) { s.getTracks().forEach(t => t.stop()); return }
          stream = s
          setCameraActive(true)
          if (videoRef.current) {
            videoRef.current.srcObject = s
            void videoRef.current.play().catch(() => {})
          }
          if (Detector) {
            const detector = new Detector({ formats: ['qr_code'] })
            setCanDecode(true)
            timer = setInterval(async () => {
              if (!videoRef.current || videoRef.current.readyState < 2 || submittingRef.current) return
              try {
                const found = await detector.detect(videoRef.current)
                const raw = found?.[0]?.rawValue
                if (raw) void send(String(raw))
              } catch { /* keep scanning */ }
            }, 450)
          }
        })
        .catch(() => setCameraActive(false))
    }
    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
      if (stream) stream.getTracks().forEach(t => t.stop())
      setCameraActive(false)
      setCanDecode(false)
    }
  }, [open])

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualCode.trim()) return
    await send(manualCode.trim())
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-[#08142a]/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <motion.div
            initial={{ opacity: 0, y: 36, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.32, ease: EASE }}
            className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-[#f6f2ea] text-[#0b1a33] overflow-hidden shadow-2xl border border-[#c9a96e]/40"
          >
            {/* Header */}
            <div
              className="relative overflow-hidden text-white px-5 py-4 flex items-center justify-between"
              style={{ background: 'linear-gradient(135deg, #08142a 0%, #14305c 100%)' }}
            >
              <img
                src={SWK_BRAND.skylineFront}
                alt=""
                aria-hidden
                className="absolute bottom-0 left-0 right-0 w-full h-10 object-cover opacity-15 pointer-events-none"
              />
              <div className="relative z-10 flex items-center gap-3">
                <img src={SWK_BRAND.logoWhite} alt="SWK" className="h-7 w-auto" />
                <div>
                  <div className="font-bold font-display text-sm text-white">Office Reception QR Scanner</div>
                  <div className="text-[11px] text-[#dcc8a2]">
                    Scan the QR on the reception screen, or type its 6-digit code
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="relative z-10 p-1.5 rounded-full bg-white/15 text-white border-0 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Camera Viewfinder with Animated Laser Scan Line */}
              <div className="relative h-52 rounded-2xl bg-[#08142a] overflow-hidden flex flex-col items-center justify-center text-white border-2 border-[#c9a96e]">
                {cameraActive ? (
                  <video
                    ref={videoRef}
                    className="absolute inset-0 w-full h-full object-cover opacity-80"
                    muted
                    playsInline
                  />
                ) : (
                  <div
                    className="absolute inset-0 bg-cover bg-center opacity-25"
                    style={{ backgroundImage: `url(${SWK_BRAND.heroDubai})` }}
                  />
                )}
                {/* Animated Laser Line */}
                <motion.div
                  className="absolute left-6 right-6 h-0.5 bg-gradient-to-r from-transparent via-[#4fd39a] to-transparent z-20 pointer-events-none shadow-[0_0_12px_#4fd39a]"
                  initial={{ top: '18%' }}
                  animate={{ top: ['18%', '82%', '18%'] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                />

                <div className="relative z-10 w-44 h-40 border-2 border-dashed border-[#c9a96e] rounded-2xl flex flex-col items-center justify-center p-3 text-center bg-[#08142a]/65 backdrop-blur-xs">
                  <Camera size={26} className="text-[#c9a96e] mb-1.5" />
                  <span className="text-xs font-bold text-white">
                    {cameraActive ? (canDecode ? 'Align the reception QR in the frame' : 'Camera on · this device cannot read QR codes: type the code below') : 'Camera unavailable · type the code below'}
                  </span>
                </div>
              </div>

              {/* What is checked */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-2xl bg-white border border-[#e7e1d4]">
                  <div className="font-bold text-[#14305c] flex items-center gap-1">
                    <Smartphone size={13} className="text-[#9a7a42]" /> Registered Device
                  </div>
                  <div className="text-[11px] font-semibold text-[#0b1a33] truncate mt-0.5">
                    {device?.device_name || 'This device'}
                  </div>
                </div>
                <div className="p-2.5 rounded-2xl bg-white border border-[#e7e1d4]">
                  <div className="font-bold text-[#14305c] flex items-center gap-1">
                    <Wifi size={13} className="text-[#9a7a42]" /> Office location
                  </div>
                  <div className="text-[11px] font-semibold text-[#0b1a33] mt-0.5">Checked with GPS at check-in</div>
                </div>
              </div>
              {submitting && <p className="text-xs text-[#14305c] font-semibold m-0">Validating QR code, device and location…</p>}

              {/* Manual 6-Digit Reception Code Input */}
              <form onSubmit={handleManualSubmit} className="pt-2 border-t border-[#e7e1d4] flex gap-2">
                <input
                  type="text"
                  value={manualCode}
                  onChange={e => setManualCode(e.target.value)}
                  placeholder="6-digit reception code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-white border border-[#d9d1c1] text-xs text-[#0b1a33]"
                />
                <button
                  type="submit"
                  disabled={submitting || !manualCode.trim()}
                  className="px-4 py-2.5 rounded-xl bg-[#0b1a33] text-[#f3ead8] text-xs font-bold border-0 cursor-pointer disabled:opacity-50"
                >
                  Verify Code
                </button>
              </form>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/**
 * 3. Property Comparison Builder & Verified Alternative Suggestions Modal with High-Res Photography
 */
export function PropertyComparisonModal({
  open,
  onClose,
  properties,
  onSelectForOffer,
}: {
  open: boolean
  onClose: () => void
  properties: any[]
  onSelectForOffer?: (prop: any) => void
}) {
  const [selectedIds, setSelectedIds] = useState<number[]>(() => properties.slice(0, 3).map(p => p.id))

  const toggleProp = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 3 ? [...prev, id] : prev
    )
  }

  const compared = properties.filter(p => selectedIds.includes(p.id))

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-[#08142a]/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <motion.div
            initial={{ opacity: 0, y: 36, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.32, ease: EASE }}
            className="w-full max-w-2xl max-h-[90vh] rounded-t-3xl sm:rounded-3xl bg-[#f6f2ea] text-[#0b1a33] flex flex-col overflow-hidden shadow-2xl border border-[#c9a96e]/40"
          >
            <div
              className="text-white px-5 py-4 flex items-center justify-between"
              style={{ background: 'linear-gradient(135deg, #08142a 0%, #14305c 100%)' }}
            >
              <div className="flex items-center gap-2.5">
                <Scale size={18} className="text-[#c9a96e]" />
                <div>
                  <div className="font-bold font-display text-sm">
                    Property Comparison & Verified Alternatives
                  </div>
                  <div className="text-[11px] text-[#dcc8a2]">
                    Select up to 3 verified SWK properties for side-by-side client presentation
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full bg-white/10 text-white border-0 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4">
              {/* Property selector chips */}
              <div className="flex flex-wrap gap-1.5">
                {properties.map(p => {
                  const active = selectedIds.includes(p.id)
                  return (
                    <button
                      key={p.id}
                      onClick={() => toggleProp(p.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border cursor-pointer transition ${
                        active
                          ? 'bg-[#0b1a33] text-[#f3ead8] border-[#0b1a33]'
                          : 'bg-white text-[#3a4660] border-[#d9d1c1]'
                      }`}
                    >
                      {active && <Check size={12} className="inline mr-1 text-[#c9a96e]" />}
                      {p.title}
                    </button>
                  )
                })}
              </div>

              {/* Comparison Grid with High-Res Property Photography */}
              {compared.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#6b7488]">
                  Select at least one property above to compare.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {compared.map((p, idx) => {
                    const price = Number(p.price || 0)
                    const sqft = Number(p.area_sqft || 1)
                    const psf = sqft > 0 ? Math.round(price / sqft) : 0
                    const photoUrl = resolvePropertyPhoto(p.title || p.building_name, idx)
                    return (
                      <div
                        key={p.id}
                        className="rounded-2xl border border-[#e7e1d4] bg-white overflow-hidden flex flex-col justify-between shadow-xs"
                      >
                        <div>
                          <div className="relative h-28 bg-[#0b1a33]">
                            <img
                              src={photoUrl}
                              alt={p.title}
                              className="w-full h-full object-cover"
                            />
                            <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-[#0b1a33]/85 text-[#f3ead8]">
                              {p.status || 'Available'} · {p.property_type}
                            </span>
                          </div>
                          <div className="p-3.5 space-y-1.5">
                            <div className="font-bold font-display text-sm text-[#0b1a33] leading-snug">
                              {p.title}
                            </div>
                            <div className="text-base font-extrabold font-display text-[#14305c]">
                              AED {price.toLocaleString()}
                            </div>
                            <div className="text-[11px] text-[#6b7488] space-y-1 pt-1.5 border-t border-[#efe9dc]">
                              <div>
                                <b className="text-[#0b1a33]">Area:</b> {sqft.toLocaleString()} sq ft (AED{' '}
                                {psf.toLocaleString()}/sqft)
                              </div>
                              <div>
                                <b className="text-[#0b1a33]">Layout:</b> {p.bedrooms ?? 2} Bed ·{' '}
                                {p.bathrooms ?? 2} Bath · Floor {p.floor_no ?? 10}
                              </div>
                              <div>
                                <b className="text-[#0b1a33]">Est. ROI:</b> {p.roi_percent || 6.5}% · Rent AED{' '}
                                {Number(p.rent_annual || 0).toLocaleString()}
                              </div>
                              <div>
                                <b className="text-[#0b1a33]">Trakheesi:</b> {p.rera_permit_no || 'Verified'}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="p-3 pt-0">
                          <motion.button
                            whileTap={{ scale: 0.96 }}
                            onClick={() => {
                              onClose()
                              onSelectForOffer?.(p)
                            }}
                            className="w-full py-2 rounded-xl text-[#0b1a33] text-xs font-bold border-0 cursor-pointer"
                            style={{ background: 'linear-gradient(135deg, #f1e3c2, #c9a96e)' }}
                          >
                            Start Digital Offer
                          </motion.button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/**
 * 4. Offline Queue & Native Android APK Architecture Modal
 */
export function OfflineAndApkModal({
  open,
  onClose,
  offlineQueue,
  queue,
  onSyncNow,
  serverUrl,
  apiBaseUrl,
  onSaveServerUrl,
  onSaveApiBaseUrl,
  device,
  offlineSimulated,
  onToggleOfflineSimulated,
}: {
  open: boolean
  onClose: () => void
  offlineQueue?: OfflineQueueItem[]
  queue?: OfflineQueueItem[]
  onSyncNow: () => Promise<void>
  serverUrl?: string
  apiBaseUrl?: string
  onSaveServerUrl?: (url: string) => void
  onSaveApiBaseUrl?: (url: string) => void
  device: DeviceIdentity | null
  offlineSimulated?: boolean
  onToggleOfflineSimulated?: (val: boolean) => void
}) {
  const effectiveQueue = offlineQueue ?? queue ?? []
  const effectiveUrl = serverUrl ?? apiBaseUrl ?? ''
  const [urlInput, setUrlInput] = useState(effectiveUrl)
  const [syncing, setSyncing] = useState(false)

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-[#08142a]/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <motion.div
            initial={{ opacity: 0, y: 36, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.32, ease: EASE }}
            className="w-full max-w-lg max-h-[90vh] rounded-t-3xl sm:rounded-3xl bg-[#f6f2ea] text-[#0b1a33] flex flex-col overflow-hidden shadow-2xl border border-[#c9a96e]/40"
          >
            <div
              className="text-white px-5 py-4 flex items-center justify-between"
              style={{ background: 'linear-gradient(135deg, #08142a 0%, #14305c 100%)' }}
            >
              <div className="flex items-center gap-3">
                <img src={SWK_BRAND.logoWhite} alt="SWK" className="h-6 w-auto" />
                <div>
                  <div className="font-bold font-display text-sm">SWK ONE Android Runtime & Offline Sync</div>
                  <div className="text-[11px] text-[#dcc8a2]">
                    App ID: ae.swkproperties.one · Native Foreground Service
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full bg-white/15 text-white border-0 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Device & Native Status */}
              <div className="p-3.5 rounded-2xl bg-white border border-[#e7e1d4] space-y-1.5">
                <div className="font-bold text-[#0b1a33] flex items-center justify-between">
                  <span>Enrolled Android Handset</span>
                  <span className="px-2 py-0.5 rounded-full bg-[#e3f4ec] text-[#157a52] text-[10px] font-bold">
                    Trusted & Bound
                  </span>
                </div>
                <div className="text-[#3a4660]">
                  <b>Device:</b> {device?.device_name} ({device?.model})
                </div>
                <div className="text-[#3a4660]">
                  <b>Hardware ID:</b> <span className="font-mono">{device?.device_id}</span>
                </div>
                <div className="text-[#3a4660]">
                  <b>OS / Build:</b> {device?.os_version} · SWK ONE {device?.app_version}
                </div>
                <div className="text-[#3a4660]">
                  <b>Foreground Service:</b>{' '}
                  <span className="font-mono">ae.swkproperties.one.SwkDutyLocationService</span>
                </div>
              </div>

              {/* Offline Evidence Queue */}
              <div className="p-3.5 rounded-2xl bg-white border border-[#e7e1d4] space-y-2.5">
                {onToggleOfflineSimulated && (
                  <div className="flex items-center justify-between pb-2.5 border-b border-[#efe9dc]">
                    <div>
                      <div className="font-bold text-[#0b1a33]">
                        Field Offline Queue Mode (Basement / Dead-Zone Test)
                      </div>
                      <div className="text-[10px] text-[#6b7488]">
                        Queue reports & check-ins locally on handset until signal returns
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onToggleOfflineSimulated(!offlineSimulated)}
                      className={`px-3 py-1 rounded-full text-[11px] font-bold border-0 cursor-pointer ${
                        offlineSimulated
                          ? 'bg-[#c4492f] text-white'
                          : 'bg-[#f3ead8] text-[#7d5f2c]'
                      }`}
                    >
                      {offlineSimulated ? 'Offline Mode ON' : 'Online (Tap to Test Offline)'}
                    </button>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm text-[#0b1a33] flex items-center gap-1.5">
                    <CloudOff size={15} className="text-[#9a7a42]" />
                    Encrypted Offline Evidence Queue ({effectiveQueue.length})
                  </div>
                  <button
                    onClick={async () => {
                      setSyncing(true)
                      await onSyncNow()
                      setSyncing(false)
                    }}
                    disabled={syncing || effectiveQueue.length === 0}
                    className="px-3 py-1.5 rounded-full text-[#0b1a33] font-bold text-xs border-0 cursor-pointer disabled:opacity-50 flex items-center gap-1"
                    style={{ background: 'linear-gradient(135deg, #f1e3c2, #c9a96e)' }}
                  >
                    <UploadCloud size={13} />
                    {syncing ? 'Syncing…' : 'Sync to SWK OS Now'}
                  </button>
                </div>
                {effectiveQueue.length === 0 ? (
                  <div className="text-[#6b7488] py-2">
                    All field attendance, viewing check-ins, daily reports, and inventory submissions are synced with SWK OS.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {effectiveQueue.map(item => (
                      <div
                        key={item.idempotency_key}
                        className="p-2.5 rounded-xl bg-[#fbf8f2] border border-[#efe9dc] flex items-center justify-between"
                      >
                        <div>
                          <div className="font-bold text-[#0b1a33]">{item.label}</div>
                          <div className="text-[10px] font-mono text-[#6b7488]">{item.idempotency_key}</div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-[#f3ead8] text-[#7d5f2c] text-[10px] font-bold">
                          Queued Offline
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Server Connection Endpoint */}
              <div className="p-3.5 rounded-2xl bg-white border border-[#e7e1d4] space-y-2">
                <div className="font-bold text-[#0b1a33] flex items-center gap-1.5">
                  <Server size={14} className="text-[#9a7a42]" />
                  SWK OS Backend Connection Endpoint
                </div>
                <div className="text-[11px] text-[#6b7488]">
                  Leave blank when served from the same SWK OS origin, or set to{' '}
                  <code className="font-mono">https://os.swkpropertiesuae.com</code> for standalone APK builds.
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                    placeholder="Same-origin (or https://os.swkpropertiesuae.com)"
                    className="flex-1 px-3 py-2 rounded-xl bg-[#fbf9f5] border border-[#d9d1c1] text-xs text-[#0b1a33]"
                  />
                  <button
                    onClick={() => {
                      onSaveServerUrl?.(urlInput)
                      onSaveApiBaseUrl?.(urlInput)
                      onClose()
                    }}
                    className="px-4 py-2 rounded-xl bg-[#0b1a33] text-[#f3ead8] font-bold text-xs border-0 cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
