# human-model

Agent-based simulation for studying civilizational collapse vs. thriving. Each person has stats, behavioral intents, and participates in events once per simulated year. Zero production dependencies — devDependencies only. See `docs/project-background.md` for research inspirations.

## Research state

**The goal is abundance, not collapse.** The model exists to answer *what produces thriving, and which levers destroy it*; collapse is the failure mode to be explained. The model almost never reaches a non-collapsing state, and that is at least as likely to be a defect in the instrument as a claim about the world. When a run collapses, ask "what would have had to be different for this to keep working, and can the model even represent it?" Treat a config that cannot sustain a population as a bug to hunt until proven otherwise.

This section is a pointer, not a changelog: each claim links to the study that measured it. When a finding changes, rewrite the claim here; don't append a dated note.

- **Inequality (Gini of `resources`).** The original premise, that inequality matters more than scarcity, was contradicted: the default config (16/16 runs extinct) and a narrow-band config (0/16) reached the same peak Gini, 0.600 vs 0.590 (`docs/research-inequality-signal.md`). Nothing in the model drove inequality independently of the resource economy. ARD 068 added wealth-scaled access to the commons, and with it inequality does matter: cycle troughs come out 18% shallower to 33% deeper, flat at low doses and decisive at a gradient of 0.75 (`docs/research-access-gradient.md`). The mechanism is off by default (gradient 0 is bitwise identical to the pre-068 model), so earlier results stand. Unsettled: whether the Gini *as computed* tracks it; nobody has measured it alongside trough depth.
- **Non-collapsing regimes.** The first needed a resource pool scaled to the founding population and extraction productivity *pinned*, which switches off `InventionEvent`'s effect on extraction and does most of the work (`docs/research-scale-robustness.md`, `docs/research-productivity-band.md`). Pinning also routes every invention to ceiling growth, so carrying capacity is constant and cycles are flat by construction (`docs/research-ceiling-pins-carrying-capacity.md`). A second regime, 100 founders with productivity *bounded* to `[0.5, 2]`, survived 30,000 ticks on 24 of 24 seeds (`docs/research-clean-long-run-100-founders.md`), so neither 300 founders nor the pin is required; both stand in for deeper cycle troughs (~221 people vs ~60). Flat-by-construction does not apply to a bounded band.
- **Neither regime is thriving.** The pool sits stripped about 40% of ticks when pinned and 82% when bounded, with 58% of person-ticks on welfare in the bounded case. These are findings about those regimes, not settings to copy. The old THRIVING label was unreachable by construction and was removed (ARD 063); sustained cycling is `CYCLICAL`, steady is `STABLE`.

## Where things are documented

The project skill `.claude/skills/sweep-results/` covers the process that has gone wrong most often: deciding whether a sweep difference is real. It fires when you compare configs or write up a result, and carries only the procedure and traps; every definition stays in `docs/calibration-guide.md`.

This file is the handoff: orientation, process, conventions. `docs/README.md` maps questions to docs; the detail lives here:

| Need | Read |
|---|---|
| What an event computes — formulas, gates, scheduling order | `docs/odd-protocol.md` (§7 Submodels; §3 for tick order) |
| Why a subsystem works that way, per ARD | `docs/model-reference.md` |
| The full argument for one decision, including what was rejected | `docs/decisions/NNN-*.md` (index in `decisions/README.md`) |
| Running sweeps, which metrics to trust, what tuning can't fix | `docs/calibration-guide.md` |
| What was measured, and whether it still stands | `docs/studies.md` (every `research-*.md` with its finding and status) |
| Candidate mechanisms not yet built | `docs/future-ideas.md` |

The event set is complete — no planned events are unbuilt. New mechanisms go through `docs/future-ideas.md` and an ARD first.

## Git workflow

**Never commit directly to `master`.** All work happens on a branch and merges via squash. Branch prefixes: `docs/` (ARDs, future ideas, readme, CLAUDE.md), `feature/` (new simulation code), `fix/`, `research/` (exploratory changes).

```bash
git checkout master
git pull origin master
git merge --squash <branch-name>
git commit -m "concise summary of what the branch did"
git push origin master
```

Husky runs `npm run lint` and `npm test` before every commit, and refuses a push unless the branch contains `origin/master` (rebase first). CI runs the same lint and tests.

## Commands

