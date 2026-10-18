// Runs in the page's MAIN world so site scripts cannot bypass the blocker by
// calling window.open directly. The isolated content script controls activation
// through DOM events and reports blocked attempts to the service worker.
(() => {
  const STATE_EVENT = "scwebguard:statechange";
  const BLOCKED_EVENT = "scwebguard:popupblocked";
  const REINSTALL_EVENTS = ["pointerdown", "mousedown", "touchstart", "keydown", "click"];
  const USER_ACTIVATION_WINDOW_MS = 1500;
  const SUSPICIOUS_OPEN_RE = /(^|\.)((popads|popcash|clickadu|trafficjunky|adsterra|exoclick|fedoq|propellerads|hilltopads|adcash|juicyads|realsrv|doubleclick|googlesyndication|fwmrm|springserve|spotx|smartadserver|innovid|llvpn)\.|.*\b(popunder|popup|interstitial|adserver|vast|prebid)\b)/i;
  const nativeOpen = window.open;
  let enabled = false;
  let lastTrustedInputAt = 0;

  function createBlockedWindow() {
    const location = {
      href: "about:blank",
      assign() {},
      replace() {},
      reload() {},
      toString() { return "about:blank"; },
    };

    return new Proxy(
      {
        closed: false,
        location,
        blur() {},
        close() { this.closed = true; },
        focus() {},
        postMessage() {},
      },
      {
        set(target, property, value) {
          if (property !== "location") target[property] = value;
          return true;
        },
      }
    );
  }

  function getTargetUrl(value) {
    if (typeof value !== "string") return "";
    try {
      return new URL(value, window.location.href).href;
    } catch (_) {
      return value;
    }
  }

  function isSuspiciousTarget(url) {
    if (!url || url === "about:blank") return false;
    try {
      const parsed = new URL(url, window.location.href);
      if (!/^https?:$/.test(parsed.protocol)) return false;
      return SUSPICIOUS_OPEN_RE.test(`${parsed.hostname}${parsed.pathname}`);
    } catch (_) {
      return SUSPICIOUS_OPEN_RE.test(url);
    }
  }

  function hasRecentUserActivation() {
    const browserActivation = Boolean(navigator.userActivation?.isActive);
    return browserActivation || Date.now() - lastTrustedInputAt <= USER_ACTIVATION_WINDOW_MS;
  }

  function shouldBlockOpen(args) {
    const targetUrl = getTargetUrl(args[0]);
    if (isSuspiciousTarget(targetUrl)) return true;
    return !hasRecentUserActivation();
  }

  function guardedOpen(...args) {
    if (!enabled || !shouldBlockOpen(args)) {
      return Reflect.apply(nativeOpen, window, args);
    }

    window.dispatchEvent(
      new CustomEvent(BLOCKED_EVENT, {
        detail: { url: getTargetUrl(args[0]) },
      })
    );
    return createBlockedWindow();
  }

  function installGuard() {
    if (!enabled || window.open === guardedOpen) return;
    try { window.open = guardedOpen; } catch (_) {}
  }

  window.addEventListener(
    STATE_EVENT,
    (event) => {
      enabled = Boolean(event.detail?.enabled);
      installGuard();
    },
    true
  );

  function noteTrustedInput(event) {
    if (event.isTrusted) lastTrustedInputAt = Date.now();
    installGuard();
  }

  for (const eventName of REINSTALL_EVENTS) {
    window.addEventListener(eventName, noteTrustedInput, true);
  }

  window.setInterval(installGuard, 1000);
})();
