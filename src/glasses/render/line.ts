export const LINE_WIDTH = 38

// Non-monospaced firmware font — no prefix pair will be pixel-perfect
// stationary, but `│ ` vs `  ` shifts content less than `> ` vs `  ` did.
const CURSOR_PREFIX = '│ '
const SPACER_PREFIX = '  '

function padOrTruncate(s: string, width: number): string {
  if (s.length > width) return s.slice(0, width)
  return s.padEnd(width, ' ')
}

/**
 * Render a task line: cursor, glyphSlot, title, right-aligned trailing label.
 *
 *   [cursor 2][glyphSlot W][title N][space 1][trailing M]
 *   where W + N + M + 3 = 38 (W includes any padding the caller wants).
 *   Trailing empty → title gets the extra width.
 */
export function renderTaskLine(args: {
  isCursor: boolean
  glyphSlot: string      // full glyph column including its own padding
  title: string
  trailing?: string      // right-side label (due, count, etc.)
}): string {
  const cursor = args.isCursor ? CURSOR_PREFIX : SPACER_PREFIX
  const trailing = args.trailing ?? ''
  const trailingWidth = trailing.length === 0 ? 0 : trailing.length + 1
  const titleWidth =
    LINE_WIDTH - cursor.length - args.glyphSlot.length - trailingWidth
  const title = padOrTruncate(args.title, titleWidth)
  return cursor + args.glyphSlot + title + (trailing ? ' ' + trailing : '')
}

/**
 * Render a menu/header line: cursor, label, right-aligned trailing.
 *
 *   [cursor 2][label N][space 1][trailing M]
 */
export function renderMenuLine(args: {
  isCursor: boolean
  label: string
  trailing?: string
}): string {
  const cursor = args.isCursor ? CURSOR_PREFIX : SPACER_PREFIX
  const trailing = args.trailing ?? ''
  const trailingWidth = trailing.length === 0 ? 0 : trailing.length + 1
  const labelWidth = LINE_WIDTH - cursor.length - trailingWidth
  const label = padOrTruncate(args.label, labelWidth)
  return cursor + label + (trailing ? ' ' + trailing : '')
}
