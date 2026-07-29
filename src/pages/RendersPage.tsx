import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getRenders, getCameras, createRender, deleteRender } from '../api/client'
import type { VideoRender, Camera } from '../api/types'
import { Film, Plus, X, Download, Clock, CheckCircle2, XCircle, RefreshCw, Play, Trash2 } from 'lucide-react'

function fmtBytes(b: number | null) {
  if (!b) return '—'
  if (b > 1e9) return (b / 1e9).toFixed(2) + ' GB'
  if (b > 1e6) return (b / 1e6).toFixed(1) + ' MB'
  return (b / 1e3).toFixed(0) + ' KB'
}

const STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  pending:    { color: '#f59e0b', bg: 'rgba(245,158,11,.12)',  label: 'Đang chờ' },
  processing: { color: '#60a5fa', bg: 'rgba(96,165,250,.12)',  label: 'Đang render' },
  ready:      { color: '#34d399', bg: 'rgba(52,211,153,.12)',  label: 'Sẵn sàng' },
  failed:     { color: '#f87171', bg: 'rgba(248,113,113,.12)', label: 'Thất bại' },
  expired:    { color: '#9ca3af', bg: 'rgba(156,163,175,.12)', label: 'Hết hạn' },
}

const RESOLUTIONS = [
  { v: '3840x2160', label: '4K (3840×2160)' },
  { v: '1920x1080', label: 'Full HD (1920×1080)' },
  { v: '1280x720',  label: 'HD (1280×720)' },
  { v: '854x480',   label: 'SD (854×480)' },
]
const FPS_OPTIONS = [6, 12, 24, 30]
const INTERVAL_PRESETS = [
  { v: 0,     label: 'Tất cả ảnh' },
  { v: 60,    label: '1 ảnh / phút' },
  { v: 300,   label: '1 ảnh / 5 phút' },
  { v: 600,   label: '1 ảnh / 10 phút' },
  { v: 1800,  label: '1 ảnh / 30 phút' },
  { v: 3600,  label: '1 ảnh / giờ' },
  { v: 86400, label: '1 ảnh / ngày' },
]

const today = () => new Date().toISOString().slice(0, 10)
const weekAgo = () => new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)

