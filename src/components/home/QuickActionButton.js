import React from "react";
import { Text, StyleSheet, TouchableOpacity } from "react-native";
import { shadows } from "../../constants/theme";
import { useThemedStyles } from "../../context/ThemeContext";
import { useI18n } from "../../i18n";

/**
 * The floating primary action. Pinned bottom-right by the screen that hosts it,
 * which must be `position: relative` or a flex parent — the button positions
 * itself absolutely within that parent.
 */
export default function QuickActionButton({ onPress, label, style }) {
  const styles = useThemedStyles(createStyles);
  const { t } = useI18n();
  return (
    <TouchableOpacity
      style={[styles.fab, style]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label ?? t("home.add_transaction")}
    >
      <Text style={styles.icon}>＋</Text>
    </TouchableOpacity>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
  fab: {
    position: "absolute",
    bottom: 28,
    end: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.floating,
  },
  icon: {
    color: colors.onPrimary,
    fontSize: 30,
    fontWeight: "bold",
    lineHeight: 34,
  },
});
