import Person from './Person';
import DeathRecord from '../Records/DeathRecord';
import KillingRecord from '../Records/KillingRecord';
import Constants from '../Helpers/Constants';
import Variables from '../Helpers/Variables';
import { ageModifier } from '../Helpers/AgeModifier';
import {
  INTEGER_FIELDS,
  OverridableField,
  PersonTypeDefinition,
  PersonTypes,
  RNG,
  TenYearSummary,
} from '../Helpers/Types';

/** Per-tick aggregate state captured at the end of each tick. */
export interface TickSnapshot {
  /** Zero-based tick index. */
  tick: number;
  /** Living population count at end of tick. */
  population: number;
  /** Total deaths this tick. */
  deaths: number;
  /** Deaths caused by murder this tick. */
  deathsByMurder: number;
  /** Deaths caused by illness this tick. */
  deathsByIllness: number;
  /** Deaths caused by disaster this tick. */
  deathsByDisaster: number;
  /** Deaths caused by suicide this tick. */
  deathsBySuicide: number;
  /** Cumulative total deaths up to and including this tick. */
  cumulativeDeaths: number;
  /** Cumulative murder deaths up to and including this tick. */
  cumulativeDeathsByMurder: number;
  /** Cumulative illness deaths up to and including this tick. */
  cumulativeDeathsByIllness: number;
  /** Cumulative disaster deaths up to and including this tick. */
  cumulativeDeathsByDisaster: number;
  /** Cumulative suicide deaths up to and including this tick. */
  cumulativeDeathsBySuicide: number;
  /** Mean resources across living population. */
  averageResources: number;
  /** Gini coefficient of resource distribution (0 = perfect equality, 1 = perfect inequality). */
  resourceGini: number;
  /** Mean happiness across living population. */
  averageHappiness: number;
  /** Sum of killingIntent across living population. */
  aggregateKillingIntent: number;
  /** Sum of stealingIntent across living population. */
  aggregateStealingIntent: number;
  /** Remaining natural resource pool at end of tick (after this tick's regen and extraction). */
  naturalResources: number;
  /** Pool cost per unit gathered at end of tick; modified by InventionEvent. ARD 032. */
  extractionProductivity: number;
  /** Maximum accessible resources at end of tick; grown by InventionEvent. ARD 032. */
  naturalResourceCeiling: number;
  /** Births this tick. ARD 033. */
  births: number;
  /** Cumulative births up to and including this tick. ARD 033. */
  cumulativeBirths: number;
  /** Community pool balance at end of tick. ARD 034. */
  communityPool: number;
  /** Mean illness severity across living population at end of tick. */
  averageIllness: number;
  /** Fraction of working-age persons (18–65) with a job at end of tick. 0 when none exist. */
  employmentRate: number;
  /** Thefts executed this tick (successful StealEvent executions). */
  stealsCommitted: number;
  /** Number of living persons currently serving a jail sentence at end of tick. */
  jailedPopulation: number;
  /** Number of partnered pairs at end of tick. Each couple counted once. */
  totalCoupleCount: number;
  /** Number of partnered pairs where the older partner's age gives childbirth ageModifier >= 0.5 (roughly max age ≤ 40). */
  fertileCoupleCount: number;
  /** Mean age across living population at end of tick. 0 when none exist. */
  averageAge: number;
  /** Median age across living population at end of tick. 0 when none exist. */
  medianAge: number;
  /** Count of living persons by education tier, indexed by Constants.EDUCATION value (length 6). */
  educationCounts: number[];
}

export default class Simulation {
  private living: Person[] = [];
  private deceased: Person[] = [];
  /** Accumulated snapshot history — one entry per completed tick. */
  readonly history: TickSnapshot[] = [];
  /** One summary per completed decade; appended by LooperSingleton every 10 ticks. */
  readonly decadeHistory: TenYearSummary[] = [];

