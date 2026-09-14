import { ltr } from "./bidi";

/**
 * Money arrives from the API as integer centimes plus display-ready strings.
 * The API's `amount_formatted` is always preferred; these helpers only exist as
 * a fallback and work on digit strings so no amount ever passes through a float
 * division (the bug that `centimes / 100` used to introduce on the client).
 */

const SYMBOLS = {
  MAD: "DH",
  EUR: "€",
  USD: "$",
  GBP: "£",
};

export function currencySymbol(currency = "MAD") {
  const code = String(currency || "MAD").toUpperCase();
  return SYMBOLS[code] || code;
}

/** Splits 1234567 into { units: "12 345", cents: "67" } using string math only. */
function splitCentimes(centimes) {
  const value = Number.isFinite(centimes) ? Math.trunc(centimes) : 0;
  const digits = String(Math.abs(value));
  const padded = digits.length < 3 ? digits.padStart(3, "0") : digits;
  const units = padded.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

  return { negative: value < 0, units, cents: padded.slice(-2) };
}

/** 1234500 => "12 345,00 DH" — mirrors the backend's Money::format(). */
function rawCentimes(centimes, currency = "MAD") {
  const { negative, units, cents } = splitCentimes(centimes);
  return `${negative ? "-" : ""}${units},${cents} ${currencySymbol(currency)}`;
}

/**
 * Display form. The result is wrapped in a left-to-right isolate so an amount
 * keeps its own reading order inside an Arabic paragraph — without it, bidi
 * reorders "5 000,00 DH" around the Latin currency symbol.
 */
export function formatCentimes(centimes, currency = "MAD") {
  return ltr(rawCentimes(centimes, currency));
}

/**
 * Reads one of the API's money objects ({ amount, amount_decimal,
 * amount_formatted }). Falls back to local formatting of the authoritative
 * integer if the formatted string is missing.
 */
/** Unisolated, so callers can still inspect the sign before display. */
function rawMoney(money, currency = "MAD") {
  if (!money) {
    return rawCentimes(0, currency);
  }
  if (typeof money.amount_formatted === "string" && money.amount_formatted) {
    return money.amount_formatted;
  }
  return rawCentimes(money.amount, currency);
}

export function formatMoney(money, currency = "MAD") {
  return ltr(rawMoney(money, currency));
}

/** Same as formatMoney, but forces an explicit +/- prefix for flow amounts. */
export function formatSignedMoney(money, currency = "MAD", sign = "+") {
  // The sign is decided on the raw string: an isolate would sit in front of it
  // and defeat the startsWith checks, producing "+-15,50 DH".
  const raw = rawMoney(money, currency);
  const signed =
    raw.startsWith("-") || raw.startsWith("+") ? raw : `${sign}${raw}`;
  return ltr(signed);
}

/**
 * Keeps only what can belong to a major-unit amount: digits, a single decimal
 * separator, and at most two decimals. A comma is accepted (Moroccan keyboards
 * and French habit) and normalised to a dot for the API.
 *
 * The value is carried as a *string* end to end — never parsed into a float and
 * multiplied — so "15.10" cannot arrive at the server as 1509 centimes.
 */
export function sanitizeAmountInput(text) {
  const normalized = String(text ?? "").replace(",", ".");
  // Drop everything but digits and dots, then keep only the first dot.
  const cleaned = normalized.replace(/[^0-9.]/g, "");
  const [units, ...rest] = cleaned.split(".");
  if (rest.length === 0) {
    return units;
  }
  return `${units}.${rest.join("").slice(0, 2)}`;
}

/**
 * "15.5" => 1550. Pure digit-string math, so no rounding can creep in.
 * Returns 0 for anything that is not a usable positive amount.
 */
export function amountToCentimes(text) {
  const sanitized = sanitizeAmountInput(text);
  if (!sanitized || sanitized === ".") {
    return 0;
  }

  const [units = "", cents = ""] = sanitized.split(".");
  const unitDigits = units || "0";
  const centDigits = cents.padEnd(2, "0").slice(0, 2);

  // Guard against an absurdly long entry overflowing the safe integer range.
  if (unitDigits.length > 15) {
    return Number.MAX_SAFE_INTEGER;
  }
  return Number(`${unitDigits}${centDigits}`);
}

/** Raw integer centimes of a money object, for ratios and comparisons. */
export function centimesOf(money) {
  const amount = money?.amount;
  return Number.isFinite(amount) ? Math.trunc(amount) : 0;
}
