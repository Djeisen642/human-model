import Variables from '../../Helpers/Variables';
import { applyOverrides, parseSeeds } from '../../../scripts/overrides';

/**
 * Every research claim in this project rests on the sweep harness setting and restoring `Variables`
 * correctly. That helper used to exist as four byte-identical copies under `scripts/`, outside the
 * jest root, and a restore bug lived in all four at once (`docs/future-ideas.md`). One copy now, and
 * these are its tests — reached from `src/tests/` so the existing jest root still finds them.
 */
describe('applyOverrides', () => {
  it('sets a numeric constant and restores it', () => {
    const before = Variables.BASE_CHILDBIRTH_RATE;
    const restore = applyOverrides(['BASE_CHILDBIRTH_RATE=0.9']);
    expect(Variables.BASE_CHILDBIRTH_RATE).toBe(0.9);
    restore();
    expect(Variables.BASE_CHILDBIRTH_RATE).toBe(before);
  });

  it('restores the ORIGINAL value when a key is overridden twice', () => {
    // The bug this exists to prevent: `--both K=1 --b K=2` composes two overrides of one key, and
    // saving both made restore() replay them in order, leaving the intermediate value behind.
    const before = Variables.TAX_RATE;
    const restore = applyOverrides(['TAX_RATE=0.1', 'TAX_RATE=0.3']);
    expect(Variables.TAX_RATE).toBe(0.3); // last one wins
    restore();
    expect(Variables.TAX_RATE).toBe(before);
  });

  it('restores every key when several are set at once', () => {
    const before = [Variables.TAX_RATE, Variables.WELFARE_THRESHOLD, Variables.EXPERIENCE_CAP];
    const restore = applyOverrides(['TAX_RATE=0.5', 'WELFARE_THRESHOLD=99', 'EXPERIENCE_CAP=7']);
    restore();
    expect([Variables.TAX_RATE, Variables.WELFARE_THRESHOLD, Variables.EXPERIENCE_CAP]).toEqual(before);
  });

  it('rejects an unknown constant', () => {
    expect(() => applyOverrides(['NOT_A_REAL_CONSTANT=1'])).toThrow(/Unknown Variables constant/);
  });

  it('rejects a non-numeric constant', () => {
    expect(() => applyOverrides(['validate=1'])).toThrow(/Not a Variables constant/);
  });

  it('rejects a non-numeric value', () => {
    expect(() => applyOverrides(['TAX_RATE=high'])).toThrow(/Non-numeric override/);
  });

  it('enforces cross-constant invariants, leaving the broken value visible to the caller', () => {
    // Variables.validate() runs after the assignment, so the throw happens with the estate shares
    // already summing to something other than 1.0 — the caller must restore, which sweep/compare do.
    const before = Variables.ESTATE_COMMUNITY_SHARE;
    expect(() => applyOverrides(['ESTATE_COMMUNITY_SHARE=0.9'])).toThrow(/must sum to 1.0/);
    Variables.ESTATE_COMMUNITY_SHARE = before;
    expect(() => Variables.validate()).not.toThrow();
  });

  it('accepts all three estate shares moved together', () => {
    const restore = applyOverrides([
      'ESTATE_COMMUNITY_SHARE=0.5', 'ESTATE_PARTNER_SHARE=0.3', 'ESTATE_CHILDREN_SHARE=0.2',
    ]);
    expect(Variables.ESTATE_COMMUNITY_SHARE).toBe(0.5);
    restore();
    expect(Variables.ESTATE_COMMUNITY_SHARE).toBe(0.40);
  });
});

describe('parseSeeds', () => {
  it('expands a single N to seeds 1..N', () => {
    expect(parseSeeds('4', [])).toEqual([1, 2, 3, 4]);
  });

  it('parses an explicit comma list, whitespace and all', () => {
    expect(parseSeeds('42, 7,1', [])).toEqual([42, 7, 1]);
  });

  it('falls back when no spec is given', () => {
    expect(parseSeeds(undefined, [1, 2, 3])).toEqual([1, 2, 3]);
  });
});
