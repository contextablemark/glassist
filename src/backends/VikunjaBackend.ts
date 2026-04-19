/// <reference types="vite/client" />
import type { TaskPage, TaskView, TodoBackend } from './TodoBackend'
import type { Priority, TodoProject, TodoTask } from '../types'

function devLog(msg: string): void {
  if (import.meta.env.DEV) {
    fetch('/dev-log', {
      method: 'POST',
      body: JSON.stringify({ msg: `[vikunja] ${msg}` }),
    }).catch(() => {})
  }
}

/**
 * Vikunja backend (direct REST client against the v1 API surface that
 * v2.x of the Vikunja server still exposes at `/api/v1/*`).
 *
 * Wrote this by hand rather than use the community `node-vikunja` SDK
 * because that SDK targets v1.x and breaks on v2.x: its `getAllTasks`
 * hits `/tasks/all` which the v2 server returns 400 for (the endpoint
 * was replaced by `/tasks`); its `per_page` default exceeds v2's 50-item
 * cap; and its query-string builder uses `+` for spaces which trips
 * Vikunja's filter parser in some places.
 *
 * Map of notable differences from Todoist to keep in mind:
 *   - Task IDs are numeric in Vikunja; we string-ify at our boundary so
 *     the rest of Glassist (string-id world) stays backend-agnostic.
 *   - Priority: 0 = none, 1..5 = low..do-now. Maps directly onto our
 *     `Priority | undefined`.
 *   - Sentinel "no date": `0001-01-01T00:00:00Z` — filtered out.
 *   - Parent/child: lives on `task.related_tasks`. In v2 responses this
 *     is an object keyed by relation kind (`{ subtask: [...], parenttask:
 *     [...] }`), often with the full child task inlined; in older v1
 *     responses it's `Array<{ task_id, relation_kind }>`. Handled both.
 */

const PAGE_LIMIT = 50 // Vikunja v2 `max_items_per_page` from /api/v1/info.

export class VikunjaBackend implements TodoBackend {
  readonly name = 'Vikunja' as const
  private inboxIdPromise: Promise<number | null> | null = null

  constructor(
    private readonly token: string,
    private readonly baseUrl: string,
    /** Test-only injection hook. */
    private readonly fetchImpl: typeof fetch = (url, init) => fetch(url, init),
  ) {}

  // ── transport ───────────────────────────────────────────────────────────

  private apiRoot(): string {
    // Dev builds route through the Vite /vikunja-proxy middleware to dodge
    // Vikunja Cloud's CORS allowlist (which blocks LAN IPs used for QR
    // sideloading). Production hits the user-configured URL directly.
    if (import.meta.env.DEV) return '/vikunja-proxy/api/v1'
    return normalizeBaseUrl(this.baseUrl)
  }

