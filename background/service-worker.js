import { isEnabled } from "./storage.js";
import { handleTabCreated, handleTabUpdated, handleTabRemoved } from "./tab-blocker.js";

chrome.tabs.onCreated.addListener(async (tab) => {
  const enabled = await isEnabled();
  if (!enabled) return;
  handleTabCreated(tab);
});

chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, tab) => {
  const enabled = await isEnabled();
  if (!enabled) return;
  handleTabUpdated(tab.id, changeInfo);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  handleTabRemoved(tabId);
});

// Respond to content scripts asking for their initial enabled state.
// This lets state.js respect per-tab overrides and whitelist on page load/refresh.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "GET_INITIAL_STATE") return;

  const tabId = sender.tab?.id;
  const tabUrl = sender.tab?.url;

  chrome.storage.local.get(
    { popshield_enabled: true, popshield_tab_overrides: {}, popshield_whitelist: [] },
    (data) => {
      let enabled = data.popshield_enabled;

      // Per-tab override wins over global
      if (tabId !== undefined && tabId in data.popshield_tab_overrides) {
        enabled = data.popshield_tab_overrides[tabId];
      }

      // Whitelist always forces off
      if (tabUrl) {
        try {
          const hostname = new URL(tabUrl).hostname.replace(/^www\./, "");
          const whitelisted = data.popshield_whitelist.some(
            (d) => hostname === d || hostname.endsWith("." + d)
          );
          if (whitelisted) enabled = false;
        } catch (_) {}
      }

      sendResponse({ enabled });
    }
  );

  return true; // keep message channel open for async response
});
