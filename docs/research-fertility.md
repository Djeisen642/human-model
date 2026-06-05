# Research: Fertility, Carrying Capacity, and Population Regulation

Follow-up to ARD 049. Fixing the death model removed the ~80 fake suicides/run that had been
silently balancing births, so the realized birth/death imbalance is now exposed. The task was a
"research-based recalibration" of fertility. The central finding is a **negative result**: no
value of `BASE_CHILDBIRTH_RATE` produces a persistent population, because the model has no
density-dependent regulation that lets population settle at a carrying capacity. Recalibration
alone cannot fix it; the fix is structural. This doc records the evidence and the recommended
mechanism.

Sources: existing `docs/research-childbirth.md` (ASFR, Hutterite ceiling, replacement); Verhulst
logistic / Malthusian population theory and density dependence (population-ecology texts); HANDY
collapse model (Motesharrei 2014, already in `project-background.md`); "The Invisible Cliff"
(Lee & Tuljapurkar/Puleston-style natural-fertility agrarian Malthusian dynamics, PMC3909123).

## The demographic target

For the collapse/thrive signal to come from inequality and resource dynamics (the project's
purpose), the baseline population must be **bounded and responsive** — it should approach a
carrying capacity `K` set by resources and stay near it, so that collapse (decline + high Gini)
and thrive (sustained population + low Gini) are both reachable. That requires:

- **Replacement-level realized fertility** at equilibrium (births ≈ deaths near `K`). Real
  replacement TFR is ~2.1 in low-mortality settings, higher under high mortality.
- **Density dependence**: fertility and/or mortality must respond to population relative to `K`,
  so growth slows *before* a catastrophic resource crash. This is the defining feature of
  logistic (vs. exponential/Malthusian) dynamics. Without it, populations "seldom reach carrying
  capacity and remain stable; rather, they experience overshoot and die off."

## Why the current model has neither

Two structural defects, both shown in simulation:

### 1. Carrying capacity is effectively infinite (resources never bind)

In the default config the natural-resource pool ends a 100-tick run at **997,210 / 1,000,000**
(0.3% used) and resources/person climb 44 → 1,054. The cause: ceiling-growth invention
(ARD 043/047) inflates the ceiling to its 1M cap, and pool regeneration (`ceiling × 3%` ≈
30,000/tick) then dwarfs total extraction (~1,000/tick). Without ceiling inflation the 10,000
pool would be exhausted in ~15 ticks and resources *would* bind — so the inflation is precisely
what removes the carrying capacity. With `K → ∞`, every density-dependent feedback
(resource→fertility suppressor, consumption pressure, starvation, inequality→killing) is
dormant, and the confounding events that should regulate population never fire (a default run
dies 104 illness / 9 killing / 2 suicide — conflict is negligible).

**Consequence:** with no binding `K`, `BASE_CHILDBIRTH_RATE` only sets an unbounded exponential
rate. Population grows to 1,246 by tick 200 even at a reduced rate of 0.30. No value is stable
because there is nothing for it to be stable *against*.

### 2. No density-dependent damping — overshoot leads to extinction, not equilibrium

Pinning the ceiling (`MAX_NATURAL_RESOURCE_CEILING = 10,000`) makes resources bind, and a
carrying capacity appears — but the population does not settle at it. It overshoots and then
collapses to extinction, with no recovery:

| Regime (seed 42, 200–400 ticks) | Trajectory |
|---|---|
| Unbound K, rate 0.30 | 100 → 1,246 and climbing (explosion) |
| **Bound K**, rate 0.40 | 100 → 328 (overshoot K) → 19 (yr200) → **0 (yr250)** |
| Bound K, rate 0.24 | peak ~97 → extinction |
| Bound K, rate ≤0.20 | monotone decline → extinction |

The sweep shows a knife-edge with no stable point: rates ≤ ~0.30 go extinct directly; rate ~0.40
overshoots `K`, crashes the per-capita economy (resources/person 42 → 26, illness deaths
104 → 418), and the sparse remnant cannot recover. This is the classic overshoot-and-die-off,
made terminal by three model properties:

- **Abrupt, late density feedback.** The only fertility suppressor tied to crowding is the
  resource floor (`CHILDBIRTH_RESOURCE_MIN/SCALE = 10/30`), which engages only once per-capita
  resources are *already* near subsistence — too late to brake the overshoot smoothly.
- **Reproductive lag + synchronized cohort.** All 100 seeds start age 15–50 and age together, so
  births arrive in echoing waves rather than a smooth stream.
- **No crash recovery (Allee effect).** Reproduction needs two partnered adults; once a crash
  thins the population, partnership formation and the couple pool collapse and the remnant dies
  out instead of rebounding.

## Recommendations

The recalibration the task asked for is necessary but **not sufficient**; the following are
coupled and should be designed together (each a small ARD).

