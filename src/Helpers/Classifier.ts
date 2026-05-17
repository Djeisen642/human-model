import Person from '../App/Person';
import {
  OVERRIDABLE_FIELDS,
  OverridableField,
  PersonTypeDefinition,
  PersonTypes,
} from './Types';

/**
 * Returns every type name whose range predicate matches the person.
 * Matching rule: for each field declared in the type's ranges, the person's
 * current value must satisfy `min <= value < max`. An empty ranges map matches
 * everyone.
 *
 * @param person - person to classify
 * @param types - declared types
 * @returns names of every type this person currently matches
 */
export function classifyPerson(person: Person, types: PersonTypes): string[] {
  const matches: string[] = [];
  for (const [name, def] of Object.entries(types)) {
    if (matchesType(person, def)) matches.push(name);
  }
  return matches;
}

/**
 * Counts how many of `persons` match each declared type.
 * A person matching multiple types contributes to every match.
 *
 * @param persons - persons to count
 * @param types - declared types
 * @returns map of type name → match count (one entry per declared type, even if zero)
 */
export function countPerType(persons: Person[], types: PersonTypes): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const name of Object.keys(types)) counts[name] = 0;
  for (const person of persons) {
    for (const name of classifyPerson(person, types)) {
      counts[name]++;
    }
  }
  return counts;
}

/**
 * Parses and validates a raw config value into a typed `PersonTypes` map.
 *
 * - Sum of percentages must be ≤ 1.0 — throws otherwise.
 * - Negative percentages throw.
 * - Malformed range entries are warned and skipped; the field falls back to default seeding.
 * - Unknown range field names are warned and skipped.
 *
 * @param raw - the value at `simulation.personTypes` in the config JSON
 * @returns sanitised PersonTypes map (empty when `raw` is undefined/null)
 */
export function parsePersonTypes(raw: unknown): PersonTypes {
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('simulation.personTypes must be an object');
  }

  const result: PersonTypes = {};
  let sum = 0;

  for (const [name, def] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof def !== 'object' || def === null || Array.isArray(def)) {
      // eslint-disable-next-line no-console
      console.warn(`Config: personTypes.${name} must be an object, skipping`);
      continue;
    }
    const d = def as Record<string, unknown>;

    if (typeof d.percentage !== 'number' || Number.isNaN(d.percentage)) {
      throw new Error(`personTypes.${name}.percentage must be a number`);
    }
    if (d.percentage < 0) {
      throw new Error(`personTypes.${name}.percentage must be >= 0`);
    }
    sum += d.percentage;

    const ranges: PersonTypeDefinition['ranges'] = {};
    const rawRanges = d.ranges;
    if (rawRanges !== undefined) {
      if (typeof rawRanges !== 'object' || rawRanges === null || Array.isArray(rawRanges)) {
        // eslint-disable-next-line no-console
        console.warn(`Config: personTypes.${name}.ranges must be an object, ignoring`);
      } else {
        for (const [field, range] of Object.entries(rawRanges as Record<string, unknown>)) {
          if (!(OVERRIDABLE_FIELDS as readonly string[]).includes(field)) {
            // eslint-disable-next-line no-console
            console.warn(`Config: personTypes.${name}.ranges.${field} is not an overridable field, skipping`);
            continue;
          }
          if (
            !Array.isArray(range)
            || range.length !== 2
            || typeof range[0] !== 'number'
            || typeof range[1] !== 'number'
            || Number.isNaN(range[0])
            || Number.isNaN(range[1])
          ) {
            // eslint-disable-next-line no-console
            console.warn(`Config: personTypes.${name}.ranges.${field} must be [number, number], skipping`);
            continue;
          }
          if (range[0] > range[1]) {
            // eslint-disable-next-line no-console
            console.warn(`Config: personTypes.${name}.ranges.${field} has min > max, skipping`);
            continue;
          }
          ranges[field as OverridableField] = [range[0], range[1]];
        }
      }
    }

    result[name] = { percentage: d.percentage, ranges };
  }

  if (sum > 1 + 1e-9) {
    throw new Error(`personTypes percentages sum to ${sum.toFixed(4)}, must be <= 1.0`);
  }

  return result;
}

/**
 * @param person - person to test
 * @param def - type definition to match against
 * @returns true iff every declared range contains the person's current value
 */
function matchesType(person: Person, def: PersonTypeDefinition): boolean {
  for (const [field, range] of Object.entries(def.ranges) as [OverridableField, [number, number]][]) {
    const value = (person as unknown as Record<OverridableField, number>)[field];
    if (value < range[0] || value >= range[1]) return false;
  }
  return true;
}
