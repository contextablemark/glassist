import type { TodoTask } from '../../types'
import { formatDue } from '../../lib/due'
import { priorityGlyph } from '../../lib/priority'
import { renderMenuLine, renderTaskLine } from './line'

// The firmware font is non-monospaced. Slot widths tuned on-glass so task
// titles line up reasonably:
//   - Priority row:   "● " (glyph + 1 space)   = 2 chars
//   - No-priority:    5 spaces                 = 5 chars
//
// There is intentionally no "completed" glyph slot: completions do not
// rebuild the list container (that would reset firmware selection to 0),
// so an inline × marker never had a chance to appear. Completion feedback
// lives in the header toast instead.
const NO_PRIORITY_SLOT = '     '

function buildGlyphSlot(task: TodoTask): string {
  if (task.priority === undefined) return NO_PRIORITY_SLOT
  return priorityGlyph(task.priority) + ' '
}

/**
 * Render the strings for a ListContainer's `itemName` array. Each entry is
 * one selectable row; the firmware paints its own selection border.
 *
 * Trailing rules:
 *   - If the task is a known parent: `>` (ASCII; the U+25B6 glyph we were
 *     using previously appears to be absent from the firmware font — views
 *     containing a parent row had their rebuildPageContainer rejected.
 *     Testing plain ASCII to confirm the glyph is the cause.)
 *   - Else: compact due label (may be empty)
 */
export function renderListItems(args: {
  tasks: TodoTask[]
  knownParentIds?: ReadonlySet<string>
}): string[] {
  return args.tasks.map((task) => {
    const glyphSlot = buildGlyphSlot(task)
    const isParent = args.knownParentIds?.has(task.id) ?? false
    const trailing = isParent ? '>' : formatDue(task.dueDate)
    return renderTaskLine({
      glyphSlot,
      title: task.title,
      trailing: trailing || undefined,
    })
  })
}

/**
 * Header line rendered as a TextContainer above the ListContainer.
 * No back-affordance glyph — the "▲ Back" synthetic list item handles
 * that, and firmware can only route events to one container per page
 * (the list), so a header arrow would be misleading.
 */
export function renderHeader(title: string): string {
  return renderMenuLine({ label: title })
}
