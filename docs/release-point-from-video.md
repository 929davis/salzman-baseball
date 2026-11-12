# Measuring release-point drift from bullpen video

*Design note, 2026-11-10. Writing only — nothing here is built.*

## What Timing IQ measures today, and why it is hard to copy from a phone

In Timing IQ, "release-point drift" is one number per pitch: the distance, in feet, between where
this pitch left the hand and the average of where this pitcher's *earlier* pitches of the same
type (against the same batter side) left the hand. MLB gets the release location from a
multi-camera tracking system (Hawk-Eye) that triangulates the ball in 3D at 300+ frames per second
and reports `x0, z0` (side-to-side and height, in feet, at a fixed distance from the plate) with
sub-inch repeatability. Our audit found drift adds nothing measurable to the model with one week
of MLB data, but the concept is still the one coaches actually use: *is he releasing from the same
place, and does it change when he's tired or when he throws a different pitch?*

A phone can't do what Hawk-Eye does. It can do something useful, if the protocol is strict about
what it promises.

## What a single phone can and cannot measure

**Can measure well (2D, in the camera's plane):**

- **Repeatability of the release point across pitches from the same camera setup.** Release-to-
  release scatter in pixels, converted to inches with one calibration, is a legitimate number. It
  answers "how consistent is he today?" and "does his slider leave from the same window as his
  fastball?" without ever knowing the true 3D coordinate.
- **Drift within an outing.** Pitch 1–10 vs. pitch 30–40, same camera, same session: if the
  release window moves an inch and a half higher or toward third base, that shows up directly.
- **Arm slot / release angle in the camera plane.** From a front or rear view, the forearm angle
  at release; from a side view, extension toward the plate.

**Cannot measure (and should not be labeled as):**

- A true 3D release point comparable to MLB's `x0, z0`. One camera has no depth.
- Comparisons between sessions where the camera moved, unless each session is re-calibrated and
  the comparison is reported as "relative to this session's own calibration".
- Spin axis or spin rate.
- Anything at 30 fps about the exact release frame — see frame rate below.

## Camera views

Pick views by what each one measures. One camera is enough to start; two makes the numbers much
more trustworthy.

| View | What it gives | What it hides |
|---|---|---|
| **Behind the pitcher, centered on the rubber, elevated** (the "catcher's eye" but from behind) | Side-to-side release position and release height — the two axes MLB reports. Pitch-to-pitch scatter here is the closest phone analogue to drift. | Extension (depth). |
| **Open side, 90° to the rubber-to-plate line, at release height** | Extension toward the plate, stride length, trunk tilt at release, timing of foot plant vs. release. | Side-to-side position. |
| **Catcher's view from behind the plate** (phone on a tripod behind a screen) | Release window as the hitter sees it, which is what "tunneling" actually means. Good for comparing pitch types. | Depth; also the ball is tiny and fast in frame. |

Recommendation: **behind-the-pitcher is the primary view for drift**; add the open-side view when
extension or fatigue mechanics are the question. Mount height matters more than people expect —
the phone should be at or slightly above release height (roughly 6 ft) so the release point isn't
foreshortened; a tripod or fence mount, never handheld.

## Frame rate

Release happens in roughly 10 milliseconds. At 30 fps the ball moves about 3 feet between frames
at 85 mph, so the "release frame" is a coin flip between two frames and the measured release point
scatters by a foot before the pitcher has done anything wrong. The jump tools in this app already
assume 240 fps slow-mo for the same reason.

- **240 fps** (iPhone slow-mo): ball moves ~5 inches per frame at 85 mph; release frame identified
  to within one frame; good enough for a repeatable 2D release point.
- **120 fps**: workable, ~10 inches per frame; acceptable if 240 isn't available.
- **60 fps / 30 fps**: not acceptable for release location. Still fine for arm slot or gross
  mechanics.

Also lock exposure and use the fastest shutter the light allows; motion blur at release is what
actually kills the measurement, not pixel count.

## Calibration

The whole measurement rests on converting pixels to inches at the pitcher's release plane.

1. **A known length in the release plane, every session.** Simplest: a 4-foot pole with two
   bright tape marks held at the rubber, upright, in the first second of each clip; or a marked
   board on the fence line behind the mound. The mechanics tab already asks for a "standing tall"
   calibration frame using the athlete's height; the same idea works, but a rigid known length is
   more accurate than a body height that changes with posture.
2. **A fixed reference in the frame** (the rubber's edges, a fence post) so camera movement between
   pitches can be detected and the session flagged if it exceeds a few pixels.
3. **Record the setup.** Distance from camera to rubber, mount height, and lens (wide vs. main) in
   the session record. Different lenses distort differently; the main lens is preferred.
4. **Re-calibrate per session**; never reuse a calibration across sessions or compare absolute
   release coordinates across sessions. Compare *scatter* and *within-session drift*, which are
   calibration-independent in units of inches as long as each session is calibrated.

## What markerless pose can and can't contribute

The mechanics tab currently runs MediaPipe (2D pose). A markerless body model gives a wrist and
hand landmark on every frame, which is the natural proxy for the release point. Two cautions:

- **Pose landmarks lag and smooth fast motion.** At release the hand is the fastest thing in the
  frame; pose models trained on general video tend to put the wrist a few inches behind where it
  actually is, consistently in one direction. Consistent bias cancels out in *scatter* and *drift*
  comparisons, which is another reason to report those rather than absolute positions.
- **Ball detection is better than hand detection for release.** The first frame where the ball
  is separated from the hand is the release frame. A simple bright-ball detector (white ball,
  high contrast) at 240 fps is more reliable than pose for that one event; pose then supplies arm
  slot and extension in the same frame. The Mixamo/LLM-mocap approach the mechanics tool is
  moving toward would supply a 3D-ish skeleton from a single view, but its depth estimates are
  inferred, not measured, so release *depth* from that pipeline should be treated as a mechanics
  cue, not a measurement.

## The numbers a phone protocol could honestly produce

Per session, per pitch type:

- **Release scatter** (inches): standard deviation of the 2D release point across the session's
  pitches. The pitcher's own baseline over time.
- **Within-session drift** (inches): mean release point of the last third of the session minus the
  first third, by axis (higher/lower, glove-side/arm-side). Flag if it exceeds the pitcher's usual
  scatter.
- **Pitch-type separation** (inches): distance between the fastball and breaking-ball release
  centroids. The phone version of the "tunnel distance" feature; smaller is better for
  deception, but only comparable across sessions as a ratio to scatter.
- **Arm slot at release** (degrees, camera plane) and, from the side view, **extension** (feet,
  relative to the rubber, calibrated).

Each should carry its calibration length and frame rate in the record, and the UI should refuse
to show a drift number from a 30 fps clip or an uncalibrated session, the same way the CMJ tool
now refuses to save without the right fields.

## What it would take to compare to MLB

It can't be compared directly: MLB's coordinates are 3D and absolute. What *can* be compared is
the ratio — a pitcher's within-session drift relative to his own scatter — because Timing IQ's
drift feature could be re-expressed the same way for MLB pitchers (deviation divided by that
pitcher's own release standard deviation). That is a reasonable follow-up for the model, and it
would make the MLB side and the bullpen side speak the same unit.

## Suggested order of work

1. Add 240 fps, calibration-length, and camera-view fields to the mechanics session record; refuse
   release numbers without them.
2. Ball-separation release-frame detection on the behind-the-pitcher view; manual override, as the
   current key-event marking already allows.
3. Report scatter and within-session drift per pitch type. No cross-session absolute comparisons.
4. Only then: a two-camera option (behind + open side) for extension and a crude 3D estimate.
