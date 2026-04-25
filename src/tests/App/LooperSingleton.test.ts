import LooperSingleton from '../../App/LooperSingleton';

describe('LooperSingleton', () => {
  it('should be a singleton', () => {
    const looper1: LooperSingleton = LooperSingleton.getInstance();
    const looper2: LooperSingleton = LooperSingleton.getInstance();

    expect(looper1).toBe(looper2);
  });

  it('should start', () => {
    const looper: LooperSingleton = LooperSingleton.getInstance();

    const returnValue = looper.start();

    expect(returnValue).toBeTruthy();
  });

  it('produces one snapshot per tick', () => {
    const looper = LooperSingleton.getInstance();
    const ticks = 5;

    const simulation = looper.start(10, ticks);

    expect(simulation.history.length).toBe(ticks);
  });

  it('produces deterministic results for the same seed', () => {
    const looper = LooperSingleton.getInstance();

    const sim1 = looper.start(20, 10, 1);
    const sim2 = looper.start(20, 10, 1);

    expect(sim1.history.map(s => s.population)).toEqual(sim2.history.map(s => s.population));
  });
});
