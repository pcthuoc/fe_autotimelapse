import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { getMediaGallery, createArchive } from '../api/client'
import type { Media, MediaDayStat } from '../api/types'
import {
  ArrowLeft, Download, CheckSquare, Square, X, ChevronLeft, ChevronRight,
  Calendar, Clock, FolderArchive, Image as ImageIcon, Search,
} from 'lucide-react'

export default function MediaGalleryPage() {
  const { cameraPk } = useParams<{ cameraPk: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [page, setPage] = useState(1)

  // ── Filter state: from datetime → to datetime ─────────────────────────────
  const [dateFrom, setDateFrom] = useState('')   // YYYY-MM-DD
  const [timeFrom, setTimeFrom] = useState('')   // HH:MM
  const [dateTo,   setDateTo]   = useState('')   // YYYY-MM-DD
  const [timeTo,   setTimeTo]   = useState('')   // HH:MM
  // Applied values (sent to API khi bấm Lọc)
  const [applied, setApplied] = useState({ dtFrom: '', dtTo: '' })

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [lightbox, setLightbox] = useState<Media | null>(null)
  const [archiving, setArchiving] = useState(false)
  const [toast, setToast] = useState('')

  // Build ISO datetime strings
  const buildDt = (date: string, time: string, isEnd: boolean) => {
    if (!date) return ''
    const t = time || (isEnd ? '23:59' : '00:00')
    const sec = isEnd ? ':59' : ':00'
    return `${date}T${t}${sec}`
  }

  const applyFilter = () => {
    setPage(1)
    setApplied({
      dtFrom: buildDt(dateFrom, timeFrom, false),
      dtTo:   buildDt(dateTo,   timeTo,   true),
    })
  }

  const clearFilter = () => {
    setDateFrom(''); setTimeFrom('')
    setDateTo('');   setTimeTo('')
    setApplied({ dtFrom: '', dtTo: '' })
    setPage(1)
  }

  // Quick-select a single day from the day_stats list
  const selectDay = (day: string) => {
    setDateFrom(day); setTimeFrom('')
    setDateTo(day);   setTimeTo('')
    setPage(1)
    setApplied({ dtFrom: `${day}T00:00:00`, dtTo: `${day}T23:59:59` })
  }

  const hasFilter = !!(applied.dtFrom || applied.dtTo)

  // ── API call ──────────────────────────────────────────────────────────────
  const params: Record<string, string> = { page: String(page) }
  if (applied.dtFrom) params.dt_from = applied.dtFrom
  if (applied.dtTo)   params.dt_to   = applied.dtTo

  const { data, isLoading } = useQuery<{
    results: Media[]; count: number; total_count: number;
    camera_name: string; camera_code: string; site_name: string;
    day_stats: MediaDayStat[];
  }>({
    queryKey: ['gallery', cameraPk, page, applied.dtFrom, applied.dtTo],
    queryFn: () => getMediaGallery(cameraPk!, params).then((r) => r.data),
  })

  const photos = data?.results ?? []
  const totalPages = Math.ceil((data?.count ?? 0) / 60)

  const toggleSelect = (id: string) => {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 5000) }

  const downloadSelected = async () => {
    if (selected.size === 0) return
    setArchiving(true)
    try {
      await createArchive(cameraPk!, { ids: Array.from(selected) })
      qc.invalidateQueries({ queryKey: ['downloads'] })
      setSelected(new Set())
      showToast(`Đang nén ${selected.size} ảnh — xem tiến độ ở mục Downloads`)
    } catch { showToast('Lỗi khi tạo archive') }
    setArchiving(false)
  }

  const downloadRange = async () => {
    if (!applied.dtFrom && !applied.dtTo) { showToast('Chọn khoảng thời gian trước'); return }
    setArchiving(true)
    try {
      await createArchive(cameraPk!, {
        date_from: applied.dtFrom || undefined,
        date_to:   applied.dtTo   || undefined,
      })
      qc.invalidateQueries({ queryKey: ['downloads'] })
      showToast('Đang nén ảnh theo khoảng thời gian — xem mục Downloads')
    } catch { showToast('Lỗi khi tạo archive') }
    setArchiving(false)
  }

  const lbIndex = lightbox ? photos.findIndex((p) => p.id === lightbox.id) : -1

  // Format applied range for display
  const fmtApplied = () => {
    const f = applied.dtFrom ? new Date(applied.dtFrom).toLocaleString('vi-VN', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '—'
    const t = applied.dtTo   ? new Date(applied.dtTo  ).toLocaleString('vi-VN', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '—'
    return `${f} → ${t}`
  }

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 18, right: 18, zIndex: 1100, background: 'var(--bg-secondary)', border: '1px solid #34d399', color: 'var(--text-primary)', borderRadius: 10, padding: '.7rem 1rem', fontSize: '.8rem', boxShadow: '0 8px 24px rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <FolderArchive size={15} style={{ color: '#34d399' }} />{toast}
          <Link to="/downloads" style={{ color: '#60a5fa', fontWeight: 700 }}>Mở Downloads →</Link>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <button onClick={() => navigate(-1)} className="atl-btn ghost" style={{ padding: '5px 8px', flexShrink: 0 }}>
          <ArrowLeft size={16} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ImageIcon size={17} style={{ color: '#22d3ee' }} />
            {data?.camera_name ?? '…'}
            <code style={{ fontSize: '.72rem', color: '#60a5fa' }}>{data?.camera_code}</code>
          </h1>
          <p style={{ fontSize: '.73rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
            {data?.site_name && <>{data.site_name} · </>}
            {data?.total_count ?? 0} ảnh tổng
            {hasFilter && data?.count !== data?.total_count && (
              <span style={{ color: '#60a5fa' }}> · {data?.count ?? 0} ảnh trong khoảng lọc</span>
            )}
          </p>
        </div>
        <Link to="/downloads" className="atl-btn" style={{ fontSize: '.75rem', textDecoration: 'none' }}>
          <FolderArchive size={13} style={{ marginRight: 5 }} />Downloads
        </Link>
      </div>

      {/* Main layout: filter panel + gallery */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 200px', gap: 14, alignItems: 'start' }}>

        {/* LEFT: filter + gallery */}
        <div>
          {/* Filter bar */}
          <div style={{ border: '1px solid var(--border-color)', borderRadius: 11, background: 'var(--bg-secondary)', padding: '.75rem .9rem', marginBottom: 12 }}>

            {/* Datetime range */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'end', marginBottom: 10 }}>
              {/* From */}
              <div>
                <div style={{ fontSize: '.65rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Calendar size={11} style={{ color: '#f59e0b' }} />TỪ
                </div>
                <div style={{ display: 'flex', gap: 5 }}>
                  <input type="date" className="atl-input" value={dateFrom}
                         onChange={e => setDateFrom(e.target.value)}
                         style={{ flex: 1.5, fontSize: '.78rem' }} />
                  <input type="time" className="atl-input" value={timeFrom}
                         onChange={e => setTimeFrom(e.target.value)}
                         style={{ flex: 1, fontSize: '.78rem' }} />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: 4 }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '.9rem' }}>→</span>
              </div>

              {/* To */}
              <div>
                <div style={{ fontSize: '.65rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={11} style={{ color: '#22d3ee' }} />ĐẾN
                </div>
                <div style={{ display: 'flex', gap: 5 }}>
                  <input type="date" className="atl-input" value={dateTo}
                         onChange={e => setDateTo(e.target.value)}
                         style={{ flex: 1.5, fontSize: '.78rem' }} />
                  <input type="time" className="atl-input" value={timeTo}
                         onChange={e => setTimeTo(e.target.value)}
                         style={{ flex: 1, fontSize: '.78rem' }} />
                </div>
              </div>
            </div>

            {/* Action row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button className="atl-btn primary" style={{ fontSize: '.78rem' }} onClick={applyFilter}>
                <Search size={13} style={{ marginRight: 4 }} />Lọc
              </button>
              {(dateFrom || dateTo || hasFilter) && (
                <button className="atl-btn ghost" style={{ fontSize: '.75rem' }} onClick={clearFilter}>
                  <X size={12} style={{ marginRight: 3 }} />Xóa bộ lọc
                </button>
              )}

              {hasFilter && (
                <span style={{ fontSize: '.7rem', color: '#f59e0b', background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.25)', padding: '2px 8px', borderRadius: 8 }}>
                  📅 {fmtApplied()}
                </span>
              )}

              <div style={{ flex: 1 }} />

              {/* Selection actions */}
              {selected.size > 0 ? (
                <>
                  <span style={{ fontSize: '.72rem', padding: '3px 10px', borderRadius: 10, background: 'rgba(96,165,250,.12)', color: '#60a5fa', fontWeight: 700 }}>
                    {selected.size} đã chọn
                  </span>
                  <button className="atl-btn ghost" style={{ fontSize: '.72rem' }} onClick={() => setSelected(new Set())}>
                    <X size={11} style={{ marginRight: 3 }} />Bỏ chọn
                  </button>
                  <button className="atl-btn primary" style={{ fontSize: '.75rem' }} disabled={archiving} onClick={downloadSelected}>
                    <Download size={12} style={{ marginRight: 4 }} />
                    {archiving ? 'Đang tạo ZIP…' : `Tải ${selected.size} ảnh (ZIP)`}
                  </button>
                </>
              ) : (
                <>
                  <button className="atl-btn" style={{ fontSize: '.72rem' }}
                          onClick={() => setSelected(new Set(photos.map((p) => p.id)))}>
                    <CheckSquare size={12} style={{ marginRight: 4 }} />Chọn hết trang
                  </button>
                  <button className="atl-btn" style={{ fontSize: '.72rem', color: '#22d3ee', borderColor: 'rgba(34,211,238,.35)' }}
                          disabled={archiving} onClick={downloadRange}>
                    <FolderArchive size={12} style={{ marginRight: 4 }} />
                    {hasFilter ? 'Tải khoảng đã lọc (ZIP)' : 'Tải tất cả (ZIP)'}
                  </button>
                </>
              )}
            </div>
          </div>

          {isLoading && <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải…</div>}

          {/* Gallery grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
            {photos.map((photo) => {
              const sel = selected.has(photo.id)
              return (
                <div key={photo.id}
                     style={{ position: 'relative', aspectRatio: '4/3', background: 'var(--bg-primary)', borderRadius: 10, overflow: 'hidden', cursor: 'pointer',
                              border: sel ? '2px solid #60a5fa' : '1px solid var(--border-color)', transition: 'transform .15s, border-color .15s' }}
                     onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'scale(1.03)'}
                     onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = 'scale(1)'}
                     onClick={() => setLightbox(photo)}>
                  <img src={photo.thumb_url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '3px 6px', background: 'linear-gradient(transparent, rgba(0,0,0,.7))' }}>
                    <span style={{ fontSize: '.6rem', color: 'rgba(255,255,255,.85)' }}>
                      {new Date(photo.taken_at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                    </span>
                  </div>
                  <button style={{ position: 'absolute', top: 5, right: 5, background: sel ? 'rgba(96,165,250,.9)' : 'rgba(0,0,0,.45)', border: 'none', cursor: 'pointer', color: '#fff', padding: 3, borderRadius: 6, display: 'flex' }}
                          onClick={(e) => { e.stopPropagation(); toggleSelect(photo.id) }}>
                    {sel ? <CheckSquare size={14} /> : <Square size={14} />}
                  </button>
                </div>
              )
            })}
          </div>

          {photos.length === 0 && !isLoading && (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <ImageIcon size={40} style={{ opacity: .2, marginBottom: 10 }} />
              <div>Không có ảnh nào{hasFilter ? ' trong khoảng thời gian đã chọn' : ''}</div>
              {hasFilter && <button className="atl-btn" style={{ marginTop: 10 }} onClick={clearFilter}>Xóa bộ lọc</button>}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="atl-btn" style={{ fontSize: '.78rem' }}>
                <ChevronLeft size={14} /> Trước
              </button>
              <span style={{ fontSize: '.85rem', color: 'var(--text-secondary)' }}>{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="atl-btn" style={{ fontSize: '.78rem' }}>
                Sau <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>

        {/* RIGHT: day stats sidebar */}
        <div style={{ position: 'sticky', top: 16 }}>
          <div style={{ border: '1px solid var(--border-color)', borderRadius: 11, background: 'var(--bg-secondary)', overflow: 'hidden' }}>
            <div style={{ padding: '.6rem .75rem', borderBottom: '1px solid var(--border-color)', fontSize: '.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Calendar size={12} />Chọn nhanh theo ngày
            </div>
            <div style={{ maxHeight: 500, overflowY: 'auto' }}>
              {(data?.day_stats ?? []).length === 0 && (
                <div style={{ padding: '1rem', fontSize: '.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>Không có dữ liệu</div>
              )}
              {(data?.day_stats ?? []).map(ds => {
                const isActive = applied.dtFrom?.startsWith(ds.day) && applied.dtTo?.startsWith(ds.day)
                return (
                  <button key={ds.day} onClick={() => selectDay(ds.day)}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.45rem .75rem', background: isActive ? 'rgba(96,165,250,.12)' : 'transparent', border: 'none', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', textAlign: 'left', transition: 'background .1s' }}
                          onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
                          onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                    <span style={{ fontSize: '.78rem', fontWeight: isActive ? 700 : 400, color: isActive ? '#60a5fa' : 'var(--text-primary)' }}>
                      {ds.date_label}
                    </span>
                    <span style={{ fontSize: '.68rem', color: isActive ? '#60a5fa' : 'var(--text-muted)', fontWeight: 600 }}>
                      {ds.count}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.92)' }}
             onClick={() => setLightbox(null)}>
          <button style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,.08)', borderRadius: 8, padding: 8, border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.8)' }}
                  onClick={() => setLightbox(null)}><X size={22} /></button>
          {lbIndex > 0 && (
            <button style={{ position: 'absolute', left: 16, background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer', color: '#fff' }}
                    onClick={e => { e.stopPropagation(); setLightbox(photos[lbIndex - 1]) }}>
              <ChevronLeft size={24} />
            </button>
          )}
          <img src={lightbox.view_url} alt="" style={{ maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: 8 }}
               onClick={e => e.stopPropagation()} />
          {lbIndex < photos.length - 1 && (
            <button style={{ position: 'absolute', right: 16, background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer', color: '#fff' }}
                    onClick={e => { e.stopPropagation(); setLightbox(photos[lbIndex + 1]) }}>
              <ChevronRight size={24} />
            </button>
          )}
          <div style={{ position: 'absolute', bottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '.8rem', color: 'rgba(255,255,255,.7)' }}>
              {new Date(lightbox.taken_at).toLocaleString('vi-VN')}
              {lightbox.width ? ` · ${lightbox.width}×${lightbox.height}` : ''}
            </span>
            <a href={lightbox.view_url} download target="_blank" rel="noreferrer"
               style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '.8rem', padding: '.4rem .8rem', borderRadius: 8, background: 'var(--accent)', color: '#fff', textDecoration: 'none', fontWeight: 700 }}
               onClick={e => e.stopPropagation()}>
              <Download size={13} /> Tải về
            </a>
          </div>
        </div>
      )}
    </div>
  )
}