import { useEffect, useRef, useState } from 'react';
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, CalendarDays, Check, ChevronRight, CircleHelp, Heart, HeartPulse, LayoutDashboard, Link2, LoaderCircle, Menu, Minus, Moon, RefreshCw, ShieldCheck, Sparkles, UserRound, Users, X } from 'lucide-react';
import { careInsight, changeText, completedDates, dateLabel, formatValue, metricIds, metrics, trendFor, type MetricId, type Resident, type Series } from './domain';
import { HealthApiError, loadHealth, type HealthResult } from './google-health';
import { prepareGoogle, requestGoogleToken } from './google-auth';
import TrendChart from './TrendChart';
import ConnectionPanel from './ConnectionPanel';

type View = 'overview' | MetricId | 'connection';
const icons = { sleep: Moon, steps: Activity, heart: HeartPulse };
const titles: Record<View, [string, string]> = {
  overview: ['Resident overview', 'Small changes. A clearer picture of wellbeing.'],
  sleep: ['Sleep & rest', 'Understand the pattern behind a restful night.'],
  steps: ['Activity & movement', 'Follow changes in everyday movement.'],
  heart: ['Heart health', 'Keep an eye on the resident’s usual rhythm.'],
  connection: ['Google Health connection', 'Connect real readings to more thoughtful care.'],
};

