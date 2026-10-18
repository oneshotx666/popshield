// background/tab-blocker.js

const GLOBAL_KEY = "scwebguard_enabled";
const OVERRIDE_KEY = "scwebguard_tab_overrides";
const RESTORE_IN_FLIGHT_MS = 3000;
const POPUP_ATTEMPT_DEDUPE_MS = 250;
const POPUP_TAB_DEDUPE_MS = 10000;
const REDIRECT_AFTER_BLOCKED_POPUP_MS = 4000;
const PENDING_POPUP_TAB_MS = 12000;
const SUSPICIOUS_NAVIGATION_RE = /(^|\.)((popads|popcash|clickadu|trafficjunky|adsterra|exoclick|fedoq|propellerads|hilltopads|adcash|juicyads|realsrv|doubleclick|googlesyndication|fwmrm|springserve|spotx|smartadserver|innovid|llvpn)\.|.*\b(popunder|popup|interstitial|adserver|vast|prebid)\b)/i;

const tabStates = new Map();
const blockedPopupTabs = new Map();
const pendingPopupTabs = new Map();

function getTabState(tabId) {
  if (!tabStates.has(tabId)) {
    tabStates.set(tabId, {
      currentUrl: null,
      safeUrl: null,
      restoreUrl: null,
      restoreUntil: 0,
      lastPopupAttemptAt: 0,
      lastBlockedPopupUrl: "",
    });
  }

  return tabStates.get(tabId);
}

function isHttpUrl(url) {
  try {
    return /^https?:$/.test(new URL(url).protocol);
  } catch (_) {
    return false;
  }
}

function isCrossOriginNavigation(fromUrl, toUrl) {
  try {
    return new URL(fromUrl).origin !== new URL(toUrl).origin;
  } catch (_) {
    return false;
  }
}

function isSuspiciousNavigationUrl(url) {
  try {
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) return false;
    return SUSPICIOUS_NAVIGATION_RE.test(`${parsed.hostname}${parsed.pathname}`);
  } catch (_) {
    return false;
  }
}

function incrementCounter(key) {
  chrome.storage.local.get({ [key]: 0 }, (data) => {
    chrome.storage.local.set({ [key]: data[key] + 1 });
  });
}

function pruneBlockedPopupTabs(now = Date.now()) {
  for (const [tabId, blockedAt] of blockedPopupTabs) {
    if (now - blockedAt > POPUP_TAB_DEDUPE_MS) blockedPopupTabs.delete(tabId);
  }
}

function prunePendingPopupTabs(now = Date.now()) {
  for (const [tabId, popup] of pendingPopupTabs) {
    if (now - popup.createdAt > PENDING_POPUP_TAB_MS) pendingPopupTabs.delete(tabId);
  }
}

async function isBlockingActiveForTab(tabId) {
  const data = await chrome.storage.local.get({
    [GLOBAL_KEY]: false,
    [OVERRIDE_KEY]: {},
  });

  if (tabId in data[OVERRIDE_KEY]) return data[OVERRIDE_KEY][tabId];
  return data[GLOBAL_KEY];
}

async function rememberSafeTabUrl(tabId, fallbackUrl = "") {
  const state = getTabState(tabId);
  let url = fallbackUrl;

  try {
    const tab = await chrome.tabs.get(tabId);
    url = tab.url || tab.pendingUrl || fallbackUrl;
  } catch (_) {
    // The opener may have closed between the popup attempt and this lookup.
  }

  if (!isHttpUrl(url)) return;
  state.currentUrl = url;
  if (!isHttpUrl(state.safeUrl)) state.safeUrl = url;
}

function removePopupTab(tabId) {
  const now = Date.now();
  pruneBlockedPopupTabs(now);
  if (blockedPopupTabs.has(tabId)) return false;

  blockedPopupTabs.set(tabId, now);
  pendingPopupTabs.delete(tabId);
  chrome.tabs.remove(tabId, () => void chrome.runtime.lastError);
  incrementCounter("blocked_tabs");
  return true;
}

function restoreTab(tabId, state, restoreUrl) {
  state.restoreUrl = restoreUrl;
  state.restoreUntil = Date.now() + RESTORE_IN_FLIGHT_MS;
  state.currentUrl = restoreUrl;
  state.safeUrl = restoreUrl;
  incrementCounter("blocked_redirects");

  chrome.tabs.update(tabId, { url: restoreUrl }, () => {
    void chrome.runtime.lastError;
  });
}

function hasTransitionQualifier(details, qualifier) {
  return details.transitionQualifiers?.includes(qualifier) || false;
}

function isBrowserControlledNavigation(details) {
  return (
    details.transitionType === "reload" ||
    details.transitionType === "typed" ||
    hasTransitionQualifier(details, "from_address_bar") ||
    hasTransitionQualifier(details, "forward_back")
  );
}

function isRedirectNavigation(details) {
  return (
    hasTransitionQualifier(details, "client_redirect") ||
    hasTransitionQualifier(details, "server_redirect")
  );
}

function wasRecentlyBlockedPopup(state, now = Date.now()) {
  return now - state.lastPopupAttemptAt <= REDIRECT_AFTER_BLOCKED_POPUP_MS;
}

