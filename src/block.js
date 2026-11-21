(function () {
  const insults = [
    "You're a loser.",
    "Stupid.",
    "Time wasting monkey.",
    "Pathetic.",
    "Get a life.",
    "Embarrassing.",
    "Why are you like this?",
    "Absolute waste of time.",
    "Go outside, you hermits.",
    "Disgusting habit.",
    "You could be doing literally anything else.",
    "Shameful.",
    "Your future self hates you.",
    "Frittering away your life.",
    "Disappointing.",
    "Brain rot loading…",
    "This is your rock bottom.",
    "Close it and do something useful.",
    "You absolute unit of procrastination.",
  ];

  async function showLimit() {
    const { dailyLimitMinutes } = await ext.storage.local.get("dailyLimitMinutes");
    const minutes = getLimitMinutes(dailyLimitMinutes);
    document.getElementById("limit-message").textContent =
      `Your daily limit is ${minutes} ${minutes === 1 ? "minute" : "minutes"} across Facebook and Messenger. That’s enough scrolling. Come back tomorrow.`;
  }
  showLimit().catch(console.error);
  ext.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.dailyLimitMinutes) showLimit().catch(console.error);
  });

  let count = 0;
  try {
    count = parseInt(localStorage.getItem("ff_open_count") || "0", 10) + 1;
    localStorage.setItem("ff_open_count", String(count));
  } catch {}

  const el = document.getElementById("insult");
  const countEl = document.getElementById("count");
  countEl.textContent = count;

  function showInsult() {
    el.textContent = insults[Math.floor(Math.random() * insults.length)];
  }
  showInsult();
  setInterval(showInsult, 1500);

  // window.close() is refused for tabs that have history, which is always the
  // case after a redirect, so close the tab through the tabs API instead.
  async function closeTab() {
    try {
      const tab = await ext.tabs.getCurrent();
      if (tab) {
        await ext.tabs.remove(tab.id);
        return;
      }
    } catch (error) {
      console.error("[Fuck Facebook] Could not close the tab:", error);
    }
    window.close();
  }
  document.getElementById("close").addEventListener("click", () => { closeTab(); });
})();