1. **Bind the carrying capacity (prerequisite).** Tame ceiling-growth invention so resources
   bind — e.g. cap the ceiling at a small multiple of its initial value, make ceiling growth
   rarer/smaller, or let the ceiling decay (the "long-term environmental drift" item already in
   `future-ideas.md`). Until `K` binds, no fertility value can be stable. This is a
   resource-system decision (touches ARD 043/047) and needs its own ARD.

2. **Add graded density-dependent fertility.** Replace the abrupt resource-floor suppressor with
   a smooth term that lowers birth probability as population approaches `K` (equivalently, as
   per-capita resources fall toward the comfortable→deprived boundary), so the population brakes
   *before* overshoot. This is the logistic `(1 − N/K)` factor the model is missing and is the
   single highest-value change for producing a stable, non-degenerate baseline.

3. **Set `BASE_CHILDBIRTH_RATE` near replacement** as part of (2). The Hutterite-ceiling value of
   0.40 (TFR ≈ 11) was only ever balanced by the suicide bug; with density damping in place,
   fertility should sit just above replacement so the population approaches `K` and the collapse
   signal comes from resources/inequality, not from raw birth/death imbalance. The exact value
   must be re-swept *after* (1) and (2), since both change the equilibrium; a standalone value
   chosen now would be calibrated against a degenerate regime.

4. **Optional: soften the crash-to-extinction (Allee).** If post-collapse recovery is desired
   (so collapse is survivable, not always terminal), reduce the partnership-density dependence of
   reproduction at low population, or seed age structure with spread rather than a synchronized
   cohort to damp the demographic wave.

## Calibration protocol for the eventual sweep

Once density dependence and a binding `K` exist, calibrate and validate fertility in a regime
where the confounders are active — **not** the vanilla default. Use a scenario with (a) a bound,
scarce resource ceiling so `K` is finite, and (b) `personTypes` including an antisocial cohort so
killing/theft/jail fire. Target: a healthy run approaches `K` and persists (no explosion, no
extinction) with both collapse and thrive reachable across seeds; a stressed run (higher
inequality cohort or scarcer `K`) tips to collapse via Gini/resources rather than via the
fertility constant.

## Suggested targets

| Lever | Current | Direction | Rationale |
|---|---|---|---|
| Carrying capacity binding | `K → 1M` (unbound) | bound `K` to a small multiple of initial | Without it no fertility value is stable; re-enables density feedback |
| Density-dependent fertility | absent (abrupt resource floor only) | add smooth `(1 − N/K)`-style suppressor | Brakes growth before overshoot; the missing logistic term |
| `BASE_CHILDBIRTH_RATE` | 0.40 (Hutterite TFR≈11) | ~replacement, re-swept after the above | 0.40 only balanced the old suicide bug; re-sweep in a binding regime |
| Crash recovery (Allee) | terminal (no rebound) | optional: weaken low-density partnership dependence | Makes collapse survivable rather than always extinction |

## Resolution (sweep-harness investigation, 2026-06)

ARD 050 bound the carrying capacity (lever 1). With `K` binding, the fertility recommendations
above (levers 2–3) were then tested empirically with `scripts/sweep.ts` across 16 seeds at
100–300 ticks. The result overturned the plan:

- **Density-dependent fertility (lever 2) is counterproductive.** A smooth `fillFraction^exp`
  brake suppresses fertility *everywhere the pool is drawn down* — including during recovery,
  when the population is low but still consuming — so it pushes toward sub-replacement and makes
  extinction *more* likely (15/16 vs 12/16 with no brake at 300 ticks). It caps the overshoot but
  kills the rebound. The brake was dropped.
- **No `BASE_CHILDBIRTH_RATE` yields long-run stability (lever 3).** Across the whole range,
  including absurd values (base 5.0, TFR off the charts), 300-tick runs still go extinct ~10–16/16
  — low fertility starves, high fertility overshoots and crashes, and crashes hit *zero* because
  survivors are old/sparse (the Allee/age-structure floor). The bound-`K` model is an intrinsic
  overshoot→collapse→extinction oscillator; **fertility tuning cannot stabilize it.**

**Decision: accept boom-bust as a legitimate (HANDY-style) model behavior** rather than force a
stable equilibrium. `BASE_CHILDBIRTH_RATE` was set to **0.6**, sweep-chosen for the richest
*outcome variety* at the canonical 100-tick horizon (`STRUGGLING×6 COLLAPSE×4 STABLE×6` across 16
seeds, resources binding ~35% of ticks, peak Gini ~0.52) rather than for equilibrium — base 0.4
is placid (`STABLE×11`), and longer horizons collapse regardless. The collapse/thrive signal now
comes from *which* trajectory a seed takes through the boom-bust, driven by Gini and resource
dynamics.

Genuine long-run stability, if ever wanted, would need the structural pieces fertility can't
supply — crash recovery (lever 4: younger/desynchronized seeding or a low-density fertility
boost so crashes bounce off a floor) — not another fertility constant. Tracked in
`future-ideas.md`.
