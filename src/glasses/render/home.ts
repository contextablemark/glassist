import { renderMenuLine } from './line'

export interface HomeMenuItem {
  id: string
  label: string
  count: number | null // null = still loading
  hasMore?: boolean
}

/**
 * Render Home menu strings for a ListContainer. Each entry is a single
 * selectable row — firmware paints the selection border around the
 * currently-focused row.
 */
export function renderHomeItems(items: HomeMenuItem[]): string[] {
  return items.map((item) =>
    renderMenuLine({
      label: item.label,
      trailing: formatCount(item),
    }),
  )
}

function formatCount(item: HomeMenuItem): string {
  if (item.count === null) return '(…)'
  return `(${item.count}${item.hasMore ? '+' : ''})`
}
