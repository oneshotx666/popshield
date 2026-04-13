// popup/whitelist-panel.js
// Manages the domain whitelist — sites where all blocking is disabled.

const STORAGE_KEY = "popshield_whitelist"; // string[] of domains

// ── Storage helpers ──────────────────────────────────────────────────────────

export async function loadWhitelist() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ [STORAGE_KEY]: [] }, (data) => {
      resolve(data[STORAGE_KEY]);
    });
  });
}

async function saveWhitelist(list) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: list }, resolve);
  });
}

export async function addDomain(raw) {
  const domain = sanitizeDomain(raw);
  if (!domain) return { ok: false, error: "Invalid domain" };

  const list = await loadWhitelist();
  if (list.includes(domain)) return { ok: false, error: "Already in list" };

  list.push(domain);
  list.sort();
  await saveWhitelist(list);
  return { ok: true, domain };
}

export async function removeDomain(domain) {
  const list = await loadWhitelist();
  const filtered = list.filter((d) => d !== domain);
  await saveWhitelist(filtered);
}

// ── Domain sanitizer ─────────────────────────────────────────────────────────

function sanitizeDomain(input) {
  try {
    let str = input.trim().toLowerCase();
    // Strip protocol if user pasted a full URL
    if (!str.startsWith("http")) str = "https://" + str;
    const hostname = new URL(str).hostname.replace(/^www\./, "");
    // Basic validity check
    if (!hostname || !hostname.includes(".")) return null;
    return hostname;
  } catch {
    return null;
  }
}

// ── "Add current tab's domain" helper ───────────────────────────────────────

export async function getCurrentTabDomain() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.url) { resolve(null); return; }
      try {
        const hostname = new URL(tab.url).hostname.replace(/^www\./, "");
        resolve(hostname || null);
      } catch {
        resolve(null);
      }
    });
  });
}

// ── Render ───────────────────────────────────────────────────────────────────

export async function renderWhitelistPanel(container) {
  container.innerHTML = "";

  const [list, currentDomain] = await Promise.all([
    loadWhitelist(),
    getCurrentTabDomain(),
  ]);

  // ── Add row ──
  const addRow = document.createElement("div");
  addRow.className = "wl-add-row";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "wl-input";
  input.placeholder = "e.g. example.com";
  input.spellcheck = false;
  input.autocomplete = "off";

  const addBtn = document.createElement("button");
  addBtn.className = "wl-btn wl-btn--add";
  addBtn.textContent = "Add";

  addRow.appendChild(input);
  addRow.appendChild(addBtn);
  container.appendChild(addRow);

  // Error/feedback line
  const feedback = document.createElement("p");
  feedback.className = "wl-feedback";
  container.appendChild(feedback);

  // "Add current site" shortcut
  if (currentDomain) {
    const shortcut = document.createElement("button");
    shortcut.className = "wl-shortcut";
    shortcut.textContent = `+ Add current site (${currentDomain})`;
    shortcut.addEventListener("click", async () => {
      await handleAdd(currentDomain, input, feedback, listEl);
    });
    container.appendChild(shortcut);
  }

  // ── List ──
  const listEl = document.createElement("div");
  listEl.className = "wl-list";
  container.appendChild(listEl);

  renderList(list, listEl);

  // ── Wire up add ──
  async function handleAdd(value, inputEl, feedbackEl, listContainer) {
    const result = await addDomain(value);
    if (!result.ok) {
      feedbackEl.textContent = result.error;
      feedbackEl.classList.add("wl-feedback--error");
      setTimeout(() => { feedbackEl.textContent = ""; feedbackEl.classList.remove("wl-feedback--error"); }, 2000);
      return;
    }
    inputEl.value = "";
    feedbackEl.textContent = "";
    const fresh = await loadWhitelist();
    renderList(fresh, listContainer);
  }

  addBtn.addEventListener("click", () => handleAdd(input.value, input, feedback, listEl));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleAdd(input.value, input, feedback, listEl);
  });
}

function renderList(list, container) {
  container.innerHTML = "";

  if (list.length === 0) {
    container.innerHTML = `<p class="wl-empty">No sites whitelisted yet.</p>`;
    return;
  }

  for (const domain of list) {
    const row = document.createElement("div");
    row.className = "wl-row";

    const label = document.createElement("span");
    label.className = "wl-domain";
    label.textContent = domain;

    const removeBtn = document.createElement("button");
    removeBtn.className = "wl-btn wl-btn--remove";
    removeBtn.textContent = "✕";
    removeBtn.title = `Remove ${domain}`;
    removeBtn.addEventListener("click", async () => {
      await removeDomain(domain);
      const fresh = await loadWhitelist();
      renderList(fresh, container);
    });

    row.appendChild(label);
    row.appendChild(removeBtn);
    container.appendChild(row);
  }
}
