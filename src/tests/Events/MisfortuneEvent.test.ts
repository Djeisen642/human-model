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
    simulation.add(person);

    event.execute(person, simulation);

    expect(person.causeOfDeath?.cause).toBe(Constants.CAUSE_OF_DEATH.ILLNESS);
    expect(simulation.getLiving()).not.toContain(person);
  });

  it('skips suicide check when illness kills', () => {
    let calls = 0;
    const event = new MisfortuneEvent(() => {
      calls++;
      return 0; // always passes every check
    });
    const person = new Person([]);
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
