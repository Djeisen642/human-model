import Person from '../App/Person';
import Variables from './Variables';

/**
 * Gini over a Float64Array, which is sorted in place. Split out from `gini` so
 * `resourceGini` can fill one buffer and hand it straight over instead of paying for a
 * plain array, a filter copy, a map copy and a comparator sort — at 10^5 persons this path
 * is the simulation's single hottest loop, because `KillEvent` re-evaluates it inside the
 * tick. The arithmetic is unchanged: the accumulation order is still ascending over the
 * sorted values, so results stay bit-for-bit identical to the reduce-based version
 * (`scripts/parity-check.ts` is the contract).
 *
 * @param values - values to sort in place and reduce; mutated
 * @returns Gini coefficient in [0, 1)
 */
function giniOfBuffer(values: Float64Array): number {
  const n = values.length;
  if (n === 0) return 0;
  values.sort();
  let total = 0;
  for (let i = 0; i < n; i++) total += values[i];
  if (total === 0) return 0;
  let weightedSum = 0;
  for (let i = 0; i < n; i++) weightedSum += (i + 1) * values[i];
  return (2 * weightedSum - (n + 1) * total) / (n * total);
}

/**
 * Gini coefficient using the sorted weighted-sum formula.
 * Returns 0 when all values are equal or the array is empty.
 *
 * @param values - numeric values
 * @returns Gini coefficient in [0, 1)
 */
export function gini(values: number[]): number {
  return giniOfBuffer(new Float64Array(values));
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
  const minAge = Variables.WORKING_AGE_MIN;
  const buffer = new Float64Array(persons.length);
  let count = 0;
  for (let i = 0; i < persons.length; i++) {
    const person = persons[i];
    if (person.age >= minAge) buffer[count++] = person.resources;
  }
  return giniOfBuffer(count === persons.length ? buffer : buffer.subarray(0, count));
}
