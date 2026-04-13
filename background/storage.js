const KEY = "popshield_enabled";

/**
 * Returns true if the extension is currently enabled.
 * Defaults to true on first install.
 */
export async function isEnabled() {
  const result = await chrome.storage.local.get({ [KEY]: true });
  return result[KEY];
}

/**
 * Sets the enabled state.
 * @param {boolean} value
 */
export async function setEnabled(value) {
  await chrome.storage.local.set({ [KEY]: value });
}
