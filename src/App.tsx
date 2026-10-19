import { useEffect, useRef, useState } from 'react';
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, Heart, HeartPulse, LayoutDashboard, Link2, LoaderCircle, Menu, Minus, Moon, RefreshCw, UserRound, UsersRound, X } from 'lucide-react';
import { careInsight, changeText, completedDates, dateLabel, formatValue, metricIds, metrics, trendFor, type MetricId, type Resident, type Series } from './domain';
import { HealthApiError, loadHealth, type HealthResult } from './google-health';
import { prepareGoogle, requestGoogleToken } from './google-auth';
import TrendChart from './TrendChart';
import ConnectionPanel from './ConnectionPanel';
import FamilyView from './FamilyView';
import OverviewCharacters from './OverviewCharacters';
import { GOOGLE_CLIENT_ID } from './config';

type View = 'overview' | MetricId | 'family' | 'connection';
const icons = { sleep: Moon, steps: Activity, heart: HeartPulse };
const titles: Record<View, string> = {
  overview: 'Overview', sleep: 'Sleep', steps: 'Activity', heart: 'Heart health', family: 'Family', connection: 'Google Health',
};

function savedClientId() {
  try {
    const saved = localStorage.getItem('careview.googleClientId');
    // Replace the retired project ID for browsers that used the previous release.
    if (saved === '105537197664-pppve2aen17u6cl6hertj7urhmci625e.apps.googleusercontent.com') return GOOGLE_CLIENT_ID;
    return saved || GOOGLE_CLIENT_ID;
  }
  catch { return GOOGLE_CLIENT_ID; }
}

function TrendIcon({ direction }: { direction: string }) {
  return direction === 'down' ? <ArrowDownRight size={15}/> : direction === 'up' ? <ArrowUpRight size={15}/> : <Minus size={15}/>;
}

