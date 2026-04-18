export type BackendName = 'todoist' | 'vikunja'

export type HomeView = 'home' | 'today' | 'upcoming' | 'inbox' | 'all'

export type STTProviderName = 'off' | 'soniox' | 'deepgram'

export interface TodoTask {
  id: string
  title: string
  description?: string
  isCompleted: boolean
  priority: 1 | 2 | 3 | 4
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
  defaultHomeView: 'home',
  itemsPerPage: 6,
  stt: {
    provider: 'off',
    apiKey: '',
    language: 'en',
  },
}
