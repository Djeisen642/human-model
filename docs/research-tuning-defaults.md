# Research: Tuning for Sane Defaults — Are There Any?

The question this session set out to answer: now that the event set is complete, can parameter
tuning find **sane defaults** — a regime where the population persists and outcomes are varied and
non-degenerate — or is the model **too chaotic**, such that sanity requires a *new structural
factor*? Method: `scripts/sweep.ts`, 16 seeds, horizons 100–400 ticks, sweeping the levers most
likely to regulate population, plus two throwaway code probes of the candidate structural fixes.

## The central finding (negative, then a direction)

**Parameter tuning cannot produce a sane long-run default.** Every regime explored is a *one-shot
overshoot → extinction*: population booms from 100 to a single ~550–1350 peak around tick 80–120,
then crashes straight through to zero. The `CycleDetector` confirms it — `cyc=0, stable=0` under
**every** single-lever sweep. There is no soft-landing, no sustained oscillation, no equilibrium
anywhere in the explored parameter space.

The 100-tick horizon *looks* healthy (`STRUGGLING×10 COLLAPSE×4 STABLE×2`, no extinctions), but
that is an artifact: 100 ticks measures the population mid-overshoot, *before* the universal crash.
Extend the same runs and the verdict inverts.

| Horizon (default params, 16 seeds) | Outcome distribution | Extinct |
|---|---|---|
| 100 ticks | `STRUGGLING×10 COLLAPSE×4 STABLE×2` | 0/16 |
| 200 ticks | `EXTINCTION×6 COLLAPSE×8 STRUGGLING×1 STABLE×1` | 6/16 |
| 300 ticks | `EXTINCTION×11 COLLAPSE×3 STRUGGLING×2` | 11/16 |

## Single-lever sweeps — none stabilize (all `cyc=0, stable=0`, 300 ticks)

| Lever | Values | Extinct (best → worst) | Effect |
|---|---|---|---|
| `BASE_CHILDBIRTH_RATE` | 0.4 / 0.6 / 0.8 / 1.2 | 8/16 → 12/16 | higher rate trades a bigger boom for marginally fewer extinctions; never cycles |
| `NATURAL_RESOURCE_REGEN_FRACTION` | 0.02 / 0.05 / 0.08 | 8/16 → 11/16 | bigger pool → bigger boom (peak 430 → 1345) → still crashes |
| `CEILING_DEGRADATION_RATE` | 0.0 / 0.025 / 0.05 | 10/16 → 11/16 | turning degradation off does **not** rescue the population |

The shared signature — bigger inputs make a bigger boom, not a stable population — is the tell that
the problem is structural, not a mis-set constant. This reproduces and extends the fertility study
(`docs/research-fertility.md`): there it was shown for `BASE_CHILDBIRTH_RATE` alone; here it holds
across the resource system too.

## Structural probes — what a *new factor* would buy

Two candidate structural fixes from `research-fertility.md` (lever 4) were tested with temporary,
reverted code changes (env-gated, no shipped change):

**1. Desynchronized age structure (pyramid seeding).** Replacing the flat `age ∈ [15,50)` seed with
a young-skewed pyramid (`floor(60·u·u)`). Result: **no improvement** — 12/16 extinct at base 0.6,
still `cyc=0, stable=0`. The founding cohort's age spread washes out within ~100 ticks; the
endogenous dynamics regenerate the synchronized wave on their own. Initial conditions are not the
bottleneck.

**2. Anti-Allee low-density fertility boost (crash recovery).** A multiplier
`1 + boost·max(0, 1 − N/ref)` that raises birth probability as population falls below a reference —
so a thinned population reproduces faster instead of dying out. This is the **only** intervention in
the entire campaign that produced *any* sustained cycling:

| Probe (300–400 ticks) | Outcome | Extinct | `stable` |
|---|---|---|---|
| base 0.4, no boost | `COLLAPSE×3 EXTINCTION×12 STRUGGLING×1` | 12/16 | 0/16 |
| base 0.4, boost=6, ref=150 | `COLLAPSE×5 EXTINCTION×8 STRUGGLING×3` | 8/16 | 0/16 |
| base 0.6, boost=10, ref=250, 400t | `EXTINCTION×13 COLLAPSE×3` | 13/16 | **2/16** |
| base 1.0, boost=10, ref=250, 400t | `EXTINCTION×11 COLLAPSE×4 STRUGGLING×1` | 11/16 | **3/16** |

The anti-Allee boost reduces extinction and, at high strength, finally lets a *minority* of seeds
settle into a stable boom-bust cycle. But even a strong boost loses most seeds: once a crash leaves
survivors who are too old or too sparsely partnered, no fertility multiplier can rebuild them. The
naive version is necessary but not sufficient.

## Answer to the question

**The model is too chaotic for sane long-run defaults via tuning alone.** The accepted boom-bust
framing (`research-fertility.md`, ARD 050) is confirmed and sharpened: it is not a *persistent*
oscillator (HANDY's "cycles of prosperity and collapse") but a *terminal* one — it booms once and
goes extinct. Sane defaults — a population that persists with collapse and thrive both reachable —
require a **new structural factor**, and the evidence points specifically at **crash recovery**: an
anti-Allee mechanism is the only thing that moved `stable` off zero. It should be designed
carefully (the naive low-density boost still loses ~70% of seeds), likely combined with a second
recovery channel (weakened partnership-density dependence at low N, or a younger continuously-
replenished age structure) so that crashes bounce off a floor rather than ratcheting to zero.

This is an ARD-level decision (new mechanic, non-obvious calibration), tracked under "Crash
recovery / age-structure" in `docs/future-ideas.md`. It should be discussed with the project owner
before any implementation. Until then, the current 0.6 / 100-tick "outcome variety" default remains
the right call for *short-horizon* runs — it is honest about being a slice through the overshoot,
not a claim of stability.

## Calibration protocol for the eventual crash-recovery ARD

When crash recovery is built, sweep-validate against the targets this study established:

- **Primary:** `stable` (sustained-cycle count) rises off zero across seeds at 300–400 ticks while
  extinction share falls — without erasing outcome variety (do not collapse everything to STABLE).
- **Secondary:** the boom peak is *not* suppressed (recovery should rescue the trough, not cap the
  boom — that was the failure mode of the density-dependent fertility brake in
  `research-fertility.md`).
- Validate in a binding-`K` regime with an antisocial `personTypes` cohort so the confounding
  feedbacks (killing/theft/jail, inequality) are active, per the fertility-study protocol.
