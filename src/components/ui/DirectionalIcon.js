import React from "react";
import { Text } from "react-native";
import { flipForRTL } from "../../utils/rtl";

/**
 * A glyph that means a direction — chevrons, back and next arrows, the "moved
 * to" arrow on a transfer.
 *
 * Mirroring lives here rather than at each call site so there is one place that
 * decides, and so a glyph can never be flipped twice. Glyphs that carry no
 * direction (a plus, a pencil, a category emoji) must NOT use this: mirroring
 * them just renders them backwards.
 */
export default function DirectionalIcon({ glyph, style, ...rest }) {
  // Colour and size come from the caller; this owns only the mirroring, so it
  // holds no themed stylesheet of its own.
  return (
    <Text style={[{ transform: flipForRTL() }, style]} {...rest}>
      {glyph}
    </Text>
  );
}
