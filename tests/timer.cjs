const vm = require('node:vm');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const worker = process.argv.includes('--worker');
// Tests the built extension: run `npm run build` first (npm test does).
const root = path.resolve(__dirname, '..', 'dist', worker ? 'chrome' : 'firefox');
let now = new Date(2026, 10, 16, 12).getTime();
class Clock extends Date {
  constructor(...args) { super(...(args.length ? args : [now])); }
  static now() { return now; }
}
const data = {};
let sessionData = {};
let focused = true, url = 'https://facebook.com/', redirects = 0;
const alarms = new Map();
const event = { addListener() {} };
let onChanged;
const chrome = {
  runtime: { getURL: p => 'extension://' + p, onStartup: event, onInstalled: event },
  storage: {
    local: { async get() { return JSON.parse(JSON.stringify(data)); }, async set(value) { Object.assign(data, JSON.parse(JSON.stringify(value))); } },
    session: { async get() { return {...sessionData}; }, async set(value) { Object.assign(sessionData, value); } },
    onChanged: { addListener(fn) { onChanged = fn; } }
  },
  tabs: { async query() { return [{id: 1, active: true, windowId: 1, url}]; }, async update(id, value) { redirects++; url = value.url; }, onActivated: event, onUpdated: event, onRemoved: event },
  windows: { async getLastFocused() { return {id: 1, focused}; }, onFocusChanged: event },
  alarms: { async create(name, value) { alarms.set(name, value); }, async clear(name) { alarms.delete(name); }, onAlarm: event }
};
const timerLogs = [], timerErrors = [];
// Firefox exposes the API as `browser`, Chrome as `chrome`.
const ctx = vm.createContext({[worker ? 'chrome' : 'browser']: chrome, Date: Clock, URL, console: {
  ...console,
  log(...args) { timerLogs.push(args); },
  error(...args) { timerErrors.push(args); }
}});
const unhandled = [];
process.on('unhandledRejection', error => unhandled.push(error));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const runScript = script => vm.runInContext(fs.readFileSync(path.join(root, script), 'utf8'), ctx);
if (worker) {
  ctx.importScripts = (...scripts) => scripts.forEach(runScript);
  runScript(manifest.background.service_worker);
} else {
  // Firefox background pages have no importScripts global.
  for (const script of manifest.background.scripts) runScript(script);
}
const update = (reset = false) => vm.runInContext(`scheduleUpdate(${reset})`, ctx);
(async () => {
  await update();
  assert.equal(alarms.get('usage-limit').when, now + 3600000);
  assert.equal(timerLogs.at(-1)[1].state, 'counting');
  assert.equal(timerLogs.at(-1)[1].remainingSeconds, 3600);
  for (const value of [undefined, null, 0, -1, 1.5, '30', 1441]) {
    ctx.input = value;
    assert.equal(vm.runInContext('getLimitMinutes(input)', ctx), 60);
  }
  now += 20 * 60000;
  data.dailyLimitMinutes = 30;
  onChanged({dailyLimitMinutes: {newValue: 30}}, 'local');
  await update();
  assert.equal(data.usage.elapsed, 20 * 60000);
  assert.equal(alarms.get('usage-limit').when, now + 10 * 60000);
  assert.equal(timerLogs.at(-1)[1].remainingSeconds, 600);
  data.dailyLimitMinutes = 10;
  await update();
  assert.equal(redirects, 1);
  assert.equal(timerLogs.at(-1)[1].state, 'limit reached');
  assert.equal(timerLogs.at(-1)[1].remainingSeconds, 0);
  assert.equal(data.usage.elapsed, 20 * 60000, 'lowering limit preserves usage');
  data.dailyLimitMinutes = 60;
  url = 'https://messenger.com/';
  await update();
  assert.equal(redirects, 1, 'raising limit permits continued use');
  assert.equal(alarms.get('usage-limit').when, now + 40 * 60000);
  now += 5 * 60000;
  focused = false;
  await update();
  assert.equal(timerLogs.at(-1)[1].state, 'paused');
  assert.equal(timerLogs.at(-1)[1].remainingSeconds, 35 * 60);
  now += 2 * 3600000;
  await update();
  assert.equal(data.usage.elapsed, 25 * 60000);
  focused = true;
  await update();
  now += 35 * 60000;
  await update();
  assert.equal(redirects, 2);
  now = new Date(2026, 10, 17, 1).getTime();
  url = 'https://facebook.com/';
  await update();
  assert.equal(data.usage.elapsed, 0);
  assert.equal(data.dailyLimitMinutes, 60);
  now += 60000;
  await update(true);
  assert.equal(data.usage.elapsed, 0);
  // Background suspended and restarted within the same browser session: the
  // time the tab stayed active still counts.
  now += 10 * 60000;
  await update();
  assert.equal(data.usage.elapsed, 10 * 60000, 'worker restart keeps counting');
  // Browser closed for two hours while counting, then reopened the same day.
  // The top-level update runs before runtime.onStartup and must not count it.
  assert.ok(data.usage.since !== null);
  now += 2 * 3600000;
  sessionData = {};
  await update();
  assert.equal(data.usage.elapsed, 10 * 60000, 'closed-browser time is not counted');
  assert.equal(data.usage.since, now);
  now += 60000;
  await update();
  assert.equal(data.usage.elapsed, 11 * 60000, 'counting resumes after restart');
  // A failing update is logged once, is not an unhandled rejection, and does
  // not stop the next update.
  const query = chrome.tabs.query;
  chrome.tabs.query = async () => { throw new Error('tabs unavailable'); };
  vm.runInContext('scheduleUpdate()', ctx);
  await vm.runInContext('pending', ctx);
  chrome.tabs.query = query;
  await update();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(timerErrors.length, 1, 'failure logged once');
  assert.match(String(timerErrors[0][1]), /tabs unavailable/);
  assert.deepEqual(unhandled, [], 'no unhandled rejections');
  assert.equal(timerLogs.at(-1)[1].state, 'counting');
  console.log(`PASS (${worker ? 'Chrome worker' : 'Firefox background page'}): default/invalid settings, live limit changes, preserved usage, focus pause, threshold, midnight, startup, browser restart and update errors.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
