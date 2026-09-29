/**
 * Browser stand-in for expo-secure-store, whose web module is empty (every
 * call would throw and nothing — not even the session — would persist).
 *
 * Backed by localStorage, the usual home for a single-page app's bearer token.
 * It is readable by any script on the origin, so it is not the Keychain: the
 * web build relies on the page shipping no third-party scripts. Keys are
 * namespaced so they cannot collide with anything else on the origin.
 *
 * Every call swallows storage errors (private mode, quota, disabled storage)
 * the way a missing secure-store entry would behave: reads come back null.
 */
const PREFIX = "flousi:";

function store() {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export async function getItemAsync(key) {
  try {
    return store()?.getItem(PREFIX + key) ?? null;
  } catch {
    return null;
  }
}

export async function setItemAsync(key, value) {
  try {
    store()?.setItem(PREFIX + key, String(value));
  } catch (error) {
    console.log("Web storage write failed:", error?.message);
  }
}

export async function deleteItemAsync(key) {
  try {
    store()?.removeItem(PREFIX + key);
  } catch {}
}