```bash
npm install              # install deps (node_modules not committed)
npm test                 # jest suite (config at src/jest.config.js)
npm run build            # rimraf ./build && tsgo
npm run lint             # eslint over src/
npm start                # ts-node src/App/index.ts (flags below)
npm run generate-config  # writes config.default.json from Variables.ts (gitignored)
npm run sweep -- [opts]  # run many sims across seeds, print a metrics/outcome table
npm run progress         # what a running sweep/compare is doing; -- --stop ends it, keeping finished rows
```

**Never decide whether two configs differ by eye — use `scripts/compare.ts`.** The sweep table is for exploring; eyeballing is how several claims in `docs/research-*.md` were published and later failed to reproduce.

```bash
npx ts-node scripts/compare.ts --seeds 48 --ticks 2000 --b BASE_CHILDBIRTH_RATE=1.0
```

It runs both arms over the same seeds, so each run is compared against its own twin, and labels each measure REAL DIFFERENCE / PROBABLY REAL / TOO CLOSE TO CALL with the size of the change and a plausible range. An inconclusive result says how many seeds you would have needed, so a null reads as "too small to tell". Validation record: `docs/calibration-guide.md`.

```bash
npm run sweep -- --ticks 300 --sweep BASE_CHILDBIRTH_RATE=0.2,0.3,0.4   # sweep one Variables constant
npm run sweep -- --seeds 20 --set MAX_NATURAL_RESOURCE_CEILING=12000 --verbose  # fixed overrides + per-seed detail
```

Sweep options: `--seeds 42,7,1` (or a single `N` → seeds 1..N; default 1..8), `--ticks`, `--persons`, `--set KEY=VAL` (repeatable Variables override), `--sweep KEY=v1,v2,…` (one sweep dimension), `--verbose` (per-seed rows with cause-of-death split), `--status PATH` (move the progress file), `--port N` (also serve live progress over HTTP).

**Read `docs/calibration-guide.md` before sweeping.** It defines every output column and flags the unreliable ones (`peakGini` is a max-of-noise statistic). **Judge configs at 2000 ticks or more, not 800.** A config whose only benefit is delay reads as a rescue at any shorter horizon, and this error has recurred three times, most recently at 3,000 ticks, where a 100-founder config read 0/24 extinct and lost 7 of 24 by 30,000 (`docs/research-clean-long-run-100-founders.md`). In an oscillating regime extinction is a per-trough dice roll, so a count measures the horizon as much as the config. Prefer the extinction-vs-horizon curve to any single-horizon count (a different config flattens, a delaying one keeps climbing), and prefer trough depth (`scripts/trough-probe.ts`), which separated those same two arms immediately for a fiftieth of the compute.

### Parity harness (`scripts/parity-check.ts`)

Proves an engine change is behaviour-preserving: the bar is a bitwise-identical history, so use it for refactors and optimisations. Calibration changes are *expected* to diverge. It is also the contract check the multi-tier engine work in `docs/future-ideas.md` needs. `--emit FILE` writes the per-tick snapshot history for a seed set; `--verify FILE` re-runs the stored configuration and reports the first divergence as `seed, tick, field, baseline, got`. Emit a baseline on the unmodified revision, apply the change, verify.

```bash
npx ts-node scripts/parity-check.ts --emit /tmp/baseline.json --seeds 8 --ticks 200
npx ts-node scripts/parity-check.ts --verify /tmp/baseline.json
```

### CLI flags (entry point)

```bash
npx ts-node src/App/index.ts [--config path/to/config.json] [--output path/to/dir] [--no-report] [--embed]
```

- `--config` — JSON file over the defaults; only changed keys needed. `npm run generate-config` writes a full reference file (`config.default.json`: `simulation.persons/ticks/seed/personTypes` + every `Variables` constant). `simulation.personTypes` (ARD 030) maps a name to `{ percentage, ranges }`; percentages must sum to ≤ 1.0, ranges are partial per-field overrides.
- `--output` — directory for HTML reports (default `./output`, created if absent). Separate from `--config` so batch tooling can vary it without touching the variable config.
- `--no-report` skips the HTML report; `--embed` inlines the CDN assets in it.

Defaults with no config: 100 persons, 100 ticks, seed 42.

## Architecture