  private async request<T>(
    path: string,
    init: RequestInit & { query?: Record<string, string | number | undefined> } = {},
  ): Promise<T> {
    const query = init.query ?? {}
    const queryString = Object.entries(query)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&')
    const url = `${this.apiRoot()}${path}${queryString ? `?${queryString}` : ''}`
    const { query: _q, headers, ...restInit } = init
    const res = await this.fetchImpl(url, {
      ...restInit,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...headers,
      },
    })
    if (!res.ok) {
      let bodyText = ''
      try {
        bodyText = await res.text()
      } catch { /* ignore */ }
      devLog(
        `HTTP ${res.status} ${restInit.method ?? 'GET'} ${path}: ${bodyText.slice(0, 240)}`,
      )
      throw asHttpError(res.status, bodyText, path, restInit.method ?? 'GET')
    }
    if (res.status === 204) return undefined as T
    const cl = res.headers.get('content-length')
    if (cl === '0') return undefined as T
    return (await res.json()) as T
  }

  // ── API methods ─────────────────────────────────────────────────────────

  async testConnection(): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!this.token) return { ok: false, error: 'No token' }
    try {
      await this.request<VProject[]>('/projects', { query: { per_page: 1 } })
      return { ok: true }
    } catch (err) {
      return { ok: false, error: describeError(err) }
    }
  }

  async getProjects(): Promise<TodoProject[]> {
    const raw = await this.request<VProject[]>('/projects', {
      query: { per_page: PAGE_LIMIT },
    })
    return raw.map(mapProject)
  }

  async getDefaultProject(): Promise<TodoProject | null> {
    const projects = await this.getProjects()
    const inbox = projects.find((p) => p.name.toLowerCase() === 'inbox')
    return inbox ?? projects[0] ?? null
  }

  async getTasks(view: TaskView, projectId?: string): Promise<TaskPage> {
    let raw: VTask[]
    if (view === 'project') {
      if (!projectId) throw new Error('projectId required for project view')
      // Project tasks are returned regardless of completion by default;
      // filter to active tasks so completed ones disappear on re-entry.
      raw = await this.request<VTask[]>(`/projects/${projectId}/tasks`, {
        query: { per_page: PAGE_LIMIT, filter: 'done = false' },
      })
    } else if (view === 'inbox') {
      const inboxId = await this.getInboxId()
      if (!inboxId) return { tasks: [], hasMore: false }
      raw = await this.request<VTask[]>(`/projects/${inboxId}/tasks`, {
        query: { per_page: PAGE_LIMIT, filter: 'done = false' },
      })
    } else {
      const filter = filterForView(view)
      raw = await this.request<VTask[]>(`/tasks`, {
        query: {
          per_page: PAGE_LIMIT,
          filter,
          filter_include_nulls: filter ? 'false' : undefined,
        },
      })
    }
    return {
      tasks: raw.map(mapTask),
      hasMore: raw.length >= PAGE_LIMIT,
    }
  }

  async getSubtasks(parentId: string): Promise<TodoTask[]> {
    const parent = await this.request<VTask>(`/tasks/${parentId}`)
    // v2 shape: related_tasks is an object keyed by relation kind, usually
    // with the full child task inlined. Use them directly if present —
    // saves N+1 round trips.
    const related = parent.related_tasks
    if (related && typeof related === 'object' && !Array.isArray(related)) {
      const inlined = (related as Record<string, VTask[] | undefined>).subtask
      if (Array.isArray(inlined) && inlined.length > 0 && inlined[0].title !== undefined) {
        return inlined.map(mapTask)
      }
    }
    // Fallback: v1 shape `Array<{ task_id, relation_kind }>` — have to
    // fetch each subtask by id.
    const ids = extractSubtaskIdsFallback(related)
    if (ids.length === 0) return []
    const tasks = await Promise.all(
      ids.map((id) => this.request<VTask>(`/tasks/${id}`)),
    )
    return tasks.map(mapTask)
  }

  async completeTask(id: string): Promise<void> {
    // Vikunja exposes a convenience `POST /tasks/{id}/done`, but that isn't
    // universally available across versions. `POST /tasks/{id}` with
    // `{ done: true }` is the stable path.
    await this.request<VTask>(`/tasks/${id}`, {
      method: 'POST',
      body: JSON.stringify({ done: true }),
    })
  }

  async uncompleteTask(id: string): Promise<void> {
    await this.request<VTask>(`/tasks/${id}`, {
      method: 'POST',
      body: JSON.stringify({ done: false }),
    })
  }

  async createTask(input: {
    title: string
    projectId?: string
  }): Promise<TodoTask> {
    let targetId: number | null = input.projectId ? Number(input.projectId) : null
    if (!targetId) targetId = await this.getInboxId()
    if (!targetId) {
      throw new Error(
        'No default project configured. Pick one in the phone Connect tab.',
      )
    }
    const created = await this.request<VTask>(
      `/projects/${targetId}/tasks`,
      {
        method: 'PUT',
        body: JSON.stringify({ title: input.title, project_id: targetId }),
      },
    )
    return mapTask(created)
  }

  async deleteTask(id: string): Promise<void> {
    await this.request<unknown>(`/tasks/${id}`, { method: 'DELETE' })
  }

  // ── internal ────────────────────────────────────────────────────────────

  private async getInboxId(): Promise<number | null> {
    if (!this.inboxIdPromise) {
      this.inboxIdPromise = (async () => {
        const projects = await this.request<VProject[]>('/projects', {
          query: { per_page: PAGE_LIMIT },
        })
        const inbox = projects.find((p) => p.title?.toLowerCase() === 'inbox')
        return inbox?.id ?? null
      })()
    }
    return this.inboxIdPromise
  }
}

