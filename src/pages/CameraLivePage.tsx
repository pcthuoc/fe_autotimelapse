import { useQuery } from '@tanstack/react-query'
import { useParams, Link } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { getCamera, getLiveLatest } from '../api/client'
import type { Camera, Media } from '../api/types'
import { Card, CardHeader, CardContent } from '../components/Card'
import { ArrowLeft, Play, Square, RefreshCw, ExternalLink } from 'lucide-react'

export default function CameraLivePage() {
  const { pk } = useParams<{ pk: string }>()
  const [live, setLive] = useState(false)
  const [refreshInterval, setRefreshInterval] = useState(30)
  const [latestPhoto, setLatestPhoto] = useState<Media | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { data: camera } = useQuery<Camera>({
    queryKey: ['camera', pk],
    queryFn: () => getCamera(pk!).then((r) => r.data),
  })

  const fetchLatest = () => {
    getLiveLatest(pk!).then((r) => {
      if (r.data?.photo) setLatestPhoto(r.data.photo)
    }).catch(() => {})
  }

  useEffect(() => {
    fetchLatest()
    if (live && refreshInterval > 0) {
      timerRef.current = setInterval(fetchLatest, refreshInterval * 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [live, refreshInterval, pk])

  if (!camera) return <div className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>Đang tải…</div>

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <Link to="/cameras" className="flex items-center gap-1 text-sm no-underline"
              style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft size={16} /> Quay lại
        </Link>
        <h1 className="text-xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
          {camera.name}
        </h1>
        <span className="font-mono text-xs px-2 py-0.5 rounded"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
          {camera.code}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left panel */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>Thông tin</CardHeader>
            <CardContent className="p-4">
              <table className="w-full text-sm">
                <tbody>
                  {[
                    ['Site', camera.site?.name ?? '—'],
                    ['Timezone', camera.timezone],
                    ['Status', camera.status],
                    ['Battery', camera.device?.battery_percent !== null ? `${camera.device?.battery_percent}%` : '—'],
                    ['Signal', camera.device?.signal_label ?? '—'],
                    ['Temperature', camera.device?.temperature_c !== null ? `${camera.device?.temperature_c}°C` : '—'],
                  ].map(([k, v]) => (
                    <tr key={k}>
                      <td className="py-1 pr-3 font-semibold" style={{ color: 'var(--text-secondary)', width: '45%' }}>{k}</td>
                      <td className="py-1" style={{ color: 'var(--text-primary)' }}>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>Auto-refresh</CardHeader>
            <CardContent className="p-4 flex flex-col gap-3">
              <select value={refreshInterval}
                      onChange={(e) => setRefreshInterval(Number(e.target.value))}
                      className="rounded-[8px] px-3 py-2 text-sm outline-none w-full"
                      style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)',
                               color: 'var(--text-primary)' }}>
                <option value={10}>10 giây</option>
                <option value={30}>30 giây</option>
                <option value={60}>60 giây</option>
                <option value={120}>120 giây</option>
                <option value={0}>Tắt</option>
              </select>
              <button onClick={fetchLatest} className="flex items-center justify-center gap-2 rounded-[8px] py-2 text-sm font-semibold"
                      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
                               color: 'var(--text-primary)', cursor: 'pointer' }}>
                <RefreshCw size={14} /> Refresh ngay
              </button>
              <Link to={`/media/camera/${pk}`} className="text-sm text-center no-underline"
                    style={{ color: 'var(--accent-light)' }}>
                Xem Gallery →
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Right panel */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Live control */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <span>Live View</span>
                {live && (
                  <span className="flex items-center gap-1.5 text-xs font-bold"
                        style={{ color: 'var(--status-error)' }}>
                    <span className="inline-block rounded-full animate-pulse"
                          style={{ width: 6, height: 6, background: 'var(--status-error)' }} />
                    LIVE
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="flex gap-2 mb-3">
                <button onClick={() => setLive(true)} disabled={live}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-[8px] text-sm font-semibold disabled:opacity-50"
                        style={{ background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer' }}>
                  <Play size={14} /> Start
                </button>
                <button onClick={() => setLive(false)} disabled={!live}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-[8px] text-sm font-semibold disabled:opacity-50"
                        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
                                 color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <Square size={14} /> Stop
                </button>
              </div>
              {!live && (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Nhấn Start để bắt đầu xem live</p>
              )}
            </CardContent>
          </Card>

          {/* Latest photo */}
          <Card>
            <CardHeader>Ảnh mới nhất</CardHeader>
            <CardContent className="p-0">
              {latestPhoto ? (
                <div className="relative" style={{ aspectRatio: '16/9', background: 'var(--bg-primary)' }}>
                  <img src={latestPhoto.thumb_url} alt="Latest" className="w-full h-full object-cover rounded-b-[14px]" />
                  <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-2 rounded-b-[14px]"
                       style={{ background: 'linear-gradient(transparent, rgba(0,0,0,.65))' }}>
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,.85)' }}>
                      {new Date(latestPhoto.taken_at).toLocaleString('vi-VN')}
                    </span>
                    <a href={latestPhoto.view_url} target="_blank" rel="noreferrer"
                       className="flex items-center gap-1 text-xs no-underline"
                       style={{ color: 'rgba(255,255,255,.85)' }}>
                      <ExternalLink size={12} /> Fullsize
                    </a>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center py-12"
                     style={{ color: 'var(--text-muted)' }}>
                  Chưa có ảnh
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

import React from 'react'
