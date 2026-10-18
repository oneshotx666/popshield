// popup/global-state.js

export async function loadGlobalState({ toggle, statusLabel, tabCount, overlayCount, onStateChange }) {
  chrome.storage.local.get(
    { scwebguard_enabled: false, blocked_tabs: 0, blocked_overlays: 0 },
    (data) => {
      applyState(data.scwebguard_enabled, { toggle, statusLabel });
      tabCount.textContent = data.blocked_tabs;
      overlayCount.textContent = data.blocked_overlays;
      onStateChange(data.scwebguard_enabled);
    }
  );
}

export function bindGlobalToggle({ toggle, statusLabel, onStateChange }) {
  toggle.addEventListener("change", () => {
    const enabled = toggle.checked;
    chrome.storage.local.set({ scwebguard_enabled: enabled });
    applyState(enabled, { toggle, statusLabel });
    onStateChange(enabled);

    // Broadcast to all tabs — ignore tabs with no content script
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        chrome.tabs.sendMessage(
          tab.id,
          { type: "SET_TAB_ENABLED", enabled },
          () => void chrome.runtime.lastError // suppress "no receiver" errors
        );
      }
    });
  });
}

export function applyState(enabled, { toggle, statusLabel }) {
  toggle.checked = enabled;
  statusLabel.textContent = enabled ? "Enabled" : "Disabled";
  statusLabel.classList.toggle("off", !enabled);
  document.body.classList.toggle("disabled", !enabled);
}
