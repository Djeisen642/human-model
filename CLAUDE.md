# human-model

Agent-based simulation for studying civilizational collapse vs. thriving. Each person has stats, behavioral intents, and participates in events once per simulated year. The Gini coefficient of `resources` is the primary collapse signal (inequality matters more than scarcity). **That premise is currently contradicted by measurement and is the project owner's to settle** — `docs/research-inequality-signal.md` found the default config (16/16 runs extinct) and a narrow-band config (0/16 extinct) reaching the same peak inequality (0.600 vs 0.590, p = 0.76 on paired seeds), so Gini does not separate the configurations it is used to judge. The likely reason is that nothing in the model drives inequality independently of the resource economy, making it an output of scarcity rather than a cause of collapse. See `docs/project-background.md` for research inspirations.

**The research goal is abundance, not collapse.** The question this model exists to answer is *what produces thriving, and which levers destroy it*. Collapse is the failure mode to be explained, not the object of study. This matters for how you read a negative result: the model reaches a genuinely non-collapsing state — sustained (`CYCLICAL`) or steady (`STABLE`) — almost never, and that is at least as likely to be a defect in the instrument as a claim about the world. `docs/research-scale-robustness.md` found the model's first such configuration: a population sustaining hundreds of boom-bust cycles without going extinct, once the resource pool scales with the founding population and extraction productivity is pinned. Read that second condition carefully: pinning is not a calibration choice but a switch that disables `InventionEvent`'s effect on extraction, and `docs/research-productivity-band.md` shows it is doing most of the work (with the pool already scaled, pinning takes extinction from 24/24 to 0/24). What the pin stands in for is bounding how far productivity can wander, not fixing an asymmetry — so in that regime survival needs invention's effect on extraction held to roughly ±2× or switched off — a finding about that regime, not a setting to copy, and not tested elsewhere. Pinning has a second consequence nobody intended: it routes *every* invention to the ceiling-growth branch, which compounds until `MAX_NATURAL_RESOURCE_CEILING` stops it at tick 6–8, so carrying capacity in that regime is a constant and its cycles are flat by construction (`docs/research-ceiling-pins-carrying-capacity.md`). **Updated 2026-09-20 (`docs/research-clean-long-run-100-founders.md`): the non-collapsing regime is wider and cheaper than the paragraph above implies, and it holds far longer.** A configuration starting from **100** founders — not 300 — survives **30,000 ticks on 24 of 24 seeds** with a *bounded* productivity band `[0.5, 2]` rather than the pin, over ~125 boom-bust cycles with a flat population trend. So neither the 300-founder scale nor the pin is required; what both were standing in for is deep enough cycle troughs (~221 people against ~60 in the unscaled world). Two consequences for how the rest of this paragraph reads: the "cycles are flat by construction" caveat is about the *pinned* regime specifically and does not apply to a bounded band, and `docs/research-productivity-band.md` already measured bounded as strictly better than pinned. What does not change is the verdict — it is still not thriving, with the pool stripped 82% of ticks and 58% of person-ticks on welfare. It is not thriving by any measure — the pool sits stripped roughly 40% of the time, and it took the outcome taxonomy itself being wrong (`docs/decisions/063-cyclical-outcome-and-thriving-removal.md`) to even see it, since the old THRIVING label required near-peak population *and* a healthy commons at once, which population overshoot makes structurally impossible to hold together. When a run collapses, the useful question is not "which theory does this confirm" but "what would have had to be different for this to keep working, and is the model even capable of representing it." Treat a config that cannot sustain a population without collapsing as a bug to hunt until proven otherwise.

Zero production dependencies — devDependencies only.

## Where things are documented

A project skill, `.claude/skills/sweep-results/`, covers the one process that has gone wrong here most
often: deciding whether a sweep difference is real. It fires when you are about to compare configs or
write up a result. It carries the procedure and the traps only — every definition stays in
`docs/calibration-guide.md`, so the two cannot drift apart.

This file is the handoff: orientation, process, and conventions. The detail lives in four places, and you are expected to open them.

| Need | Read |
|---|---|
| What an event computes — formulas, gates, scheduling order | `docs/odd-protocol.md` (§7 Submodels; §3 for tick order) |
| Why a subsystem works that way, per ARD | `docs/model-reference.md` |
| The full argument for one decision, including what was rejected | `docs/decisions/NNN-*.md` (index in `decisions/README.md`) |
| Running sweeps, which metrics to trust, what tuning can't fix | `docs/calibration-guide.md` |
| Measured results, with provenance | `docs/research-*.md` |
| Candidate mechanisms not yet built | `docs/future-ideas.md` |

