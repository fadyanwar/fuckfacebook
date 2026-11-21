// Loads the unpacked dist/chrome build into headed Chromium (run under
// xvfb-run on a server) and checks the extension against a local stand-in
// for Facebook and Messenger. No request leaves the machine: every
// navigation is answered by Playwright from tests/fixtures or refused.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { build } from '../scripts/build.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = fs.readFileSync(path.join(root, 'tests', 'fixtures', 'facebook.html'), 'utf8');
const FAKE_SITES = /^https:\/\/(www\.|m\.)?(facebook\.com|messenger\.com|fb\.com)\//;
const OTHER_SITE = 'https://example.org/';
const { dir } = build('chrome');

const profile = fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR || '/tmp'), 'ff-chrome-'));
const context = await chromium.launchPersistentContext(profile, {
  headless: false,
  args: [
    `--disable-extensions-except=${dir}`,
    `--load-extension=${dir}`,
    // Nothing may resolve on the real network, even if a route is missed.
    '--host-resolver-rules=MAP * ~NOTFOUND',
    '--no-first-run',
  ],
});
const steps = [];
const step = name => { steps.push(name); console.log(`ok - ${name}`); };
try {
  await context.route(/^https?:/, route => {
    const url = route.request().url();
    if (FAKE_SITES.test(url)) return route.fulfill({ contentType: 'text/html', body: fixture });
    if (url === OTHER_SITE) return route.fulfill({ contentType: 'text/html', body: '<title>Other site</title><p>Not Facebook</p>' });
    return route.abort();
  });

  let [worker] = context.serviceWorkers();
  worker ??= await context.waitForEvent('serviceworker');
  const extensionId = new URL(worker.url()).host;
  const extensionUrl = file => `chrome-extension://${extensionId}/${file}`;
  const blockUrl = extensionUrl('block.html');
  const state = () => worker.evaluate(() => chrome.storage.local.get(['usage', 'dailyLimitMinutes']));
  const update = () => worker.evaluate(() => scheduleUpdate());
  step(`service worker started (${worker.url()})`);

  // Options page: save a one-minute allowance.
  const options = await context.newPage();
  await options.goto(extensionUrl('options.html'));
  await options.locator('#minutes:enabled').fill('1');
  await options.click('#save');
  await options.locator('#status', { hasText: 'Saved: 1 minute per day.' }).waitFor();
  assert.equal((await state()).dailyLimitMinutes, 1);
  step('options page saves the daily limit');
  await options.close();

  // A non-Facebook tab is never counted or redirected.
  const page = await context.newPage();
  await page.goto(OTHER_SITE);
  await page.bringToFront();
  await update();
  assert.equal((await state()).usage.since, null, 'other sites do not count');
  step('other sites are not counted');

  // The Facebook stand-in counts time and keeps loading its feed; the
  // content script prints the shared countdown in the page console.
  const pageLogs = [];
  page.on('console', message => pageLogs.push(message.text()));
  await page.goto('https://www.facebook.com/');
  await page.bringToFront();
  await update();
  const counting = (await state()).usage;
  assert.ok(counting.since, `timer counts on Facebook: ${JSON.stringify(counting)}`);
  await page.locator('[role="feed"] [role="article"]').nth(4).waitFor();
  step('Facebook tab counts time while its feed loads dynamically');
  const deadline = Date.now() + 8000;
  while (!pageLogs.some(line => /\[Fuck Facebook timer\] counting \| \d+s remaining/.test(line)) && Date.now() < deadline) {
    await page.waitForTimeout(250);
  }
  assert.ok(pageLogs.some(line => line.includes('Page diagnostics loaded')), `content script loaded: ${pageLogs.join(' / ')}`);
  assert.ok(pageLogs.some(line => /counting \| \d+s remaining/.test(line)), 'content script prints countdown');
  step('content script prints the countdown in the page console');

  // Leave 3 seconds of allowance; the alarm must redirect the tab by itself.
  await worker.evaluate(() => chrome.storage.local.set({ usage: { day: dayKey(Date.now()), elapsed: 57000, since: null } }));
  await update();
  const started = Date.now();
  await page.waitForURL(blockUrl, { timeout: 45000 });
  step(`deadline alarm redirected Facebook to the shame page after ${((Date.now() - started) / 1000).toFixed(1)}s`);
  const usage = (await state()).usage;
  assert.ok(usage.elapsed >= 60000 && usage.since === null, JSON.stringify(usage));
  await page.locator('#limit-message', { hasText: 'Your daily limit is 1 minute' }).waitFor();
  const insult = await page.locator('#insult').textContent();
  assert.ok(insult && insult !== 'Loading shame...', 'an insult is shown');
  assert.match(await page.locator('#count').textContent(), /^\d+$/);
  assert.equal(await page.locator('.footer').evaluate(el => getComputedStyle(el).marginTop), '34px', 'footer styled (#4)');
  step('shame page shows the limit, an insult, the visit count and the styled footer');

  // Further visits the same day, including Messenger, are blocked.
  const messenger = await context.newPage();
  await messenger.goto('https://www.messenger.com/').catch(() => {});
  await messenger.waitForURL(blockUrl, { timeout: 10000 });
  step('new Messenger visit after the limit is redirected');

  // "Close this tab" closes a tab that has history (#2).
  assert.ok(await messenger.evaluate(() => history.length) > 1);
  const closed = messenger.waitForEvent('close', { timeout: 5000 });
  await messenger.click('#close', { noWaitAfter: true }).catch(() => {});
  await closed;
  step('"Close this tab" closes the shame-page tab');

  // Raising the limit allows Facebook again without clearing usage.
  const before = (await state()).usage.elapsed;
  await worker.evaluate(() => chrome.storage.local.set({ dailyLimitMinutes: 60 }));
  await page.goto('https://www.facebook.com/');
  await page.bringToFront();
  await update();
  await page.waitForTimeout(500);
  assert.equal(new URL(page.url()).host, 'www.facebook.com');
  assert.ok((await state()).usage.elapsed >= before, 'usage preserved');
  step('raising the limit permits Facebook again and keeps usage');

  console.log(`PASS (Chromium ${context.browser()?.version() ?? ''}): ${steps.length} checks with the unpacked Chrome build.`);
} finally {
  await context.close();
  fs.rmSync(profile, { recursive: true, force: true });
}
