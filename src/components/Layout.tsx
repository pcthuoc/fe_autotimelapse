import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import { logout } from '../api/client'
import {
  LayoutDashboard, Camera, Building2, Film, Users, Bell, DownloadCloud,
  Sun, Moon, LogOut, Menu, X,
} from 'lucide-react'
import { useState } from 'react'

// roles: ai được thấy item. 'superadmin' | 'admin' | 'member'
const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard',     color: '#60a5fa', roles: ['superadmin','admin','member'] },
  { to: '/cameras',   icon: Camera,          label: 'Cameras',       color: '#34d399', roles: ['superadmin','admin','member'] },
  { to: '/clients',   icon: Building2,       label: 'Clients',       color: '#f59e0b', roles: ['superadmin','admin'] },
  { to: '/renders',   icon: Film,            label: 'Video Renders', color: '#a78bfa', roles: ['superadmin','admin','member'] },
  { to: '/downloads', icon: DownloadCloud,   label: 'Downloads',     color: '#22d3ee', roles: ['superadmin','admin','member'] },
]
const adminItems = [
  { to: '/users',    icon: Users, label: 'Users',          color: '#f472b6', roles: ['superadmin','admin'] },
  { to: '/settings', icon: Bell,  label: 'Alert Settings', color: '#fb923c', roles: ['superadmin','admin'] },
]

const SIDEBAR_W = 220

