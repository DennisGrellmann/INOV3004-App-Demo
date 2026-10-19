import { completedDates, dateKey, metricIds, type DayValue, type MetricId, type Series } from './domain';

export const scopes: Record<MetricId, string> = {
  sleep: 'https://www.googleapis.com/auth/googlehealth.sleep.readonly',
  steps: 'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly',
  heart: 'https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly',
};

type CivilDate = { year?: number; month?: number; day?: number };
type CivilTime = { date?: CivilDate };
export type SleepPoint = {
  dataPointName?: string;
  sleep?: {
    interval?: { civilEndTime?: CivilTime; endTime?: string; endUtcOffset?: string };
    summary?: { minutesAsleep?: string | number };
    metadata?: { mainSleep?: boolean; nap?: boolean; processed?: boolean };
  };
};
export type HeartPoint = { dailyRestingHeartRate?: { date?: CivilDate; beatsPerMinute?: string | number } };
export type StepPoint = { civilStartTime?: CivilTime; steps?: { countSum?: string | number } };

export function civilKey(date?: CivilDate): string | null {
  if (!date?.year || !date.month || !date.day) return null;
  if (date.month < 1 || date.month > 12 || date.day < 1 || date.day > 31) return null;
  return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
}

function measured(value: unknown, max: number): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= max ? parsed : null;
}

export function normaliseSleep(points: SleepPoint[], dates: string[]): DayValue[] {
  const byDate = new Map<string, number>();
  for (const { sleep } of points) {
    if (!sleep || sleep.metadata?.nap || sleep.metadata?.mainSleep === false || sleep.metadata?.processed === false) continue;
    const minutes = measured(sleep.summary?.minutesAsleep, 1440);
    let day = civilKey(sleep.interval?.civilEndTime?.date);
    // Preserve the resident's end-of-sleep civil date, even across timezones.
    if (!day && sleep.interval?.endTime && sleep.interval.endUtcOffset !== undefined) {
      const offset = Number(sleep.interval.endUtcOffset.replace(/s$/, ''));
      const timestamp = Date.parse(sleep.interval.endTime) + offset * 1000;
      if (Number.isFinite(timestamp)) day = new Date(timestamp).toISOString().slice(0, 10);
    }
    if (!day || minutes === null || minutes === 0) continue;
    byDate.set(day, Math.max(byDate.get(day) ?? 0, minutes / 60));
  }
  return dates.map(date => ({ date, value: byDate.get(date) ?? null }));
}

export function normaliseSteps(points: StepPoint[], dates: string[]): DayValue[] {
  const byDate = new Map<string, number>();
  for (const point of points) {
    const day = civilKey(point.civilStartTime?.date);
    const count = measured(point.steps?.countSum, 1_000_000);
    if (day && count !== null) byDate.set(day, count);
  }
  return dates.map(date => ({ date, value: byDate.get(date) ?? null }));
}

export function normaliseHeart(points: HeartPoint[], dates: string[]): DayValue[] {
  const byDate = new Map<string, number>();
  for (const point of points) {
    const day = civilKey(point.dailyRestingHeartRate?.date);
    const bpm = measured(point.dailyRestingHeartRate?.beatsPerMinute, 300);
    if (day && bpm !== null && bpm > 0) byDate.set(day, bpm);
  }
  return dates.map(date => ({ date, value: byDate.get(date) ?? null }));
}