  /** Current available natural resource pool; depleted by gathering. See ARD 044. */
  naturalResources: number = Variables.NATURAL_RESOURCES_INITIAL;
  /** Maximum accessible resources; grows via InventionEvent. */
  naturalResourceCeiling: number = Variables.NATURAL_RESOURCE_CEILING_INITIAL;
  /** Productivity multiplier on gather output and pool drain; higher = more output and faster drain. Modified by InventionEvent. See ARD 039. */
  extractionProductivity: number = Variables.EXTRACTION_PRODUCTIVITY_INITIAL;

  /** Person types in effect for this run; empty when none were configured. Used by reporting. */
  personTypes: PersonTypes = {};
  /** Seeded count per type, captured at seed time. Used to compute survival deltas. */
  seededTypeCounts: Record<string, number> = {};

  /** Shared redistributive fund; funded by tax and jail forfeitures, paid to welfare recipients. ARD 034. */
  communityPool = 0;

  /** Cumulative count of InventionEvent firings that accelerated depletion. ARD 032. */
  inventionFasterCount = 0;
  /** Cumulative count of InventionEvent firings that slowed depletion. ARD 032. */
  inventionSlowerCount = 0;
  /** Cumulative count of InventionEvent firings that grew the resource ceiling. ARD 032. */
  inventionCeilingCount = 0;

  private tickDeathCauses: number[] = [];
  private tickBirths = 0;
  private tickSteals = 0;

  /**
   * Returns a shallow copy of the living population.
   *
   * @returns living persons
   */
  getLiving(): Person[] {
    return [...this.living];
  }

  /**
   * Index of `person` in the living array, or -1 if not living.
   * Reads the internal array directly so callers that only need ordering don't
   * pay for getLiving's shallow-copy allocation.
   *
   * @param person - person to locate
   * @returns index in the living array, or -1 if not present
   */
  indexOfLiving(person: Person): number {
    return this.living.indexOf(person);
  }

  /**
   * Returns a random living person other than `exclude`, or null if no other living person exists.
   *
   * @param exclude - person to exclude from selection
   * @param rng - random number source
   * @returns a random other living person, or null
   */
  getRandomOther(exclude: Person, rng: RNG): Person | null {
    const candidates = this.living.filter(p => p !== exclude);
    if (candidates.length === 0) return null;
    const index = Math.min(Math.floor(rng() * candidates.length), candidates.length - 1);
    return candidates[index];
  }

  /**
   * Moves `person` from living to deceased, distributes their estate between
   * community pool, surviving partner, and living children, records cause of
   * death, and adds a KillingRecord to the killer when applicable. Estate
   * distribution is cause-blind — the killer receives no share. See ARD 042.
   *
   * @param person - person who died
   * @param cause - cause of death (Constants.CAUSE_OF_DEATH)
   * @param killer - murderer, required when cause is MURDER
   */
  kill(person: Person, cause: number, killer?: Person): void {
    this.distributeEstate(person);

    if (person.isInRelationshipWith !== null) {
      person.isInRelationshipWith.isInRelationshipWith = null;
      person.isInRelationshipWith = null;
    }
    person.causeOfDeath = new DeathRecord(cause, killer);
    if (cause === Constants.CAUSE_OF_DEATH.MURDER && killer) {
      killer.killed.set(person, new KillingRecord(person, killer.age));
    }
    this.living = this.living.filter(p => p !== person);
    this.deceased.push(person);
    this.tickDeathCauses.push(cause);
  }

