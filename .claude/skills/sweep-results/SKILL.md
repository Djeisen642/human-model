---
name: sweep-results
description: >-
  Decide whether a difference between two simulation configurations is real, and report it honestly.
  Use this whenever you are about to compare sweep arms, claim that a Variables constant does or
  does not matter, say a config is better or worse, write or update a docs/research-*.md file, or
  read a sweep table and form a conclusion from it — even if you have not been asked to run a
  statistical test, and even when the difference looks obvious. Eyeballing sweep output is the single
  most common way results in this repo have turned out wrong, so reach for this before trusting a
  gap you can see in a table.
---

# Reading sweep results without fooling yourself

## Why this exists

This project has repeatedly published differences that later failed to reproduce. A 6-of-16 result
became 6-of-48 when rerun with more seeds. A config that looked like it rescued the model at 800
ticks turned out to be identical to the default by 2000. These were not careless — they came from
reading a sweep table and believing the gap. The table is for exploring. Deciding takes a test.

## The sequence

**1. Explore with `sweep.ts`.** Scan a range, find something interesting, form a hypothesis. Nothing
you conclude here is a result yet.

**2. Decide with `compare.ts`.** Run the hypothesis as a two-arm comparison:

```bash
npx ts-node scripts/compare.ts --seeds 48 --ticks 2000 --b BASE_CHILDBIRTH_RATE=1.0
npx ts-node scripts/compare.ts --seeds 48 --ticks 2000 \
  --both INVENTION_DEPLETION_FASTER_WEIGHT=0 --both INVENTION_DEPLETION_SLOWER_WEIGHT=0 \
  --b HAPPINESS_BASELINE=10
```

`--a` is the baseline arm, `--b` the treatment, `--both` a background config shared by each. Both arms
run the same seeds, so each run is compared against its own twin — that is what makes it sensitive
enough to resolve effects the sweep table cannot.

**3. Report with provenance.** `docs/research-*.md` needs the header block described in CLAUDE.md.

## Reading the output in the right order

Read the **range** first, then the **size**, then the verdict. That order is deliberate:

- **Range spans zero** → the direction is unsettled, whatever the verdict says. Stop there.
- **Size** → a difference can be real and still too small to care about. "Real" is not "important".
- **Verdict** → REAL DIFFERENCE / PROBABLY REAL / TOO CLOSE TO CALL.

Leading with the verdict is how you end up chasing an effect that is real and useless.

## Three traps this repo has actually fallen into

**TOO CLOSE TO CALL is not "no effect."** It often means the run was too small to see the effect. The
tool prints how many seeds you would have needed — use that number, and report the result as "too
small to tell with 48 runs" rather than as a null. Claiming a null you had no power to detect is
worse than claiming nothing.

**A short horizon turns delay into rescue.** A config whose only benefit is postponing collapse looks
like a fix at any horizon shorter than the delay it buys. Judge at 2000 ticks, and prefer the
extinction-vs-horizon curve to any single number: a genuinely different config flattens, a delaying
one keeps climbing. If a result matters, check it at a longer horizon before believing it.

**Six measures are compared at once.** About one run of the tool in four will throw up a false alarm
when nothing truly differs. A measure you predicted *before* running is much stronger evidence than
the one surprising row in an otherwise flat table. If a single unexpected row is your whole finding,
rerun with different seeds before writing it up.

## When the tool does not apply

`compare.ts` compares two configurations on outcome measures. It will not help you with a claim about
mechanism ("this works because X"), which needs an experiment that cuts the proposed pathway and
shows the effect disappears. It also will not tell you whether a measure is trustworthy in the first
place — `peakGini`, for instance, is a max-of-noise statistic that moves with population size rather
than inequality.

For what each column means, which ones to distrust, and the validation record for the tool itself,
read `docs/calibration-guide.md`. This skill deliberately does not repeat that material — one source
of truth, so the two cannot drift apart.
