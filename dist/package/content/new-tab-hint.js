// content/new-tab-hint.js
// Shows a reminder toast when the user tries to open a new tab while
// SC WebGuard is active. Catches Ctrl/Cmd+T, middle-clicks on links,
// and target="_blank" link clicks.
// Shows once per browser session (chrome.storage.session resets on browser restart).

const SESSION_KEY  = "scwebguard_newtab_hint_shown";
const AUTO_DISMISS = 7000; // ms

let toastEl    = null;
let dismissTimer = null;

// ── Guard: only run if enabled ─────────────────────────────────────────────

function isActive() {
  return Boolean(window.__scwebguard?.enabled);
}

// ── Toast UI ───────────────────────────────────────────────────────────────

function buildToast() {
  const el = document.createElement("div");
  el.id = "__scwg-newtab-hint";
  el.innerHTML = `
    <img src="${chrome.runtime.getURL("icons/icon48.png")}" alt="" />
    <div class="__scwg-hint-body">
      <strong>SC WebGuard is active</strong>
      <span>New tabs from this page will be blocked. Toggle this tab off in the SC WebGuard popup if you need to open one.</span>
    </div>
    <button class="__scwg-hint-close" aria-label="Dismiss">✕</button>
  `;

  const style = document.createElement("style");
  style.textContent = `
    #__scwg-newtab-hint {
      all: initial;
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 2147483647;
      display: flex;
      align-items: flex-start;
      gap: 10px;
      background: #1c1f27;
      border: 1px solid #2a2d38;
      border-left: 3px solid #5b8cff;
      border-radius: 10px;
      padding: 13px 14px;
      max-width: 320px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.45);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      animation: __scwg-slidein 0.22s cubic-bezier(0.34,1.26,0.64,1);
      cursor: default;
    }
    @keyframes __scwg-slidein {
      from { opacity: 0; transform: translateY(14px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    #__scwg-newtab-hint.__scwg-out {
      animation: __scwg-slideout 0.18s ease forwards;
    }
    @keyframes __scwg-slideout {
      to { opacity: 0; transform: translateY(10px); }
    }
    #__scwg-newtab-hint img {
      width: 28px;
      height: 28px;
      object-fit: contain;
      flex-shrink: 0;
      margin-top: 1px;
    }
    .__scwg-hint-body {
      display: flex;
      flex-direction: column;
      gap: 3px;
      flex: 1;
    }
    .__scwg-hint-body strong {
      font-size: 13px;
      font-weight: 600;
      color: #e8eaf0;
    }
    .__scwg-hint-body span {
      font-size: 12px;
      color: #7a7f94;
      line-height: 1.45;
    }
    .__scwg-hint-close {
      all: unset;
      cursor: pointer;
      color: #7a7f94;
      font-size: 12px;
      line-height: 1;
      padding: 2px 4px;
      border-radius: 4px;
      flex-shrink: 0;
      margin-top: -1px;
    }
    .__scwg-hint-close:hover { color: #e8eaf0; }
  `;

  document.head.appendChild(style);

  el.querySelector(".__scwg-hint-close").addEventListener("click", dismissToast);
  return el;
}

function showToast() {
  if (toastEl) return; // already visible

  // Show once per browser session — chrome.storage.session clears on browser restart
  chrome.storage.session.get({ [SESSION_KEY]: false }, (data) => {
    if (data[SESSION_KEY]) return; // already shown this session

    chrome.storage.session.set({ [SESSION_KEY]: true });

    toastEl = buildToast();
    document.body.appendChild(toastEl);

    dismissTimer = setTimeout(dismissToast, AUTO_DISMISS);
  });
}

function dismissToast() {
  if (!toastEl) return;
  clearTimeout(dismissTimer);
  toastEl.classList.add("__scwg-out");
  toastEl.addEventListener("animationend", () => {
    toastEl?.remove();
    toastEl = null;
  }, { once: true });
}

// ── Event listeners ────────────────────────────────────────────────────────

// 1. Ctrl/Cmd + T
document.addEventListener("keydown", (e) => {
  if (!isActive()) return;
  const isNewTab = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "t" && !e.shiftKey && !e.altKey;
  if (isNewTab) showToast();
}, true);

// 2. Middle-click on any element
document.addEventListener("mousedown", (e) => {
  if (!isActive()) return;
  if (e.button !== 1) return; // middle button only
  const link = e.target.closest("a[href]");
  if (link) showToast();
}, true);

// 3. Click on target="_blank" links
document.addEventListener("click", (e) => {
  if (!isActive()) return;
  const link = e.target.closest('a[target="_blank"], a[target="blank"]');
  if (link) showToast();
}, true);