export default function App() {
  const [view, setView] = useState<View>('overview');
  const [metric, setMetric] = useState<MetricId>('sleep');
  const [chartDays, setChartDays] = useState(7);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [clientId, setClientId] = useState(savedClientId);
  const [residentName, setResidentName] = useState('');
  const [room, setRoom] = useState('');
  const [resident, setResident] = useState<Resident | null>(null);
  const [health, setHealth] = useState<HealthResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const token = useRef<{ value: string; scope: string; expiresAt: number } | null>(null);
  const generation = useRef(0);
  const connectionReturnView = useRef<View>('overview');
  const dates = completedDates();
  const emptySeries = Object.fromEntries(metricIds.map(id => [id, dates.map(date => ({ date, value: null }))])) as Series;
  const series = resident?.series ?? emptySeries;
  const activeMetric = view === 'sleep' || view === 'steps' || view === 'heart' ? view : metric;
  const activeTrend = trendFor(series[activeMetric], activeMetric);
  const currentDates = series[activeMetric].slice(-7);
  const firstDate = currentDates[0]?.date ?? dates[7];
  const lastDate = currentDates.at(-1)?.date ?? dates[13];

  const loadGoogle = () => {
    setReady(false); setScriptError(null);
    prepareGoogle().then(() => setReady(true)).catch(reason => setScriptError(reason.message));
  };
  useEffect(() => { loadGoogle(); }, []);
  useEffect(() => {
    try { localStorage.setItem('careview.googleClientId', clientId); } catch { /* Storage is optional. */ }
  }, [clientId]);

  // Expired sessions are cleared rather than leaving old readings labelled live.
  useEffect(() => {
    if (!health || !token.current) return;
    const timer = window.setTimeout(() => {
      generation.current += 1; token.current = null; setResident(null); setHealth(null); setBusy(false);
      setError('Your Google session has expired. Connect again to load current readings.');
    }, Math.max(0, token.current.expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [health]);

  function navigate(next: View) {
    if (next === 'connection') connectionReturnView.current = view === 'family' ? 'family' : 'overview';
    setView(next); setMobileMenu(false); setError(null);
  }

  function disconnect() {
    generation.current += 1;
    token.current = null; setResident(null); setHealth(null); setBusy(false); setError(null);
    setResidentName(''); setRoom('');
  }

  async function connect() {
    if (busy || !ready) return;
    setBusy(true); setError(null);
    const request = ++generation.current;
    try {
      const response = await requestGoogleToken(clientId.trim());
      if (request !== generation.current) return;
      const session = { value: response.access_token!, scope: response.scope ?? '', expiresAt: Date.now() + (response.expires_in ?? 3600) * 1000 };
      const result = await loadHealth(session.value, session.scope);
      if (request !== generation.current) return;
      if (Date.now() >= session.expiresAt) throw new Error('The Google session expired while loading. Please reconnect.');
      token.current = session;
      const name = residentName.trim() || 'Connected resident';
      setResident({ id: 'connected', name, initials: name.split(' ').slice(0, 2).map(word => word[0]).join('').toUpperCase(), age: null, room: room.trim() || 'Google Health account', note: 'Readings from the connected Google Health account.', source: 'google', series: result.series });
      setHealth(result); setView(connectionReturnView.current);
    } catch (reason) {
      if (request === generation.current) { token.current = null; setError(reason instanceof Error ? reason.message : 'Could not connect to Google.'); }
    } finally { if (request === generation.current) setBusy(false); }
  }

  async function refresh() {
    if (!token.current || busy) return;
    if (Date.now() >= token.current.expiresAt) { disconnect(); setError('Your session has expired. Please reconnect to Google.'); setView('connection'); return; }
    setBusy(true); setError(null);
    const request = ++generation.current;
    try {
      const result = await loadHealth(token.current.value, token.current.scope);
      if (request !== generation.current) return;
      setHealth(result); setResident(current => current ? { ...current, series: result.series } : null);
    } catch (reason) {
      if (request !== generation.current) return;
      if (reason instanceof HealthApiError && reason.status === 401) { token.current = null; setResident(null); setHealth(null); }
      setError(reason instanceof Error ? reason.message : 'Refresh failed. Your earlier readings are still shown.');
    } finally { if (request === generation.current) setBusy(false); }
  }

  return <div className="app-shell">
    <a className="skip-link" href="#main">Skip to content</a>
    {mobileMenu && <button className="sidebar-scrim" aria-label="Close menu" onClick={() => setMobileMenu(false)}/>}
    <aside className={`sidebar ${mobileMenu ? 'is-open' : ''}`}>
      <a href="#" className="brand" onClick={event => { event.preventDefault(); navigate('overview'); }}><Heart size={22}/>careview</a>
      <button className="icon-button close-menu" aria-label="Close navigation" onClick={() => setMobileMenu(false)}><X size={20}/></button>
      <nav aria-label="Main navigation">
        <button className={`nav-item ${view === 'overview' ? 'active' : ''}`} onClick={() => navigate('overview')} aria-current={view === 'overview' ? 'page' : undefined}><LayoutDashboard size={18}/>Overview</button>
        {metricIds.map(id => { const Icon = icons[id]; return <button key={id} className={`nav-item ${view === id ? 'active' : ''}`} onClick={() => { setMetric(id); navigate(id); }} aria-current={view === id ? 'page' : undefined}><Icon size={18}/>{metrics[id].label}</button>; })}
        <button className={`nav-item family-nav ${view === 'family' ? 'active' : ''}`} onClick={() => navigate('family')} aria-current={view === 'family' ? 'page' : undefined}><UsersRound size={18}/>Family</button>
        <button className={`nav-item connection-nav ${view === 'connection' ? 'active' : ''}`} onClick={() => navigate('connection')} aria-current={view === 'connection' ? 'page' : undefined}><Link2 size={18}/>Google Health</button>
      </nav>
    </aside>
    <div className="main-shell">
      <header className="topbar"><button className="icon-button" onClick={() => setMobileMenu(true)} aria-label="Open menu"><Menu size={21}/></button><span>careview</span></header>
      <main id="main" tabIndex={-1}>
        <div className="page-heading"><h1>{titles[view]}</h1>{view !== 'connection' && <span className="date-chip"><CalendarDays size={15}/>{dateLabel(firstDate)} – {dateLabel(lastDate)}</span>}</div>
        {error && view !== 'connection' && <div className="inline-error" role="alert">{error}{!resident && <button className="text-button" onClick={() => navigate('connection')}>Connection settings <ArrowRight size={14}/></button>}</div>}
        {view === 'connection' ? <ConnectionPanel clientId={clientId} setClientId={setClientId} residentName={residentName} setResidentName={setResidentName} room={room} setRoom={setRoom} connected={!!resident} busy={busy} ready={ready} scriptError={scriptError} error={error} onConnect={connect} onDisconnect={disconnect} onRetryScript={loadGoogle}/> : <>
          <section className="resident-card" aria-label="Resident profile">
            <div className="resident-avatar">{resident ? resident.initials : <UserRound size={24}/>}</div>
            <div className="resident-info"><h2>{resident?.name ?? 'No resident connected'}</h2>{resident && <p>{resident.room}</p>}</div>
            <div className="resident-actions">{resident ? <><span className="sync-time">Updated {health?.syncedAt.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</span><button className="button secondary" onClick={refresh} disabled={busy}>{busy ? <LoaderCircle size={15} className="spin"/> : <RefreshCw size={15}/>}Refresh</button></> : <button className="button primary" onClick={() => navigate('connection')}><Link2 size={16}/>Connect Google Health</button>}</div>
          </section>
          {view === 'family' ? <FamilyView resident={resident}/> : <>
          <p className="summary-caption">7-day averages · compared with the previous week</p>
          <div className="metric-grid">{metricIds.map(id => {
            const trend = trendFor(series[id], id); const Icon = icons[id];
            return <button key={id} className={`metric-card ${view === id ? 'selected' : ''}`} aria-pressed={view === id} onClick={() => { setMetric(id); setView(id); }}>
              <div className="metric-top"><Icon size={18}/><span>{metrics[id].full}</span></div>
              <div className="metric-number">{formatValue(trend.current, id)}<span>{id === 'steps' ? 'steps / day' : id === 'sleep' ? 'hrs / night' : 'bpm'}</span></div>
              {resident && <div className="metric-bottom"><span className={`metric-change ${careInsight(id, trend).attention ? 'attention' : ''}`}><TrendIcon direction={trend.direction}/>{changeText(trend, id)}</span><span className="coverage">{trend.coverage}/7 days</span></div>}
            </button>;
          })}</div>
          {view === 'overview' ? <OverviewCharacters series={series}/> : <section className="card trend-card">
            <div className="card-heading"><h2>{metrics[activeMetric].label} trend</h2><div className="segmented" aria-label="Chart period">{[7, 14].map(days => <button key={days} aria-pressed={chartDays === days} className={chartDays === days ? 'active' : ''} onClick={() => setChartDays(days)}>{days} days</button>)}</div></div>
            {!resident ? <div className="chart-empty"><p>Connect Google Health to view readings.</p></div> : <>
              {health?.issues[activeMetric] && <div className="metric-issue" role="status">{health.issues[activeMetric]}</div>}
              {series[activeMetric].slice(-chartDays).every(day => day.value === null) ? <div className="chart-empty"><h3>No readings in this period</h3><p>Sync your device, then refresh.</p></div> : <TrendChart data={series[activeMetric].slice(-chartDays)} metric={activeMetric}/>}
              <div className="chart-footnote"><span>Google Health · {metrics[activeMetric].unit}</span><span>{activeTrend.coverage} of 7 days recorded</span></div>
            </>}
          </section>}
          {resident && <section className="card care-notes"><h2>Care considerations</h2><div className="table-scroll"><table className="care-table"><thead><tr><th>Metric</th><th>Weekly change</th><th>Consideration</th></tr></thead><tbody>{metricIds.map(id => {
            const trend = trendFor(series[id], id); const care = careInsight(id, trend);
            return <tr key={id}><th scope="row">{metrics[id].label}</th><td><span className="table-trend"><TrendIcon direction={trend.direction}/>{trend.direction === 'unknown' ? 'Insufficient data' : trend.direction === 'steady' ? 'Stable' : `${trend.direction === 'down' ? '−' : '+'}${formatValue(Math.abs(trend.delta!), id)} ${metrics[id].unit}`}</span></td><td>{care.attention ? <><p>{care.meaning}</p><p className="care-action">{care.action}</p></> : <span aria-label={trend.direction === 'unknown' ? 'No comparison available' : 'No care prompt'}>—</span>}</td></tr>;
          })}</tbody></table></div></section>}
          <details className="data-notes"><summary>About these readings</summary><p>Compares the latest 7 completed days with the previous 7. Each week needs at least 5 recorded days. Missing readings are excluded.</p><p>Trend flags: 0.5 hours of sleep, 15% activity or 5 bpm. Overview characters use five levels; “much” means at least twice these changes. They illustrate recorded trends, not observed feelings or clinical status. These are app rules, not clinical thresholds. Care considerations are possible effects, not observed symptoms.</p></details>
          </>}
        </>}
      </main>
    </div>
  </div>;
}
