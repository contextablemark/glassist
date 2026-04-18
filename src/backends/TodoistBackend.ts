import type { TodoBackend, TaskView } from './TodoBackend'
import type { TodoProject, TodoTask } from '../types'

export class TodoistBackend implements TodoBackend {
  readonly name = 'Todoist' as const

  constructor(private token: string) {
    void this.token
  }

  async getTasks(_view: TaskView, _projectId?: string): Promise<TodoTask[]> {
    throw new Error('TodoistBackend.getTasks not implemented')
  }
  async completeTask(_id: string): Promise<void> {
    throw new Error('TodoistBackend.completeTask not implemented')
  }
  async uncompleteTask(_id: string): Promise<void> {
    throw new Error('TodoistBackend.uncompleteTask not implemented')
  }
  async createTask(_input: { title: string; projectId?: string }): Promise<TodoTask> {
    throw new Error('TodoistBackend.createTask not implemented')
  }
  async deleteTask(_id: string): Promise<void> {
    throw new Error('TodoistBackend.deleteTask not implemented')
  }
  async getProjects(): Promise<TodoProject[]> {
    throw new Error('TodoistBackend.getProjects not implemented')
  }
  async getDefaultProject(): Promise<TodoProject | null> {
    throw new Error('TodoistBackend.getDefaultProject not implemented')
  }
  async testConnection(): Promise<{ ok: true } | { ok: false; error: string }> {
    return { ok: false, error: 'not implemented' }
  }
}
