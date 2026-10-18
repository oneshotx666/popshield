// content/scroll-lock-fixer.js

const LOCKED_STYLES = ["overflow", "overflow-y", "overflow-x"];
const ROOT_ATTRIBUTE_FILTER = ["class", "style", "hidden", "inert"];
const RESTORE_DELAYS_MS = [0, 32, 120, 400];
const ROOT_LOCK_HEIGHTS = new Set(["100%", "100vh", "100dvh"]);
const SCROLL_RESTORE_WINDOW_MS = 10000;

const LOCK_CLASSES = [
  "modal-open", "overflow-hidden", "noscroll", "no-scroll",
  "scroll-locked", "body-lock", "is-locked", "lock-scroll",
  "has-overlay", "has-modal", "has-paywall", "paywall-open",
  "gateway-open", "regwall-open", "no-overflow",
];

const SCROLL_KEYS = new Set([
  " ",
  "Space",
  "Spacebar",
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
  "Home",
  "End",
]);

let scrollLockObserver = null;
let scrollInterceptorsInstalled = false;
let restoreBurstToken = 0;
let stateListenerInstalled = false;
let lifecycleListenersInstalled = false;

function getRootElements() {
  return [document.documentElement, document.body].filter(Boolean);
}

function hasLockClass(el) {
  return LOCK_CLASSES.some((cls) => el.classList.contains(cls));
}

function stripLockClasses(el) {
  let removedAny = false;
  for (const cls of LOCK_CLASSES) {
    if (!el.classList.contains(cls)) continue;
    el.classList.remove(cls);
    removedAny = true;
  }
  return removedAny;
}

function styleValueContainsLock(value) {
  return typeof value === "string" && (value.includes("hidden") || value.includes("clip"));
}

function resetRootStyles(el) {
  const style = window.getComputedStyle(el);
  const inlineHeight = el.style.height;
  const inlineMaxHeight = el.style.maxHeight;
  let changed = false;

  for (const prop of LOCKED_STYLES) {
    if (styleValueContainsLock(style[prop])) {
      el.style.setProperty(prop, "auto", "important");
      changed = true;
    }
  }

  if (style.overscrollBehavior === "none" || style.overscrollBehaviorY === "none") {
    el.style.setProperty("overscroll-behavior", "auto", "important");
    el.style.setProperty("overscroll-behavior-y", "auto", "important");
    changed = true;
  }

  if (style.touchAction === "none") {
    el.style.setProperty("touch-action", "auto", "important");
    changed = true;
  }

  // Paywalls commonly pin the page with root-level height locks.
  if (
    ROOT_LOCK_HEIGHTS.has(inlineHeight) ||
    ROOT_LOCK_HEIGHTS.has(inlineMaxHeight)
  ) {
    el.style.setProperty("height", "auto", "important");
    el.style.setProperty("max-height", "none", "important");
    changed = true;
  }

  if (el === document.body && style.position === "fixed") {
    const topValue = parseInt(el.style.top || "0", 10);
    const scrollY = Number.isNaN(topValue) ? window.scrollY : Math.abs(topValue);

    el.style.setProperty("position", "static", "important");
    el.style.setProperty("top", "auto", "important");
    el.style.setProperty("left", "auto", "important");
    el.style.setProperty("right", "auto", "important");
    el.style.setProperty("width", "auto", "important");
    el.style.setProperty("min-width", "auto", "important");
    el.style.setProperty("max-width", "none", "important");
    el.style.setProperty("height", "auto", "important");
    el.style.setProperty("max-height", "none", "important");

    window.scrollTo(0, scrollY);
    changed = true;
  }

  return changed;
}

function restoreScroll() {
  if (!window.__scwebguard?.enabled) return;
  if (!shouldRestoreScroll()) return;

  for (const el of getRootElements()) {
    stripLockClasses(el);
    resetRootStyles(el);
  }
}

function shouldRestoreScroll() {
  const removedAt = window.__scwebguard?.lastOverlayRemovedAt || 0;
  return Date.now() - removedAt <= SCROLL_RESTORE_WINDOW_MS;
}

