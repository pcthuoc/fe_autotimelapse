import { useQuery } from '@tanstack/react-query'
import { getAlertSettings, saveAlertSettings } from '../api/client'
import type { AlertSettings } from '../api/types'
import { useState, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  Bell, BellOff, AlertTriangle, Search, X, Building2, Camera as CameraIcon,
  CheckCircle2, Mail, BatteryLow, Wifi, Thermometer, Image as ImageIcon, Clock,
} from 'lucide-react'

const FIELDS = [
  { field: 'battery_low_pct',       label: 'Pin thấp (%)',        min: 0,    max: 100,  icon: BatteryLow,  suffix: '%' },
  { field: 'battery_critical_pct',  label: 'Pin nguy hiểm (%)',   min: 0,    max: 100,  icon: BatteryLow,  suffix: '%' },
  { field: 'signal_weak_dbm',       label: 'Tín hiệu yếu (dBm)',  min: -120, max: 0,    icon: Wifi,        suffix: 'dBm' },
  { field: 'offline_minutes',       label: 'Offline (phút)',      min: 1,    max: 9999, icon: Clock,       suffix: 'phút' },
  { field: 'temperature_high_c',    label: 'Nhiệt độ cao (°C)',   min: 0,    max: 100,  icon: Thermometer, suffix: '°C' },
  { field: 'daily_photo_min',       label: 'Tối thiểu ảnh/ngày',  min: 0,    max: 9999, icon: ImageIcon,   suffix: 'ảnh' },
] as const

