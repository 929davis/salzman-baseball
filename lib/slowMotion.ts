// Slow-motion helpers shared by the video tools.
//
// An iPhone slow-motion clip is captured at 120 or 240 frames per second but plays back at about
// 30 frames per second, so each second of VIDEO time is only 1/8 of a REAL second at 240 fps
// (1/4 at 120 fps). Anything measured from the video's own clock (marker times, the scrub bar,
// currentTime) is "video time" and must be divided by the slow-motion factor to get real time.
//
// This is the same rule the Jump Video tool uses (app/components/JumpVideoTool.tsx:
// `slowMo = captureFps / PLAYBACK_FPS`, `real = video / slowMo`), pulled out so the mechanics tool
// applies it identically instead of keeping its own copy.
//
// Assumption, stated plainly: the clip being loaded is a slow-motion export that plays back at
// PLAYBACK_FPS. A clip filmed at a normal 30 fps (or exported "real time") should be set to 30 fps
// here, which gives a factor of 1 (no conversion). A 60 fps clip that plays at 60 fps in real time
// is NOT slow-motion; set it to 30 so durations are not halved.

export const PLAYBACK_FPS = 30

export const CAPTURE_FPS_OPTIONS: { fps: number; label: string }[] = [
  { fps: 30, label: '30 fps (real time)' },
  { fps: 60, label: '60 fps (2× slow-mo)' },
  { fps: 120, label: '120 fps (4× slow-mo)' },
  { fps: 240, label: '240 fps (8× slow-mo, iPhone)' },
  { fps: 480, label: '480 fps (16× slow-mo)' },
]

// One displayed frame, in video seconds. The scrub bar and the -1/+1 frame buttons step by this.
export const FRAME_STEP_VIDEO_SEC = 1 / PLAYBACK_FPS

/** How many times slower than real life the clip plays. Anything invalid counts as real time. */
export function slowMoFactor(captureFps: number): number {
  return Number.isFinite(captureFps) && captureFps > 0 ? captureFps / PLAYBACK_FPS : 1
}

/** Video-clock seconds -> real seconds. */
export function videoToRealSec(videoSec: number, captureFps: number): number {
  return videoSec / slowMoFactor(captureFps)
}

/** Real seconds -> video-clock seconds (used when a real-time position must seek the video). */
export function realToVideoSec(realSec: number, captureFps: number): number {
  return realSec * slowMoFactor(captureFps)
}
