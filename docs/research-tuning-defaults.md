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

> **Re-verified 2026-09-14 (commit 84c675d) — the ladder's methodological lesson holds; its
> headline `stable=6/16` does not.** Full re-measurement, same 16 seeds and horizons
> (`--sweep BASE_INVENTION_RATE=0.002,0.01,0.03`):
>
> | rate | 300 ticks | 500 ticks | 800 ticks |
> |---|---|---|---|
> | 0.002 | 10/16 ext | 13/16 ext | 15/16 ext, 1 stable |
> | 0.01 | 6/16 ext | 9/16 ext | 15/16 ext, 1 stable |
> | 0.03 | 7/16 ext | 9/16 ext, **0 stable** | **12/16 ext, 3 stable** |
>
> No individual cell differs significantly at n=16 (every Fisher p ≥ 0.23) — but the whole 0.03 row
> moves against the original at all three horizons, so the 0.03/800 cell was re-run at **48 seeds**
> against a **matched 48-seed default control** on the same commit and seeds:
>
> | | default | 0.03 (15×) | Fisher p |
> |---|---|---|---|
> | `stable` | 2/48 (4.2%) | 6/48 (12.5%) | **0.268** |
> | extinct | 46/48 (95.8%) | 39/48 (81.2%) | 0.051 |
>
> Two conclusions. **(1) The extinction benefit is real at 800 ticks** — 95.8% → 81.2%, p=0.051.
> *(Superseded 2026-09-14: it is not real at 2000 ticks. Extending the horizon ladder to
> 800/1200/1600/2000 at 48 seeds gives invention 39 → 45 → 47 → **48/48** extinct against the
> default's 46 → **48/48**. Invention delays total extinction by roughly 800 ticks and prevents
> nothing. This study's sharp distinction between 0.01 "only delays the crash" and 0.03 "does more
> than delay" collapses — **both only delay**, and no part of the invention lever survives an
> adequate horizon.)* **(2) The sustained-cycle claim does not hold either.** The recorded 37.5%
> (6/16) is three times the best current estimate of 12.5% (6/48) and sits outside its 95% CI
> [5.9%, 24.7%]; more importantly, at matched power 12.5% is **not distinguishable from the default's
> 4.2%** (p=0.27, CIs overlap heavily). So "the only single-lever change to produce genuine sustained
> cycles" is not supported: at n=48 this lever does not demonstrably move `stable` off the default at
> all.
>
> The horizon rule this section exists to teach is untouched — 0.01 still evaporates from 6/16 extinct
> at 300 ticks to 15/16 by 800, and the 0.002 row reproduces. What failed is a `stable` count read off
> 16 seeds, which is exactly the failure mode the "Statistical power of the sweep metrics" item in
> `docs/future-ideas.md` predicted. Cause of the drift is not separable from noise here, but ARDs
> 052–062 landed between the two measurements and none of them appear in this study's
> `Key context vars`. Measurement recorded in `docs/research-sweep-session-2026-09-14.md`.

Two distinct behaviors:

- **A modest boost (0.01) only *delays* the crash.** The 4/16-survival at 300 ticks is the
  mid-overshoot artifact in full force — it evaporates to total extinction (16/16) by 800. This is
  the cautionary case that motivates the horizon rule above.
- **A large boost (0.03, ~15×) does more than delay.** *(⚠ Re-verified 2026-09-14: this bullet's
  central claim did not reproduce — at 48 seeds `stable` is 6/48 and not distinguishable from the
  default control. The extinction reduction survives; "sustained cycles" does not. See the note above
  the table.)* It is the only single-lever change to
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
default by itself. *(⚠ Re-verified 2026-09-14: the high-invention exception does not hold at 48
seeds — `stable` 6/48 vs a matched default control's 2/48, p=0.27. It reduces extinction but is not
shown to move `stable`. The anti-Allee probe's 3/16 was never re-measured and rests on the same
n=16 basis, so treat it with the same suspicion. See the note under the invention ladder.)* Genuine long-run persistence needs a **new structural factor**, and the evidence
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
