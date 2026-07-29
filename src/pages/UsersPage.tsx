import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getUsers, createUser, toggleUser, getRoles, updateUser } from '../api/client'
import type { User, Role } from '../api/types'
import { UserCheck, UserX, Plus, X, Shield, User as UserIcon, Pencil } from 'lucide-react'

const EMPTY = { username: '', password: '', email: '', full_name: '', is_staff: false, role_id: '' }

export default function UsersPage() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')

  const [editUser, setEditUser] = useState<User | null>(null)
  const [editForm, setEditForm] = useState({ email: '', full_name: '', is_staff: false, password: '', role_id: '' })

  const { data, isLoading, refetch } = useQuery<{ results: User[] }>({
    queryKey: ['users', q],
    queryFn: () => getUsers(q ? { q } : undefined).then((r) => r.data),
  })
  const { data: rolesData } = useQuery<{ results: Role[] }>({
    queryKey: ['roles'],
    queryFn: () => getRoles().then(r => r.data),
  })

  const users = data?.results ?? []
  const roles = rolesData?.results ?? []

  const handleToggle = async (pk: number) => {
    await toggleUser(String(pk))
    refetch()
  }

  const save = async () => {
    if (!form.username.trim() || !form.password) { setError('Username và password là bắt buộc'); return }
    if (form.password.length < 8) { setError('Password tối thiểu 8 ký tự'); return }
    setSaving(true); setError('')
    try {
      await createUser(form as any)
      qc.invalidateQueries({ queryKey: ['users'] })
      setModal(false); setForm(EMPTY)
    } catch (e: any) { setError(e?.response?.data?.detail || 'Lỗi khi tạo user') }
    setSaving(false)
  }

  const openEdit = (u: User) => {
    setEditUser(u)
    setEditForm({
      email: u.email || '',
      full_name: u.full_name || '',
      is_staff: u.is_staff,
      password: '',
      role_id: (u.roles ?? [])[0]?.id || '',
    })
    setError('')
  }

  const saveEdit = async () => {
    if (!editUser) return
    if (editForm.password && editForm.password.length < 8) { setError('Password tối thiểu 8 ký tự'); return }
    setSaving(true); setError('')
    try {
      const payload: Record<string, unknown> = {
        email: editForm.email,
        full_name: editForm.full_name,
        is_staff: editForm.is_staff,
        role_id: editForm.role_id,
      }
      if (editForm.password) payload.password = editForm.password
      await updateUser(String(editUser.id), payload)
      qc.invalidateQueries({ queryKey: ['users'] })
      setEditUser(null)
    } catch (e: any) { setError(e?.response?.data?.detail || 'Lỗi khi lưu') }
    setSaving(false)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Users</h1>
          <p style={{ fontSize: '.78rem', color: 'var(--text-secondary)', margin: '4px 0 0' }}>Quản lý tài khoản và vai trò</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="atl-input" placeholder="Tìm username/email…" value={q} onChange={e => setQ(e.target.value)} style={{ width: 200 }} />
          <button className="atl-btn primary" style={{ fontSize: '.8rem' }} onClick={() => { setForm(EMPTY); setError(''); setModal(true) }}>
            <Plus size={14} style={{ marginRight: 5 }} />Thêm user
          </button>
        </div>
      </div>

      <div style={{ border: '1px solid var(--border-color)', borderRadius: 12, background: 'var(--bg-secondary)', overflow: 'hidden' }}>
        {isLoading && <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải…</div>}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: '.82rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}>
                {['User', 'Email', 'Vai trò', 'Quyền', 'Trạng thái', ''].map(h => (
                  <th key={h} style={{ padding: '.65rem .9rem', textAlign: 'left', fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-secondary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '.6rem .9rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <div style={{ width: 30, height: 30, borderRadius: '50%', background: u.is_staff ? 'rgba(244,114,182,.15)' : 'var(--bg-tertiary)', color: u.is_staff ? '#f472b6' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {u.is_staff ? <Shield size={13} /> : <UserIcon size={13} />}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{u.username}</div>
                        {u.full_name && <div style={{ fontSize: '.68rem', color: 'var(--text-muted)' }}>{u.full_name}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '.6rem .9rem', color: 'var(--text-secondary)' }}>{u.email || '—'}</td>
                  <td style={{ padding: '.6rem .9rem' }}>
                    {(u.roles ?? []).length === 0 ? <span style={{ color: 'var(--text-muted)' }}>—</span> : (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {(u.roles ?? []).map(r => (
                          <span key={r.id} style={{ fontSize: '.66rem', padding: '2px 8px', borderRadius: 8, background: 'rgba(96,165,250,.12)', color: '#60a5fa', fontWeight: 600 }}>{r.name}</span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '.6rem .9rem' }}>
                    {u.is_staff
                      ? <span style={{ fontSize: '.68rem', fontWeight: 700, color: '#f472b6' }}>Admin</span>
                      : <span style={{ fontSize: '.68rem', color: 'var(--text-muted)' }}>User</span>}
                  </td>
                  <td style={{ padding: '.6rem .9rem' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '.7rem', fontWeight: 700,
                                   color: u.is_active ? '#34d399' : '#f87171' }}>
                      {u.is_active ? <UserCheck size={12} /> : <UserX size={12} />}
                      {u.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td style={{ padding: '.6rem .9rem', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                      <button className="atl-btn ghost" style={{ fontSize: '.7rem', padding: '4px 8px' }} title="Chỉnh sửa"
                              onClick={() => openEdit(u)}>
                        <Pencil size={13} />
                      </button>
                      <button className="atl-btn" style={{ fontSize: '.7rem', color: u.is_active ? '#f87171' : '#34d399' }}
                              onClick={() => handleToggle(u.id)}>
                        {u.is_active ? 'Vô hiệu hoá' : 'Kích hoạt'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add user modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal-box" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span style={{ fontWeight: 800 }}>Thêm user mới</span>
              <button className="atl-btn ghost" style={{ padding: '4px 8px', marginLeft: 'auto' }} onClick={() => setModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ fontSize: '.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Username *</label>
                <input className="atl-input" style={{ width: '100%' }} value={form.username}
                       onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: '.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Password * (≥ 8 ký tự)</label>
                <input type="password" className="atl-input" style={{ width: '100%' }} value={form.password}
                       onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: '.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Email</label>
                <input className="atl-input" style={{ width: '100%' }} value={form.email}
                       onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: '.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Họ tên</label>
                <input className="atl-input" style={{ width: '100%' }} value={form.full_name}
                       onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
              </div>
              {roles.length > 0 && (
                <div>
                  <label style={{ fontSize: '.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Vai trò (role)</label>
                  <select className="atl-select" style={{ width: '100%' }} value={form.role_id}
                          onChange={e => setForm(f => ({ ...f, role_id: e.target.value }))}>
                    <option value="">— Không gán —</option>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.name} ({r.code})</option>)}
                  </select>
                </div>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '.78rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.is_staff}
                       onChange={e => setForm(f => ({ ...f, is_staff: e.target.checked }))} />
                Quyền admin (staff) — toàn quyền hệ thống
              </label>
              {error && <div style={{ color: '#f87171', fontSize: '.78rem' }}>{error}</div>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button className="atl-btn" onClick={() => setModal(false)}>Huỷ</button>
                <button className="atl-btn primary" disabled={saving} onClick={save}>{saving ? 'Đang tạo…' : 'Tạo user'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit user modal */}
      {editUser && (
        <div className="modal-overlay" onClick={() => setEditUser(null)}>
          <div className="modal-box" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span style={{ fontWeight: 800 }}>Sửa user · {editUser.username}</span>
              <button className="atl-btn ghost" style={{ padding: '4px 8px', marginLeft: 'auto' }} onClick={() => setEditUser(null)}><X size={16} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ fontSize: '.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Email</label>
                <input className="atl-input" style={{ width: '100%' }} value={editForm.email}
                       onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: '.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Họ tên</label>
                <input className="atl-input" style={{ width: '100%' }} value={editForm.full_name}
                       onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: '.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Đổi password <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(để trống nếu giữ nguyên)</span></label>
                <input type="password" className="atl-input" style={{ width: '100%' }} value={editForm.password}
                       onChange={e => setEditForm(f => ({ ...f, password: e.target.value }))} />
              </div>
              {roles.length > 0 && (
                <div>
                  <label style={{ fontSize: '.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Vai trò (role)</label>
                  <select className="atl-select" style={{ width: '100%' }} value={editForm.role_id}
                          onChange={e => setEditForm(f => ({ ...f, role_id: e.target.value }))}>
                    <option value="">— Không gán —</option>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.name} ({r.code})</option>)}
                  </select>
                </div>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '.78rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={editForm.is_staff}
                       onChange={e => setEditForm(f => ({ ...f, is_staff: e.target.checked }))} />
                Quyền admin (staff) — toàn quyền hệ thống
              </label>
              {error && <div style={{ color: '#f87171', fontSize: '.78rem' }}>{error}</div>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button className="atl-btn" onClick={() => setEditUser(null)}>Huỷ</button>
                <button className="atl-btn primary" disabled={saving} onClick={saveEdit}>{saving ? 'Đang lưu…' : 'Lưu'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
