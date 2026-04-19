import type { GlassistSettings } from '../types'
import type { TodoBackend } from './TodoBackend'

export type { TodoBackend, TaskView, TaskPage } from './TodoBackend'

/**
 * Construct a backend for the current settings. The adapter modules are
 * loaded dynamically so their (substantial) SDK dependencies land in
 * separate chunks and stay out of the initial bundle.
 */
export async function makeBackend(settings: GlassistSettings): Promise<TodoBackend> {
  if (settings.backend === 'todoist') {
    const { TodoistBackend } = await import('./TodoistBackend')
    return new TodoistBackend(settings.token)
  }
  const { VikunjaBackend } = await import('./VikunjaBackend')
  return new VikunjaBackend(settings.token, settings.vikunjaBaseUrl)
}
