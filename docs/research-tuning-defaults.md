# Research: Tuning for Sane Defaults — Are There Any?

**Recorded:** 2026-06-05 | **Commit:** fcfe1bd | **Base config:** all Variables at defaults unless noted
**Commands:** `npm run sweep -- --seeds 16 --ticks {100..800} [--set KEY=VAL | --sweep KEY=v1,v2,…]`
**Key context vars:** `BASE_CHILDBIRTH_RATE=0.6`, `BASE_INVENTION_RATE=0.002`, `NATURAL_RESOURCE_REGEN_FRACTION=0.03`, `CEILING_DEGRADATION_RATE=0.025`, `MAX_NATURAL_RESOURCE_CEILING=20000`

The question this study set out to answer: now that the event set is complete, can parameter tuning
find **sane defaults** — a regime where the population persists and outcomes are varied and
non-degenerate — or is the model **too chaotic**, such that sanity requires a *new structural
factor*? Method: `scripts/sweep.ts`, 16 seeds, horizons 100–800 ticks, sweeping the levers most
likely to regulate population, plus two throwaway env-gated code probes of the candidate structural
fixes.

## The central finding (negative, then a direction)

**Parameter tuning cannot produce a sane long-run default.** Every regime explored is a *terminal
one-shot overshoot*: population booms from 100 to a single ~550–1350 peak around tick 80–120, then
crashes straight through to extinction. The `CycleDetector` confirms it — `cyc=0, stable=0` under
nearly every single-lever sweep. There is no soft-landing and no equilibrium anywhere in the
explored parameter space; the few exceptions (below) still leave the majority of seeds extinct.

## Methodological finding: judge configs at long horizons, not 100 ticks

The most important practical lesson, and the one that misled this study's own first pass: **a sweep
at 100 ticks measures the population mid-overshoot, before the universal crash, so its "outcome
variety" is an artifact.** The default config inverts completely as the horizon extends:

| Horizon (default params, 16 seeds) | Outcome distribution | Extinct |
|---|---|---|
| 100 ticks | `STRUGGLING×10 COLLAPSE×4 STABLE×2` | 0/16 |
| 200 ticks | `EXTINCTION×6 COLLAPSE×8 STRUGGLING×1 STABLE×1` | 6/16 |
| 300 ticks | `EXTINCTION×11 COLLAPSE×3 STRUGGLING×2` | 11/16 |

This is not unique to the default. It is a trap that catches *any* tuning that improves the
short-horizon number — see the invention case below, where a 4/16-extinction result at 300 ticks
becomes 16/16 by 800. **Rule: run the horizon ladder (300/500/800) before believing an
improvement, and read `stable`/`cyc` — sustained cycles — as the signal for "sane," not the outcome
tally.**

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

## The invention lever — the one partial exception, and a cautionary tale

Invention grows the carrying capacity, so the obvious hypothesis is "can a civilization invent its
way out of the crash?" The answer is instructive precisely because the short-horizon data is
*misleading*. Raising `BASE_INVENTION_RATE` (default 0.002) across the horizon ladder:

| `BASE_INVENTION_RATE` | 300 ticks | 500 ticks | 800 ticks |
|---|---|---|---|
| 0.002 (default) | 11/16 ext | — | — |
| 0.01 (5×) | **4/16 ext** | 12/16 ext | **16/16 ext**, 0 stable |
| 0.03 (15×) | 4/16 ext | 6/16 ext, 3 stable | **9/16 ext, 6 stable cycles** |

Two distinct behaviors:

- **A modest boost (0.01) only *delays* the crash.** The 4/16-survival at 300 ticks is the
  mid-overshoot artifact in full force — it evaporates to total extinction (16/16) by 800. This is
  the cautionary case that motivates the horizon rule above.
- **A large boost (0.03, ~15×) does more than delay.** It is the only single-lever change to
  produce genuine *sustained* cycles that survive to the long horizon — `stable=6/16` at 800 ticks,
  confirmed by the cycle detector, so not an artifact. Frequent small ceiling lifts keep the
  carrying capacity rising and jostling, so the demographic wave rides a moving `K` instead of
  slamming a fixed floor. Bigger-but-rarer jumps (`INVENTION_CEILING_GROWTH_SCALAR` 0.01–0.03)
  help far less (8–9/16 extinct) — lumpy windfalls don't track the population the way a steady
  stream does.

