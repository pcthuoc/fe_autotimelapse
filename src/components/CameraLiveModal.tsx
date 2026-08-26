import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getCamera, getLiveLatest, getCameraDevice } from '../api/client'
import { calcLFPPercent } from '../pages/CamerasPage'
import type { Camera, Media } from '../api/types'
import {
  X, Play, Square, RefreshCw, Camera as CameraIcon, Building2, Wifi, WifiOff,
  Clock, Image as ImageIcon, Download, ExternalLink, Maximize2, Minimize2,
  Zap, Thermometer, Battery, Info, ChevronRight
} from 'lucide-react'

interface CameraLiveModalProps {
  camId: string
  initialCam?: Camera | null
  onClose: () => void
}

function fmtTime(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function SigBars({ bars, dbm }: { bars: number; dbm?: number | null }) {
  const heights = [30, 55, 75, 100]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 2, height: 12, verticalAlign: 'middle' }}>
      {heights.map((h, i) => (
        <span
          key={i}
          style={{
            width: 3,
            height: `${h}%`,
            borderRadius: 1,
            background: i < bars ? '#10b981' : 'rgba(255,255,255,0.2)',
          }}
        />
      ))}
      {dbm != null && <span style={{ fontSize: '.6rem', color: 'rgba(255,255,255,0.6)', marginLeft: 3 }}>{dbm}dBm</span>}
    </span>
  )
}

