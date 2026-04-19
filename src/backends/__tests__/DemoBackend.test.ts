import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DemoBackend as DemoBackendType } from '../DemoBackend'

/**
 * DemoBackend keeps its seed + mutations in module-level state so the
 * phone and glasses views share the same in-memory store. Reset the
 * module between tests so completions/deletes don't leak across cases.
 */
async function freshBackend(): Promise<DemoBackendType> {
  vi.resetModules()
  const mod = await import('../DemoBackend')
  return new mod.DemoBackend()
}

describe('DemoBackend', () => {
  let backend: DemoBackendType

  beforeEach(async () => {
    backend = await freshBackend()
  })

  it('testConnection always succeeds', async () => {
    expect(await backend.testConnection()).toEqual({ ok: true })
  })

  it('returns three projects with Inbox as default', async () => {
    const projects = await backend.getProjects()
    expect(projects.map((p) => p.name)).toEqual(['Inbox', 'Work', 'Personal'])
    const def = await backend.getDefaultProject()
    expect(def?.name).toBe('Inbox')
  })

  it('today view contains today + overdue top-level tasks', async () => {
    const { tasks } = await backend.getTasks('today')
    const titles = tasks.map((t) => t.title)
    expect(titles).toContain('Evaluate Glassist')
    expect(titles).toContain('Follow up on invoice')
    expect(titles).toContain('Try voice quick-add')
    for (const t of tasks) expect(t.parentId).toBeUndefined()
  })

  it('upcoming view starts strictly after today', async () => {
    const { tasks } = await backend.getTasks('upcoming')
    const titles = tasks.map((t) => t.title)
    expect(titles).toContain('Check out Glass Transit')
    expect(titles).not.toContain('Evaluate Glassist')
  })

  it('inbox view filters to the Inbox project', async () => {
    const { tasks } = await backend.getTasks('inbox')
    for (const t of tasks) expect(t.projectId).toBe('demo-inbox')
  })

  it('all view returns every task including subtasks', async () => {
    // Matches Todoist/Vikunja shape: Nav filters to top-level for the
    // count, and scans the subtasks in the same payload to populate
    // knownParentIds for the ▶ chevron.
    const { tasks } = await backend.getTasks('all')
    expect(tasks.length).toBeGreaterThanOrEqual(10)
    const subs = tasks.filter((t) => t.parentId === 'demo-2')
    expect(subs).toHaveLength(2)
  })

  it('list views (today/upcoming/inbox) exclude subtasks', async () => {
    for (const view of ['today', 'upcoming', 'inbox'] as const) {
      const { tasks } = await backend.getTasks(view)
      for (const t of tasks) expect(t.parentId).toBeUndefined()
    }
  })

  it('getSubtasks returns children of a known parent', async () => {
    const subs = await backend.getSubtasks('demo-2')
    expect(subs.length).toBe(2)
    for (const s of subs) expect(s.parentId).toBe('demo-2')
  })

  it('completeTask hides the task from future queries', async () => {
    await backend.completeTask('demo-1')
    const { tasks } = await backend.getTasks('today')
    expect(tasks.find((t) => t.id === 'demo-1')).toBeUndefined()
  })

  it('uncompleteTask restores a completed task', async () => {
    await backend.completeTask('demo-1')
    await backend.uncompleteTask('demo-1')
    const { tasks } = await backend.getTasks('today')
    expect(tasks.find((t) => t.id === 'demo-1')).toBeDefined()
  })

  it('createTask appends to Inbox by default', async () => {
    const t = await backend.createTask({ title: 'New item' })
    expect(t.projectId).toBe('demo-inbox')
    const { tasks } = await backend.getTasks('inbox')
    expect(tasks.find((x) => x.id === t.id)).toBeDefined()
  })

  it('deleteTask removes task and its subtasks', async () => {
    await backend.deleteTask('demo-2')
    const { tasks } = await backend.getTasks('inbox')
    expect(tasks.find((x) => x.id === 'demo-2')).toBeUndefined()
    const subs = await backend.getSubtasks('demo-2')
    expect(subs).toHaveLength(0)
  })

  it('task shapes satisfy what the list renderer needs', async () => {
    const { tasks } = await backend.getTasks('all')
    for (const t of tasks) {
      expect(typeof t.id).toBe('string')
      expect(typeof t.title).toBe('string')
      expect(typeof t.isCompleted).toBe('boolean')
      if (t.priority !== undefined) {
        expect([1, 2, 3, 4, 5]).toContain(t.priority)
      }
      if (t.dueDate !== undefined) {
        expect(Number.isNaN(new Date(t.dueDate).getTime())).toBe(false)
      }
    }
  })
})
