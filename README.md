# Fuck Facebook

A Firefox extension that conditions you not to open Facebook by insulting you instead.

Every time you try to open Facebook (facebook.com, fb.com, messenger.com), the tab is redirected to a page that calls you a loser, stupid, a time wasting monkey, and other charming things. A counter tracks how many times you've tried.

## Installation

1. Clone or download this repository.
2. Open Firefox and go to `about:debugging`.
3. Click **This Firefox** in the left sidebar.
4. Click **Load Temporary Add-on…**
5. Select the `manifest.json` file from this folder.

The extension is now active. Try opening Facebook — you'll be insulted instead.

> Note: Temporary add-ons are removed when Firefox restarts. Reload the add-on in `about:debugging` after each restart.

## How it works

- `background.js` listens for tab navigations and updates.
- When the target URL matches Facebook or Messenger, the tab is redirected to `block.html`.
- `block.html` shows a randomly chosen insult, cycles through new insults every 1.5 seconds, and persists an open-count in `localStorage`.
- Clicking **Close this tab** closes the shame window.

## Psychological rationale

This is **aversive conditioning** (positive punishment): pairing an unwanted behavior (opening Facebook) with an immediate unpleasant stimulus (being called a loser/stupid/time wasting monkey). Over time, the brain begins to associate Facebook with shame rather than reward, reducing the urge to open it.

It also leverages:

- **Immediate feedback**: the insult appears the instant you navigate, creating a tight behavior–consequence loop.
- **Self-monitoring**: the persistent counter makes the frequency of the habit visible, increasing awareness.
- **Pattern interruption**: instead of the expected dopamine hit from the Facebook feed, you get a jarring negative stimulus that breaks the compulsive loop.

This is a joke/self-help tool, not therapy. If social media use is causing real distress, consider speaking with a mental health professional.

## Files

- `manifest.json` — Firefox extension manifest (MV2)
- `background.js` — intercepts Facebook/Messenger navigations
- `block.html` — the insult page UI
- `block.js` — insult rotation and counter logic

## License

MIT
