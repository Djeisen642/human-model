# ARD 066: Heritability Reads Endowment, Not Accumulated State

**Status:** Proposed
**Date:** 2026-09-19

## Context

ARD 064 anchors a newborn's trait draw to the living population's mean for that trait. Implemented and measured (`docs/research-heritability-anchor.md`), it fixes what it targeted — `learningIntent` holds at 0.383–0.630 against a founder mean of 0.500 where it previously collapsed to 0.014, and ARD 045's prosocial/antisocial asymmetry survives in 8 of 8 runs — and introduces a runaway in every trait that grows during a person's life.

Measured at 300 founders over 2000 ticks, against the pre-ARD-064 tree: `intelligence` reaches 19.73–19.96 against `INTELLIGENCE_MAX` of 20, where the control sits at 6.04. `stealingIntent` sits at its `STEALING_INTENT_CAP` in every run with zero spread, where the control sits at 0.025.

The cause is that three fields carry two different things at once. Exactly three heritable fields are mutated after birth: `intelligence` by `LearnEvent`, `GraduationEvent` and `StatDecayEvent`; `constitution` by `ExerciseEvent` and `StatDecayEvent`; and `stealingIntent` by `StealEvent`'s ARD 036 emboldening. The other four — `charisma`, `learningIntent`, `exerciseIntent`, `killingIntent` — are set once and never change, and those are exactly the four that behaved correctly under ARD 064.

So the population mean of `intelligence` is not a mean of heritable endowments; it is a mean of endowments plus however much each living person has learned. Feeding that back into the next generation's draw is a positive feedback loop: children start higher, accumulate on top, and the mean ratchets until it meets a cap. ARD 064 is right that offspring regress toward a population mean. It is wrong about which mean, and it cannot be fixed by choosing a different anchor, because the quantity it needs is not represented anywhere.

## Decision

Each of the three fields mutated after birth gains a companion **endowment** field holding the value that person was born or seeded with. The existing field keeps its name and meaning — the effective, currently-expressed value every other part of the model already reads — so no consumer changes.

- `Simulation.seed` sets a founder's endowment to the value it drew for them.
- `ChildbirthEvent` draws a newborn's endowment from the living population's **endowment** distribution for that field, then sets the effective value equal to it. A person begins life expressing exactly their endowment.
- The events that grow or decay a trait continue to mutate only the effective field. Endowment is immutable for a person's whole life.
- `Simulation.traitDistribution` reports the endowment distribution for these three fields and the effective distribution for the other four, which have no endowment to distinguish.

No new `Variables` constants. The four unsplit fields are left alone deliberately: adding endowment fields that could never diverge from their effective values would be dead state, and the asymmetry between the two groups is information — it tells a reader exactly which traits the model lets a life change.

## Reasoning

**Why split the field rather than pick a better anchor.** The obvious cheaper fix is to anchor on a young cohort — people below some age have accumulated little, so their mean approximates endowment. It needs one constant and no new state. It was rejected because it is an estimator for a quantity the model could simply record. The cohort age would be a new magic number chosen to trade bias against sample size; it would still be biased, since `GraduationEvent` fires in the early twenties and `StatDecayEvent` has not yet bitten; and at this model's cycle troughs the young cohort can be a handful of people, exactly when the estimate is worst. Recording endowment is exact, needs no constant, and cannot degrade with population size.

**Why not roll back ARD 064 to a constant anchor.** Rejected. That reintroduces the defect ARD 064 exists to fix: a constant anchor collapses every intent to a floor within three generations and makes composition unable to respond to anything. The measurement shows ARD 064 works correctly for the four fields where endowment and expression coincide; the problem is confined to the three where they do not.

**Why not split every heritable field for symmetry.** Rejected. For `charisma`, `learningIntent`, `exerciseIntent` and `killingIntent` the endowment field would be a permanent copy of the effective field, identical for every person at every tick — state that can never be read to any purpose and that a future event mutating one of those fields would silently desynchronise. The split should track the real distinction, and a reader should be able to tell which fields a life can change by looking at which ones have an endowment.

**Why endowment is immutable rather than slowly updated.** Considered: letting a person's endowment drift toward their expressed value, so that sustained learning eventually becomes heritable. Rejected as a separate decision, not a detail of this one. It is Lamarckian inheritance, it would reintroduce the ratchet in slower form, and if it is ever wanted it should be argued on its own terms rather than smuggled in as an implementation choice here.

## Consequences

- `Person`: three new fields, one per split trait, defaulting the same way their effective counterparts do.
- `Simulation.seed`: sets each founder's endowment alongside the drawn value.
- `Simulation.traitDistribution`: reads the endowment field for the three split traits. The per-tick cache and the small-population fallback from ARD 064 are unchanged.
- `ChildbirthEvent.seedNewborn`: draws endowment and assigns both fields for the three split traits; unchanged for the other four.
- The events that mutate these traits are untouched, as is every consumer of the effective values. That is the point of keeping the existing field names.
- Tests: a person's endowment never changes while their effective value does; a newborn's endowment is drawn from the population's endowments, not from their expressed values; a population whose expressed values have all ratcheted to a cap still produces children near the endowment mean — the regression test for the defect this ARD fixes.
- **Re-run the ARD 064 measurement after this lands.** `docs/research-heritability-anchor.md` is the before; the same probe should show `intelligence` and `stealingIntent` holding near their founder means instead of pegging at their caps, and the four unsplit fields unchanged from their ARD 064 behaviour. Until that is measured this is unproven, exactly as ARD 064 was.
- Numbered 066 rather than 065: PR #121 proposed a different ARD 065 (resource-threshold years) concurrently. That PR is mergeable and this one is blocked on sign-off, so this side renumbered.
- Known weakness: `StatDecayEvent` pushes an elderly person's effective value below their endowment, so the effective and endowment population means diverge with the age structure. That is correct — endowment is what is heritable — but it means the two numbers tell different stories and a future reader comparing them should know which one a given report is using.
- `docs/model-reference.md`'s heritability bullet and its ARD 064 caveat both need rewriting once this lands.
