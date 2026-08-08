import { useQuery } from '@tanstack/react-query'
import { getDownloads, deleteRender, deleteArchive } from '../api/client'
import type { DownloadItem } from '../api/types'
import { Film, FolderArchive, Download, RefreshCw, Clock, CheckCircle2, XCircle, HardDrive, Trash2 } from 'lucide-react'

import { useAuth } from '../contexts/AuthContext'

function fmtBytes(b: number) {
  if (!b) return '—'
  if (b > 1e9) return (b / 1e9).toFixed(2) + ' GB'
  if (b > 1e6) return (b / 1e6).toFixed(1) + ' MB'
  return (b / 1e3).toFixed(0) + ' KB'
}

const STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  pending:    { color: '#f59e0b', bg: 'rgba(245,158,11,.12)',  label: 'Đang chờ' },
  processing: { color: '#60a5fa', bg: 'rgba(96,165,250,.12)',  label: 'Đang xử lý' },
  ready:      { color: '#34d399', bg: 'rgba(52,211,153,.12)',  label: 'Sẵn sàng' },
  failed:     { color: '#f87171', bg: 'rgba(248,113,113,.12)', label: 'Thất bại' },
  expired:    { color: '#9ca3af', bg: 'rgba(156,163,175,.12)', label: 'Hết hạn' },
}

export default function DownloadsPage() {
  const { user } = useAuth()
  const canManage = !!user?.is_staff || user?.client_role === 'admin' || !!user?.perms?.can_manage_cameras

  const { data, isLoading, refetch } = useQuery<{ results: DownloadItem[]; pending_count: number }>({
    queryKey: ['downloads'],
    queryFn: () => getDownloads().then(r => r.data),
    refetchInterval: (q) => ((q.state.data as any)?.pending_count > 0 ? 4000 : false),
  })

  const items = data?.results ?? []
  const renders = items.filter(i => i.kind === 'render')
  const archives = items.filter(i => i.kind === 'archive')

  const del = async (item: DownloadItem) => {
    if (!canManage) return
    if (!confirm(`Xoá "${item.title}"?`)) return
    try {
      if (item.kind === 'render') await deleteRender(item.id)
      else await deleteArchive(item.id)
      refetch()
    } catch { /* ignore */ }
  }

  const Section = ({ title, icon, list, color }: { title: string; icon: React.ReactNode; list: DownloadItem[]; color: string }) => (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ color }}>{icon}</span>
        <h2 style={{ fontSize: '.95rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{title}</h2>
        <span style={{ fontSize: '.72rem', color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: 10 }}>{list.length}</span>
      </div>
      {list.length === 0 ? (
        <div style={{ padding: '1.2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '.8rem', border: '1px dashed var(--border-color)', borderRadius: 10 }}>
          Chưa có mục nào
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.map(item => {
            const st = STATUS_STYLE[item.status] || STATUS_STYLE.pending
            return (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '.7rem .9rem', border: '1px solid var(--border-color)', borderRadius: 10, background: 'var(--bg-secondary)', flexWrap: 'wrap' }}>
                <div style={{ width: 38, height: 38, borderRadius: 9, background: st.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: st.color, flexShrink: 0 }}>
                  {item.kind === 'render' ? <Film size={18} /> : <FolderArchive size={18} />}
                </div>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontSize: '.83rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    <code style={{ color: '#60a5fa', marginRight: 6 }}>{item.camera_code}</code>{item.title}
                  </div>
                  <div style={{ fontSize: '.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    {item.meta}
                    {item.item_count > 0 && <> · {item.item_count} ảnh</>}
                    {item.size_bytes > 0 && <> · <HardDrive size={9} style={{ display: 'inline' }} /> {fmtBytes(item.size_bytes)}</>}
                    {' · '}{new Date(item.created_at).toLocaleString('vi-VN')}
                    {item.expires_at && <span style={{ color: '#f59e0b' }}> · hết hạn {new Date(item.expires_at).toLocaleString('vi-VN')}</span>}
                  </div>
                  {item.error && <div style={{ fontSize: '.7rem', color: '#f87171', marginTop: 2 }}>{item.error}</div>}
                </div>

                {/* Progress bar when processing */}
                {(item.status === 'processing' || item.status === 'pending') && (
                  <div style={{ width: 130 }}>
                    <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                      <div style={{ width: `${item.progress}%`, height: '100%', background: st.color, borderRadius: 3, transition: 'width .5s' }} />
                    </div>
                    <div style={{ fontSize: '.65rem', color: st.color, marginTop: 3, textAlign: 'right' }}>{item.progress}%</div>
                  </div>
                )}

                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '.7rem', fontWeight: 700, color: st.color, background: st.bg, padding: '3px 10px', borderRadius: 12 }}>
                  {item.status === 'ready' ? <CheckCircle2 size={11} /> : item.status === 'failed' ? <XCircle size={11} /> : <Clock size={11} />}
                  {st.label}
                </span>

                {item.download_url && (
                  <a href={item.download_url} className="atl-btn primary" style={{ fontSize: '.75rem', textDecoration: 'none' }}>
                    <Download size={13} style={{ marginRight: 4 }} />Tải về
                  </a>
                )}

                {canManage && (
                  <button onClick={() => del(item)} className="atl-btn ghost" style={{ fontSize: '.75rem', color: '#f87171', padding: '4px 8px' }} title="Xoá">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            Tải về
            {(data?.pending_count ?? 0) > 0 && (
              <span style={{ fontSize: '.72rem', color: '#60a5fa', background: 'rgba(96,165,250,0.12)', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>
                {data!.pending_count} đang xử lý
              </span>
            )}
          </h1>
        </div>
        <button className="atl-btn" style={{ fontSize: '.78rem' }} onClick={() => refetch()}>
          <RefreshCw size={13} style={{ marginRight: 5 }} />Làm mới
        </button>
      </div>

      {isLoading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải…</div>
      ) : (
        <>
          <Section title="Video Timelapse" icon={<Film size={17} />} list={renders} color="#a78bfa" />
          <Section title="Thư mục nén ZIP" icon={<FolderArchive size={17} />} list={archives} color="#22d3ee" />
        </>
      )}
    </div>
  )
}

import React from 'react'
