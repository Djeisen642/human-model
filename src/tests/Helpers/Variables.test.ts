import Variables from '../../Helpers/Variables';

describe('Variables.validate', () => {
  const saved = {
    community: Variables.ESTATE_COMMUNITY_SHARE,
    partner: Variables.ESTATE_PARTNER_SHARE,
    children: Variables.ESTATE_CHILDREN_SHARE,
  };

  afterEach(() => {
    Variables.ESTATE_COMMUNITY_SHARE = saved.community;
    Variables.ESTATE_PARTNER_SHARE = saved.partner;
    Variables.ESTATE_CHILDREN_SHARE = saved.children;
  });

  it('passes at defaults', () => {
    expect(() => Variables.validate()).not.toThrow();
  });

  it('throws when the estate shares sum above 1.0', () => {
    Variables.ESTATE_COMMUNITY_SHARE = 0.9;
    expect(() => Variables.validate()).toThrow(/must sum to 1\.0 \(ARD 042\), got 1\.5/);
  });

  it('throws when the estate shares sum below 1.0', () => {
    Variables.ESTATE_CHILDREN_SHARE = 0;
    expect(() => Variables.validate()).toThrow(/must sum to 1\.0 \(ARD 042\), got 0\.75/);
  });

  it('throws when a share is not a finite number', () => {
    // Every comparison against NaN is false, so a tolerance check alone would let this through.
    Variables.ESTATE_COMMUNITY_SHARE = Number.NaN;
    expect(() => Variables.validate()).toThrow(/must sum to 1\.0 \(ARD 042\)/);
    Variables.ESTATE_COMMUNITY_SHARE = Number.POSITIVE_INFINITY;
    expect(() => Variables.validate()).toThrow(/must sum to 1\.0 \(ARD 042\)/);
  });

  it('tolerates floating-point drift in shares that are meant to sum to 1.0', () => {
    Variables.ESTATE_COMMUNITY_SHARE = 0.7;
    Variables.ESTATE_PARTNER_SHARE = 0.2;
    Variables.ESTATE_CHILDREN_SHARE = 0.1;
    expect(Variables.ESTATE_COMMUNITY_SHARE + Variables.ESTATE_PARTNER_SHARE + Variables.ESTATE_CHILDREN_SHARE).not.toBe(1);
    expect(() => Variables.validate()).not.toThrow();
  });
});