export default function RendersPage() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [watch, setWatch] = useState<VideoRender | null>(null)
  const [form, setForm] = useState({
    camera_id: '', date_from: weekAgo(), date_to: today(),
    fps: 24, resolution: '1920x1080', frame_interval: 0,
  })

  const { data, isLoading, refetch } = useQuery<{ results: VideoRender[] }>({
    queryKey: ['renders'],
    queryFn: () => getRenders().then(r => r.data),
    refetchInterval: (q) => {
      const rows = (q.state.data as any)?.results ?? []
      return rows.some((r: VideoRender) => r.status === 'pending' || r.status === 'processing') ? 4000 : false
    },
  })
  const { data: camsData } = useQuery<{ results: Camera[] }>({
    queryKey: ['cameras'],
    queryFn: () => getCameras().then(r => r.data),
  })

  const renders = data?.results ?? []
  const cameras = camsData?.results ?? []

  // Ước tính số frame và duration
  const estimate = () => {
    if (!form.date_from || !form.date_to) return null
    const days = Math.max(1, (new Date(form.date_to).getTime() - new Date(form.date_from).getTime()) / 864e5 + 1)
    return { days: Math.round(days) }
  }
  const est = estimate()

  const submit = async () => {
    if (!form.camera_id) { setError('Chọn camera'); return }
    if (!form.date_from || !form.date_to) { setError('Chọn khoảng ngày'); return }
    if (form.date_from > form.date_to) { setError('Ngày bắt đầu phải trước ngày kết thúc'); return }
    setSaving(true); setError('')
    try {
      await createRender(form.camera_id, {
        date_from: form.date_from, date_to: form.date_to,
        fps: form.fps, resolution: form.resolution, frame_interval: form.frame_interval,
      })
      qc.invalidateQueries({ queryKey: ['renders'] })
      setModal(false)
    } catch (e: any) { setError(e?.response?.data?.detail || 'Lỗi khi tạo render') }
    setSaving(false)
  }

  const del = async (r: VideoRender) => {
    if (!confirm(`Xoá video render ${r.date_from} → ${r.date_to}?`)) return
    try {
      await deleteRender(r.id)
      qc.invalidateQueries({ queryKey: ['renders'] })
      qc.invalidateQueries({ queryKey: ['downloads'] })
    } catch { /* ignore */ }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Video Renders</h1>
          <p style={{ fontSize: '.78rem', color: 'var(--text-secondary)', margin: '4px 0 0' }}>Render video timelapse từ ảnh camera</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="atl-btn" style={{ fontSize: '.78rem' }} onClick={() => refetch()}><RefreshCw size={13} /></button>
          <button className="atl-btn primary" style={{ fontSize: '.8rem' }} onClick={() => { setError(''); setModal(true) }}>
            <Plus size={14} style={{ marginRight: 5 }} />Render mới
          </button>
        </div>
      </div>

      {isLoading && <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải…</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {renders.map(r => {
          const st = STATUS_STYLE[r.status] || STATUS_STYLE.pending
          return (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '.75rem 1rem', border: '1px solid var(--border-color)', borderRadius: 11, background: 'var(--bg-secondary)', flexWrap: 'wrap' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: st.bg, color: st.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Film size={19} />
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  <code style={{ color: '#a78bfa', marginRight: 6 }}>{r.camera_code || r.camera_id.slice(0, 8)}</code>
                  {r.date_from} → {r.date_to}
                </div>
                <div style={{ fontSize: '.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  {r.fps}fps · {r.resolution}
                  {(r.frame_interval ?? 0) > 0 && <> · 1 ảnh/{r.frame_interval! >= 3600 ? `${r.frame_interval! / 3600}h` : `${r.frame_interval! / 60}m`}</>}
                  {r.item_count > 0 && <> · {r.item_count} frames</>}
                  {r.size_bytes ? <> · {fmtBytes(r.size_bytes)}</> : null}
                  {' · '}{new Date(r.created_at).toLocaleString('vi-VN')}
                </div>
                {r.error && <div style={{ fontSize: '.7rem', color: '#f87171', marginTop: 2 }}>{r.error}</div>}
              </div>

              {(r.status === 'processing' || r.status === 'pending') && (
                <div style={{ width: 140 }}>
                  <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                    <div style={{ width: `${r.progress}%`, height: '100%', background: st.color, transition: 'width .5s' }} />
                  </div>
                  <div style={{ fontSize: '.65rem', color: st.color, marginTop: 3, textAlign: 'right' }}>{r.progress}%</div>
                </div>
              )}

              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '.7rem', fontWeight: 700, color: st.color, background: st.bg, padding: '3px 10px', borderRadius: 12 }}>
                {r.status === 'ready' ? <CheckCircle2 size={11} /> : r.status === 'failed' ? <XCircle size={11} /> : <Clock size={11} />}
                {st.label}
              </span>

              {r.download_url && (
                <>
                  <button onClick={() => setWatch(r)} className="atl-btn" style={{ fontSize: '.75rem' }}>
                    <Play size={13} style={{ marginRight: 4 }} />Xem
                  </button>
                  <a href={r.download_url} className="atl-btn primary" style={{ fontSize: '.75rem', textDecoration: 'none' }}>
                    <Download size={13} style={{ marginRight: 4 }} />Tải video
                  </a>
                </>
              )}

              <button onClick={() => del(r)} className="atl-btn ghost" style={{ fontSize: '.75rem', color: '#f87171', padding: '4px 8px' }} title="Xoá render">
                <Trash2 size={13} />
              </button>
            </div>
          )
        })}
      </div>

      {renders.length === 0 && !isLoading && (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Film size={40} style={{ opacity: .2, marginBottom: 10 }} />
          <div>Chưa có video render nào — bấm "Render mới" để bắt đầu</div>
        </div>
      )}

      {/* Video player modal */}
      {watch && (watch.stream_url || watch.download_url) && (
        <div className="modal-overlay" onClick={() => setWatch(null)}>
          <div className="modal-box" style={{ maxWidth: 900, width: '92vw' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 7 }}>
                <Play size={16} style={{ color: '#a78bfa' }} />
                <code style={{ color: '#a78bfa' }}>{watch.camera_code || watch.camera_id.slice(0, 8)}</code>
                {watch.date_from} → {watch.date_to}
              </span>
              <button className="atl-btn ghost" style={{ padding: '4px 8px', marginLeft: 'auto' }} onClick={() => setWatch(null)}><X size={16} /></button>
            </div>
            <div className="modal-body" style={{ padding: 0 }}>
              <video src={watch.stream_url || watch.download_url || undefined} controls autoPlay
                     style={{ width: '100%', maxHeight: '75vh', display: 'block', background: '#000', borderRadius: '0 0 12px 12px' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '.7rem 1rem', borderTop: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '.72rem', color: 'var(--text-muted)' }}>
                {watch.fps}fps · {watch.resolution}
                {watch.item_count > 0 && <> · {watch.item_count} frames</>}
                {watch.size_bytes ? <> · {fmtBytes(watch.size_bytes)}</> : null}
              </span>
              <a href={watch.download_url || undefined} className="atl-btn primary" style={{ fontSize: '.75rem', textDecoration: 'none', marginLeft: 'auto' }}>
                <Download size={13} style={{ marginRight: 4 }} />Tải video
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Create render modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal-box" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span style={{ fontWeight: 800 }}><Film size={16} style={{ display: 'inline', marginRight: 7, color: '#a78bfa' }} />Tạo video timelapse</span>
              <button className="atl-btn ghost" style={{ padding: '4px 8px', marginLeft: 'auto' }} onClick={() => setModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Camera */}
              <div>
                <label style={{ fontSize: '.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Camera *</label>
                <select className="atl-select" style={{ width: '100%' }} value={form.camera_id}
                        onChange={e => setForm(f => ({ ...f, camera_id: e.target.value }))}>
                  <option value="">— Chọn camera —</option>
                  {cameras.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
                </select>
              </div>

              {/* Date range */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: '.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Từ ngày *</label>
                  <input type="date" className="atl-input" style={{ width: '100%' }} value={form.date_from}
                         onChange={e => setForm(f => ({ ...f, date_from: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: '.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Đến ngày *</label>
                  <input type="date" className="atl-input" style={{ width: '100%' }} value={form.date_to}
                         onChange={e => setForm(f => ({ ...f, date_to: e.target.value }))} />
                </div>
              </div>
              {/* Quick ranges */}
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {[
                  { label: 'Hôm nay', from: today(), to: today() },
                  { label: '7 ngày', from: weekAgo(), to: today() },
                  { label: '30 ngày', from: new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10), to: today() },
                  { label: '90 ngày', from: new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10), to: today() },
                ].map(p => (
                  <button key={p.label} className="atl-btn" style={{ fontSize: '.68rem', padding: '3px 10px' }}
                          onClick={() => setForm(f => ({ ...f, date_from: p.from, date_to: p.to }))}>
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Frame interval */}
              <div>
                <label style={{ fontSize: '.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Tần suất lấy ảnh</label>
                <select className="atl-select" style={{ width: '100%' }} value={form.frame_interval}
                        onChange={e => setForm(f => ({ ...f, frame_interval: Number(e.target.value) }))}>
                  {INTERVAL_PRESETS.map(p => <option key={p.v} value={p.v}>{p.label}</option>)}
                </select>
              </div>

              {/* FPS + Resolution */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: '.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>FPS</label>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {FPS_OPTIONS.map(f => (
                      <button key={f} className="atl-btn" style={{
                        flex: 1, fontSize: '.75rem', fontWeight: form.fps === f ? 700 : 400,
                        borderColor: form.fps === f ? '#a78bfa' : undefined,
                        color: form.fps === f ? '#a78bfa' : undefined,
                        background: form.fps === f ? 'rgba(167,139,250,.1)' : undefined,
                      }} onClick={() => setForm(prev => ({ ...prev, fps: f }))}>{f}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Độ phân giải</label>
                  <select className="atl-select" style={{ width: '100%' }} value={form.resolution}
                          onChange={e => setForm(f => ({ ...f, resolution: e.target.value }))}>
                    {RESOLUTIONS.map(r => <option key={r.v} value={r.v}>{r.label}</option>)}
                  </select>
                </div>
              </div>

              {est && (
                <div style={{ fontSize: '.72rem', color: 'var(--text-secondary)', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '.5rem .7rem' }}>
                  📅 Khoảng thời gian: <strong>{est.days} ngày</strong> · video {form.fps}fps
                  {form.frame_interval > 0 && <> · ước tính ~{Math.round(est.days * 86400 / form.frame_interval / form.fps)}s video (nếu đủ ảnh)</>}
                </div>
              )}

              {error && <div style={{ color: '#f87171', fontSize: '.78rem' }}>{error}</div>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="atl-btn" onClick={() => setModal(false)}>Huỷ</button>
                <button className="atl-btn primary" disabled={saving} onClick={submit}>
                  {saving ? 'Đang tạo…' : '▶ Bắt đầu render'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