But even at 0.03, **9/16 still go extinct**, and a 15× invention rate is a heavy thumb on the
scale. So: technology can push a *minority* of worlds into long-run cycles, but it does not rescue
the majority, and it is a partial mitigator, not a fix. It addresses the resource ceiling; the
crash is demographic (overshoot + no rebound), so invention complements crash recovery rather than
substituting for it.

## Structural probes — what a *new factor* would buy

Two candidate structural fixes from `research-fertility.md` (lever 4) were tested with temporary,
reverted, env-gated code changes (no shipped change):

**1. Desynchronized age structure (pyramid seeding).** Replacing the flat `age ∈ [15,50)` seed with
a young-skewed pyramid (`floor(60·u·u)`). Result: **no improvement** — 12/16 extinct at base 0.6,
still `cyc=0, stable=0`. The founding cohort's age spread washes out within ~100 ticks; the
endogenous dynamics regenerate the synchronized wave on their own. Initial conditions are not the
bottleneck.

**2. Anti-Allee low-density fertility boost (crash recovery).** A multiplier
`1 + boost·max(0, 1 − N/ref)` that raises birth probability as population falls below a reference —
so a thinned population reproduces faster instead of dying out:

| Probe (300–400 ticks) | Outcome | Extinct | `stable` |
|---|---|---|---|
| base 0.4, no boost | `COLLAPSE×3 EXTINCTION×12 STRUGGLING×1` | 12/16 | 0/16 |
| base 0.4, boost=6, ref=150 | `COLLAPSE×5 EXTINCTION×8 STRUGGLING×3` | 8/16 | 0/16 |
| base 0.6, boost=10, ref=250, 400t | `EXTINCTION×13 COLLAPSE×3` | 13/16 | **2/16** |
| base 1.0, boost=10, ref=250, 400t | `EXTINCTION×11 COLLAPSE×4 STRUGGLING×1` | 11/16 | **3/16** |

The anti-Allee boost reduces extinction and, at high strength, lets a *minority* of seeds settle
into a stable cycle — but even a strong boost loses most seeds: once a crash leaves survivors who
are too old or too sparsely partnered, no fertility multiplier can rebuild them. Necessary but not
sufficient on its own.

## Answer to the question

**The model is too chaotic for sane long-run defaults via tuning alone.** The accepted boom-bust
framing (`research-fertility.md`, ARD 050) is confirmed and sharpened: it is not a *persistent*
oscillator (HANDY's "cycles of prosperity and collapse") but a *terminal* one — it booms once and
goes extinct. The two single-lever exceptions that move `stable` off zero — high invention (6/16 at
800t) and a strong anti-Allee probe (3/16) — both leave the majority extinct, so neither is a sane
default by itself. Genuine long-run persistence needs a **new structural factor**, and the evidence
points at **crash recovery**: an anti-Allee mechanism, designed carefully and likely combined with a
second recovery channel (weakened partnership-density dependence at low N, or a younger
continuously-replenished age structure) so crashes bounce off a floor rather than ratcheting to
zero. High invention is a complementary mitigator worth carrying alongside it, not a replacement.

This is an ARD-level decision (new mechanic, non-obvious calibration), tracked under "Crash
recovery / age-structure" in `docs/future-ideas.md`. Discuss with the project owner before any
implementation. Until then, the current 0.6 / short-horizon "outcome variety" default remains the
right call — it is honest about being a slice through the overshoot, not a claim of stability.

## Calibration protocol for the eventual crash-recovery ARD

When crash recovery is built, sweep-validate against the targets this study established:

- **Primary:** `stable` (sustained-cycle count) rises off zero across seeds **at 500–800 ticks**
  (not 300 — the invention case proved 300 can lie) while extinction share falls, without erasing
  outcome variety (do not collapse everything to STABLE).
- **Secondary:** the boom peak is *not* suppressed (recovery should rescue the trough, not cap the
  boom — that was the failure mode of the density-dependent fertility brake in
  `research-fertility.md`).
- Validate in a binding-`K` regime with an antisocial `personTypes` cohort so the confounding
  feedbacks (killing/theft/jail, inequality) are active, per the fertility-study protocol.
