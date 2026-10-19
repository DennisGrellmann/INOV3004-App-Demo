import { ArrowUpRight, Check, CheckCircle2, ExternalLink, Link2, LoaderCircle, LockKeyhole, ShieldCheck, Unplug } from 'lucide-react';

type Props = {
  clientId: string; setClientId: (value: string) => void;
  residentName: string; setResidentName: (value: string) => void;
  room: string; setRoom: (value: string) => void;
  connected: boolean; busy: boolean; ready: boolean; scriptError: string | null; error: string | null;
  onConnect: () => void; onDisconnect: () => void; onRetryScript: () => void;
};

export default function ConnectionPanel(props: Props) {
  const validId = /^[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(props.clientId.trim());
  return <div className="connection-layout">
    <section className="card connection-card">
      <div className="section-heading"><div className="google-mark" aria-hidden="true">G</div><div><h2>Connect Google Health</h2><p>A resident’s real readings, with their permission.</p></div></div>
      <div className="connection-state"><span className={`status-dot ${props.connected ? 'connected' : ''}`}/>{props.connected ? 'Account connected' : 'No account connected'}<span>Read-only access</span></div>
      <form onSubmit={event => { event.preventDefault(); props.onConnect(); }}>
        <label htmlFor="client-id">Google OAuth client ID <span>Required</span></label>
        <input id="client-id" autoComplete="off" placeholder="123456789-…apps.googleusercontent.com" value={props.clientId} onChange={event => props.setClientId(event.target.value)} disabled={props.busy || props.connected} aria-describedby="client-hint"/>
        <p className="field-hint" id="client-hint">The public Web client ID from your Google Cloud project. A client secret is not needed.</p>
        <div className="form-row"><div><label htmlFor="resident-name">Resident display name</label><input id="resident-name" value={props.residentName} onChange={event => props.setResidentName(event.target.value)} placeholder="e.g. Resident’s name" disabled={props.busy || props.connected}/></div><div><label htmlFor="resident-room">Room or wing <span>Optional</span></label><input id="resident-room" value={props.room} onChange={event => props.setRoom(event.target.value)} placeholder="e.g. Room 12 · Garden wing" disabled={props.busy || props.connected}/></div></div>
        <p className="field-hint">These are display labels you enter. Google does not verify the name or room.</p>
        {props.error && <div className="inline-error" role="alert">{props.error}</div>}
        {props.scriptError && <div className="inline-error" role="alert">{props.scriptError}<button type="button" className="text-button" onClick={props.onRetryScript}>Retry loading Google sign-in</button></div>}
        {props.connected ? <button key="disconnect" className="button secondary" type="button" onClick={event => { event.preventDefault(); props.onDisconnect(); }}><Unplug size={17}/>Disconnect account</button> : <button key="connect" className="button primary full-width" type="submit" disabled={!validId || !props.ready || props.busy}>{props.busy ? <LoaderCircle size={18} className="spin"/> : <Link2 size={18}/>} {props.busy ? 'Connecting to Google…' : !props.ready && !props.scriptError ? 'Loading Google sign-in…' : 'Continue with Google'} {!props.busy && <ArrowUpRight size={17}/>}</button>}
      </form>
      <div className="privacy-note"><LockKeyhole size={16}/><p>Health readings and access tokens stay in this tab’s memory. Reloading or disconnecting clears them. Only your public client ID is saved on this device.</p></div>
    </section>
    <div className="setup-column">
      <section className="card setup-card"><div className="eyebrow">ONE-TIME SETUP</div><h2>Before you connect</h2><ol className="setup-steps">
        <li><span>1</span><div><strong>Enable Google Health API</strong><p>Use a Google Cloud project you control and create a Web application OAuth client.</p><a href="https://developers.google.com/health/setup" target="_blank" rel="noreferrer">Google’s setup guide <ExternalLink size={13}/></a></div></li>
        <li><span>2</span><div><strong>Add this app’s origin</strong><p>In your OAuth client, add this exact URL to Authorized JavaScript origins:</p><code>{window.location.origin}</code></div></li>
        <li><span>3</span><div><strong>Allow the test account</strong><p>Add the resident’s consenting Google account as a test user. Enable the sleep, activity and health metrics read-only scopes on the consent screen.</p></div></li>
        <li><span>4</span><div><strong>Link their Google Health profile</strong><p>The account must be signed in to the Google Health mobile app and have synced device readings.</p></div></li>
      </ol></section>
      <section className="permission-card"><ShieldCheck size={22}/><div><h3>Only the readings we need</h3><p><Check size={14}/>Sleep duration</p><p><Check size={14}/>Daily steps</p><p><Check size={14}/>Resting heart rate</p><small>The app cannot edit Google health records.</small></div></section>
      {props.connected && <p className="small-success"><CheckCircle2 size={15}/>Disconnect before connecting a different resident.</p>}
    </div>
  </div>;
}