function shouldRestoreCommittedNavigation(details, state, now = Date.now()) {
  if (wasRecentlyBlockedPopup(state, now) && isRedirectNavigation(details)) {
    return true;
  }

  if (!isSuspiciousNavigationUrl(details.url)) return false;

  return (
    details.transitionType === "generated" ||
    isRedirectNavigation(details) ||
    wasRecentlyBlockedPopup(state, now)
  );
}

function rememberPendingPopupTab(tabId, sourceTabId, url = "") {
  prunePendingPopupTabs();
  pendingPopupTabs.set(tabId, {
    sourceTabId,
    createdAt: Date.now(),
    firstUrl: isHttpUrl(url) ? url : "",
  });
}

export async function handleTabCreated(tab) {
  if (tab.openerTabId === undefined) return;
  if (!(await isBlockingActiveForTab(tab.openerTabId))) return;

  await rememberSafeTabUrl(tab.openerTabId);
  const popupUrl = tab.pendingUrl || tab.url || "";
  if (isSuspiciousNavigationUrl(popupUrl) && removePopupTab(tab.id)) {
    console.info("[SC WebGuard] Blocked suspicious popup tab from:", tab.openerTabId);
    return;
  }

  rememberPendingPopupTab(tab.id, tab.openerTabId, popupUrl);
}

// Keep the last completed page as the restore target. Commit decisions use
// webNavigation because it exposes redirect qualifiers and browser history.
export async function handleTabUpdated(tabId, changeInfo, tab) {
  const nextUrl = changeInfo.url || tab?.url || tab?.pendingUrl || "";
  if (!isHttpUrl(nextUrl)) return;

  const state = getTabState(tabId);
  const now = Date.now();
  const pendingPopup = pendingPopupTabs.get(tabId);

  if (pendingPopup && isSuspiciousNavigationUrl(nextUrl)) {
    if (removePopupTab(tabId)) {
      console.info("[SC WebGuard] Blocked suspicious popup navigation from:", pendingPopup.sourceTabId);
    }
    return;
  }

  if (pendingPopup && changeInfo.status === "complete") {
    pendingPopupTabs.delete(tabId);
  }

  if (state.restoreUrl && now <= state.restoreUntil) {
    if (nextUrl === state.restoreUrl && changeInfo.status === "complete") {
      state.restoreUrl = null;
      state.restoreUntil = 0;
    }
    return;
  }

  state.currentUrl = nextUrl;
  if (changeInfo.status === "complete") state.safeUrl = nextUrl;
}

export async function handleCreatedNavigationTarget(details) {
  if (details.sourceTabId === undefined || details.tabId === undefined) return;
  if (!(await isBlockingActiveForTab(details.sourceTabId))) return;

  await rememberSafeTabUrl(details.sourceTabId);
  if (isSuspiciousNavigationUrl(details.url) && removePopupTab(details.tabId)) {
    console.info("[SC WebGuard] Blocked suspicious navigation target from:", details.sourceTabId);
    return;
  }

  rememberPendingPopupTab(details.tabId, details.sourceTabId, details.url);
}

export async function handleMainFrameBeforeNavigate(details) {
  if (details.frameId !== 0 || !isHttpUrl(details.url)) return;

  const state = getTabState(details.tabId);
  if (isHttpUrl(state.safeUrl)) return;

  try {
    const tab = await chrome.tabs.get(details.tabId);
    rememberTabUrl(details.tabId, tab.url);
  } catch (_) {
    // The tab may have closed before Chrome supplied its current URL.
  }
}

export async function handleMainFrameCommitted(details) {
  if (details.frameId !== 0 || !isHttpUrl(details.url)) return;

  const state = getTabState(details.tabId);
  const now = Date.now();

  if (state.restoreUrl && now <= state.restoreUntil) return;

  const restoreUrl = state.safeUrl;
  const crossedOrigin =
    isHttpUrl(restoreUrl) && isCrossOriginNavigation(restoreUrl, details.url);

  if (
    crossedOrigin &&
    await isBlockingActiveForTab(details.tabId) &&
    (
      !isBrowserControlledNavigation(details) &&
      shouldRestoreCommittedNavigation(details, state, now)
    )
  ) {
    restoreTab(details.tabId, state, restoreUrl);
    console.info("[SC WebGuard] Restored tab after committed redirect:", details.tabId);
    return;
  }

  state.currentUrl = details.url;
}

export function rememberTabUrl(tabId, tabUrl) {
  if (tabId === undefined) return;

  const state = getTabState(tabId);
  if (isHttpUrl(tabUrl)) {
    state.currentUrl = tabUrl;
    if (!isHttpUrl(state.safeUrl)) state.safeUrl = tabUrl;
  }
}

export async function recordBlockedPopupAttempt(tabId, tabUrl, blockedUrl = "") {
  if (tabId === undefined || !(await isBlockingActiveForTab(tabId))) return;

  const state = getTabState(tabId);
  const now = Date.now();
  await rememberSafeTabUrl(tabId, tabUrl);

  if (now - state.lastPopupAttemptAt < POPUP_ATTEMPT_DEDUPE_MS) return;
  state.lastPopupAttemptAt = now;
  state.lastBlockedPopupUrl = blockedUrl || "";
  incrementCounter("blocked_tabs");
  console.info("[SC WebGuard] Blocked window.open attempt from:", tabId);
}

export function handleTabRemoved(tabId) {
  tabStates.delete(tabId);
  pendingPopupTabs.delete(tabId);
}
