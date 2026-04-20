import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  VikunjaBackend,
  buildProjectsWithPaths,
  filterForView,
  normalizeBaseUrl,
} from '../VikunjaBackend'

// Minimal mock Response for fetch stubs. `ok` is derived from `status`.
function jsonResponse(status: number, body: unknown): Response {
  const ok = status >= 200 && status < 300
  const serialized = body === undefined ? '' : JSON.stringify(body)
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    headers: new Headers({ 'content-length': String(serialized.length) }),
    async json() { return body },
    async text() { return serialized },
  } as unknown as Response
}

function setup() {
  const fetchSpy = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
  const backend = new VikunjaBackend(
    'tk_test',
    'https://vkj.local',
    '', // no proxy — direct
    fetchSpy,
  )
  return { backend, fetchSpy }
}

// URL that the backend produces given a path. In test (DEV) mode our
// apiRoot() returns the /vikunja-proxy path; asserting against that.
const API = '/vikunja-proxy/api/v1'

const PROJECTS_FIXTURE = [
  { id: 1, title: 'Inbox' },
  { id: 2, title: 'Work' },
  { id: 3, title: 'Home' },
]

const TASKS_FIXTURE = [
  {
    id: 10,
    title: 'Submit taxes',
    done: false,
    priority: 4,
    due_date: '2026-04-20T00:00:00Z',
    project_id: 2,
    labels: [{ id: 1, title: 'irs' }],
    related_tasks: {},
  },
  {
    id: 11,
    title: 'Subtask',
    done: false,
    priority: 2,
    due_date: '0001-01-01T00:00:00Z', // Vikunja zero-date sentinel
    project_id: 2,
    related_tasks: { parenttask: [{ id: 10, title: 'Submit taxes' }] },
  },
  {
    id: 12,
    title: 'No priority',
    done: false,
    priority: 0,
    project_id: 3,
    related_tasks: {},
  },
]

