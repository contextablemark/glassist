import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TaskPage, TaskView, TodoBackend } from '../../backends'
import type { GlassistSettings, TodoTask } from '../../types'
import { DEFAULT_SETTINGS } from '../../types'
import { Nav, type Scene } from '../nav'

const BASE_SETTINGS: GlassistSettings = DEFAULT_SETTINGS

function task(id: string, title: string, overrides: Partial<TodoTask> = {}): TodoTask {
  return {
    id,
    title,
    isCompleted: false,
    priority: 2,
    ...overrides,
  }
}

function page(tasks: TodoTask[], hasMore = false): TaskPage {
  return { tasks, hasMore }
}

function makeFakeBackend(): TodoBackend & {
  getTasks: ReturnType<typeof vi.fn>
  getSubtasks: ReturnType<typeof vi.fn>
  completeTask: ReturnType<typeof vi.fn>
  uncompleteTask: ReturnType<typeof vi.fn>
} {
  const api = {
    name: 'Todoist' as const,
    getTasks: vi.fn(),
    getSubtasks: vi.fn(),
    completeTask: vi.fn().mockResolvedValue(undefined),
    uncompleteTask: vi.fn().mockResolvedValue(undefined),
    createTask: vi.fn(),
    deleteTask: vi.fn(),
    getProjects: vi.fn(),
    getDefaultProject: vi.fn(),
    testConnection: vi.fn(),
  }
  return api as unknown as TodoBackend & typeof api
}

async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

function expectList(scene: Scene): Extract<Scene, { kind: 'list' }> {
  if (scene.kind !== 'list') throw new Error(`expected list scene, got ${scene.kind}`)
  return scene
}

function expectStatus(scene: Scene): Extract<Scene, { kind: 'status' }> {
  if (scene.kind !== 'status') throw new Error(`expected status scene, got ${scene.kind}`)
  return scene
}

