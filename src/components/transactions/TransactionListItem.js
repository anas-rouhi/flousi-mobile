import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { categoryGlyph } from "../../constants/categoryIcons";
import { colors, fontSizes, radii, spacing } from "../../constants/theme";
import { formatMoney } from "../../utils/money";

/** Transfers are neither a gain nor a loss, so they get their own colour. */
function directionFor(type) {
  if (type === "income") {
    return { color: colors.income, sign: "+" };
  }
  if (type === "transfer") {
    return { color: colors.transfer, sign: "" };
  }
  return { color: colors.expense, sign: "-" };
}

/**
 * One row of transaction history. Tapping opens the detail/delete sheet — a
 * press target rather than a swipe, because a swipe gesture inside a vertical
 * list is easy to trigger by accident and this action deletes money records.
 */
export default function TransactionListItem({
  transaction,
  onPress,
  deleting = false,
  isLast = false,
}) {
  const { color, sign } = directionFor(transaction.type);
  const category = transaction.category;

  const title = transaction.description || category?.name || "معاملة";
  const meta = [
    transaction.description ? category?.name : null,
    transaction.account?.name,
    // Transfers name where the money went, which is the point of the row.
    transaction.destination_account?.name
      ? `→ ${transaction.destination_account.name}`
      : null,
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <TouchableOpacity
      style={[styles.row, isLast && styles.rowLast]}
      onPress={() => onPress?.(transaction)}
      activeOpacity={0.6}
      disabled={deleting}
    >
      <View
        style={[
          styles.glyphWrap,
          { backgroundColor: (category?.color || colors.textMuted) + "1A" },
        ]}
      >
        {deleting ? (
          <ActivityIndicator size="small" color={colors.dangerText} />
        ) : (
          <Text style={styles.glyph}>{categoryGlyph(category?.icon)}</Text>
        )}
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {meta ? (
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>

      <Text style={[styles.amount, { color }]}>
        {sign}
        {formatMoney(transaction, transaction.currency)}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  rowLast: { borderBottomWidth: 0 },

  glyphWrap: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: spacing.md,
  },
  glyph: { fontSize: 18 },

  body: { flex: 1 },
  title: {
    fontSize: fontSizes.bodyLarge,
    fontWeight: "600",
    color: colors.text,
    textAlign: "right",
  },
  meta: {
    fontSize: fontSizes.small,
    color: colors.textMuted,
    marginTop: 3,
    textAlign: "right",
  },
  amount: {
    fontSize: fontSizes.bodyLarge,
    fontWeight: "bold",
    marginRight: spacing.sm,
  },
});
