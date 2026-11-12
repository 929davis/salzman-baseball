import { describe, it, expect } from 'vitest'
import { PLAYBACK_FPS, FRAME_STEP_VIDEO_SEC, slowMoFactor, videoToRealSec, realToVideoSec } from './slowMotion'

describe('slowMotion', () => {
  it('240 fps capture plays 8x slower than real time; 120 is 4x; 30 is real time', () => {
    expect(slowMoFactor(240)).toBe(8)
    expect(slowMoFactor(120)).toBe(4)
    expect(slowMoFactor(60)).toBe(2)
    expect(slowMoFactor(30)).toBe(1)
  })

  it('converts a foot-plant-to-release gap from video time to real time', () => {
    // 1.2 s apart on the video clock of a 240 fps clip is 0.15 s of real delivery time.
    expect(videoToRealSec(1.2, 240)).toBeCloseTo(0.15, 10)
    // The raw (unconverted) value would be 8x too large.
    expect(1.2 / videoToRealSec(1.2, 240)).toBe(8)
  })

  it('round-trips real and video time', () => {
    for (const fps of [30, 60, 120, 240, 480]) {
      expect(realToVideoSec(videoToRealSec(2.5, fps), fps)).toBeCloseTo(2.5, 10)
    }
  })

  it('treats a missing or invalid capture rate as real time instead of dividing by zero', () => {
    expect(slowMoFactor(0)).toBe(1)
    expect(slowMoFactor(NaN)).toBe(1)
    expect(slowMoFactor(-240)).toBe(1)
    expect(videoToRealSec(1, NaN)).toBe(1)
  })

  it('matches the jump tools: playback is 30 fps and one frame is 1/30 s of video time', () => {
    expect(PLAYBACK_FPS).toBe(30)
    expect(FRAME_STEP_VIDEO_SEC).toBeCloseTo(1 / 30, 12)
  })
})
