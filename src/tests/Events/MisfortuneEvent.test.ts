import MisfortuneEvent from '../../Events/MisfortuneEvent';
import Person from '../../App/Person';
import Simulation from '../../App/Simulation';
import Constants from '../../Helpers/Constants';

describe('MisfortuneEvent', () => {
  let simulation: Simulation;

  beforeEach(() => {
    simulation = new Simulation();
  });

  it('kills by illness when rng is below illness threshold', () => {
    // First rng call (illness check) always passes; second (suicide check) never fires
    const rngValues = [0, 1];
    let i = 0;
    const event = new MisfortuneEvent(() => rngValues[i++]);
    const person = new Person([]);
    person.hasJob = true;
    person.resources = 100;
    person.illness = 1; // fully ill so illnessDeathProb > 0
    simulation.add(person);

    event.execute(person, simulation);

    expect(person.causeOfDeath?.cause).toBe(Constants.CAUSE_OF_DEATH.ILLNESS);
    expect(simulation.getLiving()).not.toContain(person);
  });

  it('never kills by illness when illness is 0', () => {
    // rng always returns 0 (would pass any check), but illness=0 → illnessDeathProb=0
    const event = new MisfortuneEvent(() => 1); // fail all checks so person survives
    const person = new Person([]);
    person.illness = 0;
    simulation.add(person);

    event.execute(person, simulation);

    expect(person.causeOfDeath).toBeNull();
  });

  it('illness death probability scales with severity', () => {
    // At illness=0.5, illnessDeathProb = 0.5 * ILLNESS_DEATH_SCALAR * ageMortalityModifier
    // With rng just below that threshold the person dies; just above they survive
    const person = new Person([]);
    person.illness = 0.5;
    person.age = 28; // prime age → ageMortalityModifier near its minimum
    simulation.add(person);

    const illnessDeathProb = person.illness * 0.08 * person.ageMortalityModifier;

    // rng just below threshold → dies of illness
    const eventKill = new MisfortuneEvent(() => illnessDeathProb - 0.001);
    eventKill.execute(person, simulation);
    expect(person.causeOfDeath?.cause).toBe(Constants.CAUSE_OF_DEATH.ILLNESS);

    // Reset for survival check
    const person2 = new Person([]);
    person2.illness = 0.5;
    person2.age = 28;
    const sim2 = new Simulation();
    sim2.add(person2);

    // rng above threshold → survives illness, also above suicide threshold
    const eventSurvive = new MisfortuneEvent(() => 1);
    eventSurvive.execute(person2, sim2);
    expect(person2.causeOfDeath).toBeNull();
  });

  it('skips suicide check when illness kills', () => {
    let calls = 0;
    const event = new MisfortuneEvent(() => {
      calls++;
      return 0; // always passes every check
    });
    const person = new Person([]);
    person.illness = 1; // fully ill so illness check can fire
    simulation.add(person);

    event.execute(person, simulation);

    // Only one rng call should be made — illness short-circuits before suicide
    expect(calls).toBe(1);
    expect(person.causeOfDeath?.cause).toBe(Constants.CAUSE_OF_DEATH.ILLNESS);
  });

  it('kills by suicide at happiness=0 when illness check fails', () => {
    // First rng call (illness) fails; second (suicide at happiness=0) passes
    const rngValues = [1, 0];
    let i = 0;
    const event = new MisfortuneEvent(() => rngValues[i++]);
    const person = new Person([]);
    // happiness=0: no job (-3), critical resources (-5), no relationship, young (<18: -1)
    // floor at 0, so happiness getter returns 0
    person.resources = 0;
    person.age = 10;
    simulation.add(person);

    event.execute(person, simulation);

    expect(person.causeOfDeath?.cause).toBe(Constants.CAUSE_OF_DEATH.SUICIDE);
    expect(simulation.getLiving()).not.toContain(person);
  });

  it('survives when both rng values exceed thresholds', () => {
    const event = new MisfortuneEvent(() => 1); // always fails every check
    const person = new Person([]);
    simulation.add(person);

    event.execute(person, simulation);

    expect(person.causeOfDeath).toBeNull();
    expect(simulation.getLiving()).toContain(person);
  });

  it('does not kill by suicide at high happiness', () => {
    // illness check fails; suicide check: rng returns value above threshold for happiness=11
    // SUICIDE_PROBABILITY_SCALE / (11+1) = 0.03/12 = 0.0025; rng=0.5 >> 0.0025
    const rngValues = [1, 0.5];
    let i = 0;
    const event = new MisfortuneEvent(() => rngValues[i++]);
    const person = new Person([]);
    person.hasJob = true;
    person.resources = 100;
    person.isInRelationshipWith = new Person([]);
    person.age = 30;
    simulation.add(person);

    event.execute(person, simulation);

    expect(person.causeOfDeath).toBeNull();
    expect(simulation.getLiving()).toContain(person);
  });
});
