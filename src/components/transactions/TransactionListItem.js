import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { categoryGlyph } from "../../constants/categoryIcons";
import { fontSizes, radii, spacing } from "../../constants/theme";
import { useTheme, useThemedStyles } from "../../context/ThemeContext";
import { useI18n } from "../../i18n";
import { joinMeta } from "../../utils/bidi";
import { categoryName } from "../../utils/categories";
import { formatSignedMoney } from "../../utils/money";
import { isRTL } from "../../utils/rtl";

/** Transfers are neither a gain nor a loss, so they get their own colour. */
function directionFor(type, colors) {
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
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useI18n();
  const { color, sign } = directionFor(transaction.type, colors);
  const category = transaction.category;
  const categoryLabel = categoryName(category, transaction.category_id);

  const title =
    transaction.description || categoryLabel || t("common.transaction_fallback");
  const meta = joinMeta([
    transaction.description ? categoryLabel : null,
    transaction.account?.name,
    // Transfers name where the money went, which is the point of the row.
    // U+2192 is not auto-mirrored by bidi, so the glyph is chosen by direction
    // rather than flipped in a transform (it sits inside a joined string).
    transaction.destination_account?.name
      ? `${isRTL() ? "←" : "→"} ${transaction.destination_account.name}`
      : null,
  ]);

  // The sign goes inside the amount's LTR isolate. Rendered as a sibling in
  // front of it, an RTL line put the minus after the currency: "15,50 DH-".
  const amount = formatSignedMoney(transaction, transaction.currency, sign);

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

      <Text style={[styles.amount, { color }]}>{amount}</Text>
    </TouchableOpacity>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
  row: {
    flexDirection: "row",
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
    marginStart: spacing.md,
  },
  glyph: { fontSize: 18 },

  body: { flex: 1 },
  title: {
    fontSize: fontSizes.bodyLarge,
    fontWeight: "600",
    color: colors.text,
    textAlign: "auto",
  },
  meta: {
    fontSize: fontSizes.small,
    color: colors.textMuted,
    marginTop: 3,
    textAlign: "auto",
  },
  amount: {
    fontSize: fontSizes.bodyLarge,
    fontWeight: "bold",
    marginEnd: spacing.sm,
  },
});