  /**
   * Distributes `person.resources` across community pool, surviving partner,
   * and living children per ARD 042 shares. Missing-heir shares consolidate to
   * the other individual heir before falling back to community. Zeroes
   * `person.resources` after distribution. No-op when the estate is zero.
   *
   * @param person - deceased person (still holding their balance and relationships)
   */
  private distributeEstate(person: Person): void {
    const estate = person.resources;
    if (estate <= 0) return;

    const partner = person.isInRelationshipWith;
    const livingChildren = person.hasChildren.filter(c => c.causeOfDeath === null);
    const hasPartner = partner !== null;
    const hasChildren = livingChildren.length > 0;

    let partnerShare = 0;
    let childrenShare = 0;
    let communityShare = Variables.ESTATE_COMMUNITY_SHARE;

    if (hasPartner && hasChildren) {
      partnerShare = Variables.ESTATE_PARTNER_SHARE;
      childrenShare = Variables.ESTATE_CHILDREN_SHARE;
    } else if (hasPartner) {
      partnerShare = Variables.ESTATE_PARTNER_SHARE + Variables.ESTATE_CHILDREN_SHARE;
    } else if (hasChildren) {
      childrenShare = Variables.ESTATE_PARTNER_SHARE + Variables.ESTATE_CHILDREN_SHARE;
    } else {
      communityShare = 1;
    }

    this.communityPool += estate * communityShare;
    if (partnerShare > 0 && partner !== null) {
      partner.resources += estate * partnerShare;
    }
    if (childrenShare > 0 && hasChildren) {
      const perChild = (estate * childrenShare) / livingChildren.length;
      for (const child of livingChildren) {
        child.resources += perChild;
      }
    }

    person.resources = 0;
  }

  /**
   * Adds a person to the living population (births and initial seeding).
   *
   * @param person - person to add
   */
  add(person: Person): void {
    this.living.push(person);
  }

  /**
   * Increments the per-tick birth counter. Called by ChildbirthEvent only;
   * the initial seed loop does not call this. ARD 033.
   */
  recordBirth(): void {
    this.tickBirths++;
  }

  /**
   * Increments the per-tick steal counter. Called by StealEvent on a successful theft.
   */
  recordSteal(): void {
    this.tickSteals++;
  }

