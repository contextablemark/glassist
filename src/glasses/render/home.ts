import { renderMenuLine } from './line'

export interface HomeMenuItem {
  id: string
  label: string
  count: number
}

export function renderHome(items: HomeMenuItem[], cursor: number): string {
  return items
    .map((item, i) =>
      renderMenuLine({
        isCursor: i === cursor,
        label: item.label,
        trailing: `(${item.count})`,
      })
    )
    .join('\n')
}
