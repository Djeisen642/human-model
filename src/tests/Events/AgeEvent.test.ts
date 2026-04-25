import AgeEvent from '../../Events/AgeEvent';
import Person from '../../App/Person';
import Simulation from '../../App/Simulation';
import Constants from '../../Helpers/Constants';
import Variables from '../../Helpers/Variables';

describe('AgeEvent', () => {
  let event: AgeEvent;
  let simulation: Simulation;

  beforeEach(() => {
    event = new AgeEvent();
    simulation = new Simulation();
  });

  it('increments age by 1', () => {
    const person = new Person([]);
    person.age = 10;
    simulation.add(person);

    event.execute(person, simulation);

    expect(person.age).toBe(11);
  });

  it('does not kill a person below OLD_AGE', () => {
    const person = new Person([]);
    person.age = Variables.OLD_AGE - 2;
    simulation.add(person);

    event.execute(person, simulation);

    expect(person.causeOfDeath).toBeNull();
    expect(simulation.getLiving()).toContain(person);
  });

  it('kills a person when they reach OLD_AGE', () => {
    const person = new Person([]);
    person.age = Variables.OLD_AGE - 1;
    simulation.add(person);

    event.execute(person, simulation);

    expect(person.age).toBe(Variables.OLD_AGE);
    expect(person.causeOfDeath).not.toBeNull();
    expect(person.causeOfDeath?.cause).toBe(Constants.CAUSE_OF_DEATH.OLD_AGE);
    expect(simulation.getLiving()).not.toContain(person);
  });
});
