import { metrics, type MetricId, type Trend } from './domain';

type CharacterLevel = 'much-lower' | 'lower' | 'similar' | 'higher' | 'much-higher' | 'unknown';
export type MetricCharacter = { emoji: string; label: string; level: CharacterLevel };

const levels = ['much-lower', 'lower', 'similar', 'higher', 'much-higher'] as const;
const characters = {
  sleep: {
    emoji: ['😪', '🥱', '😴', '🛌', '💤'],
    label: ['Much less sleep', 'Less sleep', 'Similar sleep', 'More sleep', 'Much more sleep'],
  },
  steps: {
    emoji: ['🪑', '🧍', '🚶', '🏃', '🏃💨'],
    label: ['Much less movement', 'Less movement', 'Similar movement', 'More movement', 'Much more movement'],
  },
  heart: {
    emoji: ['❤️⬇️', '❤️↘️', '❤️', '❤️↗️', '❤️⬆️'],
    label: ['Much lower heart rate', 'Lower heart rate', 'Similar heart rate', 'Higher heart rate', 'Much higher heart rate'],
  },
};

export function characterFor(metric: MetricId, trend: Trend): MetricCharacter {
  if (trend.direction === 'unknown' || trend.delta === null) {
    return { emoji: '❔', label: 'Not enough data', level: 'unknown' };
  }
  const threshold = metric === 'steps' ? Math.max((trend.previous ?? 0) * metrics.steps.threshold, 1) : metrics[metric].threshold;
  const largeChange = Math.abs(trend.delta) >= threshold * 2;
  const index = trend.direction === 'steady' ? 2 : trend.direction === 'down' ? (largeChange ? 0 : 1) : (largeChange ? 4 : 3);
  return { emoji: characters[metric].emoji[index], label: characters[metric].label[index], level: levels[index] };
}
