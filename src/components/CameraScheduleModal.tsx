import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCameraSchedules, createCameraSchedule, updateCameraSchedule, deleteCameraSchedule } from '../api/client'
import type { Camera, CameraScheduleRule } from '../api/types'
import { X, Clock, Plus, Trash2, Edit2, Check, Calendar, Power } from 'lucide-react'

interface CameraScheduleModalProps {
  camera: Camera
  onClose: () => void
  canManage?: boolean
}

const WEEK_DAYS = [
  { id: 1, label: 'T2' },
  { id: 2, label: 'T3' },
  { id: 3, label: 'T4' },
  { id: 4, label: 'T5' },
  { id: 5, label: 'T6' },
  { id: 6, label: 'T7' },
  { id: 7, label: 'CN' },
]

function fmtInterval(sec: number) {
  if (sec < 60) return `${sec} giây`
  if (sec % 3600 === 0) return `${sec / 3600} giờ`
  if (sec % 60 === 0) return `${sec / 60} phút`
  return `${sec} giây`
}

export default function CameraScheduleModal({ camera, onClose, canManage = true }: CameraScheduleModalProps) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingRule, setEditingRule] = useState<CameraScheduleRule | null>(null)

  // Form State
  const [name, setName] = useState('Ca sáng')
  const [startTime, setStartTime] = useState('07:00')
  const [endTime, setEndTime] = useState('17:00')
  const [intervalSec, setIntervalSec] = useState(300)
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7])

  const { data, isLoading } = useQuery<{ results: CameraScheduleRule[] }>({
    queryKey: ['schedules', camera.id],
    queryFn: () => getCameraSchedules(camera.id).then((r) => r.data),
  })

  const schedules = data?.results || []

  const createMut = useMutation({
    mutationFn: (newSchedule: Record<string, unknown>) => createCameraSchedule(camera.id, newSchedule),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedules', camera.id] })
      resetForm()
    },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => updateCameraSchedule(camera.id, id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedules', camera.id] })
      resetForm()
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteCameraSchedule(camera.id, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedules', camera.id] })
    },
  })

  const resetForm = () => {
    setShowForm(false)
    setEditingRule(null)
    setName('Ca sáng')
    setStartTime('07:00')
    setEndTime('17:00')
    setIntervalSec(300)
    setSelectedDays([1, 2, 3, 4, 5, 6, 7])
  }

  const startEdit = (rule: CameraScheduleRule) => {
    setEditingRule(rule)
    setName(rule.name)
    setStartTime(rule.start_time)
    setEndTime(rule.end_time)
    setIntervalSec(rule.interval_sec)
    setSelectedDays(rule.days_of_week || [1, 2, 3, 4, 5, 6, 7])
    setShowForm(true)
  }

  const toggleDay = (dayId: number) => {
    if (selectedDays.includes(dayId)) {
      if (selectedDays.length === 1) return // Giữ ít nhất 1 ngày
      setSelectedDays(selectedDays.filter((d) => d !== dayId))
    } else {
      setSelectedDays([...selectedDays, dayId].sort())
    }
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      name,
      start_time: startTime,
      end_time: endTime,
      interval_sec: Number(intervalSec),
      days_of_week: selectedDays,
      is_enabled: editingRule ? editingRule.is_enabled : true,
    }

    if (editingRule) {
      updateMut.mutate({ id: editingRule.id, data: payload })
    } else {
      createMut.mutate(payload)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 620,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 16,
          boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          color: 'var(--text-primary)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-tertiary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Clock size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
                Lịch hẹn giờ chụp ảnh {!canManage && <span style={{ fontSize: '.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>(Chế độ xem)</span>}
              </h3>
              <span style={{ fontSize: '.72rem', color: 'var(--text-muted)' }}>
                {camera.name} ({camera.code})
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-muted)',
              borderRadius: 8,
              padding: '6px',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body Container */}
        <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Top Bar Actions */}
          {!showForm && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                {schedules.length} khung giờ cài đặt
              </span>
              {canManage && (
                <button
                  onClick={() => {
                    setEditingRule(null)
                    setShowForm(true)
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 14px',
                    borderRadius: 8,
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    color: '#fff',
                    border: 'none',
                    fontSize: '.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <Plus size={15} /> Thêm khung giờ
                </button>
              )}
            </div>
          )}

          {/* Form Create / Edit */}
          {showForm && (
            <form
              onSubmit={handleSave}
              style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--accent-muted)',
                borderRadius: 12,
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                animation: 'fadeIn 0.2s ease-out',
              }}
            >
              <div style={{ fontWeight: 800, fontSize: '.9rem', color: 'var(--accent-light)', display: 'flex', alignItems: 'center', gap: 6 }}>
                {editingRule ? <Edit2 size={15} /> : <Plus size={15} />}
                {editingRule ? 'Chỉnh sửa khung giờ' : 'Thêm khung giờ mới'}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 700 }}>
                    Tên khung giờ
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="v.d. Ca sáng, Ca chiều"
                    className="atl-input"
                    style={{ width: '100%', fontSize: '.8rem' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 700 }}>
                    Chu kỳ chụp
                  </label>
                  <select
                    value={intervalSec}
                    onChange={(e) => setIntervalSec(Number(e.target.value))}
                    className="atl-input"
                    style={{ width: '100%', fontSize: '.8rem' }}
                  >
                    <option value={60}>1 phút / 1 ảnh</option>
                    <option value={180}>3 phút / 1 ảnh</option>
                    <option value={300}>5 phút / 1 ảnh (Chuẩn)</option>
                    <option value={600}>10 phút / 1 ảnh</option>
                    <option value={900}>15 phút / 1 ảnh</option>
                    <option value={1800}>30 phút / 1 ảnh</option>
                    <option value={3600}>60 phút / 1 ảnh</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 700 }}>
                    Giờ bắt đầu
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                    className="atl-input"
                    style={{ width: '100%', fontSize: '.85rem', fontWeight: 700 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 700 }}>
                    Giờ kết thúc
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                    className="atl-input"
                    style={{ width: '100%', fontSize: '.85rem', fontWeight: 700 }}
                  />
                </div>
              </div>

              {/* Day selection */}
              <div>
                <label style={{ fontSize: '.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6, fontWeight: 700 }}>
                  Áp dụng các ngày trong tuần
                </label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {WEEK_DAYS.map((day) => {
                    const active = selectedDays.includes(day.id)
                    return (
                      <button
                        key={day.id}
                        type="button"
                        onClick={() => toggleDay(day.id)}
                        style={{
                          width: 34,
                          height: 32,
                          borderRadius: 8,
                          fontSize: '.75rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          border: active ? '1px solid #10b981' : '1px solid var(--border-color)',
                          background: active ? 'rgba(16, 185, 129, 0.2)' : 'var(--bg-tertiary)',
                          color: active ? '#10b981' : 'var(--text-muted)',
                        }}
                      >
                        {day.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Form Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={resetForm}
                  className="atl-btn ghost"
                  style={{ fontSize: '.78rem' }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={createMut.isPending || updateMut.isPending}
                  className="atl-btn primary"
                  style={{ fontSize: '.78rem', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                >
                  <Check size={14} /> {editingRule ? 'Lưu cập nhật' : 'Thêm khung giờ'}
                </button>
              </div>
            </form>
          )}

          {/* Schedule List */}
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '.85rem' }}>
              Đang tải danh sách lịch chụp…
            </div>
          ) : schedules.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '2.5rem 1rem',
                background: 'var(--bg-primary)',
                border: '1px dashed var(--border-color)',
                borderRadius: 12,
                color: 'var(--text-muted)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Calendar size={32} opacity={0.4} />
              <div style={{ fontSize: '.85rem', fontWeight: 600 }}>Chưa có khung giờ chụp nào được cài đặt</div>
              <div style={{ fontSize: '.75rem' }}>Bấm nút "Thêm khung giờ" ở trên để lên lịch chụp cho trạm camera này.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {schedules.map((rule) => (
                <div
                  key={rule.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '.85rem 1rem',
                    background: 'var(--bg-primary)',
                    border: `1px solid ${rule.is_enabled ? 'var(--border-color)' : 'rgba(255,255,255,0.05)'}`,
                    borderRadius: 12,
                    opacity: rule.is_enabled ? 1 : 0.6,
                    gap: 12,
                  }}
                >
                  {/* Left info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                    <button
                      disabled={!canManage}
                      onClick={() => canManage && updateMut.mutate({ id: rule.id, data: { is_enabled: !rule.is_enabled } })}
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        border: rule.is_enabled ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-color)',
                        background: rule.is_enabled ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-tertiary)',
                        color: rule.is_enabled ? '#10b981' : 'var(--text-muted)',
                        cursor: canManage ? 'pointer' : 'default',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                      title={!canManage ? (rule.is_enabled ? 'Đang bật' : 'Đang tắt') : (rule.is_enabled ? 'Đang bật — Bấm để tắt' : 'Đang tắt — Bấm để bật')}
                    >
                      <Power size={18} />
                    </button>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 800, fontSize: '.9rem' }}>{rule.name}</span>
                        <span
                          style={{
                            fontSize: '.68rem',
                            fontWeight: 700,
                            padding: '2px 7px',
                            borderRadius: 6,
                            background: 'rgba(59, 130, 246, 0.15)',
                            color: '#60a5fa',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                          }}
                        >
                          Chụp mỗi {fmtInterval(rule.interval_sec)}
                        </span>
                      </div>

                      <div style={{ fontSize: '.78rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          {rule.start_time} ➔ {rule.end_time}
                        </span>
                      </div>

                      {/* Days of week pills */}
                      <div style={{ display: 'flex', gap: 3, marginTop: 3 }}>
                        {WEEK_DAYS.map((d) => {
                          const active = (rule.days_of_week || [1, 2, 3, 4, 5, 6, 7]).includes(d.id)
                          return (
                            <span
                              key={d.id}
                              style={{
                                fontSize: '.6rem',
                                fontWeight: 800,
                                padding: '1px 5px',
                                borderRadius: 4,
                                background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
                                color: active ? 'var(--text-primary)' : 'rgba(255,255,255,0.2)',
                              }}
                            >
                              {d.label}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Actions (Admin only) */}
                  {canManage && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        onClick={() => startEdit(rule)}
                        style={{
                          background: 'var(--bg-tertiary)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-primary)',
                          borderRadius: 8,
                          padding: '6px 8px',
                          cursor: 'pointer',
                        }}
                        title="Chỉnh sửa"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Xóa khung giờ "${rule.name}"?`)) {
                            deleteMut.mutate(rule.id)
                          }
                        }}
                        style={{
                          background: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          color: '#ef4444',
                          borderRadius: 8,
                          padding: '6px 8px',
                          cursor: 'pointer',
                        }}
                        title="Xóa"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
