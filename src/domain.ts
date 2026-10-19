export type MetricId = 'sleep' | 'steps' | 'heart';
export type DayValue = { date: string; value: number | null };
export type Series = Record<MetricId, DayValue[]>;
export type Resident = {
  id: string; name: string; initials: string; age: number | null; room: string;
  note: string; source: 'google'; series: Series;
};
export type Trend = {
  current: number | null; previous: number | null; delta: number | null;
  coverage: number; previousCoverage: number; direction: 'up' | 'down' | 'steady' | 'unknown';
};

export const metrics = {
  sleep: { label: 'Sleep', full: 'Nightly sleep', unit: 'hrs', color: '#7761ad', threshold: 0.5, description: 'Time asleep in the main nightly sleep session.' },
  steps: { label: 'Activity', full: 'Daily activity', unit: 'steps', color: '#347f70', threshold: 0.15, description: 'Total steps recorded each day, including assisted movement.' },
  heart: { label: 'Heart health', full: 'Resting heart rate', unit: 'bpm', color: '#b36859', threshold: 5, description: 'Daily resting heart rate reported by the device.' },
} as const;
export const metricIds: MetricId[] = ['sleep', 'steps', 'heart'];

export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function completedDates(count = 14, now = new Date()): string[] {
  return Array.from({ length: count }, (_, index) => {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - count + index, 12);
    return dateKey(day);
  });
}

export function dateLabel(date: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-AU', options);
}

export function average(days: DayValue[]): number | null {
  const values = days.flatMap(day => day.value !== null && Number.isFinite(day.value) ? [day.value] : []);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

export function trendFor(series: DayValue[], metric: MetricId): Trend {
  const currentDays = series.slice(-7);
  const previousDays = series.slice(-14, -7);
  const coverage = currentDays.filter(day => day.value !== null).length;
  const previousCoverage = previousDays.filter(day => day.value !== null).length;
  const current = average(currentDays);
  const previous = average(previousDays);
  const delta = current !== null && previous !== null && coverage >= 5 && previousCoverage >= 5 ? current - previous : null;
  const threshold = metric === 'steps' ? Math.max((previous ?? 0) * metrics.steps.threshold, 1) : metrics[metric].threshold;
  const direction = delta === null ? 'unknown' : Math.abs(delta) < threshold ? 'steady' : delta > 0 ? 'up' : 'down';
  return { current, previous, delta, coverage, previousCoverage, direction };
}

export function formatValue(value: number | null, metric: MetricId): string {
  if (value === null) return '—';
  return metric === 'sleep' ? value.toFixed(1) : Math.round(value).toLocaleString('en-AU');
}

export function changeText(trend: Trend, metric: MetricId): string {
  if (trend.delta === null) return 'Not enough data to compare';
  if (trend.direction === 'steady') return 'Similar to the previous week';
  return `${formatValue(Math.abs(trend.delta), metric)} ${metrics[metric].unit} ${trend.delta < 0 ? 'less' : 'more'} than previous week`;
}

export function careInsight(metric: MetricId, trend: Trend) {
  if (trend.direction === 'unknown') return {
    title: 'A little more data is needed',
    meaning: 'There are not enough recorded days to describe a reliable weekly change.',
    action: 'Check device wear and sync status. Keep recording observations as usual.',
    status: 'More data needed', attention: false,
  };
  if (metric === 'sleep' && trend.direction === 'down') return {
    title: 'Less sleep may affect daytime comfort',
    meaning: 'Reduced sleep may be associated with restlessness, irritability, or tiredness. These are possible effects to check, not recorded behaviours.',
    action: 'Ask how the resident is feeling, review overnight observations, and discuss a persistent change with the care team.',
    status: 'Worth a check-in', attention: true,
  };
  if (metric === 'steps' && trend.direction === 'down') return {
    title: 'Movement has reduced this week',
    meaning: 'Lower recorded activity may reflect a change in routine, comfort, or device wear. Steps alone do not explain the cause.',
    action: 'Check device wear and ask about comfort and participation before planning movement support.',
    status: 'Worth a check-in', attention: true,
  };
  if (metric === 'heart' && trend.direction !== 'steady') return {
    title: 'Resting heart rate has changed',
    meaning: 'A change in the weekly average can have several causes. A wearable reading alone cannot establish the reason.',
    action: 'Check the reading and the resident’s usual baseline. Share a sustained change or accompanying symptoms with the care team.',
    status: 'Review the change', attention: true,
  };
  return {
    title: metric === 'sleep' ? 'Keep supporting a familiar sleep routine' : metric === 'steps' ? 'Continue the resident’s usual movement support' : 'Continue routine observations',
    meaning: metric === 'sleep' && trend.direction === 'up' ? 'Recorded sleep has increased. Ask whether the resident feels more rested; more hours alone do not establish sleep quality.' : 'The recorded pattern does not trigger a change prompt in this demo. This does not establish that the resident is clinically well.',
    action: 'Continue the individual care plan and note any changes the resident or care team observes.',
    status: trend.direction === 'up' && metric === 'sleep' ? 'More sleep recorded' : 'Usual pattern', attention: false,
  };
}