  /**
   * Creates `n` persons with stats and intents drawn from uniform distributions
   * and adds them to the living population.
   *
   * Default ranges: age [15, 50), resources [0, 100), experience [0, age],
   * intelligence/constitution/charisma [1, 10],
   * learningIntent/exerciseIntent [0, 1),
   * stealingIntent/lyingIntent [0, 0.3), killingIntent [0, 0.1),
   * helpingIntent [0, 0.5) — higher ceiling than antisocial intents (ARD 045).
   *
   * When `personTypes` is supplied, `floor(n * percentage)` persons are assigned
   * to each declared type; the assignment array is Fisher-Yates shuffled so
   * type does not correlate with iteration order. For each typed person, fields
   * declared in the type's `ranges` use the override; undeclared fields fall
   * back to the default range. See ARD 030.
   *
   * @param n - number of persons to seed
   * @param rng - random number source
   * @param personTypes - optional map of type definitions; defaults to none
   */
  seed(n: number, rng: RNG, personTypes: PersonTypes = {}): void {
    this.personTypes = personTypes;
    this.seededTypeCounts = {};
    for (const name of Object.keys(personTypes)) this.seededTypeCounts[name] = 0;

    // Only build (and shuffle) an assignment array when types are declared, so
    // the default-seeding RNG sequence is unchanged from prior behaviour.
    const assignments = Object.keys(personTypes).length > 0
      ? buildTypeAssignments(n, personTypes, rng)
      : null;

    for (let i = 0; i < n; i++) {
      const typeName = assignments ? assignments[i] : null;
      const ranges = typeName !== null ? personTypes[typeName].ranges : {};
      if (typeName !== null) this.seededTypeCounts[typeName]++;

      const person = new Person([]);
      person.age = drawField(rng, 'age', ranges, Variables.SEED_AGE_FLOOR, 50);
      // Education seeding only applies to persons at or above the relationship minimum age;
      // younger children default to NONE (no schooling yet).
      if (person.age >= Variables.RELATIONSHIP_MIN_AGE) {
        if (person.age <= Variables.GRADUATION_HS_MAX_AGE) {
          if (rng() < Variables.GRADUATION_HS_SEED_RATE) {
            person.isWorkingOnEd = Constants.EDUCATION.HIGH_SCHOOL;
          }
        } else if (person.age <= Variables.GRADUATION_COLLEGE_MAX_AGE) {
          if (rng() < Variables.GRADUATION_COLLEGE_SEED_RATE) {
            person.isWorkingOnEd = Constants.EDUCATION.BACHELORS;
          }
        } else {
          if (rng() < Variables.GRADUATION_ADULT_HS_RATE) {
            person.education = Constants.EDUCATION.HIGH_SCHOOL;
            if (rng() < Variables.GRADUATION_ADULT_BACHELORS_RATE) {
              person.education = Constants.EDUCATION.BACHELORS;
              if (rng() < Variables.GRADUATION_ADULT_MASTERS_RATE) {
                person.education = Constants.EDUCATION.MASTERS;
                if (rng() < Variables.GRADUATION_ADULT_PHD_RATE) {
                  person.education = Constants.EDUCATION.PHD;
                }
              }
            }
          }
        }
      }
      person.resources = drawField(rng, 'resources', ranges, 0, 100);
      person.experience = drawField(
        rng,
        'experience',
        ranges,
        0,
        Math.min(person.age, Variables.EXPERIENCE_CAP) + 1,
      );
      person.intelligence = drawField(rng, 'intelligence', ranges, 1, 11);
      person.constitution = drawField(rng, 'constitution', ranges, 1, 11);
      person.charisma = drawField(rng, 'charisma', ranges, 1, 11);
      person.learningIntent = drawField(rng, 'learningIntent', ranges, 0, 1);
      person.exerciseIntent = drawField(rng, 'exerciseIntent', ranges, 0, 1);
      person.stealingIntent = drawField(rng, 'stealingIntent', ranges, 0, 0.3);
      person.lyingIntent = drawField(rng, 'lyingIntent', ranges, 0, 0.3);
      person.killingIntent = drawField(rng, 'killingIntent', ranges, 0, 0.1);
      person.helpingIntent = drawField(rng, 'helpingIntent', ranges, 0, 0.5);
      this.add(person);
    }

    // Post-seed parent assignment: assign parents to every seeded child. See ARD 052.
    const children = this.living.filter(p => p.age < Variables.RELATIONSHIP_MIN_AGE);
    const potentialParents = this.living.filter(p => p.age >= Variables.RELATIONSHIP_MIN_AGE);
    const familyUnits: Person[][] = [];

    seedShuffle(children, rng);

    for (const child of children) {
      let assignedParents: Person[] | null = null;

      if (familyUnits.length > 0 && rng() < Variables.SEED_SIBLING_REUSE_PROBABILITY) {
        const eligible = familyUnits.filter(parents =>
          parents.every(p => p.age >= child.age + Variables.SEED_MIN_PARENT_AGE_GAP),
        );
        if (eligible.length > 0) {
          assignedParents = eligible[Math.floor(rng() * eligible.length)];
        }
      }

      if (assignedParents === null) {
        const eligible = potentialParents.filter(
          p => p.age >= child.age + Variables.SEED_MIN_PARENT_AGE_GAP,
        );
        const unpartneredEligible = eligible.filter(p => p.isInRelationshipWith === null);
        const twoParent = rng() < Variables.SEED_TWO_PARENT_FRACTION;

        if (twoParent && unpartneredEligible.length >= 2) {
          const pool = [...unpartneredEligible];
          seedShuffle(pool, rng);
          pool[0].isInRelationshipWith = pool[1];
          pool[1].isInRelationshipWith = pool[0];
          assignedParents = [pool[0], pool[1]];
        } else if (eligible.length > 0) {
          const pool = [...eligible];
          seedShuffle(pool, rng);
          assignedParents = [pool[0]];
        }

        if (assignedParents !== null) familyUnits.push(assignedParents);
      }

      if (assignedParents !== null) {
        for (const parent of assignedParents) {
          parent.hasChildren.push(child);
          child.childOf.push(parent);
        }
      }
    }

    // Post-seed adult pairing: pair unpartnered adults until SEED_PAIRING_FRACTION is reached.
    // Sort by age so adjacent pairs are age-proximate, consistent with ARD 054's age-gap preference. See ARD 052, ARD 054.
    const adults = this.living.filter(p => p.age >= Variables.RELATIONSHIP_MIN_AGE);
    const totalAdults = adults.length;
    if (totalAdults > 0) {
      let pairedCount = adults.filter(p => p.isInRelationshipWith !== null).length;
      const unpartnered = adults.filter(p => p.isInRelationshipWith === null);
      unpartnered.sort((a, b) => a.age - b.age);
      let idx = 0;
      while (idx + 1 < unpartnered.length && pairedCount / totalAdults < Variables.SEED_PAIRING_FRACTION) {
        unpartnered[idx].isInRelationshipWith = unpartnered[idx + 1];
        unpartnered[idx + 1].isInRelationshipWith = unpartnered[idx];
        pairedCount += 2;
        idx += 2;
      }
    }
  }

