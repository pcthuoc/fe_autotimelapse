import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getClients, getSites, createClient, updateClient, deleteClient, assignSiteClient, createSite, createCamera,
         getClientMembers, inviteClientMember, updateClientMember, removeClientMember, searchUsers,
         getCameras, updateCamera } from '../api/client'
import type { Client, Site, ClientMember, Camera } from '../api/types'
import { useAuth } from '../contexts/AuthContext'
import { Link } from 'react-router-dom'
import { Building2, Camera as CameraIcon, FolderOpen, Plus, Pencil, Trash2, X, Phone, Mail, MapPin, Link2, Users, Shield, UserPlus } from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'

const EMPTY_FORM = { name: '', contact_name: '', contact_email: '', phone: '', address: '', notes: '' }
const EMPTY_SITE_FORM = { name: '', location: '', description: '' }
const EMPTY_CAM_FORM = { name: '', code: '', camera_model: 'nikon_d5300', timezone: 'Asia/Ho_Chi_Minh' }

const CAMERA_MODELS = [
  { v: 'nikon_d5300', label: 'Nikon D5300' },
  { v: 'nikon_d3500', label: 'Nikon D3500' },
  { v: 'nikon_d7500', label: 'Nikon D7500' },
  { v: 'nikon_z50',   label: 'Nikon Z50' },
  { v: 'canon_200d',  label: 'Canon EOS 200D' },
  { v: 'canon_90d',   label: 'Canon EOS 90D' },
  { v: 'generic',     label: 'Generic (khác)' },
]
const TIMEZONES = [
  { v: 'Asia/Ho_Chi_Minh', label: 'GMT+7 (Việt Nam)' },
  { v: 'Asia/Bangkok',     label: 'GMT+7 (Bangkok)' },
  { v: 'UTC',              label: 'UTC' },
]

