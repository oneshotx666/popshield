// popup/popup.js

import { loadGlobalState, bindGlobalToggle } from "./global-state.js";
import { renderTabsList } from "./tabs-panel.js";

// ── Element refs ─────────────────────────────────────────────────────────────

const toggle       = document.getElementById("toggle");
const statusLabel  = document.getElementById("status-label");
const tabCount     = document.getElementById("tab-count");
const overlayCount = document.getElementById("overlay-count");
const tabsListEl   = document.getElementById("tabs-list");
const navBtns      = document.querySelectorAll(".nav-btn");
const panels       = document.querySelectorAll(".panel");
const footerLabel  = document.getElementById("footer-label");

// ── Navigation ───────────────────────────────────────────────────────────────

navBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    navBtns.forEach((b) => b.classList.remove("nav-btn--active"));
    panels.forEach((p) => p.classList.remove("panel--active"));
    btn.classList.add("nav-btn--active");
    const panel = document.getElementById(btn.dataset.panel);
    panel.classList.add("panel--active");

    if (btn.dataset.panel === "panel-tabs") {
      renderTabsList(tabsListEl, toggle.checked);
    }
  });
});

// ── Boot ─────────────────────────────────────────────────────────────────────

loadGlobalState({
  toggle, statusLabel, tabCount, overlayCount,
  onStateChange: (enabled) => {
    renderTabsList(tabsListEl, enabled);
    footerLabel.textContent = enabled
      ? "Blocking active on this tab"
      : "Inactive — enable to start blocking";
  },
});

bindGlobalToggle({
  toggle, statusLabel,
  onStateChange: (enabled) => {
    renderTabsList(tabsListEl, enabled);
    footerLabel.textContent = enabled
      ? "Blocking active on this tab"
      : "Inactive — enable to start blocking";
  },
});
