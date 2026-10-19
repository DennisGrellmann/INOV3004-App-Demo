import { completedDates, dateLabel } from './domain';

const exampleDoses = ['taken', 'taken', 'missed', 'taken', 'declined', 'taken', 'taken'] as const;
const statuses = {
  taken: { symbol: '✓', label: 'Taken' },
  missed: { symbol: '−', label: 'Missed' },
  declined: { symbol: '×', label: 'Declined' },
};

export default function MedicationExample() {
  const dates = completedDates(7);
  return <section className="card family-medication" aria-labelledby="medication-heading">
    <div className="medication-heading">
      <h2 id="medication-heading">Medication accountability</h2>
      <span className="medication-example-label">Example data</span>
    </div>
    <p className="medication-example-note">Example only; not a resident medication record.</p>
    <div className="table-scroll medication-scroll" tabIndex={0}>
      <table className="medication-table">
        <caption className="sr-only">Example medication doses over the last seven days</caption>
        <thead><tr><th scope="col">Medication</th>{dates.map(date => <th key={date} scope="col"><span>{dateLabel(date, { weekday: 'short' })}</span><span>{dateLabel(date)}</span></th>)}</tr></thead>
        <tbody><tr><th scope="row">Vitamin D</th>{exampleDoses.map((dose, index) => <td key={dates[index]}><span className={`medication-status ${dose}`} aria-hidden="true">{statuses[dose].symbol}</span><span className="sr-only">{statuses[dose].label}</span></td>)}</tr></tbody>
      </table>
    </div>
    <div className="medication-key">{Object.entries(statuses).map(([key, status]) => <span key={key}><span className={`medication-status ${key}`} aria-hidden="true">{status.symbol}</span>{status.label}</span>)}</div>
    <p className="medication-summary">Some doses were missed or declined. Ask the resident about any concerns and speak with the care team about how you can help.</p>
  </section>;
}
