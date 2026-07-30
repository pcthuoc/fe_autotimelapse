import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  getCameras, getCameraDevice, getCameraSettings, getLiveLatest,
  updateCamera, createCamera, updateCameraDevice,
  getSites, createSite, searchUsers, regenerateCredential,
  getCameraMqttStatus, registerCameraMqtt,
} from '../api/client'
import type { Camera, Site } from '../api/types'
import { useAuth } from '../contexts/AuthContext'
import {
  Search, Camera as CameraIcon, Wifi, WifiOff,
  X, Plus, RefreshCw, Settings, Building2, Clock, Image as ImageIcon, Shield,
  ChevronDown, ChevronRight, Wifi as WifiOn, LayoutGrid, Info, Copy, Check, Key,
} from 'lucide-react'

/* ── util ── */
function fmtTime(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('vi-VN', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })
}
function humanBytes(b: number) {
  if (b >= 1e9) return (b/1e9).toFixed(1)+' GB'
  if (b >= 1e6) return (b/1e6).toFixed(1)+' MB'
  return (b/1e3).toFixed(0)+' KB'
}

/* ── Signal bars ── */
function SigBars({ bars, dbm }: { bars: number; dbm?: number|null }) {
  const heights = [30,55,75,100]
  return (
    <span className="sig-bars" style={{ verticalAlign: 'middle' }}>
      {heights.map((h,i) => (
        <span key={i} className="sig-bar" style={{ height:`${h}%`, background: i<bars ? 'var(--status-ok)' : 'var(--border-bright)' }} />
      ))}
      {dbm != null && <span style={{ fontSize:'.6rem', color:'var(--text-muted)', marginLeft:3 }}>{dbm}dBm</span>}
    </span>
  )
}

/* ── Online dot ── */
function OnlineDot({ on }: { on: boolean }) {
  return <span style={{ display:'inline-block', width:8, height:8, borderRadius:'50%', flexShrink:0, background: on ? 'var(--status-ok)' : 'var(--text-muted)' }} className={on?'online-pulse':''} />
}

/* ── Status pill ── */
function StatusPill({ status }: { status: string }) {
  const cls = status==='active'?'badge-active':status==='inactive'?'badge-inactive':'badge-maintenance'
  return <span className={`badge-base ${cls}`}>{status.toUpperCase()}</span>
}

/* ── Toast ── */
let _toastTimeout: ReturnType<typeof setTimeout>
function showToast(msg: string, type: 'success'|'error' = 'success') {
  const el = document.createElement('div')
  el.className = `toast ${type}`
  el.textContent = msg
  document.body.appendChild(el)
  clearTimeout(_toastTimeout)
  setTimeout(() => el.remove(), 3000)
}

/* ════════════════════════════════════════════
   CAMERA DEVICE MODAL — unified control panel
   Matches Django _camera_device_modal.html
   ════════════════════════════════════════════ */

const CAMERA_MODELS = [
  { v: 'nikon_d5300', label: 'Nikon D5300' },
  { v: 'nikon_d3500', label: 'Nikon D3500' },
  { v: 'nikon_d7500', label: 'Nikon D7500' },
  { v: 'nikon_z50',   label: 'Nikon Z50' },
  { v: 'canon_200d',  label: 'Canon EOS 200D' },
  { v: 'canon_90d',   label: 'Canon EOS 90D' },
  { v: 'generic',     label: 'Generic (khác)' },
]

const TIMEZONES = [
  { v: 'Asia/Ho_Chi_Minh', label: 'GMT+7 (Việt Nam)' },
  { v: 'Asia/Bangkok',     label: 'GMT+7 (Bangkok)' },
  { v: 'UTC',              label: 'UTC' },
]

const CAM_SETTINGS_FIELDS = [
  { key: 'iso',                   label: 'ISO'           },
  { key: 'aperture',              label: 'Aperture'      },
  { key: 'shutter_speed',         label: 'Shutter Speed' },
  { key: 'exposure_compensation', label: 'EV'            },
  { key: 'white_balance',         label: 'White Balance' },
  { key: 'image_format',          label: 'Image Format'  },
  { key: 'image_size',            label: 'Image Size'    },
  { key: 'focus_mode',            label: 'Focus Mode'    },
  { key: 'autofocus',             label: 'Autofocus'     },
  { key: 'liveview_af',           label: 'Live View AF'  },
  { key: 'capture_mode',          label: 'Capture Mode'  },
  { key: 'capture_target',        label: 'Capture Target'},
  { key: 'high_iso_nr',           label: 'High ISO NR'   },
  { key: 'long_exp_nr',           label: 'Long-exp. NR'  },
] as const

/* ── MqttStatusBadge: kiểm tra + đăng ký lại MQTT ngay trong modal ── */
function MqttStatusBadge({ camId, camCode }: { camId: string; camCode: string }) {
  const [status, setStatus] = useState<null | { ready: boolean; mqtt_registered: boolean; in_group: boolean; errors?: string[] }>(null)
  const [loading, setLoading] = useState(false)
  const [registering, setRegistering] = useState(false)

  const check = async () => {
    setLoading(true)
    try {
      const r = await getCameraMqttStatus(camId)
      setStatus(r.data)
    } catch { setStatus(null) }
    setLoading(false)
  }

  const doRegister = async () => {
    setRegistering(true)
    try {
      const r = await registerCameraMqtt(camId)
      setStatus(r.data)
    } catch { alert('Lỗi đăng ký MQTT') }
    setRegistering(false)
  }

  if (!status && !loading) return (
    <button className="atl-btn ghost" style={{ fontSize: '.65rem', padding: '2px 8px' }} onClick={check}>
      ⚙ MQTT status
    </button>
  )
  if (loading || registering) return (
    <span style={{ fontSize: '.65rem', color: 'var(--text-muted)' }}>
      <RefreshCw size={10} style={{ display:'inline', marginRight:3, animation:'spin 1s linear infinite' }} />
      {registering ? 'Đang đăng ký…' : 'Đang kiểm tra…'}
    </span>
  )
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        fontSize: '.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 8,
        background: status?.ready ? 'rgba(52,211,153,.12)' : 'rgba(248,113,113,.12)',
        color: status?.ready ? '#34d399' : '#f87171',
      }}>
        {status?.ready ? '✓ MQTT OK' : '⚠ MQTT lỗi'}
      </span>
      {!status?.ready && (
        <button className="atl-btn ghost" style={{ fontSize: '.65rem', padding: '2px 8px', color: '#f59e0b' }}
                onClick={doRegister} disabled={registering}>
          ⟳ Re-register
        </button>
      )}
    </div>
  )
}

