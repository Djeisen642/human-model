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

  it('adds resources proportional to experience, intelligence, and productivity', () => {
    const person = new Person([]);
    person.experience = 20;
    person.intelligence = 5;
    simulation.add(person);
    const initialPool = simulation.naturalResources;

    event.execute(person, simulation);

    const potential = person.experience * (Variables.BASE_GATHER_AMOUNT + 5 * Variables.INTELLIGENCE_GATHER_SCALAR);
    const expected = potential * simulation.extractionProductivity;
    expect(person.resources).toBeCloseTo(expected);
    expect(simulation.naturalResources).toBeCloseTo(initialPool - expected);
  });

  it('strict conservation: pool drain equals personal gain (ARD 039)', () => {
    const person = new Person([]);
    person.experience = 30;
    person.intelligence = 7;
    simulation.add(person);
    simulation.extractionProductivity = 0.5;
    const before = simulation.naturalResources;

    event.execute(person, simulation);

    expect(simulation.naturalResources).toBeCloseTo(before - person.resources);
  });

  it('productivity above 1 increases output and drain equally', () => {
    const baseline = new Simulation();
    const high = new Simulation();
    const p1 = new Person([]);
    const p2 = new Person([]);
    p1.experience = p2.experience = 20;
    p1.intelligence = p2.intelligence = 5;
    baseline.add(p1);
    high.add(p2);
    high.extractionProductivity = 2.0;

    event.execute(p1, baseline);
    event.execute(p2, high);

    expect(p2.resources).toBeCloseTo(p1.resources * 2);
    expect(baseline.naturalResources - p1.resources).toBeCloseTo(high.naturalResources - 0 + p2.resources - 2 * p1.resources);
  });

  it('productivity below 1 decreases output', () => {
    const sim = new Simulation();
    sim.extractionProductivity = 0.25;
    const person = new Person([]);
    person.experience = 20;
    person.intelligence = 5;
    sim.add(person);

    event.execute(person, sim);

    const potential = 20 * (Variables.BASE_GATHER_AMOUNT + 5 * Variables.INTELLIGENCE_GATHER_SCALAR);
    expect(person.resources).toBeCloseTo(potential * 0.25);
  });

  it('caps extraction when pool is smaller than productivity-scaled output', () => {
    const person = new Person([]);
    person.experience = 10_000;
    person.intelligence = 10;
    simulation.add(person);
    simulation.naturalResources = 5;

    event.execute(person, simulation);

    expect(person.resources).toBe(5);
    expect(simulation.naturalResources).toBe(0);
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

  it('scales output by the access multiplier (ARD 068)', () => {
    const person = new Person([]);
    person.experience = 20;
    person.intelligence = 5;
    person.accessMultiplier = 2.5;
    simulation.add(person);
    const initialPool = simulation.naturalResources;

    event.execute(person, simulation);

    const potential = person.experience * (Variables.BASE_GATHER_AMOUNT + 5 * Variables.INTELLIGENCE_GATHER_SCALAR);
    const expected = potential * simulation.extractionProductivity * 2.5;
    expect(person.resources).toBeCloseTo(expected);
    // ARD 039's conservation still holds: the pool loses exactly what the person gains.
    expect(simulation.naturalResources).toBeCloseTo(initialPool - expected);
  });

  it('is unchanged by a neutral access multiplier, bit for bit', () => {
    const withField = new Person([]);
    withField.experience = 20;
    withField.intelligence = 5;
    simulation.add(withField);
    event.execute(withField, simulation);

    const potential = 20 * (Variables.BASE_GATHER_AMOUNT + 5 * Variables.INTELLIGENCE_GATHER_SCALAR);
    // Multiplication by exactly 1.0 is exact in IEEE754, which is what lets the off setting
    // reproduce the pre-ARD-068 tick history bitwise.
    expect(withField.resources).toBe(potential * simulation.extractionProductivity);
  });
});