```
src/
  App/
    Person.ts              # Core data class — mutable stats/intents, readonly collections
    Simulation.ts          # Owns population (living + deceased), tick history, aggregate metrics
    LooperSingleton.ts     # Drives the tick loop (singleton); delegates population to Simulation
    index.ts               # Entry point
  Events/                  # One file per event + IEvent interface + EventFactory
                           # Mechanisms and tick order: docs/odd-protocol.md §3 and §7
  Records/                 # DeathRecord, KillingRecord, StealingRecord — plain data, no behavior
  Helpers/
    Constants.ts           # CAUSE_OF_DEATH, EDUCATION enums
    Variables.ts           # Every tunable constant; validate() enforces cross-constant invariants
                           # and every override path calls it
    SeededRandom.ts        # LCG seeded RNG; asRNG() returns an RNG-typed function
    AgeModifier.ts         # ageModifier(age, peakAge, scale, floor) — bell curve helper
    Inequality.ts          # Pure: gini(values), resourceGini(persons) — adult-only signal (ARD 060)
    Statistics.ts          # Pure: paired significance tests + power sizing for sweep comparisons
    HarnessOverrides.ts    # applyOverrides/parseSeeds for scripts/ — harness support, not model code
    RunProgress.ts         # Pure: live-progress snapshots, atomic status-file write — harness support
    Types.ts               # RNG, TenYearSummary, PersonTypeDefinition/PersonTypes, INTEGER_FIELDS
    Classifier.ts          # Pure: classifyPerson, countPerType, parsePersonTypes (ARD 030)
    CycleDetector.ts       # Pure: detectCycles — boom-bust detection over a population series;
                           # measurement tooling, not an outcome label. `troughValues` exposes
                           # every trough's depth (scripts/trough-probe.ts reports it)
    GrowthDetector.ts      # Pure: detectGrowth — runaway detection over any series; measurement tooling
    Reporters.ts           # Pure: buildTenYearSummary, format*, classifyOutcome, explainOutcome
    ReportWriter.ts        # writeReportHTML — self-contained HTML report with Chart.js to output/
    report-template.hbs    # Handlebars template ReportWriter renders
    TraitRanges.ts         # Founder seeding ranges for heritable fields — one source of truth,
                           # read by Simulation.seed and ChildbirthEvent's fallback (ARD 064)
  tests/                   # Mirrors src/ structure; one test file per source file
```

Class-level API surface (Simulation methods, `TickSnapshot` fields, what each report section renders) is in `docs/model-reference.md`.

## ARD requirement

**Any implementation that encodes a non-obvious design choice requires an ARD before the code is written.** This includes new stats or computed properties, event mechanics (probabilities, magnitudes, outcomes), changes to how existing fields are used, and any parameter whose value could reasonably be different. The test: if a future agent would have to guess *why* you made a choice, write an ARD first. If the architecture forces the choice with no real alternative, a code comment may suffice.

**Discuss the decision with the project owner before writing the ARD.** The ARD records what was agreed; it is not a draft for review. After discussion: write the ARD, add it to the index as Proposed, get explicit sign-off, then move it to Accepted. Do not begin implementation until Accepted.

**Before writing the ARD body, read `docs/decisions/README.md`.** It is the canonical guide for scope, structure, quality bar, and the after-writing checklist. Skipping it produces ARDs that are syntactically correct but thin on judgment, usually missing the rejected alternatives or the calibration intent.

After an ARD is Accepted: reference it in the relevant `docs/model-reference.md` subsystem bullet, and include it in the same commit or PR as the implementation.

## Discovering new mechanisms

If you find a behavior or interaction that isn't planned but could meaningfully affect collapse/thrive dynamics, **do not implement it speculatively.** Add it to `docs/future-ideas.md` with a note on why it matters and what problem it solves; it is reviewed and, if worthwhile, formalized as an ARD first.

A candidate rejected without ARD-level discussion (subsumed, insufficient signal, redundant) moves to the `## Discarded` section at the bottom of that file with a one-sentence reason and the date. Decisions formal enough to merit an ARD belong in `docs/decisions/` instead.

## Design patterns

Only use a pattern when it has a concrete job to do; remove it when it stops earning its place (full philosophy: `docs/project-background.md`). In use now: **Singleton** (`LooperSingleton`, one loop, enforced at the type level), **Factory** (`EventFactory`, the intent-to-event mapping needs one home), **Interface + class hierarchy** (`IEvent`, a consistent testable shape for each event). Reasoning is in `docs/decisions/`.

## Age profiles for new events

Every event wired into `EventFactory` must declare an age profile:

1. Decide its **peak age**, **scale** (how steeply it falls off; smaller = steeper), and **floor** (minimum modifier; never zero, but can be very small).
2. Add `<EVENT>_PEAK_AGE`, `<EVENT>_AGE_SCALE`, `<EVENT>_AGE_FLOOR` to `Variables.ts`.
3. In `EventFactory`, wrap the intent/base-rate check with `ageModifier(person.age, <EVENT>_PEAK_AGE, <EVENT>_AGE_SCALE, <EVENT>_AGE_FLOOR)`.

