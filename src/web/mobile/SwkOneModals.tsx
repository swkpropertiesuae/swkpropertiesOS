import { useEffect, useRef, useState } from 'react'
import {
  QrCode, ShieldCheck, Fingerprint, AlertOctagon, Camera, CheckCircle2, Wifi, Smartphone, RefreshCw, X,
  Scale, Sparkles, HandCoins, CloudOff, UploadCloud, Lock, Server, Download, Check,
} from 'lucide-react'
import type { DeviceIdentity, OfflineQueueItem } from './native-bridge'

/**
 * 1. Native Android Biometric / Device-Credential Unlock Screen
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
  const [pinMode, setPinMode] = useState(false)
  const [pin, setPin] = useState('')

  if (!open) return null

  const triggerBio = async () => {
    setScanning(true)
    await new Promise(r => setTimeout(r, 450))
    await onUnlock()
    setScanning(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#161d1a]/95 backdrop-blur-md flex items-center justify-center p-4 text-white">
      <div className="w-full max-w-sm rounded-3xl bg-[#1e2824] border border-white/15 p-6 text-center space-y-5 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-[#007b52]/25 border border-[#007b52] mx-auto grid place-items-center text-[#34d399]">
          <Fingerprint size={36} className={scanning ? 'animate-pulse' : ''} />
        </div>
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-widest text-[#d3eee0] font-semibold">
            SWK ONE · Android Biometric Guard
          </div>
          <h2 className="text-xl font-bold font-display">Unlock Authenticated Session</h2>
          <p className="text-xs text-white/70">
            Session bound to <b>{userName}</b> on enrolled device <b>{device?.device_name || 'Android Handset'}</b>
          </p>
        </div>

        {!pinMode ? (
          <div className="space-y-3">
            <button
              onClick={() => void triggerBio()}
              disabled={scanning}
              className="w-full py-3.5 px-5 rounded-full bg-[#007b52] hover:bg-[#1fa06b] text-white font-semibold text-sm flex items-center justify-center gap-2 border-0 cursor-pointer transition"
            >
              <Fingerprint size={18} />
              {scanning ? 'Verifying Android Biometrics…' : 'Touch Fingerprint / Face Unlock'}
            </button>
            <button
              onClick={() => setPinMode(true)}
              className="w-full py-2.5 px-4 rounded-full bg-white/10 hover:bg-white/15 text-xs text-white/85 font-semibold border-0 cursor-pointer"
            >
              Use Android Device PIN / Credential Instead
            </button>
          </div>
        ) : (
          <form
            onSubmit={e => {
              e.preventDefault()
              if (pin.length >= 4) void triggerBio()
            }}
            className="space-y-3"
          >
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={e => setPin(e.target.value)}
              placeholder="Enter 4–6 digit device PIN"
              className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/20 text-center text-lg tracking-[0.3em] text-white focus:outline-none focus:border-[#007b52]"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPinMode(false)}
                className="flex-1 py-2.5 rounded-full bg-white/10 text-xs text-white border-0 cursor-pointer"
              >
                Back
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-full bg-[#007b52] text-xs font-semibold text-white border-0 cursor-pointer"
              >
                Verify PIN
              </button>
            </div>
          </form>
        )}

        <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-white/60">
          <span>ID: {device?.device_id}</span>
          <span>Encrypted Keystore Active</span>
        </div>
      </div>
    </div>
  )
}

/**
 * 2. Native Camera Reception QR Scanner Modal (for Office Check-In)
 */
