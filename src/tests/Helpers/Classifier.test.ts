import { classifyPerson, countPerType, parsePersonTypes } from '../../Helpers/Classifier';
import Person from '../../App/Person';

/**
 * Build a Person with sensible defaults; override individual fields per test.
 *
 * @param overrides - field values to override on the person
 * @returns a constructed person with overrides applied
 */
function makePerson(overrides: Partial<Person>): Person {
  const p = new Person([]);
  Object.assign(p, overrides);
  return p;
}

describe('Classifier', () => {
  describe('classifyPerson', () => {
    it('returns an empty array when no types are declared', () => {
      const p = makePerson({ intelligence: 8 });
      expect(classifyPerson(p, {})).toEqual([]);
    });

    it('matches a single type when every range is satisfied', () => {
      const p = makePerson({ intelligence: 8, learningIntent: 0.7 });
      const types = {
        engineer: { percentage: 0.1, ranges: { intelligence: [7, 11] as [number, number], learningIntent: [0.5, 1.0] as [number, number] } },
      };
      expect(classifyPerson(p, types)).toEqual(['engineer']);
    });

    it('does not match when any single range is violated', () => {
      const p = makePerson({ intelligence: 8, learningIntent: 0.3 });
      const types = {
        engineer: { percentage: 0.1, ranges: { intelligence: [7, 11] as [number, number], learningIntent: [0.5, 1.0] as [number, number] } },
      };
      expect(classifyPerson(p, types)).toEqual([]);
    });

    it('treats upper bound as exclusive', () => {
      const p = makePerson({ intelligence: 11 });
      const types = {
        engineer: { percentage: 0.1, ranges: { intelligence: [7, 11] as [number, number] } },
      };
      expect(classifyPerson(p, types)).toEqual([]);
    });

    it('treats lower bound as inclusive', () => {
      const p = makePerson({ intelligence: 7 });
      const types = {
        engineer: { percentage: 0.1, ranges: { intelligence: [7, 11] as [number, number] } },
      };
      expect(classifyPerson(p, types)).toEqual(['engineer']);
    });

    it('matches an empty-ranges type for every person', () => {
      const p = makePerson({});
      const types = { anyone: { percentage: 1.0, ranges: {} } };
      expect(classifyPerson(p, types)).toEqual(['anyone']);
    });

    it('returns multiple matches when ranges overlap', () => {
      const p = makePerson({ intelligence: 9, charisma: 9, killingIntent: 0 });
      const types = {
        smart: { percentage: 0.1, ranges: { intelligence: [7, 11] as [number, number] } },
        charming: { percentage: 0.1, ranges: { charisma: [7, 11] as [number, number] } },
      };
      expect(classifyPerson(p, types).sort()).toEqual(['charming', 'smart']);
    });

    it('only checks declared fields (partial overrides)', () => {
      const p = makePerson({ intelligence: 1, charisma: 9 });
      const types = {
        charming: { percentage: 0.1, ranges: { charisma: [7, 11] as [number, number] } },
      };
      expect(classifyPerson(p, types)).toEqual(['charming']);
    });
  });

  describe('countPerType', () => {
    it('returns zero for every declared type when population is empty', () => {
      const types = {
        a: { percentage: 0.1, ranges: { intelligence: [7, 11] as [number, number] } },
        b: { percentage: 0.1, ranges: { charisma: [7, 11] as [number, number] } },
      };
      expect(countPerType([], types)).toEqual({ a: 0, b: 0 });
    });

    it('counts each person against every type they match', () => {
      const people = [
        makePerson({ intelligence: 9, charisma: 9 }),
        makePerson({ intelligence: 9, charisma: 1 }),
        makePerson({ intelligence: 1, charisma: 9 }),
      ];
      const types = {
        smart: { percentage: 0.1, ranges: { intelligence: [7, 11] as [number, number] } },
        charming: { percentage: 0.1, ranges: { charisma: [7, 11] as [number, number] } },
      };
      expect(countPerType(people, types)).toEqual({ smart: 2, charming: 2 });
    });

    it('includes types with zero matches', () => {
      const people = [makePerson({ intelligence: 1 })];
      const types = {
        nobody: { percentage: 0.1, ranges: { intelligence: [9, 11] as [number, number] } },
      };
      expect(countPerType(people, types)).toEqual({ nobody: 0 });
    });
  });

  describe('parsePersonTypes', () => {
    it('returns empty when raw is undefined', () => {
      expect(parsePersonTypes(undefined)).toEqual({});
    });

    it('returns empty when raw is null', () => {
      expect(parsePersonTypes(null)).toEqual({});
    });

    it('throws when raw is not an object', () => {
      expect(() => parsePersonTypes(42)).toThrow();
      expect(() => parsePersonTypes('string')).toThrow();
      expect(() => parsePersonTypes([])).toThrow();
    });

    it('parses a well-formed config', () => {
      const result = parsePersonTypes({
        engineer: { percentage: 0.1, ranges: { intelligence: [7, 11] } },
      });
      expect(result.engineer.percentage).toBe(0.1);
      expect(result.engineer.ranges.intelligence).toEqual([7, 11]);
    });

    it('throws when percentages sum to > 1.0', () => {
      expect(() => parsePersonTypes({
        a: { percentage: 0.7, ranges: {} },
        b: { percentage: 0.5, ranges: {} },
      })).toThrow(/sum/);
    });

    it('allows sum == 1.0', () => {
      const result = parsePersonTypes({
        a: { percentage: 0.5, ranges: {} },
        b: { percentage: 0.5, ranges: {} },
      });
      expect(Object.keys(result)).toHaveLength(2);
    });

    it('allows sum < 1.0', () => {
      const result = parsePersonTypes({
        a: { percentage: 0.1, ranges: {} },
      });
      expect(result.a.percentage).toBe(0.1);
    });

    it('throws on negative percentage', () => {
      expect(() => parsePersonTypes({
        a: { percentage: -0.1, ranges: {} },
      })).toThrow();
    });

    it('throws when percentage is missing', () => {
      expect(() => parsePersonTypes({
        a: { ranges: {} },
      })).toThrow();
    });

    it('warns and skips unknown range fields', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const result = parsePersonTypes({
        engineer: { percentage: 0.1, ranges: { intelligence: [7, 11], foo: [1, 2] } },
      });
      expect(result.engineer.ranges.intelligence).toEqual([7, 11]);
      expect((result.engineer.ranges as Record<string, unknown>).foo).toBeUndefined();
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it('warns and skips malformed range tuples', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const result = parsePersonTypes({
        engineer: { percentage: 0.1, ranges: { intelligence: [7], charisma: [1, 2] } },
      });
      expect(result.engineer.ranges.intelligence).toBeUndefined();
      expect(result.engineer.ranges.charisma).toEqual([1, 2]);
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it('warns and skips range with min > max', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const result = parsePersonTypes({
        engineer: { percentage: 0.1, ranges: { intelligence: [11, 7] } },
      });
      expect(result.engineer.ranges.intelligence).toBeUndefined();
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it('allows missing ranges (entire range field absent)', () => {
      const result = parsePersonTypes({
        anyone: { percentage: 0.5 },
      });
      expect(result.anyone.ranges).toEqual({});
    });
  });
});
