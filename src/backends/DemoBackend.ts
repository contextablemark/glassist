import type { TaskPage, TaskView, TodoBackend } from './TodoBackend'
import type { TodoProject, TodoTask } from '../types'

/**
 * In-memory backend used when the user hasn't configured a real provider.
 *
 * Keeps Glassist visually "alive" on first run (Vercel demo, fresh phone
 * install) by pre-populating a handful of tasks spread across the Home
 * menu views. Completions flip state on a shared module-level store so
 * the glasses and phone tabs stay in sync within a session, but nothing
 * persists across reloads — every fresh page load starts with the seed.
 *
 * Demo state is module-scoped (not per-instance) because both phone and
 * glasses modes instantiate their own DemoBackend; without sharing, a
 * check-off on glasses wouldn't reflect on the phone settings UI.
 */

const INBOX_ID = 'demo-inbox'
const WORK_ID = 'demo-work'
const PERSONAL_ID = 'demo-personal'

const PROJECTS: TodoProject[] = [
  { id: INBOX_ID, name: 'Inbox' },
  { id: WORK_ID, name: 'Work' },
  { id: PERSONAL_ID, name: 'Personal' },
]

function dayOffset(days: number, hour = 17): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

function seedTasks(): TodoTask[] {
  return [
    {
      id: 'demo-1',
      title: 'Evaluate Glassist',
      isCompleted: false,
      priority: 4,
      dueDate: dayOffset(0),
      projectId: INBOX_ID,
    },
    {
      id: 'demo-2',
      title: 'Try voice quick-add',
      description: 'Paste an STT key on the Voice tab, then tap + Speak a task on glasses.',
      isCompleted: false,
      priority: 3,
      dueDate: dayOffset(0),
      projectId: INBOX_ID,
    },
    {
      id: 'demo-3',
      title: 'Follow up on invoice',
      isCompleted: false,
      priority: 4,
      dueDate: dayOffset(-2),
      projectId: WORK_ID,
    },
    {
      id: 'demo-4',
      title: 'Check out Glass Transit',
      isCompleted: false,
      priority: 3,
      dueDate: dayOffset(1),
      projectId: INBOX_ID,
    },
    {
      id: 'demo-5',
      title: 'Prep Monday standup',
      isCompleted: false,
      priority: 2,
      dueDate: dayOffset(3),
      projectId: WORK_ID,
    },
    {
      id: 'demo-6',
      title: 'Plan weekend hike',
      isCompleted: false,
      priority: 1,
      dueDate: dayOffset(4),
      projectId: PERSONAL_ID,
    },
    {
      id: 'demo-7',
      title: 'Order new notebook',
      isCompleted: false,
      dueDate: dayOffset(5),
      projectId: PERSONAL_ID,
    },
    {
      id: 'demo-8',
      title: 'Read release notes',
      isCompleted: false,
      priority: 1,
      projectId: INBOX_ID,
    },
    {
      id: 'demo-2a',
      title: 'Paste a Soniox key in the Voice tab',
      isCompleted: false,
      projectId: INBOX_ID,
      parentId: 'demo-2',
    },
    {
      id: 'demo-2b',
      title: 'Tap + Speak a task on glasses',
      isCompleted: false,
      projectId: INBOX_ID,
      parentId: 'demo-2',
    },
  ]
}

let tasks: TodoTask[] = seedTasks()
let nextId = 100

function startOfToday(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function startOfTomorrow(): number {
  return startOfToday() + 24 * 60 * 60 * 1000
}

function isTopLevel(t: TodoTask): boolean {
  return !t.parentId
}

function matchesView(t: TodoTask, view: TaskView, projectId?: string): boolean {
  if (t.isCompleted) return false
  // `all` returns subtasks too, matching Todoist/Vikunja shape — Nav
  // filters to top-level for the count and harvests parent IDs from the
  // subtasks that remain (this is how the ▶ chevron indicator lights up).
  if (view === 'all') return true
  if (!isTopLevel(t)) return false
  if (view === 'project') return t.projectId === projectId
  if (view === 'inbox') return t.projectId === INBOX_ID
  if (!t.dueDate) return false
  const due = new Date(t.dueDate).getTime()
  if (Number.isNaN(due)) return false
  if (view === 'today') return due < startOfTomorrow()
  if (view === 'upcoming') return due >= startOfTomorrow()
  return false
}

export class DemoBackend implements TodoBackend {
  readonly name = 'Demo' as const

  async testConnection(): Promise<{ ok: true } | { ok: false; error: string }> {
    return { ok: true }
  }

  async getProjects(): Promise<TodoProject[]> {
    return PROJECTS.slice()
  }

  async getDefaultProject(): Promise<TodoProject | null> {
    return PROJECTS[0]
  }

  async getTasks(view: TaskView, projectId?: string): Promise<TaskPage> {
    const filtered = tasks.filter((t) => matchesView(t, view, projectId))
    return { tasks: filtered.map(clone), hasMore: false }
  }

  async getSubtasks(parentId: string): Promise<TodoTask[]> {
    return tasks.filter((t) => t.parentId === parentId && !t.isCompleted).map(clone)
  }

  async completeTask(id: string): Promise<void> {
    const t = tasks.find((x) => x.id === id)
    if (t) t.isCompleted = true
  }

  async uncompleteTask(id: string): Promise<void> {
    const t = tasks.find((x) => x.id === id)
    if (t) t.isCompleted = false
  }

  async createTask(input: { title: string; projectId?: string }): Promise<TodoTask> {
    const task: TodoTask = {
      id: `demo-new-${nextId++}`,
      title: input.title,
      isCompleted: false,
      projectId: input.projectId ?? INBOX_ID,
    }
    tasks.push(task)
    return clone(task)
  }

  async deleteTask(id: string): Promise<void> {
    tasks = tasks.filter((t) => t.id !== id && t.parentId !== id)
  }
}

function clone(t: TodoTask): TodoTask {
  return { ...t, labels: t.labels ? t.labels.slice() : undefined }
}