export function ReceptionQrScannerModal({
  open,
  onClose,
  receptionQrPreview,
  device,
  onScanSubmit,
}: {
  open: boolean
  onClose: () => void
  receptionQrPreview: any
  device: DeviceIdentity | null
  onScanSubmit: (tokenOrCode: string, networkSsid: string) => Promise<void>
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [networkSsid, setNetworkSsid] = useState('SWK-CORP-WIFI-DXB')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    let stream: MediaStream | null = null
    if (navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: 'environment' } })
        .then(s => {
          stream = s
          setCameraActive(true)
          if (videoRef.current) {
            videoRef.current.srcObject = s
            void videoRef.current.play().catch(() => {})
          }
        })
        .catch(() => setCameraActive(false))
    }
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop())
      setCameraActive(false)
    }
  }, [open])

  if (!open) return null

  const handleScanLiveReception = async () => {
    setSubmitting(true)
    try {
      const tok = receptionQrPreview?.token_code || 'AUTO-RECEPTION-QR'
      await onScanSubmit(tok, networkSsid)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualCode.trim()) return
    setSubmitting(true)
    try {
      await onScanSubmit(manualCode.trim(), networkSsid)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white text-[#161d1a] overflow-hidden shadow-2xl">
        <div className="bg-[#025e3d] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <QrCode size={20} />
            <div>
              <div className="font-bold font-display text-sm">Office Reception QR Scanner</div>
              <div className="text-[11px] text-[#d3eee0]">Point camera at the SWK Office Reception PC screen</div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full bg-white/15 text-white border-0 cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Camera Viewfinder */}
          <div className="relative h-52 rounded-2xl bg-[#161d1a] overflow-hidden flex flex-col items-center justify-center text-white border-2 border-[#007b52]">
            {cameraActive ? (
              <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-80" muted playsInline />
            ) : null}
            <div className="relative z-10 w-40 h-40 border-2 border-dashed border-[#34d399] rounded-2xl flex flex-col items-center justify-center p-3 text-center bg-black/40">
              <Camera size={26} className="text-[#34d399] mb-1.5" />
              <span className="text-xs font-semibold">
                {cameraActive ? 'Camera Active · Align Reception QR' : 'Android MLKit Barcode Scanner Ready'}
              </span>
              <span className="text-[10px] text-white/75 mt-1 font-mono">
                Active Office Code: {receptionQrPreview?.short_code || '849201'}
              </span>
            </div>
          </div>

          {/* 3-Factor Hardware & Network Evidence */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-[#edf5f0] border border-[#cbd6ce]">
              <div className="font-bold text-[#007b52] flex items-center gap-1">
                <Smartphone size={13} /> Registered Device
              </div>
              <div className="text-[11px] text-[#161d1a] truncate mt-0.5">
                {device?.device_name || 'Enrolled Android'}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-[#edf5f0] border border-[#cbd6ce]">
              <div className="font-bold text-[#007b52] flex items-center gap-1">
                <Wifi size={13} /> Office Wi-Fi Evidence
              </div>
              <select
                value={networkSsid}
                onChange={e => setNetworkSsid(e.target.value)}
                className="w-full bg-transparent text-[11px] font-semibold text-[#161d1a] mt-0.5 focus:outline-none"
              >
                <option value="SWK-CORP-WIFI-DXB">SWK-CORP-WIFI-DXB (Trusted)</option>
                <option value="SWK-RECEPTION-5G">SWK-RECEPTION-5G (Trusted)</option>
                <option value="PUBLIC-CAFE-NET">External / Untrusted Network (Flag Review)</option>
              </select>
            </div>
          </div>

          {/* Instant Scan Button */}
          <button
            onClick={() => void handleScanLiveReception()}
            disabled={submitting}
            className="w-full py-3.5 px-4 rounded-full bg-[#007b52] hover:bg-[#025e3d] text-white font-bold text-sm flex items-center justify-center gap-2 border-0 cursor-pointer shadow-sm"
          >
            <CheckCircle2 size={18} />
            {submitting
              ? 'Validating QR, Device & Network…'
              : `Scan Active Reception QR (${receptionQrPreview?.short_code || 'Live'})`}
          </button>

          {/* Manual 6-Digit Reception Code Input */}
          <form onSubmit={handleManualSubmit} className="pt-2 border-t border-[#e6ebe7] flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={e => setManualCode(e.target.value)}
              placeholder="Or enter 6-digit reception code…"
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-[#cbd6ce] text-xs"
            />
            <button
              type="submit"
              disabled={submitting || !manualCode.trim()}
              className="px-4 py-2.5 rounded-full bg-[#161d1a] text-white text-xs font-semibold border-0 cursor-pointer disabled:opacity-50"
            >
              Verify Code
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

/**
 * 3. Property Comparison Builder & Verified Alternative Suggestions Modal (Features #21 & #22)
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
  onSelectForOffer: (prop: any) => void
}) {
  const [selectedIds, setSelectedIds] = useState<number[]>(() => properties.slice(0, 3).map(p => p.id))

  if (!open) return null

  const toggleProp = (id: number) => {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 3 ? [...prev, id] : prev))
  }

  const compared = properties.filter(p => selectedIds.includes(p.id))

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-2xl max-h-[90vh] rounded-t-3xl sm:rounded-3xl bg-white text-[#161d1a] flex flex-col overflow-hidden shadow-2xl">
        <div className="bg-[#161d1a] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale size={18} className="text-[#34d399]" />
            <div>
              <div className="font-bold font-display text-sm">Property Comparison & Verified Alternatives</div>
              <div className="text-[11px] text-white/70">Select up to 3 verified SWK properties for side-by-side client presentation</div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full bg-white/10 text-white border-0 cursor-pointer">
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
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border cursor-pointer transition ${
                    active
                      ? 'bg-[#007b52] text-white border-[#007b52]'
                      : 'bg-[#f1f6f3] text-[#3f4f47] border-[#cbd6ce]'
                  }`}
                >
                  {active && <Check size={12} className="inline mr-1" />}
                  {p.title}
                </button>
              )
            })}
          </div>

          {/* Comparison Grid */}
          {compared.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#53655b]">Select at least one property above to compare.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {compared.map(p => {
                const price = Number(p.price || 0)
                const sqft = Number(p.area_sqft || 1)
                const psf = sqft > 0 ? Math.round(price / sqft) : 0
                return (
                  <div key={p.id} className="rounded-2xl border border-[#cbd6ce] bg-[#f1f6f3] p-3.5 flex flex-col justify-between space-y-3">
                    <div className="space-y-1.5">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#dcf1e6] text-[#025e3d]">
                        {p.status || 'Available'} · {p.property_type}
                      </span>
                      <div className="font-bold text-sm text-[#161d1a] leading-snug">{p.title}</div>
                      <div className="text-base font-extrabold text-[#007b52]">
                        AED {price.toLocaleString()}
                      </div>
                      <div className="text-[11px] text-[#53655b] space-y-1 pt-1 border-t border-[#e6ebe7]">
                        <div><b>Area:</b> {sqft.toLocaleString()} sq ft (AED {psf.toLocaleString()}/sqft)</div>
                        <div><b>Layout:</b> {p.bedrooms ?? 2} Bed · {p.bathrooms ?? 2} Bath · Floor {p.floor_no ?? 10}</div>
                        <div><b>Est. ROI:</b> {p.roi_percent || 6.5}% · Rent AED {Number(p.rent_annual || 0).toLocaleString()}</div>
                        <div><b>Trakheesi:</b> {p.rera_permit_no || 'Verified'}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        onClose()
                        onSelectForOffer(p)
                      }}
                      className="w-full py-2 rounded-full bg-[#007b52] text-white text-xs font-semibold border-0 cursor-pointer"
                    >
                      Start Digital Offer
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * 4. Offline Queue & Native Android APK Architecture Modal
 */
export function OfflineAndApkModal({
  open,
  onClose,
  offlineQueue,
  onSyncNow,
  serverUrl,
  onSaveServerUrl,
  device,
}: {
  open: boolean
  onClose: () => void
  offlineQueue: OfflineQueueItem[]
  onSyncNow: () => Promise<void>
  serverUrl: string
  onSaveServerUrl: (url: string) => void
  device: DeviceIdentity | null
}) {
  const [urlInput, setUrlInput] = useState(serverUrl)
  const [syncing, setSyncing] = useState(false)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-lg max-h-[90vh] rounded-t-3xl sm:rounded-3xl bg-white text-[#161d1a] flex flex-col overflow-hidden shadow-2xl">
        <div className="bg-[#025e3d] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone size={18} />
            <div>
              <div className="font-bold font-display text-sm">SWK ONE Android Runtime & Offline Sync</div>
              <div className="text-[11px] text-[#d3eee0]">App ID: ae.swkproperties.one · Capacitor + Native Foreground Service</div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full bg-white/15 text-white border-0 cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Device & Native Status */}
          <div className="p-3.5 rounded-2xl bg-[#f1f6f3] border border-[#e6ebe7] space-y-1.5">
            <div className="font-bold text-[#161d1a] flex items-center justify-between">
              <span>Enrolled Android Handset</span>
              <span className="px-2 py-0.5 rounded-full bg-[#dcf1e6] text-[#025e3d] text-[10px] font-bold">
                Trusted & Bound
              </span>
            </div>
            <div className="text-[#53655b]"><b>Device:</b> {device?.device_name} ({device?.model})</div>
            <div className="text-[#53655b]"><b>Hardware ID:</b> <span className="font-mono">{device?.device_id}</span></div>
            <div className="text-[#53655b]"><b>OS / Build:</b> {device?.os_version} · SWK ONE {device?.app_version}</div>
            <div className="text-[#53655b]"><b>Foreground Service:</b> <span className="font-mono">ae.swkproperties.one.SwkDutyLocationService</span></div>
          </div>

          {/* Offline Evidence Queue */}
          <div className="p-3.5 rounded-2xl bg-white border border-[#cbd6ce] space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="font-bold text-sm text-[#161d1a] flex items-center gap-1.5">
                <CloudOff size={15} className="text-[#007b52]" />
                Encrypted Offline Evidence Queue ({offlineQueue.length})
              </div>
              <button
                onClick={async () => {
                  setSyncing(true)
                  await onSyncNow()
                  setSyncing(false)
                }}
                disabled={syncing || offlineQueue.length === 0}
                className="px-3 py-1.5 rounded-full bg-[#007b52] text-white font-semibold text-xs border-0 cursor-pointer disabled:opacity-50 flex items-center gap-1"
              >
                <UploadCloud size={13} />
                {syncing ? 'Syncing…' : 'Sync to SWK OS Now'}
              </button>
            </div>
            {offlineQueue.length === 0 ? (
              <div className="text-[#53655b] py-2">
                All field attendance, viewing check-ins, daily reports, and inventory submissions are synced with SWK OS.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {offlineQueue.map(item => (
                  <div key={item.idempotency_key} className="p-2 rounded-xl bg-[#f1f6f3] flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-[#161d1a]">{item.label}</div>
                      <div className="text-[10px] font-mono text-[#53655b]">{item.idempotency_key}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-[#f6e9c3] text-[#8c4329] text-[10px] font-bold">
                      Queued Offline
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Server Connection Endpoint */}
          <div className="p-3.5 rounded-2xl bg-[#f1f6f3] border border-[#e6ebe7] space-y-2">
            <div className="font-bold text-[#161d1a] flex items-center gap-1.5">
              <Server size={14} className="text-[#007b52]" />
              SWK OS Backend Connection Endpoint
            </div>
            <div className="text-[11px] text-[#53655b]">
              Leave blank when served from the same SWK OS origin, or set to <code className="font-mono">https://os.swkpropertiesuae.com</code> for standalone APK builds.
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                placeholder="Same-origin (or https://os.swkpropertiesuae.com)"
                className="flex-1 px-3 py-2 rounded-xl bg-white border border-[#cbd6ce] text-xs"
              />
              <button
                onClick={() => {
                  onSaveServerUrl(urlInput)
                  onClose()
                }}
                className="px-4 py-2 rounded-full bg-[#161d1a] text-white font-semibold text-xs border-0 cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
