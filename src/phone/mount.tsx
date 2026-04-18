import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { SettingsApp } from './SettingsApp'

let mounted = false

export function mountSettings(): void {
  if (mounted) return
  const el = document.getElementById('app')
  if (!el) return
  createRoot(el).render(
    <StrictMode>
      <SettingsApp />
    </StrictMode>
  )
  mounted = true
}
