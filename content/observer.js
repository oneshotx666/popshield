// content/observer.js

const DEBOUNCE_MS = 300;
let debounceTimer = null;

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
    if (!window.__popshield?.enabled) return;
    const hasAddedNodes = mutations.some((m) => m.addedNodes.length > 0);
    if (hasAddedNodes) debouncedScan();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

debouncedScan();
document.addEventListener("DOMContentLoaded", () => {
  debouncedScan();
  startObserver();
  watchScrollLock();
  installClickInterceptor();
});
window.addEventListener("load", debouncedScan);
