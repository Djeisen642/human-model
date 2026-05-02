import LearnEvent from '../../Events/LearnEvent';
import Person from '../../App/Person';
import Simulation from '../../App/Simulation';

describe('LearnEvent', () => {
  it('increments intelligence by 1', () => {
    const person = new Person([]);
    person.intelligence = 5;
    const event = new LearnEvent();

    event.execute(person, new Simulation());

    expect(person.intelligence).toBe(6);
  });

  it('increments intelligence from 1', () => {
    const person = new Person([]);
    person.intelligence = 1;
    const event = new LearnEvent();

    event.execute(person, new Simulation());

    expect(person.intelligence).toBe(2);
  });
});
