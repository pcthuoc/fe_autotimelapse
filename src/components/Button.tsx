import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
}

const variants = {
  primary:   { background: 'var(--accent)',      color: '#fff',                   border: 'none' },
  secondary: { background: 'var(--bg-tertiary)', color: 'var(--text-primary)',    border: '1px solid var(--border-color)' },
  danger:    { background: 'var(--status-error)', color: '#fff',                  border: 'none' },
  ghost:     { background: 'transparent',        color: 'var(--text-secondary)',  border: 'none' },
  outline:   { background: 'transparent',        color: 'var(--accent-light)',    border: '1px solid var(--accent)' },
}

const sizes = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-sm gap-2',
}

export function Button({ variant = 'primary', size = 'md', className = '', children, style, ...props }: BtnProps) {
  return (
    <button
      className={`inline-flex items-center justify-center font-semibold rounded-[10px]
        transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed
        ${sizes[size]} ${className}`}
      style={{ ...variants[variant], ...style }}
      {...props}
    >
      {children}
    </button>
  )
}
