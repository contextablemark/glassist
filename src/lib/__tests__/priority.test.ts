import { describe, expect, it } from 'vitest'
import { COMPLETED_GLYPH, NO_PRIORITY_GLYPH, priorityGlyph } from '../priority'

describe('priorityGlyph', () => {
  it('maps 5 levels to distinct glyphs', () => {
    expect(priorityGlyph(5)).toBe('★')
    expect(priorityGlyph(4)).toBe('●')
    expect(priorityGlyph(3)).toBe('◆')
    expect(priorityGlyph(2)).toBe('◇')
    expect(priorityGlyph(1)).toBe('○')
  })

  it('returns the blank placeholder for undefined priority', () => {
    expect(priorityGlyph(undefined)).toBe(NO_PRIORITY_GLYPH)
    expect(NO_PRIORITY_GLYPH).toBe(' ')
  })
})

describe('COMPLETED_GLYPH', () => {
  it('uses the Latin-1 multiplication sign', () => {
    expect(COMPLETED_GLYPH).toBe('\u00d7')
  })
})
