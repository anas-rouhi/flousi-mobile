import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, fontSizes, radii, shadows, spacing } from "../../constants/theme";

/**
 * The white content card every dashboard section sits in, and its RTL header
 * row. Extracted because four sections were each carrying an identical copy of
 * these styles — so a change to card padding meant four edits.
 */
export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/**
 * @param {{ title: string, meta?: React.ReactNode }} props `meta` is the
 *   trailing slot: a count, a month label, or a pressable "show all" link.
 */
export function CardHeader({ title, meta }) {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      {meta ?? null}
    </View>
  );
}

export function CardHeaderMeta({ children }) {
  return <Text style={styles.meta}>{children}</Text>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: 18,
    marginTop: spacing.lg,
    ...shadows.card,
  },
  header: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  title: {
    fontSize: fontSizes.subtitle,
    fontWeight: "bold",
    color: colors.text,
  },
  meta: { fontSize: fontSizes.meta, color: colors.textMuted },
});

export default Card;