export default function Layout() {
  const { mode, toggle } = useTheme()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = async () => {
    try { await logout() } catch (_) {}
    navigate('/login')
  }

  const initials = user?.username?.slice(0, 2).toUpperCase() ?? '??'

  // Vai trò hiện tại: superadmin | admin | member
  const role: string = user?.is_staff ? 'superadmin' : (user?.client_role ?? 'member')
  const roleLabel = role === 'superadmin' ? 'Superadmin' : role === 'admin' ? 'Client Admin' : 'Member'

  const NavContent = () => (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      {/* Logo */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1rem .875rem .875rem', borderBottom:'1px solid var(--border-color)' }}>
        <NavLink to="/dashboard" style={{ display:'flex', alignItems:'center', gap:10, textDecoration:'none' }} onClick={()=>setMobileOpen(false)}>
          <div style={{ width:36, height:36, background:'var(--accent)', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <Camera size={18} color="#fff" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontWeight:800, fontSize:'.875rem', color:'var(--text-primary)', lineHeight:1.2 }}>AutoTimelapse</div>
            <div style={{ fontSize:'.6rem', color:'var(--text-muted)', fontWeight:500, letterSpacing:'.03em' }}>Camera Management</div>
          </div>
        </NavLink>
        <button className="lg:hidden" onClick={()=>setMobileOpen(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', display:'flex' }}>
          <X size={18}/>
        </button>
      </div>

      {/* Nav */}
      <nav style={{ flex:1, overflowY:'auto', padding:'.5rem .5rem' }}>
        {navItems.filter(item => item.roles.includes(role)).map(({to,icon:Icon,label,color}) => (
          <NavLink key={to} to={to} onClick={()=>setMobileOpen(false)}>
            {({ isActive }) => (
              <span
                style={{
                  display:'flex', alignItems:'center', gap:10,
                  padding:'.55rem .875rem', borderRadius:8,
                  fontSize:'.875rem', fontWeight: isActive?700:500,
                  color: isActive?'#fff':'var(--text-secondary)',
                  background: isActive?'var(--accent)':'transparent',
                  textDecoration:'none', marginBottom:2,
                  transition:'all .12s',
                }}
              >
                <Icon size={17} strokeWidth={isActive ? 2.5 : 2} color={isActive ? '#fff' : color} />
                <span>{label}</span>
              </span>
            )}
          </NavLink>
        ))}

        {adminItems.some(i => i.roles.includes(role)) && (
          <>
            <div style={{ fontSize:'.6rem', fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', color:'var(--text-muted)', padding:'.875rem .875rem .25rem' }}>
              Quản trị
            </div>
            {adminItems.filter(i => i.roles.includes(role)).map(({to,icon:Icon,label,color}) => (
              <NavLink key={to} to={to} onClick={()=>setMobileOpen(false)}
                       style={({isActive}) => ({
                         display:'flex', alignItems:'center', gap:10,
                         padding:'.55rem .875rem', borderRadius:8,
                         fontSize:'.875rem', fontWeight: isActive?700:500,
                         color: isActive?'#fff':'var(--text-secondary)',
                         background: isActive?'var(--accent)':'transparent',
                         textDecoration:'none', marginBottom:2,
                         transition:'all .12s',
                       })}>
                <Icon size={17} color={color}/>
                <span>{label}</span>
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* Footer */}
      <div style={{ borderTop:'1px solid var(--border-color)', padding:'.625rem .5rem' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'.35rem .5rem .5rem' }}>
          <div style={{ width:32, height:32, borderRadius:'50%', background:'var(--accent-muted)', color:'var(--accent-light)', border:'1px solid rgba(0,174,66,.25)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.72rem', fontWeight:800, flexShrink:0 }}>
            {initials}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:'.8rem', fontWeight:700, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user?.username}</div>
            <div style={{ fontSize:'.65rem', color: user?.is_staff?'var(--accent)':'var(--text-muted)', fontWeight:600 }}>{roleLabel}</div>
          </div>
          <button onClick={handleLogout} title="Logout" style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', display:'flex', padding:4 }}>
            <LogOut size={14}/>
          </button>
        </div>
        <button onClick={toggle} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'.38rem', borderRadius:8, fontSize:'.75rem', fontWeight:500, background:'var(--bg-tertiary)', border:'1px solid var(--border-color)', color:'var(--text-muted)', cursor:'pointer' }}>
          {mode==='dark'?<Sun size={13}/>:<Moon size={13}/>}
          {mode==='dark'?'Light mode':'Dark mode'}
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ background:'var(--bg-primary)', minHeight:'100vh', overflowX:'hidden', maxWidth:'100vw' }}>
      {/* Mobile topbar */}
      <div className="lg:hidden flex items-center gap-3 px-4 py-3 sticky top-0 z-50" style={{ background:'var(--bg-sidebar)', borderBottom:'1px solid var(--border-color)' }}>
        <button onClick={()=>setMobileOpen(!mobileOpen)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-secondary)', display:'flex' }} title={mobileOpen ? "Đóng menu" : "Mở menu"}>
          {mobileOpen ? <X size={20}/> : <Menu size={20}/>}
        </button>
        <NavLink to="/dashboard" onClick={()=>setMobileOpen(false)} style={{ display:'flex', alignItems:'center', gap:8, textDecoration:'none', color:'inherit', flex:1 }}>
          <div style={{ width:26, height:26, background:'var(--accent)', borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <Camera size={14} color="#fff" strokeWidth={2.5} />
          </div>
          <span style={{ fontWeight:800, fontSize:'.9rem', color:'var(--text-primary)' }}>AutoTimelapse</span>
        </NavLink>
        <span style={{ fontSize:'.75rem', color:'var(--text-muted)' }}>{user?.username}</span>
      </div>
      {mobileOpen && <div className="fixed inset-0 z-40 lg:hidden" style={{ background:'rgba(0,0,0,.75)' }} onClick={()=>setMobileOpen(false)}/>}
      <aside className={`fixed top-0 left-0 h-full z-50 lg:translate-x-0 transition-transform duration-200 ${mobileOpen?'translate-x-0':'-translate-x-full'}`}
             style={{ width:SIDEBAR_W, background:'var(--bg-sidebar)', borderRight:'1px solid var(--border-color)' }}>
        <NavContent/>
      </aside>
      <main className="lg:ml-[220px] min-h-screen w-full lg:w-[calc(100%-220px)] min-w-0 max-w-full box-border">
        <div style={{ padding:'1.25rem 1.5rem', width:'100%', boxSizing:'border-box' }}>
          <Outlet/>
        </div>
      </main>
    </div>
  )
}
