import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import CamerasPage from './pages/CamerasPage'
import CameraLivePage from './pages/CameraLivePage'
import MediaGalleryPage from './pages/MediaGalleryPage'
import RendersPage from './pages/RendersPage'
import ClientsPage from './pages/ClientsPage'
import UsersPage from './pages/UsersPage'
import AlertSettingsPage from './pages/AlertSettingsPage'
import DownloadsPage from './pages/DownloadsPage'

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1 } } })

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }} />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

/** Chặn route chỉ dành cho superadmin hoặc client admin. */
function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }} />
  if (!user) return <Navigate to="/login" replace />
  const role = user.is_staff ? 'superadmin' : user.client_role
  if (role !== 'superadmin' && role !== 'admin') {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--text-muted)' }}>
        <span style={{ fontSize: '2.5rem' }}>🔒</span>
        <div style={{ fontSize: '1rem', fontWeight: 700 }}>Không có quyền truy cập</div>
        <div style={{ fontSize: '.8rem' }}>Trang này yêu cầu quyền Quản trị viên.</div>
      </div>
    )
  }
  return <>{children}</>
}

/** Chặn route chỉ dành riêng cho superadmin hệ thống. */
function RequireSuperadmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }} />
  if (!user) return <Navigate to="/login" replace />
  if (!user.is_staff) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--text-muted)' }}>
        <span style={{ fontSize: '2.5rem' }}>🔒</span>
        <div style={{ fontSize: '1rem', fontWeight: 700 }}>Không có quyền truy cập</div>
        <div style={{ fontSize: '.8rem' }}>Trang này yêu cầu quyền Superadmin hệ thống.</div>
      </div>
    )
  }
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="cameras" element={<CamerasPage />} />
        <Route path="cameras/:pk/live" element={<CameraLivePage />} />
        <Route path="media/camera/:cameraPk" element={<MediaGalleryPage />} />
        <Route path="renders" element={<RendersPage />} />
        <Route path="downloads" element={<DownloadsPage />} />
        {/* Chỉ admin/superadmin */}
        <Route path="clients" element={<RequireAdmin><ClientsPage /></RequireAdmin>} />
        <Route path="users"   element={<RequireSuperadmin><UsersPage /></RequireSuperadmin>} />
        {/* Cảnh báo: member được xem (read-only), admin mới sửa được */}
        <Route path="settings" element={<AlertSettingsPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

import React from 'react'
