import {
  TodoistApi,
  isHttpError,
  type CustomFetchResponse,
  type PersonalProject,
  type Task,
  type WorkspaceProject,
} from '@doist/todoist-sdk'
import type { TaskPage, TaskView, TodoBackend } from './TodoBackend'
import type { Priority, TodoProject, TodoTask } from '../types'

// Todoist's server-side max per page is 200; we request the cap so Home
// counts are accurate up to 200 and we only need one call per view.
const PAGE_LIMIT = 200

/**
 * Todoist backend, backed by @doist/todoist-sdk.
 *
 * The SDK handles auth headers, pagination envelope ({results, nextCursor}),
 * and error shapes. We adapt its Task/Project types into Glassist's own
 * TodoTask/TodoProject, and translate our TaskView enum into the filter
 * queries the SDK accepts.
 */
export class TodoistBackend implements TodoBackend {
  readonly name = 'Todoist' as const
  private readonly api: TodoistApi

  constructor(
    private readonly token: string,
    api?: TodoistApi,
  ) {
    this.api = api ?? new TodoistApi(token, { customFetch: browserFetch })
  }

  async testConnection(): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!this.token) return { ok: false, error: 'No token' }
    try {
      await this.api.getProjects({ limit: 1 })
      return { ok: true }
    } catch (err) {
      return { ok: false, error: describeError(err) }
    }
  }

  async getProjects(): Promise<TodoProject[]> {
    const { results } = await this.api.getProjects()
    return results.map(mapProject)
  }

  async getDefaultProject(): Promise<TodoProject | null> {
    const projects = await this.getProjects()
    const inbox = projects.find((p) => p.name.toLowerCase() === 'inbox')
    return inbox ?? projects[0] ?? null
  }

  async getTasks(view: TaskView, projectId?: string): Promise<TaskPage> {
    if (view === 'project') {
      if (!projectId) throw new Error('projectId required for project view')
      return toPage(await this.api.getTasks({ projectId, limit: PAGE_LIMIT }))
    }
    if (view === 'all') {
      return toPage(await this.api.getTasks({ limit: PAGE_LIMIT }))
    }
    return toPage(
      await this.api.getTasksByFilter({
        query: viewToFilterQuery(view),
        limit: PAGE_LIMIT,
      }),
    )
  }

  async getSubtasks(parentId: string): Promise<TodoTask[]> {
    const { results } = await this.api.getTasks({ parentId })
    return results.map(mapTask)
  }

  async completeTask(id: string): Promise<void> {
    await this.api.closeTask(id)
  }

  async uncompleteTask(id: string): Promise<void> {
    await this.api.reopenTask(id)
  }

  async createTask(input: { title: string; projectId?: string }): Promise<TodoTask> {
    const task = await this.api.addTask({
      content: input.title,
      ...(input.projectId ? { projectId: input.projectId } : {}),
    })
    return mapTask(task)
  }

  async deleteTask(id: string): Promise<void> {
    await this.api.deleteTask(id)
  }
}

// ── helpers ───────────────────────────────────────────────────────────────

/**
 * Wraps the browser's native fetch to satisfy the SDK's CustomFetchResponse
 * contract. The SDK expects headers as a plain record; `Response.headers` is
 * a `Headers` iterable that we flatten here.
 */
async function browserFetch(
  url: string,
  options?: RequestInit & { timeout?: number },
): Promise<CustomFetchResponse> {
  const { timeout: _timeout, ...init } = options ?? {}
  const res = await fetch(url, init)
  const headers: Record<string, string> = {}
  res.headers.forEach((value, key) => {
    headers[key] = value
  })
  return {
    ok: res.ok,
    status: res.status,
    statusText: res.statusText,
    headers,
    text: () => res.text(),
    json: () => res.json() as Promise<unknown>,
  }
}

function viewToFilterQuery(view: 'today' | 'upcoming' | 'inbox'): string {
  switch (view) {
    case 'today':
      return 'today | overdue'
    case 'upcoming':
      return 'due after: today'
    case 'inbox':
      return '##Inbox'
  }
}

function toPage(response: {
  results: Task[]
  nextCursor: string | null
}): TaskPage {
  return {
    tasks: response.results.map(mapTask),
    hasMore: response.nextCursor !== null,
  }
}

function mapProject(p: PersonalProject | WorkspaceProject): TodoProject {
  return { id: p.id, name: p.name }
}

function mapTask(t: Task): TodoTask {
  return {
    id: t.id,
    title: t.content,
    description: t.description || undefined,
    isCompleted: t.checked,
    priority: normalizePriority(t.priority),
    dueDate: t.due?.datetime ?? t.due?.date ?? undefined,
    projectId: t.projectId,
    labels: t.labels.length > 0 ? t.labels : undefined,
    parentId: t.parentId ?? undefined,
  }
}

// Todoist uses 1=lowest … 4=urgent. Our normalized scale reserves 5 for
// Vikunja's "do now"; Todoist never emits it. Values outside 1–4 become
// "no priority" (undefined).
function normalizePriority(p: number): Priority | undefined {
  if (p >= 1 && p <= 4) return p as Priority
  return undefined
}

function describeError(err: unknown): string {
  if (err instanceof Error && isHttpError(err)) {
    if (err.status === 401) return 'Token invalid (401)'
    if (err.status === 403) return 'Forbidden (403)'
    if (err.status === 404) return 'Not found (404)'
    if (err.status === 429) return 'Rate limited (429)'
    if (err.status && err.status >= 500) return `Todoist server error (${err.status})`
    if (err.status) return `HTTP ${err.status}`
  }
  return err instanceof Error ? err.message : String(err)
}
