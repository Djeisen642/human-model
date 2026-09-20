# ARD 068: Wealth-Scaled Access to the Commons

**Status:** Accepted
**Date:** 2026-09-20

## Context

`CLAUDE.md` opens by calling the Gini coefficient of `resources` the primary collapse signal, and
immediately records that measurement contradicts it: `docs/research-inequality-signal.md` found peak
adult Gini of 0.600 against 0.590 (p = 0.76, paired seeds) between a configuration losing 16 of 16
seeds and one losing none. The stated reason is structural. `GatherResourcesEvent` gives every agent
the same formula, `experience × (BASE_GATHER_AMOUNT + intelligence × INTELLIGENCE_GATHER_SCALAR) ×
extractionProductivity`, in which a person's existing wealth appears nowhere. Wealth gains are
therefore additive and independent of wealth, and the only proportional term anywhere in the wealth
dynamic is the 2% tax pulling the other way. Inequality can only arise from dispersion in experience
and intelligence, from theft, and from the luck of who dies when. It is an output of the resource
economy, so it cannot be a cause of anything.

Measured directly, in the surviving 100-founder configuration of
`docs/research-clean-long-run-100-founders.md` (seed 1, sampled every 200 ticks to 3,000):

| Statistic | Model | Real societies |
|---|---|---|
| Top 1% share of adult wealth | 1.9–7.6% (median ~3.4%) | ~35% US, ~20–25% Western Europe |
| Top 10% share | 16–45% | ~70% US, ~50–60% Western Europe |
| Richest adult / median adult | 2.7–9.5× | three or more orders of magnitude |
| Adult Gini within one run | 0.088–0.679 | wealth Gini 0.6–0.85 modern; 0.35–0.6 post-Neolithic (Kohler et al. 2017) |

A top 1% holding 3.4% of the wealth is a distribution with essentially no tail: under perfect
equality that figure is 1%. The Gini swing inside a single run is the same finding from the other
side, tracking the boom-bust phase rather than any social structure, which is exactly why it fails
to separate configurations.

The empirical literature on wealth accumulation is consistent about which ingredient is missing.
Bewley-type models, where dispersion comes from saving out of risky labour income, are known to
under-predict the top tail badly; what generates a Pareto tail is idiosyncratic *capital* income,
that is, returns proportional to wealth already held (Benhabib, Bisin & Zhu 2011; Benhabib & Bisin
2018). Kesten processes formalise it: a wealth rule mixing a multiplicative term with an additive
one has a power-law stationary distribution, while a purely additive rule does not. Fagereng, Guiso,
Malacrino & Pistaferri (2020), on Norwegian administrative data, find returns to wealth that are
persistently heterogeneous across individuals, rising with wealth held, and correlated between
parents and children. The kinetic-exchange literature supplies the counterweight: Boghosian's
analysis of the yard-sale model shows multiplicative exchange condenses all wealth onto one agent
unless a redistributive term opposes it, which is what makes the tax and welfare already in this
model load-bearing rather than decorative.

This model has the additive term and no multiplicative one. That is the gap this ARD closes.

## Decision

`GatherResourcesEvent` multiplies its existing potential by a per-person **access multiplier**: the
agent's `resources` divided by the reference median, raised to a configurable exponent, clamped to a
configured range, and then normalised so that the mean multiplier across eligible agents is exactly
1. The exponent is the lever. At zero, every multiplier is exactly 1 and the mechanism is off.

Four properties define it.

**The exponent is the only dial, and zero is off.** At an exponent of zero, every raw multiplier is
1, the clamp leaves it at 1, the mean is 1, the normalisation divides by 1, and the extraction
formula is multiplied by exactly 1. Floating-point multiplication by 1.0 is exact, and the mechanism
draws no random numbers at any setting, so the default configuration's tick history is bitwise
unchanged and `scripts/parity-check.ts` is the proof rather than a claim. This makes the entire
existing body of research in `docs/research-*.md` comparable across the change, and makes the
mechanism a sweepable dimension (`--sweep`) rather than a fork in the model.

**Normalisation holds aggregate extraction capacity fixed.** Without it, raising the exponent raises
total potential extraction, and the mechanism becomes the extraction lever that
`docs/research-extraction-need-ratio.md` and `docs/research-productivity-band.md` already establish
dominates every outcome in this model. Any collapse measured that way would be scarcity in costume.
Normalising to a mean of 1 makes the exponent a pure distribution dial, which is what makes the
HANDY question askable here: does concentrating the same extraction into fewer hands change
survival? Note that under a binding commons the aggregate drain is pool-limited in both arms anyway,
so the mechanism's whole effect is distributional by construction.

