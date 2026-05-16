import KillEvent from '../../Events/KillEvent';
import Person from '../../App/Person';
import Simulation from '../../App/Simulation';
import Constants from '../../Helpers/Constants';
import Variables from '../../Helpers/Variables';
import KillingRecord from '../../Records/KillingRecord';

describe('KillEvent', () => {
  describe('no-op cases', () => {
    it('does not throw and does nothing when no other person exists (sole person)', () => {
      const sim = new Simulation();
      const killer = new Person([]);
      killer.killingIntent = 1.0;
      killer.age = 24; // peak killing age
      // give killer and victim resources so Gini > 0 won't be needed, but set up a person
      killer.resources = 50;
      sim.add(killer);

      // rng always returns 0, so attempt roll always passes; but getRandomOther returns null
      const event = new KillEvent(() => 0);
      expect(() => event.execute(killer, sim)).not.toThrow();
      expect(sim.getLiving()).toContain(killer);
    });

    it('does nothing when killingIntent is zero (attempt never fires)', () => {
      const sim = new Simulation();
      const killer = new Person([]);
      const victim = new Person([]);
      killer.killingIntent = 0;
      killer.age = 24;
      killer.resources = 100;
      victim.resources = 0;
      sim.add(killer);
      sim.add(victim);

      // rng always returns 0 — attempt prob is 0 so rng(0) >= 0 is false only if prob > 0
      // killingIntent=0 → attemptProb=0 → rng() >= 0 is always true → no attempt
      const event = new KillEvent(() => 0);
      event.execute(killer, sim);

      expect(sim.getLiving()).toContain(victim);
      expect(killer.killed.size).toBe(0);
    });
  });

  describe('attempt roll', () => {
    it('attempt fires when rng is below attempt probability (high intent, high Gini)', () => {
      const sim = new Simulation();
      const killer = new Person([]);
      const victim = new Person([]);
      killer.killingIntent = 1.0;
      killer.age = 24; // peak killing age → ageModifier = 1.0
      killer.resources = 100;
      victim.resources = 0; // Gini will be high: one person has 100, other has 0
      victim.constitution = 10; // high constitution → success never fires
      sim.add(killer);
      sim.add(victim);

      // The attempt prob = 1.0 * 1.0 * (1 + Gini * 1.5).
      // Gini with resources [100, 0] is 0.5. So prob = 1.0 * 1.0 * (1 + 0.5 * 1.5) = 1.75, capped effectively at always firing.
      // rng sequence: first call for attempt check → 0 (< 1.75 → attempt fires)
      //               second call for getRandomOther → 0 (selects victim)
      //               third call for success check → 0.99 (>= KILL_SUCCESS_BASE/10 = 0.05 → no kill)
      let callCount = 0;
      const rng = () => {
        callCount++;
        if (callCount === 1) return 0;    // attempt passes
        if (callCount === 2) return 0;    // selects only candidate (victim)
        return 0.99;                      // success fails
      };

      const event = new KillEvent(rng);
      event.execute(killer, sim);

      // victim still alive (success roll failed), but attempt did fire (3 rng calls used)
      expect(sim.getLiving()).toContain(victim);
      expect(callCount).toBe(3);
    });

    it('attempt does not fire when rng exceeds attempt probability', () => {
      const sim = new Simulation();
      const killer = new Person([]);
      const victim = new Person([]);
      killer.killingIntent = 0.01;
      killer.age = 24;
      killer.resources = 50;
      victim.resources = 50;
      victim.constitution = 1;
      sim.add(killer);
      sim.add(victim);

      // With equal resources, Gini ≈ 0; attemptProb ≈ 0.01 * 1.0 * 1.0 = 0.01
      // rng returns 0.99 — always above the attempt prob, so attempt never fires
      let callCount = 0;
      const rng = () => { callCount++; return 0.99; };

      const event = new KillEvent(rng);
      event.execute(killer, sim);

      expect(sim.getLiving()).toContain(victim);
      expect(killer.killed.size).toBe(0);
      // Only the attempt roll fires (1 call); no subsequent calls
      expect(callCount).toBe(1);
    });
  });

  describe('success roll', () => {
    it('kills victim when success roll fires (low constitution)', () => {
      const sim = new Simulation();
      const killer = new Person([]);
      const victim = new Person([]);
      killer.killingIntent = 1.0;
      killer.age = 24;
      killer.resources = 100;
      victim.resources = 0;
      victim.constitution = 1; // successProb = KILL_SUCCESS_BASE / 1 = 0.5
      sim.add(killer);
      sim.add(victim);

      // rng sequence: attempt=0 (passes), getRandomOther=0, success=0 (< 0.5 → kills)
      let callCount = 0;
      const rng = () => {
        callCount++;
        if (callCount === 1) return 0; // attempt passes
        if (callCount === 2) return 0; // selects victim
        return 0;                      // success fires
      };

      const event = new KillEvent(rng);
      event.execute(killer, sim);

      expect(sim.getLiving()).not.toContain(victim);
      expect(sim.getLiving()).toContain(killer);
    });

    it('does not kill when success roll fails (high constitution)', () => {
      const sim = new Simulation();
      const killer = new Person([]);
      const victim = new Person([]);
      killer.killingIntent = 1.0;
      killer.age = 24;
      killer.resources = 100;
      victim.resources = 0;
      victim.constitution = 10; // successProb = KILL_SUCCESS_BASE / 10 = 0.05
      sim.add(killer);
      sim.add(victim);

      // rng: attempt=0 (passes), getRandomOther=0, success=0.99 (>= 0.05 → no kill)
      let callCount = 0;
      const rng = () => {
        callCount++;
        if (callCount === 1) return 0;
        if (callCount === 2) return 0;
        return 0.99;
      };

      const event = new KillEvent(rng);
      event.execute(killer, sim);

      expect(sim.getLiving()).toContain(victim);
      expect(killer.killed.size).toBe(0);
    });
  });

  describe('records on successful kill', () => {
    it('adds KillingRecord to killer.killed with correct victim and age', () => {
      const sim = new Simulation();
      const killer = new Person([]);
      const victim = new Person([]);
      killer.killingIntent = 1.0;
      killer.age = 30;
      killer.resources = 100;
      victim.resources = 0;
      victim.constitution = 1;
      sim.add(killer);
      sim.add(victim);

      // rng: attempt=0, getRandomOther=0, success=0
      const rng = () => 0;

      const event = new KillEvent(rng);
      event.execute(killer, sim);

      expect(killer.killed.size).toBe(1);
      expect(killer.killed.has(victim)).toBe(true);
      const record = killer.killed.get(victim) as KillingRecord;
      expect(record).toBeInstanceOf(KillingRecord);
      expect(record.person).toBe(victim);
      expect(record.age).toBe(30);
    });

    it('sets DeathRecord on victim with cause MURDER and killer reference', () => {
      const sim = new Simulation();
      const killer = new Person([]);
      const victim = new Person([]);
      killer.killingIntent = 1.0;
      killer.age = 24;
      killer.resources = 100;
      victim.resources = 0;
      victim.constitution = 1;
      sim.add(killer);
      sim.add(victim);

      const rng = () => 0;

      const event = new KillEvent(rng);
      event.execute(killer, sim);

      expect(victim.causeOfDeath).not.toBeNull();
      expect(victim.causeOfDeath!.cause).toBe(Constants.CAUSE_OF_DEATH.MURDER);
      expect(victim.causeOfDeath!.killer).toBe(killer);
    });

    it('does not push a record when success roll fails (attempt fired but no kill)', () => {
      const sim = new Simulation();
      const killer = new Person([]);
      const victim = new Person([]);
      killer.killingIntent = 1.0;
      killer.age = 24;
      killer.resources = 100;
      victim.resources = 0;
      victim.constitution = 10; // successProb = 0.05
      sim.add(killer);
      sim.add(victim);

      // attempt=0 (passes), getRandomOther=0, success=0.99 (fails)
      let callCount = 0;
      const rng = () => { callCount++; if (callCount <= 2) return 0; return 0.99; };

      const event = new KillEvent(rng);
      event.execute(killer, sim);

      expect(killer.killed.size).toBe(0);
      expect(victim.causeOfDeath).toBeNull();
    });
  });

  describe('Gini modulation', () => {
    it('higher Gini raises attempt probability (attempt fires more readily)', () => {
      // Test that at high Gini the attempt fires while a moderate rng value would not trigger
      // at low Gini. We construct two scenarios differing only in resource distribution.

      // High Gini scenario: resources [100, 0] → Gini ≈ 0.5
      // attemptProb = 1.0 * 1.0 * (1 + 0.5 * 1.5) = 1.75 → fires for any rng value
      const simHighGini = new Simulation();
      const killerH = new Person([]);
      const victimH = new Person([]);
      killerH.killingIntent = 1.0;
      killerH.age = 24;
      killerH.resources = 100;
      victimH.resources = 0;
      victimH.constitution = 10; // success never fires
      simHighGini.add(killerH);
      simHighGini.add(victimH);

      let callCountH = 0;
      const rngH = () => { callCountH++; if (callCountH === 1) return 0.9; return 0; };
      new KillEvent(rngH).execute(killerH, simHighGini);
      // with high Gini, attemptProb ≥ 1.75, rng=0.9 < 1.75 → attempt fires (callCount reaches 3)
      expect(callCountH).toBe(3);

      // Low Gini scenario: resources [50, 50] → Gini = 0
      // attemptProb = 1.0 * 1.0 * (1 + 0 * 1.5) = 1.0 → fires for rng < 1.0, so still fires...
      // Actually at Gini=0 with intent=1.0, attemptProb=1.0 which fires for any rng < 1.
      // Use a lower intent to show difference:
      // killingIntent=0.5, age=24, Gini=0 → prob=0.5; rng=0.7 → no attempt
      // killingIntent=0.5, age=24, Gini=0.5 → prob=0.5*(1+0.75)=0.875; rng=0.7 → attempt fires
      const simLowGini = new Simulation();
      const killerL = new Person([]);
      const victimL = new Person([]);
      killerL.killingIntent = 0.5;
      killerL.age = 24;
      killerL.resources = 50;
      victimL.resources = 50; // equal resources → Gini = 0
      victimL.constitution = 10;
      simLowGini.add(killerL);
      simLowGini.add(victimL);

      let callCountL = 0;
      const rngL = () => { callCountL++; return 0.7; };
      new KillEvent(rngL).execute(killerL, simLowGini);
      // Gini=0, prob=0.5; rng=0.7 >= 0.5 → attempt does NOT fire → only 1 rng call
      expect(callCountL).toBe(1);

      // Same setup but with high Gini
      const simHighGini2 = new Simulation();
      const killerH2 = new Person([]);
      const victimH2 = new Person([]);
      killerH2.killingIntent = 0.5;
      killerH2.age = 24;
      killerH2.resources = 100;
      victimH2.resources = 0;   // Gini ≈ 0.5
      victimH2.constitution = 10;
      simHighGini2.add(killerH2);
      simHighGini2.add(victimH2);

      let callCountH2 = 0;
      // rng: attempt=0.7, getRandomOther=0, success=0.99 (success fails, constitution=10)
      const rngH2 = () => { callCountH2++; if (callCountH2 === 1) return 0.7; if (callCountH2 === 2) return 0; return 0.99; };
      new KillEvent(rngH2).execute(killerH2, simHighGini2);
      // Gini=0.5, prob=0.5*(1+0.5*1.5)=0.875; rng=0.7 < 0.875 → attempt fires (3 calls)
      expect(callCountH2).toBe(3);
    });
  });

  describe('KILL_SUCCESS_BASE calibration', () => {
    it('success probability scales inversely with constitution', () => {
      // constitution=1: successProb = KILL_SUCCESS_BASE / 1 = KILL_SUCCESS_BASE
      // constitution=5: successProb = KILL_SUCCESS_BASE / 5
      // Verify the formula indirectly: at constitution=5, success fires only below KILL_SUCCESS_BASE/5
      const sim = new Simulation();
      const killer = new Person([]);
      const victim = new Person([]);
      killer.killingIntent = 1.0;
      killer.age = 24;
      killer.resources = 100;
      victim.resources = 0;
      victim.constitution = 5; // successProb = 0.5 / 5 = 0.1
      sim.add(killer);
      sim.add(victim);

      // rng: attempt=0 (passes), getRandomOther=0, success=0.05 (< 0.1 → kills)
      let callCount = 0;
      const rng = () => { callCount++; if (callCount <= 2) return 0; return 0.05; };

      const event = new KillEvent(rng);
      event.execute(killer, sim);

      expect(victim.causeOfDeath).not.toBeNull();
      expect(victim.causeOfDeath!.cause).toBe(Constants.CAUSE_OF_DEATH.MURDER);

      // Verify the threshold: rng=0.15 would NOT kill (>= 0.1)
      const sim2 = new Simulation();
      const killer2 = new Person([]);
      const victim2 = new Person([]);
      killer2.killingIntent = 1.0;
      killer2.age = 24;
      killer2.resources = 100;
      victim2.resources = 0;
      victim2.constitution = 5;
      sim2.add(killer2);
      sim2.add(victim2);

      let callCount2 = 0;
      const rng2 = () => { callCount2++; if (callCount2 <= 2) return 0; return 0.15; };

      new KillEvent(rng2).execute(killer2, sim2);
      expect(victim2.causeOfDeath).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('treats constitution=0 same as constitution=1 (Math.max guard)', () => {
      const sim = new Simulation();
      const killer = new Person([]);
      const victim = new Person([]);
      killer.killingIntent = 1.0;
      killer.age = 24;
      killer.resources = 100;
      victim.resources = 0;
      victim.constitution = 0; // Math.max(1, 0) → successProb = KILL_SUCCESS_BASE / 1
      sim.add(killer);
      sim.add(victim);

      // rng: attempt=0 (passes), getRandomOther=0, success=0 (< KILL_SUCCESS_BASE → kills)
      const rng = () => 0;
      new KillEvent(rng).execute(killer, sim);

      // Should kill (constitution=0 is floored to 1, same as constitution=1)
      expect(sim.getLiving()).not.toContain(victim);
      expect(victim.causeOfDeath?.cause).toBe(Constants.CAUSE_OF_DEATH.MURDER);
    });
  });

  describe('Variables.KILL_SUCCESS_BASE', () => {
    it('KILL_SUCCESS_BASE is defined and between 0 and 1', () => {
      expect(Variables.KILL_SUCCESS_BASE).toBeGreaterThan(0);
      expect(Variables.KILL_SUCCESS_BASE).toBeLessThanOrEqual(1);
    });

    it('KILL_GINI_SCALAR is defined and positive', () => {
      expect(Variables.KILL_GINI_SCALAR).toBeGreaterThan(0);
    });
  });
});
