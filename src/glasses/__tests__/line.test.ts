import { describe, expect, it } from 'vitest'
import { LINE_WIDTH, renderMenuLine, renderTaskLine } from '../render/line'

describe('renderTaskLine', () => {
  it('fits within LINE_WIDTH', () => {
    const line = renderTaskLine({
      isCursor: true,
      glyphSlot: '● ',
      title: 'Submit taxes',
      trailing: 'today',
    })
    expect(line.length).toBe(LINE_WIDTH)
  })

  it('renders cursor prefix vs spacer', () => {
    const a = renderTaskLine({ isCursor: true, glyphSlot: '○ ', title: 'x' })
    const b = renderTaskLine({ isCursor: false, glyphSlot: '○ ', title: 'x' })
    expect(a.startsWith('│ ')).toBe(true)
    expect(b.startsWith('  ')).toBe(true)
  })

  it('truncates long titles to stay within the budget', () => {
    const long = 'a'.repeat(100)
    const line = renderTaskLine({
      isCursor: false,
      glyphSlot: '● ',
      title: long,
      trailing: 'today',
    })
    expect(line.length).toBe(LINE_WIDTH)
  })

  it('drops trailing gap when no trailing', () => {
    const line = renderTaskLine({ isCursor: false, glyphSlot: '○ ', title: 'x' })
    expect(line.length).toBe(LINE_WIDTH)
    expect(line.endsWith(' ')).toBe(true)
  })

  it('accepts wider glyph slots (e.g. completion or no-priority)', () => {
    const line = renderTaskLine({
      isCursor: false,
      glyphSlot: '  \u00d7  ', // completed: 5 chars
      title: 'Buy groceries',
      trailing: 'today',
    })
    expect(line.length).toBe(LINE_WIDTH)
  })
})

describe('renderMenuLine', () => {
  it('fits within LINE_WIDTH with count trailing', () => {
    const line = renderMenuLine({ isCursor: true, label: 'Today', trailing: '(7)' })
    expect(line.length).toBe(LINE_WIDTH)
    expect(line.startsWith('│ Today')).toBe(true)
    expect(line.endsWith('(7)')).toBe(true)
  })
})