  /**
   * Replenishes naturalResources by `naturalResourceCeiling × NATURAL_RESOURCE_REGEN_FRACTION`,
   * clamped at the ceiling. Couples regen to carrying capacity so ceiling-growth inventions
   * meaningfully unlock new sustainable population. See ARD 043.
   * Call once at the start of each tick before events run.
   */
  regenerate(): void {
    const regen = this.naturalResourceCeiling * Variables.NATURAL_RESOURCE_REGEN_FRACTION;
    this.naturalResources = Math.min(
      this.naturalResources + regen,
      this.naturalResourceCeiling,
    );
  }

  /**
   * Degrades the carrying capacity in proportion to how depleted the pool is: a full pool
   * (no exploitation pressure) causes no loss, an empty pool causes the maximum
   * `CEILING_DEGRADATION_RATE` loss. The ceiling floors at `NATURAL_RESOURCE_CEILING_FLOOR`,
   * and the pool is re-clamped so it can never exceed the reduced ceiling. Because regen is
   * coupled to the ceiling (ARD 043), a falling ceiling drags regeneration down with it, so
   * sustained overexploitation feeds a collapse spiral. Call once per tick before `regenerate()`.
   * See ARD 050.
   */
  degradeCeiling(): void {
    if (this.naturalResourceCeiling <= 0) return;
    const depletion = Math.max(0, 1 - this.naturalResources / this.naturalResourceCeiling);
    const loss = this.naturalResourceCeiling * Variables.CEILING_DEGRADATION_RATE * depletion;
    this.naturalResourceCeiling = Math.max(
      Variables.NATURAL_RESOURCE_CEILING_FLOOR,
      this.naturalResourceCeiling - loss,
    );
    this.naturalResources = Math.min(this.naturalResources, this.naturalResourceCeiling);
  }

  /**
   * Deducts TAX_RATE fraction from each person's resources and adds the proceeds to
   * `communityPool`. Deduction is proportional, so a person at zero resources pays nothing.
   * Call once per tick before gathering events. ARD 034.
   *
   * @param persons - living population to tax
   */
  collectTax(persons: Person[]): void {
    for (const person of persons) {
      const tax = person.resources * Variables.TAX_RATE;
      person.resources -= tax;
      this.communityPool += tax;
    }
  }