export default function AlertSettingsPage() {
  const { user } = useAuth()
  const canManage = !!user?.is_staff || user?.client_role === 'admin'
  const { data, isLoading, refetch } = useQuery<AlertSettings[]>({
    queryKey: ['alertSettings'],
    queryFn: () => getAlertSettings().then((r) => r.data),
  })

  const [q, setQ] = useState('')
  const [siteF, setSiteF] = useState('')
  const [statusF, setStatusF] = useState<'' | 'on' | 'off'>('')
  const [editing, setEditing] = useState<AlertSettings | null>(null)

  const settings = data ?? []

  const sites = useMemo(() => {
    const set = new Map<string, string>()
    settings.forEach(s => { if (s.site_name) set.set(s.site_name, s.site_name) })
    return Array.from(set.keys())
  }, [settings])

  const configuredCount = settings.filter(s => s.enabled).length
  const unconfiguredCount = settings.length - configuredCount

  const filtered = settings.filter(s => {
    const text = `${s.camera_name} ${s.camera_code} ${s.site_name}`.toLowerCase()
    if (q && !text.includes(q.toLowerCase())) return false
    if (siteF && s.site_name !== siteF) return false
    if (statusF === 'on' && !s.enabled) return false
    if (statusF === 'off' && s.enabled) return false
    return true
  })

  return (
    <div>
      {/* ── Header + stats ── */}
      <div style={{ marginBottom: 16 }}>
        <h1 className="page-title">Cài đặt cảnh báo</h1>
        <p style={{ fontSize: '.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
          Chọn camera để cấu hình ngưỡng cảnh báo pin / tín hiệu / offline / nhiệt độ
        </p>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <StatChip icon={<CameraIcon size={15} />} label="Tổng camera" value={settings.length} color="var(--text-secondary)" />
        <StatChip icon={<CheckCircle2 size={15} />} label="Đã bật cảnh báo" value={configuredCount} color="#34d399" />
        <StatChip icon={<AlertTriangle size={15} />} label="Chưa cấu hình" value={unconfiguredCount} color="#fbbf24" />
      </div>

      {/* ── Filter bar ── */}
      <div className="atl-card" style={{ padding: '.6rem .875rem', marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 7, padding: '.35rem .75rem', flex: 1, minWidth: 150 }}>
          <Search size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm camera, mã, công trình…"
                 style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: '.825rem', flex: 1, minWidth: 0 }} />
          {q && <button onClick={() => setQ('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={12} /></button>}
        </div>
        <select value={siteF} onChange={e => setSiteF(e.target.value)} className="atl-select" style={{ width: 'auto', minWidth: 150 }}>
          <option value="">Tất cả công trình</option>
          {sites.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={statusF} onChange={e => setStatusF(e.target.value as any)} className="atl-select" style={{ width: 'auto', minWidth: 150 }}>
          <option value="">Tất cả trạng thái</option>
          <option value="on">Đã bật cảnh báo</option>
          <option value="off">Chưa cấu hình</option>
        </select>
      </div>

      {isLoading && <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải…</div>}
      {!isLoading && filtered.length === 0 && (
        <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <CameraIcon size={40} style={{ opacity: .15, marginBottom: 10 }} />
          <div>Không có camera phù hợp</div>
        </div>
      )}

      {/* ── Grid camera cards ── */}
      {!isLoading && filtered.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: '1rem' }}>
          {filtered.map(s => (
            <CameraAlertCard key={s.camera_id} s={s} onClick={() => setEditing(s)} />
          ))}
        </div>
      )}

      {editing && (
        <ConfigModal
          s={editing}
          canManage={canManage}
          onClose={() => setEditing(null)}
          onSaved={() => { refetch(); setEditing(null) }}
        />
      )}
    </div>
  )
}

/* ── Stat chip ── */
function StatChip({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="atl-card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '.6rem .9rem', flex: '0 1 auto' }}>
      <div style={{ color, display: 'flex' }}>{icon}</div>
      <div>
        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: '.68rem', color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
      </div>
    </div>
  )
}

/* ── Camera card với badge trạng thái ── */
function CameraAlertCard({ s, onClick }: { s: AlertSettings; onClick: () => void }) {
  const on = s.enabled
  return (
    <button onClick={onClick}
            style={{ textAlign: 'left', cursor: 'pointer', padding: 0, border: `1px solid ${on ? 'rgba(52,211,153,.4)' : 'var(--border-color)'}`,
                     borderRadius: 12, background: 'var(--bg-secondary)', overflow: 'hidden', transition: 'all .12s' }}>
      {/* Icon area */}
      <div style={{ position: 'relative', height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: on ? 'rgba(52,211,153,.07)' : 'rgba(251,191,36,.06)' }}>
        {on ? <Bell size={32} style={{ color: '#34d399' }} /> : <BellOff size={32} style={{ color: '#fbbf24', opacity: .8 }} />}
        {/* Badge trạng thái */}
        <span style={{ position: 'absolute', top: 8, right: 8, fontSize: '.62rem', fontWeight: 700, padding: '2px 7px', borderRadius: 6,
                       display: 'inline-flex', alignItems: 'center', gap: 3,
                       background: on ? 'rgba(52,211,153,.9)' : 'rgba(251,191,36,.9)', color: '#0a0a0a' }}>
          {on ? <><CheckCircle2 size={10} />Đã bật</> : <><AlertTriangle size={10} />Chưa</>}
        </span>
      </div>
      {/* Info */}
      <div style={{ padding: '.7rem .8rem' }}>
        <div style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
             title={s.camera_name}>
          {s.camera_name || s.camera_code}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
          {s.camera_code && (
            <span style={{ fontSize: '.65rem', padding: '1px 6px', borderRadius: 5, background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
              {s.camera_code}
            </span>
          )}
          {s.site_name && (
            <span style={{ fontSize: '.68rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <Building2 size={10} />{s.site_name}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

/* ── Modal cấu hình ── */
function ConfigModal({ s, canManage, onClose, onSaved }: {
  s: AlertSettings; canManage: boolean; onClose: () => void; onSaved: () => void
}) {
  const [form, setForm] = useState<AlertSettings>({ ...s })
  const [saving, setSaving] = useState(false)
  const upd = (field: string, val: unknown) => setForm(f => ({ ...f, [field]: val }))

  const save = async () => {
    setSaving(true)
    try {
      await saveAlertSettings(s.camera_id, {
        enabled: form.enabled,
        battery_low_pct: form.battery_low_pct,
        battery_critical_pct: form.battery_critical_pct,
        signal_weak_dbm: form.signal_weak_dbm,
        offline_minutes: form.offline_minutes,
        temperature_high_c: form.temperature_high_c,
        daily_photo_min: form.daily_photo_min,
        notify_email: form.notify_email,
      })
      onSaved()
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <Bell size={16} style={{ color: form.enabled ? '#34d399' : 'var(--text-muted)', flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {s.camera_name || s.camera_code}
            </span>
            {s.camera_code && (
              <span style={{ fontSize: '.65rem', padding: '1px 6px', borderRadius: 5, background: 'var(--bg-tertiary)', color: 'var(--text-muted)', flexShrink: 0 }}>
                {s.camera_code}
              </span>
            )}
          </span>
          <button className="atl-btn ghost" style={{ padding: '4px 8px', marginLeft: 'auto' }} onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Bật/tắt */}
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.7rem .9rem', borderRadius: 9,
                          background: form.enabled ? 'rgba(52,211,153,.08)' : 'var(--bg-primary)', border: '1px solid var(--border-color)', cursor: canManage ? 'pointer' : 'default' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {form.enabled ? <Bell size={15} style={{ color: '#34d399' }} /> : <BellOff size={15} style={{ color: 'var(--text-muted)' }} />}
              Bật cảnh báo cho camera này
            </span>
            <input type="checkbox" checked={!!form.enabled} disabled={!canManage}
                   onChange={e => upd('enabled', e.target.checked)}
                   style={{ accentColor: 'var(--accent)', width: 18, height: 18 }} />
          </label>

          {/* Ngưỡng */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
            {FIELDS.map(({ field, label, min, max, icon: Icon, suffix }) => (
              <div key={field}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '.72rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  <Icon size={12} style={{ color: 'var(--text-muted)' }} />{label}
                </label>
                <div style={{ position: 'relative' }}>
                  <input type="number" min={min} max={max} disabled={!canManage}
                         value={(form as unknown as Record<string, unknown>)[field] as number ?? 0}
                         onChange={e => upd(field, Number(e.target.value))}
                         className="atl-input" style={{ width: '100%', paddingRight: 44 }} />
                  <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: '.68rem', color: 'var(--text-muted)', pointerEvents: 'none' }}>{suffix}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Email */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '.72rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
              <Mail size={12} style={{ color: 'var(--text-muted)' }} />Email nhận thông báo
            </label>
            <input type="email" value={form.notify_email ?? ''} disabled={!canManage}
                   onChange={e => upd('notify_email', e.target.value)} placeholder="email@congty.vn"
                   className="atl-input" style={{ width: '100%' }} />
          </div>

          {canManage && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 2 }}>
              <button className="atl-btn" onClick={onClose}>Huỷ</button>
              <button className="atl-btn primary" disabled={saving} onClick={save}>{saving ? 'Đang lưu…' : 'Lưu cấu hình'}</button>
            </div>
          )}
          {!canManage && (
            <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', textAlign: 'center' }}>Bạn chỉ có quyền xem.</div>
          )}
        </div>
      </div>
    </div>
  )
}
