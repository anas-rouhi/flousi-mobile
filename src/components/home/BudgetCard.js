import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Card, CardHeader } from "../ui/Card";
import { colors, fontSizes, radii, spacing } from "../../constants/theme";
import { BUDGET_STATE } from "../../hooks/useBudget";
import { MONTH_NAMES } from "../../utils/date";
import { formatCentimes } from "../../utils/money";

/** Bar and accent colour per budget state. */
const STATE_COLORS = {
  [BUDGET_STATE.healthy]: colors.budgetHealthy,
  [BUDGET_STATE.warning]: colors.budgetWarning,
  [BUDGET_STATE.over]: colors.budgetOver,
};

/** "2026-09" => "شتنبر". Falls back to the raw label if it is not a month. */
function monthName(period) {
  const raw = period?.month;
  if (typeof raw !== "string") {
    return "";
  }
  const [, month] = raw.split("-");
  return MONTH_NAMES[Number(month) - 1] || raw;
}

/**
 * Monthly budget tracker.
 *
 * Two states: an invitation when no limit is set, and the progress view once
 * one is. The bar's colour is the fastest signal on the screen, so it is driven
 * by the same thresholds the hook reports rather than recomputed here.
 */
export default function BudgetCard({
  hasBudget,
  limitCentimes,
  spentCentimes,
  remainingCentimes,
  percentage,
  state,
  period,
  currency = "MAD",
  loading,
  onSetBudget,
}) {
  // ---- State A: nothing configured yet ----
  if (!hasBudget) {
    return (
      <Card style={styles.emptyCard}>
        {loading ? (
          <ActivityIndicator color={colors.primary} size="small" />
        ) : (
          <>
            <Text style={styles.emptyTitle}>
              مازال ما حددتي ميزانية هاد الشهر
            </Text>
            <Text style={styles.emptyBody}>
              حدد سقف للمصاريف وتبّع بشحال باقي ليك نهار بنهار.
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={onSetBudget}
              activeOpacity={0.85}
            >
              <Text style={styles.emptyButtonText}>حدد الميزانية</Text>
            </TouchableOpacity>
          </>
        )}
      </Card>
    );
  }

  // ---- State B: active budget ----
  const accent = STATE_COLORS[state] || colors.budgetHealthy;
  const overspent = remainingCentimes < 0;
  const rounded = Math.round(percentage);

  return (
    <Card>
      <CardHeader
        title={`ميزانية ${monthName(period)}`.trim()}
        meta={
          <TouchableOpacity
            onPress={onSetBudget}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="بدل الميزانية"
          >
            {/* Pencil: the app has no icon font, so the glyph carries it. */}
            <Text style={styles.editIcon}>✏️</Text>
          </TouchableOpacity>
        }
      />

      <View style={styles.amountRow}>
        <Text style={[styles.spent, { color: accent }]}>
          {formatCentimes(spentCentimes, currency)}
        </Text>
        <Text style={styles.limit}>
          {" "}
          / {formatCentimes(limitCentimes, currency)}
        </Text>
      </View>

      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            // The bar stops at full width; the overspend is stated in words
            // beneath rather than drawn as an impossible bar.
            { width: `${Math.min(Math.max(percentage, 0), 100)}%`, backgroundColor: accent },
          ]}
        />
      </View>

      <View style={styles.footer}>
        <Text style={[styles.percentage, { color: accent }]}>{rounded}%</Text>

        {overspent ? (
          <Text style={[styles.remaining, { color: colors.budgetOver }]}>
            فتيها بـ {formatCentimes(Math.abs(remainingCentimes), currency)}
          </Text>
        ) : (
          <Text style={styles.remaining}>
            باقي ليك {formatCentimes(remainingCentimes, currency)}
          </Text>
        )}
      </View>

      {state === BUDGET_STATE.over ? (
        <View style={[styles.banner, { backgroundColor: colors.budgetOverSurface }]}>
          <Text style={[styles.bannerText, { color: colors.budgetOver }]}>
            فتي الميزانية!
          </Text>
        </View>
      ) : state === BUDGET_STATE.warning ? (
        <View
          style={[styles.banner, { backgroundColor: colors.budgetWarningSurface }]}
        >
          <Text style={[styles.bannerText, { color: colors.budgetWarning }]}>
            قريب توصل للسقف — تسنّى فـ المصاريف
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  emptyCard: { alignItems: "center" },
  emptyTitle: {
    fontSize: fontSizes.bodyLarge,
    fontWeight: "bold",
    color: colors.text,
    textAlign: "center",
  },
  emptyBody: {
    fontSize: fontSizes.meta,
    lineHeight: 21,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 14,
  },
  emptyButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
  },
  emptyButtonText: {
    color: colors.onPrimary,
    fontSize: fontSizes.body,
    fontWeight: "bold",
  },

  editIcon: { fontSize: 16 },

  amountRow: {
    flexDirection: "row-reverse",
    alignItems: "baseline",
    marginBottom: spacing.md,
  },
  spent: { fontSize: fontSizes.heading, fontWeight: "bold" },
  limit: { fontSize: fontSizes.body, color: colors.textMuted },

  track: {
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.track,
    overflow: "hidden",
    flexDirection: "row-reverse",
  },
  fill: { height: "100%", borderRadius: 6 },

  footer: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.sm,
  },
  percentage: { fontSize: fontSizes.meta, fontWeight: "bold" },
  remaining: { fontSize: fontSizes.meta, color: colors.textSecondary },

  banner: {
    borderRadius: radii.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  bannerText: {
    fontSize: fontSizes.meta,
    fontWeight: "bold",
    textAlign: "center",
  },
});
