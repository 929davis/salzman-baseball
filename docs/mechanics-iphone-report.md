# Mechanics tab on iPhone — fix report

Branch `mechanics-iphone-fix` (6 commits, pushed; `main` untouched). Terms are explained the first
time they appear: **slow-motion factor** = how many times slower than real life a clip plays (an
iPhone clip filmed at 240 frames per second and played back at about 30 is 8× slow); **video time** =
the video's own clock; **real time** = actual seconds in the athlete's delivery (video time ÷ slow-motion
factor); **RLS** = row-level security, the database rules about who may read or write a row;
**dvh** = "dynamic viewport height", the visible screen height on an iPhone as Safari's toolbar shows and hides.

## 1. Root cause of each problem

### 1. The video area is tiny and doesn't fit
Two causes, both confirmed by running the original code in an iPhone-sized browser:
- The tab's body was a fixed two-column grid (`1.4fr 1fr`) with no phone breakpoint, inside the athlete
  dashboard's 480px column. The video got a ~270px column; the grid's columns also refused to shrink, so the page
  grew wider than the phone and scrolled sideways. Measured on the original: video box **207×116 px**, page layout
  width 425px on a 390px phone.
- The video box was locked to 16:9. Any other clip shape (portrait, 4:3) was letterboxed inside it.
It now measures **356×199 px** on the same phone (full width inside the page's 16px padding), no sideways scroll.

### 2. "I can't save the video"
- **The video is never uploaded, by design.** The tool's own text says so. What "Log Frame" and the timeline's
  "Mark" buttons save is one *row of measurements* (joint angles, the time, the event name) per click to
  `mechanics_frame_logs`. There is no video-saving feature to fix, and the app already saves only measurements,
  which is the approach you asked me to consider. The wording now says so plainly.
- **Why a measurement save could look broken** (found in the code and reproduced on the original):
  1. **Log Frame and Mark stayed disabled with no explanation.** They need a pose reading, and the original never
     took one when a clip loaded. It waits for a "seeked" event that nothing triggers, so the skeleton and
     measurements only appeared after pressing play or stepping. On the original this was reproduced
     in Chrome (no reading after load); iOS Safari additionally does not decode a frame until the video is played or
     seeked, which makes it worse. It now reads the first frame on load.
  2. **Every failure was silent.** `logFrame` did nothing when the database refused a row, and a pose-library error
     vanished. There was no message either way.
  3. **A blocked converter script could disable everything.** The optional in-browser video converter was loaded in
     the same step as the pose library, so if its CDN was blocked the pose library was reported as failed too.
- **What I could not determine: the real database error.** Reading it would mean writing to the production database,
  which was off limits. Instead the real Supabase message and code now appear under the button, so the
  preview will show it. Candidates, in order of likelihood: (a) the "no pose reading" dead end above;
  (b) the `INSERT` rule on `mechanics_frame_logs` was never applied (the repo's `sql/rls_pitcher_isolation.sql`
  says it must be run by hand, and it can't be confirmed it was); (c) a required column rejecting an empty value.
  Read-only checks for (b) and (c) are in `docs/mechanics-save-sql.md`.

### 3. "I can't move the markers"
Four independent causes, all in the original code:
1. Dragging was wired to **mouse events only** (`onMouseDown/Move/Up`). On iOS a finger tap produces mouse events,
   but a finger *drag* does not. Reproduced: a finger drag from the marker's centre changed nothing (elbow 126° → 126°)
   and **scrolled the page instead** (scrollY 913 → 904), because the canvas had no `touch-action: none`.
2. The grab radius and the drawn dots were measured in the video's own pixels. A 1080p clip shown ~400px wide drew a 4px
   dot at ~1.5 screen pixels with a ~14px grab zone, far too small for a fingertip.
3. The tap-to-bitmap math ignored `object-fit: contain` letterboxing, so on any clip not exactly the box's shape every
   touch landed offset from where it looked.
4. Nothing kept the marker visible under the finger.

## 2. Every change, by file and commit

| Commit | What |
|---|---|
| `f65b36b` | **New `lib/slowMotion.ts` + `lib/slowMotion.test.ts`** (5 tests). The shared slow-motion rule: `factor = captureFps ÷ 30`, `real = video ÷ factor`. Identical to the Jump Video tool's rule. |
| `c62cbba` | **`app/components/PitchMechanics2D.tsx` — layout and markers.** Single column unless the component itself is ≥720px wide; video box takes the clip's own shape, fills the width, capped to the screen with `dvh`; upload card has a min-height (this supersedes the stash, see §4); pointer events with pointer capture and `touch-action: none`; 30px grab radius in screen pixels; grab offset so the marker doesn't snap under the finger; clamped to the picture; redraws coalesced to one per frame; a tag naming the dragged joint drawn above it; markers drawn in screen-pixel sizes; letterbox-aware coordinates; 16px inputs on narrow screens (iOS zooms the page on smaller fields); 40px minimum button height; safe-area padding. |
| `c9f6b5e` | **Same file + `docs/mechanics-save-sql.md`.** Visible save result with real message and code; failed marks held with a Retry button; `NaN` readings sent as `null`; pose errors shown; plain-words "why can't I log" reason; converter script loaded separately; first-frame analysis on load; optional `capture_fps` saved when the column exists and silently skipped when the database says it doesn't. |
| `246e2fb` | **Same file — real-time durations.** Phase durations, hip travel speed, the timeline (axis, marks, playhead, seeking), timecode, frame table and speed pickers all in real seconds. Capture-rate selector now 30/60/120/240/480 with plain labels. −1/+1 frame and the scrub bar step one displayed frame (1/30 s of video) as in the jump tools. CSV keeps `Time(s)` and adds `RealTime(s)`, `CaptureFps` on the right. Typing a Session Label matching saved marks restores their saved rate. `video.play()` rejections (iOS) no longer leave the tool stuck "playing". |
| `c968429` | Stat-card labels no longer collide with the Reliable/Est. badge on phones. |
| (this) | `docs/mechanics-iphone-report.md`. |

Existing saved records are unchanged and still readable: marks are still stored as raw video time (so nothing
needed migrating, and the timeline can still seek), and are converted to real time only when shown.

## 3. Frame rate (problem 4)
**Confirmed and fixed.** The jump tools compute `slowMo = captureFps ÷ 30` and divide video time by it; the mechanics tool
subtracted raw video times, so a 240 fps clip's phase durations came out 8× too long, and hip travel speed 8× too slow.
Both now use the shared helper. Verified in the browser: marks 1.2 video-seconds apart on a 240 fps setting display
**0.150 s** (not 1.2 s), and the same rate is applied to the timeline axis, so the "Foot Plant → Release" reference
bands (published 0.14–0.15 s) are compared against real time.
The Jump and Rep (hop / push-up) video tools were **not** touched; they keep their own copy of the same constants.

## 4. Judgment calls
- **The stash** (`stash@{0}`, one-line `minHeight: 200`) was reviewed and its idea kept, but not popped (it edits a line I
  rewrote, so it would only conflict). It was a guess about a clipped Choose Video button; the new upload card is
  `minHeight: 200` with a 46px button, measured fully on screen. The stash entry still exists, untouched; you can drop it
  once you've confirmed the preview.
- **Capture rate means "the rate the phone filmed at"**, same as the jump tools. It assumes the loaded file is a slow-motion
  export that plays at ~30 fps. A normal-speed 60 fps clip should be set to **30**, not 60, or its durations are halved.
  Stepping uses one displayed frame (1/30 s); a true 60 fps real-time file therefore steps two frames at a time.
  (Measuring the file's real frame rate would be more exact and is a possible follow-up.)
- **Held marks live in memory only.** They survive until the tab closes; the message says to keep the page open. Persisting
  them across a reload was left out because it adds a hydration risk and the video itself wouldn't reload with them.
- **Safe areas:** padding uses `env(safe-area-inset-*)`, which is zero in Safari's default mode. I did not add
  `viewport-fit=cover` to the root layout because it changes the whole app.
- **Landscape width:** the athlete dashboard shell is capped at 480px (`app/pitcher/page.tsx`), so in landscape the video
  is as wide as that column (446×250 px on an 844×390 phone) rather than the whole screen. Changing the shell is outside this
  tab, so I left it.
- **The two React-compiler lint errors** in this file (a `setState` in an effect, `playLoop` used before it is declared)
  are on `main` too and were left alone. The file now has **20 lint errors and 0 warnings (main: 22 errors, 1 warning)**; new
  files lint clean.

## 5. What was verified, and how
Run in desktop Chrome 150 with iPhone 14 emulation (390×664 touch screen, `isMobile`), driving the real component with real
touch events through the browser's debugging protocol. MediaPipe and Supabase were stubbed at the network layer (fixed
standing-figure landmarks; a fake Supabase on a dead local port), a throwaway page mounted the component in the same 480px
column, and I confirmed no request reached the real Supabase project. The throwaway page was deleted before committing.

24/24 checks passed, including:
- portrait phone: Choose Video button fully on screen, 46px tall; video full width; no sideways scroll
- one-finger drag from 18px *beside* a marker moves it (elbow 126° → 25°) without scrolling the page; a touch on empty picture moves nothing
- tall (9:16) clip fits the screen height and drags correctly; landscape phone fits and drags
- a refused save (code 42501) shows the real message and code, holds the mark, and Retry saves it
- missing `capture_fps` column: saved anyway by re-sending without it, and later saves skip it up front
- a pose-library failure shows a plain-words reason instead of silence
- 240 fps conversion: 0.150 s

**Negative control:** the same checks against the original component from `main` showed 207×116 px video, a finger drag that moved
nothing and scrolled the page, and no pose reading after load. So these tests can fail.

Also: `tsc` clean, 85/85 unit tests, production build passes (run with the database URL pointed at a dead port).

## 6. What could NOT be verified without a real iPhone
- **Safari itself.** Emulation uses Chrome's engine. Touch/pointer behavior (`touch-action`, pointer capture) is standard on Safari 13+
  and `dvh` needs Safari 15.4+, but I have not seen it run on WebKit.
- **Real MediaPipe on iOS.** The pose library was stubbed. Whether it initialises and runs on your phone, how fast, and whether the first-frame
  "tiny seek" is enough to make iOS decode a frame are untested. If the skeleton never appears, the new message under the buttons will say why.
- **Real clips.** iPhone slow-motion clips picked from Photos (HEVC, possibly re-encoded by iOS), very large files, and memory limits.
  Also whether the clip you pick plays at ~30 fps, which the capture-rate rule assumes.
- **The actual save error** and whether the `INSERT` rule exists in production (see §1).
- Fingertip feel: grab radius, the drag tag, and the finger-offset were tuned by measurement, not by hand.

## 7. Test the preview on your iPhone
Push of the branch creates a Vercel preview; open it from the Vercel dashboard (project `salzman-baseball`, branch `mechanics-iphone-fix`) or the GitHub branch's checks, and sign in as an athlete.

1. **Assess → Mechanics.** The panel is one column, no sideways scrolling. Tap **Choose Video** and pick a clip. (Try a slow-motion clip first, then a normal one.)
2. The video fills the width, and **within a few seconds a gold skeleton appears by itself** (you should not need to press play). If not, read the line under the Play/Log Frame row. Send it to me.
3. Set **Capture Frame Rate** to what the phone filmed at (240 for iPhone slow-mo, 30 for a normal clip).
4. **Drag each marker** with one finger: head, both shoulders, elbows, wrists, hips, knees, ankles. A tag with the joint's name should appear above the one you hold, the page should not scroll, and the red ring marks it as corrected. Try starting the touch a little beside the dot.
5. Rotate the phone to landscape and drag one marker again.
6. Type a **Session Label** (e.g. `Test 1`). Step to the foot plant, choose Key Event **Foot Plant**, tap **Log Frame**. Step to release, choose **Release**, tap **Log Frame**.
7. A **green "Saved …" line** should appear each time. If you see a **red** line, it names the real error and a code. Screenshot it. A **Retry save** button appears under it; tap it after fixing what it says.
8. Read **Phase Durations — This Session**: Foot Plant → Release should be a believable real-time number (around 0.14–0.15 s for a hard thrower), not eight times that.
9. **Reopen the saved record:** reload the page, go back to Mechanics, tap **Refresh** in the Frame Log (your marks appear), type the *same* Session Label, and confirm the durations still read in real time. (They restore the capture rate automatically only after the `capture_fps` column from §8 exists. Until then, set the Capture Frame Rate again yourself.)

## 8. SQL
**Nothing is required.** The app works without any change. Optional, written but **not run**, in `docs/mechanics-save-sql.md`:
1. `capture_fps` column (adds one nullable number column so a reopened session remembers its slow-motion rate).
2. Read-only checks of the table's permission rules and columns, plus a targeted `INSERT` rule for athletes, only if the checks show it missing. Use these if the preview shows a code `42501` or a "null value in column" error.

## 9. Update — "Bottom of Back Leg Loading" and flexible event order

Requested after the first report. Commit: see `git log` on this branch.

- **New event, "Bottom of Back Leg Loading"** (pink "Leg load" pin and **Mark Leg load** button; also in the Key Event list).
  Mark the frame where the pitcher has sunk lowest into the back leg. Because every mark already records the joint angles on
  that frame, this doubles as a metric: a **"Bottom of Back Leg Loading — NN° back knee"** card under Phase Durations shows the
  back-knee angle at the mark (180° = straight leg; smaller = deeper sink). It is estimated from a single camera view, so compare
  it between pitches filmed from the same angle.
- **The "events are out of order" message no longer fires for leg lift, hand break, or leg loading.** Those three can be marked in
  any order; the timeline and the Phase Durations list now follow the order they actually happened (e.g. Hand Break → Leg Load →
  Peak Leg Lift → Foot Plant). The message is kept for genuine mistakes elsewhere (for example Release marked before Foot Plant),
  where it still tells you to re-mark.
- **Skipped events no longer hide durations.** Phase Durations now chains the events you actually marked instead of requiring every
  neighbouring event. Without this, adding the new optional mark would have removed the Hand Break → Foot Plant time for pitchers who
  don't use it. (The helper text under Phase Durations was reworded to match.)
- **Verified** in the same emulated-iPhone setup: hand break marked before peak leg lift raises no message and is listed in real
  order; the usual order without the new mark still shows Hand Break → Foot Plant; Release before Foot Plant still warns; the back-knee
  card appears. 9/9 checks. Not run: a before/after comparison against the old timeline code.
- **Files:** `app/components/PitchMechanics2D.tsx` (event, order logic, card, text) and `app/components/DeliveryTimeline.tsx`
  (new optional `interchangeable` setting; no other screen uses this component). No database change is needed; one read-only check is
  in `docs/mechanics-save-sql.md` §1b in case a rule on `key_event` rejects the new name.

## 10. Update: mechanics tab cleanup

Removed: Clear Log button; second (inches) Stride Length card; Key Event dropdown (the timeline Mark buttons
replace it); the eight-item upload checklist (now four lines); the in-browser video converter (unplayable clips
now show manual re-export advice); the published Foot Plant / MER reference ranges (durations still shown).
Hidden until calibrated: the hip travel speed block. Stride length card only shows in side view. Notes field
is behind an "add a note" button; handedness, camera view and height are remembered per athlete on the device
(not the capture rate, since a wrong remembered rate would silently scale every duration).

Fixed: Frame Log and speed dropdowns now convert each row with the capture rate it was saved with (older rows
without one use the selector). Added a per-row delete (x) with confirmation; it only works if the database
allows deletes for the athlete, otherwise the real error is shown and the mark stays. Frame Log can be limited
to "This session" (default when a Session Label is set) or "All sessions".

Not done yet: compare-with-previous-pitch, pinch-to-zoom, pose-assisted event suggestions, auto-collapsing the
settings block. Not tested in a browser after this change (typecheck and the 85 unit tests pass).
