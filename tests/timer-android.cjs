// Firefox for Android has no windows API; the background script must still
// load and count time in the active Facebook tab.
const vm = require('node:vm');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..', 'dist', 'firefox');
let now = new Date(2026, 10, 16, 12).getTime();
class Clock extends Date {
  constructor(...args) { super(...(args.length ? args : [now])); }
  static now() { return now; }
}
const data = {};
let url = 'https://m.facebook.com/', redirects = 0;
const event = { addListener() {} };
const chrome = {
  runtime: { getURL: p => 'extension://' + p, onStartup: event, onInstalled: event },
  storage: {
    local: { async get() { return JSON.parse(JSON.stringify(data)); }, async set(value) { Object.assign(data, JSON.parse(JSON.stringify(value))); } },
    session: { data: {}, async get() { return {...this.data}; }, async set(value) { Object.assign(this.data, value); } },
    onChanged: event
  },
  tabs: {
    async query() { return [{id: 1, active: false, windowId: 1, url: 'https://example.com/'}, {id: 2, active: true, windowId: 1, url}]; },
    async update() { redirects++; }, onActivated: event, onUpdated: event, onRemoved: event
  },
  alarms: { async create() {}, async clear() {}, onAlarm: event }
};
const ctx = vm.createContext({browser: chrome, Date: Clock, URL, console: {log() {}, error(...args) { throw args[1] || args[0]; }}});
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
for (const script of manifest.background.scripts) vm.runInContext(fs.readFileSync(path.join(root, script), 'utf8'), ctx);
(async () => {
  await vm.runInContext('pending', ctx);
  assert.equal(data.usage.since, now, 'counting starts without a windows API');
  now += 61 * 60000;
  await vm.runInContext('scheduleUpdate()', ctx);
  assert.equal(redirects, 1, 'limit enforced without a windows API');
  console.log('PASS (Firefox for Android): background loads and enforces the limit without a windows API.');
})().catch(error => { console.error(error); process.exitCode = 1; });
