import { describe, expect, it } from 'vitest'
import { Nav } from '../nav'

describe('Nav', () => {
  it('renders Home at startup', () => {
    const nav = new Nav()
    expect(nav.isAtRoot()).toBe(true)
    const text = nav.render()
    expect(text).toMatch(/Today/)
    expect(text).toMatch(/Upcoming/)
  })

  it('tap on Home pushes the selected list', () => {
    const nav = new Nav()
    const out = nav.tap()
    expect(out.kind).toBe('pushed')
    expect(nav.isAtRoot()).toBe(false)
    expect(nav.render()).toMatch(/Today/)
  })

  it('scroll up at list cursor 0 pops back to Home', () => {
    const nav = new Nav()
    nav.tap()
    expect(nav.isAtRoot()).toBe(false)
    nav.scrollUp()
    expect(nav.isAtRoot()).toBe(true)
  })

  it('tap on header row pops back to Home', () => {
    const nav = new Nav()
    nav.tap()
    const out = nav.tap()
    expect(out.kind).toBe('popped')
    expect(nav.isAtRoot()).toBe(true)
  })

  it('tap on a leaf task toggles completion, re-renders with × glyph', () => {
    const nav = new Nav()
    nav.tap()
    nav.scrollDown()
    const before = nav.render()
    const out = nav.tap()
    expect(out.kind).toBe('toggle')
    if (out.kind === 'toggle') expect(out.nowCompleted).toBe(true)
    const after = nav.render()
    expect(after).not.toBe(before)
    expect(after).toMatch(/×/)
  })
})
