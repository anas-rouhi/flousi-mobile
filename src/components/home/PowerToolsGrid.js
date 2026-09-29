import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { fontSizes, radii, spacing } from "../../constants/theme";
import { useTheme, useThemedStyles } from "../../context/ThemeContext";
import { useI18n } from "../../i18n";
import { tapFeedback } from "../../utils/haptics";

/** Accent per tool; the tile tints its glyph badge with it in both themes. */
const TOOLS = [
  { key: "scan", glyph: "🧾", accent: "#10B981" },
  { key: "pdf", glyph: "📄", accent: "#3B82F6" },
  { key: "split", glyph: "🍕", accent: "#F59E0B" },
  { key: "fx", glyph: "💱", accent: "#8B5CF6" },
];

/**
 * The Power Tools hub: a 2×2 grid of shortcuts.
 *
 * @param {{ onOpen: (key: "scan"|"pdf"|"split"|"fx") => void }} props
 */
export default function PowerToolsGrid({ onOpen }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useI18n();

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>{t("power_tools.title")}</Text>
      <View style={styles.grid}>
        {TOOLS.map((tool) => (
          <TouchableOpacity
            key={tool.key}
            style={styles.tile}
            onPress={() => {
              tapFeedback();
              onOpen?.(tool.key);
            }}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t(`power_tools.${tool.key}.title`)}
          >
            {/* An 8-digit hex keeps the accent's hue at low opacity. */}
            <View style={[styles.badge, { backgroundColor: `${tool.accent}${colors.isDark ? "33" : "1F"}` }]}>
              <Text style={styles.glyph}>{tool.glyph}</Text>
            </View>
            <Text style={styles.title} numberOfLines={1}>
              {t(`power_tools.${tool.key}.title`)}
            </Text>
            <Text style={styles.sub} numberOfLines={2}>
              {t(`power_tools.${tool.key}.sub`)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    wrap: { marginTop: spacing.lg },
    heading: {
      fontSize: fontSizes.subtitle,
      fontWeight: "bold",
      color: colors.text,
      textAlign: "auto",
      marginBottom: spacing.md,
    },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
    tile: {
      // Two per row with the gap between them.
      width: "47.5%",
      flexGrow: 1,
      backgroundColor: colors.surface,
      borderRadius: radii.xl,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
    },
    badge: {
      width: 42,
      height: 42,
      borderRadius: radii.md,
      alignItems: "center",
      justifyContent: "center",
    },
    glyph: { fontSize: 22 },
    title: {
      fontSize: fontSizes.body,
      fontWeight: "800",
      color: colors.text,
      textAlign: "auto",
      marginTop: spacing.md,
    },
    sub: {
      fontSize: fontSizes.small,
      color: colors.textMuted,
      textAlign: "auto",
      marginTop: 2,
      lineHeight: 16,
    },
  });
