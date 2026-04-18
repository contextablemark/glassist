import type { TodoProject, TodoTask } from '../types'

export type TaskView = 'today' | 'upcoming' | 'inbox' | 'all' | 'project'

export interface TodoBackend {
  readonly name: 'Todoist' | 'Vikunja'

  getTasks(view: TaskView, projectId?: string): Promise<TodoTask[]>
  completeTask(id: string): Promise<void>
  uncompleteTask(id: string): Promise<void>
  createTask(input: { title: string; projectId?: string }): Promise<TodoTask>
  deleteTask(id: string): Promise<void>

  getProjects(): Promise<TodoProject[]>
  getDefaultProject(): Promise<TodoProject | null>
  testConnection(): Promise<{ ok: true } | { ok: false; error: string }>
}
