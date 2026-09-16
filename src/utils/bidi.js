/**
 * Unicode bidi isolates.
 *
 * Deliberately free of any React Native import: money formatting depends on
 * this, and a pure formatting module should stay testable outside the app.
 * The direction-aware helpers that do need the platform live in `rtl.js`.
 */

/** LEFT-TO-RIGHT ISOLATE / FIRST STRONG ISOLATE / POP DIRECTIONAL ISOLATE. All zero-width. */
const LRI = "⁦";
const FSI = "⁨";
const PDI = "⁩";

/**
 * Lays a string out as its own left-to-right run.
 *
 * Applied to money, which mixes digits, spaces and a Latin currency symbol —
 * exactly the combination an Arabic paragraph reorders, turning
 * "5 000,00 DH" into "DH 5 000,00" or worse. Also for percentages and anything
 * else whose internal order is fixed regardless of the surrounding language.
 */
export function ltr(text) {
  if (text === null || text === undefined || text === "") {
    return text;
  }
  return `${LRI}${text}${PDI}`;
}

/**
 * Isolates a string whose direction is unknown — a user-typed account name,
 * a server category name, a search term.
 *
 * Unlike `ltr`, the run takes the direction of its own first strong character,
 * so "CIH Bank" stays left-to-right inside Arabic while a multi-word Arabic
 * name inside French keeps its right-to-left word order. Either way the run
 * cannot drag the punctuation around it (bullets, quotes) out of place.
 */
export function isolate(text) {
  if (text === null || text === undefined || text === "") {
    return text;
  }
  return `${FSI}${text}${PDI}`;
}

/**
 * Joins metadata parts with " • ", isolating each one first.
 *
 * Without the isolates, "Transport • CIH Bank" inside an Arabic row lets the
 * two Latin runs merge across the bullet and swap places.
 */
export function joinMeta(parts, separator = " • ") {
  return parts
    .filter((part) => part !== null && part !== undefined && part !== "")
    .map(isolate)
    .join(separator);
}

/** Removes the isolates again, for comparisons and tests. */
export function stripLtr(text) {
  return typeof text === "string"
    ? text.split(LRI).join("").split(FSI).join("").split(PDI).join("")
    : text;
}