Reference values are the existing profiles in `Variables.ts` (e.g. Childbirth 26 / 18 / 0.02) and ARD 008.

## Keeping the handoff docs current

At the end of every session, whether it changed code or only docs/ARDs, verify the handoff docs reflect actual state; if they're stale, the next agent starts blind. This file carries no per-event or per-class detail by design, so most code changes update a doc under `docs/` and leave it alone. Read source to verify; don't rely on memory.

| What changed | Update |
|---|---|
| Event mechanism, agent fields, scheduling order, initialization | `docs/odd-protocol.md` (§2, §3, §5, §7 as applicable) |
| A design decision, or a class's API surface | `docs/model-reference.md` |
| A new ARD | `docs/decisions/README.md` index, plus the relevant `model-reference.md` bullet |
| Sweep columns, harness flags, calibration findings | `docs/calibration-guide.md` |
| Directory layout, commands, process, conventions | this file |

Calibration-only changes (tweaking constants in `Variables.ts`) need no ODD update. Before closing: does each section match reality, is the Architecture tree accurate, and do the pointers in "Where things are documented" still resolve?

Also do a brief integrity scan of the code changed this session:

- Is there a scenario where the new code breaks — an edge case, an empty collection, a stat at zero or max, two events in the same tick that interact badly?
- Is there something the new code *almost* does but stops short of, where the missing piece would meaningfully affect collapse/thrive dynamics?

A real bug gets fixed before closing. A plausible new direction not in the current plan goes in `docs/future-ideas.md` with a one-sentence note on why it matters; don't implement it.

## Keeping the docs in order

The docs stay findable only if someone maintains the indexes. These rules apply to every session that touches `docs/`.

- **One home per fact.** State a finding or decision once, in the doc that owns it, and link from everywhere else. The Gini premise was restated in the README, `project-background.md` and the ODD, and went on being repeated there after it was contradicted. The Research state section above is the home for what the research currently says.
- **Index everything you add.** A new `docs/research-*.md` gets a row in `docs/studies.md` (finding and status) in the same commit. A new ARD gets its row in `docs/decisions/README.md`.
- **Put status where a reader will see it.** When a later result contradicts, narrows or retires a study, add `> **Status: <state>.** <one sentence and a link>` directly under its provenance block, change its row in `docs/studies.md`, and update Research state if it is a headline claim. States are Current, Partly superseded, Resolved, Historical and Unchecked (defined in `studies.md`). The dated note next to the claim itself stays, per the convention below.
- **Current rule first.** A `docs/model-reference.md` bullet opens with what the code does now; history follows a `History.` marker.
- **Budget for this file.** Keep `CLAUDE.md` under about 3,200 words. To add a rule, cut or move one; findings and history belong in `docs/`.

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

Be concise but clear in every doc — `CLAUDE.md`, ARDs, `future-ideas.md`, `decisions/README.md`. The clarity rules above apply here too. These files load into agent context, so bloat is a real cost: cut hedging, restated points, and elaborations the next reader can infer. One sentence beats three when it carries the same information. Keep the why; trim the throat-clearing.

**Research docs (`docs/research-*.md`)** must open with a provenance block so results stay interpretable after Variables are recalibrated:

```
**Recorded:** YYYY-MM-DD | **Commit:** <short hash> | **Latest ARD:** NNN | **Base config:** all Variables at defaults unless noted
**Commands:** npm run sweep -- ...
**Key context vars:** LIST=VAL, ... (the 3–5 Variables most likely to shift the results if recalibrated)
```

The commit hash lets a reader run `git show <hash>:src/Helpers/Variables.ts` to see the exact config. List only the variables with meaningful leverage on the reported outcomes, not the full constant dump.

**Latest ARD** is the highest-numbered Accepted ARD when the study ran. `Key context vars` alone can't be trusted: a 2026-09-13 re-verification found results had drifted while every listed variable was unchanged, because the seeding and relationship structure of ARD 052–058 had changed. One ARD number tells the next reader what landed since.

**When a result doesn't reproduce, annotate — don't delete.** Add a dated note (`> **Re-verified YYYY-MM-DD (commit <hash>) — …**`) next to the original claim saying what was re-measured and what it showed, and flag the summary row and any follow-up item the claim feeds. A study that was later contradicted is part of the record, and knowing a result was *checked and failed* is more useful than finding it quietly gone. See `research-zero-variability-tests.md` and `research-pairing-calibration.md` for worked examples.