export default function CameraLiveModal({ camId, initialCam, onClose }: CameraLiveModalProps) {
  const [liveOn, setLiveOn] = useState(false)
  const [liveFrameUrl, setLiveFrameUrl] = useState<string | null>(null)
  const [refreshInterval, setRefreshInterval] = useState(30)
  const [latestPhoto, setLatestPhoto] = useState<Media | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [wakeState, setWakeState] = useState<'idle' | 'waking' | 'done' | 'error'>('idle')
  const [poweringCM4, setPoweringCM4] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const liveRef = useRef({
    running: false,
    seq: 0,
    frameUrl: null as string | null,
    timer: null as ReturnType<typeof setTimeout> | null,
  })

  // Fetch camera details to keep online status up-to-date
  const { data: camData } = useQuery<Camera>({
    queryKey: ['camera', camId],
    queryFn: () => getCamera(camId).then((r) => r.data),
    refetchInterval: 15_000,
  })
  const camera = camData || initialCam

  // Fetch device telemetry
  const { data: deviceData } = useQuery({
    queryKey: ['device', camId],
    queryFn: () => getCameraDevice(camId).then((r) => r.data),
    refetchInterval: 15_000,
  })
  const dev = deviceData as any || camera?.device

  // CSRF token helper
  const csrf = () => document.cookie.match(/csrftoken=([^;]+)/)?.[1] || ''

  // Fetch latest photo
  const fetchLatest = async () => {
    try {
      const r = await getLiveLatest(camId)
      if (r.data?.photo) setLatestPhoto(r.data.photo)
    } catch { /* ignore */ }
  }

  // Initial fetch and auto-refresh timer for latest photo
  useEffect(() => {
    fetchLatest()
    let timer: ReturnType<typeof setInterval> | null = null
    if (!liveOn && refreshInterval > 0) {
      timer = setInterval(fetchLatest, refreshInterval * 1000)
    }
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [camId, liveOn, refreshInterval])

  // ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Clean up live stream on unmount
  useEffect(() => {
    return () => {
      if (!liveRef.current.running) return
      liveRef.current.running = false
      if (liveRef.current.timer) clearTimeout(liveRef.current.timer)
      if (liveRef.current.frameUrl) URL.revokeObjectURL(liveRef.current.frameUrl)
      fetch(`/api/v1/cameras/${camId}/live/stop/`, { method: 'POST', credentials: 'include', headers: { 'X-CSRFToken': csrf() } }).catch(() => {})
    }
  }, [camId])

  // MJPEG / frame polling loop
  const pollFrame = () => {
    if (!liveRef.current.running) return
    fetch(`/api/v1/cameras/${camId}/live/frame/?seq=${liveRef.current.seq}`, { credentials: 'include' })
      .then((r) => {
        if (r.status === 200) {
          liveRef.current.seq = parseInt(r.headers.get('X-Frame-Seq') || '0') || liveRef.current.seq
          return r.blob().then((b) => {
            const url = URL.createObjectURL(b)
            if (liveRef.current.frameUrl) URL.revokeObjectURL(liveRef.current.frameUrl)
            liveRef.current.frameUrl = url
            setLiveFrameUrl(url)
          })
        }
      })
      .catch(() => {})
      .finally(() => {
        if (liveRef.current.running) {
          liveRef.current.timer = setTimeout(pollFrame, 1000)
        }
      })
  }

  const startLive = () => {
    liveRef.current.running = true
    liveRef.current.seq = 0
    setLiveOn(true)
    fetch(`/api/v1/cameras/${camId}/live/start/`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-CSRFToken': csrf() },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) pollFrame()
      })
      .catch(() => {
        liveRef.current.running = false
        setLiveOn(false)
      })
  }

  const stopLive = () => {
    liveRef.current.running = false
    if (liveRef.current.timer) {
      clearTimeout(liveRef.current.timer)
      liveRef.current.timer = null
    }
    if (liveRef.current.frameUrl) {
      URL.revokeObjectURL(liveRef.current.frameUrl)
      liveRef.current.frameUrl = null
    }
    setLiveFrameUrl(null)
    setLiveOn(false)
    fetch(`/api/v1/cameras/${camId}/live/stop/`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-CSRFToken': csrf() },
    }).catch(() => {})
  }

  // Trigger immediate capture (Wake device)
  const triggerCapture = () => {
    if (wakeState === 'waking') return
    setWakeState('waking')
    const prevAt = latestPhoto?.taken_at || ''
    fetch(`/api/v1/cameras/${camId}/device/wake/`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-CSRFToken': csrf() },
    })
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) {
          setWakeState('error')
          setTimeout(() => setWakeState('idle'), 3000)
          return
        }
        let tries = 0
        const poll = setInterval(() => {
          tries++
          getLiveLatest(camId)
            .then((r) => r.data)
            .then((data: any) => {
              if (data?.photo?.taken_at && data.photo.taken_at !== prevAt) {
                clearInterval(poll)
                setLatestPhoto(data.photo)
                setWakeState('done')
                setTimeout(() => setWakeState('idle'), 3000)
              } else if (tries >= 45) {
                clearInterval(poll)
                setWakeState('error')
                setTimeout(() => setWakeState('idle'), 3000)
              }
            })
            .catch(() => {})
        }, 2000)
      })
      .catch(() => {
        setWakeState('error')
        setTimeout(() => setWakeState('idle'), 3000)
      })
  }

  const toggleFullscreen = () => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }

  const battV = dev?.battery_voltage ? parseFloat(dev.battery_voltage) : null
  const { pct: battPct } = calcLFPPercent(battV, dev?.battery_percent)
  const batt = battPct ?? dev?.battery_percent ?? null
  const battColor = batt === null ? 'rgba(255,255,255,0.4)' : batt < 20 ? '#ef4444' : batt < 50 ? '#f59e0b' : '#10b981'
  const isOnline = camera?.is_online || false
  const isCM4Running = dev?.cm4_power_state === 'running'

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.94)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        padding: '1.5rem',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          width: '94vw',
          maxWidth: 1120,
          height: '100%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#0d1117',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 16,
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 35px rgba(16, 185, 129, 0.12)',
          overflow: 'hidden',
          color: '#fff',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div
          style={{
            padding: '.75rem 1rem',
            background: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {/* Row 1: Status + Site + Telemetry + Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '3px 9px',
                  borderRadius: 20,
                  fontSize: '.7rem',
                  fontWeight: 800,
                  letterSpacing: '.03em',
                  background: liveOn
                    ? 'rgba(239, 68, 68, 0.15)'
                    : isOnline
                    ? 'rgba(16, 185, 129, 0.15)'
                    : 'rgba(239, 68, 68, 0.15)',
                  color: liveOn ? '#ef4444' : isOnline ? 'var(--status-ok)' : '#ef4444',
                  border: `1px solid ${liveOn ? 'rgba(239,68,68,0.4)' : isOnline ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.4)'}`,
                  whiteSpace: 'nowrap',
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: liveOn ? '#ef4444' : isOnline ? 'var(--status-ok)' : '#ef4444',
                    boxShadow: liveOn || isOnline ? `0 0 8px ${liveOn ? '#ef4444' : 'var(--status-ok)'}` : 'none',
                  }}
                  className={liveOn || isOnline ? 'animate-pulse' : ''}
                />
                {liveOn ? 'TRỰC TIẾP' : isOnline ? 'ONLINE' : 'OFFLINE'}
              </span>

              {camera?.site && (
                <span style={{ fontSize: '.72rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--bg-tertiary)', padding: '2px 7px', borderRadius: 6, border: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>
                  <Building2 size={11} />
                  {camera.site.name}
                </span>
              )}
            </div>

            {/* Telemetry & Close buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {dev && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.75rem', color: 'var(--text-secondary)' }}>
                  {dev.sim_signal_dbm != null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} title={`Tín hiệu: ${dev.sim_signal_dbm} dBm`}>
                      <SigBars bars={dev.signal_bars ?? 0} dbm={dev.sim_signal_dbm} />
                    </div>
                  )}
                  {batt !== null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }} title={`Pin: ${batt}%`}>
                      <Battery size={13} style={{ color: battColor }} />
                      <span style={{ color: battColor, fontWeight: 700 }}>{batt}%</span>
                    </div>
                  )}
                  {dev.temperature_c != null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }} title={`Nhiệt độ: ${dev.temperature_c}°C`}>
                      <Thermometer size={12} style={{ color: '#f59e0b' }} />
                      <span>{dev.temperature_c}°C</span>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={toggleFullscreen}
                style={{
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  borderRadius: 8,
                  padding: '5px 8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
              >
                {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>

              <button
                onClick={onClose}
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#ef4444',
                  borderRadius: 8,
                  padding: '5px 8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Đóng (Esc)"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Row 2: Camera Name + Code Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
            <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)', lineHeight: 1.3 }}>
              {camera?.name || 'Camera Live View'}
            </span>
            <code style={{ fontSize: '.68rem', color: 'var(--accent-light)', background: 'var(--accent-muted)', padding: '2px 7px', borderRadius: 6, border: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>
              {camera?.code || camId}
            </code>
          </div>
        </div>

        {/* ── Main Viewport (Illuminated Center Media) ── */}
        <div
          style={{
            position: 'relative',
            flex: 1,
            background: '#000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            minHeight: 280,
          }}
        >
          {/* Photo overlay background blur */}
          {latestPhoto?.view_url && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: `url(${latestPhoto.view_url})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                filter: 'blur(32px) brightness(0.25)',
                opacity: 0.6,
                transform: 'scale(1.1)',
                pointerEvents: 'none',
              }}
            />
          )}

          {/* Central Live / Photo viewer */}
          {liveOn ? (
            liveFrameUrl ? (
              <img
                src={liveFrameUrl}
                alt="Live Stream Frame"
                style={{
                  width: '100%',
                  height: '100%',
                  maxHeight: '76vh',
                  objectFit: 'contain',
                  boxShadow: '0 0 40px rgba(0, 0, 0, 0.8)',
                  zIndex: 2,
                }}
              />
            ) : (
              <div
                style={{
                  zIndex: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 12,
                  color: 'rgba(255,255,255,0.85)',
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    border: '3px solid rgba(255,255,255,0.2)',
                    borderTopColor: '#10b981',
                    animation: 'spin 1s linear infinite',
                  }}
                />
                <span style={{ fontSize: '.85rem', fontWeight: 600, letterSpacing: '.02em' }}>
                  Đang khởi động luồng Live View từ camera…
                </span>
              </div>
            )
          ) : (latestPhoto?.view_url || latestPhoto?.thumb_url) ? (
            <img
              src={latestPhoto.view_url || latestPhoto.thumb_url || ''}
              alt="Latest Frame"
              style={{
                width: '100%',
                height: '100%',
                maxHeight: '76vh',
                objectFit: 'contain',
                boxShadow: '0 0 30px rgba(0,0,0,0.6)',
                zIndex: 2,
                cursor: 'pointer',
              }}
              onClick={() => {
                const targetUrl = latestPhoto.view_url || latestPhoto.thumb_url
                if (targetUrl) window.open(targetUrl, '_blank')
              }}
              onError={(e) => {
                const fallback = latestPhoto.thumb_url || latestPhoto.view_url
                if (fallback && e.currentTarget.src !== fallback) {
                  e.currentTarget.src = fallback
                }
              }}
            />
          ) : (
            <div
              style={{
                zIndex: 2,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                color: 'rgba(255,255,255,0.4)',
              }}
            >
              <CameraIcon size={48} />
              <span>Chưa có dữ liệu ảnh</span>
            </div>
          )}

          {/* Bottom Photo Metadata overlay */}
          <div
            style={{
              position: 'absolute',
              bottom: 10,
              left: 10,
              right: 10,
              zIndex: 10,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              pointerEvents: 'none',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <div
              style={{
                pointerEvents: 'auto',
                padding: '6px 12px',
                borderRadius: 9,
                background: 'rgba(0, 0, 0, 0.75)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#fff',
                maxWidth: '100%',
              }}
            >
              {latestPhoto ? (
                <>
                  <div style={{ fontWeight: 700, fontSize: '.78rem' }}>
                    Thời gian chụp: {fmtTime(latestPhoto.taken_at)}
                  </div>
                  <div style={{ fontSize: '.68rem', color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
                    Kích thước: {latestPhoto.width && latestPhoto.height ? `${latestPhoto.width}×${latestPhoto.height}` : 'Chuẩn'}
                    {dev?.last_seen_at ? ` · Cập nhật: ${fmtTime(dev.last_seen_at)}` : ''}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: '.72rem', color: 'rgba(255,255,255,0.8)' }}>
                  Bấm "Start Live Stream" để phát luồng ảnh trực tiếp
                </div>
              )}
            </div>

            {latestPhoto?.view_url && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  const code = camera?.code || 'camera'
                  const dt = latestPhoto.taken_at.replace(/[:T-]/g, '').slice(0, 15)
                  const filename = `${code}_${dt}.jpg`
                  const dlUrl = latestPhoto.download_url || latestPhoto.view_url
                  fetch(dlUrl)
                    .then((r) => {
                      if (!r.ok) throw new Error()
                      return r.blob()
                    })
                    .then((blob) => {
                      const blobUrl = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = blobUrl
                      a.download = filename
                      document.body.appendChild(a)
                      a.click()
                      a.remove()
                      setTimeout(() => URL.revokeObjectURL(blobUrl), 3000)
                    })
                    .catch(() => {
                      const a = document.createElement('a')
                      a.href = dlUrl
                      a.download = filename
                      document.body.appendChild(a)
                      a.click()
                      a.remove()
                    })
                }}
                style={{
                  pointerEvents: 'auto',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '6px 12px',
                  borderRadius: 8,
                  background: 'rgba(30, 41, 59, 0.85)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#fff',
                  fontSize: '.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                <Download size={13} /> Tải ảnh gốc
              </button>
            )}
          </div>
        </div>

        {/* ── Control Footer Bar ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '.75rem 1.25rem',
            background: 'var(--bg-secondary)',
            borderTop: '1px solid var(--border-color)',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          {/* Live Stream Start/Stop / Power ON CM4 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {!isCM4Running ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  disabled={true}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '8px 16px',
                    borderRadius: 8,
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: 'rgba(255, 255, 255, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    fontWeight: 700,
                    fontSize: '.82rem',
                    cursor: 'not-allowed',
                  }}
                  title="Cần Bật nguồn CM4 trước khi phát Live Stream"
                >
                  <Play size={15} fill="currentColor" /> Start Live Stream
                </button>
                <button
                  onClick={async () => {
                    setPoweringCM4(true)
                    try {
                      const { powerOnCM4 } = await import('../api/client')
                      await powerOnCM4(camId)
                    } catch { /* ignore */ }
                    finally { setPoweringCM4(false) }
                  }}
                  disabled={poweringCM4 || dev?.cm4_power_state === 'powering_on'}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 16px',
                    borderRadius: 8,
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 800,
                    fontSize: '.82rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
                  }}
                >
                  <Zap size={14} fill="#fff" />
                  {poweringCM4 || dev?.cm4_power_state === 'powering_on' ? 'Đang bật CM4…' : '⚡ Bật nguồn CM4'}
                </button>
              </div>
            ) : !liveOn ? (
              <button
                onClick={startLive}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '8px 18px',
                  borderRadius: 8,
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 800,
                  fontSize: '.82rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                  transition: 'all 0.15s ease',
                }}
              >
                <Play size={15} fill="#fff" /> Start Live Stream
              </button>
            ) : (
              <button
                onClick={stopLive}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '8px 18px',
                  borderRadius: 8,
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 800,
                  fontSize: '.82rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                  transition: 'all 0.15s ease',
                }}
              >
                <Square size={14} fill="#fff" /> Stop Live Stream
              </button>
            )}
          </div>

          {/* Last Frame thumbnail pill — ở giữa footer */}
          {(latestPhoto?.thumb_url || latestPhoto?.view_url) && !liveOn && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 10px 4px 5px',
                borderRadius: 9,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                cursor: 'pointer',
                flexShrink: 0,
              }}
              title="Bấm để xem ảnh gốc"
              onClick={() => {
                const url = latestPhoto.view_url || latestPhoto.thumb_url
                if (url) window.open(url, '_blank')
              }}
            >
              <img
                src={latestPhoto.thumb_url || latestPhoto.view_url}
                alt="thumb"
                style={{
                  width: 42, height: 30, objectFit: 'cover',
                  borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)',
                  flexShrink: 0, display: 'block',
                }}
                onError={(e) => {
                  if (latestPhoto.view_url && e.currentTarget.src !== latestPhoto.view_url) {
                    e.currentTarget.src = latestPhoto.view_url
                  }
                }}
              />
              <div style={{ lineHeight: 1.35 }}>
                <div style={{ fontSize: '.58rem', color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>Frame cuối</div>
                <div style={{ fontSize: '.7rem', color: 'rgba(255,255,255,0.9)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {fmtTime(latestPhoto.taken_at)}
                </div>
                {latestPhoto.width && (
                  <div style={{ fontSize: '.6rem', color: 'rgba(255,255,255,0.38)' }}>{latestPhoto.width}×{latestPhoto.height}</div>
                )}
              </div>
            </div>
          )}

          {/* Auto Refresh & Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.78rem', color: 'rgba(255,255,255,0.7)' }}>
              <Clock size={13} />
              <span>Tự động tải lại:</span>
              <select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#fff',
                  borderRadius: 6,
                  padding: '4px 8px',
                  fontSize: '.75rem',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value={10} style={{ background: '#161b22', color: '#fff' }}>10 giây</option>
                <option value={30} style={{ background: '#161b22', color: '#fff' }}>30 giây</option>
                <option value={60} style={{ background: '#161b22', color: '#fff' }}>60 giây</option>
                <option value={0}  style={{ background: '#161b22', color: '#fff' }}>Tắt</option>
              </select>
            </div>

            <button
              onClick={fetchLatest}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 12px',
                borderRadius: 6,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#fff',
                fontSize: '.75rem',
                cursor: 'pointer',
              }}
              title="Làm mới ảnh"
            >
              <RefreshCw size={13} /> Refresh
            </button>

            <Link
              to={`/media/camera/${camId}`}
              onClick={() => {
                try {
                  sessionStorage.setItem('atl-last-viewed-cam', camId)
                  sessionStorage.setItem('atl-auto-open-live', camId)
                } catch {}
                onClose()
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 12px',
                borderRadius: 6,
                background: 'rgba(59, 130, 246, 0.15)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                color: '#60a5fa',
                fontSize: '.75rem',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              <ImageIcon size={13} /> Thư viện ảnh <ChevronRight size={12} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
