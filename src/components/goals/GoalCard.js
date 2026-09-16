import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { fontSizes, radii, shadows, spacing } from "../../constants/theme";
import { useTheme, useThemedStyles } from "../../context/ThemeContext";
import { useI18n } from "../../i18n";
import { joinMeta, ltr } from "../../utils/bidi";
import { formatLocalDay } from "../../utils/date";

/** "2027-03-15" as a local calendar day, or null. */
export function parseGoalDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  return match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : null;
}

/**
 * The deadline line: "3 months left", "Due 2 October 2026", "Deadline passed".
 *
 * `months_remaining` counts *whole* months, so it is also 0 for a date less
 * than a month away — the passed/not-passed call is made from the date itself.
 */
export function goalTiming(goal, t) {
  const date = parseGoalDate(goal?.target_date);
  if (!date) {
    return t("goals.no_deadline");
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date <= today) {
    // A reached goal is not "late", so it just keeps its date.
    return goal.is_completed
      ? t("goals.due", { date: formatLocalDay(date) })
      : t("goals.deadline_passed");
  }
  if (goal.months_remaining > 0) {
    return t("goals.months_left", { count: goal.months_remaining });
  }
  return t("goals.due", { date: formatLocalDay(date) });
}

/** Progress bar in the goal's colour, from the API's floored percentage. */
export function GoalProgress({ goal, height = 10 }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const percent = Math.min(Math.max(goal?.progress_percentage ?? 0, 0), 100);
  const color = goal?.is_completed ? colors.success : goal?.color || colors.primary;

  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }]}>
      <View
        style={[
          styles.fill,
          { width: `${percent}%`, backgroundColor: color, borderRadius: height / 2 },
        ]}
      />
    </View>
  );
}

/** Round glyph badge tinted with the goal's colour. */
export function GoalIcon({ goal, size = 44 }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const color = goal?.color || colors.primary;
  return (
    <View
      style={[
        styles.icon,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color + "22",
        },
      ]}
    >
      <Text style={{ fontSize: size * 0.48 }}>{goal?.icon || "🎯"}</Text>
    </View>
  );
}

export default function GoalCard({ goal, onPress }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useI18n();

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress?.(goal)}
      activeOpacity={0.75}
      accessibilityRole="button"
    >
      <View style={styles.head}>
        <GoalIcon goal={goal} />
        <View style={styles.headBody}>
          <Text style={styles.name} numberOfLines={1}>
            {goal.name}
          </Text>
          <Text style={styles.amounts} numberOfLines={1}>
            {t("goals.saved_of", {
              saved: ltr(goal.saved_amount_formatted),
              target: ltr(goal.target_amount_formatted),
            })}
          </Text>
        </View>
        {goal.is_completed ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{t("goals.completed")}</Text>
          </View>
        ) : (
          <Text style={[styles.percent, { color: goal.color || colors.primary }]}>
            {ltr(`${goal.progress_percentage ?? 0}%`)}
          </Text>
        )}
      </View>

      <GoalProgress goal={goal} />

      <Text style={styles.meta} numberOfLines={1}>
        {joinMeta([
          goal.is_completed
            ? null
            : t("goals.remaining", { amount: ltr(goal.remaining_formatted) }),
          goalTiming(goal, t),
        ])}
      </Text>
    </TouchableOpacity>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.xl,
      padding: 18,
      marginTop: spacing.lg,
      ...shadows.card,
    },
    head: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing.md,
    },
    icon: { alignItems: "center", justifyContent: "center" },
    headBody: { flex: 1, marginStart: spacing.md },
    name: {
      fontSize: fontSizes.subtitle,
      fontWeight: "bold",
      color: colors.text,
      textAlign: "auto",
    },
    amounts: {
      fontSize: fontSizes.meta,
      color: colors.textSecondary,
      marginTop: 2,
      textAlign: "auto",
    },
    percent: {
      fontSize: fontSizes.bodyLarge,
      fontWeight: "bold",
      marginStart: spacing.sm,
    },
    badge: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primaryBorder,
      borderWidth: 1,
      borderRadius: radii.pill,
      paddingVertical: 3,
      paddingHorizontal: spacing.sm,
      marginStart: spacing.sm,
    },
    badgeText: {
      fontSize: fontSizes.caption,
      fontWeight: "bold",
      color: colors.primary,
    },
    track: {
      backgroundColor: colors.track,
      overflow: "hidden",
      flexDirection: "row",
    },
    fill: { height: "100%" },
    meta: {
      fontSize: fontSizes.small,
      color: colors.textMuted,
      marginTop: spacing.sm,
      textAlign: "auto",
    },
  });
