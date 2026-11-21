const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const target = process.argv.includes('--chrome') ? 'chrome' : 'firefox';
const root = path.resolve(__dirname, '..', 'dist', target);
let now = new Date(2026, 10, 16, 12).getTime();
class Clock extends Date {
  constructor(...args) { super(...(args.length ? args : [now])); }
  static now() { return now; }
}
let changed, tick;
const logs = [];
const ctx = vm.createContext({
  Date: Clock,
  console: {log: (...args) => logs.push(args.join(' ')), error: error => { throw error; }},
  setInterval(fn, ms) { assert.equal(ms, 5000); tick = fn; },
  [target === 'chrome' ? 'chrome' : 'browser']: {
    storage: {
      local: {async get() { return {dailyLimitMinutes: 1, usage: {day: new Clock().toLocaleDateString('en-CA'), elapsed: 10000, since: now}}; }},
      onChanged: {addListener(fn) { changed = fn; }}
    }
  }
});
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')));
for (const script of manifest.content_scripts[0].js) {
  vm.runInContext(fs.readFileSync(path.join(root, script), 'utf8'), ctx);
}
setImmediate(() => {
  assert.match(logs.at(-1), /counting \| 50s remaining \| 10s used/);
  now += 5000;
  tick();
  assert.match(logs.at(-1), /counting \| 45s remaining \| 15s used/);
  changed({usage: {newValue: {day: new Clock().toLocaleDateString('en-CA'), elapsed: 15000, since: null}}}, 'local');
  now += 5000;
  tick();
  assert.match(logs.at(-1), /paused \| 45s remaining \| 15s used/);
  changed({dailyLimitMinutes: {newValue: 2}}, 'local');
  tick();
  assert.match(logs.at(-1), /paused \| 105s remaining/);
  console.log(`PASS (${target} content script): page console countdown, pause and changed limit.`);
});
