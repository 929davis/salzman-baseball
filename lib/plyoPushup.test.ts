import {describe,it,expect} from 'vitest'
import {validatePlyoPushupSequence,calcPlyoPushupMetrics,summarizePlyoPushupTest,type PlyoPushupInput} from './plyoPushup'

describe('validatePlyoPushupSequence',()=>{
  it('accepts a valid sequence with bottomTime on every rep',()=>{
    const input:PlyoPushupInput={
      reps:[{contactTime:0,bottomTime:0.1,leaveTime:0.3},{contactTime:0.6,bottomTime:0.7,leaveTime:0.9}],
      finalContactTime:1.2,
    }
    expect(validatePlyoPushupSequence(input)).toBeNull()
  })
  it('accepts reps without bottomTime',()=>{
    const input:PlyoPushupInput={reps:[{contactTime:0,leaveTime:0.3}],finalContactTime:0.8}
    expect(validatePlyoPushupSequence(input)).toBeNull()
  })
  it('rejects an empty rep list',()=>{
    expect(validatePlyoPushupSequence({reps:[],finalContactTime:1})).not.toBeNull()
  })
  it('rejects bottomTime before contactTime',()=>{
    const input:PlyoPushupInput={reps:[{contactTime:0.5,bottomTime:0.3,leaveTime:0.9}],finalContactTime:1.2}
    expect(validatePlyoPushupSequence(input)).toMatch(/bottom of the lowering phase/)
  })
  it('rejects leaveTime before bottomTime',()=>{
    const input:PlyoPushupInput={reps:[{contactTime:0,bottomTime:0.5,leaveTime:0.3}],finalContactTime:1.2}
    expect(validatePlyoPushupSequence(input)).toMatch(/hands leaving the ground/)
  })
  it('rejects the next landing coming before this rep\'s hands leave the ground',()=>{
    const input:PlyoPushupInput={
      reps:[{contactTime:0,leaveTime:0.5},{contactTime:0.3,leaveTime:0.9}],
      finalContactTime:1.2,
    }
    expect(validatePlyoPushupSequence(input)).toMatch(/next landing/)
  })
  it('rejects stabilizationTime before finalContactTime',()=>{
    const input:PlyoPushupInput={reps:[{contactTime:0,leaveTime:0.3}],finalContactTime:0.8,stabilizationTime:0.7}
    expect(validatePlyoPushupSequence(input)).toMatch(/Stabilization/)
  })
})

describe('calcPlyoPushupMetrics',()=>{
  it('computes ground contact and flight time for each rep',()=>{
    const input:PlyoPushupInput={
      reps:[{contactTime:0,leaveTime:0.3},{contactTime:0.6,leaveTime:0.9}],
      finalContactTime:1.2,
    }
    const m=calcPlyoPushupMetrics(input)
    expect(m[0].groundContactSec).toBeCloseTo(0.3,10)
    expect(m[0].flightSec).toBeCloseTo(0.3,10)
    expect(m[1].groundContactSec).toBeCloseTo(0.3,10)
    expect(m[1].flightSec).toBeCloseTo(0.3,10)
  })
  it('splits lowering vs propulsion duration only when bottomTime is given',()=>{
    const input:PlyoPushupInput={reps:[{contactTime:0,bottomTime:0.1,leaveTime:0.3}],finalContactTime:0.8}
    const m=calcPlyoPushupMetrics(input)
    expect(m[0].loweringDurationSec).toBeCloseTo(0.1,10)
    expect(m[0].propulsionDurationSec).toBeCloseTo(0.2,10)
  })
  it('leaves lowering/propulsion undefined without bottomTime',()=>{
    const input:PlyoPushupInput={reps:[{contactTime:0,leaveTime:0.3}],finalContactTime:0.8}
    const m=calcPlyoPushupMetrics(input)
    expect(m[0].loweringDurationSec).toBeUndefined()
    expect(m[0].propulsionDurationSec).toBeUndefined()
  })
  it('computes the last rep\'s flight time against finalContactTime',()=>{
    const input:PlyoPushupInput={reps:[{contactTime:0,leaveTime:0.3}],finalContactTime:0.9}
    const m=calcPlyoPushupMetrics(input)
    expect(m[0].flightSec).toBeCloseTo(0.6,10)
  })
})

describe('summarizePlyoPushupTest',()=>{
  it('reports rep count, averages, and best values',()=>{
    const input:PlyoPushupInput={
      reps:[{contactTime:0,leaveTime:0.3},{contactTime:0.6,leaveTime:0.9}],
      finalContactTime:1.2,
    }
    const m=calcPlyoPushupMetrics(input)
    const s=summarizePlyoPushupTest(m,input.stabilizationTime,input.finalContactTime)
    expect(s.repCount).toBe(2)
    expect(s.avgGroundContactSec).toBeCloseTo(0.3,10)
    expect(s.avgFlightSec).toBeCloseTo(0.3,10)
  })
  it('omits consistency with fewer than 2 reps',()=>{
    const input:PlyoPushupInput={reps:[{contactTime:0,leaveTime:0.3}],finalContactTime:0.8}
    const m=calcPlyoPushupMetrics(input)
    const s=summarizePlyoPushupTest(m,input.stabilizationTime,input.finalContactTime)
    expect(s.flightConsistencyPct).toBeUndefined()
  })
  it('computes stabilizationSec only when stabilizationTime is given',()=>{
    const input:PlyoPushupInput={reps:[{contactTime:0,leaveTime:0.3}],finalContactTime:0.8,stabilizationTime:1.3}
    const m=calcPlyoPushupMetrics(input)
    const s=summarizePlyoPushupTest(m,input.stabilizationTime,input.finalContactTime)
    expect(s.stabilizationSec).toBeCloseTo(0.5,10)
  })
})
