import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { fontSizes, radii, spacing } from "../../constants/theme";
import { useTheme, useThemedStyles } from "../../context/ThemeContext";
import { BUDGET_STATE } from "../../hooks/useBudget";
import { useI18n } from "../../i18n";
import { isolate, ltr } from "../../utils/bidi";
import { categoryName } from "../../utils/categories";
import { formatCentimes } from "../../utils/money";

/** Whole days left in the current month, today not counted. */
function daysLeftInMonth(now = new Date()) {
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return Math.max(lastDay - now.getDate(), 0);
}

/**
 * One line of read-through on the month's numbers.
 *
 * Deliberately a single insight, not a feed: the value is that the user glances
 * once and learns something, which a stack of three competing tips destroys.
 * Priority runs by urgency — an exceeded budget, then one about to be, then a
 * savings rate worth praising, then where the money actually went. With no
 * figures to talk about yet (a fresh account), the card renders nothing rather
 * than padding the dashboard with a platitude.
 */
function pickInsight({ stats, budget, currency, t }) {
  const days = daysLeftInMonth();
  const daysPhrase = t("home.insight.days_left", { count: days });

  if (budget?.hasBudget) {
    if (budget.state === BUDGET_STATE.over) {
      return {
        tone: "danger",
        text: t("home.insight.budget_over", {
          amount: formatCentimes(
            Math.abs(budget.remainingCentimes),
            budget.currency || currency,
          ),
        }),
      };
    }
    if (budget.percentage >= 80) {
      return {
        tone: "warning",
        text: t("home.insight.budget_warning", {
          percent: ltr(`${Math.round(budget.percentage)}%`),
          days: daysPhrase,
        }),
      };
    }
  }

  const rate = stats?.month?.savings_rate;
  if (Number.isFinite(rate) && rate >= 20) {
    return {
      tone: "success",
      text: t("home.insight.savings", { rate: ltr(`${Math.round(rate)}%`) }),
    };
  }

  const top = stats?.categories?.[0];
  if (top && Number.isFinite(top.percentage)) {
    return {
      tone: "info",
      text: t("home.insight.top_category", {
        category: isolate(categoryName(top, top.category_id)),
        share: ltr(`${Math.round(top.percentage)}%`),
      }),
    };
  }

  return null;
}

export default function SmartInsightCard({ stats, budget, currency = "MAD" }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useI18n();

  const insight = pickInsight({ stats, budget, currency, t });
  if (!insight) {
    return null;
  }

  const accent = {
    danger: colors.budgetOver,
    warning: colors.budgetWarning,
    success: colors.primary,
    info: colors.mint,
  }[insight.tone];

  return (
    <View
      style={[styles.card, { borderStartColor: accent }]}
      accessibilityRole="summary"
    >
      <Text style={styles.text}>{insight.text}</Text>
    </View>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    /**
     * Flatter than the cards around it, and marked by one coloured edge rather
     * than a fill: it is a note about the figures, not another figure.
     */
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.md,
      borderStartWidth: 3,
      paddingVertical: 14,
      paddingHorizontal: spacing.lg,
      marginTop: spacing.lg,
    },
    text: {
      fontSize: fontSizes.meta,
      lineHeight: 22,
      color: colors.textSecondary,
      textAlign: "auto",
    },
  });
