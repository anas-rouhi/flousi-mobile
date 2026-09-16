import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Card, CardHeader } from "../ui/Card";
import { categoryGlyph } from "../../constants/categoryIcons";
import { fontSizes, spacing } from "../../constants/theme";
import { useTheme, useThemedStyles } from "../../context/ThemeContext";
import { useI18n } from "../../i18n";
import { joinMeta, ltr } from "../../utils/bidi";
import { categoryName } from "../../utils/categories";
import { formatMoney } from "../../utils/money";

const TOP_CATEGORIES = 5;

/** Where the month's expenses went, largest first. */
export default function CategoryBreakdownCard({ categories = [], currency }) {
  const styles = useThemedStyles(createStyles);
  const { t } = useI18n();
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? categories : categories.slice(0, TOP_CATEGORIES);

  return (
    <Card>
      <CardHeader
        title={t("home.categories.title")}
        meta={
          categories.length > TOP_CATEGORIES ? (
            <TouchableOpacity onPress={() => setShowAll((shown) => !shown)}>
              <Text style={styles.link}>
                {showAll
                  ? t("home.categories.less")
                  : t("home.categories.all", { count: categories.length })}
              </Text>
            </TouchableOpacity>
          ) : null
        }
      />

      {categories.length === 0 ? (
        <Text style={styles.empty}>{t("home.categories.empty")}</Text>
      ) : (
        visible.map((category) => (
          <CategoryRow
            key={category.category_id ?? "uncategorized"}
            category={category}
            currency={currency}
          />
        ))
      )}
    </Card>
  );
}

function CategoryRow({ category, currency }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useI18n();
  // `percentage` is computed server-side against the month's total expenses.
  const share = Number.isFinite(category.percentage) ? category.percentage : 0;
  const color = category.color || colors.textMuted;

  return (
    <View style={styles.row}>
      <View style={styles.header}>
        <View style={styles.identity}>
          <Text style={styles.glyph}>{categoryGlyph(category.icon)}</Text>
          <Text style={styles.name} numberOfLines={1}>
            {categoryName(category, category.category_id)}
          </Text>
        </View>
        <Text style={styles.amount} numberOfLines={1}>
          {formatMoney(category, currency)}
        </Text>
      </View>

      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${Math.min(share, 100)}%`, backgroundColor: color },
          ]}
        />
      </View>

      <Text style={styles.meta}>
        {joinMeta([
          ltr(`${share}%`),
          t("common.transactions_count", {
            count: category.transactions_count ?? 0,
          }),
        ])}
      </Text>
    </View>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
  link: {
    fontSize: fontSizes.meta,
    color: colors.primary,
    fontWeight: "600",
  },
  empty: {
    color: colors.textSecondary,
    textAlign: "center",
    marginVertical: spacing.lg,
  },

  row: { marginBottom: spacing.lg },
  // `gap` keeps name and figure apart whatever the direction; the name gives
  // way first so the amount is never clipped or pushed into it.
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
    minWidth: 0,
    gap: 7,
  },
  glyph: { fontSize: 15 },
  name: {
    fontSize: fontSizes.bodyLarge,
    fontWeight: "600",
    color: colors.text,
    flexShrink: 1,
  },
  amount: {
    fontSize: fontSizes.bodyLarge,
    fontWeight: "bold",
    color: colors.text,
    flexShrink: 0,
    textAlign: "auto",
  },

  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.track,
    overflow: "hidden",
    flexDirection: "row",
  },
  fill: { height: "100%", borderRadius: 4 },
  meta: {
    fontSize: fontSizes.small,
    color: colors.textMuted,
    marginTop: 6,
    textAlign: "auto",
  },
});
