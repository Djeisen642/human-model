import Person from '../../App/Person';


describe('Person', () => {
  it('should create a Person', () => {
    const person = new Person([]);

    expect(person).toBeTruthy();
    expect(person.age).toBe(0);
  });

  it('Should create a Person with parents', () => {
    const parent1 = new Person([]);
    const parent2 = new Person([]);
    const parents = [parent1, parent2];
    const person = new Person(parents);

    expect(person).toBeTruthy();
    expect(person.childOf).toBe(parents);
  });
});