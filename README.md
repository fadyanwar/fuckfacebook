# Fuck Facebook

A browser extension for Firefox and Chrome that conditions you not to open Facebook by insulting you instead.

By default, you get one hour per day across Facebook and Messenger (facebook.com, fb.com, messenger.com). The timer counts time while one of these sites is the active tab in the focused browser window, including time left idle in that tab. Background tabs and time with the browser unfocused do not count. After the configured limit, all open matching tabs redirect to the shame page, and further visits are blocked until the next local calendar day. Usage is saved across browser restarts; time while the browser is closed or the computer is asleep does not count.

Both browsers run the same code from `src/`. The build adds a manifest for each browser.

## Installation

### Firefox: signed extension (permanent installation)

This extension supports both the [Firefox Add-ons listing](https://addons.mozilla.org/en-US/firefox/addon/fuck-facebook/) and **unlisted** Mozilla-signed `.xpi` files for direct distribution. Listed releases become available after Mozilla approves them.

1. Download the signed file from your Mozilla developer account after signing completes.
2. In Firefox, open `about:addons`, click the gear menu, and choose **Install Add-on From File…**.
3. Select the `.xpi` and approve the installation.

It remains installed across browser restarts. The unsigned ZIP from `npm run build` (`dist/fuckfacebook-firefox-<version>.zip`) is a submission package. You cannot install it permanently.

### Firefox: development (temporary installation)

1. Build the extension (see [Building](#building)), or download a build.
2. Open Firefox and go to `about:debugging`.
3. Click **This Firefox** in the left sidebar.
4. Click **Load Temporary Add-on…**
5. Select `dist/firefox/manifest.json`.

> Note: Firefox removes temporary add-ons when it restarts. Load the add-on again in `about:debugging` after each restart.

Firefox for Android (142 or later) is supported by the same build. Android has no window focus events, so there the timer counts whenever a Facebook tab is the tab on screen.

### Chrome (and other Chromium browsers)

The extension is not published on the Chrome Web Store. Install it unpacked:

1. Build the extension (see [Building](#building)).
2. Open `chrome://extensions`.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked**.
5. Select the `dist/chrome` folder.

Chrome keeps unpacked extensions across restarts. After changing the source, run the build again and click the reload icon on the extension's card. It needs Chrome 120 or later. Edge, Brave, and other Chromium browsers load `dist/chrome` the same way from their own extensions page.

## Settings

Open the extension's options:

- **Firefox:** **Preferences** in the Add-ons Manager (`about:addons`).
- **Chrome:** **Details → Extension options** on `chrome://extensions`, or right-click the toolbar icon and choose **Options**.
- **Either browser:** click **Change daily limit** on the shame page.

Set a daily allowance from 1 to 1,440 whole minutes and click **Save**. The default is 60 minutes. Changes apply immediately and keep today's usage. Raising the limit allows more time; reopen Facebook or Messenger to continue. **Reset to one hour** restores the default allowance without clearing usage.

## How it works

- `background.js` tracks focused-tab time using persistent storage and browser alarms.
- The daily allowance is shared across tabs and both sites, and resets at local midnight.
- A browser restart is detected with `storage.session`, so time while the browser is closed is never counted.
- No alarms fire while the computer is asleep, so one update adds at most 90 seconds (the timer normally updates every 30 seconds). Waking from sleep does not use up the limit.
- At the limit, matching tabs redirect to `block.html`.
- `block.html` rotates insults every 1.5 seconds and keeps a count of limit-page visits.
- **Close this tab** closes the shame page.

The extension does not read or change Facebook's pages. Its content script only prints the shared timer status in the page console, so changes to Facebook's markup cannot break it.

## Firefox and Chrome differences

| | Firefox | Chrome |
|---|---|---|
| Manifest | MV3, `manifests/base.json` + `manifests/firefox.json` | MV3, `manifests/base.json` + `manifests/chrome.json` |
| Background | Event page (`background.scripts`: `ext.js`, `settings.js`, `background.js`) | Service worker (`background.js` loads `ext.js` and `settings.js` with `importScripts`) |
| API namespace | `browser` (through the `ext` shim) | `chrome` (through the `ext` shim) |
| Browser-specific keys | `browser_specific_settings.gecko` (add-on ID, data-collection declaration), `gecko_android` | `minimum_chrome_version: 120` |
| Minimum version | Firefox 140, Firefox for Android 142 | Chrome 120 |
| Mobile | Firefox for Android supported | No extensions on Chrome for Android |
| Private browsing | Runs in private windows only if you allow it in `about:addons` | Runs in Incognito only if you turn on **Allow in Incognito** |
| Background console | `about:debugging` → **This Firefox** → **Inspect** | `chrome://extensions` → **Inspect views: service worker** |

The behaviour is the same in both browsers. The extension uses the same permissions in both (`tabs`, `storage`, `alarms`, and host access to Facebook, fb.com and Messenger). It redirects with `tabs.update`, so neither build needs `webRequest`, `declarativeNetRequest`, or `scripting`.

Two smaller differences:

- **Alarm timing.** Chrome fires alarms in packed (store-installed) extensions at most every 30 seconds. A redirect at the deadline can therefore arrive up to 30 seconds late, and the periodic check runs every 30 seconds. Unpacked builds and Firefox fired the deadline alarm on time in testing.
- **Background suspension.** The Chrome service worker and the Firefox event page are both suspended when idle. Usage is kept in `storage.local`, so suspension does not lose or add time.

`src/ext.js` is the whole cross-browser layer: `globalThis.ext = globalThis.browser ?? globalThis.chrome`. Chrome MV3 APIs return promises, so the shared code needs no other wrapper.

## Permissions and privacy

The extension uses:

- `tabs` to identify Facebook and Messenger tabs and redirect them. This also keeps it working if you withdraw its site access.
- `storage` to save settings and usage locally.
- `alarms` to enforce the limit while its background script is suspended.

Host permissions cover Facebook, fb.com, Messenger, and their subdomains. They let the page-console diagnostics run on those sites. The extension does not send browsing history or usage data to a server.

## Building

Install the pinned tools once with `npm ci`. This includes a local Node 22, which `web-ext` needs.

```sh
npm ci
npm run build            # both browsers
npm run build firefox    # or: npm run build chrome
```

The build writes `dist/firefox/` and `dist/chrome/` (loadable folders) and `dist/fuckfacebook-<browser>-<version>.zip` (store-ready packages). The script is `scripts/build.mjs` and has no dependencies. It copies `src/`, merges `manifests/base.json` with the browser's manifest, checks that every file the manifest references exists, and writes ZIPs that are identical for identical input. The version lives in `manifests/base.json`.

## Testing

| Command | What it runs |
|---|---|
| `npm test` | Build, simulated unit tests, and `web-ext lint` of the Firefox build (warnings fail) |
| `npm run test:chrome` | Loads `dist/chrome` unpacked in headed Chromium (Playwright, under `xvfb-run`) |
| `npm run test:firefox` | Runs `dist/firefox` in a real headless Firefox through `web-ext run` |
| `npm run test:all` | All of the above |

The browser tests use local stand-ins only and never contact Facebook. `tests/fixtures/facebook.html` imitates Facebook's page structure: a banner, navigation, and a feed that keeps loading posts.

- **Chrome test.** Playwright answers every `https://*.facebook.com/`, `messenger.com` and `fb.com` request with the fixture. Host resolution is disabled, so nothing reaches the network. The test checks that:
  - the options page saves a limit;
  - other sites are not counted;
  - Facebook is counted while its feed loads;
  - the content script prints the countdown;
  - the deadline alarm redirects to the shame page;
  - the shame page content is correct;
  - later Messenger visits are blocked;
  - **Close this tab** works;
  - raising the limit allows Facebook again.
- **Firefox test.** Serves the fixture on a local port under the `facebook.com` hostname, using an isolated temporary profile. It checks startup, usage increasing, page-console diagnostics, and the alarm redirect. Set `FIREFOX_BINARY` to change the Firefox executable.

Unit tests (`tests/*.cjs`) run the built files in Node with mocked browser APIs:

- `timer.cjs`: the Firefox event page; with `--worker`, the Chrome service worker. It covers:
  - the default limit and invalid settings;
  - live limit changes and preserved usage;
  - pausing while unfocused;
  - the threshold redirect;
  - midnight and startup resets;
  - browser restarts and failed updates.
- `timer-android.cjs`: no `windows` API.
- `timer-debug.cjs`: the page-console countdown in each build.
- `build.cjs`: manifest parity, the per-browser background, the shim, no HTML-injection sinks or inline scripts, and reproducible ZIPs.

### Console diagnostics

The Facebook and Messenger page consoles print the shared timer status every 5 seconds, for example `[Fuck Facebook timer] counting | 3540s remaining | 60s used (shared daily timer)`. These diagnostics read saved usage and do not change the timer. Messages show `counting`, `paused`, or `limit reached`. Browser throttling may delay logs in background tabs.

For background events, open the background console (see the table above). Updates print on tab and focus changes and about every 30 seconds. Enter `scheduleUpdate()` there to print immediately. Keep Facebook or Messenger active in the focused browser window to count time; focusing a separate debugging window pauses usage.

## Signing for your own Firefox distribution

1. Generate a JWT issuer and secret at https://addons.mozilla.org/developers/addon/api/key/.
2. Run `python3 setup-amo-credentials.py` in a terminal. It hides input, rejects empty entries, and saves `.amo-credentials.json` with owner-only permissions. Git ignores this file.
3. Run `npm ci` once, then `npm run build firefox`. The clean source folder is `dist/firefox/`. It contains only the files the extension needs, never credentials or credential scripts.
4. Supply the saved `apiKey` and `apiSecret` to `web-ext` as the `WEB_EXT_API_KEY` and `WEB_EXT_API_SECRET` environment variables. Then run `npx web-ext sign --channel unlisted --source-dir dist/firefox --artifacts-dir web-ext-artifacts`. This signs the extension for self-distribution without creating a public listing. `web-ext` does not read the local JSON file automatically.
5. Wait for Mozilla to finish signing. If the command times out while signing is pending, check your email and https://addons.mozilla.org/developers/ for the signed download. Install or share the resulting `.xpi`.

The internal extension ID is `fuckfacebook@fadyanwar.local`. Keep this ID unchanged when publishing updates, and increase the version in `manifests/base.json` for each new submission. A build previously signed as `fuckfacebook-fady-2026@fadyanwar.local` is a separate extension in Firefox; a build with the restored original ID must be signed again. Self-distributed updates must be installed manually unless you configure update hosting.

## Changes in version 1.7

- Adds a Chrome build (Manifest V3 service worker) from the same source. Per-browser manifests and `scripts/build.mjs` produce `dist/firefox`, `dist/chrome`, and ZIPs.
- Fixes the timer counting the time the browser was closed after a same-day restart (#1).
- Fixes **Close this tab**, which did nothing after a redirect (#2).
- Logs a failed timer update once instead of as an unhandled rejection (#3).
- Styles the shame-page footer (#4).
- Supports Firefox for Android 142+ and fixes the `web-ext lint` minimum-version warning (#5).
- Removes stale ZIPs from the repository and pins the build and test tools (#6).
- Does not count time while the computer is asleep (#8).
- Gives Firefox its own manifest, which fixes the `web-ext lint` warning that `background.service_worker` is ignored (#7).

## Changes in versions 1.5 and 1.6

- Fixes Firefox timer startup by loading settings as a background script.
- Prints a shared countdown in Facebook and Messenger page consoles every five seconds, plus background event logs.
- Tests Firefox background-page loading, Chrome worker loading, countdown logs, and a real Firefox deadline redirect.
- Uses version 1.5 for unlisted distribution and 1.6 for the listed channel, because Mozilla requires unique version numbers across channels. Both contain the same extension code.

## Changes in version 1.4

- Replaces immediate blocking with a daily time allowance shared by Facebook and Messenger.
- Defaults to 60 minutes; Preferences accepts 1–1,440 whole minutes and includes a reset-to-default button.
- Applies settings changes immediately without clearing today's usage.
- Saves daily usage across restarts and resets it at local midnight.
- Updates the shame page to show the configured allowance and link to settings.
- Adds a local credential setup script for Mozilla signing.

## Psychological rationale

This is **aversive conditioning** (positive punishment). It pairs an unwanted behaviour (opening Facebook) with an immediate unpleasant stimulus (being called a loser, stupid, or a time-wasting monkey). Over time, the brain begins to associate Facebook with shame rather than reward, which reduces the urge to open it.

It also uses:

- **Immediate feedback**: the insult appears when you reach the daily limit, creating a tight behaviour–consequence loop.
- **Self-monitoring**: the persistent counter makes the frequency of the habit visible, increasing awareness.
- **Pattern interruption**: instead of the expected dopamine hit from the Facebook feed, you get a jarring negative stimulus that breaks the compulsive loop.

This is a joke/self-help tool, not therapy. If social media use is causing real distress, consider speaking with a mental health professional.

## Files

- `src/` — shared extension source for both browsers
  - `background.js` — tracks daily Facebook/Messenger usage and enforces the limit
  - `ext.js` — `browser`/`chrome` namespace shim
  - `settings.js` — default allowance and settings validation
  - `block.html` / `block.js` — the shame page: insults, the configured limit, the visit counter
  - `options.html` / `options.js` — daily allowance preferences
  - `timer-debug.js` — prints shared timer status in Facebook and Messenger page consoles
- `manifests/` — `base.json` (shared) plus `firefox.json` and `chrome.json`
- `scripts/build.mjs` — builds `dist/<browser>/` and ZIPs
- `tests/` — unit tests, the Chromium and Firefox browser tests, and the mock Facebook page
- `setup-amo-credentials.py` — local Mozilla credential setup

## License

MIT
