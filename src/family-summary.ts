import { metricIds, trendFor, type MetricId, type Series, type Trend } from './domain';

export type FamilyPattern = {
  metric: MetricId;
  direction: Exclude<Trend['direction'], 'unknown'>;
  label: string;
  text: string;
};

export type FamilySummary = {
  patterns: FamilyPattern[];
  missing: MetricId[];
  meaning: string[];
  visits: string[];
};

export function buildFamilySummary(series: Series): FamilySummary {
  const trends = Object.fromEntries(metricIds.map(metric => [metric, trendFor(series[metric], metric)])) as Record<MetricId, Trend>;
  const labels: Record<MetricId, string> = { sleep: 'Sleep', steps: 'Movement', heart: 'Heart rate' };
  const descriptions = {
    sleep: { down: 'Less sleep than last week.', up: 'More sleep than last week.', steady: 'Similar to last week.' },
    steps: { down: 'Less movement than last week.', up: 'More movement than last week.', steady: 'Similar to last week.' },
    heart: { down: 'Lower resting heart rate.', up: 'Higher resting heart rate.', steady: 'Similar to last week.' },
  };
  const patterns = metricIds.flatMap(metric => {
    const direction = trends[metric].direction;
    return direction === 'unknown' ? [] : [{ metric, direction, label: labels[metric], text: descriptions[metric][direction] }];
  });
  const missing = metricIds.filter(metric => trends[metric].direction === 'unknown');
  const lessSleep = trends.sleep.direction === 'down';
  const lessMovement = trends.steps.direction === 'down';
  const heartChanged = trends.heart.direction === 'up' || trends.heart.direction === 'down';
  const meaning: string[] = [];

  if (!patterns.length) {
    meaning.push('There are not enough readings to describe a weekly pattern. Ask your relative and the care team how things have been.');
  } else {
    if (lessSleep) meaning.push('They may feel more tired or restless, and have less patience than usual.');
    else if (trends.sleep.direction === 'up') meaning.push('More recorded sleep does not necessarily mean better rest. Ask whether they feel rested.');
    if (lessMovement) meaning.push('Less movement does not explain the cause. Ask about comfort and changes to their routine.');
    if (heartChanged) meaning.push('The resting heart rate pattern has changed. The care team can explain whether it needs follow-up.');
    if (!meaning.length) {
      if (missing.length) meaning.push('These readings give only part of the picture. Ask how they feel today.');
      else if (trends.steps.direction === 'up') meaning.push('They have been moving more. Ask which activities they enjoy and how their energy feels.');
      else meaning.push('The recorded patterns are similar to last week. They do not tell us how your relative feels today.');
    }
  }

  const visits = [
    'Start by asking how they feel and what they would like to do.',
    lessSleep ? 'Keep the visit quiet and allow breaks.' : 'Let them choose a familiar activity, a chat or simply some company.',
    heartChanged ? 'Ask the care team about the changed reading before planning an active visit.'
      : lessMovement ? 'Check with the care team about comfort and support before a walk.'
      : lessSleep ? 'Let them set the pace and finish early if they are tired.'
      : 'Ask the care team what support would help today.',
  ];
  return { patterns, missing, meaning, visits };
}
