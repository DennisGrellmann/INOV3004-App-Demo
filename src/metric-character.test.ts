import { describe, expect, it } from 'vitest';
import { completedDates, trendFor, type MetricId } from './domain';
import { characterFor } from './metric-character';

function character(metric: MetricId, previous: number | null, current: number | null) {
  const series = completedDates().map((date, index) => ({ date, value: index < 7 ? previous : current }));
  return characterFor(metric, trendFor(series, metric));
}

describe('overview characters', () => {
  it('distinguishes five sleep levels, including the approved sleepy alternative', () => {
    const results = [6.5, 7.3, 8, 8.7, 9.5].map(hours => character('sleep', 8, hours));
    expect(results.map(result => result.emoji)).toEqual(['😪', '🥱', '😴', '🛌', '💤']);
    expect(results.map(result => result.level)).toEqual(['much-lower', 'lower', 'similar', 'higher', 'much-higher']);
    expect(results[0].label).toBe('Much less sleep');
  });

  it('uses the resident’s previous activity rather than a fixed step goal', () => {
    expect(character('steps', 1000, 1350)).toMatchObject({ emoji: '🏃💨', level: 'much-higher' });
    expect(character('steps', 8000, 7000)).toMatchObject({ emoji: '🚶', level: 'similar' });
    expect(character('steps', 1000, 0)).toMatchObject({ emoji: '🪑', level: 'much-lower' });
  });

  it('applies the two activity change boundaries without rounding first', () => {
    expect(character('steps', 1000, 1149).level).toBe('similar');
    expect(character('steps', 1000, 1150)).toMatchObject({ emoji: '🏃', level: 'higher' });
    expect(character('steps', 1000, 1299).level).toBe('higher');
    expect(character('steps', 1000, 1300).level).toBe('much-higher');
    expect(character('steps', 1000, 850)).toMatchObject({ emoji: '🧍', level: 'lower' });
  });

  it('shows heart rate direction without claiming that higher or lower is healthier', () => {
    const results = [55, 60, 65, 70, 75].map(rate => character('heart', 65, rate));
    expect(results.map(result => result.emoji)).toEqual(['❤️⬇️', '❤️↘️', '❤️', '❤️↗️', '❤️⬆️']);
    expect(results.map(result => result.label).join(' ')).not.toMatch(/healthy|unhealthy|good|bad/i);
  });

  it('keeps the lowest absolute values neutral when a weekly comparison is missing', () => {
    for (const metric of ['sleep', 'steps', 'heart'] as const) {
      expect(character(metric, null, 0)).toMatchObject({ emoji: '❔', label: 'Not enough data', level: 'unknown' });
      expect(character(metric, 7, null).level).toBe('unknown');
    }
  });

  it('does not assign an expression from fewer than five days in either week', () => {
    const series = completedDates().map((date, index) => ({ date, value: index < 4 ? 8 : index >= 7 ? 3 : null }));
    expect(characterFor('sleep', trendFor(series, 'sleep')).level).toBe('unknown');
  });
});
