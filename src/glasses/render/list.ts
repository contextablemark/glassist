import type { TodoTask } from '../../types'
import { formatDue } from '../../lib/due'
import { priorityGlyph } from '../../lib/priority'
import { renderMenuLine, renderTaskLine } from './line'

// The firmware font is non-monospaced. These slot widths are tuned on-glass
// to make task titles line up reasonably across the three states:
//   - Priority row:   "● " (glyph + 1 space)       = 2 chars
//   - No-priority:    5 spaces                     = 5 chars
//   - Completed:      " ×  " (1 sp + × + 2 sp)     = 4 chars
// Exact pixel alignment on a proportional font is impossible; these values
// are the closest practical approximation given the available glyphs.
const NO_PRIORITY_SLOT = '     '
const COMPLETED_SLOT = ' \u00d7  '

function buildGlyphSlot(task: TodoTask, completedInSession: boolean): string {
  if (completedInSession) return COMPLETED_SLOT
  if (task.priority === undefined) return NO_PRIORITY_SLOT
  return priorityGlyph(task.priority) + ' '
}

/**
 * Render a list (Level 1 or Level 2) as text.
 *
 *   row 0        = header with ▲, tap to pop level
 *   rows 1..N    = tasks
 */
export function renderList(args: {
  title: string
  tasks: TodoTask[]
  cursor: number
  completedInSession: Set<string>
  hasSubtasks: (id: string) => boolean
}): string {
  const headerLine = renderMenuLine({
    isCursor: args.cursor === 0,
    label: args.title,
    trailing: '▲',
  })
  const taskLines = args.tasks.map((task, i) => {
    const isCursor = args.cursor === i + 1
    const glyphSlot = buildGlyphSlot(task, args.completedInSession.has(task.id))
    const trailing = args.hasSubtasks(task.id) ? '▶' : formatDue(task.dueDate)
    return renderTaskLine({
      isCursor,
      glyphSlot,
      title: task.title,
      trailing: trailing || undefined,
    })
  })
  return [headerLine, ...taskLines].join('\n')
}
