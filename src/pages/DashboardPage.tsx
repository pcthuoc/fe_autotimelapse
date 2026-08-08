import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getDashboard, getDownloads, getRenders, getStorageStats } from '../api/client'
import type { DashboardData, DownloadItem, VideoRender, Camera as CameraType } from '../api/types'
import CameraLiveModal from '../components/CameraLiveModal'
import {
  Camera as CameraIcon, Wifi, WifiOff, Image as ImageIcon, HardDrive, Building2,
  Film, TrendingUp, Activity, ArrowRight, Zap, FolderArchive, Database, Cloud,
} from 'lucide-react'

function fmtBytes(b: number) {
  if (!b) return '0 B'
  if (b > 1e12) return (b / 1e12).toFixed(2) + ' TB'
  if (b > 1e9) return (b / 1e9).toFixed(2) + ' GB'
  if (b > 1e6) return (b / 1e6).toFixed(1) + ' MB'
  return (b / 1e3).toFixed(0) + ' KB'
}

/* Stat tile với màu riêng — kiểu bambuddy */
function StatTile({ icon, label, value, sub, color, to }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; color: string; to?: string
}) {
  const inner = (
    <div style={{
      border: '1px solid var(--border-color)', borderRadius: 14, padding: '1rem 1.1rem',
      background: 'var(--bg-secondary)', position: 'relative', overflow: 'hidden',
      transition: 'transform .15s, border-color .15s', cursor: to ? 'pointer' : 'default', height: '100%',
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.borderColor = color }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-color)' }}>
      {/* Corner glow */}
      <div style={{ position: 'absolute', top: -30, right: -30, width: 90, height: 90, borderRadius: '50%', background: color, opacity: .08, pointerEvents: 'none' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: `${color}1c`, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </div>
        <span style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-muted)' }}>{label}</span>
      </div>
      <div style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '.72rem', color: 'var(--text-secondary)', marginTop: 5 }}>{sub}</div>}
    </div>
  )
  return to ? <Link to={to} className="no-underline">{inner}</Link> : inner
}

/* Bar chart 7 ngày */
function WeekChart({ days }: { days: { date: string; count: number }[] }) {
  const max = Math.max(1, ...days.map(d => d.count))
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120, padding: '0 4px' }}>
      {days.map((d, i) => {
        const h = Math.max(4, (d.count / max) * 100)
        const isToday = i === days.length - 1
        return (
          <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, height: '100%', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: '.62rem', fontWeight: 700, color: isToday ? '#60a5fa' : 'var(--text-muted)' }}>{d.count}</span>
            <div style={{
              width: '100%', maxWidth: 38, height: `${h}%`, borderRadius: '6px 6px 2px 2px',
              background: isToday
                ? 'linear-gradient(180deg,#60a5fa,#3b82f6)'
                : 'linear-gradient(180deg,rgba(96,165,250,.45),rgba(96,165,250,.18))',
              transition: 'height .4s',
            }} />
            <span style={{ fontSize: '.6rem', color: isToday ? '#60a5fa' : 'var(--text-muted)', fontWeight: isToday ? 700 : 400 }}>{d.date}</span>
          </div>
        )
      })}
    </div>
  )
}

const STATUS_COLOR: Record<string, string> = {
  pending: '#f59e0b', processing: '#60a5fa', ready: '#34d399', failed: '#f87171', expired: '#9ca3af',
}

