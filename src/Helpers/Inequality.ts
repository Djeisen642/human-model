import Person from '../App/Person';
import Variables from './Variables';

/**
 * Gini coefficient using the sorted weighted-sum formula.
 * Returns 0 when all values are equal or the array is empty.
 *
 * @param values - numeric values
 * @returns Gini coefficient in [0, 1)
 */
export function gini(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const total = sorted.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  const weightedSum = sorted.reduce((sum, x, i) => sum + (i + 1) * x, 0);
  return (2 * weightedSum - (n + 1) * total) / (n * total);
}

/**
 * The model's inequality signal: Gini of `resources` over persons at or above
 * `WORKING_AGE_MIN`. Dependent children are excluded because the model does not treat a
 * child's own `resources` as their standard of living anywhere else — `ConsumptionEvent`
 * charges them a token rate on the assumption of a parental subsidy, `Person.happiness`
 * substitutes the parents' average, and both seeding paths start them at zero. Including
 * them would tie the inequality signal to the dependency ratio, and so to the birth rate.
 * Returns 0 when no adults are alive. ARD 060.
 *
 * @param persons - living population
 * @returns Gini coefficient over adult resources, in [0, 1)
 */
export function resourceGini(persons: Person[]): number {
  return gini(
    persons
      .filter(p => p.age >= Variables.WORKING_AGE_MIN)
      .map(p => p.resources),
  );
}
