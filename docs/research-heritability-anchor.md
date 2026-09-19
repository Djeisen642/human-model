# Research: Anchoring Heritability to the Living Population Ratchets Any Trait That Grows With Age

**Recorded:** 2026-09-19 | **Commit:** c7e8623 | **Latest ARD:** 064 | **Base config:** scaled commons + cut extraction (see Key context vars)
**Commands:** `npx ts-node drift-probe.ts 2000 8` (ad-hoc, see below); control run on the pre-ARD-064 tree via `git stash`
**Key context vars:** `HERITABILITY_RESIDUAL_SPREAD=1.0`, `HERITABILITY_MIN_SAMPLE=30`, `HERITABILITY_STAT_COEFFICIENT=0.4`, `HERITABILITY_INTENT_COEFFICIENT=0.25`, `INTELLIGENCE_MAX=20`, `STEALING_INTENT_CAP=0.8`

> **Resolved 2026-09-19 by ARD 066 — see "After ARD 066" below.** The runaway this document reports
> was real and is fixed; the measurements are kept as the before-picture.

**Headline: ARD 064 fixes exactly the collapse it targeted, and introduces a runaway in the two
traits that grow during a person's life. It should not be merged as it stands.** Anchoring a
newborn's draw to the living population's mean is a positive feedback loop for any trait some event
raises with age: children inherit the *phenotypic* mean, which includes a lifetime of accumulation,
so each generation starts higher, accumulates more, and the mean ratchets until it hits a cap.

300 founders, 2000 ticks, scaled commons and cut extraction. Population mean per trait at run end,
against the pre-ARD-064 tree as a control:

| Trait | Founder mean | Control (ARD 037) | ARD 064 | Verdict |
|---|---|---|---|---|
| `learningIntent` | 0.500 | 0.014 | **0.383 – 0.630** | fixed |
| `killingIntent` | 0.050 | 0.014 | **0.035 – 0.076** | fixed |
| `intelligence` | 6.000 | 6.04 | **19.73 – 19.96** | **ratcheted to `INTELLIGENCE_MAX` = 20** |
| `stealingIntent` | 0.150 | 0.025 | **0.800 in every run, zero spread** | **ratcheted to `STEALING_INTENT_CAP` = 0.8** |

ARD 045's prosocial/antisocial asymmetry survives: `killingIntent < learningIntent` in 8 of 8 runs,
without being hard-coded anywhere. That was the risk the ARD named, and it is not what went wrong.

## What the two failures have in common

`learningIntent` and `killingIntent` are set at birth and never modified again. They hold near their
founder means, which is the whole point of the change.

`intelligence` and `stealingIntent` are both raised during life:

- `LearnEvent` increments `intelligence`, capped at `INTELLIGENCE_MAX`.
- `StealEvent` increments `stealingIntent` by `STEALING_EMBOLDEN_INCREMENT` on every undetected
  theft, capped at `STEALING_INTENT_CAP` (ARD 036 emboldening).

Under ARD 037 a constant anchor absorbed that: children were pulled back to 5.5 or to zero no matter
what their parents had accumulated. Anchoring to the live mean removes the brake, and lifetime gains
become heritable. `constitution` was not measured but has the same shape — `ExerciseEvent` raises it
against `CONSTITUTION_MAX` — and should be assumed to ratchet too until checked.

**The model conflates endowment with accumulated state in one field.** A 70-year-old's
`intelligence` of 20 is a lifetime of learning, not a heritable endowment, but the draw cannot tell
the difference because there is only one number. ARD 064 is correct that offspring regress toward a
population mean; it is wrong about *which* mean, because the phenotypic mean is not the endowment
mean once a trait grows with age.

## Incidentally: a cap that was dead is now fully binding

`docs/future-ideas.md` records `STEALING_INTENT_CAP` as unreachable — measured on the pre-ARD-064
tree, 0 of 178,473 adult observations came within reach of 0.8, and the maximum seen was 0.555. Under
ARD 064 the population mean sits at exactly 0.800 in every run. The cap went from decorative to
load-bearing on one change to an unrelated subsystem, which is the argument for auditing the model's
caps rather than reasoning about them one at a time.

## What to do about it

Not settled here — this is a new decision, and the ARD is explicit that an adverse measurement is not
a licence to quietly re-add an anchor constant. The obvious candidate is to anchor on a **young
cohort** rather than the whole living population: people below some age have accumulated little, so
their mean approximates the endowment mean the draw actually wants. That reintroduces one constant
(the cohort age), but a meaningful one rather than a per-trait magic number, and it keeps everything
ARD 064 got right. Separating endowment from accumulated state into two fields is the thorough fix
and a much larger change.

## Caveats

- 8 seeds at 2000 ticks for the treatment, 4 for the control. The effects are large enough that
  sample size is not the question — `stealingIntent` is at the cap in every run with zero spread —
  but nothing here is a paired test, and the trait means were not compared with `scripts/compare.ts`.
- `constitution` and `exerciseIntent` were not measured.
- The probe was ad-hoc and is not committed; `Simulation.traitDistribution` makes it a few lines to
  rebuild.


## After ARD 066

ARD 066 gives the three fields a life can change a companion endowment field, immutable for life,
and has heritability read that instead of the expressed value. Same probe, same configuration,
8 seeds at 2000 ticks:

| Trait | Founder mean | ARD 064 alone | ARD 066 endowment | ARD 066 expressed |
|---|---|---|---|---|
| `intelligence` | 6.000 | 19.73 – 19.96 | **4.33 – 7.67** | 15.83 – 19.73 |
| `constitution` | 6.000 | not measured | **5.73 – 9.87** | 16.21 – 18.89 |
| `learningIntent` | 0.500 | 0.383 – 0.630 | 0.509 – 0.683 | same |
| `stealingIntent` | 0.150 | 0.800, zero spread | **0.104 – 0.186** | 0.223 – 0.324 |
| `killingIntent` | 0.050 | 0.035 – 0.076 | 0.038 – 0.069 | same |

The ratchet is gone. Endowments hold near their founder means; expressed values sit well above them,
which is correct and is the point — people do learn and do get emboldened over a life, and that is
simply no longer heritable. `constitution`, unmeasured before and predicted to be ratcheting on the
same mechanism, holds too.

**Education recovers, which was the symptom that started this.** With `learningIntent` at ~0.5
instead of the collapsed 0.014, enrollment fires about 35× more often: 53–72% of living adults hold
some education across three seeds, against the ~100% "None" visible in the HTML report before.

**Two things this surfaces rather than settles.** Expressed `intelligence` now sits near
`INTELLIGENCE_MAX`, because learning finally works and nothing else bounds it — that is a
calibration question about `LearnEvent` and the cap, not about heredity, and it was invisible while
the intent collapse suppressed learning entirely. And `stealingIntent`'s expressed range of
0.22–0.32 puts `STEALING_INTENT_CAP` (0.8) back out of reach, so that cap is decorative again after
one change to an unrelated subsystem made it briefly load-bearing — the second time in this study
that a cap's status flipped without anyone touching it, and the argument for auditing them as a set.
