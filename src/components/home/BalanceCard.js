import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { fontSizes, radii, shadows, spacing } from "../../constants/theme";
import { useThemedStyles } from "../../context/ThemeContext";
import { formatMoney, formatSignedMoney } from "../../utils/money";

/**
 * The emerald hero: total available balance, with this month's income and
 * expenses beneath it.
 *
 * Accounts held in other currencies are listed separately rather than summed
 * into the headline — adding MAD to EUR would produce a number that means
 * nothing. That split comes from the API, which reports the primary currency
 * total and the rest apart.
 */
export default function BalanceCard({ balance, month, currency }) {
  const styles = useThemedStyles(createStyles);
  const otherCurrencies = balance?.other_currencies || [];

  return (
    <View style={styles.card}>
      <Text style={styles.label}>الرصيد الإجمالي المتوفر</Text>
      <Text style={styles.value}>{formatMoney(balance, currency)}</Text>
      <Text style={styles.meta}>
        {balance?.accounts_count || 0} حساب • {currency}
      </Text>

      {/* Month flows, so the headline figure has context without a tap. */}
      <View style={styles.flows}>
        <Flow
          label="مدخول هاد الشهر"
          value={formatSignedMoney(month?.income, currency, "+")}
        />
        <View style={styles.flowDivider} />
        <Flow
          label="مصاريف هاد الشهر"
          value={formatSignedMoney(month?.expenses, currency, "-")}
          align="flex-end"
        />
      </View>

      {otherCurrencies.length ? (
        <View style={styles.otherCurrencies}>
          <Text style={styles.otherCurrenciesLabel}>عملات أخرى</Text>
          {otherCurrencies.map((row) => (
            <View key={row.currency} style={styles.otherCurrencyRow}>
              <Text style={styles.otherCurrencyAmount}>
                {formatMoney(row, row.currency)}
              </Text>
              <Text style={styles.otherCurrencyMeta}>
                {row.accounts_count} حساب
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Flow({ label, value, align = "flex-start" }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={[styles.flow, { alignItems: align }]}>
      <Text style={styles.flowLabel}>{label}</Text>
      <Text style={styles.flowValue}>{value}</Text>
    </View>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
  card: {
    backgroundColor: colors.primary,
    borderRadius: radii.xxl,
    padding: spacing.xxl,
    ...shadows.raised,
  },
  label: {
    color: colors.onPrimaryMuted,
    fontSize: fontSizes.body,
    textAlign: "auto",
  },
  value: {
    color: colors.onPrimary,
    fontSize: fontSizes.display,
    fontWeight: "bold",
    marginTop: spacing.sm,
    textAlign: "auto",
  },
  meta: {
    color: colors.onPrimaryFaint,
    fontSize: fontSizes.small,
    marginTop: 6,
    textAlign: "auto",
  },

  flows: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.onPrimaryDivider,
    marginTop: spacing.lg,
    paddingTop: 14,
  },
  flow: { flex: 1 },
  flowDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    backgroundColor: colors.onPrimaryDivider,
    marginHorizontal: spacing.md,
  },
  flowLabel: { color: colors.onPrimaryMuted, fontSize: fontSizes.small },
  flowValue: {
    color: colors.onPrimary,
    fontSize: fontSizes.bodyLarge,
    fontWeight: "bold",
    marginTop: spacing.xs,
  },

  otherCurrencies: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.onPrimaryDivider,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
  },
  otherCurrenciesLabel: {
    color: colors.onPrimaryMuted,
    fontSize: fontSizes.small,
    marginBottom: 6,
    textAlign: "auto",
  },
  otherCurrencyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.xs,
  },
  otherCurrencyAmount: {
    color: colors.onPrimary,
    fontSize: fontSizes.bodyLarge,
    fontWeight: "600",
  },
  otherCurrencyMeta: {
    color: colors.onPrimaryFaint,
    fontSize: fontSizes.small,
  },
});
