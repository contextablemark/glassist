export const LINE_WIDTH = 38

function padOrTruncate(s: string, width: number): string {
  if (s.length > width) return s.slice(0, width)
  return s.padEnd(width, ' ')
}

/**
 * Render a task line: glyphSlot, title, right-aligned trailing label.
 *
 * No cursor prefix — firmware draws the selection border via
 * ListContainer's `isItemSelectBorderEn`.
 *
 *   [glyphSlot W][title N][space 1][trailing M] where W + N + M + 1 = 38
 */
export function renderTaskLine(args: {
  glyphSlot: string
  title: string
  trailing?: string
}): string {
  const trailing = args.trailing ?? ''
  const trailingWidth = trailing.length === 0 ? 0 : trailing.length + 1
  const titleWidth = LINE_WIDTH - args.glyphSlot.length - trailingWidth
  const title = padOrTruncate(args.title, titleWidth)
  return args.glyphSlot + title + (trailing ? ' ' + trailing : '')
}

/**
 * Render a menu/header line: label padded, right-aligned trailing.
 *
 * When there's no trailing, we DON'T pad to the full width. Trailing
 * spaces at the non-monospaced font's average width can push visible
 * characters past the container edge and wrap onto a second row that
 * gets clipped (especially in a short header container).
 */
export function renderMenuLine(args: {
  label: string
  trailing?: string
}): string {
  const trailing = args.trailing ?? ''
  if (!trailing) {
    return args.label.length > LINE_WIDTH
      ? args.label.slice(0, LINE_WIDTH)
      : args.label
  }
  const trailingWidth = trailing.length + 1
  const labelWidth = LINE_WIDTH - trailingWidth
  const label = padOrTruncate(args.label, labelWidth)
  return label + ' ' + trailing
}
