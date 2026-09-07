import { describe, expect, it } from 'vitest'
import { particleNeedsOutline } from './particlePortrait'
describe('light particle contrast', () => {
  it('adds an ink edge to pale colors while preserving their original fill', () => {
    expect(particleNeedsOutline('#ffffff', '#e7e0ed')).toBe(true)
    expect(particleNeedsOutline('#ffecd0', '#e7e0ed')).toBe(true)
    expect(particleNeedsOutline('#b9eaff', '#e7e0ed')).toBe(true)
    expect(particleNeedsOutline('#202030', '#e7e0ed')).toBe(false)
  })
  it('bases its decision on the actual local surface', () => {
    expect(particleNeedsOutline('#ffffff', '#101116')).toBe(false)
    expect(particleNeedsOutline('#202030', '#101116')).toBe(true)
  })
})
