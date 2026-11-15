const BLOCK_URL = chrome.runtime.getURL("block.html");

function isFacebook(url) {
  try {
    const host = new URL(url).hostname;
    return (
      host === "facebook.com" ||
      host.endsWith(".facebook.com") ||
      host === "fb.com" ||
      host.endsWith(".fb.com") ||
      host === "messenger.com" ||
      host.endsWith(".messenger.com")
    );
  } catch {
    return false;
  }
}

async function block(tabId, url) {
  if (url === BLOCK_URL) return;
  try {
    await chrome.tabs.update(tabId, { url: BLOCK_URL });
  } catch {}
}

chrome.webNavigation.onBeforeNavigate.addListener(
  details => {
    if (details.frameId === 0 && isFacebook(details.url)) {
      block(details.tabId, details.url);
    }
  },
  { url: [{ urlMatches: ".*(facebook|fb\\.com|messenger).*" }] }
);

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "loading" && tab.url && isFacebook(tab.url)) {
    block(tabId, tab.url);
  }
});
