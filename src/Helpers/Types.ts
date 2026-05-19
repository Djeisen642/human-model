export type RNG = () => number;

/** Person stat/intent fields whose seeding range can be overridden by a personType. */
export const OVERRIDABLE_FIELDS = [
  'age',
  'resources',
  'experience',
  'intelligence',
  'constitution',
  'charisma',
  'learningIntent',
  'exerciseIntent',
  'stealingIntent',
  'lyingIntent',
  'killingIntent',
  'helpingIntent',
] as const;

export type OverridableField = typeof OVERRIDABLE_FIELDS[number];

/** Integer-valued seeded fields; the rest are continuous in [0, 1]-ish. */
export const INTEGER_FIELDS: ReadonlySet<OverridableField> = new Set<OverridableField>([
  'age',
  'resources',
  'experience',
  'intelligence',
  'constitution',
  'charisma',
]);

/** A single user-defined person type: a fraction of the population and a partial range override. */
export interface PersonTypeDefinition {
  /** Fraction of the initial population assigned to this type, in [0, 1]. */
  percentage: number;
  /** Partial map: overrides per field. Each entry is a half-open [min, max). */
  ranges: Partial<Record<OverridableField, [number, number]>>;
}

/** Map of type name → definition. Names are arbitrary strings chosen by the config author. */
export type PersonTypes = Record<string, PersonTypeDefinition>;

/** Aggregate statistics for a completed 10-tick decade. */
export interface TenYearSummary {
  /** The tick that closed this decade (10, 20, 30, …). */
  endTick: number;
  /** Population alive at the end of the decade. */
  endPopulation: number;
  /** Net population change over the decade (end − start). */
  populationDelta: number;
  /** Total deaths over the decade (delta, not cumulative). */
  totalDeaths: number;
  /** Deaths by illness over the decade. */
  deathsByIllness: number;
  /** Deaths by suicide over the decade. */
  deathsBySuicide: number;
  /** Deaths by killing/murder over the decade. */
  deathsByKilling: number;
  /** Deaths by disaster over the decade. */
  deathsByDisaster: number;
  /** Average Gini coefficient across the 10 ticks. */
  avgResourceGini: number;
  /** Average resources per living person across the 10 ticks. */
  avgResources: number;
  /** Average happiness across the 10 ticks. */
  avgHappiness: number;
  /** Average natural resource pool level across the 10 ticks. */
  avgNaturalResources: number;
  /** Worst single-year Gini observed in the decade. */
  peakResourceGini: number;
  /** Births over the decade (delta, not cumulative). */
  births: number;
  /** Average community pool balance across the decade's ticks. ARD 034. */
  avgCommunityPool: number;
}

/** Aggregate composition of the living population at end of simulation. ARD 031. */
export interface SurvivorSummary {
  /** Living population count. */
  total: number;
  /** Children (age < 18). */
  children: number;
  /** Working-age (18 ≤ age ≤ 65). */
  working: number;
  /** Elderly (age > 65). */
  elderly: number;
  /** Count of survivors at each education level, keyed by EDUCATION constant value. */
  educationCounts: Record<number, number>;
  /** Persons currently enrolled (`isWorkingOnEd !== NONE`). */
  enrolled: number;
  /** Working-age persons with `hasJob`. */
  employed: number;
  /** Healthy: illness < 0.1. */
  healthWell: number;
  /** Mild illness: illness in [0.1, 0.5). */
  healthMild: number;
  /** Severe illness: illness ≥ 0.5. */
  healthSevere: number;
  /** Mean illness across survivors. */
  avgIllness: number;
  /** Persons with `isInRelationshipWith !== null`. */
  partnered: number;
  /** Persons whose `hasChildren.length > 0`. */
  withChildren: number;
}
