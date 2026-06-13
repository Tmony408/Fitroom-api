import { ratePct, topCounts, sum } from './analytics.util';

describe('analytics.util', () => {
  describe('ratePct', () => {
    it('computes a percentage to 1dp', () => {
      expect(ratePct(1, 2)).toBe(50);
      expect(ratePct(1, 3)).toBe(33.3);
    });
    it('never divides by zero', () => {
      expect(ratePct(5, 0)).toBe(0);
      expect(ratePct(0, 0)).toBe(0);
    });
  });

  describe('topCounts', () => {
    it('counts and sorts descending', () => {
      expect(topCounts(['L', 'M', 'L', 'XL', 'L', 'M'])).toEqual([
        { key: 'L', count: 3 },
        { key: 'M', count: 2 },
        { key: 'XL', count: 1 },
      ]);
    });
    it('skips null/undefined/empty', () => {
      expect(topCounts(['L', null, undefined, '', 'L'])).toEqual([{ key: 'L', count: 2 }]);
    });
    it('respects the limit', () => {
      expect(topCounts(['a', 'b', 'c', 'd'], 2)).toHaveLength(2);
    });
    it('breaks ties alphabetically', () => {
      expect(topCounts(['b', 'a'])).toEqual([{ key: 'a', count: 1 }, { key: 'b', count: 1 }]);
    });
  });

  it('sum adds numbers', () => {
    expect(sum([1, 2, 3])).toBe(6);
    expect(sum([])).toBe(0);
  });
});