**The basis is adults, and the reference is the median.** Eligibility follows ARD 060: the reference
median is taken over agents at or above `WORKING_AGE_MIN`, and only those agents receive a
multiplier other than 1. A child's own `resources` is not their standard of living anywhere else in
the model (ARD 024 charges them a token rate, `Person.happiness` substitutes the parental mean, ARD
062 excludes them from welfare), so reading a child's balance as a claim on the commons would
contradict three existing decisions at once and would make the mechanism's strength depend on the
dependency ratio, and so on the birth rate. The median rather than the mean, because the mean is
dragged by the tail the mechanism itself creates, which would make the gradient self-damping in
exactly the regime worth measuring.

**Multipliers are computed once per tick, before the agent loop.** `Simulation` takes the reference
median and the normalisation factor after taxation and writes each person's finished multiplier onto
them; `GatherResourcesEvent` reads that snapshot. Caching only the two scalars and evaluating the
multiplier at gather time would not be equivalent, because theft, help and childbirth move a
person's resources during the tick, so the Fisher-Yates extraction shuffle would decide who counts
as rich part-way through it. That is order dependence inside a mechanism whose entire purpose is
measuring distribution. Computing the median inside the loop would be worse still, adding a sort per
agent next to the Gini path that `718a295` optimised because `KillEvent` already re-evaluates it
inside the tick.

Three constants, all in `Variables.ts`:

- `EXTRACTION_ACCESS_GRADIENT` — the exponent on relative wealth. Zero disables the mechanism.
- `EXTRACTION_ACCESS_MIN` — lower clamp on the multiplier. Not a calibration dial: without it, an
  agent at zero resources has a multiplier of zero, extracts nothing forever, and zero is an
  absorbing state, which would kill every newborn and every agent who was ever robbed to zero. It
  represents subsistence gleaning that no property regime fully forecloses.
- `EXTRACTION_ACCESS_MAX` — upper clamp. A numerical guard against condensation, set high enough not
  to bind in the intended calibration range. See the Reasoning for why it is not the inequality
  dial.

`Variables.validate()` gains a check that `EXTRACTION_ACCESS_MIN ≤ 1 ≤ EXTRACTION_ACCESS_MAX`. This
is an ARD 067 style invariant: if the clamp range excludes 1, the off setting silently stops being
neutral and every sweep that thought it had a baseline arm does not have one, with no error.

## Reasoning

**Rejected: an elite consumption multiplier, which is how `docs/future-ideas.md` framed this.** That
entry proposes scaling `ConsumptionEvent` by wealth rank, faithfully to HANDY's κ. It does not
transfer to this model's plumbing. `ConsumptionEvent` deletes resources from a personal balance and
returns nothing to `naturalResources`; `GatherResourcesEvent` is the only path that touches the pool.
So in this model a rich agent who extracts and hoards damages the commons exactly as much as one who
extracts and consumes, and a consumption multiplier only moves numbers around inside already
extracted private stock. HANDY's elites deplete the commons through privileged *claims* on it, and
in this codebase claims live in the gather equation.

**Rejected: rank as the basis, rather than wealth relative to the median.** Rank is scale-free,
which sounds like a virtue and is the defect: it makes the gradient bite identically in a society
where the richest agent holds 5× the median and one where they hold 500×, so the mechanism would
assert a fixed level of stratification instead of letting stratification emerge and feed back. It is
also close to circular against the Gini, the measure this mechanism exists to make meaningful.

**Rejected: absolute wealth thresholds, for example an access bonus above some holding.** ARD 067
records the general problem: every absolute stock threshold in this model silently asserts a number
of years of consumption and re-anchors whenever extraction changes. An absolute access threshold
would do the same, and would need recalibrating for every configuration in the existing research
corpus.

**Rejected: a tight clamp on the multiplier as the way to control runaway.** The obvious safety
design is a low `EXTRACTION_ACCESS_MAX`, say a small multiple. A reduced-form model of the wealth
dynamic (400 agents, model constants for extraction, consumption, tax and welfare, heterogeneous
earning capacity and generational turnover with bequests) shows what that costs. Uncapped, the
exponent produces a clean dose-response: top 1% share 3.9% at zero, 5.7% at 0.25, 10.2% at 0.5,
27.5% at 0.75, then condensation past roughly 0.9 where the top 1% holds two thirds or more and the
median pins at the welfare line. Capped at 4×, every exponent from 0.75 upward returns the same
distribution: the cap converts the gradient into a binary and destroys the dose-response that makes
this a measurement instrument rather than a switch. The clamp therefore exists as a guard against
numerical degeneracy, set well outside the calibration range, and the exponent is kept below
condensation instead. An institutional ceiling on accumulation is a genuinely interesting second
lever and belongs in its own ARD, not smuggled in as a safety rail.