The event set is complete — no planned events are unbuilt. New mechanisms go through `docs/future-ideas.md` and an ARD first.

## Git workflow

**Never commit directly to `master`.** All work happens on a branch and merges via squash.

### Branch naming

| Prefix | Use for |
|--------|---------|
| `docs/` | ARDs, future ideas, readme, CLAUDE.md |
| `feature/` | New simulation code (events, classes, mechanics) |
| `fix/` | Bug fixes |
| `research/` | Exploratory or experimental changes |

### Squash merge into master

```bash
git checkout master
git pull origin master
git merge --squash <branch-name>
git commit -m "concise summary of what the branch did"
git push origin master
```

## Commands

```bash
npm install              # install deps (node_modules not committed)
npm test                 # run jest suite (npx jest, config at src/jest.config.js)
npm run build            # rimraf ./build && tsc
npm run lint             # eslint over .ts files
npm run start:dev        # nodemon (watches src/, runs ts-node src/index.ts)
npm run generate-config  # writes config.default.json from Variables.ts (gitignored)
npm run sweep -- [opts]  # run many sims across seeds, print a metrics/outcome table
npm run progress         # what a running sweep/compare is doing; -- --stop ends it, keeping finished rows
```

**Never decide whether two configs differ by eye — use `scripts/compare.ts`.** The sweep table is for
exploring; deciding takes a test. Eyeballing is how several claims in `docs/research-*.md` were
published and later failed to reproduce.

```bash
npx ts-node scripts/compare.ts --seeds 48 --ticks 2000 --b BASE_CHILDBIRTH_RATE=1.0
```

It runs both arms over the same seeds (so each run is compared against its own twin, which cancels
seed luck) and reports each measure as REAL DIFFERENCE / PROBABLY REAL / TOO CLOSE TO CALL, with the
size of the change and a plausible range. When a result is inconclusive it says how many seeds you
would have needed, so a null reads as "too small to tell" rather than "no effect". Details and the
validation record are in `docs/calibration-guide.md`.

```bash
npm run sweep -- --ticks 300 --sweep BASE_CHILDBIRTH_RATE=0.2,0.3,0.4   # sweep one Variables constant
npm run sweep -- --seeds 20 --set MAX_NATURAL_RESOURCE_CEILING=12000 --verbose  # fixed overrides + per-seed detail
```

Sweep options: `--seeds 42,7,1` (or a single `N` → seeds 1..N; default 1..8), `--ticks`, `--persons`, `--set KEY=VAL` (repeatable Variables override), `--sweep KEY=v1,v2,…` (one sweep dimension), `--verbose` (per-seed rows with cause-of-death split), `--status PATH` (move the progress file), `--port N` (also serve live progress over HTTP).

**Read `docs/calibration-guide.md` before sweeping.** It defines every output column, flags which ones are unreliable (`peakGini` is a max-of-noise statistic), and explains why short-horizon results mislead. **Judge configs at 2000 ticks, not 800** — a config whose only benefit is delay reads as a rescue at any horizon shorter than the delay it buys, and 800 ticks has produced that error repeatedly. Prefer the extinction-vs-horizon curve to any single-horizon count: a genuinely different config flattens, a delaying one keeps climbing. **2000 is a floor, not a pass mark** (2026-09-20, `docs/research-clean-long-run-100-founders.md`): the same error recurred a third time at 3,000 ticks, where a 100-founder config read 0/24 extinct and lost 7 of 24 by 30,000, its first death at tick 7,660 and two more after 21,000. In an oscillating regime extinction is a per-trough dice roll, so an extinction count measures the horizon as much as the config — **prefer trough depth** (`scripts/trough-probe.ts`), which separated those same two arms immediately and for a fiftieth of the compute.

### Parity harness (`scripts/parity-check.ts`)

