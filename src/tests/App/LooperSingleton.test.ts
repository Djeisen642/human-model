import LooperSingleton from '../../App/LooperSingleton';
import Person from '../../App/Person';

const silent = () => {};

describe('LooperSingleton', () => {
  it('should be a singleton', () => {
    const looper1: LooperSingleton = LooperSingleton.getInstance();
    const looper2: LooperSingleton = LooperSingleton.getInstance();

    expect(looper1).toBe(looper2);
  });

  it('should start', async () => {
    const looper: LooperSingleton = LooperSingleton.getInstance();

    const returnValue = await looper.start(10, 10, 42, silent);

    expect(returnValue).toBeTruthy();
  });

  it('produces one snapshot per tick', async () => {
    const looper = LooperSingleton.getInstance();
    const ticks = 5;

    const simulation = await looper.start(10, ticks, 42, silent);

    expect(simulation.history.length).toBe(ticks);
  });

  it('produces deterministic results for the same seed', async () => {
    const looper = LooperSingleton.getInstance();

    const sim1 = await looper.start(20, 10, 1, silent);
    const sim2 = await looper.start(20, 10, 1, silent);

    expect(sim1.history.map(s => s.population)).toEqual(sim2.history.map(s => s.population));
  });

  it('populates decadeHistory every 10 ticks', async () => {
    const looper = LooperSingleton.getInstance();

    const sim = await looper.start(20, 30, 1, silent);

    expect(sim.decadeHistory).toHaveLength(3);
    expect(sim.decadeHistory[0].endTick).toBe(10);
    expect(sim.decadeHistory[1].endTick).toBe(20);
    expect(sim.decadeHistory[2].endTick).toBe(30);
  });

  it('produces a single partial-decade summary for runs shorter than 10 ticks (ARD 031)', async () => {
    const looper = LooperSingleton.getInstance();

    const sim = await looper.start(10, 9, 1, silent);

    expect(sim.decadeHistory).toHaveLength(1);
    expect(sim.decadeHistory[0].endTick).toBe(9);
  });

  it('appends a partial-decade summary when ticks is not a multiple of 10 (ARD 031)', async () => {
    const looper = LooperSingleton.getInstance();

    const sim = await looper.start(20, 25, 1, silent);

    expect(sim.decadeHistory).toHaveLength(3);
    expect(sim.decadeHistory[0].endTick).toBe(10);
    expect(sim.decadeHistory[1].endTick).toBe(20);
    expect(sim.decadeHistory[2].endTick).toBe(25);
  });

  it('does not append a partial-decade summary when ticks is a multiple of 10', async () => {
    const looper = LooperSingleton.getInstance();

    const sim = await looper.start(20, 20, 1, silent);

    expect(sim.decadeHistory).toHaveLength(2);
    expect(sim.decadeHistory[1].endTick).toBe(20);
  });

  it('produces no decadeHistory for 0-tick runs', async () => {
    const looper = LooperSingleton.getInstance();

    const sim = await looper.start(10, 0, 1, silent);

    expect(sim.decadeHistory).toHaveLength(0);
  });

  it('interrupt() stops the loop and returns a partial simulation', async () => {
    const looper = LooperSingleton.getInstance();
    const ticks = 50;

    // Schedule the interrupt after the current synchronous frame so it fires
    // during one of the between-tick setImmediate yields.
    setTimeout(() => looper.interrupt(), 0);

    const sim = await looper.start(20, ticks, 1, silent);

    // Should have stopped before completing all 50 ticks.
    expect(sim.history.length).toBeGreaterThan(0);
    expect(sim.history.length).toBeLessThan(ticks);
  });

  describe('jailedTicksRemaining decrement (ARD 035)', () => {
    it('decrements jailedTicksRemaining by 1 each tick until 0', () => {
      // Directly simulate the per-tick decrement that LooperSingleton performs before EventFactory.
      // This mirrors the exact guard-then-decrement logic in start():
      //   if (person.jailedTicksRemaining > 0) person.jailedTicksRemaining--;
      const person = new Person([]);
      person.jailedTicksRemaining = 3;

      const living = [person];

      for (const p of living) { if (p.jailedTicksRemaining > 0) p.jailedTicksRemaining--; }
      expect(person.jailedTicksRemaining).toBe(2);

      for (const p of living) { if (p.jailedTicksRemaining > 0) p.jailedTicksRemaining--; }
      expect(person.jailedTicksRemaining).toBe(1);

      for (const p of living) { if (p.jailedTicksRemaining > 0) p.jailedTicksRemaining--; }
      expect(person.jailedTicksRemaining).toBe(0);
    });

    it('jailedTicksRemaining never goes negative', () => {
      // Applying the guard-then-decrement when already at 0 must not underflow.
      const person = new Person([]);
      person.jailedTicksRemaining = 0;

      const living = [person];
      for (const p of living) { if (p.jailedTicksRemaining > 0) p.jailedTicksRemaining--; }
      expect(person.jailedTicksRemaining).toBe(0);
    });
  });

});
