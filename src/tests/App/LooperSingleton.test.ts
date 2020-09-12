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
});