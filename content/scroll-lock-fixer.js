// content/scroll-lock-fixer.js

const LOCKED_STYLES = ["overflow", "overflow-y", "overflow-x"];

function restoreScroll() {
  if (!window.__popshield?.enabled) return;
  for (const el of [document.documentElement, document.body]) {
    if (!el) continue;
    const style = window.getComputedStyle(el);
    for (const prop of LOCKED_STYLES) {
      if (style[prop] === "hidden" || style[prop] === "clip") {
        el.style.setProperty(prop, "auto", "important");
      }
    }
  }
}

function watchScrollLock() {
  if (!window.__popshield?.enabled) return;
  const LOCK_CLASSES = [
    "modal-open", "overflow-hidden", "noscroll", "no-scroll",
    "scroll-locked", "body-lock", "is-locked", "lock-scroll",
  ];
  const observer = new MutationObserver(() => {
    for (const cls of LOCK_CLASSES) {
      if (document.body.classList.contains(cls)) {
        document.body.classList.remove(cls);
        restoreScroll();
      }
    }
  });
  observer.observe(document.body, { attributes: true, attributeFilter: ["class", "style"] });
}