describe('Nav', () => {
  let backend: ReturnType<typeof makeFakeBackend>
  let onChange: ReturnType<typeof vi.fn>

  beforeEach(() => {
    backend = makeFakeBackend()
    onChange = vi.fn()
  })

  it('emits a no-token status scene when backend is null', () => {
    const nav = new Nav({ backend: null, settings: BASE_SETTINGS })
    const scene = expectStatus(nav.render())
    expect(scene.text).toMatch(/Open Glassist on your phone/)
  })

  it('emits a home list scene with "Glassist" header and (…) placeholders while counts load', async () => {
    let resolveInbox: (p: TaskPage) => void = () => {}
    backend.getTasks.mockImplementation((view: TaskView) => {
      if (view === 'inbox') return new Promise<TaskPage>((r) => (resolveInbox = r))
      return Promise.resolve(page([]))
    })
    const nav = new Nav({ backend, settings: BASE_SETTINGS, onChange })
    const initial = expectList(nav.render())
    expect(initial.header).toMatch(/Glassist/)
    // Inbox is the first row in the menu.
    expect(initial.items[0]).toMatch(/Inbox.*\(…\)/)
    await flush()
    resolveInbox(page([task('t1', 'x')]))
    await flush()
    expect(expectList(nav.render()).items[0]).toMatch(/Inbox.*\(1\)/)
  })

  it('appends "+" to a home count when hasMore is true', async () => {
    backend.getTasks.mockImplementation(async (view: TaskView) => {
      if (view === 'all') return page([task('a', 'x')], true)
      return page([])
    })
    const nav = new Nav({ backend, settings: BASE_SETTINGS, onChange })
    await flush()
    const scene = expectList(nav.render())
    expect(scene.items[3]).toMatch(/All tasks.*\(1\+\)/)
  })

  it('tap on a home menu item pushes the corresponding list', async () => {
    backend.getTasks.mockResolvedValue(page([]))
    const nav = new Nav({ backend, settings: BASE_SETTINGS, onChange })
    await flush()
    nav.onTap(0) // Inbox (first menu row)
    const loading = expectStatus(nav.render())
    expect(loading.text).toMatch(/Inbox/)
    expect(loading.text).toMatch(/Loading…/)
    await flush()
    // Empty list renders as a list scene with just the Back item + placeholder.
    const afterLoad = expectList(nav.render())
    expect(afterLoad.items[0]).toMatch(/Back/)
    expect(afterLoad.items[1]).toMatch(/no tasks/)
  })

  it('list scenes prepend a "▲ Back" item at index 0', async () => {
    backend.getTasks.mockResolvedValue(page([task('a', 'Call dentist')]))
    const nav = new Nav({ backend, settings: BASE_SETTINGS, onChange })
    await flush()
    nav.onTap(0) // Today
    await flush()
    const scene = expectList(nav.render())
    expect(scene.items[0]).toMatch(/▲ Back/)
    expect(scene.items[1]).toMatch(/Call dentist/)
  })

  it('tap on index 0 (Back) pops the level', async () => {
    backend.getTasks.mockResolvedValue(page([task('a', 'x')]))
    const nav = new Nav({ backend, settings: BASE_SETTINGS, onChange })
    await flush()
    nav.onTap(0) // Today
    await flush()
    expect(nav.isAtRoot()).toBe(false)
    nav.onTap(0) // Back
    expect(nav.isAtRoot()).toBe(true)
  })

  it('tap on a leaf task completes it and surfaces a "done:" toast in the header', async () => {
    backend.getTasks.mockResolvedValue(page([task('a', 'Call dentist')]))
    backend.getSubtasks.mockResolvedValue([])
    const nav = new Nav({ backend, settings: BASE_SETTINGS, onChange })
    await flush()
    nav.onTap(0) // Today
    await flush()
    nav.onTap(1) // task at position 1 (Back is 0)
    await flush()
    expect(backend.getSubtasks).toHaveBeenCalledWith('a')
    expect(backend.completeTask).toHaveBeenCalledWith('a')
    const scene = expectList(nav.render())
    // List items do NOT get an inline × — the list container is left
    // untouched so firmware selection stays put.
    expect(scene.items[1]).not.toMatch(/×/)
    // The header carries the feedback.
    expect(scene.header).toMatch(/done: Call dentist/)
  })

  it('tap on a session-completed task emits an "undo:" toast and calls uncompleteTask', async () => {
    const subtask = task('c1', 'Book flight')
    backend.getTasks.mockResolvedValue(page([task('p', 'Plan trip')]))
    backend.getSubtasks.mockImplementation(async (id: string) => {
      if (id === 'p') return [subtask]
      return []
    })
    const nav = new Nav({ backend, settings: BASE_SETTINGS, onChange })
    await flush()
    nav.onTap(0) // Today
    await flush()
    nav.onTap(1) // Plan trip → pushes subtasks frame
    await flush()
    nav.onTap(1) // tap Book flight → completes
    await flush()
    expect(backend.completeTask).toHaveBeenCalledWith('c1')
    expect(expectList(nav.render()).header).toMatch(/done: Book flight/)

    nav.onTap(1) // tap same subtask again → uncompletes
    await flush()
    expect(backend.uncompleteTask).toHaveBeenCalledWith('c1')
    expect(expectList(nav.render()).header).toMatch(/undo: Book flight/)
  })

  it('tap on a parent task pushes a subtasks frame', async () => {
    backend.getTasks.mockResolvedValue(page([task('p', 'Plan trip')]))
    backend.getSubtasks.mockResolvedValue([task('c1', 'Book flight')])
    const nav = new Nav({ backend, settings: BASE_SETTINGS, onChange })
    await flush()
    nav.onTap(0) // Today
    await flush()
    nav.onTap(1) // Plan trip
    await flush()
    expect(backend.getSubtasks).toHaveBeenCalledWith('p')
    expect(backend.completeTask).not.toHaveBeenCalled()
    const scene = expectList(nav.render())
    expect(scene.header).toMatch(/Plan trip/)
    expect(scene.items[0]).toMatch(/▲ Back/)
    expect(scene.items[1]).toMatch(/Book flight/)
  })

  it('scroll up (top boundary) pops back to Home', async () => {
    backend.getTasks.mockResolvedValue(page([task('a', 'x')]))
    const nav = new Nav({ backend, settings: BASE_SETTINGS, onChange })
    await flush()
    nav.onTap(0)
    await flush()
    expect(nav.isAtRoot()).toBe(false)
    nav.onScrollUp()
    expect(nav.isAtRoot()).toBe(true)
  })

  it('shows an error screen when loading fails, and retries on tap', async () => {
    backend.getTasks.mockRejectedValue(new Error('Token invalid (401)'))
    const nav = new Nav({ backend, settings: BASE_SETTINGS, onChange })
    await flush()
    const errScene = expectStatus(nav.render())
    expect(errScene.text).toMatch(/ERROR/)
    expect(errScene.text).toMatch(/Token invalid/)
    backend.getTasks.mockReset()
    backend.getTasks.mockResolvedValue(page([]))
    nav.onTap()
    await flush()
    expect(nav.render().kind).toBe('list')
  })

  it('subtasks are hidden from flat list views (only visible via drill-in)', async () => {
    const parent = task('p', 'Planter for porch')
    const child = task('c', 'Assemble it', { parentId: 'p' })
    backend.getTasks.mockResolvedValue(page([parent, child]))
    const nav = new Nav({ backend, settings: BASE_SETTINGS, onChange })
    await flush()
    nav.onTap(0)
    await flush()
    const scene = expectList(nav.render())
    // Skip the Back item at index 0 when checking content.
    const taskLines = scene.items.slice(1).join('\n')
    expect(taskLines).toMatch(/Planter for porch/)
    expect(taskLines).not.toMatch(/Assemble it/)
  })

  it('home counts reflect only top-level tasks', async () => {
    backend.getTasks.mockImplementation(async (view: TaskView) => {
      if (view === 'all') {
        return page([
          task('p', 'Parent'),
          task('c1', 'child1', { parentId: 'p' }),
          task('c2', 'child2', { parentId: 'p' }),
        ])
      }
      return page([])
    })
    const nav = new Nav({ backend, settings: BASE_SETTINGS, onChange })
    await flush()
    const scene = expectList(nav.render())
    expect(scene.items[3]).toMatch(/All tasks.*\(1\)/)
  })

  it('tasks known to be parents render with ▶ instead of a due label', async () => {
    const parent = task('p', 'Plan trip', { dueDate: new Date().toISOString() })
    const child = task('c', 'Book flights', { parentId: 'p' })
    backend.getTasks.mockImplementation(async (view: TaskView) => {
      if (view === 'all') return page([parent, child])
      if (view === 'today') return page([parent])
      return page([])
    })
    const nav = new Nav({ backend, settings: BASE_SETTINGS, onChange })
    await flush()
    // Today is the second menu row now (Inbox is first).
    nav.onTap(1)
    await flush()
    const scene = expectList(nav.render())
    const planterLine = scene.items.find((l) => l.includes('Plan trip')) ?? ''
    expect(planterLine).toMatch(/▶/)
    expect(planterLine).not.toMatch(/today/)
  })

  it('lists with >20 tasks are truncated to the SDK cap (incl. Back item)', async () => {
    const many = Array.from({ length: 30 }, (_, i) => task(`t${i}`, `Task ${i}`))
    backend.getTasks.mockResolvedValue(page(many))
    const nav = new Nav({ backend, settings: BASE_SETTINGS, onChange })
    await flush()
    nav.onTap(0)
    await flush()
    const scene = expectList(nav.render())
    // Back + 19 tasks = 20 total.
    expect(scene.items.length).toBe(20)
    expect(scene.items[0]).toMatch(/Back/)
  })

  it('home hides "+ Speak a task" when STT is off', async () => {
    backend.getTasks.mockResolvedValue(page([]))
    const nav = new Nav({ backend, settings: BASE_SETTINGS, onChange })
    await flush()
    const scene = expectList(nav.render())
    expect(scene.items.some((i) => i.includes('Speak a task'))).toBe(false)
  })

  it('home shows "+ Speak a task" as the first item when STT is configured', async () => {
    backend.getTasks.mockResolvedValue(page([]))
    const voiceSettings: GlassistSettings = {
      ...BASE_SETTINGS,
      stt: { provider: 'soniox', apiKey: 'sk_test', language: 'en' },
    }
    const nav = new Nav({
      backend,
      settings: voiceSettings,
      bridge: {} as never,
      onChange,
    })
    await flush()
    const scene = expectList(nav.render())
    expect(scene.items[0]).toMatch(/Speak a task/)
    // The four view rows shift down by one when Speak is present;
    // Inbox is first in the view list.
    expect(scene.items[1]).toMatch(/Inbox/)
  })

  it('setSettings updates the home menu in place without resetting position', async () => {
    backend.getTasks.mockResolvedValue(page([]))
    const nav = new Nav({
      backend,
      settings: BASE_SETTINGS,
      bridge: {} as never,
      onChange,
    })
    await flush()
    expect(expectList(nav.render()).items.some((i) => i.includes('Speak'))).toBe(false)
    nav.setSettings({
      ...BASE_SETTINGS,
      stt: { provider: 'soniox', apiKey: 'sk', language: 'en' },
    })
    expect(expectList(nav.render()).items.some((i) => i.includes('Speak'))).toBe(true)
  })

  it('refreshes home counts when popping back to Home', async () => {
    backend.getTasks.mockResolvedValue(page([task('a', 'x')]))
    const nav = new Nav({ backend, settings: BASE_SETTINGS, onChange })
    await flush()
    const initialHomeCalls = backend.getTasks.mock.calls.length
    // Navigate into Today then pop back. Back should trigger another
    // round of getTasks('today' | 'upcoming' | 'inbox' | 'all').
    nav.onTap(0) // Today
    await flush()
    const afterPushCalls = backend.getTasks.mock.calls.length
    expect(afterPushCalls).toBeGreaterThan(initialHomeCalls) // push fired loadList
    nav.onTap(0) // Back → pop to Home
    await flush()
    const afterPopCalls = backend.getTasks.mock.calls.length
    expect(afterPopCalls).toBeGreaterThan(afterPushCalls)
  })

  it('setBackend(null) switches to the no-token status scene', async () => {
    backend.getTasks.mockResolvedValue(page([]))
    const nav = new Nav({ backend, settings: BASE_SETTINGS, onChange })
    await flush()
    nav.setBackend(null)
    const scene = expectStatus(nav.render())
    expect(scene.text).toMatch(/Open Glassist on your phone/)
  })
})
