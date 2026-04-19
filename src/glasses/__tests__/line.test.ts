import { describe, expect, it } from 'vitest'
import { LINE_WIDTH, renderMenuLine, renderTaskLine } from '../render/line'

describe('renderTaskLine', () => {
  it('fits within LINE_WIDTH', () => {
    const line = renderTaskLine({
      glyphSlot: '● ',
      title: 'Submit taxes',
      trailing: 'today',
    })
    expect(line.length).toBe(LINE_WIDTH)
  })

  it('truncates long titles to stay within the budget', () => {
    const long = 'a'.repeat(100)
    const line = renderTaskLine({
      glyphSlot: '● ',
      title: long,
      trailing: 'today',
    })
    expect(line.length).toBe(LINE_WIDTH)
  })

  it('drops trailing gap when no trailing', () => {
    const line = renderTaskLine({ glyphSlot: '○ ', title: 'x' })
    expect(line.length).toBe(LINE_WIDTH)
    expect(line.endsWith(' ')).toBe(true)
  })

  it('accepts wider glyph slots (completion / no-priority)', () => {
    const line = renderTaskLine({
      glyphSlot: ' \u00d7  ',
      title: 'Buy groceries',
      trailing: 'today',
    })
    expect(line.length).toBe(LINE_WIDTH)
  })
})

describe('renderMenuLine', () => {
  it('fits within LINE_WIDTH with count trailing', () => {
    const line = renderMenuLine({ label: 'Today', trailing: '(7)' })
    expect(line.length).toBe(LINE_WIDTH)
    expect(line.startsWith('Today')).toBe(true)
    expect(line.endsWith('(7)')).toBe(true)
  })
})
