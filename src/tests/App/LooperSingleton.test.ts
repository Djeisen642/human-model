import LooperSingleton from '../../App/LooperSingleton';

const silent = () => {};

describe('LooperSingleton', () => {
  it('should be a singleton', () => {
    const looper1: LooperSingleton = LooperSingleton.getInstance();
    const looper2: LooperSingleton = LooperSingleton.getInstance();

    expect(looper1).toBe(looper2);
  });

  it('should start', () => {
    const looper: LooperSingleton = LooperSingleton.getInstance();

    const returnValue = looper.start(100, 100, 42, silent);

    expect(returnValue).toBeTruthy();
  });

  it('produces one snapshot per tick', () => {
    const looper = LooperSingleton.getInstance();
    const ticks = 5;

    const simulation = looper.start(10, ticks, 42, silent);

    expect(simulation.history.length).toBe(ticks);
  });

  it('produces deterministic results for the same seed', () => {
    const looper = LooperSingleton.getInstance();

    const sim1 = looper.start(20, 10, 1, silent);
    const sim2 = looper.start(20, 10, 1, silent);

    expect(sim1.history.map(s => s.population)).toEqual(sim2.history.map(s => s.population));
  });

  it('populates decadeHistory every 10 ticks', () => {
    const looper = LooperSingleton.getInstance();

    const sim = looper.start(20, 30, 1, silent);

    expect(sim.decadeHistory).toHaveLength(3);
    expect(sim.decadeHistory[0].endTick).toBe(10);
    expect(sim.decadeHistory[1].endTick).toBe(20);
    expect(sim.decadeHistory[2].endTick).toBe(30);
  });

  it('produces no decadeHistory for runs shorter than 10 ticks', () => {
    const looper = LooperSingleton.getInstance();

    const sim = looper.start(10, 9, 1, silent);

    expect(sim.decadeHistory).toHaveLength(0);
  });
});