// ── types (minimal; only the fields we read) ───────────────────────────────

interface VProject {
  id?: number
  title: string
  parent_project_id?: number
}

interface VTask {
  id?: number
  title: string
  description?: string
  done?: boolean
  priority?: number
  due_date?: string
  project_id?: number
  labels?: Array<{ title?: string }> | null
  related_tasks?:
    | Record<string, VTask[] | undefined>
    | Array<{ task_id: number; relation_kind: string }>
    | null
    | Record<string, never>
}

// ── helpers ────────────────────────────────────────────────────────────────

export function normalizeBaseUrl(url: string): string {
  const trimmed = url.replace(/\/+$/, '')
  if (/\/api\/v\d+$/.test(trimmed)) return trimmed
  return `${trimmed}/api/v1`
}

export function filterForView(view: 'today' | 'upcoming' | 'all'): string | undefined {
  if (view === 'all') return 'done = false'
  if (view === 'today') return 'done = false && due_date <= now'
  if (view === 'upcoming') return 'done = false && due_date > now'
  return undefined
}

function mapProject(p: VProject): TodoProject {
  return { id: String(p.id ?? ''), name: p.title }
}

function mapTask(t: VTask): TodoTask {
  return {
    id: String(t.id ?? ''),
    title: t.title,
    description: t.description || undefined,
    isCompleted: !!t.done,
    priority: normalizePriority(t.priority),
    dueDate: isRealDate(t.due_date) ? t.due_date : undefined,
    projectId: t.project_id !== undefined ? String(t.project_id) : undefined,
    labels:
      t.labels && Array.isArray(t.labels) && t.labels.length > 0
        ? (t.labels
            .map((l) => l.title)
            .filter((v): v is string => !!v))
        : undefined,
    parentId: extractParentId(t.related_tasks),
  }
}

function normalizePriority(p: number | undefined): Priority | undefined {
  if (p === undefined || p === null || p === 0) return undefined
  if (p >= 1 && p <= 5) return p as Priority
  return undefined
}

function isRealDate(v: string | undefined | null): v is string {
  if (!v) return false
  if (v.startsWith('0001-01-01')) return false
  return true
}

function extractParentId(related: VTask['related_tasks']): string | undefined {
  if (!related) return undefined
  // v2 object-map shape
  if (typeof related === 'object' && !Array.isArray(related)) {
    const map = related as Record<string, VTask[] | undefined>
    const parents = map.parenttask
    if (Array.isArray(parents) && parents.length > 0 && parents[0].id !== undefined) {
      return String(parents[0].id)
    }
    return undefined
  }
  // v1 array shape
  if (Array.isArray(related)) {
    const parentRel = related.find((r) => r.relation_kind === 'parenttask')
    return parentRel ? String(parentRel.task_id) : undefined
  }
  return undefined
}

function extractSubtaskIdsFallback(
  related: VTask['related_tasks'],
): number[] {
  if (!related) return []
  if (Array.isArray(related)) {
    return related
      .filter((r) => r.relation_kind === 'subtask')
      .map((r) => r.task_id)
      .filter((v): v is number => typeof v === 'number')
  }
  return []
}

function asHttpError(
  status: number,
  bodyText: string,
  path: string,
  method: string,
): Error & { status: number } {
  let parsed: { message?: string; code?: number } | null = null
  try { parsed = JSON.parse(bodyText) } catch { /* ignore */ }
  const base = parsed?.message ?? bodyText.slice(0, 200) ?? `HTTP ${status}`
  const err = Object.assign(new Error(`${method} ${path}: ${base}`), { status })
  return err
}

function describeError(err: unknown): string {
  const status = (err as { status?: number })?.status
  if (status === 401) return 'Token invalid (401)'
  if (status === 403) return 'Forbidden (403)'
  if (status === 404) return 'Not found (404) — check base URL'
  if (status === 429) return 'Rate limited (429)'
  if (status && status >= 500) return `Vikunja server error (${status})`
  return err instanceof Error ? err.message : String(err)
}
