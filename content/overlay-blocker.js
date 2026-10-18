// content/overlay-blocker.js

const OVERLAY_SELECTORS = [
  // ── Cookie / consent ──────────────────────────────────────────────────────
  '[id*="cookie"]',
  '[class*="cookie"]',
  '[class*="consent"]',
  '[id*="consent"]',
  '[class*="gdpr"]',
  '[id*="gdpr"]',
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
  '[id*="CybotCookiebotDialog"]',
  '.cookielaw-alert',
  '#cookie-law-info-bar',

  // ── Newsletter / promo ────────────────────────────────────────────────────
  '[class*="newsletter"]',
  '[class*="subscribe"]:not(button)',
  '[id*="newsletter"]',
  '[id*="subscribe"]',
  '[class*="promo-modal"]',
  '[id*="promo-modal"]',
  '[class*="adblock"]',
  '[id*="adblock"]',
];

const NUISANCE_HINT_RE = /(cookie|consent|gdpr|newsletter|subscribe|promo|adblock|advertis|sponsor)/i;
const NUISANCE_COPY_RE = /(accept all|reject all|manage preferences|cookie|privacy choices|newsletter|subscribe|turn off ad blocker|disable ad blocker|sponsored|advertisement|skip ad|close ad)/i;
const DIALOG_HINT_RE = /(modal|overlay|popup|banner|dialog|lightbox|interstitial)/i;
const AD_HINT_RE = /(^|\W)(ad|ads|advertisement|advertiser|sponsored|promoted)($|\W)/i;
const PLAYER_HINT_RE = /(player|video|stream|episode|embed|jw|plyr|vjs|vast|ima)/i;
const CONTROL_HINT_RE = /(control|timeline|progress|scrubber|volume|subtitle|caption|settings|quality)/i;
const DISMISS_ACTION_RE = /\b(close|dismiss|skip|cancel|not now|no thanks)\b/i;
const PRIMARY_ACTION_RE = /\b(continue|open|install|allow|watch|play|resume|download|next)\b/i;
const CATCH_ALL_PROBE_POINTS = [
  [0.5, 0.5],
  [0.2, 0.75],
  [0.25, 0.75],
  [0.5, 0.75],
  [0.75, 0.75],
  [0.8, 0.75],
];

function getParentElement(node) {
  if (!node) return null;
  if (node.parentElement) return node.parentElement;

  const root = typeof node.getRootNode === "function" ? node.getRootNode() : null;
  return root instanceof ShadowRoot ? root.host : null;
}

function getOverlayDescriptor(el) {
  return [
    el.id,
    typeof el.className === "string" ? el.className : "",
    el.getAttribute("role"),
    el.getAttribute("aria-label"),
    el.getAttribute("title"),
    el.getAttribute("name"),
    el.getAttribute("data-testid"),
    el.getAttribute("data-module"),
  ]
    .filter(Boolean)
    .join(" ");
}

