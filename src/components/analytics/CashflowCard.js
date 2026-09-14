import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Card, CardHeader } from "../ui/Card";
import { fontSizes, radii, spacing } from "../../constants/theme";
import { useTheme, useThemedStyles } from "../../context/ThemeContext";

/**
 * Income, expense and the net between them.
 *
 * All three figures use the API's `*_formatted` strings. Note the analytics
 * endpoint returns money as a flat integer plus a sibling string, not the
 * `{ amount, amount_formatted }` object the dashboard uses.
 */
export default function CashflowCard({ summary }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const net = summary?.net_savings ?? 0;
  const netColor = net < 0 ? colors.expense : colors.primary;
  const rate = summary?.savings_rate_percentage;

  return (
    <Card>
      <CardHeader title="الحركة المالية" />

      <View style={styles.row}>
        <Figure
          label="المداخيل"
          value={summary?.total_income_formatted}
          color={colors.income}
        />
        <View style={styles.divider} />
        <Figure
          label="المصاريف"
          value={summary?.total_expense_formatted}
          color={colors.expense}
          align="flex-end"
        />
      </View>

      <View style={styles.netRow}>
        <Text style={styles.netLabel}>الصافي</Text>
        <View style={styles.netValueWrap}>
          <Text style={[styles.netValue, { color: netColor }]}>
            {summary?.net_savings_formatted ?? "—"}
          </Text>
          {rate === null || rate === undefined ? null : (
            <View
              style={[
                styles.ratePill,
                {
                  backgroundColor:
                    rate < 0 ? colors.dangerSurface : colors.primarySoft,
                },
              ]}
            >
              <Text style={[styles.rateText, { color: netColor }]}>
                توفير {rate}%
              </Text>
            </View>
          )}
        </View>
      </View>

      {rate === null || rate === undefined ? (
        <Text style={styles.muted}>ما كاينش مدخول هاد الشهر</Text>
      ) : null}
    </Card>
  );
}

function Figure({ label, value, color, align = "flex-start" }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={[styles.figure, { alignItems: align }]}>
      <Text style={styles.figureLabel}>{label}</Text>
      <Text style={[styles.figureValue, { color }]}>{value ?? "—"}</Text>
    </View>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
  row: { flexDirection: "row-reverse", alignItems: "center" },
  figure: { flex: 1 },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    backgroundColor: colors.divider,
    marginHorizontal: spacing.md,
  },
  figureLabel: { fontSize: fontSizes.small, color: colors.textSecondary },
  figureValue: {
    fontSize: fontSizes.subtitle,
    fontWeight: "bold",
    marginTop: spacing.xs,
  },

  netRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
  },
  netLabel: { fontSize: fontSizes.body, color: colors.textSecondary },
  netValueWrap: { flexDirection: "row-reverse", alignItems: "center" },
  netValue: { fontSize: fontSizes.subtitle, fontWeight: "bold" },
  ratePill: {
    borderRadius: radii.pill,
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    marginRight: spacing.sm,
  },
  rateText: { fontSize: fontSizes.caption, fontWeight: "bold" },

  muted: {
    fontSize: fontSizes.meta,
    color: colors.textMuted,
    textAlign: "right",
    marginTop: spacing.sm,
  },
});