export default function ClientsPage() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const isSuperadmin = !!user?.is_staff
  const canManage = isSuperadmin || user?.client_role === 'admin'
  const [modal, setModal] = useState<'add' | 'edit' | 'assign' | 'add_site' | 'add_camera' | 'assign_camera' | 'members' | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editing, setEditing] = useState<Client | null>(null)
  const [assignClient, setAssignClient] = useState<Client | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [siteForm, setSiteForm] = useState(EMPTY_SITE_FORM)
  const [siteTargetClient, setSiteTargetClient] = useState<Client | null>(null)
  const [camForm, setCamForm] = useState(EMPTY_CAM_FORM)
  const [camTargetSite, setCamTargetSite] = useState<{ id: string; name: string } | null>(null)
  const [membersClient, setMembersClient] = useState<Client | null>(null)
  const [confirmAction, setConfirmAction] = useState<{
    title: string
    message: string
    confirmText?: string
    onConfirm: () => Promise<void>
  } | null>(null)
  const [confirming, setConfirming] = useState(false)

  const { data, isLoading } = useQuery<{ results: Client[] }>({
    queryKey: ['clients'],
    queryFn: () => getClients().then((r) => r.data),
  })
  const { data: sites } = useQuery<Site[]>({
    queryKey: ['sites'],
    queryFn: () => getSites().then((r) => r.data),
  })

  const { data: camerasData } = useQuery<{ results: Camera[] }>({
    queryKey: ['cameras'],
    queryFn: () => getCameras().then((r) => r.data),
  })
  const unassignedCameras = (camerasData?.results ?? []).filter(c => !c.site)

  const clients = data?.results ?? []
  const allSites = sites ?? []
  const assignedSiteIds = new Set(clients.flatMap(c => c.projects.map(p => p.id)))
  const unassignedSites = allSites.filter(s => !assignedSiteIds.has(s.id))

  const openAdd = () => { setForm(EMPTY_FORM); setError(''); setModal('add') }
  const openEdit = (c: Client) => {
    setEditing(c)
    setForm({ name: c.name, contact_name: c.contact_name, contact_email: c.contact_email, phone: c.phone, address: c.address, notes: c.notes })
    setError(''); setModal('edit')
  }

  const save = async () => {
    if (!form.name.trim()) { setError('Tên khách hàng là bắt buộc'); return }
    setSaving(true); setError('')
    try {
      if (modal === 'add') await createClient(form)
      else if (modal === 'edit' && editing) await updateClient(editing.id, form)
      qc.invalidateQueries({ queryKey: ['clients'] })
      setModal(null)
    } catch (e: any) { setError(e?.response?.data?.detail || 'Lỗi khi lưu') }
    setSaving(false)
  }

  const remove = (c: Client) => {
    setConfirmAction({
      title: 'Xóa khách hàng',
      message: `Xoá client "${c.name}"? Công trình sẽ được giữ lại nhưng không còn thuộc client này.`,
      confirmText: 'Xoá',
      onConfirm: async () => {
        await deleteClient(c.id)
        qc.invalidateQueries({ queryKey: ['clients'] })
      }
    })
  }

  const doAssign = async (siteId: string, clientId: string | null) => {
    await assignSiteClient(siteId, clientId)
    qc.invalidateQueries({ queryKey: ['clients'] })
    qc.invalidateQueries({ queryKey: ['sites'] })
  }

  const saveSite = async () => {
    if (!siteForm.name.trim()) { setError('Tên công trình là bắt buộc'); return }
    setSaving(true); setError('')
    try {
      const res = await createSite({ name: siteForm.name, location: siteForm.location, description: siteForm.description })
      if (siteTargetClient) await assignSiteClient(res.data.id, siteTargetClient.id)
      qc.invalidateQueries({ queryKey: ['clients'] })
      qc.invalidateQueries({ queryKey: ['sites'] })
      setModal(null)
    } catch (e: any) { setError(e?.response?.data?.detail || 'Lỗi khi tạo công trình') }
    setSaving(false)
  }

  const saveCamera = async () => {
    if (!camForm.name.trim()) { setError('Tên camera là bắt buộc'); return }
    setSaving(true); setError('')
    try {
      await createCamera({
        name: camForm.name,
        code: camForm.code.trim().toUpperCase() || undefined,
        camera_model: camForm.camera_model,
        timezone: camForm.timezone,
        site_id: camTargetSite?.id,
      })
      qc.invalidateQueries({ queryKey: ['clients'] })
      qc.invalidateQueries({ queryKey: ['cameras'] })
      setModal(null)
    } catch (e: any) { setError(e?.response?.data?.detail || 'Lỗi khi tạo camera') }
    setSaving(false)
  }

  const assignCameraToSite = async (cameraId: string) => {
    if (!camTargetSite) return
    setSaving(true); setError('')
    try {
      await updateCamera(cameraId, { site_id: camTargetSite.id })
      qc.invalidateQueries({ queryKey: ['clients'] })
      qc.invalidateQueries({ queryKey: ['cameras'] })
      qc.invalidateQueries({ queryKey: ['sites'] })
      setModal(null)
    } catch (e: any) { setError(e?.response?.data?.detail || 'Lỗi khi gán camera') }
    setSaving(false)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Khách hàng</h1>
        </div>
        {isSuperadmin && (
          <button className="atl-btn primary" style={{ fontSize: '.8rem' }} onClick={openAdd}>
            <Plus size={14} style={{ marginRight: 5 }} />Thêm khách hàng
          </button>
        )}
      </div>

      {isLoading && <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải…</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
        {clients.map((c) => (
          <div key={c.id} style={{ border: '1px solid var(--border-color)', borderRadius: 12, background: 'var(--bg-secondary)', overflow: 'hidden' }}>
            <div style={{ padding: '.9rem 1rem .7rem', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(245,158,11,.14)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Building2 size={20} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: '.92rem', color: 'var(--text-primary)' }}>{c.name}</div>
                  <div style={{ fontSize: '.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    {c.project_count} công trình · {c.camera_count} camera
                  </div>
                </div>
                {canManage && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="atl-btn ghost" style={{ padding: '4px 7px', color: '#a78bfa' }} title="Thành viên" onClick={() => { setMembersClient(c); setModal('members') }}><Users size={13} /></button>
                    <button className="atl-btn ghost" style={{ padding: '4px 7px' }} title="Sửa" onClick={() => openEdit(c)}><Pencil size={13} /></button>
                    <button className="atl-btn ghost" style={{ padding: '4px 7px', color: '#f87171' }} title="Xoá" onClick={() => remove(c)}><Trash2 size={13} /></button>
                  </div>
                )}
              </div>
              {(c.contact_name || c.phone || c.contact_email || c.address) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8, fontSize: '.72rem', color: 'var(--text-secondary)' }}>
                  {c.contact_name && <span>👤 {c.contact_name}</span>}
                  {c.phone && <span><Phone size={10} style={{ display: 'inline', marginRight: 3 }} />{c.phone}</span>}
                  {c.contact_email && <span><Mail size={10} style={{ display: 'inline', marginRight: 3 }} />{c.contact_email}</span>}
                  {c.address && <span><MapPin size={10} style={{ display: 'inline', marginRight: 3 }} />{c.address}</span>}
                </div>
              )}
            </div>

            <div style={{ padding: '.7rem 1rem .9rem' }}>
              {c.projects.length === 0 ? (
                <div style={{ fontSize: '.75rem', color: 'var(--text-muted)', textAlign: 'center', padding: '.6rem' }}>Chưa có công trình</div>
              ) : c.projects.map((p) => (
                <div key={p.id} style={{ marginBottom: 8, padding: '.55rem .7rem', borderRadius: 9, background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <FolderOpen size={13} style={{ color: '#f59e0b', flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: '.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</span>
                    {canManage && (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="atl-btn ghost" style={{ padding: '2px 7px', fontSize: '.65rem', color: '#60a5fa' }} title="Thêm camera mới vào công trình này"
                                onClick={() => { setCamTargetSite({ id: p.id, name: p.name }); setCamForm(EMPTY_CAM_FORM); setError(''); setModal('add_camera') }}>
                          <CameraIcon size={10} style={{ marginRight: 3 }} />+ Cam
                        </button>
                        <button className="atl-btn ghost" style={{ padding: '2px 7px', fontSize: '.65rem', color: '#34d399' }} title="Gán camera có sẵn vào công trình này"
                                onClick={() => { setCamTargetSite({ id: p.id, name: p.name }); setError(''); setModal('assign_camera') }}>
                          <Link2 size={10} style={{ marginRight: 3 }} />Gán cam
                        </button>
                        <button className="atl-btn ghost" style={{ padding: '2px 6px', fontSize: '.65rem' }} title="Gỡ công trình khỏi client"
                                onClick={() => {
                                  setConfirmAction({
                                    title: 'Gỡ công trình khỏi khách hàng',
                                    message: `Bạn có muốn gỡ công trình "${p.name}" khỏi khách hàng "${c.name}" không?`,
                                    confirmText: 'Gỡ công trình',
                                    onConfirm: async () => {
                                      await assignSiteClient(p.id, null)
                                      qc.invalidateQueries({ queryKey: ['clients'] })
                                      qc.invalidateQueries({ queryKey: ['sites'] })
                                    }
                                  })
                                }}>✕</button>
                      </div>
                    )}
                  </div>
                  {p.location && <div style={{ fontSize: '.68rem', color: 'var(--text-muted)', marginLeft: 20, marginTop: 2 }}>{p.location}</div>}
                  {p.cameras.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6, marginLeft: 20 }}>
                      {p.cameras.map(cm => (
                        <Link key={cm.id} to={`/cameras?q=${cm.code}`} className="no-underline"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '.68rem', padding: '2px 8px', borderRadius: 6,
                                       background: cm.status === 'active' ? 'rgba(52,211,153,.1)' : 'var(--bg-tertiary)',
                                       color: cm.status === 'active' ? '#34d399' : 'var(--text-muted)',
                                       border: '1px solid var(--border-color)' }}
                              title={`Mã: ${cm.code}`}
                        >
                          <CameraIcon size={9} />{cm.name || cm.code}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {canManage && (
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <button className="atl-btn" style={{ flex: 1, fontSize: '.72rem' }}
                          onClick={() => { setSiteTargetClient(c); setSiteForm(EMPTY_SITE_FORM); setError(''); setModal('add_site') }}>
                    <FolderOpen size={12} style={{ marginRight: 5 }} />+ Công trình mới
                  </button>
                  {unassignedSites.length > 0 && (
                    <button className="atl-btn" style={{ flex: 1, fontSize: '.72rem' }}
                            onClick={() => { setAssignClient(c); setModal('assign') }}>
                      <Link2 size={12} style={{ marginRight: 5 }} />Gán công trình
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {clients.length === 0 && !isLoading && (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Building2 size={40} style={{ opacity: .2, marginBottom: 10 }} />
          <div>Chưa có client nào{canManage ? ' — bấm "Thêm client" để tạo' : ''}</div>
        </div>
      )}

      {(modal === 'add' || modal === 'edit') && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-box" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span style={{ fontWeight: 800 }}>{modal === 'add' ? 'Thêm client mới' : `Sửa: ${editing?.name}`}</span>
              <button className="atl-btn ghost" style={{ padding: '4px 8px', marginLeft: 'auto' }} onClick={() => setModal(null)}><X size={16} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { key: 'name', label: 'Tên khách hàng *', ph: 'Công ty CP Xây dựng ABC' },
                { key: 'contact_name', label: 'Người liên hệ', ph: 'Nguyễn Văn A' },
                { key: 'contact_email', label: 'Email', ph: 'contact@abc.vn' },
                { key: 'phone', label: 'Điện thoại', ph: '0901234567' },
                { key: 'address', label: 'Địa chỉ', ph: 'Hà Nội' },
                { key: 'notes', label: 'Ghi chú', ph: '' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: '.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{f.label}</label>
                  <input className="atl-input" style={{ width: '100%' }} placeholder={f.ph}
                         value={(form as any)[f.key]}
                         onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} />
                </div>
              ))}
              {error && <div style={{ color: '#f87171', fontSize: '.78rem' }}>{error}</div>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button className="atl-btn" onClick={() => setModal(null)}>Huỷ</button>
                <button className="atl-btn primary" disabled={saving} onClick={save}>{saving ? 'Đang lưu…' : 'Lưu'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modal === 'assign' && assignClient && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-box" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span style={{ fontWeight: 800 }}>Gán công trình → {assignClient.name}</span>
              <button className="atl-btn ghost" style={{ padding: '4px 8px', marginLeft: 'auto' }} onClick={() => setModal(null)}><X size={16} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {unassignedSites.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '.8rem' }}>Tất cả công trình đã được gán.</div>}
              {unassignedSites.map(s => (
                <button key={s.id} className="atl-btn" style={{ justifyContent: 'flex-start', fontSize: '.8rem' }}
                        onClick={async () => { await doAssign(s.id, assignClient.id); setModal(null) }}>
                  <FolderOpen size={13} style={{ marginRight: 7, color: '#f59e0b' }} />{s.name}
                  {s.cam_count != null && <span style={{ marginLeft: 'auto', fontSize: '.7rem', color: 'var(--text-muted)' }}>{s.cam_count} cam</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {modal === 'add_site' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-box" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span style={{ fontWeight: 800 }}>Tạo công trình mới{siteTargetClient ? ` → ${siteTargetClient.name}` : ''}</span>
              <button className="atl-btn ghost" style={{ padding: '4px 8px', marginLeft: 'auto' }} onClick={() => setModal(null)}><X size={16} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { key: 'name', label: 'Tên công trình *', ph: 'Cầu Nhật Tân 3' },
                { key: 'location', label: 'Địa điểm', ph: 'Hà Nội' },
                { key: 'description', label: 'Mô tả', ph: '' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: '.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{f.label}</label>
                  <input className="atl-input" style={{ width: '100%' }} placeholder={f.ph}
                         value={(siteForm as any)[f.key]}
                         onChange={e => setSiteForm(prev => ({ ...prev, [f.key]: e.target.value }))} />
                </div>
              ))}
              {error && <div style={{ color: '#f87171', fontSize: '.78rem' }}>{error}</div>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button className="atl-btn" onClick={() => setModal(null)}>Huỷ</button>
                <button className="atl-btn primary" disabled={saving} onClick={saveSite}>{saving ? 'Đang tạo…' : 'Tạo công trình'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modal === 'add_camera' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-box" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span style={{ fontWeight: 800 }}>Thêm camera{camTargetSite ? ` → ${camTargetSite.name}` : ''}</span>
              <button className="atl-btn ghost" style={{ padding: '4px 8px', marginLeft: 'auto' }} onClick={() => setModal(null)}><X size={16} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ fontSize: '.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Tên camera *</label>
                <input className="atl-input" style={{ width: '100%' }} placeholder="Nikon D5300 - Trụ T1"
                       value={camForm.name} onChange={e => setCamForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: '.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Model</label>
                  <select className="atl-select" style={{ width: '100%' }} value={camForm.camera_model}
                          onChange={e => setCamForm(p => ({ ...p, camera_model: e.target.value }))}>
                    {CAMERA_MODELS.map(m => <option key={m.v} value={m.v}>{m.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Timezone</label>
                  <select className="atl-select" style={{ width: '100%' }} value={camForm.timezone}
                          onChange={e => setCamForm(p => ({ ...p, timezone: e.target.value }))}>
                    {TIMEZONES.map(t => <option key={t.v} value={t.v}>{t.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Mã camera <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(để trống để tự sinh)</span></label>
                <input className="atl-input" style={{ width: '100%', textTransform: 'uppercase' }} placeholder="Tự động sinh"
                       value={camForm.code} onChange={e => setCamForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} />
              </div>
              {error && <div style={{ color: '#f87171', fontSize: '.78rem' }}>{error}</div>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button className="atl-btn" onClick={() => setModal(null)}>Huỷ</button>
                <button className="atl-btn primary" disabled={saving} onClick={saveCamera}>{saving ? 'Đang tạo…' : 'Thêm camera'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modal === 'assign_camera' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-box" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span style={{ fontWeight: 800 }}>Gán camera{camTargetSite ? ` → ${camTargetSite.name}` : ''}</span>
              <button className="atl-btn ghost" style={{ padding: '4px 8px', marginLeft: 'auto' }} onClick={() => setModal(null)}><X size={16} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                Chọn camera chưa thuộc công trình nào để gán vào công trình này.
              </div>
              {unassignedCameras.length === 0 && (
                <div style={{ color: 'var(--text-muted)', fontSize: '.8rem', textAlign: 'center', padding: '1rem' }}>
                  Không còn camera nào chưa gán công trình.
                </div>
              )}
              {unassignedCameras.map(cm => (
                <button key={cm.id} className="atl-btn" style={{ justifyContent: 'flex-start', fontSize: '.8rem' }}
                        disabled={saving} onClick={() => assignCameraToSite(cm.id)}>
                  <CameraIcon size={13} style={{ marginRight: 7, color: '#34d399' }} />
                  <span style={{ fontWeight: 600 }}>{cm.code}</span>
                  <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>{cm.name}</span>
                </button>
              ))}
              {error && <div style={{ color: '#f87171', fontSize: '.78rem' }}>{error}</div>}
            </div>
          </div>
        </div>
      )}

      {modal === 'members' && membersClient && (
        <MembersModal client={membersClient} isSuperadmin={isSuperadmin} onClose={() => setModal(null)} />
      )}

      {confirmAction && (
        <ConfirmModal
          title={confirmAction.title}
          message={confirmAction.message}
          confirmText={confirmAction.confirmText || 'Xác nhận'}
          isPending={confirming}
          onConfirm={async () => {
            setConfirming(true)
            try {
              await confirmAction.onConfirm()
              setConfirmAction(null)
            } finally {
              setConfirming(false)
            }
          }}
          onClose={() => setConfirmAction(null)}
        />
      )}
    </div>
  )
}

// ── Modal quản lý thành viên client ──────────────────
function MembersModal({ client, isSuperadmin, onClose }: { client: Client; isSuperadmin: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery<{ results: ClientMember[] }>({
    queryKey: ['client-members', client.id],
    queryFn: () => getClientMembers(client.id).then(r => r.data),
  })
  const members = data?.results ?? []

  const [search, setSearch] = useState('')
  const [results, setResults] = useState<{ id: number; username: string; email: string; full_name: string }[]>([])
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [confirmAction, setConfirmAction] = useState<{
    title: string
    message: string
    confirmText?: string
    onConfirm: () => Promise<void>
  } | null>(null)
  const [confirming, setConfirming] = useState(false)

  const doSearch = async (q: string) => {
    setSearch(q)
    if (q.trim().length < 2) { setResults([]); return }
    try {
      const r = await searchUsers(q)
      setResults(r.data.results ?? [])
    } catch { setResults([]) }
  }

  const invite = async (userId: number) => {
    setBusy(true); setErr('')
    try {
      await inviteClientMember(client.id, { user_id: userId, role: inviteRole })
      qc.invalidateQueries({ queryKey: ['client-members', client.id] })
      setSearch(''); setResults([])
    } catch (e: any) { setErr(e?.response?.data?.detail || 'Lỗi khi mời') }
    setBusy(false)
  }

  const changeRole = async (m: ClientMember, role: 'admin' | 'member') => {
    try {
      await updateClientMember(client.id, m.user_id, { role })
      qc.invalidateQueries({ queryKey: ['client-members', client.id] })
    } catch (e: any) { setErr(e?.response?.data?.detail || 'Lỗi đổi quyền') }
  }

  const kick = async (m: ClientMember) => {
    setConfirmAction({
      title: 'Gỡ thành viên',
      message: `Gỡ ${m.username} khỏi client "${client.name}"?`,
      confirmText: 'Gỡ',
      onConfirm: async () => {
        await removeClientMember(client.id, m.user_id)
        qc.invalidateQueries({ queryKey: ['client-members', client.id] })
      }
    })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 7 }}>
            <Users size={16} style={{ color: '#a78bfa' }} />Thành viên · {client.name}
          </span>
          <button className="atl-btn ghost" style={{ padding: '4px 8px', marginLeft: 'auto' }} onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Mời member */}
          <div style={{ padding: '.7rem', borderRadius: 9, background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '.75rem', fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
              <UserPlus size={13} />Mời thành viên
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <input className="atl-input" style={{ flex: 1 }} placeholder="Tìm username / email…"
                     value={search} onChange={e => doSearch(e.target.value)} />
              {isSuperadmin && (
                <select className="atl-input" style={{ width: 110 }} value={inviteRole} onChange={e => setInviteRole(e.target.value as any)}>
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              )}
            </div>
            {results.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 160, overflowY: 'auto' }}>
                {results.map(u => (
                  <button key={u.id} className="atl-btn" style={{ justifyContent: 'flex-start', fontSize: '.76rem' }}
                          disabled={busy} onClick={() => invite(u.id)}>
                    <span style={{ fontWeight: 600 }}>{u.username}</span>
                    {u.email && <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>{u.email}</span>}
                    <Plus size={12} style={{ marginLeft: 'auto' }} />
                  </button>
                ))}
              </div>
            )}
            {err && <div style={{ color: '#f87171', fontSize: '.74rem', marginTop: 5 }}>{err}</div>}
          </div>

          {/* Danh sách member */}
          {isLoading ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '.8rem', textAlign: 'center', padding: '1rem' }}>Đang tải…</div>
          ) : members.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '.8rem', textAlign: 'center', padding: '1rem' }}>Chưa có thành viên</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {members.map(m => (
                <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '.5rem .6rem', borderRadius: 8, background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: m.role === 'admin' ? 'rgba(167,139,250,.15)' : 'var(--bg-tertiary)', color: m.role === 'admin' ? '#a78bfa' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.7rem', fontWeight: 800, flexShrink: 0 }}>
                    {m.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>{m.username}</div>
                    <div style={{ fontSize: '.68rem', color: 'var(--text-muted)' }}>{m.full_name || m.email || '—'}</div>
                  </div>
                  <span style={{ fontSize: '.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 3,
                                 background: m.role === 'admin' ? 'rgba(167,139,250,.12)' : 'var(--bg-tertiary)',
                                 color: m.role === 'admin' ? '#a78bfa' : 'var(--text-secondary)' }}>
                    {m.role === 'admin' && <Shield size={10} />}{m.role === 'admin' ? 'Admin' : 'Member'}
                  </span>
                  {isSuperadmin && (
                    <button className="atl-btn ghost" style={{ padding: '3px 6px', fontSize: '.65rem' }}
                            title={m.role === 'admin' ? 'Hạ xuống Member' : 'Nâng lên Admin'}
                            onClick={() => changeRole(m, m.role === 'admin' ? 'member' : 'admin')}>
                      {m.role === 'admin' ? '↓' : '↑'}
                    </button>
                  )}
                  <button className="atl-btn ghost" style={{ padding: '3px 6px', color: '#f87171' }} title="Gỡ" onClick={() => kick(m)}><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {confirmAction && (
        <ConfirmModal
          title={confirmAction.title}
          message={confirmAction.message}
          confirmText={confirmAction.confirmText || 'Xác nhận'}
          isPending={confirming}
          onConfirm={async () => {
            setConfirming(true)
            try {
              await confirmAction.onConfirm()
              setConfirmAction(null)
            } finally {
              setConfirming(false)
            }
          }}
          onClose={() => setConfirmAction(null)}
        />
      )}
    </div>
  )
}
