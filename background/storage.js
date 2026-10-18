const KEY = "scwebguard_enabled";

/**
 * Returns true if the extension is currently enabled.
 * Defaults to false on first install — user opts in per site or globally.
 */
export async function isEnabled() {
  const result = await chrome.storage.local.get({ [KEY]: false });
  return result[KEY];
}

/**
 * Sets the enabled state.
 * @param {boolean} value
 */
export async function setEnabled(value) {
  await chrome.storage.local.set({ [KEY]: value });
}