  /**
   * Distributes `communityPool * (1 - COMMUNITY_POOL_RESERVE_FRACTION)` equally to eligible
   * persons. Eligible: `resources < WELFARE_THRESHOLD` or orphaned child (`age < 18` with no
   * living parents). If no eligible persons exist, the full pool carries over.
   * Call once per tick after consumption events. ARD 034.
   *
   * @param persons - living population to evaluate for eligibility
   */
  distributeWelfare(persons: Person[]): void {
    const eligible = persons.filter(p =>
      p.resources < Variables.WELFARE_THRESHOLD ||
      (p.age < 18 && p.livingParents.length === 0),
    );
    if (eligible.length === 0) return;
    const distributable = this.communityPool * (1 - Variables.COMMUNITY_POOL_RESERVE_FRACTION);
    const share = distributable / eligible.length;
    this.communityPool -= distributable;
    for (const person of eligible) {
      person.resources += share;
    }
  }

  /**
   * Captures aggregate stats for the current tick, appends to history,
   * resets per-tick accumulators, and returns the snapshot.
   *
   * @returns snapshot for the completed tick
   */
  snapshot(): TickSnapshot {
    const tick = this.history.length;
    const population = this.living.length;

    const resources = this.living.map(p => p.resources);
    const averageResources = mean(resources);
    const resourceGini = gini(resources);
    const averageHappiness = mean(this.living.map(p => p.happiness));
    const averageIllness = mean(this.living.map(p => p.illness));
    const aggregateKillingIntent = this.living.reduce((s, p) => s + p.killingIntent, 0);
    const aggregateStealingIntent = this.living.reduce((s, p) => s + p.stealingIntent, 0);
    const workingAge = this.living.filter(p => p.age >= 18 && p.age <= 65);
    const employmentRate = workingAge.length > 0
      ? workingAge.filter(p => p.hasJob).length / workingAge.length
      : 0;
    const jailedPopulation = this.living.filter(p => p.jailedTicksRemaining > 0).length;
    const ages = this.living.map(p => p.age);
    const averageAge = mean(ages);
    const medianAge = median(ages);
    const educationCounts = new Array<number>(6).fill(0);
    for (const p of this.living) {
      if (p.education >= 0 && p.education < educationCounts.length) {
        educationCounts[p.education] += 1;
      }
    }

    const deaths = this.tickDeathCauses.length;
    const deathsByMurder = this.tickDeathCauses.filter(c => c === Constants.CAUSE_OF_DEATH.MURDER).length;
    const deathsByIllness = this.tickDeathCauses.filter(c => c === Constants.CAUSE_OF_DEATH.ILLNESS).length;
    const deathsByDisaster = this.tickDeathCauses.filter(c => c === Constants.CAUSE_OF_DEATH.DISASTER).length;
    const deathsBySuicide = this.tickDeathCauses.filter(c => c === Constants.CAUSE_OF_DEATH.SUICIDE).length;

    const prev = this.history.length > 0 ? this.history[this.history.length - 1] : null;
    const cumulativeDeaths = (prev?.cumulativeDeaths ?? 0) + deaths;
    const cumulativeDeathsByMurder = (prev?.cumulativeDeathsByMurder ?? 0) + deathsByMurder;
    const cumulativeDeathsByIllness = (prev?.cumulativeDeathsByIllness ?? 0) + deathsByIllness;
    const cumulativeDeathsByDisaster = (prev?.cumulativeDeathsByDisaster ?? 0) + deathsByDisaster;
    const cumulativeDeathsBySuicide = (prev?.cumulativeDeathsBySuicide ?? 0) + deathsBySuicide;

    const births = this.tickBirths;
    const cumulativeBirths = (prev?.cumulativeBirths ?? 0) + births;
    const stealsCommitted = this.tickSteals;

    const partnered = this.living.filter(p => p.isInRelationshipWith !== null);
    const totalCoupleCount = Math.round(partnered.length / 2);
    const fertileCoupleCount = Math.round(
      partnered.filter(p => {
        const partner = p.isInRelationshipWith!;
        const olderAge = Math.max(p.age, partner.age);
        return ageModifier(olderAge, Variables.CHILDBIRTH_PEAK_AGE, Variables.CHILDBIRTH_AGE_SCALE, Variables.CHILDBIRTH_AGE_FLOOR) >= 0.5;
      }).length / 2
    );

    const snap: TickSnapshot = {
      tick,
      population,
      deaths,
      deathsByMurder,
      deathsByIllness,
      deathsByDisaster,
      deathsBySuicide,
      cumulativeDeaths,
      cumulativeDeathsByMurder,
      cumulativeDeathsByIllness,
      cumulativeDeathsByDisaster,
      cumulativeDeathsBySuicide,
      averageResources,
      resourceGini,
      averageHappiness,
      aggregateKillingIntent,
      aggregateStealingIntent,
      naturalResources: this.naturalResources,
      extractionProductivity: this.extractionProductivity,
      naturalResourceCeiling: this.naturalResourceCeiling,
      births,
      cumulativeBirths,
      communityPool: this.communityPool,
      averageIllness,
      employmentRate,
      stealsCommitted,
      jailedPopulation,
      totalCoupleCount,
      fertileCoupleCount,
      averageAge,
      medianAge,
      educationCounts,
    };

    this.history.push(snap);
    this.tickDeathCauses = [];
    this.tickBirths = 0;
    this.tickSteals = 0;
    return snap;
  }
}