**Rejected: a new `claim` or `accessShare` field on `Person`, accumulated by its own rule.** This is
the more general design and is worse here for two reasons. Seeding a new heritable field at founding
consumes random draws, so the mechanism's off setting would no longer reproduce the existing
corpus bitwise, forfeiting the single most useful property of the design. And `resources` already
carries inheritance through ARD 042's estate split, so reading it gives heritable access for free:
under a positive gradient a bequest is a bequest of extraction capacity, which is the
intergenerational persistence Fagereng et al. measure and the mechanism that turns a wealth
distribution into a class structure.

**Rejected: doing nothing and replacing Gini as the headline signal with trough depth.** This is the
other fork named in `docs/research-inequality-signal.md` and in `docs/future-ideas.md`, and it is
not exclusive with this one. Trough depth should be the discriminator regardless, because it is the
better instrument. But retiring Gini without ever having built a mechanism that could make it mean
something would settle the project's founding premise by forfeit rather than by measurement.

## Consequences

- `src/Helpers/Variables.ts`: three constants and one `validate()` invariant. Default values must
  leave the mechanism off, so the default configuration is bitwise unchanged.
- `src/App/Simulation.ts`: per-tick computation and caching of the reference median and
  normalisation factor over adults, and a getter for `GatherResourcesEvent`. The adult filter and
  sort should reuse the `Float64Array` pattern `src/Helpers/Inequality.ts` adopted in `718a295`
  rather than adding a second comparator sort to the hot path.
- `src/Events/GatherResourcesEvent.ts`: potential is multiplied by the cached access multiplier
  before the `min(output, naturalResources)` clamp. The conservation property of ARD 039 is
  unchanged: pool drain still equals personal gain.
- `docs/odd-protocol.md`: §3 gains the tick-start computation; §7's GatherResourcesEvent entry gains
  the multiplier.
- `docs/model-reference.md` and `docs/calibration-guide.md`: the new sweep dimension, and the
  interpretation trap that a result at a positive gradient must not be compared against a different
  aggregate extraction.
- `docs/future-ideas.md`: the elite extraction differential entry is subsumed and moves to Discarded
  when this lands. The voluntary trade entry is untouched and remains the abundance-side mechanism.

Tests must cover: bitwise parity at the off setting via `scripts/parity-check.ts`; the normalised
mean being exactly 1 at any exponent; both clamps binding; an agent at zero resources still
extracting, since that is the absorbing-state bug the lower clamp exists to prevent; identical
per-agent multipliers under a different extraction shuffle in the same tick, which is the
order-independence the caching buys; children unaffected and excluded from the reference median; and
`validate()` throwing when the clamp range excludes 1.

**First study, with the prediction registered before it runs.** Exponent swept over roughly
0 to 0.75 in the 100-founder surviving regime, 24 paired seeds through `scripts/compare.ts`, with
trough depth (`scripts/trough-probe.ts`) as the discriminator rather than extinction count, per
`docs/research-clean-long-run-100-founders.md`. Prediction: trough depth falls monotonically in the
exponent while aggregate extraction holds flat, and the top 1% share rises through the empirical
pre-industrial range around an exponent of 0.4 to 0.6. Cross the sweep with `TAX_RATE` at zero and
at default, because the reduced-form model pins the median at exactly `WELFARE_THRESHOLD` once the
gradient bites, meaning redistribution becomes the subsistence base for half the population and
could absorb the entire effect. Include one deliberately unnormalised arm as a positive control, to
demonstrate the instrument can distinguish a change in distribution from a change in volume.

**Known weakness, and it is not small.** Private wealth in this model never depreciates and never
returns to `naturalResources`. Under a positive gradient, concentration sequesters the commons into
private stockpiles permanently, so a collapse observed at a high exponent may be the missing
depreciation rather than the inequality. This is a defect the mechanism exposes rather than one it
creates, but it means no causal claim about inequality should be published from this lever until a
stock-depreciation control arm exists. Logged separately in `docs/future-ideas.md`.

**Scope.** This is a collapse-side mechanism. It makes inequality causal and lets the project keep
or retire its founding premise on evidence. It does nothing for the abundance question, which needs
a positive-sum channel the model still lacks.
