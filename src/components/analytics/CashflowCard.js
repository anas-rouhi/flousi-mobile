import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Card, CardHeader } from "../ui/Card";
import { fontSizes, radii, spacing } from "../../constants/theme";
import { useTheme, useThemedStyles } from "../../context/ThemeContext";
import { useI18n } from "../../i18n";
import { ltr } from "../../utils/bidi";

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
  const { t } = useI18n();
  const net = summary?.net_savings ?? 0;
  const netColor = net < 0 ? colors.expense : colors.primary;
  const rate = summary?.savings_rate_percentage;

  return (
    <Card>
      <CardHeader title={t("analytics.cashflow")} />

      <View style={styles.row}>
        <Figure
          label={t("analytics.income")}
          value={ltr(summary?.total_income_formatted)}
          color={colors.income}
        />
        <View style={styles.divider} />
        <Figure
          label={t("analytics.expenses")}
          value={ltr(summary?.total_expense_formatted)}
          color={colors.expense}
          align="flex-end"
        />
      </View>

      <View style={styles.netRow}>
        <Text style={styles.netLabel}>{t("analytics.net")}</Text>
        <View style={styles.netValueWrap}>
          <Text style={[styles.netValue, { color: netColor }]}>
            {ltr(summary?.net_savings_formatted) ?? "—"}
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
                {t("analytics.savings_pill", { rate: ltr(`${rate}%`) })}
              </Text>
            </View>
          )}
        </View>
      </View>

      {rate === null || rate === undefined ? (
        <Text style={styles.muted}>{t("analytics.no_income")}</Text>
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
  row: { flexDirection: "row", alignItems: "center" },
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
  },
  netLabel: { fontSize: fontSizes.body, color: colors.textSecondary },
  netValueWrap: { flexDirection: "row", alignItems: "center" },
  netValue: { fontSize: fontSizes.subtitle, fontWeight: "bold" },
  ratePill: {
    borderRadius: radii.pill,
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    marginEnd: spacing.sm,
  },
  rateText: { fontSize: fontSizes.caption, fontWeight: "bold" },

  muted: {
    fontSize: fontSizes.meta,
    color: colors.textMuted,
    textAlign: "auto",
    marginTop: spacing.sm,
  },
});
