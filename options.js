const form = document.getElementById("settings");
const minutes = document.getElementById("minutes");
const status = document.getElementById("status");
const save = document.getElementById("save");
const reset = document.getElementById("reset");

async function load() {
  try {
    const { dailyLimitMinutes } = await chrome.storage.local.get("dailyLimitMinutes");
    minutes.value = getLimitMinutes(dailyLimitMinutes);
    minutes.disabled = save.disabled = reset.disabled = false;
  } catch {
    status.textContent = "Could not load settings. Reload this page to try again.";
  }
}

async function saveLimit(value) {
  save.disabled = reset.disabled = true;
  try {
    await chrome.storage.local.set({ dailyLimitMinutes: value });
    minutes.value = value;
    status.textContent = `Saved: ${value} ${value === 1 ? "minute" : "minutes"} per day.`;
  } catch {
    status.textContent = "Could not save settings. Please try again.";
  } finally {
    save.disabled = reset.disabled = false;
  }
}

form.addEventListener("submit", event => {
  event.preventDefault();
  if (form.reportValidity()) saveLimit(Number(minutes.value));
});
reset.addEventListener("click", () => saveLimit(DEFAULT_LIMIT_MINUTES));
load();
