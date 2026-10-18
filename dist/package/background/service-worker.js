import {
  handleTabCreated,
  handleTabUpdated,
  handleTabRemoved,
  handleCreatedNavigationTarget,
  handleMainFrameBeforeNavigate,
  handleMainFrameCommitted,
  recordBlockedPopupAttempt,
  rememberTabUrl,
} from "./tab-blocker.js";

// ── Open welcome page on first install ───────────────────────────────────────

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("welcome/welcome.html") });
  }
});

chrome.tabs.onCreated.addListener((tab) => {
  handleTabCreated(tab).catch((error) => {
    console.error("[SC WebGuard] Popup tab handling failed.", error);
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  handleTabUpdated(tabId, changeInfo, tab).catch((error) => {
    console.error("[SC WebGuard] Tab redirect handling failed.", error);
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  handleTabRemoved(tabId);
});

chrome.webNavigation.onCreatedNavigationTarget.addListener((details) => {
  handleCreatedNavigationTarget(details).catch((error) => {
    console.error("[SC WebGuard] Navigation target handling failed.", error);
  });
});

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  handleMainFrameBeforeNavigate(details).catch((error) => {
    console.error("[SC WebGuard] Pre-navigation handling failed.", error);
  });
});

chrome.webNavigation.onCommitted.addListener((details) => {
  handleMainFrameCommitted(details).catch((error) => {
    console.error("[SC WebGuard] Committed navigation handling failed.", error);
  });
});

// Respond to content scripts asking for their initial enabled state.
// Respects per-tab overrides on top of the global setting.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message.type === "GET_INITIAL_STATE") {
      const tabId  = sender.tab?.id;
      const tabUrl = sender.tab?.url;

      const data = await chrome.storage.local.get({
        scwebguard_enabled: false,
        scwebguard_tab_overrides: {},
      });

      let enabled = data.scwebguard_enabled;

      if (tabId !== undefined && tabId in data.scwebguard_tab_overrides) {
        enabled = data.scwebguard_tab_overrides[tabId];
      }

      let hostname = null;
      try {
        const parsed = new URL(tabUrl || "");
        if (/^https?:$/.test(parsed.protocol)) hostname = parsed.hostname.toLowerCase();
      } catch (_) { /* non-http tab */ }

      rememberTabUrl(tabId, tabUrl);
      sendResponse({ enabled, hostname });
      return;
    }

    if (message.type === "REPORT_BLOCKED_POPUP") {
      await recordBlockedPopupAttempt(sender.tab?.id, sender.tab?.url, message.url);
      sendResponse({ ok: true });
      return;
    }
  })().catch((error) => {
    console.error("[SC WebGuard] Message handling failed.", error);
    sendResponse({ ok: false, error: error?.message || "unknown_error" });
  });

  return true;
});
