import type { TodoTask } from '../types'
import {
  allTasks,
  hasSubtasks,
  inboxTasks,
  subtasksOf,
  todayTasks,
  upcomingTasks,
} from './fake'
import type { HomeMenuItem } from './render/home'
import { renderHome } from './render/home'
import { renderList } from './render/list'

type HomeId = 'today' | 'upcoming' | 'inbox' | 'all'

type Frame =
  | { kind: 'home'; cursor: number; items: HomeMenuItem[] }
  | {
      kind: 'list'
      cursor: number
      title: string
      tasks: TodoTask[]
      completedInSession: Set<string>
    }
  | {
      kind: 'subtasks'
      cursor: number
      title: string
      parentId: string
      tasks: TodoTask[]
      completedInSession: Set<string>
    }

function buildHomeFrame(): Frame {
  const items: HomeMenuItem[] = [
    { id: 'today', label: 'Today', count: todayTasks().length },
    { id: 'upcoming', label: 'Upcoming', count: upcomingTasks().length },
    { id: 'inbox', label: 'Inbox', count: inboxTasks().length },
    { id: 'all', label: 'All tasks', count: allTasks().length },
  ]
  return { kind: 'home', cursor: 0, items }
}

function tasksForHomeId(id: HomeId): { title: string; tasks: TodoTask[] } {
  switch (id) {
    case 'today': return { title: 'Today', tasks: todayTasks() }
    case 'upcoming': return { title: 'Upcoming', tasks: upcomingTasks() }
    case 'inbox': return { title: 'Inbox', tasks: inboxTasks() }
    case 'all': return { title: 'All tasks', tasks: allTasks() }
  }
}

function lastCursor(frame: Frame): number {
  if (frame.kind === 'home') return frame.items.length - 1
  // row 0 = header, rows 1..N = tasks
  return frame.tasks.length
}

export type TapOutcome =
  | { kind: 'stay' }
  | { kind: 'toggle'; taskId: string; nowCompleted: boolean }
  | { kind: 'pushed' }
  | { kind: 'popped' }

export class Nav {
  private stack: Frame[] = [buildHomeFrame()]

  private get top(): Frame {
    return this.stack[this.stack.length - 1]
  }

  render(): string {
    const f = this.top
    if (f.kind === 'home') return renderHome(f.items, f.cursor)
    return renderList({
      title: f.title,
      tasks: f.tasks,
      cursor: f.cursor,
      completedInSession: f.completedInSession,
      hasSubtasks,
    })
  }

  scrollUp(): boolean {
    const f = this.top
    if (f.cursor > 0) {
      f.cursor -= 1
      return true
    }
    if (f.kind === 'home') return false
    this.stack.pop()
    return true
  }

  scrollDown(): boolean {
    const f = this.top
    const last = lastCursor(f)
    if (f.cursor < last) {
      f.cursor += 1
      return true
    }
    return false
  }

  tap(): TapOutcome {
    const f = this.top
    if (f.kind === 'home') {
      const id = f.items[f.cursor].id as HomeId
      const { title, tasks } = tasksForHomeId(id)
      this.stack.push({
        kind: 'list',
        cursor: 0,
        title,
        tasks,
        completedInSession: new Set<string>(),
      })
      return { kind: 'pushed' }
    }
    if (f.cursor === 0) {
      // Header tapped → pop level.
      this.stack.pop()
      return { kind: 'popped' }
    }
    const task = f.tasks[f.cursor - 1]
    if (f.kind === 'list' && hasSubtasks(task.id)) {
      this.stack.push({
        kind: 'subtasks',
        cursor: 0,
        title: task.title,
        parentId: task.id,
        tasks: subtasksOf(task.id),
        completedInSession: new Set<string>(),
      })
      return { kind: 'pushed' }
    }
    const nowCompleted = !f.completedInSession.has(task.id)
    if (nowCompleted) f.completedInSession.add(task.id)
    else f.completedInSession.delete(task.id)
    return { kind: 'toggle', taskId: task.id, nowCompleted }
  }

  /** True if the current frame is the root (Home). */
  isAtRoot(): boolean {
    return this.stack.length === 1 && this.top.kind === 'home'
  }
}