function savedClientId() {
  try { return localStorage.getItem('careview.googleClientId') || import.meta.env.VITE_GOOGLE_CLIENT_ID || ''; }
  catch { return import.meta.env.VITE_GOOGLE_CLIENT_ID || ''; }
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
  const [showAbout, setShowAbout] = useState(false);
  const token = useRef<{ value: string; scope: string; expiresAt: number } | null>(null);
  const generation = useRef(0);
  const dates = completedDates();
  const emptySeries = Object.fromEntries(metricIds.map(id => [id, dates.map(date => ({ date, value: null }))])) as Series;
  const series = resident?.series ?? emptySeries;
  const activeMetric = view === 'sleep' || view === 'steps' || view === 'heart' ? view : metric;
  const activeTrend = trendFor(series[activeMetric], activeMetric);
  const insight = careInsight(activeMetric, activeTrend);
  const attentionCount = resident ? metricIds.filter(id => careInsight(id, trendFor(series[id], id)).attention).length : 0;
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

  function navigate(next: View) { setView(next); setMobileMenu(false); setError(null); }

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
      setHealth(result); setView('overview');
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
    <a className="skip-link" href="#main">Skip to main content</a>
    {mobileMenu && <button className="sidebar-scrim" aria-label="Close menu" onClick={() => setMobileMenu(false)}/>}
    <aside className={`sidebar ${mobileMenu ? 'is-open' : ''}`}>
      <a href="#" className="brand" onClick={event => { event.preventDefault(); navigate('overview'); }}><span className="brand-icon"><Heart size={21}/><span/></span>careview<span className="brand-period">.</span></a>
      <div className="facility"><div className="facility-icon"><Users size={18}/></div><div><strong>Resident wellbeing</strong><span>Aged care workspace</span></div></div>
      <div className="nav-label">CARE WORKSPACE</div>
      <nav aria-label="Main navigation">
        <button className={`nav-item ${view === 'overview' ? 'active' : ''}`} onClick={() => navigate('overview')} aria-current={view === 'overview' ? 'page' : undefined}><LayoutDashboard size={18}/>Overview</button>
        <div className="nav-label metrics-label">HEALTH METRICS</div>
        {metricIds.map(id => { const Icon = icons[id]; return <button key={id} className={`nav-item ${view === id ? 'active' : ''}`} onClick={() => { setMetric(id); navigate(id); }} aria-current={view === id ? 'page' : undefined}><Icon size={18}/>{metrics[id].label}{resident && careInsight(id, trendFor(series[id], id)).attention && <span className="nav-notification"/>}</button>; })}
        <div className="nav-divider"/>
        <button className={`nav-item ${view === 'connection' ? 'active' : ''}`} onClick={() => navigate('connection')} aria-current={view === 'connection' ? 'page' : undefined}><Link2 size={18}/>Google Health<span className={`connection-indicator ${resident ? 'is-connected' : ''}`}/></button>
      </nav>
      <div className="sidebar-bottom"><div className="sidebar-note"><ShieldCheck size={19}/><p>Thoughtful insights.<br/><strong>Person-centred care.</strong></p></div><button className="help-button" onClick={() => setShowAbout(true)}><CircleHelp size={17}/>About this workspace<ArrowUpRight size={15}/></button><div className="workspace-footer"><span className="workspace-avatar">CV</span><div><strong>Careview</strong><span>INOV3004 · App demo</span></div><span className="tiny-dot"/></div></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-menu-button" onClick={() => setMobileMenu(true)} aria-label="Open menu"><Menu size={21}/></button><span>Care workspace</span><ChevronRight size={14}/><strong>{view === 'connection' ? 'Google Health' : 'Resident wellbeing'}</strong></div><div className="topbar-right"><span className="source-chip"><span className={`status-dot ${resident ? 'connected' : ''}`}/>{resident ? 'Google Health data' : 'Awaiting connection'}</span><button className="icon-button help-icon" onClick={() => setShowAbout(true)} aria-label="About Careview"><CircleHelp size={19}/></button><span className="user-avatar" aria-label="Care workspace">CW</span></div></header>
      <main id="main" tabIndex={-1}>
        <div className="page-heading"><div><div className="eyebrow">A LITTLE CONTEXT. BETTER CARE.</div><h1>{titles[view][0]}</h1><p>{titles[view][1]}</p></div>{view !== 'connection' && <div className="date-chip"><CalendarDays size={16}/>{dateLabel(firstDate)} – {dateLabel(lastDate)}</div>}</div>
        {error && view !== 'connection' && <div className="inline-error global-error" role="alert">{error}{!resident && <button className="text-button" onClick={() => navigate('connection')}>Open connection settings <ArrowRight size={14}/></button>}</div>}
        {view === 'connection' ? <ConnectionPanel clientId={clientId} setClientId={setClientId} residentName={residentName} setResidentName={setResidentName} room={room} setRoom={setRoom} connected={!!resident} busy={busy} ready={ready} scriptError={scriptError} error={error} onConnect={connect} onDisconnect={disconnect} onRetryScript={loadGoogle}/> : <>
          <section className="resident-card" aria-label="Resident profile"><div className={`resident-avatar ${!resident ? 'unconnected-avatar' : ''}`}>{resident ? resident.initials : <UserRound size={29}/>}<span className={`resident-dot ${resident ? 'is-connected' : ''}`}/></div><div className="resident-info"><div className="resident-title"><h2>{resident?.name ?? 'Your resident, in focus'}</h2><span className="profile-label">{resident ? 'Connected account' : 'Not connected'}</span></div><p>{resident?.room ?? 'Connect a Google Health account to see their real wellbeing trends.'}</p><span className="resident-note">{resident?.note ?? 'No sample records. Every reading comes from Google Health.'}</span></div><div className="resident-actions">{resident ? <><button className="button secondary small" onClick={refresh} disabled={busy}>{busy ? <LoaderCircle size={15} className="spin"/> : <RefreshCw size={15}/>}Refresh readings</button><span>Last fetched {health?.syncedAt.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</span></> : <button className="button primary" onClick={() => navigate('connection')}><Link2 size={16}/>Connect Google Health<ArrowRight size={16}/></button>}</div></section>
          <div className="section-intro"><h2>This week at a glance</h2><span>{resident ? 'Weekly averages · previous 7 days compared' : 'Real readings will appear after connection'}</span></div>
          <div className="metric-grid">{metricIds.map(id => { const trend = trendFor(series[id], id); const Icon = icons[id]; const status = careInsight(id, trend); return <button key={id} className={`metric-card ${activeMetric === id ? 'selected' : ''}`} aria-pressed={activeMetric === id} onClick={() => { setMetric(id); if (view !== 'overview') setView(id); }}><div className="metric-top"><span className={`metric-icon ${id}`}><Icon size={19}/></span><span>{metrics[id].full}</span><ArrowUpRight className="metric-arrow" size={17}/></div><div className="metric-number">{formatValue(trend.current, id)}<span>{id === 'steps' ? 'steps / day' : id === 'sleep' ? 'hrs / night' : 'bpm'}</span></div><div className={`metric-change ${status.attention && resident ? 'attention' : ''}`}><TrendIcon direction={trend.direction}/>{resident ? changeText(trend, id) : 'Waiting for Google Health'}</div><div className="metric-footer"><span className={`mini-dot ${status.attention && resident ? 'amber' : !resident || trend.direction === 'unknown' ? 'neutral' : ''}`}/>{!resident ? 'Not connected' : status.status}<span>{trend.coverage}/7 days</span></div></button>; })}</div>
          <div className="detail-grid"><section className="card trend-card"><div className="card-heading"><div><div className="eyebrow">THE BIGGER PICTURE</div><h2>{metrics[activeMetric].full} trend</h2></div><div className="segmented" aria-label="Chart period">{[7, 14].map(days => <button key={days} aria-pressed={chartDays === days} className={chartDays === days ? 'active' : ''} onClick={() => setChartDays(days)}>{days} days</button>)}</div></div><p className="card-description">{metrics[activeMetric].description}</p>
            {!resident ? <div className="chart-empty"><div className={`empty-icon ${activeMetric}`}>{(() => { const Icon = icons[activeMetric]; return <Icon size={25}/>; })()}</div><h3>A clearer picture starts here</h3><p>Connect a resident’s Google Health account<br/>to see their {metrics[activeMetric].label.toLowerCase()} over time.</p><button className="text-button" onClick={() => navigate('connection')}>Connect Google Health<ArrowRight size={15}/></button></div> : <>{health?.issues[activeMetric] && <div className="metric-issue" role="status">{health.issues[activeMetric]}</div>}{series[activeMetric].slice(-chartDays).every(day => day.value === null) ? <div className="chart-empty"><div className="empty-icon"><Activity size={25}/></div><h3>No readings in this period</h3><p>Check the device has synced to Google Health.<br/>Missing readings are not treated as zero.</p></div> : <TrendChart data={series[activeMetric].slice(-chartDays)} metric={activeMetric}/>}</>}
            <div className="chart-footnote"><span className="legend-dot" style={{ backgroundColor: metrics[activeMetric].color }}/>{resident ? 'Google Health · completed days only' : 'Google Health · no readings loaded'}<span>{activeTrend.coverage} of 7 days recorded</span></div>
          </section><aside className={`insight-card ${resident && insight.attention ? 'needs-attention' : ''}`}><div className="insight-label"><Sparkles size={17}/>FROM TREND TO CARE</div><span className="insight-tag">{!resident ? 'Awaiting readings' : insight.status}</span><h2>{!resident ? 'See what the change may mean.' : insight.title}</h2><p>{!resident ? 'Real health trends can add context to the changes you notice in a resident’s day.' : insight.meaning}</p><div className="insight-divider"/><h3><Heart size={15}/>A thoughtful next step</h3><p>{!resident ? 'Connect the resident’s Google Health account. When enough readings are available, care prompts will appear here.' : insight.action}</p><div className="insight-disclaimer"><ShieldCheck size={14}/><span>Care prompts support observation. They are not diagnoses or confirmed outcomes.</span></div></aside></div>
          <section className="card matrix-card"><div className="card-heading"><div><div className="eyebrow">CONNECTING THE DOTS</div><h2>Trends & care considerations</h2></div><span className="subtle-chip"><Bell size={13}/>{attentionCount ? `${attentionCount} to review` : resident ? 'No change prompts' : 'Awaiting readings'}</span></div><div className="table-scroll"><table className="care-table"><thead><tr><th>HEALTH METRIC</th><th>WEEKLY TREND</th><th>POSSIBLE CARE IMPLICATION</th><th>STATUS</th></tr></thead><tbody>{metricIds.map(id => { const Icon = icons[id]; const trend = trendFor(series[id], id); const care = careInsight(id, trend); return <tr key={id}><td><span className="table-metric"><span className={`small-metric-icon ${id}`}><Icon size={16}/></span>{metrics[id].label}</span></td><td><span className="table-trend"><TrendIcon direction={trend.direction}/>{!resident ? 'No readings yet' : trend.direction === 'unknown' ? 'Insufficient data' : trend.direction === 'steady' ? 'Similar to last week' : `${trend.direction === 'down' ? 'Decreased' : 'Increased'} ${formatValue(Math.abs(trend.delta!), id)} ${metrics[id].unit}`}</span></td><td>{!resident ? 'Connect Google Health to see care considerations.' : trend.direction === 'unknown' ? 'More recorded days are needed.' : id === 'sleep' && trend.direction === 'down' ? 'Check for tiredness, restlessness or irritability.' : care.title}</td><td><span className={`table-status ${resident && care.attention ? 'amber' : !resident || trend.direction === 'unknown' ? 'neutral' : ''}`}>{!resident ? 'Awaiting data' : care.status}</span></td></tr>; })}</tbody></table></div><div className="matrix-footer"><ShieldCheck size={14}/>Changes compare weekly averages, not a diagnosis or a clinical threshold.<a href="https://www.nhlbi.nih.gov/health/sleep-deprivation/health-effects" target="_blank" rel="noreferrer">About sleep & wellbeing<ArrowUpRight size={12}/></a></div></section>
        </>}
        <footer className="page-footer"><span><Heart size={13}/>Built around the person, beyond the numbers.</span><span>Careview · INOV3004</span></footer>
      </main>
    </div>
    {showAbout && <div className="modal-backdrop" onClick={() => setShowAbout(false)}><section className="about-modal card" role="dialog" aria-modal="true" aria-labelledby="about-title" onClick={event => event.stopPropagation()}><button className="icon-button modal-close" autoFocus onClick={() => setShowAbout(false)} aria-label="Close about"><X size={20}/></button><span className="brand-icon"><Heart size={23}/></span><h2 id="about-title">A little context for better care.</h2><p>Careview is an INOV3004 aged care web app. It reads sleep, steps and resting heart rate from the Google Health account you connect.</p><p>Weekly changes compare the latest seven completed dates with the seven before them. At least five recorded days in each week are required. A sleep change of 0.5 hours, activity change of 15%, or resting heart rate change of 5 bpm creates a trend label. These are demonstration rules, not clinical thresholds.</p><p>Possible implications are prompts for a conversation and observation. They do not establish a cause, behaviour or diagnosis.</p><p>Access tokens and health readings are held in this tab only. Display names and rooms are entered by you and are not verified by Google.</p><button className="button primary" onClick={() => setShowAbout(false)}><Check size={16}/>Got it</button></section></div>}
  </div>;
}