/**
 * @param rng - random number source
 * @param min - inclusive minimum
 * @param max - exclusive maximum
 * @returns random integer in [min, max)
 */
function randomInt(rng: RNG, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min));
}

/**
 * Draws a value for a seedable field, applying a type's range override when present.
 * Integer fields use `randomInt`; continuous fields use uniform `[min, max)`.
 * Always consumes exactly one `rng()` call so seed-time determinism is preserved
 * regardless of whether a range override is set.
 *
 * @param rng - random number source
 * @param field - the field being seeded
 * @param ranges - the active type's range overrides (possibly empty)
 * @param defaultMin - default lower bound for this field
 * @param defaultMax - default upper bound for this field (exclusive)
 * @returns drawn value in the effective `[min, max)`
 */
function drawField(
  rng: RNG,
  field: OverridableField,
  ranges: PersonTypeDefinition['ranges'],
  defaultMin: number,
  defaultMax: number,
): number {
  const override = ranges[field];
  const min = override ? override[0] : defaultMin;
  const max = override ? override[1] : defaultMax;
  if (INTEGER_FIELDS.has(field)) {
    return randomInt(rng, min, max);
  }
  return min + rng() * (max - min);
}

/**
 * Builds an assignment array of length `n`: pushes `floor(n * percentage)`
 * entries per declared type, pads with `null` to length `n`, then Fisher-Yates
 * shuffles so type assignment doesn't correlate with iteration order.
 *
 * @param n - population size
 * @param types - declared types
 * @param rng - random number source
 * @returns shuffled assignment array
 */
function buildTypeAssignments(n: number, types: PersonTypes, rng: RNG): (string | null)[] {
  const out: (string | null)[] = [];
  for (const [name, def] of Object.entries(types)) {
    const count = Math.floor(n * def.percentage);
    for (let i = 0; i < count; i++) out.push(name);
  }
  while (out.length < n) out.push(null);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * @param values - numeric values to average
 * @returns arithmetic mean, or 0 if empty
 */
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * @param values - numeric values
 * @returns median value, or 0 if empty
 */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Fisher-Yates in-place shuffle used during population seeding.
 * Kept separate from the LooperSingleton shuffle to avoid coupling modules.
 *
 * @param arr - array to shuffle in place
 * @param rng - seeded random number source
 */
function seedShuffle<T>(arr: T[], rng: RNG): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/**
 * Gini coefficient using the sorted weighted-sum formula.
 * Returns 0 when all values are equal or the array is empty.
 *
 * @param values - numeric values
 * @returns Gini coefficient in [0, 1)
 */
function gini(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const total = sorted.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  const weightedSum = sorted.reduce((sum, x, i) => sum + (i + 1) * x, 0);
  return (2 * weightedSum - (n + 1) * total) / (n * total);
}
