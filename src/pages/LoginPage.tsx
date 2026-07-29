import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { login } from '../api/client'
import { Camera, Sun, Moon, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const { mode, toggle } = useTheme()
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [remember, setRemember] = useState(false)
  const usernameRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    setLoading(true)
    try {
      // Auto-trim username, no auto-uppercase (backend is case-sensitive)
      const username = (usernameRef.current!.value || '').trim()
      if (usernameRef.current) usernameRef.current.value = username
      await login(username, passwordRef.current!.value, remember)
      refresh()
      navigate('/dashboard')
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setErr(msg || 'Sai username hoặc password')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    background: 'var(--bg-input)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    borderRadius: 10,
    width: '100%',
    padding: '.5rem .75rem',
    fontSize: '.875rem',
    outline: 'none',
    transition: 'border-color .15s',
  } as React.CSSProperties

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'var(--bg-primary)' }}>

      {/* Theme toggle */}
      <button onClick={toggle} style={{ position: 'fixed', top: 16, right: 16, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}>
        {mode === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      <div style={{ width: '100%', maxWidth: 420, borderRadius: 18, padding: '2rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: '0 20px 60px rgba(0,0,0,.5)' }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: '1.5rem' }}>
          <div style={{ width: 40, height: 40, background: 'var(--accent)', color: '#fff', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Camera size={22} />
          </div>
          <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>AutoTimelapse</span>
        </div>

        <h2 style={{ textAlign: 'center', fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>Đăng nhập</h2>
        <p style={{ textAlign: 'center', fontSize: '.8rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Vui lòng đăng nhập để tiếp tục</p>

        {err && (
          <div style={{ background: 'rgba(239,68,68,.12)', color: '#f87171', borderRadius: 8, padding: '.5rem .75rem', marginBottom: '1rem', fontSize: '.85rem' }}>
            {err}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Username */}
          <div>
            <label style={{ display: 'block', fontSize: '.72rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Username</label>
            <input
              ref={usernameRef}
              type="text"
              required
              autoFocus
              autoComplete="username"
              style={inputStyle}
              // Auto-trim khi rời ô (onBlur)
              onBlur={(e) => { e.target.value = e.target.value.trim(); e.target.style.borderColor = 'var(--border-color)' }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
            />
          </div>

          {/* Password + show/hide */}
          <div>
            <label style={{ display: 'block', fontSize: '.72rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                ref={passwordRef}
                type={showPass ? 'text' : 'password'}
                required
                autoComplete="current-password"
                style={{ ...inputStyle, paddingRight: '2.5rem' }}
                onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
              />
              <button
                type="button"
                onClick={() => setShowPass(s => !s)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}
                tabIndex={-1}
                aria-label={showPass ? 'Hide password' : 'Show password'}
              >
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Remember me */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={remember}
              onChange={e => setRemember(e.target.checked)}
              style={{ accentColor: 'var(--accent)', width: 15, height: 15 }}
            />
            <span style={{ fontSize: '.8rem', color: 'var(--text-secondary)' }}>Ghi nhớ đăng nhập</span>
          </label>

          <button
            type="submit"
            disabled={loading}
            style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 10, padding: '.65rem', fontWeight: 700, fontSize: '.9rem', cursor: 'pointer', opacity: loading ? .6 : 1, transition: 'opacity .15s' }}
          >
            {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </button>
        </form>
      </div>
    </div>
  )
}


