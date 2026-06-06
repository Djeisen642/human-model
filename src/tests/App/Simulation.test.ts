import Simulation from '../../App/Simulation';
import Person from '../../App/Person';
import Constants from '../../Helpers/Constants';
import Variables from '../../Helpers/Variables';
import SeededRandom from '../../Helpers/SeededRandom';

const alwaysFirst: () => number = () => 0;

describe('Simulation', () => {
  describe('add / getLiving', () => {
    it('should start with no living persons', () => {
      const sim = new Simulation();
      expect(sim.getLiving()).toHaveLength(0);
    });

    it('should add persons to the living population', () => {
      const sim = new Simulation();
      const p = new Person([]);
      sim.add(p);
      expect(sim.getLiving()).toHaveLength(1);
      expect(sim.getLiving()).toContain(p);
    });

    it('getLiving should return a copy, not the internal array', () => {
      const sim = new Simulation();
      sim.add(new Person([]));
      const copy = sim.getLiving();
      copy.push(new Person([]));
      expect(sim.getLiving()).toHaveLength(1);
    });
  });

  describe('getRandomOther', () => {
    it('should return null when no other person exists', () => {
      const sim = new Simulation();
      const p = new Person([]);
      sim.add(p);
      expect(sim.getRandomOther(p, alwaysFirst)).toBeNull();
    });

    it('should never return the excluded person', () => {
      const sim = new Simulation();
      const p1 = new Person([]);
      const p2 = new Person([]);
      const p3 = new Person([]);
      sim.add(p1);
      sim.add(p2);
      sim.add(p3);
      for (let i = 0; i < 20; i++) {
        expect(sim.getRandomOther(p1, Math.random)).not.toBe(p1);
      }
    });

    it('should return the only other person when one candidate exists', () => {
      const sim = new Simulation();
      const p1 = new Person([]);
      const p2 = new Person([]);
      sim.add(p1);
      sim.add(p2);
      expect(sim.getRandomOther(p1, alwaysFirst)).toBe(p2);
    });
  });

  describe('kill', () => {
    it('should move the person from living to deceased', () => {
      const sim = new Simulation();
      const p = new Person([]);
      sim.add(p);
      sim.kill(p, Constants.CAUSE_OF_DEATH.ILLNESS);
      expect(sim.getLiving()).not.toContain(p);
    });

    it('should set causeOfDeath on the victim', () => {
      const sim = new Simulation();
      const p = new Person([]);
      sim.add(p);
      sim.kill(p, Constants.CAUSE_OF_DEATH.ILLNESS);
      expect(p.causeOfDeath).not.toBeNull();
      expect(p.causeOfDeath?.cause).toBe(Constants.CAUSE_OF_DEATH.ILLNESS);
    });

    it('should add a KillingRecord to the killer on murder', () => {
      const sim = new Simulation();
      const killer = new Person([]);
      const victim = new Person([]);
      sim.add(killer);
      sim.add(victim);
      sim.kill(victim, Constants.CAUSE_OF_DEATH.MURDER, killer);
      expect(killer.killed.has(victim)).toBe(true);
      expect(killer.killed.get(victim)?.person).toBe(victim);
    });

    it('should clear the surviving partner\'s isInRelationshipWith when a partnered person is killed', () => {
      const sim = new Simulation();
      const person = new Person([]);
      const partner = new Person([]);
      person.isInRelationshipWith = partner;
      partner.isInRelationshipWith = person;
      sim.add(person);
      sim.add(partner);

      sim.kill(person, Constants.CAUSE_OF_DEATH.ILLNESS);

      expect(partner.isInRelationshipWith).toBeNull();
      expect(person.isInRelationshipWith).toBeNull();
    });

    it('should record the death cause for snapshot', () => {
      const sim = new Simulation();
      const p1 = new Person([]);
      const p2 = new Person([]);
      sim.add(p1);
      sim.add(p2);
      sim.kill(p1, Constants.CAUSE_OF_DEATH.MURDER);
      sim.kill(p2, Constants.CAUSE_OF_DEATH.ILLNESS);
      const snap = sim.snapshot();
      expect(snap.deaths).toBe(2);
      expect(snap.deathsByMurder).toBe(1);
      expect(snap.deathsByIllness).toBe(1);
    });
  });

  describe('estate split on death (ARD 042)', () => {
    it('partner + children: applies the three-way split', () => {
      const sim = new Simulation();
      const decedent = new Person([]);
      const partner = new Person([]);
      const child1 = new Person([]);
      const child2 = new Person([]);
      decedent.resources = 100;
      decedent.isInRelationshipWith = partner;
      partner.isInRelationshipWith = decedent;
      decedent.hasChildren.push(child1, child2);
      sim.add(decedent);
      sim.add(partner);
      sim.add(child1);
      sim.add(child2);

      sim.kill(decedent, Constants.CAUSE_OF_DEATH.ILLNESS);

      expect(sim.communityPool).toBeCloseTo(100 * Variables.ESTATE_COMMUNITY_SHARE);
      expect(partner.resources).toBeCloseTo(100 * Variables.ESTATE_PARTNER_SHARE);
      expect(child1.resources).toBeCloseTo((100 * Variables.ESTATE_CHILDREN_SHARE) / 2);
      expect(child2.resources).toBeCloseTo((100 * Variables.ESTATE_CHILDREN_SHARE) / 2);
      expect(decedent.resources).toBe(0);
    });

    it('partner only: partner absorbs the children share', () => {
      const sim = new Simulation();
      const decedent = new Person([]);
      const partner = new Person([]);
      decedent.resources = 100;
      decedent.isInRelationshipWith = partner;
      partner.isInRelationshipWith = decedent;
      sim.add(decedent);
      sim.add(partner);

      sim.kill(decedent, Constants.CAUSE_OF_DEATH.ILLNESS);

      expect(partner.resources).toBeCloseTo(100 * (Variables.ESTATE_PARTNER_SHARE + Variables.ESTATE_CHILDREN_SHARE));
      expect(sim.communityPool).toBeCloseTo(100 * Variables.ESTATE_COMMUNITY_SHARE);
    });

    it('children only: children equally split the partner + children shares', () => {
      const sim = new Simulation();
      const decedent = new Person([]);
      const child1 = new Person([]);
      const child2 = new Person([]);
      decedent.resources = 100;
      decedent.hasChildren.push(child1, child2);
      sim.add(decedent);
      sim.add(child1);
      sim.add(child2);

      sim.kill(decedent, Constants.CAUSE_OF_DEATH.ILLNESS);

      const expectedPerChild = (100 * (Variables.ESTATE_PARTNER_SHARE + Variables.ESTATE_CHILDREN_SHARE)) / 2;
      expect(child1.resources).toBeCloseTo(expectedPerChild);
      expect(child2.resources).toBeCloseTo(expectedPerChild);
      expect(sim.communityPool).toBeCloseTo(100 * Variables.ESTATE_COMMUNITY_SHARE);
    });

    it('deceased children are excluded from inheritance', () => {
      const sim = new Simulation();
      const decedent = new Person([]);
      const livingChild = new Person([]);
      const deadChild = new Person([]);
      decedent.resources = 100;
      decedent.hasChildren.push(livingChild, deadChild);
      sim.add(decedent);
      sim.add(livingChild);
      sim.add(deadChild);
      sim.kill(deadChild, Constants.CAUSE_OF_DEATH.ILLNESS);
      const poolAfterDeadChild = sim.communityPool;

      sim.kill(decedent, Constants.CAUSE_OF_DEATH.ILLNESS);

      const expectedForLivingChild = 100 * (Variables.ESTATE_PARTNER_SHARE + Variables.ESTATE_CHILDREN_SHARE);
      expect(livingChild.resources).toBeCloseTo(expectedForLivingChild);
      expect(sim.communityPool).toBeCloseTo(poolAfterDeadChild + 100 * Variables.ESTATE_COMMUNITY_SHARE);
    });

    it('no heirs: 100% to community pool', () => {
      const sim = new Simulation();
      const decedent = new Person([]);
      decedent.resources = 100;
      sim.add(decedent);

      sim.kill(decedent, Constants.CAUSE_OF_DEATH.ILLNESS);

      expect(sim.communityPool).toBeCloseTo(100);
      expect(decedent.resources).toBe(0);
    });

    it('zero-resource estate: no-op (no changes to heirs or pool)', () => {
      const sim = new Simulation();
      const decedent = new Person([]);
      const partner = new Person([]);
      decedent.resources = 0;
      partner.resources = 50;
      decedent.isInRelationshipWith = partner;
      partner.isInRelationshipWith = decedent;
      sim.add(decedent);
      sim.add(partner);

      sim.kill(decedent, Constants.CAUSE_OF_DEATH.ILLNESS);

      expect(partner.resources).toBe(50);
      expect(sim.communityPool).toBe(0);
    });

    it('murder: killer receives nothing from victim estate', () => {
      const sim = new Simulation();
      const killer = new Person([]);
      const victim = new Person([]);
      victim.resources = 100;
      killer.resources = 10;
      sim.add(killer);
      sim.add(victim);

      sim.kill(victim, Constants.CAUSE_OF_DEATH.MURDER, killer);

      expect(killer.resources).toBe(10);
      expect(sim.communityPool).toBeCloseTo(100);
    });

    it('estate constants sum to 1.0', () => {
      const sum = Variables.ESTATE_COMMUNITY_SHARE + Variables.ESTATE_PARTNER_SHARE + Variables.ESTATE_CHILDREN_SHARE;
      expect(sum).toBeCloseTo(1.0);
    });
  });

  describe('snapshot', () => {
    it('should append to history each call', () => {
      const sim = new Simulation();
      sim.snapshot();
      sim.snapshot();
      expect(sim.history).toHaveLength(2);
    });

    it('should increment tick each call', () => {
      const sim = new Simulation();
      const s0 = sim.snapshot();
      const s1 = sim.snapshot();
      expect(s0.tick).toBe(0);
      expect(s1.tick).toBe(1);
    });

    it('should reset death counts after snapshot', () => {
      const sim = new Simulation();
      const p = new Person([]);
      sim.add(p);
      sim.kill(p, Constants.CAUSE_OF_DEATH.DISASTER);
      sim.snapshot();
      const s2 = sim.snapshot();
      expect(s2.deaths).toBe(0);
    });

    it('should compute averageResources correctly', () => {
      const sim = new Simulation();
      const p1 = new Person([]);
      p1.resources = 10;
      const p2 = new Person([]);
      p2.resources = 20;
      sim.add(p1);
      sim.add(p2);
      const snap = sim.snapshot();
      expect(snap.averageResources).toBe(15);
    });

    it('should compute resourceGini of 0 for equal resources', () => {
      const sim = new Simulation();
      [10, 10, 10].forEach(r => {
        const p = new Person([]);
        p.resources = r;
        sim.add(p);
      });
      expect(sim.snapshot().resourceGini).toBeCloseTo(0);
    });

    it('should compute a positive resourceGini for unequal resources', () => {
      const sim = new Simulation();
      [0, 0, 100].forEach(r => {
        const p = new Person([]);
        p.resources = r;
        sim.add(p);
      });
      expect(sim.snapshot().resourceGini).toBeGreaterThan(0);
    });

    it('should report population 0 and gini 0 with no living persons', () => {
      const sim = new Simulation();
      const snap = sim.snapshot();
      expect(snap.population).toBe(0);
      expect(snap.resourceGini).toBe(0);
      expect(snap.averageResources).toBe(0);
    });
  });

  describe('seed', () => {
    it('should add exactly n persons', () => {
      const sim = new Simulation();
      sim.seed(10, alwaysFirst);
      expect(sim.getLiving()).toHaveLength(10);
    });

    it('should add 0 persons when n is 0', () => {
      const sim = new Simulation();
      sim.seed(0, alwaysFirst);
      expect(sim.getLiving()).toHaveLength(0);
    });

    it('should produce deterministic results for the same seed', () => {
      const sim1 = new Simulation();
      const sim2 = new Simulation();
      sim1.seed(5, new SeededRandom(42).asRNG());
      sim2.seed(5, new SeededRandom(42).asRNG());
      sim1.getLiving().forEach((p, i) => {
        const q = sim2.getLiving()[i];
        expect(p.age).toBe(q.age);
        expect(p.resources).toBe(q.resources);
        expect(p.intelligence).toBe(q.intelligence);
      });
    });

    it('age should be in [SEED_AGE_FLOOR, 50)', () => {
      const sim = new Simulation();
      sim.seed(50, Math.random);
      sim.getLiving().forEach(p => {
        expect(p.age).toBeGreaterThanOrEqual(Variables.SEED_AGE_FLOOR);
        expect(p.age).toBeLessThan(50);
      });
    });

    it('resources should be in [0, 100)', () => {
      const sim = new Simulation();
      sim.seed(50, Math.random);
      sim.getLiving().forEach(p => {
        expect(p.resources).toBeGreaterThanOrEqual(0);
        expect(p.resources).toBeLessThan(100);
      });
    });

    it('intelligence, constitution, charisma should be in [1, 10]', () => {
      const sim = new Simulation();
      sim.seed(50, Math.random);
      sim.getLiving().forEach(p => {
        expect(p.intelligence).toBeGreaterThanOrEqual(1);
        expect(p.intelligence).toBeLessThanOrEqual(10);
        expect(p.constitution).toBeGreaterThanOrEqual(1);
        expect(p.constitution).toBeLessThanOrEqual(10);
        expect(p.charisma).toBeGreaterThanOrEqual(1);
        expect(p.charisma).toBeLessThanOrEqual(10);
      });
    });

    it('experience should be in [0, age]', () => {
      const sim = new Simulation();
      sim.seed(50, Math.random);
      sim.getLiving().forEach(p => {
        expect(p.experience).toBeGreaterThanOrEqual(0);
        expect(p.experience).toBeLessThanOrEqual(p.age);
      });
    });

    it('killingIntent should be in [0, 0.1)', () => {
      const sim = new Simulation();
      sim.seed(50, Math.random);
      sim.getLiving().forEach(p => {
        expect(p.killingIntent).toBeGreaterThanOrEqual(0);
        expect(p.killingIntent).toBeLessThan(0.1);
      });
    });

    it('stealingIntent and lyingIntent should be in [0, 0.3)', () => {
      const sim = new Simulation();
      sim.seed(50, Math.random);
      sim.getLiving().forEach(p => {
        expect(p.stealingIntent).toBeGreaterThanOrEqual(0);
        expect(p.stealingIntent).toBeLessThan(0.3);
        expect(p.lyingIntent).toBeGreaterThanOrEqual(0);
        expect(p.lyingIntent).toBeLessThan(0.3);
      });
    });

    it('minimum age with rng always 0 should be SEED_AGE_FLOOR', () => {
      const sim = new Simulation();
      sim.seed(1, alwaysFirst);
      expect(sim.getLiving()[0].age).toBe(Variables.SEED_AGE_FLOOR);
    });

    it('persons aged >= RELATIONSHIP_MIN_AGE and <= GRADUATION_HS_MAX_AGE get HS enrollment seeding', () => {
      // Seed many persons and verify those in HS age range get at most HS enrollment (never BACHELORS+)
      const sim = new Simulation();
      sim.seed(200, Math.random);
      sim.getLiving()
        .filter(p => p.age >= Variables.RELATIONSHIP_MIN_AGE && p.age <= Variables.GRADUATION_HS_MAX_AGE)
        .forEach(p => {
          expect(p.isWorkingOnEd).not.toBe(Constants.EDUCATION.BACHELORS);
          expect(p.isWorkingOnEd).not.toBe(Constants.EDUCATION.MASTERS);
          expect(p.isWorkingOnEd).not.toBe(Constants.EDUCATION.PHD);
        });
    });

    it('persons below RELATIONSHIP_MIN_AGE have no education seeding', () => {
      const sim = new Simulation();
      sim.seed(200, Math.random);
      sim.getLiving()
        .filter(p => p.age < Variables.RELATIONSHIP_MIN_AGE)
        .forEach(p => {
          expect(p.education).toBe(Constants.EDUCATION.NONE);
          expect(p.isWorkingOnEd).toBe(Constants.EDUCATION.NONE);
        });
    });

    it('persons aged > GRADUATION_COLLEGE_MAX_AGE always have isWorkingOnEd = NONE', () => {
      const sim = new Simulation();
      sim.seed(200, Math.random);
      sim.getLiving()
        .filter(p => p.age > Variables.GRADUATION_COLLEGE_MAX_AGE)
        .forEach(p => {
          expect(p.isWorkingOnEd).toBe(Constants.EDUCATION.NONE);
        });
    });

    it('most persons aged > GRADUATION_COLLEGE_MAX_AGE have non-NONE education', () => {
      const sim = new Simulation();
      sim.seed(500, new SeededRandom(99).asRNG());
      const adults = sim.getLiving().filter(p => p.age > Variables.GRADUATION_COLLEGE_MAX_AGE);
      const educated = adults.filter(p => p.education !== Constants.EDUCATION.NONE);
      expect(educated.length).toBeGreaterThan(adults.length * 0.5);
    });

    it('persons aged > GRADUATION_COLLEGE_MAX_AGE only have valid completed education levels', () => {
      const sim = new Simulation();
      sim.seed(500, new SeededRandom(99).asRNG());
      const validLevels = [
        Constants.EDUCATION.NONE,
        Constants.EDUCATION.HIGH_SCHOOL,
        Constants.EDUCATION.BACHELORS,
        Constants.EDUCATION.MASTERS,
        Constants.EDUCATION.PHD,
      ];
      sim.getLiving()
        .filter(p => p.age > Variables.GRADUATION_COLLEGE_MAX_AGE)
        .forEach(p => {
          expect(validLevels).toContain(p.education);
        });
    });

    it('persons aged <= GRADUATION_HS_MAX_AGE are never seeded with BACHELORS enrollment', () => {
      const sim = new Simulation();
      sim.seed(200, Math.random);
      sim.getLiving()
        .filter(p => p.age <= Variables.GRADUATION_HS_MAX_AGE)
        .forEach(p => {
          expect(p.isWorkingOnEd).not.toBe(Constants.EDUCATION.BACHELORS);
        });
    });

    it('persons aged 18–GRADUATION_COLLEGE_MAX_AGE are never seeded with HIGH_SCHOOL enrollment', () => {
      const sim = new Simulation();
      sim.seed(200, Math.random);
      sim.getLiving()
        .filter(p => p.age > Variables.GRADUATION_HS_MAX_AGE && p.age <= Variables.GRADUATION_COLLEGE_MAX_AGE)
        .forEach(p => {
          expect(p.isWorkingOnEd).not.toBe(Constants.EDUCATION.HIGH_SCHOOL);
        });
    });

    it('seeded adults are paired at approximately SEED_PAIRING_FRACTION (ARD 052)', () => {
      const sim = new Simulation();
      sim.seed(100, new SeededRandom(42).asRNG());
      const adults = sim.getLiving().filter(p => p.age >= Variables.RELATIONSHIP_MIN_AGE);
      const paired = adults.filter(p => p.isInRelationshipWith !== null).length;
      const fraction = adults.length > 0 ? paired / adults.length : 0;
      expect(fraction).toBeGreaterThanOrEqual(Variables.SEED_PAIRING_FRACTION - 0.05);
    });

    it('seeded children below RELATIONSHIP_MIN_AGE have at least one parent when eligible adults exist (ARD 052)', () => {
      const sim = new Simulation();
      sim.seed(100, new SeededRandom(42).asRNG());
      const children = sim.getLiving().filter(p => p.age < Variables.RELATIONSHIP_MIN_AGE);
      children.forEach(child => {
        expect(child.childOf.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('seeded children are not in a relationship (ARD 052)', () => {
      const sim = new Simulation();
      sim.seed(100, new SeededRandom(42).asRNG());
      sim.getLiving()
        .filter(p => p.age < Variables.RELATIONSHIP_MIN_AGE)
        .forEach(child => {
          expect(child.isInRelationshipWith).toBeNull();
        });
    });

    it('assigned parents have the child in their hasChildren array (ARD 052)', () => {
      const sim = new Simulation();
      sim.seed(100, new SeededRandom(42).asRNG());
      sim.getLiving()
        .filter(p => p.age < Variables.RELATIONSHIP_MIN_AGE)
        .forEach(child => {
          child.childOf.forEach(parent => {
            expect(parent.hasChildren).toContain(child);
          });
        });
    });
  });

  describe('seed with personTypes (ARD 030)', () => {
    it('passes through with empty personTypes (no behavior change)', () => {
      const sim1 = new Simulation();
      const sim2 = new Simulation();
      sim1.seed(20, new SeededRandom(123).asRNG());
      sim2.seed(20, new SeededRandom(123).asRNG(), {});
      expect(sim1.getLiving()).toHaveLength(20);
      expect(sim2.getLiving()).toHaveLength(20);
      sim1.getLiving().forEach((p, i) => {
        const q = sim2.getLiving()[i];
        expect(p.intelligence).toBe(q.intelligence);
        expect(p.age).toBe(q.age);
      });
    });

    it('assigns exactly floor(n * percentage) persons per type', () => {
      const sim = new Simulation();
      sim.seed(100, new SeededRandom(7).asRNG(), {
        engineer: { percentage: 0.3, ranges: { intelligence: [7, 11] } },
        criminal: { percentage: 0.1, ranges: { killingIntent: [0.5, 1.0] } },
      });
      expect(sim.seededTypeCounts.engineer).toBe(30);
      expect(sim.seededTypeCounts.criminal).toBe(10);
    });

    it('seeded engineers all fall inside the override range', () => {
      const sim = new Simulation();
      sim.seed(100, new SeededRandom(11).asRNG(), {
        engineer: { percentage: 0.5, ranges: { intelligence: [7, 11] } },
      });
      const engineers = sim.getLiving().filter(p => p.intelligence >= 7 && p.intelligence < 11);
      expect(engineers.length).toBeGreaterThanOrEqual(50);
    });

    it('untyped remainder uses default ranges (not the type override)', () => {
      const sim = new Simulation();
      sim.seed(100, new SeededRandom(13).asRNG(), {
        engineer: { percentage: 0.3, ranges: { intelligence: [10, 11] } },
      });
      // 30 engineers all have intelligence === 10. The other 70 should span [1, 10].
      const lowIntelligence = sim.getLiving().filter(p => p.intelligence < 7);
      expect(lowIntelligence.length).toBeGreaterThan(0);
    });

    it('same seed produces same type assignment', () => {
      const types = {
        engineer: { percentage: 0.2, ranges: { intelligence: [7, 11] as [number, number] } },
        criminal: { percentage: 0.2, ranges: { killingIntent: [0.5, 1.0] as [number, number] } },
      };
      const sim1 = new Simulation();
      const sim2 = new Simulation();
      sim1.seed(50, new SeededRandom(99).asRNG(), types);
      sim2.seed(50, new SeededRandom(99).asRNG(), types);
      const stats1 = sim1.getLiving().map(p => `${p.intelligence}/${p.killingIntent.toFixed(4)}`);
      const stats2 = sim2.getLiving().map(p => `${p.intelligence}/${p.killingIntent.toFixed(4)}`);
      expect(stats1).toEqual(stats2);
    });

    it('respects continuous-field override ranges', () => {
      const sim = new Simulation();
      sim.seed(100, new SeededRandom(17).asRNG(), {
        violent: { percentage: 0.4, ranges: { killingIntent: [0.5, 1.0] } },
      });
      const violent = sim.getLiving().filter(p => p.killingIntent >= 0.5 && p.killingIntent < 1.0);
      expect(violent.length).toBeGreaterThanOrEqual(40);
    });

    it('seededTypeCounts is empty when no types supplied', () => {
      const sim = new Simulation();
      sim.seed(10, new SeededRandom(1).asRNG());
      expect(sim.seededTypeCounts).toEqual({});
    });

    it('a type with empty ranges still allocates the quota', () => {
      const sim = new Simulation();
      sim.seed(50, new SeededRandom(3).asRNG(), {
        anyone: { percentage: 0.4, ranges: {} },
      });
      expect(sim.seededTypeCounts.anyone).toBe(20);
    });

    it('floor truncation: percentage 0.07 over n=10 yields 0', () => {
      const sim = new Simulation();
      sim.seed(10, new SeededRandom(5).asRNG(), {
        rare: { percentage: 0.07, ranges: { intelligence: [10, 11] } },
      });
      expect(sim.seededTypeCounts.rare).toBe(0);
    });

    it('override stays out of default domain when configured to', () => {
      const sim = new Simulation();
      sim.seed(50, new SeededRandom(31).asRNG(), {
        odd: { percentage: 1.0, ranges: { intelligence: [50, 60] } },
      });
      sim.getLiving().forEach(p => {
        expect(p.intelligence).toBeGreaterThanOrEqual(50);
        expect(p.intelligence).toBeLessThan(60);
      });
    });
  });

  describe('resource pool', () => {
    it('should initialize naturalResources to NATURAL_RESOURCES_INITIAL (ARD 044)', () => {
      const sim = new Simulation();
      expect(sim.naturalResources).toBe(Variables.NATURAL_RESOURCES_INITIAL);
    });

    it('NATURAL_RESOURCES_INITIAL defaults to NATURAL_RESOURCE_CEILING_INITIAL for back-compat', () => {
      expect(Variables.NATURAL_RESOURCES_INITIAL).toBe(Variables.NATURAL_RESOURCE_CEILING_INITIAL);
    });

    it('should initialize naturalResourceCeiling to NATURAL_RESOURCE_CEILING_INITIAL', () => {
      const sim = new Simulation();
      expect(sim.naturalResourceCeiling).toBe(Variables.NATURAL_RESOURCE_CEILING_INITIAL);
    });

    it('should initialize extractionProductivity to 1.0', () => {
      const sim = new Simulation();
      expect(sim.extractionProductivity).toBe(1.0);
    });

    it('regenerate should increase naturalResources by ceiling × NATURAL_RESOURCE_REGEN_FRACTION (ARD 043)', () => {
      const sim = new Simulation();
      sim.naturalResources = 100;
      const expectedRegen = sim.naturalResourceCeiling * Variables.NATURAL_RESOURCE_REGEN_FRACTION;
      sim.regenerate();
      expect(sim.naturalResources).toBeCloseTo(100 + expectedRegen);
    });

    it('regenerate scales with the current ceiling', () => {
      const small = new Simulation();
      small.naturalResourceCeiling = 1000;
      small.naturalResources = 0;
      small.regenerate();

      const large = new Simulation();
      large.naturalResourceCeiling = 10000;
      large.naturalResources = 0;
      large.regenerate();

      expect(large.naturalResources).toBeCloseTo(small.naturalResources * 10);
    });

    it('regenerate produces zero when ceiling is zero', () => {
      const sim = new Simulation();
      sim.naturalResourceCeiling = 0;
      sim.naturalResources = 0;
      sim.regenerate();
      expect(sim.naturalResources).toBe(0);
    });

    it('regenerate should not exceed naturalResourceCeiling', () => {
      const sim = new Simulation();
      sim.naturalResources = sim.naturalResourceCeiling - 1;
      sim.regenerate();
      expect(sim.naturalResources).toBe(sim.naturalResourceCeiling);
    });

    it('regenerate should leave naturalResources at ceiling when already full', () => {
      const sim = new Simulation();
      sim.regenerate();
      expect(sim.naturalResources).toBe(sim.naturalResourceCeiling);
    });

    it('degradeCeiling does not erode a full pool (ARD 050)', () => {
      const sim = new Simulation();
      sim.naturalResourceCeiling = 10000;
      sim.naturalResources = 10000; // full → depletion 0
      sim.degradeCeiling();
      expect(sim.naturalResourceCeiling).toBe(10000);
    });

    it('degradeCeiling erodes the ceiling in proportion to pool depletion (ARD 050)', () => {
      const sim = new Simulation();
      sim.naturalResourceCeiling = 10000;
      sim.naturalResources = 0; // fully depleted → depletion 1
      sim.degradeCeiling();
      const expected = 10000 - 10000 * Variables.CEILING_DEGRADATION_RATE * 1;
      expect(sim.naturalResourceCeiling).toBeCloseTo(expected);
    });

    it('degradeCeiling erodes faster the more depleted the pool (ARD 050)', () => {
      const light = new Simulation();
      light.naturalResourceCeiling = 10000;
      light.naturalResources = 7500; // depletion 0.25
      light.degradeCeiling();

      const heavy = new Simulation();
      heavy.naturalResourceCeiling = 10000;
      heavy.naturalResources = 2500; // depletion 0.75
      heavy.degradeCeiling();

      const lightLoss = 10000 - light.naturalResourceCeiling;
      const heavyLoss = 10000 - heavy.naturalResourceCeiling;
      expect(heavyLoss).toBeGreaterThan(lightLoss);
    });

    it('degradeCeiling floors the ceiling at NATURAL_RESOURCE_CEILING_FLOOR (ARD 050)', () => {
      const sim = new Simulation();
      sim.naturalResourceCeiling = Variables.NATURAL_RESOURCE_CEILING_FLOOR;
      sim.naturalResources = 0; // maximally depleted
      sim.degradeCeiling();
      expect(sim.naturalResourceCeiling).toBe(Variables.NATURAL_RESOURCE_CEILING_FLOOR);
    });

    it('degradeCeiling re-clamps the pool so it never exceeds the ceiling (ARD 050)', () => {
      const sim = new Simulation();
      sim.naturalResourceCeiling = 3000;
      sim.naturalResources = 5000; // inconsistent state: pool above ceiling
      sim.degradeCeiling();
      expect(sim.naturalResources).toBeLessThanOrEqual(sim.naturalResourceCeiling);
    });

    it('snapshot should include naturalResources', () => {
      const sim = new Simulation();
      sim.naturalResources = 5_000;
      const snap = sim.snapshot();
      expect(snap.naturalResources).toBe(5_000);
    });

    it('snapshot naturalResources reflects post-extraction state', () => {
      const sim = new Simulation();
      sim.naturalResources = 3_000;
      const snap = sim.snapshot();
      expect(snap.naturalResources).toBe(3_000);
    });

    it('snapshot captures extractionProductivity and naturalResourceCeiling (ARD 032)', () => {
      const sim = new Simulation();
      sim.extractionProductivity = 0.65;
      sim.naturalResourceCeiling = 5_500;
      const snap = sim.snapshot();
      expect(snap.extractionProductivity).toBe(0.65);
      expect(snap.naturalResourceCeiling).toBe(5_500);
    });

    it('invention counters initialize to 0 (ARD 032)', () => {
      const sim = new Simulation();
      expect(sim.inventionFasterCount).toBe(0);
      expect(sim.inventionSlowerCount).toBe(0);
      expect(sim.inventionCeilingCount).toBe(0);
    });
  });

  describe('recordBirth (ARD 033)', () => {
    it('snapshot captures births and cumulativeBirths from recordBirth calls', () => {
      const sim = new Simulation();
      sim.recordBirth();
      sim.recordBirth();
      const snap1 = sim.snapshot();
      expect(snap1.births).toBe(2);
      expect(snap1.cumulativeBirths).toBe(2);

      sim.recordBirth();
      const snap2 = sim.snapshot();
      expect(snap2.births).toBe(1);
      expect(snap2.cumulativeBirths).toBe(3);
    });

    it('snapshot resets tick births to 0 between snapshots', () => {
      const sim = new Simulation();
      sim.recordBirth();
      sim.snapshot();
      const snap = sim.snapshot();
      expect(snap.births).toBe(0);
    });

    it('seed does not increment births', () => {
      const sim = new Simulation();
      sim.seed(10, alwaysFirst);
      const snap = sim.snapshot();
      expect(snap.births).toBe(0);
      expect(snap.cumulativeBirths).toBe(0);
    });
  });

  describe('collectTax (ARD 034)', () => {
    it('deducts TAX_RATE fraction from each person and adds to communityPool', () => {
      const sim = new Simulation();
      const p1 = new Person([]);
      p1.resources = 100;
      const p2 = new Person([]);
      p2.resources = 50;
      sim.add(p1);
      sim.add(p2);
      sim.collectTax([p1, p2]);
      const expectedTax = 100 * Variables.TAX_RATE + 50 * Variables.TAX_RATE;
      expect(sim.communityPool).toBeCloseTo(expectedTax);
      expect(p1.resources).toBeCloseTo(100 * (1 - Variables.TAX_RATE));
      expect(p2.resources).toBeCloseTo(50 * (1 - Variables.TAX_RATE));
    });

    it('person with zero resources pays zero tax', () => {
      const sim = new Simulation();
      const p = new Person([]);
      p.resources = 0;
      sim.add(p);
      sim.collectTax([p]);
      expect(p.resources).toBe(0);
      expect(sim.communityPool).toBe(0);
    });

    it('accumulates tax across multiple ticks', () => {
      const sim = new Simulation();
      const p = new Person([]);
      p.resources = 100;
      sim.add(p);
      sim.collectTax([p]);
      const afterFirst = sim.communityPool;
      sim.collectTax([p]);
      expect(sim.communityPool).toBeGreaterThan(afterFirst);
    });

    it('snapshot captures communityPool', () => {
      const sim = new Simulation();
      const p = new Person([]);
      p.resources = 100;
      sim.add(p);
      sim.collectTax([p]);
      const snap = sim.snapshot();
      expect(snap.communityPool).toBeCloseTo(100 * Variables.TAX_RATE);
    });
  });

  describe('distributeWelfare (ARD 034)', () => {
    it('distributes to persons below WELFARE_THRESHOLD', () => {
      const sim = new Simulation();
      sim.communityPool = 100;
      const poor = new Person([]);
      poor.age = 30;
      poor.resources = Variables.WELFARE_THRESHOLD - 1;
      const rich = new Person([]);
      rich.age = 30;
      rich.resources = Variables.WELFARE_THRESHOLD + 10;
      sim.add(poor);
      sim.add(rich);
      const richBefore = rich.resources;
      sim.distributeWelfare([poor, rich]);
      expect(poor.resources).toBeGreaterThan(Variables.WELFARE_THRESHOLD - 1);
      expect(rich.resources).toBe(richBefore);
    });

    it('distributes to orphaned children (age < 18, no living parents)', () => {
      const sim = new Simulation();
      sim.communityPool = 100;
      const orphan = new Person([]);
      orphan.age = 10;
      orphan.resources = Variables.WELFARE_THRESHOLD + 5;
      sim.add(orphan);
      const before = orphan.resources;
      sim.distributeWelfare([orphan]);
      expect(orphan.resources).toBeGreaterThan(before);
    });

    it('does not distribute to a child with living parents even if above threshold', () => {
      const sim = new Simulation();
      sim.communityPool = 100;
      const p1 = new Person([]);
      p1.age = 30;
      p1.resources = 200;
      const p2 = new Person([]);
      p2.age = 30;
      p2.resources = 200;
      const child = new Person([p1, p2]);
      child.age = 10;
      child.resources = Variables.WELFARE_THRESHOLD + 5;
      sim.add(p1);
      sim.add(p2);
      sim.add(child);
      const childBefore = child.resources;
      sim.distributeWelfare([p1, p2, child]);
      expect(child.resources).toBe(childBefore);
    });

    it('distributes equal shares to each eligible recipient', () => {
      const sim = new Simulation();
      sim.communityPool = 100;
      const p1 = new Person([]);
      p1.age = 30;
      p1.resources = 0;
      const p2 = new Person([]);
      p2.age = 30;
      p2.resources = 0;
      sim.add(p1);
      sim.add(p2);
      const before1 = p1.resources;
      const before2 = p2.resources;
      sim.distributeWelfare([p1, p2]);
      expect(p1.resources - before1).toBeCloseTo(p2.resources - before2);
    });

    it('retains COMMUNITY_POOL_RESERVE_FRACTION in the pool', () => {
      const sim = new Simulation();
      sim.communityPool = 100;
      const p = new Person([]);
      p.age = 30;
      p.resources = 0;
      sim.add(p);
      sim.distributeWelfare([p]);
      expect(sim.communityPool).toBeCloseTo(100 * Variables.COMMUNITY_POOL_RESERVE_FRACTION);
    });

    it('no-ops when no eligible recipients', () => {
      const sim = new Simulation();
      sim.communityPool = 100;
      const rich = new Person([]);
      rich.age = 30;
      rich.resources = Variables.WELFARE_THRESHOLD + 50;
      sim.add(rich);
      sim.distributeWelfare([rich]);
      expect(sim.communityPool).toBe(100);
    });

    it('no-ops when person list is empty', () => {
      const sim = new Simulation();
      sim.communityPool = 100;
      sim.distributeWelfare([]);
      expect(sim.communityPool).toBe(100);
    });
  });
});