function StorageTile({ stats }: { stats: any }) {
  const sw = stats?.seaweed ?? {}
  const r2 = stats?.r2 ?? {}
  const usedPct = sw.usage_pct ?? 0
  const barColor = usedPct > 80 ? '#f87171' : usedPct > 60 ? '#f59e0b' : '#34d399'
  const color = '#a78bfa'
  return (
    <div style={{
      border: '1px solid var(--border-color)', borderRadius: 14, padding: '1rem 1.1rem',
      background: 'var(--bg-secondary)', position: 'relative', overflow: 'hidden', height: '100%',
    }}>
      <div style={{ position: 'absolute', top: -30, right: -30, width: 90, height: 90, borderRadius: '50%', background: color, opacity: .08, pointerEvents: 'none' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: `${color}1c`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <HardDrive size={18} />
        </div>
        <span style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-muted)' }}>Storage</span>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        {/* Cột trái: SeaweedFS */}
        <div style={{ flex: 1, borderRight: '1px solid var(--border-color)', paddingRight: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
            <Database size={10} style={{ color }} />
            <span style={{ fontSize: '.65rem', fontWeight: 700, color: 'var(--text-primary)' }}>SeaweedFS</span>
            <span style={{ fontSize: '.58rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>Hot</span>
          </div>
          <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-tertiary)', overflow: 'hidden', marginBottom: 4 }}>
            <div style={{ width: `${Math.min(usedPct, 100)}%`, height: '100%', background: barColor, borderRadius: 2, transition: 'width .6s' }} />
          </div>
          <div style={{ fontSize: '.68rem', fontWeight: 800, color: barColor }}>{usedPct}%</div>
          <div style={{ fontSize: '.62rem', color: 'var(--text-muted)' }}>{fmtBytes(sw.bytes ?? 0)} / 20 GB</div>
          <div style={{ fontSize: '.6rem', color: 'var(--text-muted)', marginTop: 2 }}>{(sw.count ?? 0).toLocaleString('vi-VN')} ảnh</div>
        </div>

        {/* Cột phải: Cloudflare R2 */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
            <Cloud size={10} style={{ color: '#34d399' }} />
            <span style={{ fontSize: '.65rem', fontWeight: 700, color: 'var(--text-primary)' }}>R2</span>
            <span style={{ fontSize: '.58rem', fontWeight: 700, color: r2.enabled ? '#34d399' : '#9ca3af',
              background: r2.enabled ? 'rgba(52,211,153,.12)' : 'rgba(156,163,175,.12)',
              padding: '1px 6px', borderRadius: 6, marginLeft: 'auto' }}>
              {r2.enabled ? '✓' : '✗'}
            </span>
          </div>
          <div style={{ fontSize: '.68rem', fontWeight: 800, color: r2.enabled ? '#34d399' : '#9ca3af' }}>
            {r2.enabled ? 'Active' : 'Disabled'}
          </div>
          <div style={{ fontSize: '.62rem', color: 'var(--text-muted)' }}>{fmtBytes(r2.bytes ?? 0)}</div>
          <div style={{ fontSize: '.6rem', color: 'var(--text-muted)', marginTop: 2 }}>{(r2.count ?? 0).toLocaleString('vi-VN')} ảnh</div>
        </div>
      </div>
    </div>
  )
}

function SiteCardItem({
  sd,
  isSuperadmin,
  onOpenLive,
}: {
  sd: DashboardData['sites_data'][0]
  isSuperadmin: boolean
  onOpenLive: (cam: CameraType) => void
}) {
  const cameras = sd.cameras || []
  const [activeCamId, setActiveCamId] = useState<string>(cameras[0]?.cam?.id || '')
  const [isHovered, setIsHovered] = useState(false)

  const activeCw = cameras.find(c => c.cam.id === activeCamId) || cameras[0]
  const currentThumb = activeCw?.thumb_url || activeCw?.cam?.latest_thumb_url || sd.latest_thumb_url

  return (
    <div
      className="site-card-item"
      style={{
        flex: '0 0 320px',
        maxWidth: 340,
        scrollSnapAlign: 'start',
        border: '1px solid var(--border-color)',
        borderRadius: 14,
        background: 'var(--bg-secondary)',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
        transition: 'transform 0.2s ease, border-color 0.2s ease',
      }}
    >
      {/* ── Top Cover Image with Dynamic Photo Preview & Action Overlay ── */}
      <div
        style={{
          height: 145,
          background: 'var(--bg-primary)',
          position: 'relative',
          overflow: 'hidden',
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {currentThumb ? (
          <img
            src={currentThumb}
            alt={activeCw?.cam?.name || sd.site.name}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transition: 'opacity 0.25s ease, transform 0.35s ease',
              transform: isHovered ? 'scale(1.04)' : 'scale(1)',
            }}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', gap: 6 }}>
            <CameraIcon size={26} style={{ opacity: .2 }} />
            <span style={{ fontSize: '.7rem', opacity: .5 }}>Chưa có dữ liệu ảnh</span>
          </div>
        )}

        {/* Dynamic Header Overlay on Image */}
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            right: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pointerEvents: 'none',
            zIndex: 2,
          }}
        >
          {/* Active Camera code pill */}
          {activeCw ? (
            <span
              style={{
                fontSize: '.65rem',
                fontWeight: 800,
                padding: '3px 9px',
                borderRadius: 7,
                background: 'rgba(0, 0, 0, 0.72)',
                backdropFilter: 'blur(8px)',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: activeCw.online ? '#10b981' : '#ef4444',
                  boxShadow: activeCw.online ? '0 0 6px #10b981' : 'none',
                }}
              />
              {activeCw.cam.code}
            </span>
          ) : <span />}

          {/* Site Online summary badge */}
          <span
            style={{
              fontSize: '.62rem',
              fontWeight: 800,
              padding: '3px 9px',
              borderRadius: 7,
              background: 'rgba(0, 0, 0, 0.72)',
              backdropFilter: 'blur(8px)',
              color: sd.online_count > 0 ? '#34d399' : '#f87171',
              border: `1px solid ${sd.online_count > 0 ? 'rgba(52,211,153,0.35)' : 'rgba(248,113,113,0.35)'}`,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {sd.online_count > 0 ? <Wifi size={10} /> : <WifiOff size={10} />}
            {sd.online_count}/{sd.cam_count} Online
          </span>
        </div>

        {/* Hover Quick Action Buttons on Image */}
        {activeCw && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.25) 60%, transparent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              opacity: isHovered ? 1 : 0,
              pointerEvents: isHovered ? 'auto' : 'none',
              transition: 'opacity 0.25s ease',
              zIndex: 3,
            }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation()
                onOpenLive(activeCw.cam)
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 12px',
                borderRadius: 8,
                background: 'rgba(239, 68, 68, 0.92)',
                color: '#fff',
                fontSize: '.72rem',
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(239, 68, 68, 0.45)',
                transition: 'transform 0.15s ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              <Wifi size={12} /> Xem Live Stream
            </button>
            <Link
              to={`/media/camera/${activeCw.cam.id}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 12px',
                borderRadius: 8,
                background: 'rgba(255, 255, 255, 0.95)',
                color: '#111',
                fontSize: '.72rem',
                fontWeight: 800,
                textDecoration: 'none',
                boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
                transition: 'transform 0.15s ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              <ImageIcon size={12} /> Thư viện
            </Link>
          </div>
        )}
      </div>

      {/* ── Card Content Body ── */}
      <div style={{ padding: '.8rem .95rem' }}>
        {isSuperadmin && sd.site.client_name && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '.62rem', fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,.12)', padding: '1px 7px', borderRadius: 6, marginBottom: 5 }}>
            <Building2 size={9} />{sd.site.client_name}
          </div>
        )}
        <div style={{ fontWeight: 800, fontSize: '.9rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{sd.site.name}</span>
          <Link to={`/cameras?site=${sd.site.id}`} style={{ fontSize: '.7rem', color: '#60a5fa', textDecoration: 'none', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
            Chi tiết <ArrowRight size={11} />
          </Link>
        </div>
        <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
          {sd.cam_count} camera · {sd.today_count} ảnh hôm nay
        </div>

        {/* ── Interactive Camera Chips Switcher ── */}
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: '.62rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.04em' }}>
            Rê chuột / Chọn camera đổi ảnh ({cameras.length}):
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {cameras.map(cw => {
              const isActive = cw.cam.id === (activeCw?.cam?.id || activeCamId)
              return (
                <button
                  key={cw.cam.id}
                  onClick={() => setActiveCamId(cw.cam.id)}
                  onMouseEnter={() => setActiveCamId(cw.cam.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: '.7rem',
                    fontWeight: isActive ? 800 : 600,
                    padding: '3px 9px',
                    borderRadius: 7,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    background: isActive
                      ? cw.online ? 'rgba(52, 211, 153, 0.18)' : 'rgba(239, 68, 68, 0.18)'
                      : 'var(--bg-tertiary)',
                    color: isActive
                      ? cw.online ? 'var(--status-ok)' : '#ef4444'
                      : 'var(--text-secondary)',
                    border: `1px solid ${
                      isActive
                        ? cw.online ? 'rgba(52,211,153,0.5)' : 'rgba(239,68,68,0.5)'
                        : 'var(--border-color)'
                    }`,
                    boxShadow: isActive ? `0 0 10px ${cw.online ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}` : 'none',
                  }}
                  title={`Rê chuột / Bấm để đổi xem ảnh camera ${cw.cam.code}`}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: cw.online ? 'var(--status-ok)' : '#ef4444',
                      boxShadow: cw.online ? '0 0 6px var(--status-ok)' : 'none',
                    }}
                  />
                  {cw.cam.code}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [liveCam, setLiveCam] = useState<CameraType | null>(null)
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => getDashboard().then(r => r.data),
    refetchInterval: 60000,
    staleTime: 30000,
  })
  const { data: dls } = useQuery<{ results: DownloadItem[]; pending_count: number }>({
    queryKey: ['downloads'],
    queryFn: () => getDownloads().then(r => r.data),
  })
  const { data: rendersData } = useQuery<{ results: VideoRender[] }>({
    queryKey: ['renders'],
    queryFn: () => getRenders().then(r => r.data),
  })
  const { data: storageStats } = useQuery({
    queryKey: ['storage-stats'],
    queryFn: () => getStorageStats().then(r => r.data),
    refetchInterval: 120000,
    staleTime: 60000,
    enabled: data?.role === 'superadmin',
  })

  if (isLoading) return <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải…</div>

  const d = data
  const recentDownloads = (dls?.results ?? []).slice(0, 5)
  const recentRenders = (rendersData?.results ?? []).slice(0, 6)
  const offlineCount = (d?.total_cameras ?? 0) - (d?.online_count ?? 0)

  // Công trình cập nhật gần đây nhất (nhiều ảnh hôm nay lên đầu), chỉ hiện tối đa 8
  const sitesRecent = [...(d?.sites_data ?? [])]
    .sort((a, b) => (b.today_count || 0) - (a.today_count || 0))
    .slice(0, 8)

  const role = d?.role ?? null
  const isSuperadmin = role === 'superadmin'
  const isAdmin = role === 'admin'
  const isMember = role === 'member'
  const canManageClients = isSuperadmin || isAdmin

  // Tiêu đề + phụ đề theo tầng quyền
  const headerTitle = isSuperadmin ? 'Tổng quan hệ thống'
    : isAdmin ? (d?.client_name || 'Bảng điều khiển')
    : 'Bảng điều khiển'
  const headerSub = isSuperadmin ? 'Quản trị tổng thể hệ thống'
    : isAdmin ? `Quản trị khách hàng · ${d?.client_name ?? ''}`
    : (d?.client_name ? `Khách hàng: ${d.client_name}` : 'Camera timelapse của bạn')

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Activity size={22} style={{ color: '#60a5fa' }} />{headerTitle}
        </h1>
        <p style={{ fontSize: '.78rem', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
          {headerSub} — {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Stats row — thay đổi theo tầng quyền */}
      <div className="dash-stats-grid">
        {isSuperadmin && (
          <StatTile icon={<Building2 size={18} />} label="Khách hàng" value={d?.total_clients ?? 0}
                    sub={`${d?.total_sites ?? 0} công trình`} color="#f59e0b" to="/clients" />
        )}
        {isAdmin && (
          <StatTile icon={<Building2 size={18} />} label="Thành viên" value={d?.total_members ?? 0}
                    sub={`${d?.total_sites ?? 0} công trình`} color="#f59e0b" to="/clients" />
        )}
        <StatTile icon={<CameraIcon size={18} />} label="Camera" value={d?.total_cameras ?? 0}
                  sub={`${d?.total_sites ?? 0} công trình`} color="#34d399" to="/cameras" />
        <StatTile icon={<Wifi size={18} />} label="Online" value={d?.online_count ?? 0}
                  sub={offlineCount > 0 ? `${offlineCount} offline` : 'Tất cả hoạt động'} color="#60a5fa" to="/cameras" />
        <StatTile icon={<ImageIcon size={18} />} label="Ảnh hôm nay" value={d?.today_photos ?? 0}
                  sub={`${(d?.total_photos ?? 0).toLocaleString('vi-VN')} ảnh tổng`} color="#f59e0b" />
        {!isMember && !(isSuperadmin && storageStats) && (
          <StatTile icon={<HardDrive size={18} />} label="Dung lượng" value={fmtBytes(d?.total_bytes ?? 0)}
                    sub="Lưu trữ Object" color="#a78bfa" />
        )}
        {isSuperadmin && storageStats && <StorageTile stats={storageStats} />}
        <StatTile icon={<Film size={18} />} label="Video Render" value={rendersData?.results?.length ?? 0}
                  sub={(dls?.pending_count ?? 0) > 0 ? `${dls!.pending_count} đang xử lý` : 'Video timelapse'} color="#f472b6" to="/renders" />
      </div>

      {/* Middle: chart + downloads */}
      <div className="dash-middle-grid">
        {/* Weekly chart */}
        <div style={{ border: '1px solid var(--border-color)', borderRadius: 14, background: 'var(--bg-secondary)', padding: '1rem 1.1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <TrendingUp size={16} style={{ color: '#60a5fa' }} />
            <span style={{ fontSize: '.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>Ảnh chụp 7 ngày qua</span>
          </div>
          <WeekChart days={d?.days_7 ?? []} />
        </div>

        {/* Recent downloads/notifications */}
        <div style={{ border: '1px solid var(--border-color)', borderRadius: 14, background: 'var(--bg-secondary)', padding: '1rem 1.1rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap size={15} style={{ color: '#22d3ee' }} />
              <span style={{ fontSize: '.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>Hoạt động gần đây</span>
            </div>
            <Link to="/downloads" style={{ fontSize: '.7rem', color: '#60a5fa', textDecoration: 'none', fontWeight: 700 }}>
              Tất cả <ArrowRight size={10} style={{ display: 'inline' }} />
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
            {recentDownloads.length === 0 && (
              <div style={{ fontSize: '.75rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem 0' }}>Chưa có hoạt động</div>
            )}
            {recentDownloads.map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.73rem' }}>
                <span style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, background: `${STATUS_COLOR[item.status]}1a`, color: STATUS_COLOR[item.status], display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {item.kind === 'render' ? <Film size={12} /> : <FolderArchive size={12} />}
                </span>
                <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow:'ellipsis' }}>
                    {item.camera_code} · {item.title}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '.65rem' }}>{new Date(item.created_at).toLocaleString('vi-VN')}</div>
                </div>
                <span style={{ fontSize: '.62rem', fontWeight: 700, color: STATUS_COLOR[item.status] }}>
                  {item.status === 'processing' ? `${item.progress}%` : item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sites overview */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Building2 size={16} style={{ color: '#f59e0b' }} />
        <span style={{ fontSize: '.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>
          {isMember ? 'Công trình của bạn' : 'Công trình'}
        </span>
        {canManageClients && (
          <Link to="/clients" style={{ fontSize: '.7rem', color: '#60a5fa', textDecoration: 'none', fontWeight: 700, marginLeft: 'auto' }}>
            Quản lý clients <ArrowRight size={10} style={{ display: 'inline' }} />
          </Link>
        )}
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, overflowX: 'auto', paddingBottom: 6, scrollSnapType: 'x proximity' }}>
        {sitesRecent.map(sd => (
          <SiteCardItem
            key={sd.site.id}
            sd={sd}
            isSuperadmin={isSuperadmin}
            onOpenLive={(cam) => setLiveCam(cam)}
          />
        ))}
        {(d?.sites_data ?? []).length === 0 && (
          <div style={{ flex: 1, padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: 13 }}>
            Chưa có công trình nào — camera chưa được gán site
          </div>
        )}
      </div>

      {/* Live Stream Popup Theater Modal */}
      {liveCam && (
        <CameraLiveModal
          camId={liveCam.id}
          initialCam={liveCam}
          onClose={() => setLiveCam(null)}
        />
      )}

      {/* Recent renders strip */}
      {recentRenders.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Film size={16} style={{ color: '#a78bfa' }} />
            <span style={{ fontSize: '.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>Video renders gần đây</span>
            <Link to="/renders" style={{ fontSize: '.7rem', color: '#60a5fa', textDecoration: 'none', fontWeight: 700, marginLeft: 'auto' }}>
              Tất cả <ArrowRight size={10} style={{ display: 'inline' }} />
            </Link>
          </div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6, scrollSnapType: 'x proximity' }}>
            {recentRenders.map(r => (
              <div key={r.id} style={{ flex: '0 0 240px', maxWidth: 260, scrollSnapAlign: 'start', display: 'flex', alignItems: 'center', gap: 9, padding: '.6rem .8rem', border: '1px solid var(--border-color)', borderRadius: 10, background: 'var(--bg-secondary)' }}>
                <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: `${STATUS_COLOR[r.status]}1a`, color: STATUS_COLOR[r.status], display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Film size={14} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '.73rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.camera_code} · {r.date_from}→{r.date_to}
                  </div>
                  <div style={{ fontSize: '.64rem', color: STATUS_COLOR[r.status], fontWeight: 700 }}>
                    {r.status}{r.status === 'processing' && ` ${r.progress}%`}
                  </div>
                </div>
                {r.download_url && (
                  <a href={r.download_url} className="atl-btn ghost" style={{ padding: '4px 7px' }} title="Tải video">
                    <ArrowRight size={13} />
                  </a>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
