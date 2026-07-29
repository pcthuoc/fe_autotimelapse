import type { ReactNode, HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> { children: ReactNode }

export function Card({ children, className = '', style, ...rest }: CardProps) {
  return (
    <div
      className={`rounded-[14px] ${className}`}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--card-shadow)',
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`px-5 py-3.5 font-semibold text-sm ${className}`}
         style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
      {children}
    </div>
  )
}

export function CardContent({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`p-5 ${className}`}>{children}</div>
}