function getElementText(el, limit = 800) {
  return (el.innerText || el.textContent || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function getActionLabels(el) {
  return Array.from(
    el.querySelectorAll(
      "button, a[href], [role='button'], input[type='button'], input[type='submit'], [onclick], [tabindex]"
    )
  )
    .slice(0, 8)
    .map((action) => {
      if (action instanceof HTMLInputElement) {
        return (action.value || action.getAttribute("aria-label") || "").trim();
      }
      return (action.innerText || action.textContent || action.getAttribute("aria-label") || "").trim();
    })
    .filter(Boolean);
}

function isVisibleInViewport(rect) {
  return rect.width > 0 &&
    rect.height > 0 &&
    rect.bottom > 0 &&
    rect.top < window.innerHeight &&
    rect.right > 0 &&
    rect.left < window.innerWidth;
}

function overlapsCenterStage(rect) {
  return (
    rect.left <= window.innerWidth * 0.7 &&
    rect.right >= window.innerWidth * 0.3 &&
    rect.top <= window.innerHeight * 0.9 &&
    rect.bottom >= window.innerHeight * 0.2
  );
}

function coversMostOfViewport(rect) {
  return (
    rect.width >= window.innerWidth * 0.6 &&
    rect.height >= window.innerHeight * 0.6 &&
    rect.left <= window.innerWidth * 0.1 &&
    rect.top <= window.innerHeight * 0.1
  );
}

function hasMatchingText(values, regex) {
  return values.some((value) => regex.test(value));
}

function isLikelyPlayerContext(el) {
  if (window.top !== window.self) return true;

  let node = el;
  let depth = 0;

  while (node && depth < 8) {
    const descriptor = getOverlayDescriptor(node);
    if (PLAYER_HINT_RE.test(descriptor)) return true;

    if (
      typeof node.querySelector === "function" &&
      node.querySelector("video, iframe, .jwplayer, .video-js, .plyr, [class*='player'], [id*='player']")
    ) {
      return true;
    }

    node = getParentElement(node);
    depth++;
  }

  return false;
}

function isLikelyPlayerIframe(el) {
  if (el.tagName.toLowerCase() !== "iframe") return false;

  const descriptor = `${getOverlayDescriptor(el)} ${el.getAttribute("src") || ""}`;
  const allow = el.getAttribute("allow") || "";
  if (
    PLAYER_HINT_RE.test(descriptor) ||
    el.hasAttribute("allowfullscreen") ||
    /\bfullscreen\b/i.test(allow)
  ) {
    return true;
  }

  let node = getParentElement(el);
  let depth = 0;

  while (node && depth < 4) {
    if (PLAYER_HINT_RE.test(getOverlayDescriptor(node))) return true;
    node = getParentElement(node);
    depth++;
  }

  return false;
}

function looksLikeExplicitNuisance(el, rect, style) {
  const descriptor = getOverlayDescriptor(el);
  const text = getElementText(el);
  const hasNuisanceSignal =
    NUISANCE_HINT_RE.test(descriptor) ||
    NUISANCE_HINT_RE.test(text);
  const hasNuisanceCopy = NUISANCE_COPY_RE.test(text);
  const hasAction = Boolean(el.querySelector("button, a[href], input[type='button'], input[type='submit']"));
  const fillsViewport = rect.width > window.innerWidth * 0.4 && rect.height > window.innerHeight * 0.2;
  const isModalLayer = style.position === "fixed" || style.position === "absolute";

  return hasNuisanceSignal && fillsViewport && isModalLayer && (hasNuisanceCopy || hasAction);
}

function looksLikeOverlay(el) {
  const style = window.getComputedStyle(el);
  const position = style.position;
  const zIndex = parseInt(style.zIndex, 10);
  const rect = el.getBoundingClientRect();
  const isFixed = position === "fixed" || position === "absolute";
  const isHighZ = !isNaN(zIndex) && zIndex > 100;
  const isLarge = rect.width > window.innerWidth * 0.4 && rect.height > window.innerHeight * 0.2;
  const isExplicitNuisance = looksLikeExplicitNuisance(el, rect, style);
  const descriptor = getOverlayDescriptor(el);
  const text = getElementText(el, 500);
  const hasNuisanceSignal =
    NUISANCE_HINT_RE.test(`${descriptor} ${text}`) ||
    AD_HINT_RE.test(`${descriptor} ${text}`);
  return isFixed && isLarge && (isExplicitNuisance || (isHighZ && hasNuisanceSignal && overlapsCenterStage(rect)));
}

// Catch-all: fixed+high-z elements with obfuscated/generic class names.
function looksLikeAdModal(el) {
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return false;
  if (style.position !== "fixed" && style.position !== "absolute") return false;

  const zIndex = parseInt(style.zIndex, 10);
  const rect = el.getBoundingClientRect();
  if (rect.width < 180 || rect.height < 90) return false;
  if (!isVisibleInViewport(rect)) return false;

  const tag = el.tagName.toLowerCase();
  const hasHighZ = !isNaN(zIndex) && zIndex >= 250;
  const inlineStyle = el.getAttribute("style") || "";

  // Cross-origin ad overlays often arrive as a raw full-screen iframe, which
  // means we cannot inspect its internal buttons or text from the host page.
  if (
    tag === "iframe" &&
    !isLikelyPlayerIframe(el) &&
    style.pointerEvents !== "none" &&
    coversMostOfViewport(rect) &&
    (hasHighZ || inlineStyle.includes("2147483647") || inlineStyle.includes("inset: 0px"))
  ) {
    return true;
  }

  const descriptor = getOverlayDescriptor(el);
  if (CONTROL_HINT_RE.test(descriptor)) return false;

  if (tag === "header" || tag === "footer" || tag === "nav") return false;
  const role = el.getAttribute("role");
  if (role === "navigation" || role === "banner" || role === "contentinfo") return false;

  const actionLabels = getActionLabels(el);
  if (actionLabels.length === 0) return false;

  const text = getElementText(el, 600);
  const hasNuisanceSignal = NUISANCE_HINT_RE.test(`${descriptor} ${text}`) || NUISANCE_COPY_RE.test(text);
  const hasModalSignal =
    DIALOG_HINT_RE.test(descriptor) ||
    ((el.tagName === "DIALOG" || role === "dialog" || el.getAttribute("aria-modal") === "true") && hasNuisanceSignal);
  const hasAdSignal = AD_HINT_RE.test(`${descriptor} ${text}`);
  const hasDismissAndContinue =
    hasMatchingText(actionLabels, DISMISS_ACTION_RE) &&
    hasMatchingText(actionLabels, PRIMARY_ACTION_RE);
  const playerContext = isLikelyPlayerContext(el);

  if (playerContext) return false;
  if (!hasHighZ && !hasModalSignal && !playerContext && !hasDismissAndContinue) return false;
  if (!overlapsCenterStage(rect) && !playerContext && !hasDismissAndContinue) return false;

  return hasModalSignal || hasAdSignal || (hasDismissAndContinue && hasNuisanceSignal);
}

function findBlockingContainer(startEl) {
  let node = startEl instanceof Element ? startEl : null;
  let match = null;
  let depth = 0;

  while (node && depth < 12) {
    if (looksLikeAdModal(node)) match = node;
    node = getParentElement(node);
    depth++;
  }

  return match;
}

function addCandidateBranch(targets, el) {
  let node = el;
  let depth = 0;

  while (node && depth < 12) {
    if (node instanceof Element) targets.add(node);
    node = getParentElement(node);
    depth++;
  }
}

function scanCatchAll() {
  if (!window.__scwebguard?.enabled) return 0;
  const candidates = new Set(
    document.querySelectorAll(
      [
        "dialog",
        "[role='dialog']",
        "[aria-modal='true']",
        "[style*='position: fixed']",
        "[style*='position:fixed']",
        "[style*='position: absolute']",
        "[style*='position:absolute']",
      ].join(", ")
    )
  );

  for (const [xRatio, yRatio] of CATCH_ALL_PROBE_POINTS) {
    const x = Math.max(0, Math.min(window.innerWidth - 1, Math.round(window.innerWidth * xRatio)));
    const y = Math.max(0, Math.min(window.innerHeight - 1, Math.round(window.innerHeight * yRatio)));
    for (const el of document.elementsFromPoint(x, y)) {
      addCandidateBranch(candidates, el);
    }
  }

  const actionCandidates = document.querySelectorAll(
    "button, a[href], [role='button'], [onclick], [tabindex], input[type='button'], input[type='submit']"
  );
  for (const el of actionCandidates) {
    const label = getElementText(el, 120);
    if (!label) continue;
    if (DISMISS_ACTION_RE.test(label) || PRIMARY_ACTION_RE.test(label) || AD_HINT_RE.test(label)) {
      addCandidateBranch(candidates, el);
    }
  }

  let removed = 0;
  const removedElements = new Set();

  for (const el of candidates) {
    const blockingContainer = findBlockingContainer(el);
    if (blockingContainer && blockingContainer.isConnected && !removedElements.has(blockingContainer)) {
      removeOverlay(blockingContainer);
      removedElements.add(blockingContainer);
      removed++;
    }
  }
  return removed;
}

function removeOverlay(el) {
  try {
    if (window.__scwebguard) window.__scwebguard.lastOverlayRemovedAt = Date.now();
    window.dispatchEvent(new CustomEvent("scwebguard:overlayremoved"));
    el.style.setProperty("display", "none", "important");
    el.remove();
  } catch (_) {}
}

function scanAndRemoveOverlays() {
  if (!window.__scwebguard?.enabled) return;
  let removed = 0;

  // Pass 1: selector-based scan
  for (const selector of OVERLAY_SELECTORS) {
    let elements;
    try { elements = document.querySelectorAll(selector); } catch (_) { continue; }
    for (const el of elements) {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (looksLikeOverlay(el)) {
        removeOverlay(el);
        removed++;
      }
    }
  }

  // Pass 2: catch-all for obfuscated ad modals
  const catchAllRemoved = scanCatchAll();
  removed += catchAllRemoved;

  if (removed > 0) {
    chrome.storage.local.get({ blocked_overlays: 0 }, (data) => {
      chrome.storage.local.set({ blocked_overlays: data.blocked_overlays + removed });
    });
  }
}
