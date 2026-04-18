import { describe, expect, it } from 'vitest'
import { formatDue } from '../due'

const NOW = new Date('2026-04-18T12:00:00')

function offsetISO(days: number): string {
  const d = new Date(NOW)
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

describe('formatDue', () => {
  it('returns "" for missing or invalid input', () => {
    expect(formatDue(undefined, NOW)).toBe('')
    expect(formatDue('not-a-date', NOW)).toBe('')
  })

  it('labels past due as "late"', () => {
    expect(formatDue(offsetISO(-1), NOW)).toBe('late')
    expect(formatDue(offsetISO(-30), NOW)).toBe('late')
  })

  it('labels today and tomorrow', () => {
    expect(formatDue(offsetISO(0), NOW)).toBe('today')
    expect(formatDue(offsetISO(1), NOW)).toBe('tmrw')
  })

  it('uses Nd form for 2-6 days out', () => {
    expect(formatDue(offsetISO(2), NOW)).toBe('2d')
    expect(formatDue(offsetISO(6), NOW)).toBe('6d')
  })

  it('uses day-of-week abbreviation for 7-13 days out', () => {
    // 2026-04-18 is Saturday; +7 → Saturday again
    expect(formatDue(offsetISO(7), NOW)).toBe('sat')
    expect(formatDue(offsetISO(10), NOW)).toBe('tue')
  })

  it('uses M/D for 14+ days out', () => {
    expect(formatDue(offsetISO(14), NOW)).toBe('5/2')
    expect(formatDue(offsetISO(30), NOW)).toBe('5/18')
  })

  it('never exceeds 5 characters', () => {
    for (let i = -5; i < 365; i++) {
      const s = formatDue(offsetISO(i), NOW)
      expect(s.length).toBeLessThanOrEqual(5)
    }
  })
})
