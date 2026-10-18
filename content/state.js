// content/state.js
window.__scwebguard = {
  enabled: false,
  clickedRealElement: false,
  hostname: null,
  lastOverlayRemovedAt: 0,
};

function setEnabledState(enabled) {
  const nextEnabled = Boolean(enabled);
  const previousEnabled = window.__scwebguard.enabled;
  if (previousEnabled === nextEnabled) return;

  window.__scwebguard.enabled = nextEnabled;
  window.dispatchEvent(
    new CustomEvent("scwebguard:statechange", {
      detail: { enabled: nextEnabled, previousEnabled },
    })
  );
}

// Listen for a direct message from the popup telling us our state
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "SET_TAB_ENABLED") {
    setEnabledState(message.enabled);
  }
});

// Ask the background for the correct initial state for this tab.
// This respects per-tab overrides, not just the global toggle.
chrome.runtime.sendMessage({ type: "GET_INITIAL_STATE" }, (response) => {
  if (chrome.runtime.lastError) return; // service worker not ready yet, keep default
  if (response?.enabled !== undefined) {
    setEnabledState(response.enabled);
  }
  if (response?.hostname) {
    window.__scwebguard.hostname = response.hostname;
  }
});
