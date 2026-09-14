/**
 * Unicode bidi isolates.
 *
 * Deliberately free of any React Native import: money formatting depends on
 * this, and a pure formatting module should stay testable outside the app.
 * The direction-aware helpers that do need the platform live in `rtl.js`.
 */

/** LEFT-TO-RIGHT ISOLATE / POP DIRECTIONAL ISOLATE. Both zero-width. */
const LRI = "⁦";
const PDI = "⁩";

/**
 * Lays a string out as its own left-to-right run.
 *
 * Applied to money, which mixes digits, spaces and a Latin currency symbol —
 * exactly the combination an Arabic paragraph reorders, turning
 * "5 000,00 DH" into "DH 5 000,00" or worse.
 */
export function ltr(text) {
  if (text === null || text === undefined || text === "") {
    return text;
  }
  return `${LRI}${text}${PDI}`;
}

/** Removes the isolates again, for comparisons and tests. */
export function stripLtr(text) {
  return typeof text === "string"
    ? text.split(LRI).join("").split(PDI).join("")
    : text;
}
