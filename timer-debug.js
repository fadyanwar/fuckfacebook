// Runs in the site's isolated extension context so F12 shows the shared timer.
(() => {
  let saved = {};
  function printStatus() {
    const now = Date.now();
    const today = new Date(now).toLocaleDateString("en-CA");
    const midnight = new Date(now);
    midnight.setHours(0, 0, 0, 0);
    const usage = saved.usage;
    const limit = getLimitMinutes(saved.dailyLimitMinutes) * 60000;
    const running = usage?.since != null;
    const elapsed = (usage?.day === today ? usage.elapsed : 0) +
      (running ? Math.max(0, now - Math.max(usage.since, midnight.getTime())) : 0);
    const remaining = Math.max(0, Math.ceil((limit - elapsed) / 1000));
    const state = elapsed >= limit ? "limit reached" : running ? "counting" : "paused";
    console.log(`[Fuck Facebook timer] ${state} | ${remaining}s remaining | ${Math.floor(elapsed / 1000)}s used (shared daily timer)`);
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    for (const key of ["usage", "dailyLimitMinutes"]) {
      if (changes[key]) saved[key] = changes[key].newValue;
    }
  });
  chrome.storage.local.get(["usage", "dailyLimitMinutes"]).then(value => {
    // Changes received while loading take precedence over the initial snapshot.
    saved = { ...value, ...saved };
    console.log("[Fuck Facebook timer] Page diagnostics loaded; status prints every 5 seconds.");
    printStatus();
    setInterval(printStatus, 5000);
  }).catch(error => console.error("[Fuck Facebook timer] Could not read usage:", error));
})();
