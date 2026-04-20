export type BackendName = 'todoist' | 'vikunja'

/**
 * Pre-configured Cloudflare Worker that forwards to app.vikunja.cloud
 * with permissive CORS. Any user can paste their own worker URL into
 * the Connect tab to override; clearing the field falls back to this.
 */
export const COMMUNITY_VIKUNJA_PROXY_URL =
  'https://glassist-vikunja-proxy.mark-83e.workers.dev'

export type HomeView = 'home' | 'today' | 'upcoming' | 'inbox' | 'all'

export type STTProviderName = 'off' | 'soniox' | 'deepgram'

export type Priority = 1 | 2 | 3 | 4 | 5

export interface TodoTask {
  id: string
  title: string
  description?: string
  isCompleted: boolean
  /** 1=low, 2=medium, 3=high, 4=urgent, 5=do-now. Undefined = no priority set. */
  priority?: Priority
  dueDate?: string
  projectId?: string
  labels?: string[]
  parentId?: string
}

export interface TodoProject {
  id: string
  name: string
}

/**
 * Snapshot of a project the user has pinned to Home. Name is captured at
 * pick-time from the backend; see GlassistSettings.pinnedHomeProjects.
 */
export interface PinnedProject {
  id: string
  name: string
}

export interface GlassistSettings {
  backend: BackendName
  token: string
  vikunjaBaseUrl: string
  /**
   * Optional CORS relay in front of Vikunja. Vikunja Cloud's allowlist
   * blocks the Even Hub WebView origin in packaged builds; a Cloudflare
   * Worker (see proxy/ in this repo) forwards requests server-side.
   * Leave empty if Vikunja is self-hosted with permissive CORS.
   */
  vikunjaProxyUrl: string
  defaultProjectId?: string
  /**
   * Projects the user has pinned to the on-glass Home menu. Rendered as
   * additional rows after the four built-in views (Inbox / Today /
   * Upcoming / All tasks) in selection order. Each entry carries a
   * backend-resolved display name snapshot taken at pick-time so the
   * Home menu can render immediately without an extra getProjects()
   * round-trip, and stale entries (project deleted remotely) still have
   * a human-readable label until the user unpins.
   */
  pinnedHomeProjects: PinnedProject[]
  defaultHomeView: HomeView
  itemsPerPage: number
  stt: {
    provider: STTProviderName
    apiKey: string
    language: string
  }
}

export const DEFAULT_SETTINGS: GlassistSettings = {
  backend: 'todoist',
  token: '',
  vikunjaBaseUrl: 'https://app.vikunja.cloud',
  vikunjaProxyUrl: COMMUNITY_VIKUNJA_PROXY_URL,
  pinnedHomeProjects: [],
  defaultHomeView: 'home',
  itemsPerPage: 9,
  stt: {
    provider: 'off',
    apiKey: '',
    language: 'en',
  },
}
