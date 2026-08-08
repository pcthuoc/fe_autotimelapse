import { AlertTriangle, X } from 'lucide-react'

interface ConfirmModalProps {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
  isPending?: boolean
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmModal({
  title,
  message,
  confirmText = 'Xác nhận xóa',
  cancelText = 'Hủy',
  danger = true,
  isPending = false,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  return (
    <div className="modal-overlay" style={{ zIndex: 10050 }} onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 440, borderRadius: 16 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, fontSize: '1rem', color: danger ? '#ef4444' : 'var(--text-primary)' }}>
            <AlertTriangle size={20} style={{ color: danger ? '#ef4444' : '#f59e0b', flexShrink: 0 }} />
            {title}
          </div>
          <button onClick={onClose} className="atl-btn ghost" style={{ padding: '4px 6px' }} title="Đóng">
            <X size={16} />
          </button>
        </div>
        <div className="modal-body" style={{ padding: '1.25rem', fontSize: '.88rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
          {message}
        </div>
        <div className="modal-footer" style={{ padding: '1rem 1.25rem', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="atl-btn" onClick={onClose} disabled={isPending}>
            {cancelText}
          </button>
          <button
            className={`atl-btn ${danger ? 'danger' : 'primary'}`}
            style={danger ? { background: '#ef4444', color: '#fff', border: '1px solid rgba(239, 68, 68, 0.4)', fontWeight: 700 } : {}}
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? 'Đang xử lý…' : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmModal
