import type { Resident } from './domain';
import { buildFamilySummary } from './family-summary';
import MedicationExample from './MedicationExample';

export default function FamilyView({ resident }: { resident: Resident | null }) {
  if (!resident) return <div className="card family-empty"><p>Connect Google Health to see a family summary.</p></div>;
  const summary = buildFamilySummary(resident.series);

  return <div className="family-view">
    <div className="card family-summary">
      <section className="family-section" aria-labelledby="family-week">
        <h2 id="family-week">This week</h2>
        <div>
          {summary.patterns.length ? <dl className="family-patterns">{summary.patterns.map(pattern => <div key={pattern.metric}><dt>{pattern.label}</dt><dd>{pattern.text}</dd></div>)}</dl> : <p>Not enough readings for a weekly summary.</p>}
          {summary.patterns.length > 0 && summary.missing.length > 0 && <p className="family-limited">Some readings are unavailable, so this is a partial summary.</p>}
        </div>
      </section>
      <section className="family-section" aria-labelledby="family-meaning">
        <h2 id="family-meaning">What it may mean</h2>
        <div>{summary.meaning.map(text => <p key={text}>{text}</p>)}</div>
      </section>
      <section className="family-section" aria-labelledby="family-visit">
        <h2 id="family-visit">When you visit</h2>
        <ol className="family-visits">{summary.visits.map(text => <li key={text}>{text}</li>)}</ol>
      </section>
    </div>
    <p className="family-source">Based on Google Health readings, not a mood report.</p>
    <MedicationExample/>
  </div>;
}
