export type BackendName = 'todoist' | 'vikunja'

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
  vikunjaProxyUrl: '',
  defaultHomeView: 'home',
  itemsPerPage: 9,
  stt: {
    provider: 'off',
    apiKey: '',
    language: 'en',
  },
}
