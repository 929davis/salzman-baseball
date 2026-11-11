# Program source documents

The three files in this folder are the written sources behind the training system. They are
kept here so anyone (or any AI session) working on programming reads the same versions.

| File | What it is |
|---|---|
| `Salzman_Baseball_Training_Principles_3.1.md` | Training Principles 3.1 — biomechanics, physical qualities, loading, phases, methods, conditioning, throwing. |
| `Salzman_Baseball_GPP_SPP_Master_Blueprint_V3_Revised.pdf` | GPP & SPP Master Blueprint V3 — the phase-by-phase weekly templates with loads, sets, reps and rest, plus the spinal/trunk and scapular sections. |
| `salzman_baseball_system_architecture_3_2_claude_knowledge_base.md` | System Architecture 3.2 — the operating directive for an AI programmer: CNS budget, deload triggers, exercise transfer tiers, weekly check-in format. |

## Overrides — read these before applying anything in the documents

These override whatever the documents say. Added 2026-11-11 at the coach's request.

### 1. All gates are OFF

The Training Principles describe lifting gates **G1–G4** (loaded jumps, single-leg plyometrics,
depth jumps/KEAT, drop heights above 18 in) and throwing gates **T1–T4** (high-intent throwing,
weighted implements, pulldowns/velocity testing, installing a mechanical change). Wherever a
document says an exercise, drill, phase or intent level "requires gate …", "open at gate …", or
"G3 passed, no exceptions":

- **Ignore the gate.** Do not require it, do not ask whether it has been passed, and do not
  exclude an exercise or a throwing intent because of it.
- Everything else about that item still applies — loads, volume caps, drop-height limits,
  bodyweight limits, RSI rules, the no-in-season rule for KEAT, the 4–6 oz implement window.
  Only the *permission check* is removed.
- The coach still decides what an athlete is ready for. The gates were a mechanism for that
  decision, not the decision itself.

In the app this is the `GATES_DISABLED` switch in `lib/engine/gateRequirement.ts`. The gate
definitions and each athlete's "gates passed" toggles are left in place so the gates can be
turned back on later by setting that switch to `false`.

### 2. Not overridden

The CNS budget (weekly ceilings, no back-to-back high-CNS days), the deload triggers, and the
loading bands in Architecture 3.2 and Principles 3.1 are still in force.