describe('VikunjaBackend', () => {
  let fetchSpy: ReturnType<typeof vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>>
  let backend: VikunjaBackend

  beforeEach(() => {
    ;({ backend, fetchSpy } = setup())
  })

  it('testConnection returns ok:false with no token (no fetch)', async () => {
    const b = new VikunjaBackend('', 'https://vkj.local', '', fetchSpy)
    const result = await b.testConnection()
    expect(result).toEqual({ ok: false, error: 'No token' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('testConnection returns ok:true when /projects succeeds', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(200, PROJECTS_FIXTURE))
    const result = await backend.testConnection()
    expect(result.ok).toBe(true)
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe(`${API}/projects?per_page=1`)
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer tk_test')
  })

  it('testConnection maps 401 response to "Token invalid"', async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse(401, { message: 'invalid token' }),
    )
    const result = await backend.testConnection()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/Token invalid/)
  })

  it('getProjects maps numeric ids to strings and uses `title` as name', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(200, PROJECTS_FIXTURE))
    const projects = await backend.getProjects()
    expect(projects).toEqual([
      { id: '1', name: 'Inbox' },
      { id: '2', name: 'Work' },
      { id: '3', name: 'Home' },
    ])
  })

  it('getTasks("all") hits /tasks with done=false filter', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(200, TASKS_FIXTURE))
    await backend.getTasks('all')
    const [url] = fetchSpy.mock.calls[0]
    expect(url).toContain(`${API}/tasks?`)
    expect(decodeURIComponent(String(url))).toContain('filter=done = false')
    // Spaces must be %20-encoded, not "+", so Vikunja's parser doesn't
    // read them as literal plus signs.
    expect(url).not.toContain('filter=done+')
  })

  it('getTasks("today") uses start-of-tomorrow as upper bound', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(200, TASKS_FIXTURE))
    await backend.getTasks('today')
    const [url] = fetchSpy.mock.calls[0]
    expect(decodeURIComponent(String(url))).toContain(
      'filter=done = false && due_date > 1970-01-01 && due_date < now/d+1d',
    )
    expect(url).toContain('filter_include_nulls=false')
  })

  it('getTasks("upcoming") starts strictly at tomorrow', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(200, TASKS_FIXTURE))
    await backend.getTasks('upcoming')
    const [url] = fetchSpy.mock.calls[0]
    expect(decodeURIComponent(String(url))).toContain(
      'filter=done = false && due_date >= now/d+1d',
    )
  })

  it('getTasks("inbox") resolves the Inbox project id and filters by done=false', async () => {
    fetchSpy
      .mockResolvedValueOnce(jsonResponse(200, PROJECTS_FIXTURE))
      .mockResolvedValueOnce(jsonResponse(200, [TASKS_FIXTURE[0]]))
    await backend.getTasks('inbox')
    expect(fetchSpy.mock.calls[0][0]).toContain('/projects?per_page=')
    const tasksUrl = String(fetchSpy.mock.calls[1][0])
    expect(tasksUrl).toContain('/projects/1/tasks?')
    expect(decodeURIComponent(tasksUrl)).toContain('filter=done = false')
  })

  it('getTasks("project") filters by done=false', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(200, []))
    await backend.getTasks('project', '2')
    const url = String(fetchSpy.mock.calls[0][0])
    expect(url).toContain('/projects/2/tasks?')
    expect(decodeURIComponent(url)).toContain('filter=done = false')
  })

  it('getTasks("project") without projectId throws', async () => {
    await expect(backend.getTasks('project')).rejects.toThrow(/projectId required/)
  })

  it('getTasks surfaces hasMore when the page is full', async () => {
    const many = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      title: `t${i}`,
      project_id: 2,
      related_tasks: {},
    }))
    fetchSpy.mockResolvedValueOnce(jsonResponse(200, many))
    const page = await backend.getTasks('all')
    expect(page.hasMore).toBe(true)
  })

  it('mapTask: priority 0 → undefined, 0001-01-01 due dates → undefined, parentId from related_tasks map', async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse(200, [TASKS_FIXTURE[1], TASKS_FIXTURE[2]]),
    )
    const { tasks } = await backend.getTasks('all')
    expect(tasks[0].dueDate).toBeUndefined()
    // parentId derived from related_tasks.parenttask[0].id in v2 shape
    expect(tasks[0].parentId).toBe('10')
    expect(tasks[1].priority).toBeUndefined()
  })

  it('getSubtasks uses inlined children from v2 related_tasks.subtask', async () => {
    const parent = {
      id: 100,
      title: 'Plan trip',
      project_id: 2,
      related_tasks: {
        subtask: [
          { id: 101, title: 'Book flights', project_id: 2, related_tasks: {} },
          { id: 102, title: 'Reserve hotel', project_id: 2, related_tasks: {} },
        ],
      },
    }
    fetchSpy.mockResolvedValueOnce(jsonResponse(200, parent))
    const subs = await backend.getSubtasks('100')
    expect(fetchSpy).toHaveBeenCalledTimes(1) // no extra round-trips
    expect(subs.map((s) => s.title)).toEqual(['Book flights', 'Reserve hotel'])
  })

  it('getSubtasks falls back to N+1 fetches for v1-shape related_tasks', async () => {
    const parent = {
      id: 100,
      title: 'Plan trip',
      project_id: 2,
      related_tasks: [
        { task_id: 101, relation_kind: 'subtask' },
        { task_id: 102, relation_kind: 'subtask' },
        { task_id: 103, relation_kind: 'related' },
      ],
    }
    fetchSpy
      .mockResolvedValueOnce(jsonResponse(200, parent))
      .mockResolvedValueOnce(
        jsonResponse(200, { id: 101, title: 'Book flights', related_tasks: {} }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { id: 102, title: 'Reserve hotel', related_tasks: {} }),
      )
    const subs = await backend.getSubtasks('100')
    expect(fetchSpy).toHaveBeenCalledTimes(3)
    expect(subs.map((s) => s.title)).toEqual(['Book flights', 'Reserve hotel'])
  })

  it('completeTask POSTs /tasks/{id} with done:true', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(200, { id: 42, done: true }))
    await backend.completeTask('42')
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe(`${API}/tasks/42`)
    expect(init?.method).toBe('POST')
    expect(init?.body).toBe('{"done":true}')
  })

  it('uncompleteTask POSTs /tasks/{id} with done:false', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(200, { id: 42, done: false }))
    await backend.uncompleteTask('42')
    const [, init] = fetchSpy.mock.calls[0]
    expect(init?.body).toBe('{"done":false}')
  })

  it('createTask PUTs /projects/{inbox}/tasks when no projectId given', async () => {
    fetchSpy
      .mockResolvedValueOnce(jsonResponse(200, PROJECTS_FIXTURE))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          id: 77,
          title: 'New task',
          project_id: 1,
          related_tasks: {},
        }),
      )
    const task = await backend.createTask({ title: 'New task' })
    expect(fetchSpy.mock.calls[1][0]).toBe(`${API}/projects/1/tasks`)
    expect(fetchSpy.mock.calls[1][1]?.method).toBe('PUT')
    expect(fetchSpy.mock.calls[1][1]?.body).toBe(
      '{"title":"New task","project_id":1}',
    )
    expect(task.title).toBe('New task')
  })

  it('createTask forwards explicit projectId', async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse(200, {
        id: 88,
        title: 'x',
        project_id: 2,
        related_tasks: {},
      }),
    )
    await backend.createTask({ title: 'x', projectId: '2' })
    expect(fetchSpy.mock.calls[0][0]).toBe(`${API}/projects/2/tasks`)
  })

  it('deleteTask DELETEs /tasks/{id}', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(204, undefined))
    await backend.deleteTask('42')
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe(`${API}/tasks/42`)
    expect(init?.method).toBe('DELETE')
  })
})

