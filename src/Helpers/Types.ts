export type RNG = () => number;

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
  /** Deaths by old age over the decade. */
  deathsByOldAge: number;
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
}
