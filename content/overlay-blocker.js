// content/overlay-blocker.js

const OVERLAY_SELECTORS = [
  '[class*="modal"]:not([class*="nav"])',
  '[class*="overlay"]:not([class*="nav"])',
  '[class*="popup"]:not([class*="nav"])',
  '[class*="banner"]:not([class*="hero"]):not([class*="nav"])',
  '[id*="modal"]',
  '[id*="overlay"]',
  '[id*="popup"]',
  '[id*="cookie"]',
  '[class*="cookie"]',
  '[class*="consent"]',
  '[id*="consent"]',
  '[class*="gdpr"]',
  '[id*="gdpr"]',
  '[class*="newsletter"]',
  '[class*="subscribe"]',
  '[class*="paywall"]',
  '[id*="paywall"]',
  '#onetrust-banner-sdk',
  '#onetrust-consent-sdk',
  '.cc-window',
  '#cookie-notice',
  '.cookie-notice',
  '#gdpr-cookie-notice',
  '.gdpr-cookie-notice',
  '#didomi-host',
  '.didomi-popup',
  '#sp-cc',
  '.qc-cmp2-container',
];

function looksLikeOverlay(el) {
  const style = window.getComputedStyle(el);
  const position = style.position;
  const zIndex = parseInt(style.zIndex, 10);
  const rect = el.getBoundingClientRect();
  const isFixed = position === "fixed" || position === "absolute";
  const isHighZ = !isNaN(zIndex) && zIndex > 100;
  const isLarge = rect.width > window.innerWidth * 0.4 && rect.height > window.innerHeight * 0.2;
  return isFixed && isHighZ && isLarge;
}

// Catch-all: scan every fixed/absolute element on the page regardless of class/id.
// Targets ad popups (like fedoq-style modals) that use generic or obfuscated class names
// that don't match OVERLAY_SELECTORS. Uses stricter thresholds to avoid false positives.
function looksLikeAdModal(el) {
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return false;

  const position = style.position;
  if (position !== "fixed") return false; // ad modals are almost always fixed

  const zIndex = parseInt(style.zIndex, 10);
  if (isNaN(zIndex) || zIndex < 1000) return false; // ads use very high z-indices

  const rect = el.getBoundingClientRect();
  // Must be a visible, reasonably sized box on screen
  if (rect.width < 100 || rect.height < 80) return false;
  if (rect.bottom < 0 || rect.top > window.innerHeight) return false;

  // Must contain interactive elements (buttons/links) — real UI elements do too,
  // but combined with fixed+highZ this strongly indicates an ad modal
  const hasAction = el.querySelector("button, a[href], input[type='button'], input[type='submit']");
  if (!hasAction) return false;

  // Skip elements that are clearly part of the page's own nav/header/footer
  const tag = el.tagName.toLowerCase();
  if (tag === "header" || tag === "footer" || tag === "nav") return false;
  const role = el.getAttribute("role");
  if (role === "navigation" || role === "banner" || role === "contentinfo") return false;

  return true;
}

function scanCatchAll() {
  if (!window.__popshield?.enabled) return;
  // Limit to fixed-positioned elements only for performance
  const candidates = document.querySelectorAll(
    'div[style*="position: fixed"], div[style*="position:fixed"]'
  );
  let removed = 0;
  for (const el of candidates) {
    if (looksLikeAdModal(el)) {
      removeOverlay(el);
      removed++;
    }
  }
  return removed;
}

function removeOverlay(el) {
  try {
    el.style.setProperty("display", "none", "important");
    el.remove();
  } catch (_) {}
}

function scanAndRemoveOverlays() {
  if (!window.__popshield?.enabled) return;
  let removed = 0;

  // Pass 1: selector-based scan (fast, targets known overlay patterns)
  for (const selector of OVERLAY_SELECTORS) {
    let elements;
    try { elements = document.querySelectorAll(selector); } catch (_) { continue; }
    for (const el of elements) {
      if (looksLikeOverlay(el)) {
        removeOverlay(el);
        removed++;
      }
    }
  }

  // Pass 2: catch-all scan for ad modals with generic/obfuscated class names
  removed += scanCatchAll() || 0;

  if (removed > 0) {
    chrome.storage.local.get({ blocked_overlays: 0 }, (data) => {
      chrome.storage.local.set({ blocked_overlays: data.blocked_overlays + removed });
    });
  }
}
