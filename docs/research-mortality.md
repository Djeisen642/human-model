# Research: Mortality Model (Suicide, Illness, and the Missing Natural-Death Path)

Gathered to assess whether the death mechanics encoded in ARD 013 → ARD 019 (suicide),
ARD 018 (illness as live state), and the `CAUSE_OF_DEATH` enum are calibrated to anything
real. The suicide formula's own ARD (019) flags its constant as "a guess" and asks a future
agent to "observe." This doc is that observation, plus the empirical anchors that were never
collected.

Sources: WHO suicide fact sheet & PAHO ("one in 100 deaths"), IHME/GBD 2021, Our World in
Data (suicide), WHO Top-10 causes of death 2021, SSA period life table, meta-analyses of
suicide risk in major-depression inpatients.

## The problem, measured in-sim

Running the default config (100 persons, 100 ticks) and several other seeds, the death stream
is overwhelmingly suicide:

| Seed | illness | suicide | killing | disaster | suicide share |
|---|---|---|---|---|---|
| 42 | 2 | 70 | 8 | 0 | **87%** |
| 1 | 5 | 60 | 10 | 1 | 79% |
| 7 | 8 | 208 | 43 | 2 | 79% |
| 99 | 4 | 183 | 34 | 3 | 82% |

Suicide is consistently **~80–90% of all deaths**, and population decline in the back half of
every run is driven almost entirely by it (see the seed-42 decade table: deaths flip to
`sui:11`, `sui:11`, `sui:10` once happiness drifts down). Illness mortality is a rounding error
and there is **no old-age / natural death at all** — the `CAUSE_OF_DEATH` enum
(`src/Helpers/Constants.ts`) has only `MURDER`, `ILLNESS`, `DISASTER`, `SUICIDE`.

This matters for the project's purpose: the collapse/thrive signal is supposed to emerge from
inequality and resource dynamics (HANDY: overexploitation + inequality). Instead, the dominant
demographic force is a single miscalibrated suicide rate, so the population trajectory reflects
the happiness→suicide curve far more than it reflects Gini or the commons.

## Real-world anchor: suicide is ~1% of deaths, not ~85%

- **Global suicide rate: ~9 per 100,000 per year ≈ 0.009%/yr** (WHO/IHME, 2021; down ~40% from
  ~15/100k in the 1990s).
- **Suicide is ~1.1% of all deaths worldwide** — "one in 100 deaths is by suicide" (PAHO/WHO).
- Highest national rates (e.g. Lesotho, Eswatini) reach ~70–90 per 100,000/yr ≈ 0.07–0.09%/yr.
- Highest-risk *clinical* subgroups — recently-discharged major-depression inpatients,
  especially with prior attempts or NSSI — run on the order of **0.2–1%/yr** in meta-analyses
  (MDD inpatients carry ~20× the general-population risk; ~10% of MDD patients ever *attempt*).

### What the model encodes

`suicideProb = SUICIDE_PROBABILITY_SCALE / (happiness + 1)` with `SUICIDE_PROBABILITY_SCALE = 0.03`:

| happiness | model p/yr | vs global avg (0.009%) | vs highest-risk clinical (~0.5–1%/yr) |
|---|---|---|---|
| 0 | **3.0%** | ~330× | ~3–6× |
| 1 | 1.5% | ~165× | ~2–3× |
| 3 | 0.75% | ~80× | ~1× |
| 5 | 0.5% | ~55× | ~0.5–1× |
| 10 | 0.27% | ~30× | below |

The **happiest possible person (0.27%/yr) already exceeds the global average by ~30×**, and the
floor of the model's range sits at the *ceiling* of the most extreme real-world subpopulation.
Average happiness in a healthy run is ~6–8, giving ~0.4–0.5%/yr — i.e. the whole population is
modeled as suicidal at roughly the rate of recently-hospitalized depression patients. That is
why suicide swamps the death stream.

## Real-world anchor: where deaths actually come from

WHO 2021 top-10 causes (≈57% of 68M deaths):
- Ischaemic heart disease ~13%, cancers ~15%, cardiovascular + cancer together ~28%.
- 7 of the top 10 are noncommunicable disease (~38% of all deaths).
- The unifying driver is **age** — `q(x)`, the annual probability of death, rises roughly
  exponentially (Gompertz). Approximate US SSA period-life-table values:

| age | annual death probability q(x) |
|---|---|
| 30 | ~0.1–0.2% |
| 50 | ~0.4–0.5% |
| 65 | ~1.2–1.5% |
| 80 | ~5–6% |
| 90 | ~15–18% |
| 100 | ~35% |

