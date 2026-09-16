import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Card, CardHeader, CardHeaderMeta } from "../ui/Card";
import { categoryGlyph } from "../../constants/categoryIcons";
import { fontSizes, radii, spacing } from "../../constants/theme";
import { useTheme, useThemedStyles } from "../../context/ThemeContext";
import { useI18n } from "../../i18n";
import { joinMeta } from "../../utils/bidi";
import { categoryName } from "../../utils/categories";
import { formatTransactionDate, zonedDayKey } from "../../utils/date";
import { formatSignedMoney } from "../../utils/money";

/**
 * Recent activity, grouped under day headings (today / yesterday / a date).
 *
 * Grouping keys come from `zonedDayKey`, which resolves the day in the *user's*
 * timezone rather than the device's — otherwise a late-night entry lands under
 * the wrong heading for anyone travelling. The API already returns the rows
 * newest-first, so the groups keep that order without re-sorting.
 */
export default function RecentTransactionsList({ transactions = [], timezone }) {
  const styles = useThemedStyles(createStyles);
  const { t, language } = useI18n();
  const groups = useMemo(() => {
    const byDay = new Map();

    for (const transaction of transactions) {
      const key =
        zonedDayKey(transaction.transaction_date, timezone) ?? "unknown";

      if (!byDay.has(key)) {
        byDay.set(key, {
          key,
          label: formatTransactionDate(transaction.transaction_date, timezone),
          rows: [],
        });
      }
      byDay.get(key).rows.push(transaction);
    }

    return [...byDay.values()];
    // `language` re-labels the day headings when the language changes.
  }, [transactions, timezone, language]);

  return (
    <Card>
      <CardHeader
        title={t("home.recent_transactions")}
        meta={
          transactions.length ? (
            <CardHeaderMeta>
              {t("common.transactions_count", { count: transactions.length })}
            </CardHeaderMeta>
          ) : null
        }
      />

      {transactions.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{t("home.no_transactions")}</Text>
          <Text style={styles.emptySubtitle}>
            {t("home.no_transactions_hint")}
          </Text>
        </View>
      ) : (
        groups.map((group, groupIndex) => (
          <View
            key={group.key}
            style={groupIndex > 0 ? styles.groupSpaced : null}
          >
            {group.label ? (
              <Text style={styles.dayHeading}>{group.label}</Text>
            ) : null}

            {group.rows.map((transaction, index) => (
              <TransactionRow
                key={transaction.id ?? `${group.key}-${index}`}
                transaction={transaction}
                isLast={
                  index === group.rows.length - 1 &&
                  groupIndex === groups.length - 1
                }
              />
            ))}
          </View>
        ))
      )}
    </Card>
  );
}

function TransactionRow({ transaction, isLast }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useI18n();
  const isExpense = transaction.type === "expense";
  const color = isExpense ? colors.expense : colors.income;
  const category = transaction.category;

  // Each row formats in its own currency: the recent list spans every account,
  // so it can legitimately mix MAD and EUR.
  const amount = formatSignedMoney(
    transaction,
    transaction.currency,
    isExpense ? "-" : "+",
  );

  // Description is optional; the category name stands in, and is then dropped
  // from the meta line so it does not appear twice.
  const categoryLabel = categoryName(category, transaction.category_id);
  const title =
    transaction.description || categoryLabel || t("common.transaction_fallback");
  const meta = joinMeta([
    transaction.description ? categoryLabel : null,
    transaction.account?.name,
  ]);

  return (
    <View style={[styles.row, isLast && styles.rowLast]}>
      <View
        style={[
          styles.glyphWrap,
          { backgroundColor: (category?.color || colors.textMuted) + "1A" },
        ]}
      >
        <Text style={styles.glyph}>{categoryGlyph(category?.icon)}</Text>
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
    </View>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
  groupSpaced: { marginTop: spacing.lg },
  dayHeading: {
    fontSize: fontSizes.small,
    fontWeight: "700",
    color: colors.textMuted,
    textAlign: "auto",
    letterSpacing: 0.2,
    marginBottom: 6,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  rowLast: { borderBottomWidth: 0, paddingBottom: 0 },

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

  empty: { alignItems: "center", paddingVertical: spacing.xl },
  emptyTitle: {
    fontSize: fontSizes.bodyLarge,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  emptySubtitle: {
    fontSize: fontSizes.meta,
    color: colors.textFaint,
    marginTop: 6,
  },
});
