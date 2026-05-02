import DisasterEvent from '../../Events/DisasterEvent';
import Person from '../../App/Person';
import Simulation from '../../App/Simulation';
import Constants from '../../Helpers/Constants';
import Variables from '../../Helpers/Variables';

/**
 * RNG call sequence for a 1-person population:
 *   call 1: trigger check (fires if < DISASTER_PROBABILITY = 0.1)
 *   call 2: affectedCount rng1 (with pop=1, max(1, floor(v1*v2*1*0.2)) is always 1)
 *   call 3: affectedCount rng2
 *   call 4: selectRandom — j = floor(rng * 1) = 0, selects person[0]
 *   call 5: killRoll
 *   call 6: fractionRoll
 */
describe('DisasterEvent', () => {
  let simulation: Simulation;
  let person: Person;

  beforeEach(() => {
    simulation = new Simulation();
    person = new Person([]);
    person.constitution = 1;
    person.age = 28; // prime age → ageMortalityModifier ≈ 1.0
    person.resources = 100;
    simulation.add(person);
  });

  it('does nothing when probability gate fails', () => {
    // rng always returns 0.5, which is > DISASTER_PROBABILITY (0.1) → no disaster
    const event = new DisasterEvent(() => 0.5);

    event.execute(simulation);

    expect(person.resources).toBe(100);
    expect(person.causeOfDeath).toBeNull();
    expect(simulation.getLiving()).toContain(person);
  });

  it('kills an affected person when kill roll is below threshold', () => {
    // trigger: 0 < 0.1 → fires
    // affectedCount: rng*rng*1*0.2 → always 1 (max(1, floor(...)))
    // selection: 0 → index 0
    // killRoll: 0 < DISASTER_KILL_BASE * ageMortalityModifier / constitution = 0.1 * ~1 / 1 = 0.1 → killed
    const rngSeq = [0, 0, 0, 0, 0, 0.5];
    let i = 0;
    const event = new DisasterEvent(() => rngSeq[i++]);

    event.execute(simulation);

    expect(person.causeOfDeath?.cause).toBe(Constants.CAUSE_OF_DEATH.DISASTER);
    expect(simulation.getLiving()).not.toContain(person);
  });

  it('damages resources for a survivor', () => {
    // trigger: 0 → fires
    // affectedCount: always 1 for pop=1
    // selection: 0 → index 0
    // killRoll: 0.5 > DISASTER_KILL_BASE * ~1 / 1 = 0.1 → survives
    // fractionRoll: 0 → fractionLost = DISASTER_MIN_LOSS_FRACTION + 0 = 0.1
    // resources = 100 * (1 - 0.1) = 90
    const rngSeq = [0, 0, 0, 0, 0.5, 0];
    let i = 0;
    const event = new DisasterEvent(() => rngSeq[i++]);

    event.execute(simulation);

    expect(person.causeOfDeath).toBeNull();
    expect(person.resources).toBeCloseTo(90);
  });

  it('applies maximum resource loss when fraction roll is 1', () => {
    // fractionRoll: 1 → fractionLost = 0.1 + 1 * (0.9 - 0.1) = 0.9
    // resources = 100 * (1 - 0.9) = 10
    const rngSeq = [0, 0, 0, 0, 0.5, 1.0];
    let i = 0;
    const event = new DisasterEvent(() => rngSeq[i++]);

    event.execute(simulation);

    expect(person.resources).toBeCloseTo(100 * (1 - Variables.DISASTER_MAX_LOSS_FRACTION));
  });

  it('clamps resource loss above zero even for zero-resource persons', () => {
    person.resources = 0;
    const rngSeq = [0, 0, 0, 0, 0.5, 1.0];
    let i = 0;
    const event = new DisasterEvent(() => rngSeq[i++]);

    event.execute(simulation);

    expect(person.resources).toBe(0);
    expect(person.causeOfDeath).toBeNull();
  });

  it('skips persons already dead at disaster time', () => {
    // Kill the person before disaster runs (simulating a death earlier in the tick)
    simulation.kill(person, Constants.CAUSE_OF_DEATH.ILLNESS);
    const rngSeq = [0, 0, 0, 0, 0.5, 0];
    let i = 0;
    const event = new DisasterEvent(() => rngSeq[i++]);
    const resourcesBefore = person.resources;

    event.execute(simulation);

    // Already dead — resources and cause unchanged
    expect(person.causeOfDeath?.cause).toBe(Constants.CAUSE_OF_DEATH.ILLNESS);
    expect(person.resources).toBe(resourcesBefore);
  });

  it('does nothing when living population is empty', () => {
    const emptySim = new Simulation();
    // trigger: 0 → disaster fires, but population is empty
    const event = new DisasterEvent(() => 0);

    expect(() => event.execute(emptySim)).not.toThrow();
  });

  it('affects multiple persons in a larger population', () => {
    // Add 9 more persons (total 10)
    for (let i = 0; i < 9; i++) {
      const p = new Person([]);
      p.constitution = 5;
      p.age = 28;
      p.resources = 100;
      simulation.add(p);
    }
    // trigger: 0 → fires
    // affectedCount: rng1=1, rng2=1 → floor(1*1*10*0.2) = 2, max(1,2) = 2
    // remaining rng values: all 0.5 (kill rolls fail for constitution 5, survive with resource damage)
    const rngSeq = [0, 1, 1, ...Array(20).fill(0.5)];
    let i = 0;
    const event = new DisasterEvent(() => rngSeq[i++]);

    event.execute(simulation);

    const damageCount = simulation.getLiving().filter(p => p.resources < 100).length;
    expect(damageCount).toBe(2);
  });
});
