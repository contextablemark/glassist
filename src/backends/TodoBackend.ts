import type { TodoProject, TodoTask } from '../types'

export type TaskView = 'today' | 'upcoming' | 'inbox' | 'all' | 'project'

/**
 * A single page of tasks. `hasMore` is true when the backend has more
 * results than fit in this page — surfaced as a "+" suffix on Home
 * counts. Pagination continuation tokens are kept inside the adapter
 * since nothing higher up needs them yet.
 */
export interface TaskPage {
  tasks: TodoTask[]
  hasMore: boolean
}

export interface TodoBackend {
  readonly name: 'Todoist' | 'Vikunja'

  getTasks(view: TaskView, projectId?: string): Promise<TaskPage>
  getSubtasks(parentId: string): Promise<TodoTask[]>
  completeTask(id: string): Promise<void>
  uncompleteTask(id: string): Promise<void>
  createTask(input: { title: string; projectId?: string }): Promise<TodoTask>
  deleteTask(id: string): Promise<void>

  getProjects(): Promise<TodoProject[]>
  getDefaultProject(): Promise<TodoProject | null>
  testConnection(): Promise<{ ok: true } | { ok: false; error: string }>
}
