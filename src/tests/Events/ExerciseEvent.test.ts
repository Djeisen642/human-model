import ExerciseEvent from '../../Events/ExerciseEvent';
import Person from '../../App/Person';
import Simulation from '../../App/Simulation';

describe('ExerciseEvent', () => {
  it('increments constitution by 1', () => {
    const person = new Person([]);
    person.constitution = 5;
    const event = new ExerciseEvent();

    event.execute(person, new Simulation());

    expect(person.constitution).toBe(6);
  });

  it('increments constitution from 1', () => {
    const person = new Person([]);
    person.constitution = 1;
    const event = new ExerciseEvent();

    event.execute(person, new Simulation());

    expect(person.constitution).toBe(2);
  });
});
