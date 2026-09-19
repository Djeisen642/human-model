import SeededRandom from '../../Helpers/SeededRandom';
import { standardNormal } from '../../Helpers/SeededRandom';

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

describe('standardNormal', () => {
  it('returns immediately when the source only ever yields 0', () => {
    // Regression: the first implementation retried on a zero draw to keep Math.log finite, which
    // never terminates against an exhausted scripted rng (they return 0 forever) or an unlucky LCG
    // state. Taking u = 1 - rng() is branch-free and cannot hang.
    const result = standardNormal(() => 0);
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBeCloseTo(0, 12); // Math.sqrt(-0) is -0, which toBe(0) rejects.
  });

  it('consumes exactly two values per call, so draw sequences stay reproducible', () => {
    const drawn: number[] = [];
    const rng = (): number => { const v = [0.1, 0.2, 0.3, 0.4][drawn.length]; drawn.push(v); return v; };
    standardNormal(rng);
    expect(drawn.length).toBe(2);
    standardNormal(rng);
    expect(drawn.length).toBe(4);
  });

  it('is deterministic for a given source', () => {
    expect(standardNormal(() => 0.5)).toBe(standardNormal(() => 0.5));
  });

  it('produces a distribution with roughly zero mean and unit variance', () => {
    const rnd = new SeededRandom(7).asRNG();
    const xs = Array.from({ length: 20000 }, () => standardNormal(rnd));
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const variance = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length;
    expect(Math.abs(mean)).toBeLessThan(0.05);
    expect(variance).toBeGreaterThan(0.9);
    expect(variance).toBeLessThan(1.1);
  });
});
