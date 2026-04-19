import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import type { GlassistSettings } from '../types'
import { DEFAULT_SETTINGS } from '../types'

let bridge: EvenAppBridge | null = null

export function initStorage(b: EvenAppBridge): void {
  bridge = b
}

async function setItem(key: string, value: string): Promise<void> {
  if (bridge) {
    try {
      await bridge.setLocalStorage(key, value)
      return
    } catch { /* fall through */ }
  }
  try { window.localStorage.setItem(key, value) } catch { /* noop */ }
}

async function getItem(key: string): Promise<string | null> {
  if (bridge) {
    try {
      const val = await bridge.getLocalStorage(key)
      if (val !== undefined && val !== null && val !== '') return val as string
    } catch { /* fall through */ }
  }
  try { return window.localStorage.getItem(key) } catch { return null }
}

const SETTINGS_KEY = 'glassist-settings-v1'

export async function getSettings(): Promise<GlassistSettings> {
  const raw = await getItem(SETTINGS_KEY)
  if (!raw) return { ...DEFAULT_SETTINGS }
  try {
    const parsed = JSON.parse(raw)
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      stt: { ...DEFAULT_SETTINGS.stt, ...(parsed.stt ?? {}) },
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export async function saveSettings(settings: GlassistSettings): Promise<void> {
  await setItem(SETTINGS_KEY, JSON.stringify(settings))
  dispatchSettingsChanged()
}

export const SETTINGS_CHANGED_EVENT = 'glassist:settings-changed'

/**
 * Fired on every settings save. Phone and glasses modes share the same JS
 * context inside the Even Hub WebView, so the glasses Nav can listen here to
 * rebuild its backend when the token or backend choice changes.
 */
function dispatchSettingsChanged(): void {
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(SETTINGS_CHANGED_EVENT))
    }
  } catch { /* no-op in non-browser contexts */ }
}
