import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Apply stored theme before first paint
;(function () {
  const t = localStorage.getItem('bb-theme') || 'dark'
  if (t === 'light') document.documentElement.classList.add('light')
})()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
