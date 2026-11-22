// Firefox loads ext.js and settings.js through background.scripts; the Chrome
// service worker imports them.
if (typeof importScripts === "function") importScripts("ext.js", "settings.js");
const BLOCK_URL = ext.runtime.getURL("block.html");
const TIMER = "usage-timer";
let pending = Promise.resolve();

function isFacebook(url) {
  try {
    const host = new URL(url).hostname;
    return ["facebook.com", "fb.com", "messenger.com"].some(
      domain => host === domain || host.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

function dayKey(time) {
  return new Date(time).toLocaleDateString("en-CA");
}

// storage.session is cleared when the browser restarts or the extension is
// reloaded or updated, but survives the background script being suspended.
// The first update of a new browser session must not count the time since the
// saved session start: the browser was closed for that period.
async function startsNewBrowserSession() {
  if (!ext.storage.session) return false;
  try {
    const { sessionStarted } = await ext.storage.session.get("sessionStarted");
    if (sessionStarted) return false;
    await ext.storage.session.set({ sessionStarted: true });
    return true;
  } catch {
    return false;
  }
}

const MAX_STEP_MS = 90 * 1000; // a little more than the 30-second alarm period

async function updateUsage(resetSession = false) {
  if (await startsNewBrowserSession()) resetSession = true;
  const now = Date.now();
  const { usage: saved, dailyLimitMinutes } = await ext.storage.local.get(["usage", "dailyLimitMinutes"]);
  const limitMs = getLimitMinutes(dailyLimitMinutes) * 60 * 1000;
  const usage = saved || { day: dayKey(now), elapsed: 0, since: null };
  // Only count the portion of an active session belonging to today.
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  if (usage.day !== dayKey(now)) {
    usage.day = dayKey(now);
    usage.elapsed = 0;
  }
  if (usage.since !== null && !resetSession) {
    // While the browser runs, the 30-second alarm updates at least every 30 s. A longer gap means the computer was
    // asleep (no alarms fire during suspend), so one update adds at most MAX_STEP_MS: sleep does not use up the limit.
    usage.elapsed += Math.min(MAX_STEP_MS, Math.max(0, now - Math.max(usage.since, midnight.getTime())));
  }
  usage.since = null;

  const tabs = await ext.tabs.query({});
  // Firefox for Android has no windows API: its active tab is the one shown.
  const focusedWindow = ext.windows
    ? await ext.windows.getLastFocused().catch(() => null)
    : { id: tabs.find(tab => tab.active)?.windowId, focused: true };
  const active = tabs.find(tab => tab.active && tab.windowId === focusedWindow?.id);
  const counting = usage.elapsed < limitMs && focusedWindow?.focused && active && isFacebook(active.url);
  if (usage.elapsed >= limitMs) {
    await Promise.all(tabs.filter(tab => isFacebook(tab.url)).map(tab =>
      ext.tabs.update(tab.id, { url: BLOCK_URL }).catch(() => {})
    ));
    await ext.alarms.clear("usage-limit");
  } else if (counting) {
    usage.since = now;
    await ext.alarms.create("usage-limit", { when: now + limitMs - usage.elapsed });
  } else {
    await ext.alarms.clear("usage-limit");
  }
  await ext.storage.local.set({ usage });
  const state = usage.elapsed >= limitMs ? "limit reached" : counting ? "counting" : "paused";
  const remainingSeconds = Math.max(0, Math.ceil((limitMs - usage.elapsed) / 1000));
  console.log(`[Fuck Facebook timer] ${state} | ${remainingSeconds}s remaining | ${Math.floor(usage.elapsed / 1000)}s used`, {
    state,
    usedSeconds: Math.floor(usage.elapsed / 1000),
    remainingSeconds,
    limitMinutes: limitMs / 60000,
    browserFocused: Boolean(focusedWindow?.focused),
    activeTabMatches: Boolean(active && isFacebook(active.url)),
    sessionReset: resetSession,
    checkedAt: new Date(now).toISOString()
  });
}

// Updates run one at a time. A failed update is logged once and does not
// block later ones; callers that await the result still see the error.
function scheduleUpdate(resetSession = false) {
  const run = pending.then(() => updateUsage(resetSession));
  pending = run.catch(error => console.error("[Fuck Facebook timer] Update failed:", error));
  return run;
}

ext.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.dailyLimitMinutes) scheduleUpdate();
});
ext.tabs.onActivated.addListener(() => scheduleUpdate());
ext.tabs.onUpdated.addListener((_tabId, changeInfo) => {
  if (changeInfo.url || changeInfo.status === "loading") scheduleUpdate();
});
ext.tabs.onRemoved.addListener(() => scheduleUpdate());
ext.windows?.onFocusChanged.addListener(() => scheduleUpdate());
ext.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === TIMER || alarm.name === "usage-limit") scheduleUpdate();
});
// Fallbacks for browsers without storage.session; harmless otherwise.
ext.runtime.onStartup.addListener(() => scheduleUpdate(true));
ext.runtime.onInstalled.addListener(() => scheduleUpdate(true));
// The recurring alarm also handles midnight and restores a missed deadline.
ext.alarms.create(TIMER, { periodInMinutes: 0.5 });
console.log("[Fuck Facebook timer] Started; usage updates on tab/focus changes and every 30 seconds.");
scheduleUpdate();
