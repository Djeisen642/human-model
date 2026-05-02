# ARD 014: Happiness Model Revision

**Status:** Accepted  
**Date:** 2026-05-01

## Context

ARD 009 established the happiness model with five additive factors. Three problems emerged when examining how the model behaves for children and the elderly:

**Children floor at happiness=0 trivially.** A child with no job (−3), low resources (−2 or −5), and the age <18 penalty (−1) scores −6 to −9 before the floor. Children are almost always at 0 happiness regardless of their actual circumstances. This makes `averageHappiness` insensitive to whether children are thriving or suffering.

**Children's happiness depends on parents, not themselves.** A child doesn't own resources independently — their wellbeing is tied to their parents' circumstances. Using the child's own `resources` field is the wrong input.

**The age penalties don't reflect reality.** A −1 penalty for being under 18 treats childhood as inherently worse than adulthood; research consistently shows children and young adults report among the highest life satisfaction. The −3 penalty for being over 65 is too harsh and doesn't account for the different ways age affects wellbeing — the real vulnerability for the elderly is resource scarcity, not age itself.

## Decision

Five changes to the happiness getter:

**1. Baseline happiness for being alive:**

Every person receives a baseline happiness bonus regardless of circumstances:

```typescript
static HAPPINESS_BASELINE = 0;
```

Starting at 0, this is a no-op by default. It exists as an explicit tuning lever — if calibration shows too many persons flooring at 0, `HAPPINESS_BASELINE` can be raised without touching the individual factor magnitudes.

**2. Age modifiers revised:**

| Age range | Old modifier | New modifier |
|---|---|---|
| < 18 | −1 | 0 |
| > 65 | −3 | −1 |

**3. Job factor excludes children and elderly:**

No happiness penalty for lacking a job if `age < 18` or `age > 65`. Children are not expected to work; retirement is normal. The penalty applies only to working-age adults (18–65).

**4. Children's resource factor uses parents' resources:**

For persons under 18, the resource tier check uses the average resources of living parents (from `childOf`) rather than the child's own resources. If no living parents exist (orphan), fall back to the child's own resources.

```typescript
const resourceBase = (this.age < 18 && this.livingParents.length > 0)
  ? this.livingParents.reduce((sum, p) => sum + p.resources, 0) / this.livingParents.length
  : this.resources;
```

Where `livingParents` is a computed getter returning `this.childOf.filter(p => p.causeOfDeath === null)`.

**5. Elderly resource thresholds shift upward:**

For persons over 65, the resource tier boundaries are higher — the elderly need more resources to feel secure and hit scarcity sooner:

| Tier | Working-age threshold | Elderly threshold |
|---|---|---|
| Critical | < 10 | < 20 |
| Low | < 30 | < 50 |
| Comfortable | ≥ 70 | ≥ 100 |

The magnitudes (−5, −2, +3) remain the same; only the thresholds change.

**Updated happiness getter:**

```typescript
get happiness(): number {
  let happiness = Variables.HAPPINESS_BASELINE;

  // Job: only penalise working-age adults for unemployment
  if (this.age >= 18 && this.age <= 65) {
    happiness += this.hasJob ? 5 : -3;
  } else if (this.hasJob) {
    happiness += 5;
  }

  // Resources: children use parents' average; elderly have higher thresholds
  const resourceBase = (this.age < 18 && this.livingParents.length > 0)
    ? this.livingParents.reduce((sum, p) => sum + p.resources, 0) / this.livingParents.length
    : this.resources;

  const criticalThreshold = this.age > 65 ? 20 : 10;
  const lowThreshold = this.age > 65 ? 50 : 30;
  const comfortableThreshold = this.age > 65 ? 100 : 70;

  if (resourceBase < criticalThreshold) happiness -= 5;
  else if (resourceBase < lowThreshold) happiness -= 2;
  else if (resourceBase >= comfortableThreshold) happiness += 3;

  // Relationship
  if (this.isInRelationshipWith !== null) happiness += 3;

  // Age: small penalty for elderly only
  if (this.age > 65) happiness -= 1;

  // Illness
  happiness -= Math.round(this.illness * 5);

  return Math.max(0, happiness);
}
```

## Reasoning

**Baseline at 0 is a tuning lever, not a claim.** Starting at 0 makes it a no-op — the model behaves identically to having no baseline. Its value is that it makes the intention explicit and provides a single constant to adjust if calibration shows happiness flooring too frequently. Raising it shifts the whole population upward without touching individual factor magnitudes.

**No age penalty for children.** Research on subjective wellbeing (Diener & Diener, 1996; Chaplin, 2009) consistently finds children and young adults report high life satisfaction. The original −1 was meant to capture dependency, but dependency is better captured through the resource factor (children depend on parents' resources). Removing it lets the resource factor do its job.

**Reduced elderly penalty (−3 → −1).** The large penalty was a proxy for declining health and social isolation. Health is already captured by the illness factor. The remaining −1 acknowledges genuine late-life challenges (bereavement, reduced mobility) without overstating them. The real elderly vulnerability is resource scarcity, now modeled directly through higher thresholds.

**No job penalty for children or elderly.** Applying a −3 unemployment penalty to a 10-year-old or a 70-year-old misrepresents what employment means. Children are not in the labor market; the elderly have earned exit from it. The job bonus (+5) still applies if they do have a job — unusual but not impossible.

**Children's resources from living parents.** A child's material wellbeing is determined by their household, not their personal asset balance. Using `childOf` with a living-parent filter handles orphans naturally: when all parents are dead, the child relies on their own resources. The average of living parents handles single-parent situations without special-casing.

**Higher elderly thresholds rather than an extra penalty.** Tacking an additional penalty on top of the existing resource tiers would be contrived. Shifting the thresholds is the more natural expression of the same idea: an elderly person needs more resources to feel the same level of security as a working-age adult. Medical costs, inability to earn, and reduced physical resilience all raise the effective cost of living in old age.

## Consequences

- `Variables.ts` gains `HAPPINESS_BASELINE = 0`; raise this constant if calibration shows too many persons flooring at 0
- `Person` gains a `livingParents` computed getter: `this.childOf.filter(p => p.causeOfDeath === null)`
- The happiness getter changes as shown above; ARD 009 is superseded by this ARD for the affected factors
- Children of wealthy parents will show higher happiness; children of poor parents will show lower — making childbirth stakes visible in the happiness signal
- Elderly persons are more sensitive to resource scarcity, increasing their suicide risk (via ARD 013) when resources are low
- `averageHappiness` in `TickSnapshot` will be more sensitive across the full age distribution
- Tests must cover: child with living parents, child as orphan, elderly job/no-job, elderly at each resource tier, working-age adult unchanged behavior
- ARD 009 **Status** should be updated to: `Superseded by ARD 014`
