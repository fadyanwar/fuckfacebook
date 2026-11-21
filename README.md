# Fuck Facebook

A Firefox extension that conditions you not to open Facebook by insulting you instead.

By default, you get one hour per day across Facebook and Messenger (facebook.com, fb.com, messenger.com). The timer counts time while one of these sites is the active tab in the focused browser window, including time left idle in that tab. Background tabs and time with the browser unfocused do not count. After the configured limit, all open matching tabs redirect to the shame page, and further visits are blocked until the next local calendar day. Usage is saved across browser restarts; time while the browser is closed does not count.

## Installation

### Signed extension (permanent installation)

This extension supports both the [Firefox Add-ons listing](https://addons.mozilla.org/en-US/firefox/addon/fuck-facebook/) and **unlisted** Mozilla-signed `.xpi` files for direct distribution. Listed releases become available after Mozilla approval. Download the signed file from your Mozilla developer account after signing completes. In Firefox, open `about:addons`, click the gear menu, choose **Install Add-on From File…**, select the `.xpi`, and approve installation. It remains installed across browser restarts. The unsigned ZIP produced by `npm run build` (`dist/fuckfacebook-firefox-<version>.zip`) is a submission package, not a permanently installable extension.

### Development (temporary installation)

1. Clone or download this repository.
2. Open Firefox and go to `about:debugging`.
3. Click **This Firefox** in the left sidebar.
4. Click **Load Temporary Add-on…**
5. Select the `manifest.json` file from this folder.

The extension is now active. After the configured daily allowance (one hour by default), Facebook and Messenger will redirect to the shame page.

> Note: Temporary add-ons are removed when Firefox restarts. Reload the add-on in `about:debugging` after each restart.

## Settings

Open the extension’s **Preferences** in Firefox’s Add-ons Manager (`about:addons`), or click **Change daily limit** on the shame page. Set a daily allowance from 1 to 1,440 whole minutes and click **Save**. The default is 60 minutes. Changes apply immediately and preserve today’s usage. Raising the limit allows more time; reopen Facebook or Messenger to continue. **Reset to one hour** restores the default allowance without clearing usage.

## How it works

- `background.js` tracks focused tab time using persistent storage and browser alarms.
- The daily allowance is shared across tabs and both sites, and resets at local midnight.
- At the limit, matching tabs redirect to `block.html`.
- `block.html` rotates insults every 1.5 seconds and keeps a count of limit-page visits.
- Clicking **Close this tab** closes the shame page.

## Permissions and privacy

The extension uses `tabs` to identify Facebook and Messenger tabs and redirect them, `storage` to save settings and usage locally, and `alarms` to enforce the limit while its background worker is suspended. Host permissions cover Facebook, fb.com, Messenger, and their subdomains. It does not send browsing history or usage data to a server.

## Signing for your own distribution

1. Generate a JWT issuer and secret at https://addons.mozilla.org/developers/addon/api/key/.
2. Run `python3 setup-amo-credentials.py` in a terminal. It hides input, rejects empty entries, and saves `.amo-credentials.json` with owner-only permissions. This file is excluded from Git.
3. Run `npm ci` once, then `npm run build firefox`. The clean source folder is `dist/firefox/`; it contains only the files the extension needs, never credentials or credential scripts.
4. Supply the saved `apiKey` and `apiSecret` to `web-ext` as `WEB_EXT_API_KEY` and `WEB_EXT_API_SECRET` environment variables, then run `npx web-ext sign --channel unlisted --source-dir dist/firefox --artifacts-dir web-ext-artifacts`. This signs the extension for self-distribution without creating a public listing. The local JSON file is not automatically loaded by `web-ext`.
5. Wait for Mozilla to finish signing. If the command times out while signing is pending, check your email and https://addons.mozilla.org/developers/ for the signed download. Install or share the resulting `.xpi`.

The internal extension ID is `fuckfacebook@fadyanwar.local`. Keep this ID unchanged when publishing updates and increase the manifest version for each new submission. A build previously signed as `fuckfacebook-fady-2026@fadyanwar.local` is a separate extension in Firefox; a build with the restored original ID requires signing again. Self-distributed updates must be installed manually unless you configure update hosting.

## Validation

The Facebook and Messenger page consoles print the shared timer status every 5 seconds, for example `[Fuck Facebook timer] counting | 3540s remaining | 60s used (shared daily timer)`. These diagnostics read saved usage; they do not change the timer. Messages show `counting`, `paused`, or `limit reached`. Browser throttling may delay logs in background tabs. Reload the extension and the site after changing these source files. A separately installed signed extension needs an updated signed build.

For background events, open `about:debugging` → **This Firefox** → **Inspect** for the extension → **Console**. Updates print on tab/focus changes and approximately every 30 seconds. Enter `scheduleUpdate()` there to print immediately. Keep Facebook or Messenger active in the focused browser window to count time; focusing a separate debugging window pauses usage.

Install the pinned tools with `npm ci` (this includes a local Node 22, which `web-ext` needs). `npm test` runs the simulated timer checks and `web-ext lint`. The checks are `node tests/timer.cjs` for Firefox background-page loading, `node tests/timer.cjs --worker` for Chrome service-worker loading, `node tests/timer-android.cjs` for Firefox for Android (no `windows` API), and `node tests/timer-debug.cjs` for page-console countdown and paused status. These cover the default limit, invalid settings, changing limits during a session, preserving recorded usage, pausing while unfocused, redirecting at the threshold, and daily/startup resets. Run `npm run test:firefox` (`python3 tests/firefox-timer.py`) for an automated live Firefox test of the `dist/firefox` build using an isolated temporary profile and a local page under the Facebook hostname. It verifies startup, recorded usage increasing, page-console diagnostics, and automatic alarm-based redirection. Set `FIREFOX_BINARY` to override the Firefox executable.

## Changes in versions 1.5 and 1.6

- Fixes Firefox timer startup by loading settings as a background script.
- Prints a shared countdown in Facebook and Messenger page consoles every five seconds, plus background event logs.
- Tests Firefox background-page loading, Chrome worker loading, countdown logs, and a real Firefox deadline redirect.
- Uses version 1.5 for unlisted distribution and 1.6 for the listed channel because Mozilla requires unique version numbers across channels. Both contain the same extension code.

## Changes in version 1.4

- Replaces immediate blocking with a daily time allowance shared by Facebook and Messenger.
- Defaults to 60 minutes; Preferences accepts 1–1,440 whole minutes and includes a reset-to-default button.
- Applies settings changes immediately without clearing today’s usage.
- Saves daily usage across restarts and resets it at local midnight.
- Updates the shame page to reflect the configured allowance and links to settings.
- Adds a local credential setup script for Mozilla signing.

## Psychological rationale

This is **aversive conditioning** (positive punishment): pairing an unwanted behavior (opening Facebook) with an immediate unpleasant stimulus (being called a loser/stupid/time wasting monkey). Over time, the brain begins to associate Facebook with shame rather than reward, reducing the urge to open it.

It also leverages:

- **Immediate feedback**: the insult appears when you reach the daily limit, creating a tight behavior–consequence loop.
- **Self-monitoring**: the persistent counter makes the frequency of the habit visible, increasing awareness.
- **Pattern interruption**: instead of the expected dopamine hit from the Facebook feed, you get a jarring negative stimulus that breaks the compulsive loop.

This is a joke/self-help tool, not therapy. If social media use is causing real distress, consider speaking with a mental health professional.

## Files

- `manifest.json` — Firefox extension manifest (MV3)
- `background.js` — tracks daily Facebook/Messenger usage and enforces the limit
- `block.html` — the insult page UI
- `block.js` — insult rotation, configured limit message, and counter logic
- `timer-debug.js` — prints shared timer status in Facebook and Messenger page consoles
- `settings.js` — default allowance and settings validation
- `options.html` / `options.js` — daily allowance preferences
- `setup-amo-credentials.py` — local Mozilla credential setup
- `scripts/build.mjs` — builds `dist/<browser>/` and a ZIP
- `tests/` — simulated timer checks and the live Firefox test

## License

MIT
