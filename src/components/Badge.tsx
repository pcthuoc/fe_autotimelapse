type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'secondary' | 'accent'

const styles: Record<BadgeVariant, { background: string; color: string }> = {
  success:   { background: 'rgba(34,197,94,.18)',   color: '#4ade80' },
  warning:   { background: 'rgba(245,158,11,.18)',  color: '#fbbf24' },
  danger:    { background: 'rgba(239,68,68,.18)',   color: '#f87171' },
  info:      { background: 'rgba(59,130,246,.18)',  color: '#60a5fa' },
  secondary: { background: 'var(--bg-tertiary)',    color: 'var(--text-secondary)' },
  accent:    { background: 'var(--accent-muted)',   color: 'var(--accent-light)' },
}

export function Badge({ variant = 'secondary', children }: { variant?: BadgeVariant; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
          style={styles[variant]}>
      {children}
    </span>
  )
}

export function statusBadge(status: string) {
  const map: Record<string, BadgeVariant> = {
    active:      'success',
    online:      'success',
    ready:       'success',
    inactive:    'danger',
    failed:      'danger',
    offline:     'danger',
    maintenance: 'warning',
    processing:  'warning',
    pending:     'secondary',
    expired:     'secondary',
  }
  return <Badge variant={map[status] ?? 'secondary'}>{status}</Badge>
}

import React from 'react'
