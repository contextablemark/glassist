import type { GlassistSettings } from '../types'
import type { TodoBackend } from './TodoBackend'
import { TodoistBackend } from './TodoistBackend'
import { VikunjaBackend } from './VikunjaBackend'

export type { TodoBackend, TaskView } from './TodoBackend'

export function makeBackend(settings: GlassistSettings): TodoBackend {
  if (settings.backend === 'todoist') {
    return new TodoistBackend(settings.token)
  }
  return new VikunjaBackend(settings.token, settings.vikunjaBaseUrl)
}
