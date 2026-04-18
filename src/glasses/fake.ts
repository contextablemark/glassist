import type { TodoProject, TodoTask } from '../types'

function iso(daysFromNow: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  return d.toISOString()
}

export const FAKE_PROJECTS: TodoProject[] = [
  { id: 'inbox', name: 'Inbox' },
  { id: 'work', name: 'Work' },
  { id: 'home', name: 'Home' },
]

export const FAKE_TASKS: TodoTask[] = [
  { id: 't0', title: 'Server is down — FIX', isCompleted: false, priority: 5, dueDate: iso(0), projectId: 'work' },
  { id: 't1', title: 'Submit taxes', isCompleted: false, priority: 4, dueDate: iso(0), projectId: 'work' },
  { id: 't2', title: 'Call dentist', isCompleted: false, priority: 3, dueDate: iso(3), projectId: 'home' },
  { id: 't3', title: 'Water plants', isCompleted: false, priority: 2, dueDate: iso(9), projectId: 'home' },
  { id: 't4', title: 'Archive old receipts', isCompleted: false, priority: 1, projectId: 'home' },
  { id: 't5', title: 'Plan trip to Japan', isCompleted: false, priority: 3, dueDate: iso(20), projectId: 'home' },
  { id: 't5a', title: 'Book flights', isCompleted: false, priority: 3, dueDate: iso(10), projectId: 'home', parentId: 't5' },
  { id: 't5b', title: 'Reserve hotel', isCompleted: false, priority: 2, dueDate: iso(12), projectId: 'home', parentId: 't5' },
  { id: 't5c', title: 'Pack clothes', isCompleted: false, priority: 1, projectId: 'home', parentId: 't5' },
  { id: 't6', title: 'Reply to Dana', isCompleted: false, priority: 2, dueDate: iso(0), projectId: 'work' },
  { id: 't7', title: 'Gym 30min', isCompleted: false, projectId: 'home', dueDate: iso(0) },
  { id: 't8', title: 'Pick up package', isCompleted: false, priority: 2, projectId: 'inbox' },
]

export function todayTasks(): TodoTask[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return FAKE_TASKS.filter((t) => {
    if (t.parentId) return false
    if (!t.dueDate) return false
    const d = new Date(t.dueDate)
    d.setHours(0, 0, 0, 0)
    return d.getTime() <= today.getTime()
  })
}

export function upcomingTasks(): TodoTask[] {
  return FAKE_TASKS.filter((t) => !t.parentId && !!t.dueDate)
}

export function inboxTasks(): TodoTask[] {
  return FAKE_TASKS.filter((t) => !t.parentId && t.projectId === 'inbox')
}

export function allTasks(): TodoTask[] {
  return FAKE_TASKS.filter((t) => !t.parentId)
}

export function subtasksOf(parentId: string): TodoTask[] {
  return FAKE_TASKS.filter((t) => t.parentId === parentId)
}

export function hasSubtasks(taskId: string): boolean {
  return FAKE_TASKS.some((t) => t.parentId === taskId)
}
