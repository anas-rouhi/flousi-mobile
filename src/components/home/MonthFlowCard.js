import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Card, CardHeader, CardHeaderMeta } from "../ui/Card";
import { fontSizes, radii, spacing } from "../../constants/theme";
import { useTheme, useThemedStyles } from "../../context/ThemeContext";
import { monthLabel } from "../../utils/date";
import { centimesOf, formatMoney } from "../../utils/money";

/**
 * How the month is going: the income-to-expense split as a bar, the net, and
 * the savings rate.
 *
 * The income and expense *figures* live on BalanceCard — repeating them here
 * would show the same two numbers twice on one screen — so this card carries
 * only what the numbers alone do not convey.
 */
export default function MonthFlowCard({ month, period, currency }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const net = centimesOf(month?.net);
  const hasSavingsRate =
    month?.savings_rate !== null && month?.savings_rate !== undefined;

  return (
    <Card>
      <CardHeader
        title="حركة هذا الشهر"
        meta={<CardHeaderMeta>{monthLabel(period)}</CardHeaderMeta>}
      />

      <FlowBar income={month?.income} expenses={month?.expenses} />

      <View style={styles.legend}>
        <LegendDot color={colors.income} label="مدخول" />
        <LegendDot color={colors.expense} label="مصاريف" />
      </View>

      <View style={styles.netRow}>
        <Text style={styles.netLabel}>الصافي</Text>
        <Text
          style={[
            styles.netValue,
            { color: net < 0 ? colors.expense : colors.primary },
          ]}
        >
          {formatMoney(month?.net, currency)}
        </Text>
      </View>

      {hasSavingsRate ? (
        <Text style={styles.savings}>نسبة التوفير: {month.savings_rate}%</Text>
      ) : (
        <Text style={styles.savingsMuted}>ما كاينش مدخول هذا الشهر</Text>
      )}
    </Card>
  );
}

/** Proportional bar, sized from the authoritative centime integers. */
function FlowBar({ income, expenses }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const incomeCentimes = centimesOf(income);
  const expenseCentimes = centimesOf(expenses);
  const total = incomeCentimes + expenseCentimes;

  if (total <= 0) {
    return <View style={styles.track} />;
  }

  const incomeShare = (incomeCentimes / total) * 100;

  return (
    <View style={styles.track}>
      <View
        style={[
          styles.segment,
          { width: `${incomeShare}%`, backgroundColor: colors.income },
        ]}
      />
      <View
        style={[
          styles.segment,
          { width: `${100 - incomeShare}%`, backgroundColor: colors.expense },
        ]}
      />
    </View>
  );
}

function LegendDot({ color, label }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
  track: {
    flexDirection: "row",
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.track,
    overflow: "hidden",
  },
  segment: { height: "100%" },

  legend: {
    flexDirection: "row",
    marginTop: spacing.md,
    gap: spacing.lg,
  },
  legendItem: { flexDirection: "row", alignItems: "center" },
  legendSwatch: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
    marginStart: 6,
  },
  legendLabel: { fontSize: fontSizes.small, color: colors.textSecondary },

  netRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
  },
  netLabel: { fontSize: fontSizes.body, color: colors.textSecondary },
  netValue: { fontSize: fontSizes.subtitle, fontWeight: "bold" },

  savings: {
    fontSize: fontSizes.meta,
    color: colors.primary,
    marginTop: spacing.sm,
    textAlign: "auto",
  },
  savingsMuted: {
    fontSize: fontSizes.meta,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: "auto",
  },
});
