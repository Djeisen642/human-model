import StealEvent from '../../Events/StealEvent';
import Person from '../../App/Person';
import Simulation from '../../App/Simulation';
import Variables from '../../Helpers/Variables';
import StealingRecord from '../../Records/StealingRecord';

describe('StealEvent', () => {
  describe('no-op cases', () => {
    it('does not throw and does nothing when getRandomOther returns null (sole person)', () => {
      const sim = new Simulation();
      const thief = new Person([]);
      thief.resources = 50;
      sim.add(thief);

      const event = new StealEvent(() => 0);
      expect(() => event.execute(thief, sim)).not.toThrow();
      expect(thief.resources).toBe(50);
      expect(thief.amountStolen.length).toBe(0);
    });

    it('does nothing when victim has zero resources', () => {
      const sim = new Simulation();
      const thief = new Person([]);
      const victim = new Person([]);
      thief.resources = 50;
      victim.resources = 0;
      sim.add(thief);
      sim.add(victim);

      // rng returns 0 so getRandomOther picks the only candidate
      const event = new StealEvent(() => 0);
      event.execute(thief, sim);

      expect(thief.resources).toBe(50);
      expect(victim.resources).toBe(0);
      expect(thief.amountStolen.length).toBe(0);
    });
  });

  describe('amount calculation', () => {
    it('takes STEAL_FRACTION of victim resources when below STEAL_MAX_AMOUNT', () => {
      const sim = new Simulation();
      const thief = new Person([]);
      const victim = new Person([]);
      // victim.resources * STEAL_FRACTION = 50 * 0.1 = 5, which is below STEAL_MAX_AMOUNT (10)
      thief.resources = 0;
      victim.resources = 50;
      sim.add(thief);
      sim.add(victim);

      // rng=0.9: victim selection picks index 0 of filtered list (the only candidate); 0.9 is above
      // BASE_DETECT_RATE_STEAL * (1 + 1*DETECTION_CRIME_COUNT_SCALAR) ≈ 0.0525, so no detection fires.
      const event = new StealEvent(() => 0.9);
      event.execute(thief, sim);

      const expectedAmount = 50 * Variables.STEAL_FRACTION;
      expect(victim.resources).toBeCloseTo(50 - expectedAmount);
      expect(thief.resources).toBeCloseTo(expectedAmount);
    });

    it('caps amount at STEAL_MAX_AMOUNT when victim is wealthy', () => {
      const sim = new Simulation();
      const thief = new Person([]);
      const victim = new Person([]);
      // victim.resources * STEAL_FRACTION = 1000 * 0.1 = 100, which exceeds STEAL_MAX_AMOUNT (10)
      thief.resources = 0;
      victim.resources = 1000;
      sim.add(thief);
      sim.add(victim);

      // rng=0.9: picks victim (sole candidate); above detection threshold so no forfeiture.
      const event = new StealEvent(() => 0.9);
      event.execute(thief, sim);

      expect(thief.resources).toBeCloseTo(Variables.STEAL_MAX_AMOUNT);
      expect(victim.resources).toBeCloseTo(1000 - Variables.STEAL_MAX_AMOUNT);
    });
  });

  describe('resource transfer', () => {
    it('thief gains exactly the amount victim loses', () => {
      const sim = new Simulation();
      const thief = new Person([]);
      const victim = new Person([]);
      thief.resources = 20;
      victim.resources = 60;
      sim.add(thief);
      sim.add(victim);

      const before = { thief: thief.resources, victim: victim.resources };
      // rng=0.9: picks victim (sole candidate); above detection threshold so no forfeiture.
      const event = new StealEvent(() => 0.9);
      event.execute(thief, sim);

      const gained = thief.resources - before.thief;
      const lost = before.victim - victim.resources;
      expect(gained).toBeCloseTo(lost);
      expect(gained).toBeGreaterThan(0);
    });
  });

  describe('StealingRecord', () => {
    it('pushes a StealingRecord with correct victim reference, amount, and thief age', () => {
      const sim = new Simulation();
      const thief = new Person([]);
      const victim = new Person([]);
      thief.age = 24;
      thief.resources = 0;
      victim.resources = 50;
      sim.add(thief);
      sim.add(victim);

      const event = new StealEvent(() => 0);
      event.execute(thief, sim);

      expect(thief.amountStolen.length).toBe(1);
      const record = thief.amountStolen[0];
      expect(record).toBeInstanceOf(StealingRecord);
      expect(record.person).toBe(victim);
      expect(record.age).toBe(24);
      expect(record.amount).toBeCloseTo(50 * Variables.STEAL_FRACTION);
    });

    it('does not push a record when victim has no resources', () => {
      const sim = new Simulation();
      const thief = new Person([]);
      const victim = new Person([]);
      victim.resources = 0;
      sim.add(thief);
      sim.add(victim);

      const event = new StealEvent(() => 0);
      event.execute(thief, sim);

      expect(thief.amountStolen.length).toBe(0);
    });
  });

  describe('detection and jailing (ARD 035)', () => {
    it('detection probability scales with prior crime count', () => {
      // detectProb = BASE_DETECT_RATE_STEAL * (1 + priorCrimes * DETECTION_CRIME_COUNT_SCALAR)
      // The steal record is pushed BEFORE detection, so even a first-time thief has priorCrimes=1.
      // thief1 (no prior records): after theft, priorCrimes=1 → detectProb = 0.05*(1+1*0.05) = 0.0525
      // thief2 (3 prior records): after theft, priorCrimes=4 → detectProb = 0.05*(1+4*0.05) = 0.06
      // rng=0.055 sits between: above 0.0525 (no detection for thief1), below 0.06 (detection for thief2).
      const sim1 = new Simulation();
      const thief1 = new Person([]);
      const victim1 = new Person([]);
      thief1.resources = 50;
      victim1.resources = 100;
      sim1.add(thief1);
      sim1.add(victim1);

      // rng=0.055: 0.055 >= detectProb(0.0525) → no detection
      const event1 = new StealEvent(() => 0.055);
      event1.execute(thief1, sim1);
      expect(thief1.jailedTicksRemaining).toBe(0);

      // Now give thief2 many prior crimes so detectProb is comfortably above 0.055
      const sim2 = new Simulation();
      const thief2 = new Person([]);
      const victim2 = new Person([]);
      thief2.resources = 50;
      victim2.resources = 100;
      sim2.add(thief2);
      sim2.add(victim2);
      // 3 prior steal records so that after this theft priorCrimes = 4
      thief2.amountStolen.push(new StealingRecord(victim2, 1, 24));
      thief2.amountStolen.push(new StealingRecord(victim2, 1, 24));
      thief2.amountStolen.push(new StealingRecord(victim2, 1, 24));
      // priorCrimes = 4 → detectProb = 0.05 * (1 + 4*0.05) = 0.06; 0.055 < 0.06 → detected
      const event2 = new StealEvent(() => 0.055);
      event2.execute(thief2, sim2);
      expect(thief2.jailedTicksRemaining).toBe(Variables.JAIL_TICKS_STEAL);
    });

    it('sentence is set to JAIL_TICKS_STEAL on detection', () => {
      const sim = new Simulation();
      const thief = new Person([]);
      const victim = new Person([]);
      thief.resources = 100;
      victim.resources = 100;
      sim.add(thief);
      sim.add(victim);

      // rng=0 always fires detection
      const event = new StealEvent(() => 0);
      event.execute(thief, sim);

      expect(thief.jailedTicksRemaining).toBe(Variables.JAIL_TICKS_STEAL);
    });

    it('resources are forfeited to communityPool on detection', () => {
      const sim = new Simulation();
      const thief = new Person([]);
      const victim = new Person([]);
      thief.resources = 100;
      victim.resources = 100;
      sim.add(thief);
      sim.add(victim);

      const poolBefore = sim.communityPool;
      // rng=0 forces detection
      const event = new StealEvent(() => 0);
      event.execute(thief, sim);

      // Forfeit = thief's post-theft resources * JAIL_RESOURCE_FORFEIT_FRACTION
      // Stolen = min(100*0.1, 10) = 10 → thief.resources after theft = 110
      // forfeit = 110 * 0.8 = 88
      expect(sim.communityPool).toBeGreaterThan(poolBefore);
      expect(thief.resources).toBeCloseTo(100 + 10 - (100 + 10) * Variables.JAIL_RESOURCE_FORFEIT_FRACTION);
    });

    it('sentences are additive (second conviction adds to remaining sentence)', () => {
      const sim = new Simulation();
      const thief = new Person([]);
      const victim1 = new Person([]);
      const victim2 = new Person([]);
      thief.resources = 100;
      victim1.resources = 100;
      victim2.resources = 100;
      sim.add(thief);
      sim.add(victim1);
      sim.add(victim2);

      // Both detections fire (rng=0)
      const e1 = new StealEvent(() => 0);
      e1.execute(thief, sim);
      const afterFirst = thief.jailedTicksRemaining;

      const e2 = new StealEvent(() => 0);
      e2.execute(thief, sim);

      expect(thief.jailedTicksRemaining).toBeGreaterThan(afterFirst);
    });
  });

  describe('emboldening on non-detection (ARD 036)', () => {
    it('increments stealingIntent when detection does not fire', () => {
      const sim = new Simulation();
      const thief = new Person([]);
      const victim = new Person([]);
      thief.stealingIntent = 0.2;
      thief.resources = 20;
      victim.resources = 100;
      sim.add(thief);
      sim.add(victim);

      const before = thief.stealingIntent;
      // rng=0.9: above detection threshold → no detection → emboldening fires
      const event = new StealEvent(() => 0.9);
      event.execute(thief, sim);

      expect(thief.stealingIntent).toBeCloseTo(before + Variables.STEALING_EMBOLDEN_INCREMENT);
    });

    it('does not embolden when detection fires', () => {
      const sim = new Simulation();
      const thief = new Person([]);
      const victim = new Person([]);
      thief.stealingIntent = 0.2;
      thief.resources = 100;
      victim.resources = 100;
      sim.add(thief);
      sim.add(victim);

      const before = thief.stealingIntent;
      // rng=0: detection fires
      const event = new StealEvent(() => 0);
      event.execute(thief, sim);

      expect(thief.stealingIntent).toBe(before);
    });

    it('stealingIntent cannot exceed STEALING_INTENT_CAP', () => {
      const sim = new Simulation();
      const thief = new Person([]);
      const victim = new Person([]);
      thief.stealingIntent = Variables.STEALING_INTENT_CAP - 0.001;
      thief.resources = 20;
      victim.resources = 100;
      sim.add(thief);
      sim.add(victim);

      // rng=0.9: no detection → emboldening fires but capped
      const event = new StealEvent(() => 0.9);
      event.execute(thief, sim);

      expect(thief.stealingIntent).toBeCloseTo(Variables.STEALING_INTENT_CAP);
    });
  });
});
