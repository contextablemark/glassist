import type { TaskPage, TaskView, TodoBackend } from './TodoBackend'
import type { TodoProject, TodoTask } from '../types'

export class VikunjaBackend implements TodoBackend {
  readonly name = 'Vikunja' as const

  constructor(private token: string, private baseUrl: string) {
    void this.token
    void this.baseUrl
  }

  async getTasks(_view: TaskView, _projectId?: string): Promise<TaskPage> {
    throw new Error('VikunjaBackend.getTasks not implemented')
  }
  async getSubtasks(_parentId: string): Promise<TodoTask[]> {
    throw new Error('VikunjaBackend.getSubtasks not implemented')
  }
  async completeTask(_id: string): Promise<void> {
    throw new Error('VikunjaBackend.completeTask not implemented')
  }
  async uncompleteTask(_id: string): Promise<void> {
    throw new Error('VikunjaBackend.uncompleteTask not implemented')
  }
  async createTask(_input: { title: string; projectId?: string }): Promise<TodoTask> {
    throw new Error('VikunjaBackend.createTask not implemented')
  }
  async deleteTask(_id: string): Promise<void> {
    throw new Error('VikunjaBackend.deleteTask not implemented')
  }
  async getProjects(): Promise<TodoProject[]> {
    throw new Error('VikunjaBackend.getProjects not implemented')
  }
  async getDefaultProject(): Promise<TodoProject | null> {
    throw new Error('VikunjaBackend.getDefaultProject not implemented')
  }
  async testConnection(): Promise<{ ok: true } | { ok: false; error: string }> {
    return { ok: false, error: 'not implemented' }
  }
}