Proves an engine change is behaviour-preserving. `--emit FILE` runs a seed set and writes the full per-tick snapshot history; `--verify FILE` re-runs the same configuration (seeds/ticks/persons are stored in the file, so the two runs can't disagree) and reports the first divergence as `seed, tick, field, baseline, got`. Emit a baseline on the unmodified revision, apply the change, verify.

```bash
npx ts-node scripts/parity-check.ts --emit /tmp/baseline.json --seeds 8 --ticks 200
npx ts-node scripts/parity-check.ts --verify /tmp/baseline.json
```

Use it for refactors and optimisations, where the bar is a bitwise-identical history. Calibration changes are *expected* to diverge — this tool does not apply to them. It is also the contract check the multi-tier engine work in `docs/future-ideas.md` needs.

### CLI flags (entry point)

```bash
npx ts-node src/App/index.ts [--config path/to/config.json] [--output path/to/dir]
```

- `--config` — JSON file that deep-merges over defaults; only changed keys needed. Run `npm run generate-config` to get a full reference file (`config.default.json`) with all available keys (`simulation.persons/ticks/seed/personTypes` + every `Variables` constant). That file is gitignored — it's generated, not maintained. `simulation.personTypes` (ARD 030) maps a name to `{ percentage, ranges }`; percentages must sum to ≤ 1.0, ranges are partial per-field overrides.
- `--output` — directory to write HTML reports into (default: `./output`). Created if absent. Kept separate from `--config` so batch/concurrent tooling can vary the output dir without touching the variable config.

## Architecture

```
src/
  App/
    Person.ts              # Core data class — mutable stats/intents, readonly collections
    Simulation.ts          # Owns population (living + deceased), tick history, aggregate metrics
    LooperSingleton.ts     # Drives the tick loop (singleton); delegates population to Simulation
    index.ts               # Entry point — runs start() with defaults (100 persons, 100 ticks, seed 42)
  Events/                  # One file per event + IEvent interface + EventFactory
                           # Mechanisms and tick order: docs/odd-protocol.md §3 and §7
  Records/                 # DeathRecord, KillingRecord, StealingRecord — plain data, no behavior
  Helpers/
    Constants.ts           # CAUSE_OF_DEATH, EDUCATION enums
    Variables.ts           # Every tunable constant: age curves, per-event age profiles, thresholds
                           # validate() enforces cross-constant invariants; every override path calls it
    SeededRandom.ts        # LCG seeded RNG; asRNG() returns an RNG-typed function
    AgeModifier.ts         # ageModifier(age, peakAge, scale, floor) — bell curve helper
    Inequality.ts          # Pure: gini(values), resourceGini(persons) — adult-only signal (ARD 060)
    Statistics.ts          # Pure: paired significance tests + power sizing for sweep comparisons
    HarnessOverrides.ts    # applyOverrides/parseSeeds for scripts/ — harness support, not model
                           # code; lives here so it can be unit-tested (see future-ideas.md)
    RunProgress.ts         # Pure: live-progress snapshots for long scripts/ runs — eta, formatting,
                           # atomic status-file write, process liveness. Same harness-support
                           # rationale as HarnessOverrides.ts
    Types.ts               # RNG, TenYearSummary, PersonTypeDefinition/PersonTypes, INTEGER_FIELDS
    Classifier.ts          # Pure: classifyPerson, countPerType, parsePersonTypes (ARD 030)
    CycleDetector.ts       # Pure: detectCycles — boom-bust oscillation detection over a population
                           # series; sweep-harness measurement tooling, not an outcome label.
                           # `troughValues` exposes every trough's depth, which predicts extinction
                           # in a cycling regime (scripts/trough-probe.ts reports it)
    GrowthDetector.ts      # Pure: detectGrowth — exponential-growth / runaway detection over any
                           # series; sweep-harness measurement tooling, not an outcome label
    Reporters.ts           # Pure: buildTenYearSummary, format*, classifyOutcome, explainOutcome
    ReportWriter.ts        # writeReportHTML — self-contained HTML report with Chart.js to output/
    report-template.hbs    # Handlebars template ReportWriter renders; the report's markup/charts
    TraitRanges.ts         # Founder seeding ranges for heritable fields — one source of truth,
                           # read by Simulation.seed and by ChildbirthEvent's small-population
                           # fallback (ARD 064)
  tests/                   # Mirrors src/ structure; one test file per source file
```

Class-level API surface (Simulation methods, `TickSnapshot` fields, what each report section renders) is in `docs/model-reference.md`.

## ARD requirement

**Any implementation that encodes a non-obvious design choice requires an ARD before the code is written.** This includes: new stats or computed properties, event mechanics (probabilities, magnitudes, outcomes), changes to how existing fields are used, and any parameter whose value could reasonably be different.

The test: if a future agent would have to guess *why* you made a choice, write an ARD first. If the choice is forced by the existing architecture with no real alternative, a comment in code may suffice.

**Discuss the decision with the project owner before writing the ARD.** The ARD records what was agreed — it is not a draft for review. After discussion: write the ARD, add it to the index as Proposed, get explicit sign-off, then move it to Accepted. Do not begin implementation until Accepted.

**Before writing the ARD body, read `docs/decisions/README.md`.** It is the canonical guide for ARD scope, structure, quality bar, and the after-writing checklist. Skipping it produces ARDs that are syntactically correct but thin on judgment — usually missing the rejected alternatives or the calibration intent that make an ARD useful to the next reader.

After an ARD is Accepted: reference it in the relevant `docs/model-reference.md` subsystem bullet, and include it in the same commit or PR as the implementation it covers.

## Discovering new mechanisms

While implementing, you will sometimes encounter a behavior or interaction that isn't planned but could meaningfully affect the collapse/thrive dynamics. **Do not implement it speculatively.** Instead, add it to `docs/future-ideas.md` with a brief note on why it matters and what problem it solves. It will be reviewed and, if worthwhile, discussed and formalized as an ARD before being built.

When a candidate in `docs/future-ideas.md` is rejected without rising to ARD-level discussion (e.g., subsumed by another idea, insufficient collapse/thrive signal, redundant with an existing mechanism), move it to the `## Discarded` section at the bottom of that file with a one-sentence reason and the date. Decisions formal enough to merit an ARD belong in `docs/decisions/` instead — the Discarded section is for the lighter-weight rejections.

## Design pattern philosophy

Only use a pattern when it has a concrete job to do. Remove it when it stops earning its place. See `docs/project-background.md` for the full philosophy.

Patterns currently in use and why:
- **Singleton** (`LooperSingleton`) — one simulation loop should exist; enforced at the type level
- **Factory** (`EventFactory`) — intent-to-event mapping needs a single home; the factory earns its place because of the intent system
- **Interface + class hierarchy** (`IEvent`) — pairs naturally with the factory; gives each event a consistent, testable shape

See `docs/decisions/` for the reasoning behind each architectural choice.

## Age profiles for new events

Every event wired into `EventFactory` must declare an age profile. When adding a new event:

1. Decide its **peak age** (when this activity is most likely), **scale** (how steeply it falls off — smaller = steeper), and **floor** (minimum modifier; never zero, but can be very small).
2. Add three constants to `Variables.ts` following the naming pattern: `<EVENT>_PEAK_AGE`, `<EVENT>_AGE_SCALE`, `<EVENT>_AGE_FLOOR`.
3. In `EventFactory`, wrap the intent/base-rate check with `ageModifier(person.age, <EVENT>_PEAK_AGE, <EVENT>_AGE_SCALE, <EVENT>_AGE_FLOOR)`.

Reference profiles (from ARD 008):

| Event | Peak | Scale | Floor |
|---|---|---|---|
| Childbirth | 26 | 18 | 0.02 |
| Work | 35 | 40 | 0.1 |
| Exercise | 24 | 35 | 0.1 |
| Learning | 18 | 45 | 0.15 |
| Stealing | 24 | 30 | 0.05 |
| Killing | 24 | 30 | 0.05 |
| Relationships | 26 | 35 | 0.1 |
| Invention | 40 | 45 | 0.1 |
| Help | 40 | 40 | 0.1 |
| Graduation | 22 | 30 | 0.15 |

## Keeping the handoff docs current

At the end of every session — whether it changed code or only docs/ARDs — verify the handoff docs reflect actual state. If they're stale, the next agent starts blind.

CLAUDE.md carries no per-event or per-class detail by design, so most code changes update a doc under `docs/` and leave this file alone. Read source to verify — don't rely on memory.

| What changed | Update |
|---|---|
| Event mechanism, agent fields, scheduling order, initialization | `docs/odd-protocol.md` (§2, §3, §5, §7 as applicable) |
| A design decision, or a class's API surface | `docs/model-reference.md` |
| A new ARD | `docs/decisions/README.md` index, plus the relevant `model-reference.md` bullet — see the ARD requirement section |
| Sweep columns, harness flags, calibration findings | `docs/calibration-guide.md` |
| Directory layout, commands, process, conventions | this file |

Calibration-only changes (tweaking constants in `Variables.ts`) need no ODD update.

Before closing: does each section match reality? Is the Architecture tree accurate? Do the pointers in "Where things are documented" still resolve?

Also before closing, do a brief integrity scan of the code changed this session:

- Is there a scenario where the new code breaks — an edge case, an empty collection, a stat at zero or max, two events running in the same tick that interact badly?
- Is there something the new code *almost* does but stops short of, where the missing piece would meaningfully affect collapse/thrive dynamics?

If the scan finds a real bug: fix it before closing.
If it finds a plausible new direction that isn't in the current plan: add it to `docs/future-ideas.md` with a one-sentence note on why it matters. Don't implement it.

## Coding conventions

- Strict TypeScript (`tsconfig.json` has `"strict": true`)
- JSDoc required on all public members (enforced by `eslint-plugin-jsdoc`)
- Single quotes, semicolons, 2-space indent (ESLint)
- Test files mirror source path: `src/tests/App/Person.test.ts` ↔ `src/App/Person.ts`

## Communication conventions

For things a human reads once — chat replies, result summaries, commit messages, PR descriptions. (Docs an agent re-reads have their own rules below.)

**Lead with the answer.** First sentence says what happened. Method, caveats, and context come after. If the result is "this didn't work," that goes in line one, not paragraph four.

**Gloss the jargon or drop it.** Statistical and model terms need plain English on first use. Metric names (`stable`, `bound%`, `cyc`, `orphPk%`) belong in tables; in prose, say what they measure.

> ✗ "`stable` 3/32 → 2/32, inside binomial noise."
> ✓ "Sustained cycles went from 3 seeds out of 32 to 2 — too small a difference to mean anything."

> ✗ "The bounds are log-asymmetric, so the reflected walk's stationary median is 0.35×."
> ✓ "The productivity band `[0.01, 10]` has far more room below 1.0 than above, so a long run drifts down to about a third of its starting output."

**Give every number a direction.** "0.081 vs 0.091 deaths per birth" is not a result until you say which is better and whether the gap matters.

**Plain words.** No "the point that falls out is," "tempering the urgency," "which is itself informative," "ended with three Accepted ARDs." Say the thing.

**One hedge per claim.** A result needing three qualifications isn't a result — call it unmeasured and move on.

**Size the PR description to the reviewer, not the research.** Target under 400 words: what changed, why, how it was verified, what's still open. The evidence, the failed hypotheses, and the full tables go in `docs/research-*.md` and get linked. If the description runs long, the research doc isn't carrying its weight.

Before sending: could someone who didn't run this work say what happened after reading the first two sentences? If not, rewrite them.

## Documentation conventions

Be concise but clear in every doc — `CLAUDE.md`, ARDs, `future-ideas.md`, `decisions/README.md`. The clarity rules above apply here too; these add what docs need on top. These files load into agent context; bloat is a real cost. Cut hedging, restated points, and elaborations the next reader can infer. One sentence beats three when it carries the same information. Keep the why; trim the throat-clearing.

**Research docs (`docs/research-*.md`)** must open with a provenance block so results stay interpretable after Variables are recalibrated:

```
**Recorded:** YYYY-MM-DD | **Commit:** <short hash> | **Latest ARD:** NNN | **Base config:** all Variables at defaults unless noted
**Commands:** npm run sweep -- ...
**Key context vars:** LIST=VAL, ... (the 3–5 Variables most likely to shift the results if recalibrated)
```

The commit hash lets a reader run `git show <hash>:src/Helpers/Variables.ts` to see the exact config. List only the variables with meaningful leverage on the reported outcomes — not the full constant dump.

**Latest ARD** is the highest-numbered Accepted ARD when the study ran. Record it because `Key context vars` cannot be trusted alone: a 2026-09-13 re-verification found all six then-existing provenance blocks listing *unchanged* variables while the results had drifted anyway — what moved was the seeding and relationship structure of ARD 052–058, which no study had thought to list. Enumerating variables will always miss the structural change nobody anticipated; one ARD number tells the next reader exactly what landed since.

**When a result doesn't reproduce, annotate — don't delete.** Add a dated note (`> **Re-verified YYYY-MM-DD (commit <hash>) — …**`) next to the original claim saying what was re-measured and what it showed, and flag the summary row and any follow-up item the claim feeds. The original stays: a study that was later contradicted is part of the record, and knowing a result was *checked and failed* is more useful than finding it quietly gone. See `research-zero-variability-tests.md` and `research-pairing-calibration.md` for worked examples.