/* ── SimConfig: hiện đầy đủ sim.py config sẵn sàng copy ── */
function CredentialInline({ camId }: { camId: string }) {
  const [open, setOpen] = useState(false)
  const [cfg, setCfg] = useState<null | Record<string, string | number>>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = async () => {
    if (cfg) { setOpen(true); return }
    setLoading(true)
    try {
      const { getCameraCredentials } = await import('../api/client')
      // Dùng simconfig endpoint
      const axios = (await import('../api/client')).api
      const r = await axios.get(`/cameras/${camId}/simconfig/`)
      setCfg(r.data)
      setOpen(true)
    } catch { alert('Không tải được config') }
    setLoading(false)
  }

  const copyAll = () => {
    if (!cfg) return
    const text = [
      `# ── Thông số cố định ────────────────────────────────`,
      `CAMERA_CODE     = "${cfg.CAMERA_CODE}"`,
      `MQTT_PASSWORD   = "${cfg.MQTT_PASSWORD}"`,
      `MQTT_BROKER     = "${cfg.MQTT_BROKER}"`,
      `MQTT_PORT       = ${cfg.MQTT_PORT}`,
      ``,
      `SERVER_BASE     = "${cfg.SERVER_BASE}"`,
      `DEVICE_KEY      = CAMERA_CODE       # = "${cfg.CAMERA_CODE}"`,
      `DEVICE_SECRET   = MQTT_PASSWORD     # = mqtt_password`,
    ].join('\n')
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500) })
  }

  if (!open) return (
    <button className="atl-btn ghost" style={{ fontSize: '.65rem', padding: '2px 8px' }}
            onClick={load} disabled={loading}>
      {loading ? '…' : '📋 sim.py config'}
    </button>
  )

  return (
    <div style={{ position: 'absolute', right: 16, bottom: 16, zIndex: 20, background: 'var(--bg-secondary)', border: '1px solid #60a5fa', borderRadius: 12, padding: '.8rem 1rem', width: 440, boxShadow: '0 8px 32px rgba(0,0,0,.5)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontWeight: 800, fontSize: '.8rem', color: '#60a5fa' }}>📋 sim.py config</span>
        <button className="atl-btn ghost" style={{ padding: '2px 6px' }} onClick={() => setOpen(false)}><X size={13}/></button>
      </div>
      {cfg && (
        <>
          <div style={{ background: '#0d1117', borderRadius: 9, padding: '.8rem .9rem', fontFamily: 'monospace', fontSize: '.74rem', lineHeight: 1.8, userSelect: 'all', position: 'relative' }}>
            <div style={{ color: '#6e7681' }}># ── Thông số cố định ─────────</div>
            <div><span style={{ color: '#79c0ff' }}>CAMERA_CODE</span>   = <span style={{ color: '#a5d6ff' }}>"{cfg.CAMERA_CODE}"</span></div>
            <div><span style={{ color: '#79c0ff' }}>MQTT_PASSWORD</span> = <span style={{ color: '#a5d6ff' }}>"{cfg.MQTT_PASSWORD}"</span></div>
            <div><span style={{ color: '#79c0ff' }}>MQTT_BROKER</span>   = <span style={{ color: '#a5d6ff' }}>"{cfg.MQTT_BROKER}"</span></div>
            <div><span style={{ color: '#79c0ff' }}>MQTT_PORT</span>     = <span style={{ color: '#ffa657' }}>{cfg.MQTT_PORT}</span></div>
            <div style={{ marginTop: 4 }}><span style={{ color: '#79c0ff' }}>SERVER_BASE</span>   = <span style={{ color: '#a5d6ff' }}>"{cfg.SERVER_BASE}"</span></div>
            <div style={{ color: '#6e7681' }}><span style={{ color: '#79c0ff' }}>DEVICE_KEY</span>    = CAMERA_CODE</div>
            <div style={{ color: '#6e7681' }}><span style={{ color: '#79c0ff' }}>DEVICE_SECRET</span> = MQTT_PASSWORD</div>
          </div>
          <div style={{ fontSize: '.68rem', color: '#34d399', margin: '8px 0 6px' }}>
            ✓ Không hết hạn — DEVICE_KEY/SECRET = CAMERA_CODE/MQTT_PASSWORD
          </div>
          <div style={{ display: 'flex', gap: 7 }}>
            <button className="atl-btn primary" style={{ fontSize: '.72rem' }} onClick={copyAll}>
              {copied ? '✓ Đã copy' : '⎘ Copy toàn bộ'}
            </button>
            <button className="atl-btn" style={{ fontSize: '.72rem' }} onClick={() => setOpen(false)}>Đóng</button>
          </div>
        </>
      )}
    </div>
  )
}

function DevTile({ label, value, sub, bars }: { label: string; value: string; sub: string; bars?: number|null }) {  return (
    <div style={{ border:'1px solid var(--border-color)', borderRadius:8, padding:'.55rem .7rem', background:'var(--bg-primary)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:3 }}>
        {bars != null && (
          <span style={{ display:'inline-flex', alignItems:'flex-end', gap:2, height:12 }}>
            {[30,55,75,100].map((h,i) => (
              <span key={i} style={{ width:3, height:`${h}%`, borderRadius:2, display:'inline-block', background: i<(bars||0)?'var(--status-ok)':'var(--border-bright)' }} />
            ))}
          </span>
        )}
        <span style={{ fontSize:'.6rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.06em' }}>{label}</span>
      </div>
      <div style={{ fontSize:'.88rem', fontWeight:700 }}>{value}</div>
      <div style={{ fontSize:'.7rem', color:'var(--text-muted)', marginTop:1 }}>{sub}</div>
    </div>
  )
}

function CameraDeviceModal({ cam, onClose }: { cam: Camera; onClose: () => void }) {
  const qc = useQueryClient()

  /* ── live view ── */
  const [liveOn,       setLiveOn]       = useState(false)
  const [liveFrameUrl, setLiveFrameUrl] = useState<string | null>(null)
  const liveRef = useRef({ running: false, seq: 0, frameUrl: null as string|null, timer: null as ReturnType<typeof setTimeout>|null })

  /* ── action states ── */
  const [captureState, setCaptureState] = useState<'idle'|'waiting'|'done'|'error'>('idle')
  const [simState,     setSimState]     = useState<'idle'|'querying'>('idle')
  const [pullState,    setPullState]    = useState<'idle'|'pulling'>('idle')
  const [sendState,    setSendState]    = useState<'idle'|'sending'>('idle')
  const [savingDev,    setSavingDev]    = useState(false)

  /* ── form state ── */
  const [statusValue,   setStatusValue]   = useState(cam.status)
  const [intervalValue, setIntervalValue] = useState(cam.device?.capture_interval_sec ?? 30)
  const [settingsForm,  setSettingsForm]  = useState<Record<string, string>>({})

  /* ── camera info edit (tên / model / timezone / công trình) ── */
  const [infoForm, setInfoForm] = useState({
    name: cam.name,
    camera_model: cam.camera_model || 'generic',
    timezone: cam.timezone || 'Asia/Ho_Chi_Minh',
    site_id: cam.site?.id || '',
  })
  const [savingInfo, setSavingInfo] = useState(false)
  const { data: sitesInfo } = useQuery<Site[]>({
    queryKey: ['sites'],
    queryFn: () => getSites().then(r => r.data),
  })
  const saveInfo = async () => {
    setSavingInfo(true)
    try {
      await updateCamera(cam.id, {
        name: infoForm.name,
        camera_model: infoForm.camera_model,
        timezone: infoForm.timezone,
        site_id: infoForm.site_id || '',
      })
      qc.invalidateQueries({ queryKey: ['cameras'] })
      showToast('Đã lưu thông tin camera')
    } catch { showToast('Lỗi khi lưu thông tin', 'error') }
    setSavingInfo(false)
  }

  /* ── queries ── */
  const { data: deviceData } = useQuery({
    queryKey: ['device', cam.id],
    queryFn: () => getCameraDevice(cam.id).then(r => r.data),
    refetchInterval: 15_000,
  })
  const dev = deviceData as any

  const { data: latestData, refetch: refetchLatest } = useQuery({
    queryKey: ['latest-modal', cam.id],
    queryFn: () => getLiveLatest(cam.id).then(r => r.data),
  })
  const photo = (latestData as any)?.photo

  const { data: camSettings, refetch: refetchSettings } = useQuery({
    queryKey: ['cam-settings', cam.id],
    queryFn: () => getCameraSettings(cam.id).then(r => r.data),
    retry: false,
  })

  /* ── sync settings form from applied values ── */
  useEffect(() => {
    if (!camSettings) return
    const applied = ((camSettings as any).applied || {}) as Record<string, string>
    const next: Record<string, string> = {}
    CAM_SETTINGS_FIELDS.forEach(({ key }) => { next[key] = applied[key] || (camSettings as any)[key] || '' })
    setSettingsForm(next)
  }, [camSettings])

  /* ── keyboard escape ── */
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  /* ── cleanup live on unmount ── */
  useEffect(() => {
    return () => {
      if (!liveRef.current.running) return
      liveRef.current.running = false
      if (liveRef.current.timer) clearTimeout(liveRef.current.timer)
      if (liveRef.current.frameUrl) URL.revokeObjectURL(liveRef.current.frameUrl)
      fetch(`/cameras/${cam.id}/live/stop/`, { method:'POST', credentials:'include', headers:{'X-CSRFToken': csrf()} }).catch(()=>{})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cam.id])

  const csrf = () => document.cookie.match(/csrftoken=([^;]+)/)?.[1] || ''

  /* ── live view polling ── */
  const pollFrame = () => {
    if (!liveRef.current.running) return
    fetch(`/cameras/${cam.id}/live/frame/?seq=${liveRef.current.seq}`, { credentials:'include' })
      .then(r => {
        if (r.status === 200) {
          liveRef.current.seq = parseInt(r.headers.get('X-Frame-Seq') || '0') || liveRef.current.seq
          return r.blob().then(b => {
            const url = URL.createObjectURL(b)
            if (liveRef.current.frameUrl) URL.revokeObjectURL(liveRef.current.frameUrl)
            liveRef.current.frameUrl = url
            setLiveFrameUrl(url)
          })
        }
      })
      .catch(() => {})
      .finally(() => { if (liveRef.current.running) liveRef.current.timer = setTimeout(pollFrame, 1000) })
  }
  const startLive = () => {
    liveRef.current.running = true; liveRef.current.seq = 0; setLiveOn(true)
    fetch(`/cameras/${cam.id}/live/start/`, { method:'POST', credentials:'include', headers:{'X-CSRFToken': csrf()} })
      .then(r => r.json()).then(d => { if (d.ok) pollFrame() })
      .catch(() => { liveRef.current.running = false; setLiveOn(false) })
  }
  const stopLive = () => {
    liveRef.current.running = false
    if (liveRef.current.timer) { clearTimeout(liveRef.current.timer); liveRef.current.timer = null }
    if (liveRef.current.frameUrl) { URL.revokeObjectURL(liveRef.current.frameUrl); liveRef.current.frameUrl = null }
    setLiveFrameUrl(null); setLiveOn(false)
    fetch(`/cameras/${cam.id}/live/stop/`, { method:'POST', credentials:'include', headers:{'X-CSRFToken': csrf()} }).catch(()=>{})
  }

  /* ── capture now ── */
  const captureNow = () => {
    if (captureState === 'waiting') return
    setCaptureState('waiting')
    const prevAt = photo?.taken_at || ''
    fetch(`/cameras/${cam.id}/device/wake/`, { method:'POST', credentials:'include', headers:{'X-CSRFToken': csrf()} })
      .then(r => r.json())
      .then(d => {
        if (!d.ok) { setCaptureState('error'); setTimeout(()=>setCaptureState('idle'),4000); return }
        let tries = 0
        const poll = setInterval(() => {
          tries++
          getLiveLatest(cam.id).then(r => r.data).then((data: any) => {
            if (data?.photo?.taken_at && data.photo.taken_at !== prevAt) {
              clearInterval(poll); setCaptureState('done'); refetchLatest()
              setTimeout(()=>setCaptureState('idle'),4000)
            } else if (tries >= 60) { clearInterval(poll); setCaptureState('error'); setTimeout(()=>setCaptureState('idle'),4000) }
          }).catch(()=>{})
        }, 2000)
      })
      .catch(() => { setCaptureState('error'); setTimeout(()=>setCaptureState('idle'),4000) })
  }

  /* ── get SIM info ── */
  const getSIMInfo = () => {
    if (simState !== 'idle') return
    setSimState('querying')
    fetch(`/cameras/${cam.id}/device/sim/`, { method:'POST', credentials:'include', headers:{'X-CSRFToken': csrf()} })
      .then(() => { qc.invalidateQueries({ queryKey: ['device', cam.id] }); setSimState('idle') })
      .catch(() => setSimState('idle'))
  }

  /* ── save device settings (interval + status) ── */
  const saveDevSettings = async () => {
    setSavingDev(true)
    try {
      await fetch(`/cameras/${cam.id}/device/settings/`, {
        method:'POST', credentials:'include',
        headers:{ 'Content-Type':'application/json', 'X-CSRFToken': csrf() },
        body: JSON.stringify({ capture_interval_sec: Number(intervalValue), status: statusValue }),
      })
      qc.invalidateQueries({ queryKey: ['cameras'] })
      qc.invalidateQueries({ queryKey: ['device', cam.id] })
      showToast('Đã lưu cài đặt thiết bị')
    } catch { showToast('Lỗi khi lưu', 'error') }
    setSavingDev(false)
  }

  /* ── pull camera settings from device via MQTT ── */
  const pullSettings = async () => {
    setPullState('pulling')
    try {
      const r = await fetch(`/cameras/${cam.id}/device/camera-settings/pull/`, { method:'POST', credentials:'include', headers:{'X-CSRFToken': csrf()} })
      const d = await r.json()
      if (d.sent) {
        const prevAt = d.last_synced_at
        let tries = 0
        const poll = setInterval(async () => {
          tries++
          try {
            const state = await fetch(`/cameras/${cam.id}/device/state/`, { credentials:'include' }).then(r => r.json())
            if (state?.settings?.in_sync && state.settings.last_synced_at !== prevAt) {
              clearInterval(poll); refetchSettings(); setPullState('idle'); showToast('Đã tải cài đặt từ camera')
            } else if (tries >= 20) { clearInterval(poll); refetchSettings(); setPullState('idle') }
          } catch { tries++ }
        }, 1500)
      } else { refetchSettings(); setPullState('idle') }
    } catch { setPullState('idle') }
  }

  /* ── save & send camera settings to device ── */
  const saveAndSend = async () => {
    setSendState('sending')
    try {
      await fetch(`/cameras/${cam.id}/device/camera-settings/`, {
        method:'POST', credentials:'include',
        headers:{ 'Content-Type':'application/json', 'X-CSRFToken': csrf() },
        body: JSON.stringify(settingsForm),
      })
      refetchSettings(); showToast('Đã gửi cài đặt đến camera')
    } catch { showToast('Lỗi khi gửi cài đặt', 'error') }
    setSendState('idle')
  }

  /* ── computed ── */
  const caps = ((camSettings as any)?.capabilities || {}) as Record<string, {choices?: string[]; writable?: boolean}>
  const applied = ((camSettings as any)?.applied || {}) as Record<string, string>
  const inSync = Object.keys(settingsForm).every(k => !settingsForm[k] || applied[k] === settingsForm[k])
  const todayCount = (latestData as any)?.today_count
  const totalCount = (latestData as any)?.total_count

  return (
    <div className="modal-overlay" style={{ zIndex:999, alignItems:'flex-start', paddingTop:24, overflowY:'auto' }} onClick={onClose}>
      <div className="modal-box" style={{ maxWidth:1080, width:'96vw', maxHeight:'92vh' }} onClick={e=>e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="modal-header">
          <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
            <span style={{ width:10, height:10, borderRadius:'50%', background: cam.is_online?'var(--status-ok)':'var(--text-muted)', flexShrink:0 }} className={cam.is_online?'online-pulse':''} />
            <code style={{ fontSize:'.95rem', fontWeight:800, letterSpacing:'.04em' }}>{cam.code}</code>
            <span style={{ color:'var(--text-secondary)', fontSize:'.88rem', fontWeight:400 }}>{cam.name}</span>
            {cam.camera_model && cam.camera_model!=='generic' && (
              <span className="badge-base" style={{ background:'rgba(59,130,246,.12)', color:'#60a5fa', border:'1px solid rgba(59,130,246,.2)', fontSize:'.68rem' }}>
                {cam.camera_model.replace(/_/g,' ').toUpperCase()}
              </span>
            )}
            <MqttStatusBadge camId={cam.id} camCode={cam.code} />
          </div>
          <button onClick={onClose} className="atl-btn ghost" style={{ padding:'4px 8px', marginLeft:'auto' }}><X size={18}/></button>
        </div>

        {/* ── Body grid ── */}
        <div className="modal-body" style={{ display:'grid', gridTemplateColumns:'min(360px,36%) 1fr', gap:16 }}>

          {/* LEFT: photo + controls */}
          <div>
            <div style={{ position:'relative', borderRadius:10, overflow:'hidden', background:'#050505', aspectRatio:'4/3' }}>
              {liveFrameUrl ? (
                <img src={liveFrameUrl} alt="live" style={{ width:'100%', height:'100%', objectFit:'contain' }} />
              ) : photo?.thumb_url ? (
                <img src={photo.thumb_url} alt="latest" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              ) : (
                <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'var(--text-muted)' }}>
                  <CameraIcon size={30} style={{ opacity:.15 }} /><span style={{ fontSize:'.75rem', marginTop:8 }}>No photos yet</span>
                </div>
              )}
              <div style={{ position:'absolute', bottom:0, left:0, right:0, display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 10px', background:'linear-gradient(transparent,rgba(0,0,0,.65))' }}>
                <span style={{ color:'rgba(255,255,255,.8)', fontSize:'.7rem' }}>
                  {photo?.taken_at ? new Date(photo.taken_at).toLocaleString('vi-VN') : ''}
                </span>
                {liveOn && <span style={{ background:'var(--status-error)', color:'#fff', fontSize:'.6rem', fontWeight:700, padding:'2px 6px', borderRadius:3, display:'inline-flex', alignItems:'center', gap:4 }}><span style={{ width:5,height:5,borderRadius:'50%',background:'#fff',display:'inline-block' }}/>LIVE</span>}
              </div>
            </div>

            <div style={{ display:'flex', gap:5, marginTop:7 }}>
              <button className="atl-btn" style={{ flex:1, fontSize:'.75rem' }} onClick={()=>refetchLatest()}>↻ Refresh</button>
              <button className="atl-btn primary" style={{ flex:'1.4', fontSize:'.75rem' }} disabled={captureState==='waiting'} onClick={captureNow}>
                {captureState==='waiting' ? <><RefreshCw size={12} style={{ animation:'spin 1s linear infinite', marginRight:4 }}/>Đang chụp…</> : '⚡ Capture now'}
              </button>
              <button className="atl-btn" style={{ color:liveOn?'var(--status-error)':undefined, borderColor:liveOn?'var(--status-error)':undefined, fontSize:'.75rem' }} onClick={liveOn?stopLive:startLive}>
                {liveOn ? '◼ Stop' : '◉ Live'}
              </button>
              <a href={`/cameras/${cam.id}/live/`} className="atl-btn" style={{ fontSize:'.75rem' }} title="Mở live page">⤢</a>
            </div>

            {captureState==='done'  && <div style={{ color:'var(--status-ok)',    fontSize:'.78rem', marginTop:5 }}>📷 Ảnh mới đã chụp xong!</div>}
            {captureState==='error' && <div style={{ color:'var(--status-error)', fontSize:'.78rem', marginTop:5 }}>Chưa nhận được ảnh mới.</div>}

            {(todayCount != null || totalCount != null) && (
              <div style={{ display:'flex', gap:16, marginTop:7, fontSize:'.8rem', color:'var(--text-secondary)' }}>
                <span>Hôm nay: <strong style={{ color:'var(--text-primary)' }}>{todayCount ?? '—'}</strong></span>
                <span>Total: <strong style={{ color:'var(--text-primary)' }}>{totalCount ?? '—'}</strong></span>
              </div>
            )}
          </div>

          {/* RIGHT: SIM + settings + camera settings */}
          <div style={{ display:'flex', flexDirection:'column', gap:12, minWidth:0 }}>

            {/* SIM info + device settings */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:12, alignItems:'start' }}>

              {/* SIM info */}
              <div style={{ border:'1px solid var(--border-color)', borderRadius:10, padding:'.7rem .8rem' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                  <span className="section-label" style={{ margin:0 }}>SIM INFO</span>
                  <button className="atl-btn" style={{ fontSize:'.7rem' }} disabled={simState!=='idle'} onClick={getSIMInfo}>
                    {simState==='querying' ? <><RefreshCw size={11} style={{ animation:'spin 1s linear infinite', marginRight:3 }}/>Đang truy vấn…</> : '📶 Get SIM info'}
                  </button>
                </div>
                <table style={{ width:'100%', fontSize:'.78rem', borderCollapse:'collapse' }}>
                  <tbody>
                    {[
                      ['Phone number', dev?.sim_number   || '—'],
                      ['Operator',     dev?.sim_operator  || '—'],
                      ['ICCID',        dev?.sim_iccid     || '—'],
                      ['Signal',       dev?.sim_signal_dbm != null ? `${dev.sim_signal_dbm} dBm · ${dev.signal_label}` : '—'],
                    ].map(([label, value]) => (
                      <tr key={String(label)}>
                        <td style={{ color:'var(--text-muted)', padding:'3px 0', width:'36%' }}>{label}</td>
                        <td style={{ textAlign:'right', fontWeight: label==='Phone number'?700:undefined, fontFamily: label==='ICCID'?'monospace':undefined, fontSize: label==='ICCID'?'.68rem':undefined, wordBreak:'break-all' }}>{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Device settings */}
              <div style={{ minWidth:200 }}>
                <div className="section-label">SETTINGS</div>
                <label style={{ fontSize:'.72rem', color:'var(--text-muted)', display:'block', marginBottom:5 }}>Trạng thái</label>
                <div style={{ display:'flex', gap:4, marginBottom:10, flexWrap:'wrap' }}>
                  {[
                    { v:'active',      l:'Hoạt động',      c:'var(--status-ok)'      },
                    { v:'maintenance', l:'Maint.',          c:'var(--status-warning)' },
                    { v:'inactive',    l:'Không hoạt động', c:'var(--text-muted)'     },
                  ].map(o => (
                    <button key={o.v} onClick={()=>setStatusValue(o.v as any)}
                      style={{ padding:'.3rem .5rem', borderRadius:7, cursor:'pointer', fontSize:'.7rem', fontWeight:statusValue===o.v?700:500, whiteSpace:'nowrap', border:`1px solid ${statusValue===o.v?o.c:'var(--border-color)'}`, background:statusValue===o.v?`${o.c}20`:'var(--bg-primary)', color:statusValue===o.v?o.c:'var(--text-muted)' }}>
                      {o.l}
                    </button>
                  ))}
                </div>
                <label style={{ fontSize:'.72rem', color:'var(--text-muted)', display:'block', marginBottom:4 }}>Capture interval</label>
                <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <input type="number" min={30} max={86400} value={intervalValue} onChange={e=>setIntervalValue(Number(e.target.value))} className="atl-input" style={{ width:72 }} />
                  <span style={{ fontSize:'.72rem', color:'var(--text-muted)' }}>sec</span>
                  <button className="atl-btn primary" style={{ fontSize:'.72rem', whiteSpace:'nowrap' }} disabled={savingDev} onClick={saveDevSettings}>
                    {savingDev ? '…' : 'Lưu lại'}
                  </button>
                </div>
                <div style={{ fontSize:'.65rem', color:'var(--text-muted)', marginTop:3 }}>Applied on next device check-in.</div>
              </div>
            </div>

            {/* Camera settings */}
            <div style={{ border:'1px solid var(--border-color)', borderRadius:10, padding:'.7rem .8rem', flex:1 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <span className="section-label" style={{ margin:0 }}>CAMERA SETTINGS</span>
                <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                  <button className="atl-btn" style={{ fontSize:'.7rem' }} disabled={pullState==='pulling'} onClick={pullSettings}>
                    {pullState==='pulling' ? <><RefreshCw size={11} style={{ animation:'spin 1s linear infinite', marginRight:3 }}/>Pulling…</> : '↓ Pull from device'}
                  </button>
                  <span style={{ fontSize:'.72rem', color:inSync?'var(--status-ok)':'var(--text-muted)', whiteSpace:'nowrap' }}>
                    {inSync ? '✓ In sync' : '○ Not synced'}
                  </span>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:8 }}>
                {CAM_SETTINGS_FIELDS.map(({ key, label }) => {
                  const cap = caps[key] || {}
                  const choices: string[] = Array.isArray((cap as any).choices) ? (cap as any).choices : []
                  const writable = (cap as any).writable !== false
                  const value = settingsForm[key] || ''
                  return (
                    <div key={key}>
                      <label style={{ fontSize:'.65rem', color:'var(--text-muted)', display:'block', marginBottom:3 }}>{label}</label>
                      {choices.length > 0 ? (
                        <select className="atl-select" style={{ width:'100%', fontSize:'.76rem' }} value={value} disabled={!writable}
                                onChange={e=>setSettingsForm(f=>({...f,[key]:e.target.value}))}>
                          {choices.map(c=><option key={c} value={c}>{c}</option>)}
                        </select>
                      ) : (
                        <input className="atl-input" style={{ width:'100%', fontSize:'.76rem' }} value={value} readOnly={!writable}
                               onChange={e=>setSettingsForm(f=>({...f,[key]:e.target.value}))} />
                      )}
                    </div>
                  )
                })}
              </div>
              <div style={{ marginTop:10 }}>
                <button className="atl-btn primary" disabled={sendState==='sending'} onClick={saveAndSend}>
                  {sendState==='sending' ? <><RefreshCw size={12} style={{ animation:'spin 1s linear infinite', marginRight:4 }}/>Đang gửi…</> : 'Save & send to camera'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Device telemetry tiles ── */}
        <div style={{ borderTop:'1px solid var(--border-color)', padding:'.7rem 1rem' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:7 }}>
            <span className="section-label" style={{ margin:0, fontSize:'.6rem' }}>DEVICE</span>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <CredentialInline camId={cam.id} />
              <span style={{ fontSize:'.72rem', color: cam.is_online?'var(--status-ok)':'var(--text-muted)' }}>
                {cam.is_online ? '● Online' : '○ Offline'}
              </span>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
            <DevTile label="SIM"             value={dev?.sim_signal_dbm  != null ? `${dev.sim_signal_dbm} dBm`   : '—'} sub={dev?.sim_operator || dev?.signal_label || '—'} bars={dev?.signal_bars ?? 0} />
            <DevTile label="Temp / Humidity" value={dev?.temperature_c   != null ? `${dev.temperature_c}°C`      : '—'} sub={dev?.humidity_percent != null ? `💧 ${dev.humidity_percent}%` : '—'} />
            <DevTile label={dev?.is_charging ? 'Battery ⚡' : 'Battery'} value={dev?.battery_percent != null ? `${dev.battery_percent}%` : '—'} sub={dev?.battery_voltage ? `${dev.battery_voltage} V` : '—'} />
            <DevTile label="Solar"           value={dev?.solar_voltage   != null ? `${dev.solar_voltage} V`      : '—'} sub={dev?.solar_percent != null ? `${dev.solar_percent}%` : '—'} />
          </div>
          {Array.isArray(dev?.cell_voltages) && dev.cell_voltages.length > 0 && (
            <div style={{ marginTop:8 }}>
              <div className="section-label" style={{ fontSize:'.58rem', marginBottom:5 }}>CELL VOLTAGES</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                {dev.cell_voltages.map((v: number, i: number) => (
                  <span key={i} style={{ background:'var(--bg-tertiary)', border:'1px solid var(--border-color)', borderRadius:5, padding:'2px 8px', fontSize:'.72rem' }}>
                    {i+1}: {v}V
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════
   MODAL: ACCESS MANAGEMENT
   ════════════════════════════════════════════ */


/* ════════════════════════════════════════════
   MODAL: ADD SITE
   ════════════════════════════════════════════ */
function AddSiteModal({ onClose, onCreated }: { onClose: () => void; onCreated?: (site: any) => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ name:'', description:'', location:'' })
  const [err, setErr] = useState('')
  const mutation = useMutation({
    mutationFn: () => createSite(form),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['sites'] }); showToast('Đã tạo công trình'); onCreated?.(r.data); onClose() },
    onError: (e: any) => setErr(e?.response?.data?.detail || 'Lỗi'),
  })
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key==='Escape' && onClose()
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 420 }} onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display:'flex', alignItems:'center', gap:8, fontWeight:700 }}>
            <Building2 size={16} style={{ color:'var(--accent-light)' }} /> Thêm Công Trình / Site
          </div>
          <button onClick={onClose} className="atl-btn ghost" style={{ padding:'4px 6px' }}><X size={16}/></button>
        </div>
        <div className="modal-body">
          {err && <div style={{ background:'rgba(239,68,68,.1)', color:'var(--status-error)', borderRadius:8, padding:'.5rem .75rem', fontSize:'.8rem', marginBottom:'.75rem' }}>{err}</div>}
          <div className="form-group">
            <label className="form-label">Tên công trình *</label>
            <input className="atl-input" placeholder="VD: Tòa nhà A, Cầu Bắc..." value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} />
          </div>
          <div className="form-group">
            <label className="form-label">Địa điểm</label>
            <input className="atl-input" placeholder="Địa chỉ hoặc mô tả vị trí" value={form.location} onChange={e=>setForm(f=>({...f,location:e.target.value}))} />
          </div>
          <div className="form-group">
            <label className="form-label">Mô tả</label>
            <textarea className="atl-input" placeholder="Ghi chú thêm..." rows={2} value={form.description}
                      onChange={e=>setForm(f=>({...f,description:e.target.value}))}
                      style={{ resize:'none', fontFamily:'inherit' }} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="atl-btn" onClick={onClose}>Huỷ</button>
          <button className="atl-btn primary" disabled={!form.name||mutation.isPending} onClick={()=>mutation.mutate()}>
            {mutation.isPending?'Đang tạo…':'Tạo Công Trình'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════
   MODAL: ADD CAMERA
   ════════════════════════════════════════════ */
function AddCameraModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ name:'', code:'', camera_model:'nikon_d5300', timezone:'Asia/Ho_Chi_Minh', site_id:'' })
  const [err, setErr] = useState('')
  const [showAddSite, setShowAddSite] = useState(false)
  const [created, setCreated] = useState<null | {
    simconfig: Record<string, string | number>;
    mqtt: { registered: boolean; errors: string[] };
    camera_code: string;
  }>(null)
  const [copied, setCopied] = useState('')

  const { data: sitesData } = useQuery<any[]>({
    queryKey: ['sites'],
    queryFn: () => getSites().then(r => r.data),
  })
  const sites = sitesData ?? []

  const mutation = useMutation({
    mutationFn: () => createCamera({ ...form, site_id: form.site_id || undefined }),
    onSuccess: (resp) => {
      qc.invalidateQueries({ queryKey: ['cameras'] })
      const d = resp.data as any
      if (d.simconfig) setCreated({
        simconfig: d.simconfig,
        mqtt: d.mqtt,
        camera_code: d.code,
      })
      else { showToast('Đã tạo camera'); onClose() }
    },
    onError: (e: any) => setErr(e?.response?.data?.detail || JSON.stringify(e?.response?.data) || 'Lỗi'),
  })

  const copyAll = () => {
    if (!created) return
    const cfg = created.simconfig
    const text = [
      `# ── Thông số cố định ────────────────────────────────`,
      `CAMERA_CODE     = "${cfg.CAMERA_CODE}"`,
      `MQTT_PASSWORD   = "${cfg.MQTT_PASSWORD}"`,
      `MQTT_BROKER     = "${cfg.MQTT_BROKER}"`,
      `MQTT_PORT       = ${cfg.MQTT_PORT}`,
      ``,
      `SERVER_BASE     = "${cfg.SERVER_BASE}"`,
      `DEVICE_KEY      = CAMERA_CODE       # = "${cfg.CAMERA_CODE}"`,
      `DEVICE_SECRET   = MQTT_PASSWORD     # = mqtt_password`,
    ].join('\n')
    navigator.clipboard.writeText(text).then(() => { setCopied('all'); setTimeout(() => setCopied(''), 2000) })
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key==='Escape' && !showAddSite && onClose()
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [onClose, showAddSite])

  // ── Hiển thị config sau khi tạo ──
  if (created) return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span style={{ fontWeight: 800, color: '#34d399' }}>✓ Camera "{created.camera_code}" tạo thành công!</span>
          <button onClick={onClose} className="atl-btn ghost" style={{ padding:'4px 6px', marginLeft:'auto' }}><X size={16}/></button>
        </div>
        <div className="modal-body">
          {/* MQTT status badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '.6rem .9rem', borderRadius: 9, marginBottom: 12,
            background: created.mqtt?.registered ? 'rgba(52,211,153,.07)' : 'rgba(248,113,113,.07)',
            border: `1px solid ${created.mqtt?.registered ? 'rgba(52,211,153,.3)' : 'rgba(248,113,113,.3)'}`,
          }}>
            <span style={{ fontSize: '1rem' }}>{created.mqtt?.registered ? '✅' : '⚠️'}</span>
            <div style={{ flex: 1, fontSize: '.78rem' }}>
              <strong style={{ color: created.mqtt?.registered ? '#34d399' : '#f87171' }}>
                MQTT {created.mqtt?.registered ? 'đã đăng ký' : 'chưa đăng ký'}
              </strong>
              {created.mqtt?.errors?.length > 0 && (
                <div style={{ color: '#f87171', marginTop: 2, fontSize: '.72rem' }}>
                  {created.mqtt.errors.join('; ')}
                </div>
              )}
              {!created.mqtt?.registered && (
                <div style={{ color: 'var(--text-muted)', marginTop: 2, fontSize: '.7rem' }}>
                  Mở camera modal → nút <strong>⚙ Re-register MQTT</strong> để thử lại.
                </div>
              )}
            </div>
          </div>

          <div style={{ background: 'rgba(96,165,250,.07)', border: '1px solid rgba(96,165,250,.2)', borderRadius: 10, padding: '.7rem .9rem', marginBottom: 12, fontSize: '.77rem', color: 'var(--text-secondary)' }}>
            📋 Copy thông số bên dưới vào <code>sim.py</code>. Xem lại bất kỳ lúc nào qua nút <strong>📋 sim.py config</strong> trong camera modal.
          </div>

          <div style={{ background: '#0d1117', borderRadius: 10, padding: '.9rem 1rem', fontFamily: 'monospace', fontSize: '.78rem', lineHeight: 1.8, position: 'relative' }}>
            <div><span style={{ color: '#6e7681' }}># ── Thông số cố định ───────────</span></div>
            <div><span style={{ color: '#79c0ff' }}>CAMERA_CODE</span>   = <span style={{ color: '#a5d6ff' }}>"{created.simconfig?.CAMERA_CODE}"</span></div>
            <div><span style={{ color: '#79c0ff' }}>MQTT_PASSWORD</span> = <span style={{ color: '#a5d6ff' }}>"{created.simconfig?.MQTT_PASSWORD}"</span></div>
            <div><span style={{ color: '#79c0ff' }}>MQTT_BROKER</span>   = <span style={{ color: '#a5d6ff' }}>"{created.simconfig?.MQTT_BROKER}"</span></div>
            <div><span style={{ color: '#79c0ff' }}>MQTT_PORT</span>     = <span style={{ color: '#ffa657' }}>{created.simconfig?.MQTT_PORT}</span></div>
            <div style={{ marginTop: 6 }}><span style={{ color: '#79c0ff' }}>SERVER_BASE</span>   = <span style={{ color: '#a5d6ff' }}>"{created.simconfig?.SERVER_BASE}"</span></div>
            <div><span style={{ color: '#79c0ff' }}>DEVICE_KEY</span>    = <span style={{ color: '#a5d6ff' }}>"{created.simconfig?.DEVICE_KEY}"</span></div>
            <div><span style={{ color: '#79c0ff' }}>DEVICE_SECRET</span> = <span style={{ color: '#a5d6ff' }}>"{created.simconfig?.DEVICE_SECRET}"</span></div>
            <button onClick={copyAll} style={{ position: 'absolute', top: 8, right: 8, background: copied ? 'rgba(52,211,153,.2)' : 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: '.68rem', color: copied ? '#34d399' : '#8b949e', fontFamily: 'inherit' }}>
              {copied ? '✓ Đã copy' : '⎘ Copy'}
            </button>
          </div>
          <div style={{ fontSize: '.68rem', color: '#fbbf24', marginTop: 8 }}>⚠️ DEVICE_KEY (Credential Key ID) và DEVICE_SECRET (Secret) dùng cho API nạp ảnh S3. DEVICE_SECRET chỉ hiển thị 1 lần duy nhất khi tạo camera.</div>


          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
            <button className="atl-btn" onClick={onClose}>Đóng</button>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {showAddSite && (
        <AddSiteModal
          onClose={() => setShowAddSite(false)}
          onCreated={(site) => setForm(f=>({...f, site_id: site.id}))}
        />
      )}
      <div className="modal-overlay" onClick={onClose} style={{ zIndex: showAddSite ? 998 : 999 }}>
        <div className="modal-box" style={{ maxWidth: 440 }} onClick={e=>e.stopPropagation()}>
          <div className="modal-header">
            <div style={{ display:'flex', alignItems:'center', gap:8, fontWeight:700 }}>
              <CameraIcon size={16} style={{ color:'var(--accent-light)' }} /> Thêm Camera mới
            </div>
            <button onClick={onClose} className="atl-btn ghost" style={{ padding:'4px 6px' }}><X size={16}/></button>
          </div>
          <div className="modal-body">
            {err && <div style={{ background:'rgba(239,68,68,.1)', color:'var(--status-error)', borderRadius:8, padding:'.5rem .75rem', fontSize:'.8rem', marginBottom:'.75rem' }}>{err}</div>}
            <div className="form-group">
              <label className="form-label">Tên camera *</label>
              <input className="atl-input" placeholder="VD: Camera Cổng Chính" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div className="form-group">
                <label className="form-label">Model</label>
                <select className="atl-select" value={form.camera_model} onChange={e=>setForm(f=>({...f,camera_model:e.target.value}))}>
                  <option value="nikon_d5300">Nikon D5300</option>
                  <option value="nikon_d3500">Nikon D3500</option>
                  <option value="nikon_d7500">Nikon D7500</option>
                  <option value="canon_eos">Canon EOS</option>
                  <option value="generic">Generic</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Timezone</label>
                <select className="atl-select" value={form.timezone} onChange={e=>setForm(f=>({...f,timezone:e.target.value}))}>
                  <option value="Asia/Ho_Chi_Minh">GMT+7 (Việt Nam)</option>
                  <option value="Asia/Bangkok">GMT+7 (Bangkok)</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                <label className="form-label" style={{ margin:0 }}>Công trình (Site)</label>
                <button className="atl-btn ghost" style={{ fontSize:'.7rem', padding:'2px 6px' }} onClick={()=>setShowAddSite(true)}>
                  <Plus size={11}/> Tạo mới
                </button>
              </div>
              <select className="atl-select" value={form.site_id} onChange={e=>setForm(f=>({...f,site_id:e.target.value}))}>
                <option value="">— Chưa gán site —</option>
                {sites.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button className="atl-btn" onClick={onClose}>Huỷ</button>
            <button className="atl-btn primary" disabled={!form.name||mutation.isPending} onClick={()=>mutation.mutate()}>
              {mutation.isPending?'Đang tạo…':'Tạo Camera'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

/* ════════════════════════════════════════════
   CAMERA INFO & MQTT MODAL
   ════════════════════════════════════════════ */
function CameraInfoModal({ cam, onClose }: { cam: Camera; onClose: () => void }) {
  const qc = useQueryClient()
  const [formData, setFormData] = useState({
    name: cam.name || '',
    code: cam.code || '',
    mqtt_password: cam.mqtt_password || '',
    status: cam.status || 'active',
    camera_model: cam.camera_model || 'generic',
    timezone: cam.timezone || 'UTC',
  })
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const brokerHost = window.location.hostname || 'cloud.congnghetimelapse.com'
  const brokerPortTcp = '1883'
  const brokerPortWs = '8083'
  const pubTopic = `camera/${formData.code}/telemetry`
  const subTopic = `camera/${formData.code}/command`

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(fieldName)
    showToast(`Đã copy ${fieldName}!`)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const updateMutation = useMutation({
    mutationFn: () => updateCamera(cam.id, formData),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cameras'] })
      showToast('Đã lưu thông số camera')
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || 'Không thể lưu thông số'
      showToast(msg, 'error')
    }
  })

  const fullJson = JSON.stringify({
    broker: brokerHost,
    port_tcp: 1883,
    port_ws: 8083,
    client_id: formData.code,
    username: formData.code,
    password: formData.mqtt_password,
    publish_topic: pubTopic,
    subscribe_topic: subTopic,
    camera_name: formData.name,
    camera_model: formData.camera_model
  }, null, 2)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 740 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display:'flex', alignItems:'center', gap:8, fontWeight:700 }}>
            <Info size={18} style={{ color:'var(--accent-light)' }} />
            THÔNG TIN CAMERA & CẤU HÌNH MQTT
          </div>
          <button onClick={onClose} className="atl-btn ghost" style={{ padding:'4px 6px' }}><X size={16} /></button>
        </div>

        <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
          {/* Section 1: Edit Camera Parameters */}
          <div style={{ background:'var(--bg-primary)', border:'1px solid var(--border-color)', borderRadius:10, padding:'1rem' }}>
            <div style={{ fontSize:'.75rem', fontWeight:700, color:'var(--accent-light)', marginBottom:'.75rem', textTransform:'uppercase', letterSpacing:'.05em', display:'flex', alignItems:'center', gap:6 }}>
              <Settings size={14} /> Chỉnh sửa thông số Camera
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'.75rem' }}>
              <div>
                <label className="form-label">Tên Camera</label>
                <input className="atl-input" style={{ width:'100%' }} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div>
                <label className="form-label">Mã Camera / Username MQTT</label>
                <input className="atl-input" style={{ width:'100%', fontFamily:'monospace' }} value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} />
              </div>
              <div>
                <label className="form-label">Mật khẩu MQTT (Password)</label>
                <input className="atl-input" style={{ width:'100%', fontFamily:'monospace' }} value={formData.mqtt_password} onChange={e => setFormData({...formData, mqtt_password: e.target.value})} placeholder="Nhập password MQTT..." />
              </div>
              <div>
                <label className="form-label">Trạng thái</label>
                <select className="atl-input" style={{ width:'100%' }} value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>
              <div>
                <label className="form-label">Dòng máy (Model)</label>
                <select className="atl-input" style={{ width:'100%' }} value={formData.camera_model} onChange={e => setFormData({...formData, camera_model: e.target.value})}>
                  <option value="generic">Generic (khác)</option>
                  <option value="nikon_d5300">Nikon D5300</option>
                  <option value="nikon_d3500">Nikon D3500</option>
                  <option value="nikon_d7500">Nikon D7500</option>
                  <option value="nikon_z50">Nikon Z50</option>
                  <option value="canon_200d">Canon 200D</option>
                  <option value="canon_90d">Canon 90D</option>
                </select>
              </div>
              <div>
                <label className="form-label">Múi giờ (Timezone)</label>
                <input className="atl-input" style={{ width:'100%' }} value={formData.timezone} onChange={e => setFormData({...formData, timezone: e.target.value})} />
              </div>
            </div>

            <div style={{ display:'flex', justifyContent:'flex-end', marginTop:'1rem' }}>
              <button className="atl-btn primary" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Đang lưu...' : 'Lưu thông số'}
              </button>
            </div>
          </div>

          {/* Section 2: MQTT Copy Credentials */}
          <div style={{ background:'var(--bg-primary)', border:'1px solid var(--border-color)', borderRadius:10, padding:'1rem' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'.75rem' }}>
              <div style={{ fontSize:'.75rem', fontWeight:700, color:'var(--status-ok)', textTransform:'uppercase', letterSpacing:'.05em', display:'flex', alignItems:'center', gap:6 }}>
                <Key size={14} /> Thông số kết nối MQTT (Sao chép nhanh)
              </div>
              <button className="atl-btn ghost" style={{ fontSize:'.72rem' }} onClick={() => handleCopy(fullJson, 'JSON MQTT Full')}>
                {copiedField==='JSON MQTT Full' ? <Check size={12} style={{ color:'var(--status-ok)' }} /> : <Copy size={12}/>} Copy tất cả (JSON)
              </button>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:'.5rem' }}>
              <CopyRow label="MQTT Broker Host" value={brokerHost} fieldId="Host MQTT" copiedField={copiedField} onCopy={handleCopy} />
              <CopyRow label="Port (TCP / WS)" value={`${brokerPortTcp} (TCP) / ${brokerPortWs} (WebSocket)`} copyValue={brokerPortTcp} fieldId="Port TCP" copiedField={copiedField} onCopy={handleCopy} />
              <CopyRow label="MQTT Username (Code)" value={formData.code} fieldId="Username MQTT" copiedField={copiedField} onCopy={handleCopy} isCode />
              <CopyRow label="MQTT Password" value={formData.mqtt_password || '(Chưa tạo)'} copyValue={formData.mqtt_password} fieldId="Password MQTT" copiedField={copiedField} onCopy={handleCopy} isCode />
              <CopyRow label="Publish Topic" value={pubTopic} fieldId="Publish Topic" copiedField={copiedField} onCopy={handleCopy} isCode />
              <CopyRow label="Subscribe Topic" value={subTopic} fieldId="Subscribe Topic" copiedField={copiedField} onCopy={handleCopy} isCode />
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent:'space-between' }}>
          <Link to={`/cameras/${cam.id}/live`} className="atl-btn" style={{ fontSize:'.75rem' }} onClick={onClose}>
            <Wifi size={13}/> Xem Live Video
          </Link>
          <button className="atl-btn" onClick={onClose}>Đóng</button>
        </div>
      </div>
    </div>
  )
}

