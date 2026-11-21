// Checks the per-browser builds produced by scripts/build.mjs.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const zlib = require('node:zlib');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');

// Reads the file names and contents from a ZIP written by scripts/build.mjs.
function unzip(buffer) {
  const files = {};
  let offset = 0;
  while (buffer.readUInt32LE(offset) === 0x04034b50) {
    const size = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extra = buffer.readUInt16LE(offset + 28);
    const name = buffer.toString('utf8', offset + 30, offset + 30 + nameLength);
    const start = offset + 30 + nameLength + extra;
    files[name] = zlib.inflateRawSync(buffer.subarray(start, start + size));
    offset = start + size;
  }
  return files;
}

(async () => {
  const { build, manifestFor } = await import(path.join(root, 'scripts', 'build.mjs'));
  const firefox = manifestFor('firefox');
  const chrome = manifestFor('chrome');

  for (const key of ['manifest_version', 'name', 'version', 'description', 'permissions', 'host_permissions', 'content_scripts', 'options_ui']) {
    assert.deepEqual(firefox[key], chrome[key], `${key} is shared`);
  }
  assert.equal(firefox.manifest_version, 3);
  assert.deepEqual(Object.keys(firefox.background), ['scripts'], 'Firefox uses an event page only');
  assert.equal(firefox.browser_specific_settings.gecko.id, 'fuckfacebook@fadyanwar.local', 'Firefox add-on ID unchanged');
  assert.deepEqual(Object.keys(chrome.background), ['service_worker'], 'Chrome uses a service worker only');
  assert.equal(chrome.browser_specific_settings, undefined, 'no Firefox keys in the Chrome manifest');
  assert.ok(Number(chrome.minimum_chrome_version) >= 120, 'Chrome 120+ for 30-second alarms');
  assert.deepEqual(firefox.permissions, ['tabs', 'storage', 'alarms'], 'no new permissions');

  // The shared code goes through the ext shim and never builds HTML from data.
  const src = path.join(root, 'src');
  for (const file of fs.readdirSync(src).filter(name => name.endsWith('.js') && name !== 'ext.js')) {
    const code = fs.readFileSync(path.join(src, file), 'utf8');
    assert.doesNotMatch(code, /\b(chrome|browser)\.[a-z]/, `${file} uses ext.* instead of chrome.*/browser.*`);
    assert.doesNotMatch(code, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\(|new Function/, `${file} avoids HTML/code injection sinks`);
  }
  for (const file of fs.readdirSync(src).filter(name => name.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(src, file), 'utf8');
    assert.doesNotMatch(html, /<script>(?!<)|\son[a-z]+=/i, `${file} has no inline scripts or handlers (MV3 CSP)`);
  }

  // The shim prefers Firefox's promise-based `browser` and falls back to `chrome`.
  const shim = fs.readFileSync(path.join(src, 'ext.js'), 'utf8');
  const both = vm.createContext({ browser: 'browser-api', chrome: 'chrome-api' });
  vm.runInContext(shim, both);
  assert.equal(both.ext, 'browser-api');
  const chromeOnly = vm.createContext({ chrome: 'chrome-api' });
  vm.runInContext(shim, chromeOnly);
  assert.equal(chromeOnly.ext, 'chrome-api');

  for (const target of ['firefox', 'chrome']) {
    const first = build(target);
    const bytes = fs.readFileSync(first.archive);
    build(target);
    assert.ok(bytes.equals(fs.readFileSync(first.archive)), `${target} ZIP is reproducible`);
    const zipped = unzip(bytes);
    const dir = fs.readdirSync(first.dir).sort();
    assert.deepEqual(Object.keys(zipped).sort(), dir, `${target} ZIP matches dist/${target}`);
    for (const name of dir) assert.ok(zipped[name].equals(fs.readFileSync(path.join(first.dir, name))), `${target}/${name} zipped intact`);
    assert.deepEqual(JSON.parse(zipped['manifest.json']), manifestFor(target));
  }
  console.log('PASS (build): shared manifest keys, per-browser background, shim, no injection sinks, reproducible ZIPs.');
})().catch(error => { console.error(error); process.exitCode = 1; });
