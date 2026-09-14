import { I18nManager } from "react-native";

export { ltr, stripLtr } from "./bidi";

/**
 * Direction helpers.
 *
 * With `I18nManager.forceRTL(true)` the platform mirrors `flexDirection: "row"`,
 * `textAlign: "auto"` and every `*Start`/`*End` property for us — so styles use
 * those and almost never need to ask which direction is active. These cover the
 * two cases the platform cannot infer: content that must keep a fixed visual
 * order, and glyphs that point somewhere.
 */

/** Live at call time; direction is fixed for the life of the process. */
export function isRTL() {
  return I18nManager.isRTL;
}

/**
 * A row whose visual order must NOT mirror — an amount followed by its
 * currency, for instance, which should read the same way in both directions.
 * Under RTL, `row-reverse` renders visually left-to-right.
 */
export function fixedLtrRow() {
  return I18nManager.isRTL ? "row-reverse" : "row";
}

/** Mirrors a glyph that points somewhere (chevrons, arrows). */
export function flipForRTL() {
  return I18nManager.isRTL ? [{ scaleX: -1 }] : [];
}
