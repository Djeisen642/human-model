import Variables from '../../Helpers/Variables';

describe('Variables.validate', () => {
  const saved = {
    community: Variables.ESTATE_COMMUNITY_SHARE,
    partner: Variables.ESTATE_PARTNER_SHARE,
    children: Variables.ESTATE_CHILDREN_SHARE,
    happinessCritical: Variables.HAPPINESS_RESOURCE_CRITICAL_THRESHOLD,
    happinessLow: Variables.HAPPINESS_RESOURCE_LOW_THRESHOLD,
    happinessComfortable: Variables.HAPPINESS_RESOURCE_COMFORTABLE_THRESHOLD,
    happinessCriticalElderly: Variables.HAPPINESS_RESOURCE_CRITICAL_THRESHOLD_ELDERLY,
    happinessLowElderly: Variables.HAPPINESS_RESOURCE_LOW_THRESHOLD_ELDERLY,
    happinessComfortableElderly: Variables.HAPPINESS_RESOURCE_COMFORTABLE_THRESHOLD_ELDERLY,
    childbirthMin: Variables.CHILDBIRTH_RESOURCE_MIN,
    childbirthScale: Variables.CHILDBIRTH_RESOURCE_SCALE,
  };

  afterEach(() => {
    Variables.ESTATE_COMMUNITY_SHARE = saved.community;
    Variables.ESTATE_PARTNER_SHARE = saved.partner;
    Variables.ESTATE_CHILDREN_SHARE = saved.children;
    Variables.HAPPINESS_RESOURCE_CRITICAL_THRESHOLD = saved.happinessCritical;
    Variables.HAPPINESS_RESOURCE_LOW_THRESHOLD = saved.happinessLow;
    Variables.HAPPINESS_RESOURCE_COMFORTABLE_THRESHOLD = saved.happinessComfortable;
    Variables.HAPPINESS_RESOURCE_CRITICAL_THRESHOLD_ELDERLY = saved.happinessCriticalElderly;
    Variables.HAPPINESS_RESOURCE_LOW_THRESHOLD_ELDERLY = saved.happinessLowElderly;
    Variables.HAPPINESS_RESOURCE_COMFORTABLE_THRESHOLD_ELDERLY = saved.happinessComfortableElderly;
    Variables.CHILDBIRTH_RESOURCE_MIN = saved.childbirthMin;
    Variables.CHILDBIRTH_RESOURCE_SCALE = saved.childbirthScale;
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

  it('throws when the adult happiness ladder is inverted (ARD 067)', () => {
    Variables.HAPPINESS_RESOURCE_LOW_THRESHOLD = 5;
    expect(() => Variables.validate()).toThrow(/HAPPINESS_RESOURCE_CRITICAL_THRESHOLD < HAPPINESS_RESOURCE_LOW_THRESHOLD < HAPPINESS_RESOURCE_COMFORTABLE_THRESHOLD.*ARD 067/);
  });

  it('throws when the adult happiness ladder has equal adjacent thresholds (ARD 067)', () => {
    Variables.HAPPINESS_RESOURCE_LOW_THRESHOLD = Variables.HAPPINESS_RESOURCE_CRITICAL_THRESHOLD;
    expect(() => Variables.validate()).toThrow(/ARD 067/);
  });

  it('throws when the elderly happiness ladder is inverted (ARD 067)', () => {
    Variables.HAPPINESS_RESOURCE_COMFORTABLE_THRESHOLD_ELDERLY = Variables.HAPPINESS_RESOURCE_LOW_THRESHOLD_ELDERLY - 1;
    expect(() => Variables.validate()).toThrow(/HAPPINESS_RESOURCE_CRITICAL_THRESHOLD_ELDERLY < HAPPINESS_RESOURCE_LOW_THRESHOLD_ELDERLY < HAPPINESS_RESOURCE_COMFORTABLE_THRESHOLD_ELDERLY.*ARD 067/);
  });

  it('does not couple the adult and elderly happiness ladders', () => {
    // Defaults are non-monotonic against each other in years (ARD 067 Decision) and must still pass.
    expect(() => Variables.validate()).not.toThrow();
  });

  it('throws when CHILDBIRTH_RESOURCE_MIN and CHILDBIRTH_RESOURCE_SCALE are equal (ARD 067)', () => {
    // Equal values divide 0/0 → NaN, and `rng() >= NaN` is false, so birth would become certain.
    Variables.CHILDBIRTH_RESOURCE_MIN = Variables.CHILDBIRTH_RESOURCE_SCALE;
    expect(() => Variables.validate()).toThrow(/CHILDBIRTH_RESOURCE_MIN must be strictly less than CHILDBIRTH_RESOURCE_SCALE.*ARD 067/);
  });

  it('throws when CHILDBIRTH_RESOURCE_MIN and CHILDBIRTH_RESOURCE_SCALE are inverted (ARD 067)', () => {
    // Inverted, the fertility ramp changes sign: the famine brake becomes a famine accelerator.
    Variables.CHILDBIRTH_RESOURCE_MIN = 30;
    Variables.CHILDBIRTH_RESOURCE_SCALE = 20;
    expect(() => Variables.validate()).toThrow(/CHILDBIRTH_RESOURCE_MIN must be strictly less than CHILDBIRTH_RESOURCE_SCALE.*ARD 067/);
  });
});
