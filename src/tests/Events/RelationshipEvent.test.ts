import RelationshipEvent from '../../Events/RelationshipEvent';
import Person from '../../App/Person';
import Simulation from '../../App/Simulation';
import Variables from '../../Helpers/Variables';
import EventFactory from '../../Events/EventFactory';

describe('RelationshipEvent', () => {
  describe('formation branch', () => {
    it('forms relationship when both persons are unpartnered and rng passes', () => {
      const sim = new Simulation();
      const person = new Person([]);
      person.age = 26; // peak age
      person.charisma = 5;
      const other = new Person([]);
      other.age = 26;
      sim.add(person);
      sim.add(other);

      // rng sequence: first call is formProb check (0 always passes), second is getRandomOther index (0 picks first candidate)
      const event = new RelationshipEvent(() => 0);
      event.execute(person, sim);

      expect(person.isInRelationshipWith).toBe(other);
      expect(other.isInRelationshipWith).toBe(person);
    });

    it('does not form a relationship when the drawn other is already partnered', () => {
      const sim = new Simulation();
      const person = new Person([]);
      person.age = 26;
      person.charisma = 5;
      const other = new Person([]);
      const thirdParty = new Person([]);
      other.isInRelationshipWith = thirdParty;
      thirdParty.isInRelationshipWith = other;
      sim.add(person);
      sim.add(other);

      const event = new RelationshipEvent(() => 0);
      event.execute(person, sim);

      expect(person.isInRelationshipWith).toBeNull();
    });

    it('does nothing when getRandomOther returns null (no other person)', () => {
      const sim = new Simulation();
      const person = new Person([]);
      person.age = 26;
      person.charisma = 5;
      sim.add(person);

      const event = new RelationshipEvent(() => 0);
      expect(() => event.execute(person, sim)).not.toThrow();
      expect(person.isInRelationshipWith).toBeNull();
    });

    it('does not form a relationship when rng exceeds formation probability', () => {
      const sim = new Simulation();
      const person = new Person([]);
      person.age = 26;
      person.charisma = 5;
      const other = new Person([]);
      sim.add(person);
      sim.add(other);

      // first rng call is getRandomOther (0 picks other), second is formProb check (1 fails since formProb < 1)
      let calls = 0;
      const event = new RelationshipEvent(() => calls++ === 0 ? 0 : 1);
      event.execute(person, sim);

      expect(person.isInRelationshipWith).toBeNull();
      expect(other.isInRelationshipWith).toBeNull();
    });
  });

  describe('dissolution branch', () => {
    it('clears both partners when rng is below BASE_BREAKUP_RATE', () => {
      const sim = new Simulation();
      const person = new Person([]);
      const partner = new Person([]);
      person.age = Variables.RELATIONSHIP_MIN_AGE;
      partner.age = Variables.RELATIONSHIP_MIN_AGE;
      person.isInRelationshipWith = partner;
      partner.isInRelationshipWith = person;
      sim.add(person);
      sim.add(partner);

      // rng returns 0 — always below BASE_BREAKUP_RATE
      const event = new RelationshipEvent(() => 0);
      event.execute(person, sim);

      expect(person.isInRelationshipWith).toBeNull();
      expect(partner.isInRelationshipWith).toBeNull();
    });

    it('keeps relationship intact when rng exceeds BASE_BREAKUP_RATE', () => {
      const sim = new Simulation();
      const person = new Person([]);
      const partner = new Person([]);
      person.age = Variables.RELATIONSHIP_MIN_AGE;
      partner.age = Variables.RELATIONSHIP_MIN_AGE;
      person.isInRelationshipWith = partner;
      partner.isInRelationshipWith = person;
      sim.add(person);
      sim.add(partner);

      // rng always returns 1 — above breakup rate
      const event = new RelationshipEvent(() => 1);
      event.execute(person, sim);

      expect(person.isInRelationshipWith).toBe(partner);
      expect(partner.isInRelationshipWith).toBe(person);
    });

    it('dissolution uses BASE_BREAKUP_RATE as the threshold', () => {
      const sim = new Simulation();
      const person = new Person([]);
      const partner = new Person([]);
      person.age = Variables.RELATIONSHIP_MIN_AGE;
      partner.age = Variables.RELATIONSHIP_MIN_AGE;
      person.isInRelationshipWith = partner;
      partner.isInRelationshipWith = person;
      sim.add(person);
      sim.add(partner);

      // rng returns exactly BASE_BREAKUP_RATE — condition is strictly less-than, so no dissolution
      const event = new RelationshipEvent(() => Variables.BASE_BREAKUP_RATE);
      event.execute(person, sim);

      expect(person.isInRelationshipWith).toBe(partner);
    });

    it('skips persons below RELATIONSHIP_MIN_AGE entirely', () => {
      const sim = new Simulation();
      const person = new Person([]);
      const partner = new Person([]);
      person.age = Variables.RELATIONSHIP_MIN_AGE - 1;
      partner.age = Variables.RELATIONSHIP_MIN_AGE - 1;
      person.isInRelationshipWith = partner;
      partner.isInRelationshipWith = person;
      sim.add(person);
      sim.add(partner);

      // rng returns 0 — would dissolve if age gate were absent
      const event = new RelationshipEvent(() => 0);
      event.execute(person, sim);

      expect(person.isInRelationshipWith).toBe(partner);
      expect(partner.isInRelationshipWith).toBe(person);
    });
  });

  describe('minimum age gate (ARD 053)', () => {
    it('does not form a relationship for persons below RELATIONSHIP_MIN_AGE', () => {
      const sim = new Simulation();
      const person = new Person([]);
      const other = new Person([]);
      person.age = Variables.RELATIONSHIP_MIN_AGE - 1;
      other.age = Variables.RELATIONSHIP_MIN_AGE - 1;
      sim.add(person);
      sim.add(other);

      // rng returns 0 — would form relationship if age gate were absent
      const event = new RelationshipEvent(() => 0);
      event.execute(person, sim);

      expect(person.isInRelationshipWith).toBeNull();
      expect(other.isInRelationshipWith).toBeNull();
    });
  });

  describe('age-gap preference (ARD 054)', () => {
    it('forms relationship more readily for a small age gap than a large one', () => {
      // Two setups identical except age gap; use a mid-range rng that passes for small gap but fails for large gap.
      // ageGapModifier at gap=0 is 1.0; at gap=30 it is near RELATIONSHIP_AGE_GAP_FLOOR (0.1).
      // Pick rng = 0.15: should pass formProb * 1.0 but fail formProb * ~0.1.
      const makeEvent = (threshold: number) => new RelationshipEvent(
        (() => { let c = 0; return () => c++ === 0 ? 0 : threshold; })()
      );

      const simClose = new Simulation();
      const personClose = new Person([]);
      personClose.age = 26;
      personClose.charisma = 5;
      const otherClose = new Person([]);
      otherClose.age = 27; // gap = 1
      simClose.add(personClose);
      simClose.add(otherClose);
      makeEvent(0.15).execute(personClose, simClose);

      const simFar = new Simulation();
      const personFar = new Person([]);
      personFar.age = 26;
      personFar.charisma = 5;
      const otherFar = new Person([]);
      otherFar.age = 56; // gap = 30 — near floor
      simFar.add(personFar);
      simFar.add(otherFar);
      makeEvent(0.15).execute(personFar, simFar);

      expect(personClose.isInRelationshipWith).toBe(otherClose);
      expect(personFar.isInRelationshipWith).toBeNull();
    });

    it('still forms a relationship across a large age gap when rng is below floor', () => {
      // RELATIONSHIP_AGE_GAP_FLOOR > 0 ensures cross-generational relationships remain possible
      const sim = new Simulation();
      const person = new Person([]);
      person.age = 26;
      person.charisma = 5;
      const other = new Person([]);
      other.age = 70; // very large gap — modifier near floor
      sim.add(person);
      sim.add(other);

      // rng = 0: always below any positive probability, so relationship forms despite large gap
      let calls = 0;
      const event = new RelationshipEvent(() => calls++ === 0 ? 0 : 0);
      event.execute(person, sim);

      expect(person.isInRelationshipWith).toBe(other);
    });
  });

  describe('EventFactory includes RelationshipEvent', () => {
    it('always includes RelationshipEvent in the event list', () => {
      const factory = new EventFactory(() => 0.5);
      const person = new Person([]);
      person.age = 30;

      const events = factory.getEventsFor(person);

      expect(events.some(e => e instanceof RelationshipEvent)).toBe(true);
    });
  });
});
