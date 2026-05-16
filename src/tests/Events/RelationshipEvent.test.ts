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

      // rng always returns 1: formProb check fails since formProb < 1
      const event = new RelationshipEvent(() => 1);
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
      person.isInRelationshipWith = partner;
      partner.isInRelationshipWith = person;
      sim.add(person);
      sim.add(partner);

      // rng returns exactly BASE_BREAKUP_RATE — condition is strictly less-than, so no dissolution
      const event = new RelationshipEvent(() => Variables.BASE_BREAKUP_RATE);
      event.execute(person, sim);

      expect(person.isInRelationshipWith).toBe(partner);
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
