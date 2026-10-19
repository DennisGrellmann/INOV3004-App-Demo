# Careview — first version

An INOV3004 demonstration for aged care staff. The primary flow is selecting a resident, reviewing their weekly health metrics, and understanding possible implications for their care. The word “matrix” in the brief is interpreted as “metrics”.

## Scope

- A responsive resident overview, Sleep, Activity, Heart health, and Google Health menu.
- Real Google Health readings only. The dashboard is empty until a resident account is connected. No fictional resident records appear in the interface.
- Metric cards, an accessible weekly chart and daily values, data coverage, and a trend-to-care matrix.
- Deterministic care prompts that distinguish measured changes from possible implications. A trend never asserts an unobserved behaviour or diagnosis.
- A required real, read-only Google Health API v4 connection through Google Identity Services. A public OAuth client ID is configurable in the app or build environment. The connected account is the sole data source. The carer can enter a local display name and room; this label does not claim Google verifies the resident’s identity. Connecting another account clears the prior session.
- Session-only access tokens and health data. No persistent health records, background sync, or facility account system in this demo.

## Stack and alternatives

React, TypeScript, Vite, plain CSS, and Lucide icons. Google’s browser token model avoids a backend and refresh-token store for this demonstration. A server-backed app would support persistent multi-resident records and unattended sync, but adds unnecessary infrastructure to this first iteration. Plain JavaScript would reduce dependencies but make the multiple data states harder to maintain.

## Data and comparisons

Use the last seven completed civil dates; compare their average to the preceding seven completed dates. Require at least five measured days in each window before assigning a trend. Missing days remain gaps and are never replaced with zero. Nightly sleep uses the longest main sleep session ending on each civil date, excludes naps, and uses minutes asleep rather than time in bed. Activity is Google's daily step rollup; resting heart rate is its daily resting heart rate summary. Charts and status text must disclose insufficient data.

## Google connection

Request only sleep, activity/fitness, and health metrics read-only scopes. Verify `users/me/identity` before marking the connection successful. Use reconciled sleep, daily step rollups, and daily resting heart rate summaries, including pagination. Handle denied scopes, missing profiles, expired tokens, empty responses, loading states, and partial failures without substituting demo data. Disconnect clears in-memory health data. No secret is needed in the browser.

## Verification

Test window boundaries, missing data, trend calculation, session selection, daily rollups, API request parameters, pagination, and partial failures. Run a production build and browser checks for navigation, resident selection, chart controls, responsive layout, and connection setup. Live OAuth cannot be verified without the owner's Google Cloud client and consenting test account.

## References

- https://developers.google.com/health/setup
- https://developers.google.com/health/reference/rest/v4/users.dataTypes.dataPoints/reconcile
- https://developers.google.com/health/data-types/sleep
- https://developers.google.com/identity/oauth2/web/guides/use-token-model
- https://www.nhlbi.nih.gov/health/sleep-deprivation/health-effects

Fetched 19 October 2026. The current setup documentation supports new-project setup; older search excerpts about onboarding restrictions are stale.

## Minimal interface — 20 October 2026

Keep navigation, the resident label, three weekly averages, the selected trend chart and one concise care-considerations table. Remove promotional text, repeated status labels, the separate insight panel, decorative account information and footer. Show care text only for changes that trigger a care prompt. Keep comparison definitions under About these readings, and place OAuth configuration and Google Cloud setup in collapsed details.

## Family page — 20 October 2026

Approved in chat. Add a Family menu item for the connected resident, with three sections: This week, What it may mean, and When you visit. Use the existing Google data and weekly comparison thresholds. Omit numeric metrics and charts. Translate only sufficiently supported trends; label interpretations as possible effects rather than reported feelings. Explicitly indicate missing comparisons, and show an empty state before connection. Keep three practical visit suggestions and preserve prompts to ask the care team when resting heart rate changes. The page remains part of the existing private session, with no new roles or sharing system.

Sleep context: https://www.nhlbi.nih.gov/health/sleep-deprivation/health-effects

Communication context: https://www.nia.nih.gov/health/obtaining-older-patients-medical-history

## Overview characters and medication example — 20 October 2026

Approved in chat. Replace only the Overview chart with three large emoji characters for sleep, activity and resting heart rate. Use five comparison levels: much lower, lower, similar, higher and much higher. The outer levels use twice the existing trend threshold. Sleep uses 😪, 🥱, 😴, 🛌 and 💤; activity uses 🪑, 🧍, 🚶, 🏃 and 🏃💨; heart rate uses a heart with directional arrows. Missing or sparse comparisons stay neutral with ❔. Characters have text labels and do not assert measured mood or clinical status. The detailed metric pages retain charts and controls, and metric cards navigate to those pages.

Add Medication accountability below the Family health summary. This is an explicitly labelled example, not Google data or a resident medication record. Show one Vitamin D row over the last seven completed days, five taken ticks, one missed dose and one declined dose, with accessible labels and a concise prompt to talk with the resident and care team. Keep the example visually separate from the Google-derived health summary. No medication logging, data storage or new access roles are added.
