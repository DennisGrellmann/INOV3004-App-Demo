import { scopes } from './google-health';

export type TokenResponse = { access_token?: string; expires_in?: number; scope?: string; error?: string; error_description?: string };
type OAuth = {
  initTokenClient: (config: { client_id: string; scope: string; callback: (response: TokenResponse) => void; error_callback: (error: { type: string }) => void }) => { requestAccessToken: () => void };
  revoke: (token: string, callback: (response: { successful?: boolean }) => void) => void;
};
declare global { interface Window { google?: { accounts: { oauth2: OAuth } } } }

let scriptPromise: Promise<void> | undefined;
export function prepareGoogle(): Promise<void> {
  if (window.google?.accounts.oauth2) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    const timeout = window.setTimeout(() => { script.remove(); scriptPromise = undefined; reject(new Error('Google sign-in timed out. Check your connection and try again.')); }, 15_000);
    script.onload = () => { window.clearTimeout(timeout); resolve(); };
    script.onerror = () => { window.clearTimeout(timeout); script.remove(); scriptPromise = undefined; reject(new Error('Google sign-in could not load. Check your internet connection or content blocker.')); };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

// Call directly from a click after prepareGoogle() resolves so the popup retains
// a user gesture. Access tokens are returned to React state only, never storage.
export function requestGoogleToken(clientId: string): Promise<TokenResponse> {
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts.oauth2) { reject(new Error('Google sign-in is still loading. Please try again.')); return; }
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: Object.values(scopes).join(' '),
      callback: response => {
        if (!response.access_token || response.error) reject(new Error(response.error === 'access_denied' ? 'You cancelled access. Sample residents are still available.' : 'Google did not grant access. Check your OAuth client setup.'));
        else resolve(response);
      },
      error_callback: error => reject(new Error(error.type === 'popup_closed' ? 'The sign-in window was closed. You can connect again at any time.' : 'The sign-in popup was blocked. Allow popups for this site and try again.')),
    });
    client.requestAccessToken();
  });
}
