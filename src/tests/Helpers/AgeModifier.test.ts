import { ageModifier } from '../../Helpers/AgeModifier';

describe('ageModifier', () => {
  it('returns 1 at peak age', () => {
    expect(ageModifier(26, 26, 12, 0.02)).toBe(1);
  });

  it('returns less than 1 away from peak age', () => {
    expect(ageModifier(40, 26, 12, 0.02)).toBeLessThan(1);
  });

  it('clamps to floor when far from peak', () => {
    // age 80, peak 26, scale 12: raw = 1 - ((80-26)/12)^2 = 1 - 20.25 = -19.25, clamped to floor
    expect(ageModifier(80, 26, 12, 0.02)).toBe(0.02);
  });

  it('never returns below floor', () => {
    for (const age of [0, 5, 60, 100]) {
      expect(ageModifier(age, 26, 12, 0.02)).toBeGreaterThanOrEqual(0.02);
    }
  });

  it('never returns above 1', () => {
    for (const age of [0, 18, 26, 40, 70]) {
      expect(ageModifier(age, 26, 12, 0.02)).toBeLessThanOrEqual(1);
    }
  });

  it('is symmetric around peak age', () => {
    const left = ageModifier(20, 26, 12, 0.02);
    const right = ageModifier(32, 26, 12, 0.02);
    expect(left).toBeCloseTo(right);
  });

  it('respects a high floor that covers the peak', () => {
    expect(ageModifier(50, 26, 5, 0.99)).toBe(0.99);
  });
});
