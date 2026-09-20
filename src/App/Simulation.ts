import Person from './Person';
import DeathRecord from '../Records/DeathRecord';
import KillingRecord from '../Records/KillingRecord';
import Constants from '../Helpers/Constants';
import Variables from '../Helpers/Variables';
import { SEED_RANGES, HeritableField, heritableSource } from '../Helpers/TraitRanges';
import { ageModifier } from '../Helpers/AgeModifier';
import { resourceGini } from '../Helpers/Inequality';
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
  /** Gini coefficient of resource distribution over adults (0 = perfect equality, 1 = perfect inequality). ARD 060. */
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
  /** Total resources consumed by the living population this tick (ConsumptionEvent + JailEvent). */
  totalConsumption: number;
  /** Count of living persons by education tier, indexed by Constants.EDUCATION value (length 6). */
  educationCounts: number[];
  /** Living children (age < WORKING_AGE_MIN) at end of tick — denominator for the orphan share. */
  childPopulation: number;
  /** Living children with no living parents at end of tick; same cohort ARD 034 welfare treats as orphaned. */
  orphanCount: number;
  /**
   * Persons eligible for welfare at this tick's `distributeWelfare()` call (ARD 034).
   * Recorded at distribution time, not recomputed at snapshot: the payout itself lifts some
   * recipients back over `WELFARE_THRESHOLD`, so an end-of-tick recount would undercount them.
   * An empty `communityPool` still counts its eligible persons — they qualified and got nothing.
   */
  welfareRecipients: number;
}

export default class Simulation {
  /** Per-tick cache for `traitDistribution`; see that method for why births do not invalidate it. */
  private traitCache: { tick: number; byField: Map<HeritableField, { mean: number; sd: number; n: number }> } | null = null;

  private living: Person[] = [];
  /**
   * Position of each living person in `living`. Maintained by `add` and `kill` so
   * `indexOfLiving` and `getRandomOther` don't scan or copy the population; entries are
   * removed on death, so a lookup miss means "not living" exactly as `indexOf` returning -1 did.
   */
  private livingIndex = new Map<Person, number>();
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
  private tickConsumption = 0;
  private tickWelfareRecipients = 0;

  /**
   * Returns a shallow copy of the living population.
   *
   * @returns living persons
   */
  getLiving(): Person[] {
    return [...this.living];
  }

  /**
   * Adult resource Gini over the living population, computed without `getLiving`'s
   * shallow copy. Identical in value to `resourceGini(getLiving())` — the copy is pure
   * overhead, and `KillEvent` calls this inside the person loop, so at 10^5 persons the
   * copy alone costs O(population^2) per tick.
   *
   * @returns Gini coefficient over adult resources, in [0, 1)
   */
  currentResourceGini(): number {
    return resourceGini(this.living);
  }

  /**
   * Returns a shallow copy of the deceased population (persons retain their
   * age at death and `causeOfDeath`). Used for end-of-run age-mortality reporting.
   *
   * @returns deceased persons
   */
  getDeceased(): Person[] {
    return [...this.deceased];
  }

  /**
   * Index of `person` in the living array, or -1 if not living.
   * Served from `livingIndex`, so callers that only need ordering pay neither
   * getLiving's shallow-copy allocation nor a linear scan.
   *
   * @param person - person to locate
   * @returns index in the living array, or -1 if not present
   */
  indexOfLiving(person: Person): number {
    const index = this.livingIndex.get(person);
    return index === undefined ? -1 : index;
  }

