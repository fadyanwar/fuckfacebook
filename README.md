# Fuck Facebook

A Firefox extension that conditions you not to open Facebook by insulting you instead.

By default, you get one hour per day across Facebook and Messenger (facebook.com, fb.com, messenger.com). The timer counts time while one of these sites is the active tab in the focused browser window, including time left idle in that tab. Background tabs and time with the browser unfocused do not count. After the configured limit, all open matching tabs redirect to the shame page, and further visits are blocked until the next local calendar day. Usage is saved across browser restarts; time while the browser is closed does not count.

## Installation

### Signed extension (permanent installation)

This extension is distributed as an **unlisted** Mozilla-signed `.xpi`, rather than a public Firefox Add-ons listing. Download the signed file from your Mozilla developer account after signing completes. In Firefox, open `about:addons`, click the gear menu, choose **Install Add-on From File…**, select the `.xpi`, and approve installation. It remains installed across browser restarts. The unsigned ZIP in this repository is a submission package, not a permanently installable extension.

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
3. Build a clean source folder containing only `manifest.json`, `background.js`, `settings.js`, `block.html`, `block.js`, `options.html`, and `options.js`. Do not include credentials, credential scripts, browser policies, or older archives in the upload.
4. Supply the saved `apiKey` and `apiSecret` to `web-ext` as `WEB_EXT_API_KEY` and `WEB_EXT_API_SECRET` environment variables, then run `web-ext sign --channel unlisted --source-dir <clean-source-folder> --artifacts-dir web-ext-artifacts`. This signs the extension for self-distribution without creating a public listing. The local JSON file is not automatically loaded by `web-ext`.
5. Wait for Mozilla to finish signing. If the command times out while signing is pending, check your email and https://addons.mozilla.org/developers/ for the signed download. Install or share the resulting `.xpi`.

The internal extension ID is `fuckfacebook@fadyanwar.local`. Keep this ID unchanged when publishing updates and increase the manifest version for each new submission. A build previously signed as `fuckfacebook-fady-2026@fadyanwar.local` is a separate extension in Firefox; a build with the restored original ID requires signing again. Self-distributed updates must be installed manually unless you configure update hosting.

## Validation

Run the simulated timer checks with `node tests/timer.cjs`. These cover the default limit, invalid settings, changing limits during a session, preserving recorded usage, pausing while unfocused, redirecting at the threshold, and daily/startup resets. They do not replace live Firefox testing.

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
- `settings.js` — default allowance and settings validation
- `options.html` / `options.js` — daily allowance preferences
- `setup-amo-credentials.py` — local Mozilla credential setup
- `tests/timer.cjs` — simulated timer checks

## License

MIT
