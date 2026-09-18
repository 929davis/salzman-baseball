import { describe, it, expect } from 'vitest'
import { intentLabel, gateLabel, stageLabel, tierLabel } from './plainLanguage'

describe('plainLanguage lookups', () => {
  it('translates every intent code and preserves the code alongside it', () => {
    expect(intentLabel('I1')).toEqual({ plain: 'Easy', code: 'I1' })
    expect(intentLabel('I4')).toEqual({ plain: 'High effort', code: 'I4' })
    expect(intentLabel('i5')).toEqual({ plain: 'Max effort', code: 'I5' }) // case-insensitive
  })

  it('translates every gate code, G-series and T-series', () => {
    expect(gateLabel('G1').plain).toBe('Cleared for loaded jumps')
    expect(gateLabel('G3').plain).toBe('Cleared for depth jumps/KEAT')
    expect(gateLabel('T1').plain).toBe('Cleared for high-intent throwing (I4-I5)')
    expect(gateLabel('T4').code).toBe('T4')
  })

  it('translates every stage number', () => {
    expect(stageLabel(1).plain).toBe('Learning the shape')
    expect(stageLabel(4).plain).toBe('Proving it live')
    expect(stageLabel(null)).toEqual({ plain: 'Unknown', code: '' })
  })

  it('translates every equipment tier', () => {
    expect(tierLabel('E1').plain).toBe('Full weight room')
    expect(tierLabel('E3').plain).toBe('Bodyweight/bands')
  })

  it('falls back to the raw code rather than crashing on an unrecognized value', () => {
    expect(gateLabel('G99').plain).toBe('G99')
    expect(intentLabel(null).plain).toBe('Unknown')
  })
})
