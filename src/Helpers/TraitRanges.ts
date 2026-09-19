/**
 * Founder seeding ranges for the heritable person fields — one source of truth.
 *
 * `Simulation.seed` draws each founder's stats and intents from these ranges, and
 * `ChildbirthEvent` reads the same table for the small-population fallback in ARD 064: when the
 * living population is too small to estimate a trait's spread, the residual spread comes from the
 * range the trait was founded on. The literals previously existed only as arguments at the seeding
 * call site, so the two would have had to be kept in step by hand.
 *
 * Ranges are half-open `[min, max)` and match `Simulation.seed`'s prior literals exactly.
 * `helpingIntent` is seeded (ARD 045 deliberately gives it a higher ceiling than the antisocial
 * intents) but is **not** inherited — `ChildbirthEvent.seedNewborn` never assigns it, which is a
 * known defect scoped to its own ARD. It is listed here because founders need it; do not read its
 * presence as a claim that it is heritable.
 */

/** A half-open `[min, max)` seeding range. */
export type SeedRange = readonly [min: number, max: number];

/** Founder seeding range per overridable person field. */
export const SEED_RANGES = {
  intelligence: [1, 11],
  constitution: [1, 11],
  charisma: [1, 11],
  learningIntent: [0, 1],
  exerciseIntent: [0, 1],
  stealingIntent: [0, 0.3],
  killingIntent: [0, 0.1],
  helpingIntent: [0, 0.5],
} as const satisfies Record<string, SeedRange>;

/** The fields `ChildbirthEvent` draws for a newborn. Excludes `helpingIntent` — see the note above. */
export type HeritableField =
  'intelligence' | 'constitution' | 'charisma'
  | 'learningIntent' | 'exerciseIntent' | 'stealingIntent' | 'killingIntent';

/**
 * Standard deviation of a uniform draw over a trait's founder seeding range.
 *
 * Used as the residual spread when the living population is too small to estimate one. A uniform
 * distribution on `[a, b)` has standard deviation `(b − a) / sqrt(12)`.
 *
 * @param field - the heritable field
 * @returns the founder-range standard deviation for that field
 */
export function founderSpread(field: HeritableField): number {
  const [min, max] = SEED_RANGES[field];
  return (max - min) / Math.sqrt(12);
}

/**
 * The heritable fields that are also mutated after birth, mapped to the field holding the value the
 * person was born with (ARD 066).
 *
 * `intelligence` is raised by `LearnEvent` and `GraduationEvent` and lowered by `StatDecayEvent`;
 * `constitution` is raised by `ExerciseEvent` and lowered by `StatDecayEvent`; `stealingIntent` is
 * raised by `StealEvent`'s ARD 036 emboldening. For these three the expressed value is endowment
 * plus accumulation, so heritability must read the endowment instead — regressing newborns toward
 * the expressed mean is a feedback loop that ratchets the population to the trait's cap.
 *
 * The four fields absent from this map are never mutated after birth, so their expressed value *is*
 * their endowment and a second field would be a permanent duplicate. Which fields appear here is
 * therefore also the answer to "which traits can a life change?".
 */
export const ENDOWMENT_FIELDS = {
  intelligence: 'intelligenceEndowment',
  constitution: 'constitutionEndowment',
  stealingIntent: 'stealingIntentEndowment',
} as const satisfies Partial<Record<HeritableField, string>>;

/** A field name holding a heritable endowment. */
export type EndowmentField = typeof ENDOWMENT_FIELDS[keyof typeof ENDOWMENT_FIELDS];

/**
 * The field heritability should read for a trait: its endowment where one exists, else the trait.
 *
 * @param field - the heritable field
 * @returns the field name carrying that trait's heritable value
 */
export function heritableSource(field: HeritableField): HeritableField | EndowmentField {
  return (ENDOWMENT_FIELDS as Partial<Record<HeritableField, EndowmentField>>)[field] ?? field;
}
