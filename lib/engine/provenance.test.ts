import { describe, it, expect } from 'vitest'
import { resolveLoad, resolveCapability, sourced } from './provenance'

describe('resolveLoad', () => {
  it('picks the maximum value across sources, not the most recent or most-trusted', () => {
    const result = resolveLoad([
      sourced(60, 'logged'),
      sourced(120, 'prescribed'),
    ])
    expect(result).toEqual({ value: 120, source: 'prescribed' })
  })

  it('ignores null candidates rather than treating them as 0', () => {
    const result = resolveLoad([
      sourced(null, 'logged'),
      sourced(40, 'prescribed'),
    ])
    expect(result).toEqual({ value: 40, source: 'prescribed' })
  })

  it('falls back to 0/unknown when nothing has a value', () => {
    const result = resolveLoad([sourced(null, 'logged'), sourced(null, 'prescribed')])
    expect(result).toEqual({ value: 0, source: 'unknown' })
  })
})

describe('resolveCapability', () => {
  it('coach_asserted outranks logged even when logged is the only other candidate', () => {
    const result = resolveCapability([
      sourced('developing', 'logged'),
      sourced('restricted', 'coach_asserted'),
    ])
    expect(result).toEqual({ value: 'restricted', source: 'coach_asserted' })
  })

  it('falls through to a lower-precedence source when a higher one is null', () => {
    const result = resolveCapability([
      sourced(null, 'coach_asserted'),
      sourced('developing', 'logged'),
    ])
    expect(result).toEqual({ value: 'developing', source: 'logged' })
  })

  it('never lets prescribed compete for a capability fact', () => {
    // resolveCapability's precedence list has no 'prescribed' entry at all -- a candidate
    // tagged prescribed must never win a capability resolution, only coach_asserted/logged/
    // inferred compete. Passing one in should be a no-op, not a crash or a false positive.
    const result = resolveCapability([sourced('advanced', 'prescribed' as any)])
    expect(result).toEqual({ value: null, source: 'unknown' })
  })
})
