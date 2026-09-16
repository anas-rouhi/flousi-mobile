import { I18nManager } from "react-native";

export { ltr, isolate, joinMeta, stripLtr } from "./bidi";

/**
 * Direction helpers.
 *
 * Layout direction is driven by the app itself — a `direction` style on the
 * app's root view cascades through the tree (see App.js) instead of the native
 * `I18nManager.forceRTL`, which Expo Go on the new architecture ignores. The
 * `isRTL` below therefore reports the language the app has chosen, not the
 * native latch.
 */

let rtl = false;

/** Sets the running direction; called by the locale bootstrap, never late. */
export function setRTL(value) {
  rtl = Boolean(value);
}

/** Live at call time; the direction the app is currently laid out in. */
export function isRTL() {
  return rtl;
}

/**
 * A row whose visual order must NOT mirror — an amount followed by its
 * currency, for instance, which should read the same way in both directions.
 * Under RTL, `row-reverse` renders visually left-to-right.
 */
export function fixedLtrRow() {
  return rtl ? "row-reverse" : "row";
}

/** Mirrors a glyph that points somewhere (chevrons, arrows). */
export function flipForRTL() {
  return rtl ? [{ scaleX: -1 }] : [];
}
