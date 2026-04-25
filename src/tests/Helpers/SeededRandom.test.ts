import SeededRandom from '../../Helpers/SeededRandom';

describe('SeededRandom', () => {
  it('should produce values in [0, 1)', () => {
    const rng = new SeededRandom(42);
    for (let i = 0; i < 100; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('should produce the same sequence for the same seed', () => {
    const a = new SeededRandom(12345);
    const b = new SeededRandom(12345);
    for (let i = 0; i < 20; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('should produce different sequences for different seeds', () => {
    const a = new SeededRandom(1).next();
    const b = new SeededRandom(2).next();
    expect(a).not.toBe(b);
  });

  it('asRNG should return a callable that advances state', () => {
    const seeded = new SeededRandom(99);
    const rng = seeded.asRNG();
    const v1 = rng();
    const v2 = rng();
    expect(v1).toBeGreaterThanOrEqual(0);
    expect(v1).toBeLessThan(1);
    expect(v1).not.toBe(v2);
  });
});
