// popup/popup.js

import { loadGlobalState, bindGlobalToggle } from "./global-state.js";
import { renderTabsList } from "./tabs-panel.js";
import { renderWhitelistPanel } from "./whitelist-panel.js";

// ── Element refs ─────────────────────────────────────────────────────────────

const toggle             = document.getElementById("toggle");
const statusLabel        = document.getElementById("status-label");
const tabCount           = document.getElementById("tab-count");
const overlayCount       = document.getElementById("overlay-count");
const tabsListEl         = document.getElementById("tabs-list");
const whitelistContainer = document.getElementById("whitelist-container");
const navBtns            = document.querySelectorAll(".nav-btn");
const panels             = document.querySelectorAll(".panel");

// ── Navigation ───────────────────────────────────────────────────────────────

navBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    navBtns.forEach((b) => b.classList.remove("nav-btn--active"));
    panels.forEach((p) => p.classList.remove("panel--active"));
    btn.classList.add("nav-btn--active");
    const panel = document.getElementById(btn.dataset.panel);
    panel.classList.add("panel--active");

    // Re-render panels when switching to them so they're always fresh
    if (btn.dataset.panel === "panel-tabs") {
      renderTabsList(tabsListEl, toggle.checked);
    }
    if (btn.dataset.panel === "panel-whitelist") {
      renderWhitelistPanel(whitelistContainer);
    }
  });
});

// ── Boot ─────────────────────────────────────────────────────────────────────

loadGlobalState({
  toggle, statusLabel, tabCount, overlayCount,
  onStateChange: (enabled) => {
    renderTabsList(tabsListEl, enabled);
  },
});

bindGlobalToggle({
  toggle, statusLabel,
  onStateChange: (enabled) => {
    renderTabsList(tabsListEl, enabled);
  },
});

// Pre-render whitelist in background so it's ready when user navigates to it
renderWhitelistPanel(whitelistContainer);
