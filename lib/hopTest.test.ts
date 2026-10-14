import {describe,it,expect} from 'vitest'
import {validateHopSequence,calcHopMetrics,summarizeHopTest,type HopEntry} from './hopTest'

describe('validateHopSequence',()=>{
  it('accepts a valid ordered sequence',()=>{
    const hops:HopEntry[]=[{landingTime:0,takeoffTime:0.2},{landingTime:0.6,takeoffTime:0.8},{landingTime:1.2,takeoffTime:1.4}]
    expect(validateHopSequence(hops)).toBeNull()
  })
  it('rejects an empty sequence',()=>{
    expect(validateHopSequence([])).not.toBeNull()
  })
  it('rejects a hop where takeoff is before landing',()=>{
    expect(validateHopSequence([{landingTime:0.5,takeoffTime:0.3}])).toMatch(/Hop 1/)
  })
  it('rejects a hop whose landing precedes the previous hop\'s takeoff',()=>{
    const hops:HopEntry[]=[{landingTime:0,takeoffTime:0.2},{landingTime:0.1,takeoffTime:0.4}]
    expect(validateHopSequence(hops)).toMatch(/Hop 2/)
  })
})

describe('calcHopMetrics',()=>{
  it('computes ground contact time for every hop',()=>{
    const hops:HopEntry[]=[{landingTime:0,takeoffTime:0.2},{landingTime:0.6,takeoffTime:0.8}]
    const m=calcHopMetrics(hops)
    expect(m[0].groundContactSec).toBeCloseTo(0.2,10)
    expect(m[1].groundContactSec).toBeCloseTo(0.2,10)
  })
  it('computes flight time and RSI from this hop\'s takeoff to the next hop\'s landing',()=>{
    const hops:HopEntry[]=[{landingTime:0,takeoffTime:0.2},{landingTime:0.6,takeoffTime:0.8}]
    const m=calcHopMetrics(hops)
    expect(m[0].flightSec).toBeCloseTo(0.4,10)
    expect(m[0].rsi).toBeCloseTo(0.4/0.2,10)
  })
  it('leaves the last hop\'s flight/RSI undefined -- no following landing to measure against',()=>{
    const hops:HopEntry[]=[{landingTime:0,takeoffTime:0.2},{landingTime:0.6,takeoffTime:0.8}]
    const m=calcHopMetrics(hops)
    expect(m[1].flightSec).toBeUndefined()
    expect(m[1].rsi).toBeUndefined()
  })
  it('carries the limb designation through to the metrics',()=>{
    const hops:HopEntry[]=[{landingTime:0,takeoffTime:0.2,limb:'left'},{landingTime:0.6,takeoffTime:0.8,limb:'right'}]
    const m=calcHopMetrics(hops)
    expect(m[0].limb).toBe('left')
    expect(m[1].limb).toBe('right')
  })
})

describe('summarizeHopTest',()=>{
  it('reports valid hop count, averages, and best values',()=>{
    const hops:HopEntry[]=[{landingTime:0,takeoffTime:0.2},{landingTime:0.6,takeoffTime:0.8},{landingTime:1.2,takeoffTime:1.4}]
    const s=summarizeHopTest(calcHopMetrics(hops))
    expect(s.validHopCount).toBe(3)
    expect(s.avgGroundContactSec).toBeCloseTo(0.2,10)
    expect(s.bestGroundContactSec).toBeCloseTo(0.2,10)
    expect(s.avgRsi).toBeDefined()
    expect(s.bestRsi).toBeDefined()
  })
  it('omits consistency when fewer than 2 RSI values exist',()=>{
    const hops:HopEntry[]=[{landingTime:0,takeoffTime:0.2}]
    const s=summarizeHopTest(calcHopMetrics(hops))
    expect(s.rsiConsistencyPct).toBeUndefined()
  })
  it('splits left/right RSI averages separately for a single-leg protocol',()=>{
    const hops:HopEntry[]=[
      {landingTime:0,takeoffTime:0.2,limb:'left'},
      {landingTime:0.6,takeoffTime:0.8,limb:'right'},
      {landingTime:1.2,takeoffTime:1.4,limb:'left'},
      {landingTime:1.8,takeoffTime:2.0,limb:'right'},
    ]
    const s=summarizeHopTest(calcHopMetrics(hops))
    expect(s.leftAvgRsi).toBeDefined()
    expect(s.rightAvgRsi).toBeDefined()
  })
})