The model has the curve shape available (`ageMortalityModifier`, U-shaped, ARD 008) but
**routes it only through illness severity**, and the illness equilibrium is near zero (below),
so the age curve almost never fires. There is no senescence path: a 95-year-old in the model
does not die of being 95; they die of suicide when their happiness drifts down (`age > 65: −1`)
or, rarely, of an illness that briefly spikes.

## Why illness mortality is a rounding error

`IllnessEvent` (ARD 018) rolls onset and recovery independently each tick:

```
onset    = BASE_ILLNESS_ONSET (0.05) * ageRisk / constitution
recovery = BASE_ILLNESS_RECOVERY (0.40) * constitution / ageRisk
ageRisk  = 1 + age / 30
```

Recovery dominates onset by ~8–17× across the whole age/constitution range:

| age | constitution | onset | recovery | ratio |
|---|---|---|---|---|
| 40 | 5 | 0.023 | 0.86 | 37× |
| 70 | 5 | 0.038 | 0.57 | 15× |
| 90 | 5 | 0.040 | 0.50 | 12× |
| 90 | 2 | 0.100 | 0.20 | 2× |

So `illness` sits near 0 for almost everyone, and `illnessDeathProb = illness *
ILLNESS_DEATH_SCALAR (0.08) * ageMortalityModifier` is tiny. Even a frail 90-year-old
(constitution 2) only reaches illness equilibrium ≈ onset/(onset+recovery) ≈ 0.33, giving a
death prob ≈ 0.33 × 0.08 × ageMortalityModifier — still small relative to their suicide prob.
Illness as currently tuned cannot carry old-age mortality.

## Recommendations

These are calibration/structure recommendations, not a spec — each non-obvious choice needs its
own ARD (suicide recalibration supersedes the suicide branch lineage; a natural-death path is a
new mechanic and enum value).

1. **Add a baseline age-driven natural-death path (highest value).** Introduce
   `CAUSE_OF_DEATH.NATURAL` (or `OLD_AGE`) and a Gompertz-style baseline:
   `naturalDeathProb = BASE_NATURAL_MORTALITY * person.ageMortalityModifier`, calibrated so that
   q(x) at ages 65/80/90 lands near the SSA values above. This gives the elderly a realistic
   exit that is *not* suicide and lets the age curve (ARD 008) finally do its job. Without it,
   any reduction in suicide just makes the population immortal.

2. **Recalibrate `SUICIDE_PROBABILITY_SCALE` down by ~1–2 orders of magnitude.** Target: at
   *typical* happiness (~6) the rate should be in the ~0.01–0.05%/yr band (a few × the global
   average, since the sim population skews stressed), and even at happiness 0 it should not
   exceed ~0.5–1%/yr (the highest-risk clinical ceiling). A scale near `0.0003–0.001` (vs the
   current `0.03`) reaches that range. Consider a happiness *threshold* (suicide risk only rises
   meaningfully below some happiness floor) rather than the current `1/(h+1)` curve, which
   assigns nontrivial risk to everyone.

3. **Re-tune illness so it can carry disease mortality once suicide stops masking it.** Either
   raise `BASE_ILLNESS_ONSET` / lower `BASE_ILLNESS_RECOVERY`, or make recovery age-decaying, so
   that chronic illness actually accumulates in the old. Target: with suicide reduced, illness +
   natural death together should reproduce a plausible cause-of-death split (disease the plurality,
   suicide ~1–2%, homicide a small share, disaster episodic).

4. **Validation target.** After recalibration, a healthy ("STABLE"/"THRIVING") run should show a
   cause-of-death mix in the rough ballpark of: natural/illness ≫ suicide, suicide ~1–3% of
   deaths, homicide a few %, with population dynamics now responding to Gini and pool health
   rather than to the happiness→suicide curve. Re-run the seed sweep above and confirm suicide
   share drops from ~80% to single digits.

## Suggested constants for the ARDs

| Constant | Current | Suggested direction | Rationale |
|---|---|---|---|
| `SUICIDE_PROBABILITY_SCALE` | 0.03 | ~0.0003–0.001 | Bring happiness≈6 rate to ~0.01–0.05%/yr; cap happiness=0 at ≤~1%/yr |
| `BASE_NATURAL_MORTALITY` | — (new) | tune to SSA q(x) | Gives a non-suicide old-age exit; lets `ageMortalityModifier` drive deaths |
| `BASE_ILLNESS_ONSET` | 0.05 | raise, or age-scale recovery | Let chronic illness accumulate in the old once suicide no longer masks it |
| `BASE_ILLNESS_RECOVERY` | 0.40 | lower / age-decay | Same; current 8–17× dominance over onset keeps illness near zero |
| `ILLNESS_DEATH_SCALAR` | 0.08 | re-tune after onset/recovery | Severity→death conversion, meaningful only once illness can accumulate |
