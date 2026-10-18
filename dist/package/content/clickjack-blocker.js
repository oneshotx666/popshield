// content/clickjack-blocker.js

function isClickjackLayer(el) {
  const style = window.getComputedStyle(el);
  const position = style.position;
  if (position !== "fixed" && position !== "absolute") return false;

  const zIndex = parseInt(style.zIndex, 10);
  if (isNaN(zIndex) || zIndex < 100) return false;

  const rect = el.getBoundingClientRect();
  if (rect.width < window.innerWidth * 0.8) return false;
  if (rect.height < window.innerHeight * 0.8) return false;

  const opacity = parseFloat(style.opacity);
  const bg = style.backgroundColor;
  const isTransparent =
    opacity < 0.05 ||
    bg === "transparent" ||
    bg === "rgba(0, 0, 0, 0)";
  if (!isTransparent) return false;

  const text = el.innerText?.trim() || "";
  if (text.length > 20) return false;

  const tag = el.tagName.toLowerCase();
  const hasHref = tag === "a" && el.href && !el.href.startsWith("javascript:");
  const hasOnclick = el.hasAttribute("onclick");
  if (!hasHref && !hasOnclick) return false;

  return true;
}

function removeClickjackLayers() {
  if (!window.__scwebguard?.enabled) return;
  let removed = 0;
  const candidates = document.querySelectorAll('a[href], [onclick]');
  for (const el of candidates) {
    if (isClickjackLayer(el)) {
      el.style.setProperty("pointer-events", "none", "important");
      el.style.setProperty("display", "none", "important");
      try { el.remove(); } catch (_) {}
      removed++;
    }
  }
  if (removed > 0) {
    chrome.storage.local.get({ blocked_overlays: 0 }, (data) => {
      chrome.storage.local.set({ blocked_overlays: data.blocked_overlays + removed });
    });
  }
}

function installClickInterceptor() {
  document.addEventListener(
    "click",
    (e) => {
      if (!window.__scwebguard?.enabled) return;
      const target = e.target;
      if (!target) return;
      if (isClickjackLayer(target)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        target.style.setProperty("pointer-events", "none", "important");
        try { target.remove(); } catch (_) {}
        chrome.storage.local.get({ blocked_overlays: 0 }, (data) => {
          chrome.storage.local.set({ blocked_overlays: data.blocked_overlays + 1 });
        });
      }
    },
    true
  );
}
