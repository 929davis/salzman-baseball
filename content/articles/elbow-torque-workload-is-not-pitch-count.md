---
title: Elbow Torque Isn't Pitch Count Wearing a Lab Coat
description: Biomechanics labs measure elbow varus torque in newton-meters, then most of that nuance gets flattened back into a pitch-count recommendation on the way out the door. The loss of information happens at that last step.
date: 2026-08-28
slug: elbow-torque-workload-is-not-pitch-count
category: bio
---

Motion-capture research on the throwing elbow consistently finds elbow varus torque scaling with ball velocity — throwing harder loads the UCL more, pitch for pitch. That's the finding everyone already knows how to say out loud. The part that gets lost is that torque doesn't scale *linearly* with intent the way effort percentage suggests it should.

Estimated relative torque by reported throwing effort, normalized to that pitcher's own max-effort throw:

| Reported Effort | Relative Velocity | Estimated Relative Torque |
|---|---|---|
| 100% | 100% | 100% |
| 90% | ~96% | ~92% |
| 80% | ~91% | ~85% |
| 70% | ~87% | ~80% |

> Dropping from max effort to 80% doesn't cut elbow load by 20%. It cuts it by roughly half that. "Easy" bullpens and light catch-play are real load-management tools, but they are not the discount they feel like in the moment.

This is the gap that pitch-count-only workload models miss. Two pitchers can throw the same 90 pitches in an outing and take meaningfully different cumulative torque, because one of them was pitching at 92% intent all night and the other was empty-tanking every fastball at 98%+. A count-based cap treats both outings as identical load. They aren't.

None of this argues for abandoning pitch counts — they're cheap to track and better than nothing. It argues against treating them as a load metric on their own. If a program has any access to velocity tracking per pitch, that data is a far better proxy for cumulative elbow stress across an outing than the raw pitch total is, and it costs nothing extra to compute once the velocities are already being logged.
