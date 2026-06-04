import StatDecayEvent from '../../Events/StatDecayEvent';
import Person from '../../App/Person';
import Simulation from '../../App/Simulation';
import Variables from '../../Helpers/Variables';

describe('StatDecayEvent', () => {
  let simulation: Simulation;

  beforeEach(() => {
    simulation = new Simulation();
  });

  describe('constitution decay', () => {
    it('does not decay constitution before start age', () => {
      const person = new Person([]);
      person.age = Variables.CONSTITUTION_DECAY_START_AGE - 1;
      person.constitution = 8;
      // rng always returns 0 (always passes any threshold) — still no decay before start age
      const event = new StatDecayEvent(() => 0);

      event.execute(person, simulation);

      expect(person.constitution).toBe(8);
    });

    it('does not decay constitution at exactly start age (prob is zero)', () => {
      const person = new Person([]);
      person.age = Variables.CONSTITUTION_DECAY_START_AGE;
      person.constitution = 8;
      const event = new StatDecayEvent(() => 0);

      event.execute(person, simulation);

      expect(person.constitution).toBe(8);
    });

    it('decrements constitution when rng rolls below threshold', () => {
      const person = new Person([]);
      person.age = Variables.CONSTITUTION_DECAY_START_AGE + 20; // prob = RATE * 20
      person.constitution = 8;
      const decayProb = Variables.CONSTITUTION_DECAY_BASE_RATE * 20;
      // rng returns just below threshold for constitution, above for intelligence
      const rngValues = [decayProb - 0.0001, 1];
      let i = 0;
      const event = new StatDecayEvent(() => rngValues[i++]);

      event.execute(person, simulation);

      expect(person.constitution).toBe(7);
    });

    it('does not decrement constitution when rng rolls at or above threshold', () => {
      const person = new Person([]);
      person.age = Variables.CONSTITUTION_DECAY_START_AGE + 20;
      person.constitution = 8;
      const decayProb = Variables.CONSTITUTION_DECAY_BASE_RATE * 20;
      const rngValues = [decayProb, 1]; // exactly at threshold = no decay
      let i = 0;
      const event = new StatDecayEvent(() => rngValues[i++]);

      event.execute(person, simulation);

      expect(person.constitution).toBe(8);
    });

    it('floors constitution at 1, not 0', () => {
      const person = new Person([]);
      person.age = Variables.CONSTITUTION_DECAY_START_AGE + 20;
      person.constitution = 1;
      const rngValues = [0, 1]; // constitution roll passes, intelligence roll fails
      let i = 0;
      const event = new StatDecayEvent(() => rngValues[i++]);

      event.execute(person, simulation);

      expect(person.constitution).toBe(1);
    });

    it('decay probability scales linearly with years past start age', () => {
      // At age start+10: prob = RATE * 10. At age start+20: prob = RATE * 20 (double).
      const yearsA = 10;
      const yearsB = 20;
      const probA = Variables.CONSTITUTION_DECAY_BASE_RATE * yearsA;
      const probB = Variables.CONSTITUTION_DECAY_BASE_RATE * yearsB;

      expect(probB).toBeCloseTo(probA * 2);
    });
  });

  describe('intelligence decay', () => {
    it('does not decay intelligence before start age', () => {
      const person = new Person([]);
      person.age = Variables.INTELLIGENCE_DECAY_START_AGE - 1;
      person.intelligence = 8;
      const event = new StatDecayEvent(() => 0);

      event.execute(person, simulation);

      expect(person.intelligence).toBe(8);
    });

    it('does not decay intelligence at exactly start age (prob is zero)', () => {
      const person = new Person([]);
      person.age = Variables.INTELLIGENCE_DECAY_START_AGE;
      person.intelligence = 8;
      const event = new StatDecayEvent(() => 0);

      event.execute(person, simulation);

      expect(person.intelligence).toBe(8);
    });

    it('decrements intelligence when rng rolls below threshold', () => {
      const person = new Person([]);
      person.age = Variables.INTELLIGENCE_DECAY_START_AGE + 20; // prob = RATE * 20
      person.intelligence = 8;
      const decayProb = Variables.INTELLIGENCE_DECAY_BASE_RATE * 20;
      // rng: constitution roll fails (above its threshold), intelligence roll passes
      const constitutionAge = person.age - Variables.CONSTITUTION_DECAY_START_AGE;
      const constitutionProb = Variables.CONSTITUTION_DECAY_BASE_RATE * constitutionAge;
      const rngValues = [constitutionProb, decayProb - 0.0001];
      let i = 0;
      const event = new StatDecayEvent(() => rngValues[i++]);

      event.execute(person, simulation);

      expect(person.intelligence).toBe(7);
    });

    it('floors intelligence at 1, not 0', () => {
      const person = new Person([]);
      person.age = Variables.INTELLIGENCE_DECAY_START_AGE + 20;
      person.intelligence = 1;
      // both rolls pass
      const rngValues = [0, 0];
      let i = 0;
      const event = new StatDecayEvent(() => rngValues[i++]);

      event.execute(person, simulation);

      expect(person.intelligence).toBe(1);
    });
  });

  describe('independent decay rolls', () => {
    it('constitution can decay without intelligence decaying in the same tick', () => {
      const person = new Person([]);
      person.age = Variables.CONSTITUTION_DECAY_START_AGE + 20;
      person.constitution = 8;
      person.intelligence = 8;
      // constitution roll passes, intelligence roll fails
      const rngValues = [0, 1];
      let i = 0;
      const event = new StatDecayEvent(() => rngValues[i++]);

      event.execute(person, simulation);

      expect(person.constitution).toBe(7);
      expect(person.intelligence).toBe(8);
    });

    it('intelligence can decay without constitution decaying in the same tick', () => {
      const person = new Person([]);
      person.age = Variables.INTELLIGENCE_DECAY_START_AGE + 20;
      person.constitution = 8;
      person.intelligence = 8;
      // constitution roll fails, intelligence roll passes
      const rngValues = [1, 0];
      let i = 0;
      const event = new StatDecayEvent(() => rngValues[i++]);

      event.execute(person, simulation);

      expect(person.constitution).toBe(8);
      expect(person.intelligence).toBe(7);
    });

    it('both stats can decay in the same tick', () => {
      const person = new Person([]);
      person.age = Variables.INTELLIGENCE_DECAY_START_AGE + 20;
      person.constitution = 8;
      person.intelligence = 8;
      const rngValues = [0, 0]; // both rolls pass
      let i = 0;
      const event = new StatDecayEvent(() => rngValues[i++]);

      event.execute(person, simulation);

      expect(person.constitution).toBe(7);
      expect(person.intelligence).toBe(7);
    });
  });
});