function isRootLocked(el) {
  if (!el) return false;

  const style = window.getComputedStyle(el);
  const overflowLocked = LOCKED_STYLES.some((prop) => styleValueContainsLock(style[prop]));
  const hasInlineHeightLock =
    ROOT_LOCK_HEIGHTS.has(el.style.height) || ROOT_LOCK_HEIGHTS.has(el.style.maxHeight);

  return (
    overflowLocked ||
    hasInlineHeightLock ||
    hasLockClass(el) ||
    style.overscrollBehavior === "none" ||
    style.overscrollBehaviorY === "none" ||
    style.touchAction === "none" ||
    (el === document.body && style.position === "fixed")
  );
}

function isScrollLockActive() {
  return getRootElements().some(isRootLocked);
}

function looksLikeStubbornSiteLock() {
  return getRootElements().some(
    (el) =>
      hasLockClass(el) ||
      ROOT_LOCK_HEIGHTS.has(el.style.height) ||
      ROOT_LOCK_HEIGHTS.has(el.style.maxHeight) ||
      (el === document.body && window.getComputedStyle(el).position === "fixed")
  );
}

function scheduleRestoreBurst() {
  if (!window.__scwebguard?.enabled) return;

  const burstToken = ++restoreBurstToken;
  for (const delay of RESTORE_DELAYS_MS) {
    window.setTimeout(() => {
      if (burstToken !== restoreBurstToken) return;
      if (!window.__scwebguard?.enabled) return;
      restoreScroll();
    }, delay);
  }
}

function isEditableTarget(target) {
  if (!(target instanceof Element)) return false;

  return Boolean(
    target.closest(
      "input, textarea, select, [contenteditable=''], [contenteditable='true'], [role='textbox']"
    )
  );
}

function interceptScrollLockEvent(event) {
  if (!window.__scwebguard?.enabled) return;
  if (!isScrollLockActive()) return;

  if (event.type === "keydown") {
    if (!SCROLL_KEYS.has(event.key)) return;
    if (event.altKey || event.ctrlKey || event.metaKey || isEditableTarget(event.target)) {
      return;
    }
  }

  restoreScroll();
  event.stopImmediatePropagation();
}

function installScrollInterceptors() {
  if (scrollInterceptorsInstalled) return;
  scrollInterceptorsInstalled = true;

  window.addEventListener("wheel", interceptScrollLockEvent, {
    capture: true,
    passive: false,
  });
  window.addEventListener("touchmove", interceptScrollLockEvent, {
    capture: true,
    passive: false,
  });
  window.addEventListener("keydown", interceptScrollLockEvent, true);
}

function observeRootLockTargets() {
  if (!scrollLockObserver || !document.documentElement) return;

  scrollLockObserver.disconnect();
  scrollLockObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ROOT_ATTRIBUTE_FILTER,
    childList: true,
  });

  if (document.body) {
    scrollLockObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ROOT_ATTRIBUTE_FILTER,
    });
  }
}

function installScrollLockStateListener() {
  if (stateListenerInstalled) return;
  stateListenerInstalled = true;

  window.addEventListener("scwebguard:statechange", (event) => {
    if (!event.detail?.enabled) return;
    observeRootLockTargets();
    scheduleRestoreBurst();
  });
}

function installLifecycleRestoreHooks() {
  if (lifecycleListenersInstalled) return;
  lifecycleListenersInstalled = true;

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        observeRootLockTargets();
        scheduleRestoreBurst();
      },
      { once: true }
    );
  } else {
    observeRootLockTargets();
    scheduleRestoreBurst();
  }

  window.addEventListener("load", scheduleRestoreBurst);
  window.addEventListener("scwebguard:overlayremoved", scheduleRestoreBurst);
}

function watchScrollLock() {
  installScrollInterceptors();
  installScrollLockStateListener();
  installLifecycleRestoreHooks();

  if (scrollLockObserver) return;

  scrollLockObserver = new MutationObserver((mutations) => {
    if (!window.__scwebguard?.enabled) return;

    if (mutations.some((mutation) => mutation.type === "childList")) {
      observeRootLockTargets();
    }

    if (mutations.some((mutation) => isRootLocked(mutation.target))) {
      scheduleRestoreBurst();
    }
  });

  observeRootLockTargets();
}

watchScrollLock();
