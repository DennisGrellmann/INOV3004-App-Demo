import { expect, test, type Page } from '@playwright/test';

const permissions = ['sleep', 'activity_and_fitness', 'health_metrics_and_measurements'].map(name => `https://www.googleapis.com/auth/googlehealth.${name}.readonly`).join(' ');
const currentClientId = '1043304648860-qpphse66j1j8pg8ke11c0cpa6oidqaq6.apps.googleusercontent.com';
const previousClientId = '105537197664-pppve2aen17u6cl6hertj7urhmci625e.apps.googleusercontent.com';
const now = new Date(2026, 9, 19, 12);
const dates = Array.from({ length: 14 }, (_, i) => { const day = new Date(2026, 9, 5 + i); return { year: day.getFullYear(), month: day.getMonth() + 1, day: day.getDate() }; });

async function mockGoogle(page: Page, options: { denyHeart?: boolean; expired?: boolean; empty?: boolean } = {}) {
  await page.clock.install({ time: now });
  await page.route('https://accounts.google.com/gsi/client', route => route.fulfill({
    contentType: 'application/javascript',
    body: `window.google = { accounts: { oauth2: { initTokenClient: (config) => ({ requestAccessToken: () => config.callback({ access_token: 'browser-test-token', scope: '${permissions}', expires_in: 3600 }) }) } } };`,
  }));
  await page.route('https://health.googleapis.com/**', async route => {
    const url = route.request().url();
    if (options.expired) return route.fulfill({ status: 401, json: { error: { message: 'expired' } } });
    if (url.includes('/identity')) return route.fulfill({ json: { healthUserId: 'browser-fixture-account' } });
    if (options.empty) return route.fulfill({ json: {} });
    if (url.includes('/sleep/')) return route.fulfill({ json: { dataPoints: dates.map((date, i) => ({ sleep: { interval: { civilEndTime: { date } }, summary: { minutesAsleep: String(i < 7 ? 450 : 420 - (i - 7) * 20) }, metadata: { mainSleep: true } } })) } });
    if (url.includes('/steps/')) return route.fulfill({ json: { rollupDataPoints: dates.map(date => ({ civilStartTime: { date }, steps: { countSum: '2100' } })) } });
    if (options.denyHeart) return route.fulfill({ status: 403, json: { error: { message: 'denied' } } });
    return route.fulfill({ json: { dataPoints: dates.map(date => ({ dailyRestingHeartRate: { date, beatsPerMinute: '67' } })) } });
  });
}

async function connect(page: Page) {
  await page.getByRole('button', { name: 'Connect Google Health', exact: true }).first().click();
  await page.getByLabel('Google OAuth client ID').fill('123456-test.apps.googleusercontent.com');
  await page.getByLabel('Resident display name').fill('Test Resident');
  await page.getByLabel('Room or wing').fill('Room 12 · Garden wing');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
}

for (const storedId of [null, previousClientId]) {
  test(`uses the replacement OAuth client for ${storedId ? 'returning' : 'new'} visitors`, async ({ page }) => {
    await mockGoogle(page);
    if (storedId) await page.addInitScript(value => localStorage.setItem('careview.googleClientId', value), storedId);
    await page.goto('/');
    await page.getByRole('button', { name: 'Connect Google Health', exact: true }).first().click();
    await expect(page.getByLabel('Google OAuth client ID')).toHaveValue(currentClientId);
    await expect.poll(() => page.evaluate(() => localStorage.getItem('careview.googleClientId'))).toBe(currentClientId);
  });
}

test('unconnected dashboard contains no fabricated resident or readings', async ({ page }) => {
  await mockGoogle(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your resident, in focus' })).toBeVisible();
  await expect(page.getByText('No sample records. Every reading comes from Google Health.')).toBeVisible();
  await expect(page.locator('.metric-number').first()).toContainText('—');
  await expect(page.locator('.metric-number').nth(1)).toContainText('—');
  await expect(page.locator('.metric-number').nth(2)).toContainText('—');
  await expect(page.getByText('Check for tiredness, restlessness or irritability.')).toHaveCount(0);
  await page.screenshot({ path: '/workspace/scratch/careview-desktop.png', fullPage: true, animations: 'disabled' });
});

test('Google-shaped API readings drive charts, comparisons and care prompts; disconnect clears data', async ({ page }) => {
  await mockGoogle(page);
  await page.goto('/');
  await connect(page);
  await expect(page.getByRole('heading', { name: 'Test Resident' })).toBeVisible();
  await expect(page.locator('.metric-number').first()).toContainText('6.0');
  await expect(page.locator('.metric-number').nth(1)).toContainText('2,100');
  await expect(page.getByText('Check for tiredness, restlessness or irritability.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Less sleep may affect daytime comfort' })).toBeVisible();
  await page.getByRole('button', { name: '14 days', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Nightly sleep over 14 days' })).toBeVisible();
  await page.getByText('View daily values', { exact: true }).click();
  await expect(page.locator('.daily-values tbody tr')).toHaveCount(14);
  await page.getByRole('button', { name: 'Activity', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Activity & movement' })).toBeVisible();
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: '/workspace/scratch/careview-connected-test-fixtures.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Google Health', exact: true }).click();
  await page.getByRole('button', { name: 'Disconnect account', exact: true }).click();
  await expect(page.getByText('No account connected', { exact: false }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your resident, in focus' })).toBeVisible();
  await expect(page.locator('.metric-number').first()).toContainText('—');
  const storage = await page.evaluate(() => JSON.stringify({ ...localStorage }));
  expect(storage).not.toContain('browser-test-token');
  expect(storage).not.toContain('Test Resident');
});

test('partial API failures remain empty without hiding available sleep data', async ({ page }) => {
  await mockGoogle(page, { denyHeart: true });
  await page.goto('/'); await connect(page);
  await expect(page.locator('.metric-number').first()).toContainText('6.0');
  await expect(page.locator('.metric-number').nth(2)).toContainText('—');
  await page.getByRole('button', { name: 'Heart health', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Access was not granted');
  await expect(page.getByRole('heading', { name: 'No readings in this period' })).toBeVisible();
});

test('empty Google responses do not create zero readings or care alerts', async ({ page }) => {
  await mockGoogle(page, { empty: true });
  await page.goto('/'); await connect(page);
  await expect(page.getByRole('heading', { name: 'No readings in this period' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'A little more data is needed' })).toBeVisible();
  await expect(page.getByText('0 of 7 days recorded')).toBeVisible();
});

test('mobile navigation and connection setup fit the viewport', async ({ page }) => {
  await mockGoogle(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await page.getByRole('button', { name: 'Google Health', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Connect Google Health' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: '/workspace/scratch/careview-mobile.png', fullPage: true, animations: 'disabled' });
});

test('OAuth API failure leaves the dashboard unconnected with a useful error', async ({ page }) => {
  await mockGoogle(page, { expired: true });
  await page.goto('/'); await connect(page);
  await expect(page.getByRole('alert')).toContainText('expired');
  await expect(page.getByText('No account connected')).toBeVisible();
});
