import GatherResourcesEvent from '../../Events/GatherResourcesEvent';
import Person from '../../App/Person';
import Simulation from '../../App/Simulation';
import Variables from '../../Helpers/Variables';

describe('GatherResourcesEvent', () => {
  let event: GatherResourcesEvent;
  let simulation: Simulation;

  beforeEach(() => {
    event = new GatherResourcesEvent();
    simulation = new Simulation();
  });

  it('adds no resources when experience is zero', () => {
    const person = new Person([]);
    person.experience = 0;
    person.intelligence = 10;
    simulation.add(person);

    event.execute(person, simulation);

    expect(person.resources).toBe(0);
  });

  it('adds resources proportional to experience and intelligence', () => {
    const person = new Person([]);
    person.experience = 20;
    person.intelligence = 5;
    simulation.add(person);
    const initialPool = simulation.naturalResources;

    event.execute(person, simulation);

    const expected = person.experience * (Variables.BASE_GATHER_AMOUNT + 5 * Variables.INTELLIGENCE_GATHER_SCALAR);
    expect(person.resources).toBeCloseTo(expected);
    expect(simulation.naturalResources).toBeCloseTo(initialPool - expected * simulation.extractionEfficiency);
  });

  it('caps extraction when pool is smaller than potential', () => {
    const person = new Person([]);
    person.experience = 10_000;
    person.intelligence = 10;
    simulation.add(person);
    simulation.naturalResources = 5;

    event.execute(person, simulation);

    expect(person.resources).toBeLessThanOrEqual(5 / simulation.extractionEfficiency);
    expect(simulation.naturalResources).toBeGreaterThanOrEqual(0);
  });

  it('depletes the pool by extracted * extractionEfficiency', () => {
    const person = new Person([]);
    person.experience = 10;
    person.intelligence = 5;
    simulation.add(person);
    const before = simulation.naturalResources;

    event.execute(person, simulation);

    const extracted = person.resources;
    expect(simulation.naturalResources).toBeCloseTo(before - extracted * simulation.extractionEfficiency);
  });

  it('does not extract from an empty pool', () => {
    const person = new Person([]);
    person.experience = 20;
    person.intelligence = 5;
    simulation.add(person);
    simulation.naturalResources = 0;

    event.execute(person, simulation);

    expect(person.resources).toBe(0);
    expect(simulation.naturalResources).toBe(0);
  });
});
