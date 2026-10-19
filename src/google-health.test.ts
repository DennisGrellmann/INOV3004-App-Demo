import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadHealth, normaliseHeart, normaliseSleep, normaliseSteps, scopes } from './google-health';

afterEach(() => vi.unstubAllGlobals());
const dates = ['2026-10-16', '2026-10-17', '2026-10-18'];
const date = { year: 2026, month: 10, day: 17 };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });

describe('Google data normalisation', () => {
  it('uses minutes asleep, excludes naps and unfinished sessions, and never invents readings', () => {
    const result = normaliseSleep([
      { sleep: { interval: { civilEndTime: { date } }, summary: { minutesAsleep: '360' }, metadata: { mainSleep: true } } },
      { sleep: { interval: { civilEndTime: { date } }, summary: { minutesAsleep: '50' }, metadata: { nap: true } } },
      { sleep: { interval: { civilEndTime: { date } }, summary: { minutesAsleep: '480' }, metadata: { processed: false } } },
    ], dates);
    expect(result.map(day => day.value)).toEqual([null, 6, null]);
  });
  it('uses the resident’s civil wake date, not the browser timezone', () => {
    const result = normaliseSleep([{ sleep: { interval: { endTime: '2026-10-16T22:00:00Z', endUtcOffset: '36000s' }, summary: { minutesAsleep: '420' } } }], dates);
    expect(result[1].value).toBe(7);
  });
  it('does not add multiple sleep sessions or double count repeated pages', () => {
    const points = [360, 360, 300].map(minutes => ({ sleep: { interval: { civilEndTime: { date } }, summary: { minutesAsleep: minutes } } }));
    expect(normaliseSleep(points, dates)[1].value).toBe(6);
  });
  it('preserves recorded zero steps but leaves absent and invalid measurements empty', () => {
    expect(normaliseSteps([{ civilStartTime: { date }, steps: { countSum: '0' } }], dates).map(day => day.value)).toEqual([null, 0, null]);
    expect(normaliseHeart([{ dailyRestingHeartRate: { date, beatsPerMinute: '-5' } }], dates)[1].value).toBeNull();
  });
});

describe('Google API integration', () => {
  it('validates identity, follows pagination, and sends the documented civil date filters and rollup body', async () => {
    const fetcher = vi.fn(async (input: string, init?: RequestInit) => {
      const url = new URL(input);
      if (url.pathname.endsWith('/identity')) return json({ healthUserId: 'test-account' });
      if (url.pathname.includes('/sleep/')) {
        expect(url.searchParams.get('filter')).toBe('sleep.interval.civil_end_time >= "2026-10-05" AND sleep.interval.civil_end_time < "2026-10-19"');
        if (!url.searchParams.get('pageToken')) return json({ dataPoints: [], nextPageToken: 'page-two' });
        return json({ dataPoints: [{ sleep: { interval: { civilEndTime: { date } }, summary: { minutesAsleep: '390' } } }] });
      }
      if (url.pathname.includes('/steps/')) {
        expect(init?.method).toBe('POST');
        expect(JSON.parse(init!.body as string)).toMatchObject({ range: { start: { date: { year: 2026, month: 10, day: 5 } }, end: { date: { year: 2026, month: 10, day: 19 } } }, windowSizeDays: 1 });
        return json({ rollupDataPoints: [{ civilStartTime: { date }, steps: { countSum: '1500' } }] });
      }
      return json({ dataPoints: [{ dailyRestingHeartRate: { date, beatsPerMinute: '68' } }] });
    });
    vi.stubGlobal('fetch', fetcher);
    const result = await loadHealth('test-token', Object.values(scopes).join(' '), new Date(2026, 9, 19));
    expect(result.series.sleep.find(day => day.date === '2026-10-17')?.value).toBe(6.5);
    expect(result.series.steps.find(day => day.date === '2026-10-17')?.value).toBe(1500);
    expect(result.series.heart.find(day => day.date === '2026-10-17')?.value).toBe(68);
    expect(result.issues).toEqual({});
    expect(fetcher).toHaveBeenCalledTimes(5);
  });
  it('reports denied metrics individually without substituting sample data', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string) => input.endsWith('/identity') ? json({ healthUserId: 'test' }) : json({ dataPoints: [] })));
    const result = await loadHealth('test-token', scopes.sleep);
    expect(result.issues.steps).toContain('not granted');
    expect(result.issues.heart).toContain('not granted');
    expect(result.series.steps.every(day => day.value === null)).toBe(true);
    expect(result.series.sleep.every(day => day.value === null)).toBe(true);
  });
  it('rejects an unlinked account before loading any readings', async () => {
    const fetcher = vi.fn(async () => json({}));
    vi.stubGlobal('fetch', fetcher);
    await expect(loadHealth('test-token', scopes.sleep)).rejects.toThrow('linked Google Health profile');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('rejects an expired session rather than presenting it as connected', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({}, 401)));
    await expect(loadHealth('test-token', scopes.sleep)).rejects.toThrow('expired');
  });
});
