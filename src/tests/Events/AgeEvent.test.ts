import AgeEvent from '../../Events/AgeEvent';
import Person from '../../App/Person';
import Simulation from '../../App/Simulation';

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

  it('does not kill regardless of age', () => {
    const person = new Person([]);
    person.age = 90;
    simulation.add(person);

    event.execute(person, simulation);

    expect(person.causeOfDeath).toBeNull();
    expect(simulation.getLiving()).toContain(person);
  });
});
