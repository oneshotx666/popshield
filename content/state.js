// content/state.js
window.__popshield = {
  enabled: true,
  clickedRealElement: false,
};

// Listen for a direct message from the popup telling us our state
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "SET_TAB_ENABLED") {
    window.__popshield.enabled = message.enabled;
  }
});

// Ask the background for the correct initial state for this tab.
// This respects per-tab overrides and the whitelist, not just the global toggle.
chrome.runtime.sendMessage({ type: "GET_INITIAL_STATE" }, (response) => {
  if (chrome.runtime.lastError) return; // service worker not ready yet, keep default
  if (response?.enabled !== undefined) {
    window.__popshield.enabled = response.enabled;
  }
});
