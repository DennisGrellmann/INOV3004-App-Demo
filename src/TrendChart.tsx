import { useId } from 'react';
import { dateLabel, formatValue, metrics, type DayValue, type MetricId } from './domain';

export default function TrendChart({ data, metric }: { data: DayValue[]; metric: MetricId }) {
  const id = useId().replace(/:/g, '');
  const config = metrics[metric];
  const width = 720, height = 230, left = 42, right = 18, top = 20, bottom = 35;
  const values = data.flatMap(day => day.value === null ? [] : [day.value]);
  const maximum = Math.max(metric === 'sleep' ? 10 : metric === 'heart' ? 100 : 1000, ...values);
  const ceiling = metric === 'steps' ? Math.ceil(maximum / 1000) * 1000 : Math.ceil(maximum / 10) * 10;
  const x = (index: number) => left + index * (width - left - right) / Math.max(data.length - 1, 1);
  const y = (value: number) => height - bottom - value / ceiling * (height - top - bottom);
  const segments: { index: number; value: number }[][] = [];
  let segment: { index: number; value: number }[] = [];
  data.forEach((day, index) => {
    if (day.value === null) { if (segment.length) segments.push(segment); segment = []; }
    else segment.push({ index, value: day.value });
  });
  if (segment.length) segments.push(segment);
  return <>
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${id}-title ${id}-description`}>
        <title id={`${id}-title`}>{config.full} over {data.length} days</title>
        <desc id={`${id}-description`}>Recorded {config.unit} for each completed date. Gaps mean no reading. Daily values are available in the table below.</desc>
        <defs><linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={config.color} stopOpacity=".14"/><stop offset="100%" stopColor={config.color} stopOpacity=".015"/></linearGradient></defs>
        {[0, 1, 2, 3, 4].map(tick => {
          const value = ceiling * tick / 4;
          return <g key={tick}><line x1={left} x2={width - right} y1={y(value)} y2={y(value)} className="chart-grid"/><text x={left - 12} y={y(value) + 4} textAnchor="end" className="chart-label">{metric === 'steps' && value >= 1000 ? `${+(value / 1000).toFixed(1)}k` : +value.toFixed(1)}</text></g>;
        })}
        {segments.map((points, index) => {
          const line = points.map((point, i) => `${i ? 'L' : 'M'} ${x(point.index)} ${y(point.value)}`).join(' ');
          const area = `${line} L ${x(points.at(-1)!.index)} ${height - bottom} L ${x(points[0].index)} ${height - bottom} Z`;
          return <g key={index}><path d={area} fill={`url(#${id}-fill)`}/><path d={line} fill="none" stroke={config.color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/></g>;
        })}
        {data.map((day, index) => <g key={day.date}>
          {day.value !== null && <circle cx={x(index)} cy={y(day.value)} r="4.5" fill="white" stroke={config.color} strokeWidth="2"><title>{dateLabel(day.date)}: {formatValue(day.value, metric)} {config.unit}</title></circle>}
          {(data.length <= 7 || index % 2 === 0 || index === data.length - 1) && <text x={x(index)} y={height - 8} textAnchor="middle" className="chart-label">{dateLabel(day.date, { weekday: 'short' })}{data.length > 7 ? ` ${new Date(`${day.date}T12:00:00`).getDate()}` : ''}</text>}
        </g>)}
      </svg>
    </div>
    <details className="daily-values"><summary>View daily values</summary><div className="table-scroll"><table><caption className="sr-only">Daily {config.full.toLowerCase()} readings</caption><thead><tr><th>Date</th><th>{config.full} ({config.unit})</th></tr></thead><tbody>{data.map(day => <tr key={day.date}><td>{dateLabel(day.date, { weekday: 'short', day: 'numeric', month: 'short' })}</td><td>{day.value === null ? 'No reading' : formatValue(day.value, metric)}</td></tr>)}</tbody></table></div></details>
  </>;
}
