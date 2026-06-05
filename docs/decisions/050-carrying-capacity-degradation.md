# ARD 050: Carrying Capacity Degrades Under Overexploitation

**Status:** Accepted
**Date:** 2026-06-04

## Context

`docs/research-fertility.md` established that the natural-resource carrying capacity never binds.
Ceiling-growth invention (ARD 007/047) ratchets the ceiling up to its 1M cap, and because pool
regeneration is coupled to the ceiling (ARD 043, `ceiling × regen-fraction`), regen then dwarfs
total extraction — a default run ends with the pool 99.7% full and per-capita resources climbing
without bound. With carrying capacity effectively infinite, every density-dependent feedback
(resource-limited fertility, consumption pressure, starvation, inequality-driven conflict) lies
dormant, and the model cannot express the one collapse mechanism it was built around:
overexploitation degrading carrying capacity (HANDY, Tainter, Diamond). The ceiling only ever
grows, so declining-carrying-capacity collapse is impossible. Binding the ceiling is the
prerequisite for the fertility recalibration that research-fertility.md defers until it exists.

## Decision

Make carrying capacity a **dynamic balance** between technology that raises it and exploitation
that degrades it, instead of a quantity that only ratchets upward.

**Degradation under exploitation.** Each tick the ceiling erodes in proportion to how drawn-down
the pool is — a lightly used environment (pool near its ceiling) barely degrades, while a heavily
exploited one (pool drawn far below its ceiling) loses carrying capacity quickly. Because regen
is coupled to the ceiling, a falling ceiling drags regeneration down with it, so sustained
overexploitation feeds a self-reinforcing collapse spiral. A floor keeps a wrecked environment at
some minimum carrying capacity rather than locking it permanently at zero.

**Gentler, decoupled technological growth.** Invention's ceiling-growth branch is given its own
small magnitude, separate from the productivity random-walk magnitude, so technology lifts
carrying capacity gradually rather than (as before) by tens of percent per invention. This lets
degradation actually balance growth; without it, growth swamps any plausible erosion rate and the
ceiling still runs to the cap during expansion phases. The productivity faster/slower branches are
untouched, so ARD 047's symmetry is preserved.

**A tighter cap to keep regen comparable to extraction.** The upper cap on the ceiling is
recalibrated down from its old very-high guard value (100× the initial ceiling) to a small
multiple of it. At the old cap, ceiling-coupled regeneration so far outran total extraction that
the pool stayed full regardless of population; a small-multiple cap keeps regen on the same order
as extraction, so the commons actually binds. The cap and degradation are complementary: the cap
bounds the range carrying capacity can occupy, while degradation moves it down within that range
under load. (Recalibration of an existing ARD 047 constant, not a new one.)

The result: an environment used within its means can still see carrying capacity rise with
technology (thrive); an environment exploited beyond its regeneration degrades, pulling regen and
population down after it (collapse). Resources now bind, and the outcome is endogenous to how hard
the population draws on the commons.

**New constants.** A **degradation rate** (how fast the ceiling erodes at full depletion), a
**ceiling floor** (minimum carrying capacity a degraded environment retains), and a **dedicated
ceiling-growth magnitude** for invention (gentle, decoupled from the productivity magnitude).
`MAX_NATURAL_RESOURCE_CEILING` is recalibrated downward. Values live in `Variables.ts` and are
tuned by observing runs.

## Reasoning

**Rejected: lower the ceiling cap *alone* (no degradation).** Tightening
`MAX_NATURAL_RESOURCE_CEILING` is necessary — and is part of this decision — but insufficient on
its own: a capped ceiling still only ever grows, so it cannot express declining carrying capacity,
and the project's collapse thesis (overexploitation reduces future capacity) needs a ceiling that
can fall. The cap binds the range; degradation supplies the downward, behavior-driven movement
within it. Neither alone gives a dynamic, binding carrying capacity.

**Rejected: stochastic ceiling drift.** A random downward walk on the ceiling would bind it, but
it decouples degradation from behavior — collapse would be bad luck rather than a consequence of
how the population uses the commons. Tying erosion to pool depletion makes overexploitation the
cause, which is the dynamic worth modeling.

**Rejected: degrade by a cumulative-extraction accumulator.** Counting total resources extracted
and decaying the ceiling against it would work but needs a new piece of state. The pool's current
depletion fraction is already available every tick and is a clean proxy for exploitation
intensity, so no accumulator is warranted.

**Why tame invention growth as part of the same decision.** Degradation and ceiling-growth are
the two forces setting carrying capacity; calibrating one without the other is meaningless. The
old per-invention growth was large enough that, aggregated over a population of inventors, it
lifted the ceiling by double-digit percentages per tick — no realistic erosion could offset that.
The two belong in one ARD because the balance between them is the decision.

## Consequences

- `Simulation` gains a per-tick environmental-degradation step that erodes the ceiling by an
  amount proportional to pool depletion, floored at the new minimum; `LooperSingleton` runs it
  each tick alongside the existing regeneration. The regeneration step itself (ARD 043) is
  unchanged — the ceiling it reads now simply moves both ways.
- Invention's ceiling-growth branch uses the new gentle, dedicated magnitude; its productivity
  branches are unchanged.
- The per-tick ceiling is already captured in snapshots (ARD 032), so degradation and recovery
  show up in the resource-pool report and chart without new plumbing.
- Tests must cover: the ceiling erodes faster the more depleted the pool is; a full pool causes
  no degradation; the ceiling cannot fall below its floor; invention ceiling-growth uses the
  gentle magnitude and still clamps at the cap.
- Validation (observational): resources now bind — a default run no longer ends with the pool
  near-full or the ceiling pinned at the cap; a lightly-loaded run can still grow its ceiling
  (thrive) while an overexploited one degrades it (collapse). **This ARD binds carrying capacity;
  it does not on its own stop population overshoot — a stable population still requires the
  density-dependent fertility work that `research-fertility.md` sequences after this.**
- Refines [ARD 043](./043-regen-coupled-to-ceiling.md) (regen still couples to the ceiling, but
  the ceiling is no longer monotonic) and [ARD 047](./047-invention-bounds-and-symmetry.md)
  (productivity symmetry unchanged; ceiling-growth magnitude decoupled and reduced); builds on
  [ARD 007](./007-resource-cap-and-invention.md). Subsumes the "long-term environmental drift"
  item in `docs/future-ideas.md`. Research basis: `docs/research-fertility.md`.