describe('VikunjaBackend — proxy routing', () => {
  it('routes through the configured proxy URL when set (overrides dev middleware)', async () => {
    const fetchSpy = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >()
    fetchSpy.mockResolvedValueOnce(jsonResponse(200, []))
    const backend = new VikunjaBackend(
      'tk_test',
      'https://app.vikunja.cloud',
      'https://my-relay.workers.dev',
      fetchSpy,
    )
    await backend.getTasks('all')
    const [url] = fetchSpy.mock.calls[0]
    expect(String(url)).toMatch(/^https:\/\/my-relay\.workers\.dev\/api\/v1\/tasks\?/)
  })

  it('trims trailing slashes on the proxy URL before appending /api/v1', async () => {
    const fetchSpy = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >()
    fetchSpy.mockResolvedValueOnce(jsonResponse(200, []))
    const backend = new VikunjaBackend(
      'tk_test',
      'https://app.vikunja.cloud',
      'https://my-relay.workers.dev/', // trailing slash
      fetchSpy,
    )
    await backend.getTasks('all')
    const [url] = fetchSpy.mock.calls[0]
    expect(String(url)).toMatch(/^https:\/\/my-relay\.workers\.dev\/api\/v1\/tasks\?/)
  })
})

describe('normalizeBaseUrl', () => {
  it('appends /api/v1 when absent', () => {
    expect(normalizeBaseUrl('https://v.example.com')).toBe(
      'https://v.example.com/api/v1',
    )
  })
  it('strips a trailing slash', () => {
    expect(normalizeBaseUrl('https://v.example.com/')).toBe(
      'https://v.example.com/api/v1',
    )
  })
  it('passes through an already-suffixed URL', () => {
    expect(normalizeBaseUrl('https://v.example.com/api/v1')).toBe(
      'https://v.example.com/api/v1',
    )
    expect(normalizeBaseUrl('https://v.example.com/api/v2')).toBe(
      'https://v.example.com/api/v2',
    )
  })
})

describe('buildProjectsWithPaths', () => {
  it('formats flat projects unchanged', () => {
    const out = buildProjectsWithPaths([
      { id: 1, title: 'Inbox' },
      { id: 2, title: 'Work' },
    ])
    expect(out).toEqual([
      { id: '1', name: 'Inbox' },
      { id: '2', name: 'Work' },
    ])
  })

  it('joins parent titles with › for nested projects', () => {
    const out = buildProjectsWithPaths([
      { id: 1, title: 'Work' },
      { id: 2, title: 'Launch', parent_project_id: 1 },
      { id: 3, title: 'Copy', parent_project_id: 2 },
    ])
    expect(out).toEqual([
      { id: '1', name: 'Work' },
      { id: '2', name: 'Work › Launch' },
      { id: '3', name: 'Work › Launch › Copy' },
    ])
  })

  it('treats parent_project_id=0 as no parent', () => {
    const out = buildProjectsWithPaths([
      { id: 7, title: 'Top', parent_project_id: 0 },
    ])
    expect(out[0]).toEqual({ id: '7', name: 'Top' })
  })

  it('guards against cycles', () => {
    // Defensive — Vikunja shouldn't emit these, but we don't want to loop
    // forever if it does.
    const out = buildProjectsWithPaths([
      { id: 1, title: 'A', parent_project_id: 2 },
      { id: 2, title: 'B', parent_project_id: 1 },
    ])
    expect(out).toHaveLength(2)
    for (const p of out) expect(typeof p.name).toBe('string')
  })

  it('stops when an ancestor is missing from the payload', () => {
    const out = buildProjectsWithPaths([
      { id: 3, title: 'Child', parent_project_id: 99 },
    ])
    expect(out[0]).toEqual({ id: '3', name: 'Child' })
  })

  it('drops entries without an id (malformed backend response)', () => {
    const out = buildProjectsWithPaths([
      { title: 'Orphan' } as never,
      { id: 2, title: 'Work' },
    ])
    expect(out).toEqual([{ id: '2', name: 'Work' }])
  })
})

describe('filterForView', () => {
  it('returns correct filter strings', () => {
    expect(filterForView('all')).toBe('done = false')
    expect(filterForView('today')).toBe(
      'done = false && due_date > 1970-01-01 && due_date < now/d+1d',
    )
    expect(filterForView('upcoming')).toBe(
      'done = false && due_date >= now/d+1d',
    )
  })
})
