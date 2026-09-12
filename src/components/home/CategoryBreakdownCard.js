import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Card, CardHeader } from "../ui/Card";
import { categoryGlyph } from "../../constants/categoryIcons";
import { colors, fontSizes, spacing } from "../../constants/theme";
import { formatMoney } from "../../utils/money";

const TOP_CATEGORIES = 5;

/** Where the month's expenses went, largest first. */
export default function CategoryBreakdownCard({ categories = [], currency }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? categories : categories.slice(0, TOP_CATEGORIES);

  return (
    <Card>
      <CardHeader
        title="المصاريف حسب الفئة"
        meta={
          categories.length > TOP_CATEGORIES ? (
            <TouchableOpacity onPress={() => setShowAll((shown) => !shown)}>
              <Text style={styles.link}>
                {showAll ? "أقل" : `الكل (${categories.length})`}
              </Text>
            </TouchableOpacity>
          ) : null
        }
      />

      {categories.length === 0 ? (
        <Text style={styles.empty}>ما كاينش مصاريف هذا الشهر</Text>
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
  // `percentage` is computed server-side against the month's total expenses.
  const share = Number.isFinite(category.percentage) ? category.percentage : 0;
  const color = category.color || colors.textMuted;

  return (
    <View style={styles.row}>
      <View style={styles.header}>
        <View style={styles.identity}>
          <Text style={styles.glyph}>{categoryGlyph(category.icon)}</Text>
          <Text style={styles.name} numberOfLines={1}>
            {category.name}
          </Text>
        </View>
        <Text style={styles.amount}>{formatMoney(category, currency)}</Text>
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
        {share}% • {category.transactions_count} معاملة
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
  header: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  identity: {
    flexDirection: "row-reverse",
    alignItems: "center",
    flexShrink: 1,
  },
  glyph: { fontSize: 15, marginLeft: 7 },
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
    marginRight: spacing.sm,
  },

  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.track,
    overflow: "hidden",
    flexDirection: "row-reverse",
  },
  fill: { height: "100%", borderRadius: 4 },
  meta: {
    fontSize: fontSizes.small,
    color: colors.textMuted,
    marginTop: 6,
    textAlign: "right",
  },
});
