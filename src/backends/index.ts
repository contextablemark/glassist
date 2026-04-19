import type { GlassistSettings } from '../types'
import type { TodoBackend } from './TodoBackend'

export type { TodoBackend, TaskView, TaskPage } from './TodoBackend'

/**
 * True when the current settings don't describe a real provider yet.
 * An empty token means `makeBackend` will hand back a DemoBackend —
 * the phone UI uses this to swap the Connect tab into demo-mode copy.
 */
export function isDemoMode(settings: GlassistSettings): boolean {
  return !settings.token
}

/**
 * Construct a backend for the current settings. The adapter modules are
 * loaded dynamically so their (substantial) SDK dependencies land in
 * separate chunks and stay out of the initial bundle.
 *
 * No token → DemoBackend (in-memory sample tasks). The user opts into a
 * real provider by pasting a token on the Connect tab; settings-changed
 * then swaps the instance.
 */
export async function makeBackend(settings: GlassistSettings): Promise<TodoBackend> {
  if (isDemoMode(settings)) {
    const { DemoBackend } = await import('./DemoBackend')
    return new DemoBackend()
  }
  if (settings.backend === 'todoist') {
    const { TodoistBackend } = await import('./TodoistBackend')
    return new TodoistBackend(settings.token)
  }
  const { VikunjaBackend } = await import('./VikunjaBackend')
  return new VikunjaBackend(
    settings.token,
    settings.vikunjaBaseUrl,
    settings.vikunjaProxyUrl,
  )
}
