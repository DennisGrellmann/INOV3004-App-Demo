import { metricIds, metrics, trendFor, type Series } from './domain';
import { characterFor } from './metric-character';

export default function OverviewCharacters({ series }: { series: Series }) {
  return <section className="card overview-characters" aria-label="Weekly patterns">
    {metricIds.map(metric => {
      const character = characterFor(metric, trendFor(series[metric], metric));
      return <article className="metric-character" key={metric} aria-label={`${metrics[metric].label} pattern`}>
        <h2>{metrics[metric].label}</h2>
        <span className={`character-emoji ${character.level === 'unknown' ? 'is-unknown' : ''}`} aria-hidden="true">{character.emoji}</span>
        <p>{character.label}</p>
      </article>;
    })}
  </section>;
}
