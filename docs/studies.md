# Studies index

Every `docs/research-*.md` in one place, with what it found and whether it still stands. Open this before a study: several headline results were later contradicted, and the status column says which. For where the current findings add up, read the "Research state" section of `CLAUDE.md`.

**Status vocabulary** (the same word goes in the study's own banner, when it has one):

- **Current**: no later study or dated note contradicts it, as far as the docs record.
- **Partly superseded**: a later study or dated note contradicts or narrows a headline claim. The study carries a `> **Status:**` banner or an in-body dated note.
- **Resolved**: it reported a defect that has since been fixed; the measurements stay as the before-picture.
- **Historical**: measured against something since removed or changed.
- **Unchecked**: no `Latest ARD` in its provenance block, or no provenance block at all, so there is no way to tell how far later structural changes (ARD 052–068) affect it. Nobody has re-run it.

Add a row here in the same commit as any new study. When a study's status changes, update its row and its banner.

## Measured in the model

### Inequality and the Gini signal

| Study | Finding | Status |
|---|---|---|
| [inequality-signal](research-inequality-signal.md) (2026-09-18) | A config where every run dies and one where none dies reach the same peak Gini (0.600 vs 0.590), so Gini did not separate survival from collapse. | Partly superseded: ARD 068 added a causal mechanism |
| [access-gradient](research-access-gradient.md) (2026-09-20) | Wealth-scaled access to the commons (ARD 068) makes cycle troughs 18% shallower to 33% deeper; a threshold effect, decisive at a gradient of 0.75, and removing welfare funding roughly doubles the damage. | Current |
| [gini-metric](research-gini-metric.md) (2026-09-13) | `peakGini` is a crash-phase max-of-noise statistic, not a reading of the society. Absolute values predate the adult-only basis (ARD 060). | Partly superseded: relative claim holds, numbers historical |

### What lets a population survive

| Study | Finding | Status |
|---|---|---|
| [population-scaling](research-population-scaling.md) (2026-09-14) | The commons sets how big a society gets. Ten times the founders on a fixed pool gives 1.9x the peak; scaling the pool too gives 15.6x. | Current |
| [scale-robustness](research-scale-robustness.md) (2026-09-15) | Of four "helps once the commons is fixed" findings, the productivity pin and higher fertility hold at 4,000 ticks and 300 founders; the happiness baseline and the experience cap do not. First non-extinct regime. | Current |
| [productivity-band](research-productivity-band.md) (2026-09-18) | What kills runs is how far extraction productivity can wander, not the band's asymmetry. A bounded band beats both a pin and unbounded invention. | Current |
| [ceiling-pins-carrying-capacity](research-ceiling-pins-carrying-capacity.md) (2026-09-20) | Invention drives the resource ceiling to its cap by tick 6–8 and holds it there for 97–98% of the run, so pinned-regime cycles are flat by construction. | Current |
| [extraction-need-ratio](research-extraction-need-ratio.md) (2026-09-19) | Cutting per-person extraction shrinks the boom-bust from 90-fold to 8-fold without improving survival. The effect turned out to be the ceiling, not extraction. | Partly superseded |
| [clean-long-run-100-founders](research-clean-long-run-100-founders.md) (2026-09-20) | 100 founders with productivity bounded to `[0.5, 2]` survive 30,000 ticks on 24 of 24 seeds, but the commons sits stripped 82% of ticks. | Current |
| [escape-velocity](research-escape-velocity.md) (2026-09-17) | A level past which a run is very unlikely to die exists and holds, but almost nothing reaches it. | Current |
| [sweep-session-2026-09-14](research-sweep-session-2026-09-14.md) (2026-09-14) | Productivity drift is the main finding; four other constants do nothing. The pin reproduced on a paired test. | Current |
| [untested-variables](research-untested-variables.md) (2026-09-14) | Many settings do nothing until the resource shortage is fixed. Several readings were re-checked with paired tests and two of four scale findings failed. | Partly superseded |

### Outcome labels

| Study | Finding | Status |
|---|---|---|
| [thriving-reachability](research-thriving-reachability.md) (2026-09-14) | THRIVING is reachable only with cheats, and four model facts keep it out of reach by default. | Historical: ARD 063 removed the label |

### Population, fertility and pairing

| Study | Finding | Status |
|---|---|---|
| [crash-diagnosis](research-crash-diagnosis.md) (2026-06-06) | At defaults all 16 seeds go extinct by tick 500; the collapse is demographic, since survivors are too old to rebuild. | Unchecked |
| [pairing-prevalence](research-pairing-prevalence.md) (2026-06-06) | Compares the model's pairing prevalence with empirical targets, as a check on crash recovery. | Unchecked |
| [pairing-calibration](research-pairing-calibration.md) (2026-06-06) | Breakup rate does not change the outcome. The recommended value survives on other grounds. | Partly superseded |
| [fertility-window](research-fertility-window.md) (2026-09-13) | The age-38 fertility cliff was biologically wrong and drove the crash finding. Correcting it (ARD 059) helps modestly. | Resolved by ARD 059 |
| [heritability-anchor](research-heritability-anchor.md) (2026-09-19) | Anchoring heritability to the living population ratchets any trait that grows with age. | Resolved by ARD 066 |
| [fertility](research-fertility.md) | No value of `BASE_CHILDBIRTH_RATE` gives a persistent population; the model lacked density-dependent regulation. | Unchecked |

### Engine and method

| Study | Finding | Status |
|---|---|---|
| [engine-performance](research-engine-performance.md) (2026-09-14) | The tick loop was quadratic because of four full-population scans per person per tick; removing them needed no layout change. Includes a 100,000-founder addendum. | Current |
| [tuning-defaults](research-tuning-defaults.md) (2026-06-05) | Tuning finds no sane defaults. The lesson to judge at long horizons holds; several headline numbers do not. | Partly superseded |
| [zero-variability-tests](research-zero-variability-tests.md) (2026-06-05) | Zeroing each variable in turn to check it does what it claims. Two surprising results did not reproduce. | Partly superseded |
| [zero-variability-followup](research-zero-variability-followup.md) (2026-06-05) | Combinations and sweeps from the above. The "zero jail detection is best" claim did not reproduce. | Partly superseded |

## Real-world anchors

Literature and data gathered to calibrate one event or mechanism. None has a provenance block, so all are **Unchecked**: they say what the real-world numbers are, not what the model does with them. A systematic audit of model constants against these referents has not been done (`docs/calibration-guide.md`).

| Doc | Anchors | ARD |
|---|---|---|
| [childbirth](research-childbirth.md) | Age-specific fertility rates, natural-fertility ceiling, birth spacing | ChildbirthEvent |
| [education](research-education.md) | Enrollment and graduation rates, and the payoff to education | 021, 022, 023 |
| [killing](research-killing.md) | Baseline homicide rates | KillEvent |
| [mortality](research-mortality.md) | Suicide, illness and old-age mortality | 013, 018, 019 |
| [relationships](research-relationships.md) | Partnership formation and dissolution by age | 025 |
| [stat-decay](research-stat-decay.md) | Age-related physical and cognitive decline | 048 |
| [taxation-welfare](research-taxation-welfare.md) | Redistribution parameters, which ARD 034 set without an anchor | 034 |
| [windfall](research-windfall.md) | Annual prevalence and size of unexpected gains | WindfallEvent |
| [character-types](research-character-types.md) | Frameworks behind the person-type typology | 030 |
| [collapse-classification](research-collapse-classification.md) | How collapse is defined in the literature; the verdict it grounded was revised by ARD 063 | 051 |
| [emergent-patterns](research-emergent-patterns.md) | A menu of patterns the tooling does not capture. Nothing in it is built. | none |
