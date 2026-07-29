/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        accent:     'var(--accent)',
        'accent-l': 'var(--accent-light)',
        'accent-d': 'var(--accent-dark)',
        bg:         'var(--bg-primary)',
        'bg-2':     'var(--bg-secondary)',
        'bg-3':     'var(--bg-tertiary)',
        card:       'var(--bg-card)',
        border:     'var(--border-color)',
        tx:         'var(--text-primary)',
        'tx-2':     'var(--text-secondary)',
        'tx-m':     'var(--text-muted)',
        ok:         'var(--status-ok)',
        warn:       'var(--status-warning)',
        err:        'var(--status-error)',
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
}

