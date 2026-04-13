// background/whitelist.js
// Checks whether a given URL's domain is in the user's whitelist.

const STORAGE_KEY = "popshield_whitelist";

/**
 * Returns true if the domain of `url` is in the whitelist.
 * @param {string} url
 * @returns {Promise<boolean>}
 */
export async function isDomainWhitelisted(url) {
  if (!url) return false;

  let hostname;
  try {
    hostname = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return false;
  }

  return new Promise((resolve) => {
    chrome.storage.local.get({ [STORAGE_KEY]: [] }, (data) => {
      const list = data[STORAGE_KEY];
      // Match exact domain or any subdomain of a whitelisted domain
      const matched = list.some(
        (domain) => hostname === domain || hostname.endsWith("." + domain)
      );
      resolve(matched);
    });
  });
}