export class HealthApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function healthRequest<T>(token: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`https://health.googleapis.com/v4/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    if (response.status === 401) throw new HealthApiError(401, 'Your Google session has expired. Connect again to refresh your data.');
    if (response.status === 403) throw new HealthApiError(403, 'Access was not granted. Check Google Health API enablement, the consent screen, and your approved scopes.');
    if (response.status === 400) throw new HealthApiError(400, 'Google could not complete this request. Check that this account is linked in the Google Health mobile app and your project has API access.');
    if (response.status === 429) throw new HealthApiError(429, 'Google’s request limit was reached. Wait a moment before trying again.');
    throw new HealthApiError(response.status, 'Google Health is unavailable right now. Please try again later.');
  }
  return response.json() as Promise<T>;
}

async function allPages<T>(token: string, type: string, filter: string): Promise<T[]> {
  const points: T[] = [];
  let pageToken: string | undefined;
  const seen = new Set<string>();
  do {
    const query = new URLSearchParams({ filter, pageSize: '25', dataSourceFamily: 'users/me/dataSourceFamilies/all-sources' });
    if (pageToken) query.set('pageToken', pageToken);
    const result = await healthRequest<{ dataPoints?: T[]; nextPageToken?: string }>(token, `users/me/dataTypes/${type}/dataPoints:reconcile?${query}`);
    points.push(...(result.dataPoints ?? []));
    pageToken = result.nextPageToken;
    if (pageToken && seen.has(pageToken)) throw new Error('Google returned repeated pages. Please try syncing again.');
    if (pageToken) seen.add(pageToken);
  } while (pageToken);
  return points;
}

export type HealthResult = { series: Series; issues: Partial<Record<MetricId, string>>; syncedAt: Date };

export async function loadHealth(token: string, grantedScopes: string, now = new Date()): Promise<HealthResult> {
  const identity = await healthRequest<{ healthUserId?: string }>(token, 'users/me/identity');
  if (!identity.healthUserId) throw new Error('This Google account does not have a linked Google Health profile.');
  const dates = completedDates(14, now);
  const start = dates[0];
  const end = dateKey(now);
  const rangeFilter = (field: string) => `${field} >= "${start}" AND ${field} < "${end}"`;
  const granted = new Set(grantedScopes.split(/\s+/));
  const denied = () => Promise.reject(new Error('Permission for this metric was not granted. Reconnect and allow the requested read-only scope.'));
  const sleep = granted.has(scopes.sleep)
    ? allPages<SleepPoint>(token, 'sleep', rangeFilter('sleep.interval.civil_end_time')).then(points => normaliseSleep(points, dates))
    : denied();
  const heart = granted.has(scopes.heart)
    ? allPages<HeartPoint>(token, 'daily-resting-heart-rate', rangeFilter('daily_resting_heart_rate.date')).then(points => normaliseHeart(points, dates))
    : denied();
  const steps = async () => {
    if (!granted.has(scopes.steps)) return denied();
    const civil = (value: string) => { const [year, month, day] = value.split('-').map(Number); return { date: { year, month, day } }; };
    const points: StepPoint[] = [];
    let pageToken: string | undefined;
    const seen = new Set<string>();
    do {
      const result = await healthRequest<{ rollupDataPoints?: StepPoint[]; nextPageToken?: string }>(token, 'users/me/dataTypes/steps/dataPoints:dailyRollUp', {
        range: { start: civil(start), end: civil(end) }, windowSizeDays: 1,
        dataSourceFamily: 'users/me/dataSourceFamilies/all-sources', ...(pageToken ? { pageToken } : {}),
      });
      points.push(...(result.rollupDataPoints ?? []));
      pageToken = result.nextPageToken;
      if (pageToken && seen.has(pageToken)) throw new Error('Google returned repeated pages. Please try syncing again.');
      if (pageToken) seen.add(pageToken);
    } while (pageToken);
    return normaliseSteps(points, dates);
  };
  const results = await Promise.allSettled([sleep, steps(), heart]);
  const series = {} as Series;
  const issues: HealthResult['issues'] = {};
  for (const [index, metric] of metricIds.entries()) {
    const result = results[index];
    if (result.status === 'fulfilled') series[metric] = result.value;
    else {
      if (result.reason instanceof HealthApiError && result.reason.status === 401) throw result.reason;
      series[metric] = dates.map(date => ({ date, value: null }));
      issues[metric] = result.reason instanceof Error ? result.reason.message : 'This metric could not be loaded.';
    }
  }
  return { series, issues, syncedAt: new Date() };
}
