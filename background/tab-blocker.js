// background/tab-blocker.js

import { isDomainWhitelisted } from "./whitelist.js";

const GLOBAL_KEY   = "popshield_enabled";
const OVERRIDE_KEY = "popshield_tab_overrides";

async function isBlockingActiveForOpener(openerTabId) {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      { [GLOBAL_KEY]: true, [OVERRIDE_KEY]: {} },
      async (data) => {
        // Per-tab override wins
        if (openerTabId in data[OVERRIDE_KEY]) {
          resolve(data[OVERRIDE_KEY][openerTabId]);
          return;
        }
        // Otherwise use global
        resolve(data[GLOBAL_KEY]);
      }
    );
  });
}

export async function handleTabCreated(tab) {
  const url = tab.pendingUrl || tab.url || "";

  // No opener = real user navigation, never block
  if (!tab.openerTabId) return;

  // Check if the opener tab has blocking turned off
  const shouldBlock = await isBlockingActiveForOpener(tab.openerTabId);
  if (!shouldBlock) return;

  // Check whitelist using opener tab's URL
  chrome.tabs.get(tab.openerTabId, async (openerTab) => {
    if (chrome.runtime.lastError) return;
    if (openerTab?.url) {
      const whitelisted = await isDomainWhitelisted(openerTab.url);
      if (whitelisted) return;
    }

    // Only block blank/empty tabs — these are script-spawned popups
    // Real link clicks always have a URL set immediately
    if (!url || url === "about:blank" || url === "about:newtab") {
      chrome.tabs.remove(tab.id, () => void chrome.runtime.lastError);
      console.info("[PopShield] Blocked popup tab from:", openerTab?.url);
      // Increment blocked tabs counter
      chrome.storage.local.get({ blocked_tabs: 0 }, (data) => {
        chrome.storage.local.set({ blocked_tabs: data.blocked_tabs + 1 });
      });
    }
  });
}

export function handleTabUpdated() {} // reserved for future use
export function handleTabRemoved() {} // reserved for future use
