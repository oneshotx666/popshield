// content/navigation-guard.js

window.addEventListener(
  "scwebguard:popupblocked",
  (event) => {
    if (!window.__scwebguard?.enabled) return;
    chrome.runtime.sendMessage(
      { type: "REPORT_BLOCKED_POPUP", url: event.detail?.url || "" },
      () => void chrome.runtime.lastError
    );
  },
  true
);
