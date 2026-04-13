// popup/tabs-panel.js

const STORAGE_KEY = "popshield_tab_overrides";

async function loadTabOverrides() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ [STORAGE_KEY]: {} }, (data) => resolve(data[STORAGE_KEY]));
  });
}

async function setTabOverride(tabId, enabled) {
  // Save to storage
  const overrides = await loadTabOverrides();
  overrides[tabId] = enabled;
  chrome.storage.local.set({ [STORAGE_KEY]: overrides });

  // Send directly to the tab's content script
  chrome.tabs.sendMessage(
    tabId,
    { type: "SET_TAB_ENABLED", enabled },
    () => void chrome.runtime.lastError
  );
}

export async function renderTabsList(container, globalEnabled) {
  container.innerHTML = "";

  const [tabs, overrides] = await Promise.all([
    new Promise((r) => chrome.tabs.query({}, r)),
    loadTabOverrides(),
  ]);

  if (tabs.length === 0) {
    container.innerHTML = `<p class="tabs-empty">No open tabs found.</p>`;
    return;
  }

  const currentWindowId = tabs.find((t) => t.active)?.windowId;
  tabs.sort((a, b) => {
    if (a.windowId === currentWindowId && b.windowId !== currentWindowId) return -1;
    if (b.windowId === currentWindowId && a.windowId !== currentWindowId) return 1;
    return a.index - b.index;
  });

  for (const tab of tabs) {
    const isEnabled = tab.id in overrides ? overrides[tab.id] : globalEnabled;
    container.appendChild(buildTabRow(tab, isEnabled, globalEnabled));
  }
}

function buildTabRow(tab, isEnabled, globalEnabled) {
  const row = document.createElement("div");
  row.className = "tab-row" + (tab.active ? " tab-row--active" : "");

  const favicon = document.createElement("img");
  favicon.className = "tab-favicon";
  favicon.src = tab.favIconUrl || "";
  favicon.onerror = () => favicon.classList.add("tab-favicon--missing");

  const info = document.createElement("div");
  info.className = "tab-info";

  const title = document.createElement("span");
  title.className = "tab-title";
  title.textContent = tab.title || "Untitled";

  const domain = document.createElement("span");
  domain.className = "tab-domain";
  try {
    domain.textContent = new URL(tab.url || "").hostname.replace(/^www\./, "");
  } catch {
    domain.textContent = tab.url || "";
  }

  info.appendChild(title);
  info.appendChild(domain);

  const switchLabel = document.createElement("label");
  switchLabel.className = "switch switch--sm";

  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = isEnabled;
  input.disabled = !globalEnabled;

  const slider = document.createElement("span");
  slider.className = "slider";

  switchLabel.appendChild(input);
  switchLabel.appendChild(slider);

  input.addEventListener("change", () => setTabOverride(tab.id, input.checked));

  row.appendChild(favicon);
  row.appendChild(info);
  row.appendChild(switchLabel);
  return row;
}