  /**
   * Returns a random living person other than `exclude`, or null if no other living person exists.
   *
   * @param exclude - person to exclude from selection
   * @param rng - random number source
   * @returns a random other living person, or null
   */
  getRandomOther(exclude: Person, rng: RNG): Person | null {
    // Index arithmetic over `living` rather than a filtered copy: the candidate list is
    // `living` minus `exclude` with order preserved, so candidate i is living[i] below the
    // excluded slot and living[i + 1] at or above it. `exclude` is normally living, but a
    // caller holding a dead reference still gets the whole population, as the filter gave.
    // The draw stays behind the emptiness check so an exhausted population consumes no RNG.
    const excludedAt = this.indexOfLiving(exclude);
    const count = this.living.length - (excludedAt >= 0 ? 1 : 0);
    if (count === 0) return null;
    let index = Math.min(Math.floor(rng() * count), count - 1);
    if (excludedAt >= 0 && index >= excludedAt) index++;
    return this.living[index];
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
    // Order-preserving removal, matching the filter this replaces: splice out the slot and
    // slide the index entries behind it down by one. Only the tail is reindexed, so a death
    // costs no allocation and no full-population scan.
    const at = this.indexOfLiving(person);
    if (at >= 0) {
      this.living.splice(at, 1);
      this.livingIndex.delete(person);
      for (let i = at; i < this.living.length; i++) {
        this.livingIndex.set(this.living[i], i);
      }
    }
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
    this.livingIndex.set(person, this.living.length);
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
   * Accumulates resources consumed this tick. Called by ConsumptionEvent and
   * JailEvent with the actual amount deducted from a person's resources.
   *
   * @param amount - resources consumed (>= 0)
   */
  recordConsumption(amount: number): void {
    this.tickConsumption += amount;
  }

  /**
   * Creates `n` persons with stats and intents and adds them to the living population.
   *
   * Default seeding: age is drawn from a young-skewed power taper over
   * `[SEED_AGE_FLOOR, SEED_AGE_MAX)` (ARD 056); resources are 0 for children
   * (`age < WORKING_AGE_MIN`, parentally subsidized) and a compressed band
   * `SEED_ADULT_RESOURCES_MEAN·(1 ± SEED_ADULT_RESOURCES_SPREAD)` for adults (ARD 057);
   * experience is uniform `[0, effective-accumulated-years]`, bounded by the childhood
   * attenuation model so children aren't over-experienced; intelligence/constitution/charisma
   * [1, 10]; learningIntent/exerciseIntent [0, 1); stealingIntent [0, 0.3);
   * killingIntent [0, 0.1); helpingIntent [0, 0.5) — higher ceiling than antisocial
   * intents (ARD 045). After stats are drawn, working-age persons are seeded employed
   * toward `SEED_EMPLOYMENT_RATE`, biased by an employability score (ARD 058).
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
      // Age: young-skewed power taper over [SEED_AGE_FLOOR, SEED_AGE_MAX); a type
      // override falls back to a uniform draw on its declared range. ARD 056.
      const ageOverride = ranges.age;
      if (ageOverride) {
        person.age = randomInt(rng, ageOverride[0], ageOverride[1]);
      } else {
        const u = rng();
        person.age = Math.floor(
          Variables.SEED_AGE_FLOOR +
            (Variables.SEED_AGE_MAX - Variables.SEED_AGE_FLOOR) *
              Math.pow(u, Variables.SEED_AGE_DISTRIBUTION_EXPONENT),
        );
      }
      // Education seeding only applies to persons at or above the relationship minimum age;
      // younger children default to NONE (no schooling yet). Seeded credentials form a
      // coherent ladder: a college student (isWorkingOnEd = BACHELORS) must already hold
      // HIGH_SCHOOL, mirroring the runtime invariant isWorkingOnEd = education + 1.
      if (person.age >= Variables.RELATIONSHIP_MIN_AGE) {
        if (person.age <= Variables.GRADUATION_HS_MAX_AGE) {
          if (rng() < Variables.GRADUATION_HS_SEED_RATE) {
            person.isWorkingOnEd = Constants.EDUCATION.HIGH_SCHOOL;
          }
        } else if (person.age <= Variables.GRADUATION_COLLEGE_MAX_AGE) {
          // 18–24: complete high school first (closes the under-credentialed gap), then
          // conditionally enroll in college so the ladder invariant holds.
          if (rng() < Variables.GRADUATION_ADULT_HS_RATE) {
            person.education = Constants.EDUCATION.HIGH_SCHOOL;
            if (rng() < Variables.GRADUATION_COLLEGE_SEED_RATE) {
              person.isWorkingOnEd = Constants.EDUCATION.BACHELORS;
            }
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
      // Resources: children are parentally subsidized (0, like newborns); adults draw from
      // a compressed band so starting adult Gini reflects the model, not the seed. ARD 057.
      const resourcesOverride = ranges.resources;
      if (resourcesOverride) {
        person.resources = randomInt(rng, resourcesOverride[0], resourcesOverride[1]);
      } else if (person.age < Variables.WORKING_AGE_MIN) {
        person.resources = 0;
      } else {
        const lo = Variables.SEED_ADULT_RESOURCES_MEAN * (1 - Variables.SEED_ADULT_RESOURCES_SPREAD);
        const hi = Variables.SEED_ADULT_RESOURCES_MEAN * (1 + Variables.SEED_ADULT_RESOURCES_SPREAD);
        person.resources = lo + rng() * (hi - lo);
      }
      // Experience: bound by effective accumulated years (childhood years contribute at
      // EXPERIENCE_CHILDHOOD_FACTOR) so a child can't seed with adult-like experience.
      const childhoodExperience = Variables.EXPERIENCE_CHILDHOOD_AGE * Variables.EXPERIENCE_CHILDHOOD_FACTOR;
      const effectiveExperience = person.age < Variables.EXPERIENCE_CHILDHOOD_AGE
        ? person.age * Variables.EXPERIENCE_CHILDHOOD_FACTOR
        : childhoodExperience + (person.age - Variables.EXPERIENCE_CHILDHOOD_AGE);
      person.experience = drawField(
        rng,
        'experience',
        ranges,
        0,
        Math.floor(Math.min(person.age, Variables.EXPERIENCE_CAP, effectiveExperience)) + 1,
      );
      person.intelligence = drawField(rng, 'intelligence', ranges, ...SEED_RANGES.intelligence);
      person.constitution = drawField(rng, 'constitution', ranges, ...SEED_RANGES.constitution);
      person.charisma = drawField(rng, 'charisma', ranges, ...SEED_RANGES.charisma);
      person.learningIntent = drawField(rng, 'learningIntent', ranges, ...SEED_RANGES.learningIntent);
      person.exerciseIntent = drawField(rng, 'exerciseIntent', ranges, ...SEED_RANGES.exerciseIntent);
      person.stealingIntent = drawField(rng, 'stealingIntent', ranges, ...SEED_RANGES.stealingIntent);
      person.killingIntent = drawField(rng, 'killingIntent', ranges, ...SEED_RANGES.killingIntent);
      person.helpingIntent = drawField(rng, 'helpingIntent', ranges, ...SEED_RANGES.helpingIntent);
      // A founder expresses exactly their endowment: nothing has happened to them yet (ARD 066).
      person.intelligenceEndowment = person.intelligence;
      person.constitutionEndowment = person.constitution;
      person.stealingIntentEndowment = person.stealingIntent;
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
          // Pick a random first parent, then their nearest-age co-parent — age-proximate
          // pairing consistent with the adult-pairing pass below and ARD 054.
          const first = pool[0];
          let partner = pool[1];
          let bestGap = Math.abs(partner.age - first.age);
          for (let k = 2; k < pool.length; k++) {
            const gap = Math.abs(pool[k].age - first.age);
            if (gap < bestGap) {
              bestGap = gap;
              partner = pool[k];
            }
          }
          first.isInRelationshipWith = partner;
          partner.isInRelationshipWith = first;
          assignedParents = [first, partner];
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

    // Post-seed employment: employ working-age persons toward SEED_EMPLOYMENT_RATE, ranked by
    // an employability score reusing JobEvent's gain scalars so seed and runtime agree on who
    // is employable. Children and post-working-age persons start unemployed. See ARD 058.
    const workingAge = this.living.filter(
      p => p.age >= Variables.WORKING_AGE_MIN && p.age <= Variables.WORKING_AGE_MAX,
    );
    if (workingAge.length > 0) {
      const scored = workingAge.map(p => ({
        person: p,
        score:
          (p.experience * Variables.JOB_GAIN_EXPERIENCE_SCALAR +
            p.charisma * Variables.JOB_GAIN_CHARISMA_SCALAR) *
            (1 + p.education * Variables.EDUCATION_JOB_GAIN_SCALAR) +
          rng() * Variables.SEED_EMPLOYMENT_SCORE_NOISE,
      }));
      scored.sort((a, b) => b.score - a.score);
      const employCount = Math.round(Variables.SEED_EMPLOYMENT_RATE * workingAge.length);
      for (let k = 0; k < employCount; k++) {
        scored[k].person.hasJob = true;
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
   * Mean and standard deviation of one heritable trait's **endowment** across the living
   * population, with the sample size so the caller can judge whether to trust it (ARD 064, 066).
   *
   * For the three traits a life can change the endowment field is read instead of the expressed
   * value; for the other four the two are the same thing. See `heritableSource`.
   *
   * Cached per tick and deliberately **not** invalidated by births within the tick: every child
   * born in one tick regresses toward the same population state, rather than toward a mean that
   * shifts as its siblings are born. That is both the cheaper option — one O(n) pass per tick
   * instead of one per birth — and the more defensible one, since "the population a child is born
   * into" should not depend on the order births happen to be processed in.
   *
   * @param field - the heritable field to summarise
   * @returns the living population's mean, standard deviation and count for that field
   */
  traitDistribution(field: HeritableField): { mean: number; sd: number; n: number } {
    const tick = this.history.length;
    if (!this.traitCache || this.traitCache.tick !== tick) {
      this.traitCache = { tick, byField: new Map() };
    }
    const cached = this.traitCache.byField.get(field);
    if (cached) return cached;

    const living = this.getLiving();
    const n = living.length;
    // Read the endowment where the trait has one: the expressed value is endowment plus whatever a
    // life has added to it, and regressing newborns toward that ratchets the population (ARD 066).
    const source = heritableSource(field);
    let mean = 0, sd = 0;
    if (n > 0) {
      let sum = 0;
      for (const p of living) sum += p[source];
      mean = sum / n;
      let sq = 0;
      for (const p of living) { const d = p[source] - mean; sq += d * d; }
      // Population standard deviation: this is the whole living population, not a sample of it.
      sd = Math.sqrt(sq / n);
    }
    const stats = { mean, sd, n };
    this.traitCache.byField.set(field, stats);
    return stats;
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
   * Rewrites every living person's `accessMultiplier` for this tick: wealth relative to the adult
   * median, raised to `EXTRACTION_ACCESS_GRADIENT`, clamped, then divided through by the adult
   * mean so the mean multiplier is exactly 1. Normalising is what makes the gradient a pure
   * distribution dial — without it, raising the gradient would raise aggregate extraction
   * capacity and reproduce the extraction lever instead of testing inequality. Children take 1:
   * ARD 060, ARD 024 and ARD 062 all decline to read a child's own resources as their standard of
   * living, and including them would tie the mechanism's strength to the dependency ratio.
   * Call once per tick after taxation and before the agent loop. ARD 068.
   *
   * @param persons - living population to assign multipliers to
   */
  updateAccessMultipliers(persons: Person[]): void {
    const gradient = Variables.EXTRACTION_ACCESS_GRADIENT;
    // Off. Nothing has ever written a multiplier, so every one is still its initial 1 and the
    // sort below is skipped entirely: the tick history stays bitwise identical to the model
    // before ARD 068, which `scripts/parity-check.ts` asserts.
    if (gradient === 0) return;

    const minAge = Variables.WORKING_AGE_MIN;
    // One buffer, used twice: adult wealth to find the median, then raw multipliers by person
    // index. Same Float64Array motive as `Inequality.giniOfBuffer` — this runs every tick next to
    // a Gini path that is already the hottest loop at large populations.
    const buffer = new Float64Array(persons.length);
    let adults = 0;
    for (const person of persons) {
      if (person.age >= minAge) buffer[adults++] = person.resources;
    }
    if (adults === 0) return;

    const wealth = adults === persons.length ? buffer : buffer.subarray(0, adults);
    wealth.sort();
    const mid = adults >> 1;
    const reference = adults % 2 === 0 ? (wealth[mid - 1] + wealth[mid]) / 2 : wealth[mid];

    // A zero median means at least half the adults hold nothing, so there is no scale to measure
    // wealth against. Fall back to neutral rather than dividing by zero, and write it rather than
    // returning early, because last tick's multipliers are still on the persons.
    if (reference <= 0) {
      for (const person of persons) person.accessMultiplier = 1;
      return;
    }

    let rawSum = 0;
    for (let i = 0; i < persons.length; i++) {
      const person = persons[i];
      if (person.age < minAge) continue;
      const raw = Math.min(
        Variables.EXTRACTION_ACCESS_MAX,
        Math.max(Variables.EXTRACTION_ACCESS_MIN, Math.pow(person.resources / reference, gradient)),
      );
      buffer[i] = raw;
      rawSum += raw;
    }

    const meanRaw = rawSum / adults;
    if (!(meanRaw > 0)) {
      for (const person of persons) person.accessMultiplier = 1;
      return;
    }

    for (let i = 0; i < persons.length; i++) {
      const person = persons[i];
      person.accessMultiplier = person.age < minAge ? 1 : buffer[i] / meanRaw;
    }
  }

  /**
   * Tops each recipient up toward `WELFARE_THRESHOLD`, drawing on
   * `communityPool * (1 - COMMUNITY_POOL_RESERVE_FRACTION)`. A recipient is anyone whose
   * resources fall short of the threshold, and nobody receives more than their own shortfall,
   * so welfare cannot lift anyone above it. When the distributable amount covers every
   * shortfall the surplus stays in the pool as a buffer; when it does not, the distributable
   * amount is split in proportion to shortfall. Parentally subsidised children are skipped
   * (ARD 062) — their need is met by topping up their parents. Call once per tick after
   * consumption events. ARD 061, revising ARD 034's equal split.
   *
   * @param persons - living population to evaluate for eligibility
   */
  distributeWelfare(persons: Person[]): void {
    const recipients = persons
      // Skip children a parent already supports: a transfer cannot reach their consumption
      // (ConsumptionEvent charges them a fraction of their own resources, so starvation cannot
      // fire), their happiness (which reads their parents' resources), or the inequality signal
      // (adults only), so it would spend rationed capacity on a number that does nothing until
      // they turn 18. This reuses ConsumptionEvent's own subsidy boundary rather than
      // WORKING_AGE_MIN so the two cannot disagree about who a parent supports — retuning that
      // boundary also retunes who receives welfare. ARD 062.
      .filter(person => !(
        person.age < Variables.CONSUMPTION_CHILD_MAX_AGE && person.livingParents.length > 0
      ))
      .map(person => ({ person, shortfall: Variables.WELFARE_THRESHOLD - person.resources }))
      .filter(r => r.shortfall > 0);
    // Counted before the early returns: a person who qualified and got nothing because the pool
    // was empty is still a recipient for reporting purposes.
    this.tickWelfareRecipients = recipients.length;
    if (recipients.length === 0) return;

    const distributable = this.communityPool * (1 - Variables.COMMUNITY_POOL_RESERVE_FRACTION);
    if (distributable <= 0) return;

    const totalShortfall = recipients.reduce((sum, r) => sum + r.shortfall, 0);
    // Below capacity: pay every shortfall in full and retain the rest. Above capacity: share
    // out what there is, weighted by shortfall, so the deepest need receives the most.
    const payoutRatio = Math.min(1, distributable / totalShortfall);

    for (const { person, shortfall } of recipients) {
      person.resources += shortfall * payoutRatio;
    }
    this.communityPool -= totalShortfall * payoutRatio;
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
    const adultResourceGini = this.currentResourceGini();
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
    // Orphans use the same test as ARD 034 welfare eligibility: a child with no living parent.
    // Children seeded without a parent assignment (ARD 052) count as orphaned from tick 0.
    const children = this.living.filter(p => p.age < Variables.WORKING_AGE_MIN);
    const childPopulation = children.length;
    const orphanCount = children.filter(p => p.livingParents.length === 0).length;

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
    const totalConsumption = this.tickConsumption;
    const welfareRecipients = this.tickWelfareRecipients;

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
      resourceGini: adultResourceGini,
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
      totalConsumption,
      educationCounts,
      childPopulation,
      orphanCount,
      welfareRecipients,
    };

    this.history.push(snap);
    this.tickDeathCauses = [];
    this.tickBirths = 0;
    this.tickSteals = 0;
    this.tickConsumption = 0;
    this.tickWelfareRecipients = 0;
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

