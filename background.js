const BLOCK_URL = chrome.runtime.getURL("block.html");
importScripts("settings.js");
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

async function updateUsage(resetSession = false) {
  const now = Date.now();
  const { usage: saved, dailyLimitMinutes } = await chrome.storage.local.get(["usage", "dailyLimitMinutes"]);
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
    usage.elapsed += Math.max(0, now - Math.max(usage.since, midnight.getTime()));
  }
  usage.since = null;

  const tabs = await chrome.tabs.query({});
  const window = await chrome.windows.getLastFocused().catch(() => null);
  const active = tabs.find(tab => tab.active && tab.windowId === window?.id);
  if (usage.elapsed >= limitMs) {
    await Promise.all(tabs.filter(tab => isFacebook(tab.url)).map(tab =>
      chrome.tabs.update(tab.id, { url: BLOCK_URL }).catch(() => {})
    ));
    await chrome.alarms.clear("usage-limit");
  } else if (window?.focused && active && isFacebook(active.url)) {
    usage.since = now;
    await chrome.alarms.create("usage-limit", { when: now + limitMs - usage.elapsed });
  } else {
    await chrome.alarms.clear("usage-limit");
  }
  await chrome.storage.local.set({ usage });
}

function scheduleUpdate(resetSession = false) {
  pending = pending.catch(console.error).then(() => updateUsage(resetSession));
  return pending;
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.dailyLimitMinutes) scheduleUpdate();
});
chrome.tabs.onActivated.addListener(() => scheduleUpdate());
chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
  if (changeInfo.url || changeInfo.status === "loading") scheduleUpdate();
});
chrome.tabs.onRemoved.addListener(() => scheduleUpdate());
chrome.windows.onFocusChanged.addListener(() => scheduleUpdate());
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === TIMER || alarm.name === "usage-limit") scheduleUpdate();
});
chrome.runtime.onStartup.addListener(() => scheduleUpdate(true));
chrome.runtime.onInstalled.addListener(() => scheduleUpdate(true));
// The recurring alarm also handles midnight and restores a missed deadline.
chrome.alarms.create(TIMER, { periodInMinutes: 0.5 });
scheduleUpdate();
