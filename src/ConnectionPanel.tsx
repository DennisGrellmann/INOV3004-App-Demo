import { ExternalLink, Link2, LoaderCircle, Unplug } from 'lucide-react';

type Props = {
  clientId: string; setClientId: (value: string) => void;
  residentName: string; setResidentName: (value: string) => void;
  room: string; setRoom: (value: string) => void;
  connected: boolean; busy: boolean; ready: boolean; scriptError: string | null; error: string | null;
  onConnect: () => void; onDisconnect: () => void; onRetryScript: () => void;
};

export default function ConnectionPanel(props: Props) {
  const validId = /^[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(props.clientId.trim());
  return <section className="card connection-card">
    <div className="card-heading"><h2>{props.connected ? 'Connected account' : 'Connect Google Health'}</h2><span className="access-label">Read-only</span></div>
    <form onSubmit={event => { event.preventDefault(); props.onConnect(); }}>
      <div className="form-row">
        <div><label htmlFor="resident-name">Resident name</label><input id="resident-name" value={props.residentName} onChange={event => props.setResidentName(event.target.value)} disabled={props.busy || props.connected}/></div>
        <div><label htmlFor="resident-room">Room or wing</label><input id="resident-room" value={props.room} onChange={event => props.setRoom(event.target.value)} disabled={props.busy || props.connected}/></div>
      </div>
      <details className="connection-settings"><summary>Connection settings</summary>
        <label htmlFor="client-id">Google OAuth client ID</label>
        <input id="client-id" autoComplete="off" value={props.clientId} onChange={event => props.setClientId(event.target.value)} disabled={props.busy || props.connected}/>
      </details>
      {props.error && <div className="inline-error" role="alert">{props.error}</div>}
      {props.scriptError && <div className="inline-error" role="alert">{props.scriptError}<button type="button" className="text-button" onClick={props.onRetryScript}>Retry</button></div>}
      {props.connected ? <button key="disconnect" className="button secondary" type="button" onClick={event => { event.preventDefault(); props.onDisconnect(); }}><Unplug size={16}/>Disconnect account</button> : <button key="connect" className="button primary" type="submit" disabled={!validId || !props.ready || props.busy}>{props.busy ? <LoaderCircle size={17} className="spin"/> : <Link2 size={17}/>} {props.busy ? 'Connecting…' : !props.ready && !props.scriptError ? 'Loading Google…' : 'Continue with Google'}</button>}
    </form>
    <p className="privacy-note">Readings clear when you reload or disconnect.</p>
    <details className="setup-details"><summary>Google Cloud setup</summary><ol>
      <li>Enable Google Health API and create a Web application OAuth client.</li>
      <li>Add this Authorized JavaScript origin:<code>{window.location.origin}</code></li>
      <li>Add the account as a test user. Allow read-only sleep, activity and health metrics scopes.</li>
      <li>Sign in to the Google Health mobile app and sync the device.</li>
    </ol><a href="https://developers.google.com/health/setup" target="_blank" rel="noreferrer">Setup guide <ExternalLink size={13}/></a></details>
  </section>;
}
