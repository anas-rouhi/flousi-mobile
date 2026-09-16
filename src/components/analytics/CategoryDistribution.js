import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Card, CardHeader, CardHeaderMeta } from "../ui/Card";
import { categoryGlyph } from "../../constants/categoryIcons";
import { fontSizes, radii, spacing } from "../../constants/theme";
import { useTheme, useThemedStyles } from "../../context/ThemeContext";
import { useI18n } from "../../i18n";
import { ltr } from "../../utils/bidi";
import { categoryName } from "../../utils/categories";

/**
 * Where the month's expenses went, largest first.
 *
 * The API already sorts by spend and computes each percentage, so the top row
 * is simply the first one — it gets a highlight rather than being recomputed.
 * Money uses the `spent_formatted` strings; `spent` centimes stay untouched.
 */
export default function CategoryDistribution({ categories = [] }) {
  const styles = useThemedStyles(createStyles);
  const { t } = useI18n();
  const top = categories[0];

  return (
    <Card>
      <CardHeader
        title={t("analytics.distribution_title")}
        meta={
          categories.length ? (
            <CardHeaderMeta>
              {t("common.categories_count", { count: categories.length })}
            </CardHeaderMeta>
          ) : null
        }
      />

      {categories.length === 0 ? (
        <Text style={styles.empty}>{t("analytics.distribution_empty")}</Text>
      ) : (
        <>
          {/* The headline answer, called out before the full list. */}
          <View style={styles.topBanner}>
            <Text style={styles.topLabel}>{t("analytics.top_category")}</Text>
            <View style={styles.topRow}>
              <Text style={styles.topGlyph}>{categoryGlyph(top.icon)}</Text>
              <Text style={styles.topName} numberOfLines={1}>
                {categoryName(top)}
              </Text>
              <Text style={styles.topAmount}>{ltr(top.spent_formatted)}</Text>
            </View>
          </View>

          {categories.map((category, index) => (
            <CategoryRow
              key={category.id ?? `row-${index}`}
              category={category}
              isTop={index === 0}
            />
          ))}
        </>
      )}
    </Card>
  );
}

function CategoryRow({ category, isTop }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useI18n();
  const share = Number.isFinite(category.percentage) ? category.percentage : 0;
  const color = category.color || colors.textMuted;

  return (
    <View style={styles.row}>
      <View style={styles.head}>
        <View style={styles.identity}>
          <Text style={styles.glyph}>{categoryGlyph(category.icon)}</Text>
          <Text
            style={[styles.name, isTop && styles.nameTop]}
            numberOfLines={1}
          >
            {categoryName(category)}
          </Text>
        </View>

        <View style={styles.amounts}>
          <View style={[styles.pill, { backgroundColor: color + "1A" }]}>
            <Text style={[styles.pillText, { color }]}>
              {ltr(`${Math.round(share)}%`)}
            </Text>
          </View>
          <Text style={styles.amount}>{ltr(category.spent_formatted)}</Text>
        </View>
      </View>

      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${Math.min(Math.max(share, 0), 100)}%`, backgroundColor: color },
          ]}
        />
      </View>

      <Text style={styles.meta}>
        {t("common.transactions_count", {
          count: category.transactions_count ?? 0,
        })}
      </Text>
    </View>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
  empty: {
    color: colors.textSecondary,
    textAlign: "center",
    marginVertical: spacing.lg,
  },

  topBanner: {
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  topLabel: {
    fontSize: fontSizes.caption,
    fontWeight: "700",
    color: colors.primary,
    textAlign: "auto",
    marginBottom: 6,
  },
  topRow: { flexDirection: "row", alignItems: "center" },
  topGlyph: { fontSize: 20, marginStart: spacing.sm },
  topName: {
    flex: 1,
    fontSize: fontSizes.bodyLarge,
    fontWeight: "bold",
    color: colors.text,
    textAlign: "auto",
  },
  topAmount: {
    fontSize: fontSizes.bodyLarge,
    fontWeight: "bold",
    color: colors.primary,
  },

  row: { marginBottom: spacing.lg },
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
  },
  glyph: { fontSize: 15, marginStart: 7 },
  name: {
    fontSize: fontSizes.body,
    fontWeight: "600",
    color: colors.text,
    flexShrink: 1,
  },
  nameTop: { fontWeight: "bold" },

  amounts: { flexDirection: "row", alignItems: "center" },
  pill: {
    borderRadius: radii.pill,
    paddingVertical: 2,
    paddingHorizontal: 7,
    marginStart: spacing.sm,
  },
  pillText: { fontSize: fontSizes.caption, fontWeight: "bold" },
  amount: {
    fontSize: fontSizes.body,
    fontWeight: "bold",
    color: colors.text,
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