function CopyRow({ label, value, copyValue, fieldId, copiedField, onCopy, isCode }: {
  label: string
  value: string
  copyValue?: string
  fieldId: string
  copiedField: string | null
  onCopy: (text: string, fieldId: string) => void
  isCode?: boolean
}) {
  const textToCopy = copyValue ?? value
  const isCopied = copiedField === fieldId

  return (
    <div style={{ display:'grid', gridTemplateColumns:'170px 1fr auto', alignItems:'center', gap:8, background:'var(--bg-secondary)', padding:'.4rem .65rem', borderRadius:6, border:'1px solid var(--border-color)' }}>
      <span style={{ fontSize:'.72rem', color:'var(--text-muted)', fontWeight:600 }}>{label}</span>
      <span style={{ fontSize:'.78rem', color:'var(--text-primary)', fontFamily: isCode?'monospace':'inherit', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
        {value}
      </span>
      <button className="atl-btn ghost" style={{ padding:'3px 8px', fontSize:'.7rem' }} onClick={() => onCopy(textToCopy, fieldId)}>
        {isCopied ? <Check size={12} style={{ color:'var(--status-ok)' }} /> : <Copy size={12} />}
        {isCopied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}

/* ════════════════════════════════════════════
   CAMERA CARD — bambuddy style
   ════════════════════════════════════════════ */
function CameraCard({ cam }: { cam: Camera }) {
  const [modal, setModal] = useState<'control'|'info'|null>(null)
  const dev = cam.device
  const batt = dev?.battery_percent ?? null
  const battColor = batt===null?'var(--text-muted)':batt<20?'var(--status-error)':batt<50?'var(--status-warning)':'var(--status-ok)'

  return (
    <>
      {modal==='control' && <CameraDeviceModal cam={cam} onClose={()=>setModal(null)} />}
      {modal==='info'    && <CameraInfoModal   cam={cam} onClose={()=>setModal(null)} />}

      <div className="atl-card cam-card" style={{ cursor:'pointer' }} onClick={()=>setModal('control')}>
        {/* ── Header: name + status ── */}
        <div className="cam-card-header">
          <OnlineDot on={cam.is_online} />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontWeight:700, fontSize:'.85rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{cam.name}</div>
            <div style={{ fontSize:'.67rem', color:'var(--text-muted)', fontFamily:'monospace', letterSpacing:'.02em' }}>{cam.code}</div>
          </div>
          <button onClick={(e)=>{ e.stopPropagation(); setModal('control') }} style={{ background:'none', border:'none', cursor:'pointer', padding:2 }}>
            <StatusPill status={cam.status} />
          </button>
        </div>

        {/* ── Connection row ── */}
        <div className="cam-card-conn">
          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
            {cam.is_online
              ? <Wifi size={12} style={{ color:'var(--status-ok)' }} />
              : <WifiOff size={12} style={{ color:'var(--text-muted)' }} />}
            <span style={{ color: cam.is_online?'var(--status-ok)':'var(--text-muted)', fontWeight:600 }}>
              {cam.is_online ? 'Connected' : 'Offline'}
            </span>
            {dev?.sim_signal_dbm != null && <SigBars bars={dev.signal_bars} dbm={dev.sim_signal_dbm} />}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            {cam.camera_model && cam.camera_model!=='generic' && (
              <span style={{ fontSize:'.62rem', fontWeight:700, color:'var(--text-muted)', background:'var(--bg-tertiary)', padding:'.1rem .45rem', borderRadius:4, border:'1px solid var(--border-color)' }}>
                {cam.camera_model.replace(/_/g,' ').toUpperCase()}
              </span>
            )}
            {cam.site && (
              <span style={{ fontSize:'.65rem', color:'var(--text-muted)', display:'flex', alignItems:'center', gap:3 }}>
                <Building2 size={10}/>{cam.site.name}
              </span>
            )}
          </div>
        </div>

        {/* ── Thumbnail ── */}
        <div className="cam-card-thumb">
          {cam.latest_thumb_url
            ? <img src={cam.latest_thumb_url} alt={cam.name} loading="lazy" />
            : <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6, color:'var(--text-muted)' }}>
                <CameraIcon size={28} style={{ opacity:.15 }} />
                <span style={{ fontSize:'.68rem', opacity:.4 }}>No photos yet</span>
              </div>
          }
          {cam.is_online && (
            <div style={{ position:'absolute', top:8, left:8 }}>
              <span style={{ display:'inline-flex', alignItems:'center', gap:4, background:'rgba(239,68,68,.85)', color:'#fff', fontSize:'.6rem', fontWeight:700, padding:'.12rem .4rem', borderRadius:3 }}>
                <span style={{ width:5, height:5, borderRadius:'50%', background:'#fff', display:'inline-block' }}/>LIVE
              </span>
            </div>
          )}
          {/* Photo count badge */}
        </div>

        {/* ── Status section ── */}
        <div className="cam-card-status">
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <Clock size={13} style={{ color:'var(--text-muted)' }} />
            <span style={{ color:'var(--text-secondary)' }}>
              {dev?.capture_interval_sec ? `Every ${dev.capture_interval_sec}s` : 'Interval not set'}
            </span>
          </div>
          <div style={{ fontSize:'.7rem', color:'var(--text-muted)' }}>
            {dev?.last_seen_at ? fmtTime(dev.last_seen_at) : 'Never seen'}
          </div>
        </div>

        {/* ── Telemetry ── */}
        {dev ? (
          <div className="cam-card-tele">
            <div className="tele-cell">
              <SigBars bars={dev.signal_bars} />
              <span>Signal</span>
            </div>
            <div className={`tele-cell${batt!==null&&batt<20?' warn':''}`}>
              <span className="val" style={{ color:battColor }}>{batt!=null?`${batt}%`:'—'}</span>
              <span>Battery</span>
            </div>
            <div className="tele-cell">
              <span className="val">{dev.temperature_c!=null?`${dev.temperature_c}°C`:'—'}</span>
              <span>Temp</span>
            </div>
            <div className="tele-cell">
              <span className="val">{dev.humidity_percent!=null?`${dev.humidity_percent}%`:'—'}</span>
              <span>Humid</span>
            </div>
          </div>
        ) : (
          <div style={{ padding:'.5rem .75rem', fontSize:'.72rem', color:'var(--text-muted)', textAlign:'center', borderTop:'1px solid var(--border-color)' }}>
            No telemetry — awaiting first connection
          </div>
        )}

        {/* ── Actions ── */}
        <div className="cam-card-actions">
          <Link to={`/media/camera/${cam.id}`} className="atl-btn" style={{ fontSize:'.7rem' }} onClick={(e)=>e.stopPropagation()}>
            <ImageIcon size={12}/> Gallery
          </Link>
          <button className="atl-btn" style={{ fontSize:'.7rem' }} onClick={(e)=>{ e.stopPropagation(); setModal('info') }}>
            <Info size={12}/> Thông tin
          </button>
          <button className="atl-btn" style={{ fontSize:'.7rem' }} onClick={(e)=>{ e.stopPropagation(); setModal('control') }}>
            <Settings size={12}/> Config
          </button>
        </div>
      </div>
    </>
  )
}

/* ════════════════════════════════════════════
   NHÓM THEO CLIENT → SITE (thu gọn, bấm mở rộng)
   ════════════════════════════════════════════ */
type SiteGroup = { siteId: string; siteName: string; location: string; cams: Camera[] }
type ClientGroup = { clientId: string; clientName: string; sites: Map<string, SiteGroup> }

function GroupedCameras({ cameras, expandedSites, onToggleSite }: {
  cameras: Camera[]
  expandedSites: Set<string>
  onToggleSite: (siteId: string) => void
}) {
  const clients = new Map<string, ClientGroup>()
  const NO_CLIENT = '__no_client__'
  const NO_SITE = '__no_site__'

  for (const cam of cameras) {
    const site = cam.site
    const clientId = site?.client_id || NO_CLIENT
    const clientName = site?.client_name || ''
    const siteId = site?.id || NO_SITE
    const siteName = site?.name || 'Chưa gán công trình'
    const location = site?.location || ''

    if (!clients.has(clientId)) clients.set(clientId, { clientId, clientName, sites: new Map() })
    const cg = clients.get(clientId)!
    if (!cg.sites.has(siteId)) cg.sites.set(siteId, { siteId, siteName, location, cams: [] })
    cg.sites.get(siteId)!.cams.push(cam)
  }

  const clientList = Array.from(clients.values())

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
      {clientList.map(cg => (
        <div key={cg.clientId}>
          {/* Client header — ẩn nếu camera chưa được gán vào khách hàng nào */}
          {cg.clientId !== NO_CLIENT && (
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:'.75rem', paddingBottom:'.45rem', borderBottom:'1px solid var(--border-color)' }}>
              <div style={{ width:30, height:30, borderRadius:8, background:'rgba(245,158,11,.14)', color:'#f59e0b', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <Building2 size={16}/>
              </div>
              <h2 style={{ fontSize:'1rem', fontWeight:800, color:'var(--text-primary)', margin:0 }}>{cg.clientName}</h2>
              <span style={{ fontSize:'.7rem', color:'var(--text-muted)', fontWeight:600 }}>
                {Array.from(cg.sites.values()).reduce((n,s)=>n+s.cams.length,0)} camera · {cg.sites.size} công trình
              </span>
            </div>
          )}

          {/* Mỗi site = 1 card thu gọn */}
          <div style={{ display:'flex', flexDirection:'column', gap:'.6rem' }}>
            {Array.from(cg.sites.values()).map(sg => {
              const open = expandedSites.has(sg.siteId)
              const onlineN = sg.cams.filter(c => c.is_online).length
              return (
                <div key={sg.siteId} style={{ border:'1px solid var(--border-color)', borderRadius:10, background:'var(--bg-secondary)', overflow:'hidden' }}>
                  {/* Site header — bấm để mở/đóng */}
                  <button onClick={()=>onToggleSite(sg.siteId)}
                          style={{ width:'100%', display:'flex', alignItems:'center', gap:9, padding:'.7rem .9rem',
                                   background:'none', border:'none', cursor:'pointer', textAlign:'left' }}>
                    {open ? <ChevronDown size={16} style={{ color:'var(--text-muted)', flexShrink:0 }}/>
                          : <ChevronRight size={16} style={{ color:'var(--text-muted)', flexShrink:0 }}/>}
                    <Building2 size={14} style={{ color:'var(--accent-light)', flexShrink:0 }}/>
                    <span style={{ fontSize:'.85rem', fontWeight:700, color:'var(--text-primary)' }}>{sg.siteName}</span>
                    {sg.location && <span style={{ fontSize:'.7rem', color:'var(--text-muted)' }}>· {sg.location}</span>}
                    <span style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:10 }}>
                      <span style={{ fontSize:'.7rem', color: onlineN>0?'var(--status-ok)':'var(--text-muted)', fontWeight:600, display:'inline-flex', alignItems:'center', gap:4 }}>
                        <WifiOn size={11}/>{onlineN}/{sg.cams.length}
                      </span>
                      {!open && (
                        <span style={{ fontSize:'.68rem', color:'var(--accent-light)', fontWeight:600, display:'inline-flex', alignItems:'center', gap:3 }}>
                          <LayoutGrid size={11}/>Xem
                        </span>
                      )}
                    </span>
                  </button>

                  {/* Hàng cuộn ngang — chỉ hiện khi mở */}
                  {open && (
                    <div className="cam-scroll-row" style={{ display:'flex', gap:'1rem', overflowX:'auto', padding:'0 .9rem .9rem', scrollSnapType:'x proximity' }}>
                      {sg.cams.map(cam => (
                        <div key={cam.id} style={{ flex:'0 0 300px', maxWidth:300, scrollSnapAlign:'start' }}>
                          <CameraCard cam={cam}/>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

/* Trích danh sách site (id+name) từ cameras — cho filter dropdown */
function extractSites(cameras: Camera[]): { id: string; name: string }[] {
  const seen = new Map<string, string>()
  for (const c of cameras) {
    if (c.site) seen.set(c.site.id, c.site.name)
  }
  return Array.from(seen.entries()).map(([id, name]) => ({ id, name }))
}

/* ════════════════════════════════════════════
   MAIN PAGE
   ════════════════════════════════════════════ */
export default function CamerasPage() {
  const { user } = useAuth()
  const canManage = !!user?.is_staff || user?.client_role === 'admin'
  const [q, setQ] = useState('')
  const [statusF, setStatusF] = useState('')
  const [siteF, setSiteF] = useState('')
  const [onlineOnly, setOnlineOnly] = useState(false)
  const [modal, setModal] = useState<'addCam'|'addSite'|null>(null)
  const [expandedSites, setExpandedSites] = useState<Set<string>>(new Set())

  const { data, isLoading, refetch } = useQuery<{ results: Camera[]; count: number }>({
    queryKey: ['cameras', q, statusF],
    queryFn: () => getCameras({ q, status: statusF }).then(r => r.data),
  })

  const allResults = data?.results ?? []
  const cameras = allResults.filter(c =>
    (!onlineOnly || c.is_online) &&
    (!siteF || c.site?.id === siteF)
  )
  const onlineCount = allResults.filter(c => c.is_online).length
  const siteOptions = extractSites(allResults)

  const toggleSite = (siteId: string) => {
    setExpandedSites(prev => {
      const next = new Set(prev)
      next.has(siteId) ? next.delete(siteId) : next.add(siteId)
      return next
    })
  }
  const visibleSiteIds = Array.from(new Set(cameras.map(c => c.site?.id || '__no_site__')))
  const allExpanded = visibleSiteIds.length > 0 && visibleSiteIds.every(id => expandedSites.has(id))
  const toggleAll = () => {
    setExpandedSites(allExpanded ? new Set() : new Set(visibleSiteIds))
  }

  return (
    <div>
      {modal==='addCam'  && <AddCameraModal onClose={()=>{ setModal(null); refetch() }} />}
      {modal==='addSite' && <AddSiteModal   onClose={()=>setModal(null)} />}

      {/* ── Header ── */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'1.25rem' }}>
        <div>
          <h1 className="page-title">Cameras</h1>
          <p style={{ fontSize:'.78rem', color:'var(--text-muted)', marginTop:2 }}>
            {data?.count??0} cameras &nbsp;·&nbsp;
            <span style={{ color:onlineCount>0?'var(--status-ok)':'var(--text-muted)' }}>{onlineCount} online</span>
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {canManage && (
            <>
              <button className="atl-btn" onClick={()=>setModal('addSite')}>
                <Building2 size={13}/> Add Site
              </button>
              <button className="atl-btn primary" onClick={()=>setModal('addCam')}>
                <Plus size={13}/> Add Camera
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="atl-card" style={{ padding:'.6rem .875rem', marginBottom:'1rem', display:'flex', flexWrap:'wrap', alignItems:'center', gap:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, background:'var(--bg-primary)', border:'1px solid var(--border-color)', borderRadius:7, padding:'.35rem .75rem', flex:1, minWidth:150 }}>
          <Search size={13} style={{ color:'var(--text-muted)', flexShrink:0 }} />
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search name, code…"
                 style={{ background:'none', border:'none', outline:'none', color:'var(--text-primary)', fontSize:'.825rem', flex:1, minWidth:0 }} />
          {q && <button onClick={()=>setQ('')} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', display:'flex' }}><X size={12}/></button>}
        </div>
        <select value={statusF} onChange={e=>setStatusF(e.target.value)} className="atl-select" style={{ width:'auto', minWidth:130 }}>
          <option value="">All status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="maintenance">Maintenance</option>
        </select>
        <select value={siteF} onChange={e=>setSiteF(e.target.value)} className="atl-select" style={{ width:'auto', minWidth:150 }}>
          <option value="">Tất cả công trình</option>
          {siteOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:'.8rem', color:'var(--text-secondary)', cursor:'pointer', userSelect:'none', whiteSpace:'nowrap' }}>
          <input type="checkbox" checked={onlineOnly} onChange={e=>setOnlineOnly(e.target.checked)} />
          Online only
        </label>
        <button onClick={toggleAll} className="atl-btn ghost" style={{ padding:'.35rem .6rem', fontSize:'.75rem', whiteSpace:'nowrap' }} title={allExpanded?'Thu gọn tất cả':'Mở rộng tất cả'}>
          {allExpanded ? <><ChevronRight size={13}/> Thu gọn</> : <><ChevronDown size={13}/> Mở rộng</>}
        </button>
        <button onClick={()=>refetch()} className="atl-btn ghost" style={{ padding:'.35rem .5rem' }} title="Refresh">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* ── Skeleton ── */}
      {isLoading && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:'1rem' }}>
          {[1,2,3].map(i=><div key={i} className="skeleton atl-card" style={{ height:340 }}/>)}
        </div>
      )}

      {/* ── Nhóm theo Client → Site, thu gọn/mở rộng ── */}
      {!isLoading && <GroupedCameras cameras={cameras} expandedSites={expandedSites} onToggleSite={toggleSite} />}

      {cameras.length===0 && !isLoading && (
        <div style={{ textAlign:'center', padding:'5rem 0', color:'var(--text-muted)' }}>
          <CameraIcon size={44} style={{ opacity:.12, margin:'0 auto 14px', display:'block' }}/>
          <p style={{ marginBottom:16, fontWeight:600 }}>No cameras found</p>
          <button className="atl-btn primary" onClick={()=>setModal('addCam')}>
            <Plus size={14}/> Add first camera
          </button>
        </div>
      )}
    </div>
  )
}

