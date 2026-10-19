import { describe, expect, it } from 'vitest';
import { buildFamilySummary } from './family-summary';
import { completedDates, type Series } from './domain';

function readings(overrides: Partial<Record<keyof Series, (number | null)[]>> = {}): Series {
  const dates = completedDates();
  const values = { sleep: Array(14).fill(7), steps: Array(14).fill(2100), heart: Array(14).fill(67), ...overrides };
  return Object.fromEntries(Object.entries(values).map(([metric, data]) => [metric, dates.map((date, index) => ({ date, value: data[index] ?? null }))])) as Series;
}

describe('family summaries', () => {
  it('turns declining sleep into a qualified feeling summary and a quiet visit suggestion', () => {
    const summary = buildFamilySummary(readings({ sleep: [...Array(7).fill(8), ...Array(7).fill(6)] }));
    expect(summary.patterns.find(pattern => pattern.metric === 'sleep')?.direction).toBe('down');
    expect(summary.meaning.join(' ')).toMatch(/may feel.*tired/i);
    expect(summary.visits.join(' ')).toMatch(/quiet|breaks/i);
    expect(summary.visits).toHaveLength(3);
  });

  it('cannot infer wellbeing when all readings are missing', () => {
    const missing = Array(14).fill(null);
    const summary = buildFamilySummary(readings({ sleep: missing, steps: missing, heart: missing }));
    expect(summary.patterns).toHaveLength(0);
    expect(summary.missing).toEqual(['sleep', 'steps', 'heart']);
    expect(summary.meaning.join(' ')).toMatch(/not enough|cannot tell|can’t tell/i);
    expect(summary.visits.join(' ')).toMatch(/care team/i);
  });

  it('keeps partial readings explicit rather than describing a complete usual pattern', () => {
    const summary = buildFamilySummary(readings({ heart: Array(14).fill(null) }));
    expect(summary.patterns.map(pattern => pattern.metric)).toEqual(['sleep', 'steps']);
    expect(summary.missing).toEqual(['heart']);
  });

  it('preserves a changed heart-rate prompt when sleep has also fallen', () => {
    const summary = buildFamilySummary(readings({
      sleep: [...Array(7).fill(8), ...Array(7).fill(6)],
      heart: [...Array(7).fill(65), ...Array(7).fill(75)],
    }));
    expect(summary.meaning.join(' ')).toMatch(/heart rate/i);
    expect(summary.visits.join(' ')).toMatch(/care team.*changed reading/i);
  });

  it('does not treat sparse weeks as a reliable decline', () => {
    const sparse = [8, 8, null, null, null, null, null, 5, 5, null, null, null, null, null];
    const summary = buildFamilySummary(readings({ sleep: sparse, steps: sparse, heart: sparse }));
    expect(summary.patterns).toHaveLength(0);
  });

  it('distinguishes increased recorded sleep from feeling rested', () => {
    const summary = buildFamilySummary(readings({ sleep: [...Array(7).fill(6), ...Array(7).fill(8)] }));
    expect(summary.patterns.find(pattern => pattern.metric === 'sleep')?.direction).toBe('up');
    expect(summary.meaning.join(' ')).toMatch(/not necessarily.*rest|does not.*rest/i);
  });
});
