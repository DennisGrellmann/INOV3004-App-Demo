# Careview · INOV3004

A simple resident wellbeing app for aged care. The dashboard shows actual Google Health sleep, daily steps and resting heart rate, alongside weekly changes and possible care implications.

**There is no sample resident data in the app.** Before connection, metrics are empty. A possible care implication is an observation prompt, never an assertion that the resident has a symptom or a diagnosis.

## Run locally

Requires Node.js 22.12+ or 24.

```sh
npm ci
npm run dev
```

Open `http://localhost:5173`. The stack is React, TypeScript, Vite and plain CSS. There is no backend or health-record database.

## Connect real Google Health data

1. Follow [Google’s setup guide](https://developers.google.com/health/setup) to enable the **Google Health API** in a Google Cloud project and create an OAuth client of type **Web application**.
2. Add `http://localhost:5173` and, for the hosted app, `https://inov3004-careview.dennisgrellmann.chatgpt.site` to **Authorized JavaScript origins**. The popup token flow uses an origin, not a redirect callback endpoint.
3. Configure the OAuth consent screen and add the consenting Google account to the test user list while the project is in Testing.
4. Configure these read-only scopes:
   - `https://www.googleapis.com/auth/googlehealth.sleep.readonly`
   - `https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly`
   - `https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly`
5. The resident/test account must be linked in the **Google Health mobile app** and have device readings synced there.
6. In Careview, open **Google Health**, enter the public OAuth client ID, optionally enter a resident display name and room, and choose **Continue with Google**. Only connect an account with the account holder’s appropriate consent.

You can alternatively set `VITE_GOOGLE_CLIENT_ID` in a local `.env` file before building. This is a **public client ID**, not a secret. Never put a client secret in any `VITE_*` variable. No client secret is required for this app’s [Google Identity Services token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model).

Google verifies the connected health account; it does not verify the resident name or room entered in Careview. This first version displays one account at a time. Disconnect before connecting another resident.

## What the app reads

All calls go from the browser directly to `https://health.googleapis.com/v4/` with the short-lived access token:

| Metric | Endpoint | Daily value |
| --- | --- | --- |
| Account check | `GET users/me/identity` | Confirms a linked Google Health profile |
| Nightly sleep | `GET users/me/dataTypes/sleep/dataPoints:reconcile` | Main sleep’s `summary.minutesAsleep / 60`, grouped by civil wake date |
| Activity | `POST users/me/dataTypes/steps/dataPoints:dailyRollUp` | `steps.countSum` in one-day civil windows |
| Resting heart rate | `GET users/me/dataTypes/daily-resting-heart-rate/dataPoints:reconcile` | Daily `beatsPerMinute` |

The integration follows pagination, uses Google’s reconciled all-source data, handles scope denial per metric, and distinguishes empty responses from recorded zeros. Sleep excludes naps and unfinished sessions and never substitutes time in bed for time asleep.

## How trends work

The latest seven completed civil dates are compared to the preceding seven. Today is excluded so partial days do not distort the comparison. API civil dates retain the date recorded for the account; the requested date window follows the browser’s calendar, so use the facility’s timezone when reviewing residents.

At least five recorded days are needed in **each** week to assign a trend. Missing days stay missing and appear as chart gaps. The weekly average uses recorded values only and displays coverage. A change of at least 0.5 hours of sleep, 15% of prior average steps, or 5 bpm resting heart rate produces a directional label. These are transparent prototype rules, **not clinical thresholds**. A steady trend is not a clinical all-clear.

For example, a declining sleep average produces a prompt to check for tiredness, restlessness or irritability. It does not assert that these were observed. The care team should interpret readings alongside observations and the resident’s individual care plan. [NHLBI sleep context](https://www.nhlbi.nih.gov/health/sleep-deprivation/health-effects).

## Privacy and connection lifecycle

- Health readings, the entered resident label, and OAuth access tokens are held in tab memory only. They are not stored in local storage, sent to a database, or committed to GitHub.
- Only the public OAuth client ID is remembered in local storage.
- Reloading or disconnecting clears loaded health data. An expired session is cleared and requires a user-initiated reconnect. There is no unattended sync or refresh-token storage.
- **Disconnect account** ends this tab’s session; it does not revoke the underlying Google consent. Users can revoke that separately at [Google account connections](https://myaccount.google.com/connections).
- Google sign-in and fonts are loaded from Google. The hosted app is private. This prototype does not implement a facility-wide staff access system or persistent resident records.

## Checks

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Unit tests cover weekly windows, missing values, sleep selection, resident timezone offsets, API filters, rollups, pagination, empty/denied metrics and expired credentials. Browser tests exercise the actual sign-in UI and charts using **intercepted test responses**, plus mobile navigation and disconnect clearing. Test fixtures are confined to test files and never included as production data.

Live Google OAuth and live account readings require the owner’s Google Cloud OAuth client and a consenting health account; intercepted tests do not verify those external prerequisites.

## Build and hosting

`npm run build` creates `dist/`. The private Sites project is recorded in `.openai/hosting.json`; the same source is maintained in the private `DennisGrellmann/INOV3004-App-Demo` GitHub repository.
