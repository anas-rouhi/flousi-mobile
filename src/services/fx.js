import * as SecureStore from "../platform/storage";

/**
 * Exchange rates for the converter: MAD against EUR, USD, SAR and gold.
 *
 * The rates come from the public currency-api dataset (daily, no key), NOT
 * from the FLOUSI API — so this uses plain `fetch` and never the shared axios
 * client, whose interceptor would attach the user's bearer token to a third
 * party. Two mirrors of the same dataset are tried in turn.
 *
 *   GET …/v1/currencies/mad.json
 *     → { "date": "2026-09-28", "mad": { "eur": 0.0921, "usd": 0.1003,
 *                                        "sar": 0.3762, "xau": 0.0000381, … } }
 *
 * `xau` is troy ounces per dirham; the converter works in grams.
 *
 * The last good answer is cached so the tool still works offline, and if even
 * that is missing it falls back to built-in approximate rates, flagged as such.
 */

const SOURCES = [
  "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/mad.json",
  "https://latest.currency-api.pages.dev/v1/currencies/mad.json",
];
const CACHE_KEY = "fx_rates_cache";
const TIMEOUT_MS = 8000;
const GRAMS_PER_TROY_OUNCE = 31.1034768;

/** The converter's units, in display order. */
export const FX_UNITS = ["MAD", "EUR", "USD", "SAR", "GOLD"];

/**
 * Units of each code per 1 MAD, used only when there has never been a
 * successful fetch. Rough 2026 levels — the screen labels them "approximate".
 */
const FALLBACK_RATES = {
  MAD: 1,
  EUR: 0.092,
  USD: 0.1,
  SAR: 0.375,
  GOLD: 0.00093,
};

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Keeps only positive finite rates for our units; null if any is missing. */
function readDataset(json) {
  const table = json?.mad;
  const ounces = Number(table?.xau);
  const rates = {
    MAD: 1,
    EUR: Number(table?.eur),
    USD: Number(table?.usd),
    SAR: Number(table?.sar),
    GOLD: ounces * GRAMS_PER_TROY_OUNCE,
  };
  const valid = Object.values(rates).every((value) => Number.isFinite(value) && value > 0);
  return valid ? { rates, date: typeof json.date === "string" ? json.date : null } : null;
}

async function readCache() {
  try {
    const raw = await SecureStore.getItemAsync(CACHE_KEY);
    const cached = raw ? JSON.parse(raw) : null;
    return cached?.rates ? cached : null;
  } catch {
    return null;
  }
}

/**
 * @returns {Promise<{
 *   rates: Record<string, number>,
 *   date: string|null,
 *   source: "live"|"cache"|"fallback",
 * }>}
 */
export async function fetchRates() {
  for (const url of SOURCES) {
    try {
      const dataset = readDataset(await fetchWithTimeout(url));
      if (dataset) {
        SecureStore.setItemAsync(CACHE_KEY, JSON.stringify(dataset)).catch(() => {});
        return { ...dataset, source: "live" };
      }
    } catch (err) {
      console.log("FX source failed:", url, err?.message);
    }
  }

  const cached = await readCache();
  if (cached) {
    return { ...cached, source: "cache" };
  }
  return { rates: FALLBACK_RATES, date: null, source: "fallback" };
}

/** The cached rates only, for a first paint before the network answers. */
export async function peekCachedRates() {
  const cached = await readCache();
  return cached ? { ...cached, source: "cache" } : null;
}

/**
 * Converts `value` from one unit to another. A float on purpose: this is an
 * estimate for the user to read, never an amount that reaches the ledger.
 */
export function convert(value, from, to, rates) {
  if (!Number.isFinite(value) || !rates?.[from] || !rates?.[to]) {
    return 0;
  }
  return (value / rates[from]) * rates[to];
}
