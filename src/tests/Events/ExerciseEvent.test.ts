import ExerciseEvent from '../../Events/ExerciseEvent';
import Person from '../../App/Person';
import Simulation from '../../App/Simulation';
import Variables from '../../Helpers/Variables';

describe('ExerciseEvent', () => {
  it('increments constitution by 1', () => {
    const person = new Person([]);
    person.constitution = 5;
    const event = new ExerciseEvent();

    event.execute(person, new Simulation());

    expect(person.constitution).toBe(6);
  });

  it('does not exceed CONSTITUTION_MAX', () => {
    const person = new Person([]);
    person.constitution = Variables.CONSTITUTION_MAX;
    const event = new ExerciseEvent();

    event.execute(person, new Simulation());

    expect(person.constitution).toBe(Variables.CONSTITUTION_MAX);
  });
});
