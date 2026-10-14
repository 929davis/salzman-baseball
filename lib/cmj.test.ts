import {describe,it,expect} from 'vitest'
import {validateCMJTimestamps,calcCMJFn} from './cmj'

describe('validateCMJTimestamps',()=>{
  it('accepts all 6 timestamps in correct order',()=>{
    expect(validateCMJTimestamps({startTime:0,bottomTime:0.3,takeoffTime:0.5,landingTime:1.0,stabilizationTime:1.4,uprightTime:2.0})).toBeNull()
  })
  it('accepts only the 3 required timestamps with the optional ones omitted',()=>{
    expect(validateCMJTimestamps({startTime:0,takeoffTime:0.5,landingTime:1.0})).toBeNull()
  })
  it('rejects takeoff before bottom of loading phase',()=>{
    expect(validateCMJTimestamps({startTime:0,bottomTime:0.6,takeoffTime:0.5,landingTime:1.0})).toMatch(/takeoff.*bottom of the loading phase/)
  })
  it('rejects landing before takeoff',()=>{
    expect(validateCMJTimestamps({startTime:0,takeoffTime:0.5,landingTime:0.4})).toMatch(/landing.*takeoff/)
  })
  it('rejects stabilization before landing',()=>{
    expect(validateCMJTimestamps({startTime:0,takeoffTime:0.5,landingTime:1.0,stabilizationTime:0.9})).toMatch(/stabilization.*landing/)
  })
  it('rejects duplicate (non-increasing) timestamps',()=>{
    expect(validateCMJTimestamps({startTime:0,takeoffTime:0.5,landingTime:0.5})).not.toBeNull()
  })
})

describe('calcCMJFn phase timing',()=>{
  const base={startTime:0,takeoffTime:0.5,landingTime:1.0,massKg:90}

  it('omits timing-only metrics when optional timestamps are not provided',()=>{
    const r=calcCMJFn(base)
    expect(r.eccentricDurationSec).toBeUndefined()
    expect(r.concentricDurationSec).toBeUndefined()
    expect(r.landingStabilizationSec).toBeUndefined()
    expect(r.returnToUprightSec).toBeUndefined()
  })

  it('computes eccentric/concentric duration when bottomTime is provided',()=>{
    const r=calcCMJFn({...base,bottomTime:0.3})
    expect(r.eccentricDurationSec).toBeCloseTo(0.3,10)
    expect(r.concentricDurationSec).toBeCloseTo(0.2,10)
  })

  it('computes landing stabilization and return-to-upright durations independently',()=>{
    const r=calcCMJFn({...base,stabilizationTime:1.3,uprightTime:1.8})
    expect(r.landingStabilizationSec).toBeCloseTo(0.3,10)
    expect(r.returnToUprightSec).toBeCloseTo(0.8,10)
  })

  it('does not change the existing velocity/jump-height/RSI outputs when optional timestamps are added',()=>{
    const withoutPhases=calcCMJFn(base)
    const withPhases=calcCMJFn({...base,bottomTime:0.3,stabilizationTime:1.3,uprightTime:1.8})
    expect(withPhases.estimatedVelocity).toBe(withoutPhases.estimatedVelocity)
    expect(withPhases.jumpHeightIn).toBe(withoutPhases.jumpHeightIn)
    expect(withPhases.rsiMod).toBe(withoutPhases.rsiMod)
  })
})
