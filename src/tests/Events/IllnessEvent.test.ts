import IllnessEvent from '../../Events/IllnessEvent';
import Person from '../../App/Person';
import Simulation from '../../App/Simulation';
import Variables from '../../Helpers/Variables';

describe('IllnessEvent', () => {
  let simulation: Simulation;

  beforeEach(() => {
    simulation = new Simulation();
  });

  it('increases illness when onset roll passes and recovery roll fails', () => {
    // rng: first call (onset) passes, second call (recovery) fails
    const rngValues = [0, 1];
    let i = 0;
    const event = new IllnessEvent(() => rngValues[i++]);
    const person = new Person([]);
    person.age = 30;
    person.constitution = 1;
    person.illness = 0;

    event.execute(person, simulation);

    expect(person.illness).toBeCloseTo(Variables.ILLNESS_ONSET_AMOUNT);
  });

  it('decreases illness when onset roll fails and recovery roll passes', () => {
    const rngValues = [1, 0];
    let i = 0;
    const event = new IllnessEvent(() => rngValues[i++]);
    const person = new Person([]);
    person.age = 30;
    person.constitution = 1;
    person.illness = 0.5;

    event.execute(person, simulation);

    expect(person.illness).toBeCloseTo(0.5 - Variables.ILLNESS_RECOVERY_AMOUNT);
  });

  it('clamps illness at 0 when recovery would go negative', () => {
    const rngValues = [1, 0];
    let i = 0;
    const event = new IllnessEvent(() => rngValues[i++]);
    const person = new Person([]);
    person.age = 30;
    person.constitution = 1;
    person.illness = 0.1; // recovery would subtract 0.3 → negative

    event.execute(person, simulation);

    expect(person.illness).toBe(0);
  });

  it('clamps illness at 1 when onset would exceed 1', () => {
    const rngValues = [0, 1];
    let i = 0;
    const event = new IllnessEvent(() => rngValues[i++]);
    const person = new Person([]);
    person.age = 30;
    person.constitution = 1;
    person.illness = 0.95; // onset adds 0.2 → exceeds 1

    event.execute(person, simulation);

    expect(person.illness).toBe(1);
  });

  it('higher age increases onset probability', () => {
    // rng=0.14 sits between old-person onset (0.15) and old-person recovery (≈0.133):
    //   Young (age 0): ageRisk=1, onsetProb=0.05 → 0.14>0.05 → no onset; recoveryProb=0.4 → recovery but illness floors at 0
    //   Old  (age 60): ageRisk=3, onsetProb=0.15 → 0.14<0.15 → onset (+0.2); recoveryProb≈0.133 → 0.14>0.133 → no recovery
    const rng = () => 0.14;
    const young = new Person([]);
    young.age = 0;
    young.constitution = 1;
    young.illness = 0;

    const old = new Person([]);
    old.age = 60;
    old.constitution = 1;
    old.illness = 0;

    new IllnessEvent(rng).execute(young, simulation);
    new IllnessEvent(rng).execute(old, simulation);

    expect(old.illness).toBeGreaterThan(young.illness);
  });

  it('higher constitution reduces onset and increases recovery', () => {
    // age=30, ageRisk=2, rng=0.05 constant:
    //   Low-con  (1): onsetProb=0.1  → 0.05<0.1  → onset  (+0.2); recoveryProb=0.2  → 0.05<0.2  → recovery (-0.3); net -0.1
    //   High-con (5): onsetProb=0.02 → 0.05>0.02 → no onset;       recoveryProb=1.0  → 0.05<1.0  → recovery (-0.3); net -0.3
    // Starting at illness=0.5: low-con ends at 0.4, high-con ends at 0.2 → low-con > high-con ✓
    const rng = () => 0.05;
    const lowCon = new Person([]);
    lowCon.age = 30;
    lowCon.constitution = 1;
    lowCon.illness = 0.5;

    const highCon = new Person([]);
    highCon.age = 30;
    highCon.constitution = 5;
    highCon.illness = 0.5;

    new IllnessEvent(rng).execute(lowCon, simulation);
    new IllnessEvent(rng).execute(highCon, simulation);

    expect(lowCon.illness).toBeGreaterThan(highCon.illness);
  });

  it('illness stays at 0 when both rolls fail', () => {
    const event = new IllnessEvent(() => 1); // always fails both checks
    const person = new Person([]);
    person.age = 30;
    person.constitution = 1;
    person.illness = 0;

    event.execute(person, simulation);

    expect(person.illness).toBe(0);
  });

  it('reflects updated illness in happiness on same tick', () => {
    // onset fires, recovery fails → illness rises → happiness falls
    const rngValues = [0, 1];
    let i = 0;
    const event = new IllnessEvent(() => rngValues[i++]);
    const person = new Person([]);
    person.age = 30;
    person.constitution = 1;
    person.illness = 0;
    person.resources = 50;
    person.hasJob = true;
    const happinessBefore = person.happiness;

    event.execute(person, simulation);

    expect(person.happiness).toBeLessThan(happinessBefore);
  });
});
