// welcome/welcome.js

const TOTAL = 5;
let current = 0;

const steps   = document.querySelectorAll(".step");
const pills   = document.querySelectorAll(".step-pill");
const dots    = document.querySelectorAll(".dot");
const btnBack = document.getElementById("btn-back");
const btnNext = document.getElementById("btn-next");

function goTo(index) {
  index = Math.max(0, Math.min(TOTAL - 1, index));

  // Mark previous step as done in sidebar (skip step 0 — it's the intro, no number)
  if (index > current && current > 0) {
    pills[current].classList.remove("active");
    pills[current].classList.add("done");
    pills[current].querySelector(".pill-num").textContent = "✓";
  } else if (index > current && current === 0) {
    pills[current].classList.remove("active");
    pills[current].classList.add("done");
  }

  current = index;

  steps.forEach((s, i) => s.classList.toggle("active", i === current));
  pills.forEach((p, i) => p.classList.toggle("active", i === current));
  dots.forEach((d, i) => d.classList.toggle("active", i === current));

  btnBack.disabled = current === 0;

  if (current === TOTAL - 1) {
    btnNext.textContent = "Get started ✓";
    btnNext.className = "btn btn--finish";
  } else {
    btnNext.textContent = current === 0 ? "Let's go →" : "Next →";
    btnNext.className = "btn btn--primary";
  }
}

btnNext.addEventListener("click", () => {
  if (current === TOTAL - 1) {
    window.close();
  } else {
    goTo(current + 1);
  }
});

btnBack.addEventListener("click", () => goTo(current - 1));

pills.forEach((pill) => {
  pill.addEventListener("click", () => {
    const target = parseInt(pill.dataset.step, 10);
    if (target <= current) goTo(target);
  });
});

// Step 3 — real toggle wired to chrome.storage
const realToggle = document.getElementById("real-toggle");
const realStatus = document.getElementById("real-status");
const realHint   = document.getElementById("real-hint");
const realCard   = document.getElementById("real-toggle-card");

function applyRealState(enabled) {
  realToggle.checked = enabled;
  realStatus.textContent = enabled ? "Active — blocking is on" : "Inactive — blocking is off";
  realStatus.className = "real-toggle-status" + (enabled ? " on" : "");
  realCard.classList.toggle("enabled", enabled);
  realHint.textContent = enabled
    ? "You're all set. SC WebGuard is protecting your tabs. ✓"
    : "Toggle on to start blocking popups, banners, and clickjack ads.";
  realHint.className = "mock-hint" + (enabled ? " done" : "");
}

if (realToggle) {
  // Read current state from storage
  chrome.storage.local.get({ scwebguard_enabled: false }, (data) => {
    applyRealState(data.scwebguard_enabled);
  });

  realToggle.addEventListener("change", () => {
    const enabled = realToggle.checked;
    chrome.storage.local.set({ scwebguard_enabled: enabled }, () => {
      applyRealState(enabled);
    });
  });
}

goTo(0);
