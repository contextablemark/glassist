import type { TodoTask } from '../types'

export type PriorityGlyph = '★' | '●' | '◆' | '◇' | '○'

/** Glyph used when a task has no priority set (Vikunja priority 0). */
export const NO_PRIORITY_GLYPH = ' '

export function priorityGlyph(
  priority: TodoTask['priority']
): PriorityGlyph | typeof NO_PRIORITY_GLYPH {
  switch (priority) {
    case 5: return '★'
    case 4: return '●'
    case 3: return '◆'
    case 2: return '◇'
    case 1: return '○'
    default: return NO_PRIORITY_GLYPH
  }
}

export const COMPLETED_GLYPH = '×'
