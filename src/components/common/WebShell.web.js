import React from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { APP_MAX_WIDTH } from "../../platform/layout";

/** From this width there is room for the brand panel beside the column. */
const PANEL_BREAKPOINT = 1100;

/**
 * The desktop frame: the phone-sized app centred in a 480px column with a soft
 * edge and shadow, on a quiet brand ground. Wide windows also get a brand
 * panel pinned to the side — absolutely positioned, so the column stays
 * exactly centred and modals (see platform/Modal.web.js) line up with it.
 *
 * Below 480px (a phone browser) the column is the whole window and the frame
 * disappears.
 */
export default function WebShell({ children }) {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const framed = width > APP_MAX_WIDTH;
  const ground = isDark ? "#0A100D" : "#E7EFEA";

  return (
    <View style={[styles.page, { backgroundColor: framed ? ground : colors.background }]}>
      {width >= PANEL_BREAKPOINT ? (
        <View style={styles.panel} pointerEvents="none">
          <View style={[styles.logo, { backgroundColor: colors.primary }]}>
            <Text style={[styles.logoText, { color: colors.onPrimary }]}>F</Text>
          </View>
          <Text style={[styles.wordmark, styles.panelText, { color: colors.primary }]}>FLOUSI</Text>
          <Text style={[styles.tagline, styles.panelText, { color: colors.text }]}>فين مشات فلوسي؟</Text>
          <Text style={[styles.blurb, styles.panelText, { color: colors.textSecondary }]}>
            Track every dirham — on the web, iOS and Android.
          </Text>
        </View>
      ) : null}

      <View
        style={[
          styles.column,
          framed && styles.framed,
          framed && {
            borderColor: colors.border,
            boxShadow: isDark
              ? "0 20px 60px rgba(0,0,0,0.55)"
              : "0 20px 60px rgba(10,92,54,0.16)",
          },
          { backgroundColor: colors.background },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: "center" },
  column: { flex: 1, width: "100%", maxWidth: APP_MAX_WIDTH, overflow: "hidden" },
  framed: { borderLeftWidth: 1, borderRightWidth: 1 },
  panel: { position: "absolute", left: 64, top: 0, bottom: 0, justifyContent: "center", maxWidth: 320 },
  // Pinned left-aligned: an Arabic line would otherwise align itself right.
  panelText: { textAlign: "left" },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: { fontSize: 30, fontWeight: "900" },
  wordmark: { fontSize: 34, fontWeight: "900", letterSpacing: 5, marginTop: 20 },
  tagline: { fontSize: 22, fontWeight: "700", marginTop: 6 },
  blurb: { fontSize: 15, marginTop: 12, lineHeight: 22 },
});
