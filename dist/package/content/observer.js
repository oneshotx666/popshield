// content/observer.js

const DEBOUNCE_MS = 300;
const ATTRIBUTE_FILTER = ["class", "style", "hidden", "open", "aria-hidden", "aria-modal"];
const SCAN_BURST_DELAYS_MS = [0, 200, 800, 2000, 5000];
let debounceTimer = null;
let contentGuardsBootstrapped = false;
let interactionScanInstalled = false;
let scanBurstToken = 0;

function debouncedScan() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    scanAndRemoveOverlays();
    removeClickjackLayers();
    restoreScroll();
  }, DEBOUNCE_MS);
}

function startObserver() {
  const observer = new MutationObserver((mutations) => {
    if (!window.__scwebguard?.enabled) return;
    const shouldScan = mutations.some((mutation) =>
      mutation.type === "attributes" || mutation.addedNodes.length > 0
    );
    if (shouldScan) debouncedScan();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ATTRIBUTE_FILTER,
  });
}

function scheduleScanBurst() {
  const burstToken = ++scanBurstToken;
  for (const delay of SCAN_BURST_DELAYS_MS) {
    window.setTimeout(() => {
      if (burstToken !== scanBurstToken) return;
      if (!window.__scwebguard?.enabled) return;
      debouncedScan();
    }, delay);
  }
}

function installInteractionScan() {
  if (interactionScanInstalled) return;
  interactionScanInstalled = true;

  document.addEventListener(
    "click",
    () => {
      if (!window.__scwebguard?.enabled) return;
      window.setTimeout(scheduleScanBurst, 120);
    },
    true
  );
}

function bootContentGuards() {
  if (contentGuardsBootstrapped) return;
  contentGuardsBootstrapped = true;

  debouncedScan();
  scheduleScanBurst();
  startObserver();
  installInteractionScan();
  watchScrollLock();
  installClickInterceptor();
}

debouncedScan();
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootContentGuards, { once: true });
} else {
  bootContentGuards();
}
window.addEventListener("load", scheduleScanBurst);
window.addEventListener("scwebguard:statechange", (event) => {
  if (event.detail?.enabled) scheduleScanBurst();
});
