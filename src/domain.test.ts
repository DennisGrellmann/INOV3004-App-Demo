import { describe, expect, it } from 'vitest';
import { average, careInsight, completedDates, trendFor, type DayValue } from './domain';

const week = (values: (number | null)[]): DayValue[] => values.map((value, index) => ({ date: `2026-10-${String(index + 1).padStart(2, '0')}`, value }));

describe('weekly comparisons', () => {
  it('uses completed calendar dates across month boundaries, excluding today', () => {
    expect(completedDates(3, new Date(2026, 2, 2, 0, 30))).toEqual(['2026-02-27', '2026-02-28', '2026-03-01']);
  });
  it('distinguishes a real zero from a missing reading', () => {
    expect(average(week([0, null, 100]))).toBe(50);
    expect(average(week([null, null]))).toBeNull();
  });
  it('detects falling sleep from measured weekly averages', () => {
    const trend = trendFor(week([...Array(7).fill(7.5), ...Array(7).fill(6)]), 'sleep');
    expect(trend).toMatchObject({ current: 6, previous: 7.5, delta: -1.5, coverage: 7, direction: 'down' });
    expect(careInsight('sleep', trend).meaning).toContain('possible effects to check');
    expect(careInsight('sleep', trend).attention).toBe(true);
  });
  it('does not infer a trend when either week has fewer than five measured days', () => {
    const trend = trendFor(week([7, 7, 7, 7, null, null, null, 5, 5, 5, 5, 5, 5, 5]), 'sleep');
    expect(trend).toMatchObject({ delta: null, direction: 'unknown', coverage: 7, previousCoverage: 4 });
    expect(careInsight('sleep', trend).attention).toBe(false);
  });
  it('uses a relative threshold for steps and tolerates small changes', () => {
    expect(trendFor(week([...Array(7).fill(2000), ...Array(7).fill(1800)]), 'steps').direction).toBe('steady');
    expect(trendFor(week([...Array(7).fill(2000), ...Array(7).fill(1500)]), 'steps').direction).toBe('down');
  });
});
