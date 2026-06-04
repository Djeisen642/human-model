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
    // age=30 (< senescence start, sen=1), ageRisk=2, rng=0.2 constant:
    //   Low-con  (1): onsetProb=0.2*2/1=0.4  → 0.2<0.4  → onset  (+0.2); recoveryProb=0.15*1/2=0.075 → 0.2>0.075 → no recovery; net +0.2
    //   High-con (5): onsetProb=0.2*2/5=0.08 → 0.2>0.08 → no onset;       recoveryProb=0.15*5/2=0.375 → 0.2<0.375 → recovery (-0.3); net -0.3
    // Starting at illness=0.5: low-con ends at 0.7, high-con ends at 0.2 → low-con > high-con ✓
    const rng = () => 0.2;
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

  it('recovery is unimpaired below the senescence start age but declines above it (ARD 049)', () => {
    // Same constitution; onset fails for both, isolating recovery.
    //   age=40 (< start 50, sen=1), ageRisk=2.33: recoveryProb=0.15*5/2.33*1≈0.322 → 0.2<0.322 → recovery (-0.3)
    //   age=80 (sen=1-0.02*30=0.4), ageRisk=3.67: recoveryProb=0.15*5/3.67*0.4≈0.082 → 0.2>0.082 → no recovery
    // onset: age40=0.2*2.33/5≈0.093, age80=0.2*3.67/5≈0.147; rng=0.2 exceeds both → no onset either case.
    const rng = () => 0.2;
    const middleAged = new Person([]);
    middleAged.age = 40;
    middleAged.constitution = 5;
    middleAged.illness = 0.5;

    const elderly = new Person([]);
    elderly.age = 80;
    elderly.constitution = 5;
    elderly.illness = 0.5;

    new IllnessEvent(rng).execute(middleAged, simulation);
    new IllnessEvent(rng).execute(elderly, simulation);

    // The middle-aged person heals; the elderly person does not.
    expect(middleAged.illness).toBeLessThan(elderly.illness);
  });

  it('old low-constitution illness drifts up while young healthy illness drifts down (ARD 049)', () => {
    // rng=0.1 constant:
    //   Old frail (age85, con1): onsetProb=0.2*3.83/1≈0.767 → onset(+0.2); sen=0.3, recoveryProb=0.15*1/3.83*0.3≈0.012 → no recovery; net +0.2
    //   Young fit (age30, con8): onsetProb=0.2*2/8=0.05 → 0.1>0.05 → no onset; recoveryProb=0.15*8/2=0.6 → recovery(-0.3); net -0.3
    const rng = () => 0.1;
    const oldFrail = new Person([]);
    oldFrail.age = 85;
    oldFrail.constitution = 1;
    oldFrail.illness = 0.3;

    const youngFit = new Person([]);
    youngFit.age = 30;
    youngFit.constitution = 8;
    youngFit.illness = 0.3;

    new IllnessEvent(rng).execute(oldFrail, simulation);
    new IllnessEvent(rng).execute(youngFit, simulation);

    expect(oldFrail.illness).toBeGreaterThan(0.3);
    expect(youngFit.illness).toBeLessThan(0.3);
  });

  it('senescence multiplier floors so the very old can still recover (ARD 049)', () => {
    // At extreme age the raw senescence factor goes negative (1 - 0.02*(120-50) = -0.4) but
    // floors at ILLNESS_RECOVERY_SENESCENCE_FLOOR (0.05). con10, ageRisk=5:
    //   recoveryProb = 0.15*10/5*0.05 = 0.015 (> 0 only because of the floor).
    // With rng=0 both rolls pass: onset (+0.2) then recovery (-0.3) → net -0.1 → 0.4.
    // Without the floor, recoveryProb would be negative, recovery would never fire, and the
    // person would end at 0.7 (onset only). Ending below the start proves the floor kept
    // recovery alive at extreme age.
    const ancient = new Person([]);
    ancient.age = 120;
    ancient.constitution = 10;
    ancient.illness = 0.5;

    new IllnessEvent(() => 0).execute(ancient, simulation);

    expect(ancient.illness).toBeCloseTo(0.5 + Variables.ILLNESS_ONSET_AMOUNT - Variables.ILLNESS_RECOVERY_AMOUNT);
    expect(ancient.illness).toBeLessThan(0.5);
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
