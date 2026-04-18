import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TodoistApi } from '@doist/todoist-sdk'
import { TodoistBackend } from '../TodoistBackend'

// Fixtures shaped like the SDK's Task/Project types. We only populate the
// fields TodoistBackend reads — the SDK types have many more, but the mapper
// ignores them.
const PROJECTS_FIXTURE = [
  { id: '100', name: 'Inbox' } as unknown,
  { id: '101', name: 'Work' } as unknown,
]

const TASKS_FIXTURE = [
  {
    id: '1',
    content: 'Submit taxes',
    description: '',
    checked: false,
    priority: 4,
    due: {
      isRecurring: false,
      string: 'today',
      date: '2026-04-18',
      datetime: null,
    },
    projectId: '101',
    parentId: null,
    labels: ['irs'],
  } as unknown,
  {
    id: '2',
    content: 'Gym 30min',
    description: '',
    checked: false,
    priority: 1,
    due: {
      isRecurring: false,
      string: 'today',
      date: '2026-04-18',
      datetime: '2026-04-18T18:00:00Z',
    },
    projectId: '100',
    parentId: '99',
    labels: [],
  } as unknown,
]

function makeFakeApi() {
  return {
    getProjects: vi.fn(),
    getTasks: vi.fn(),
    getTasksByFilter: vi.fn(),
    addTask: vi.fn(),
    closeTask: vi.fn(),
    reopenTask: vi.fn(),
    deleteTask: vi.fn(),
  }
}

type FakeApi = ReturnType<typeof makeFakeApi>

function backendWith(api: FakeApi, token = 'tok'): TodoistBackend {
  return new TodoistBackend(token, api as unknown as TodoistApi)
}

describe('TodoistBackend', () => {
  let api: FakeApi

  beforeEach(() => {
    api = makeFakeApi()
  })

  it('testConnection returns ok:false with no token (does not call SDK)', async () => {
    const backend = backendWith(api, '')
    const result = await backend.testConnection()
    expect(result).toEqual({ ok: false, error: 'No token' })
    expect(api.getProjects).not.toHaveBeenCalled()
  })

  it('testConnection returns ok:true on a successful probe', async () => {
    api.getProjects.mockResolvedValueOnce({ results: [], nextCursor: null })
    const result = await backendWith(api).testConnection()
    expect(result.ok).toBe(true)
    expect(api.getProjects).toHaveBeenCalledWith({ limit: 1 })
  })

  it('testConnection maps 401 to a token-invalid message', async () => {
    // Build something that passes the isHttpError guard (status prop).
    const err = Object.assign(new Error('Unauthorized'), { status: 401 })
    api.getProjects.mockRejectedValueOnce(err)
    const result = await backendWith(api, 'bad').testConnection()
    expect(result.ok).toBe(false)
    if (result.ok === false) expect(result.error).toMatch(/Token invalid/)
  })

  it('getProjects maps the SDK response shape to TodoProject[]', async () => {
    api.getProjects.mockResolvedValueOnce({
      results: PROJECTS_FIXTURE,
      nextCursor: null,
    })
    const projects = await backendWith(api).getProjects()
    expect(projects).toEqual([
      { id: '100', name: 'Inbox' },
      { id: '101', name: 'Work' },
    ])
  })

  it('getDefaultProject returns the Inbox project', async () => {
    api.getProjects.mockResolvedValueOnce({
      results: PROJECTS_FIXTURE,
      nextCursor: null,
    })
    const inbox = await backendWith(api).getDefaultProject()
    expect(inbox?.name).toBe('Inbox')
  })

  it('getTasks("today") hits getTasksByFilter with today | overdue', async () => {
    api.getTasksByFilter.mockResolvedValueOnce({
      results: TASKS_FIXTURE,
      nextCursor: null,
    })
    await backendWith(api).getTasks('today')
    expect(api.getTasksByFilter).toHaveBeenCalledWith({ query: 'today | overdue' })
    expect(api.getTasks).not.toHaveBeenCalled()
  })

  it('getTasks("all") hits getTasks with no filter', async () => {
    api.getTasks.mockResolvedValueOnce({
      results: TASKS_FIXTURE,
      nextCursor: null,
    })
    await backendWith(api).getTasks('all')
    expect(api.getTasks).toHaveBeenCalledWith({})
    expect(api.getTasksByFilter).not.toHaveBeenCalled()
  })

  it('getTasks("project", id) hits getTasks with projectId', async () => {
    api.getTasks.mockResolvedValueOnce({ results: [], nextCursor: null })
    await backendWith(api).getTasks('project', '101')
    expect(api.getTasks).toHaveBeenCalledWith({ projectId: '101' })
  })

  it('getTasks("project") without projectId throws', async () => {
    await expect(backendWith(api).getTasks('project')).rejects.toThrow(
      /projectId required/,
    )
  })

  it('getTasks maps priority, due, and project_id correctly', async () => {
    api.getTasksByFilter.mockResolvedValueOnce({
      results: TASKS_FIXTURE,
      nextCursor: null,
    })
    const tasks = await backendWith(api).getTasks('today')
    expect(tasks[0]).toMatchObject({
      id: '1',
      title: 'Submit taxes',
      isCompleted: false,
      priority: 4,
      dueDate: '2026-04-18',
      projectId: '101',
      labels: ['irs'],
      parentId: undefined,
    })
    // datetime preferred over date when both present
    expect(tasks[1].dueDate).toBe('2026-04-18T18:00:00Z')
    // empty label array becomes undefined
    expect(tasks[1].labels).toBeUndefined()
    // parentId "99" propagates through
    expect(tasks[1].parentId).toBe('99')
  })

  it('completeTask calls closeTask on the SDK', async () => {
    api.closeTask.mockResolvedValueOnce(true)
    await backendWith(api).completeTask('abc')
    expect(api.closeTask).toHaveBeenCalledWith('abc')
  })

  it('uncompleteTask calls reopenTask on the SDK', async () => {
    api.reopenTask.mockResolvedValueOnce(true)
    await backendWith(api).uncompleteTask('abc')
    expect(api.reopenTask).toHaveBeenCalledWith('abc')
  })

  it('createTask forwards title and optional projectId', async () => {
    api.addTask.mockResolvedValueOnce(TASKS_FIXTURE[0])
    await backendWith(api).createTask({ title: 'New thing', projectId: '100' })
    expect(api.addTask).toHaveBeenCalledWith({
      content: 'New thing',
      projectId: '100',
    })
  })

  it('createTask omits projectId when unset', async () => {
    api.addTask.mockResolvedValueOnce(TASKS_FIXTURE[0])
    await backendWith(api).createTask({ title: 'New thing' })
    const args = api.addTask.mock.calls[0][0]
    expect(args).toEqual({ content: 'New thing' })
  })

  it('deleteTask forwards the id', async () => {
    api.deleteTask.mockResolvedValueOnce(true)
    await backendWith(api).deleteTask('abc')
    expect(api.deleteTask).toHaveBeenCalledWith('abc')
  })
})
