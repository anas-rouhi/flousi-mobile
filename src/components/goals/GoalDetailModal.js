import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { fontSizes, radii, spacing } from "../../constants/theme";
import { useTheme, useThemedStyles } from "../../context/ThemeContext";
import { useI18n } from "../../i18n";
import { ltr } from "../../utils/bidi";
import { GoalIcon, GoalProgress, goalTiming } from "./GoalCard";

/**
 * One goal up close, with its three actions.
 *
 * `onDismiss` is forwarded to the Modal: on iOS a second sheet can only be
 * presented once this one has fully gone, so the screen opens the next sheet
 * from there.
 */
export default function GoalDetailModal({
  visible,
  goal,
  onClose,
  onDismiss,
  onContribute,
  onEdit,
  onDelete,
  deleting = false,
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useI18n();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      onDismiss={onDismiss}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.dismissArea} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <View />
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Text style={styles.close}>{t("common.close")}</Text>
            </TouchableOpacity>
          </View>

          {goal ? (
            <>
              <View style={styles.hero}>
                <GoalIcon goal={goal} size={64} />
                <Text style={styles.name}>{goal.name}</Text>
                {goal.is_completed ? (
                  <Text style={styles.completed}>{t("goals.completed")}</Text>
                ) : null}
              </View>

              <Text style={[styles.percent, { color: goal.color || colors.primary }]}>
                {ltr(`${goal.progress_percentage ?? 0}%`)}
              </Text>
              <GoalProgress goal={goal} height={14} />

              <Text style={styles.amounts}>
                {t("goals.saved_of", {
                  saved: ltr(goal.saved_amount_formatted),
                  target: ltr(goal.target_amount_formatted),
                })}
              </Text>
              {goal.is_completed ? null : (
                <Text style={styles.line}>
                  {t("goals.remaining", { amount: ltr(goal.remaining_formatted) })}
                </Text>
              )}
              <Text style={styles.line}>{goalTiming(goal, t)}</Text>

              <TouchableOpacity
                style={styles.primary}
                onPress={onContribute}
                activeOpacity={0.85}
                disabled={deleting}
              >
                <Text style={styles.primaryText}>
                  {t("goals.detail.add_contribution")}
                </Text>
              </TouchableOpacity>

              <View style={styles.row}>
                <TouchableOpacity
                  style={styles.secondary}
                  onPress={onEdit}
                  activeOpacity={0.8}
                  disabled={deleting}
                >
                  <Text style={styles.secondaryText}>{t("goals.detail.edit")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.secondary, styles.danger]}
                  onPress={onDelete}
                  activeOpacity={0.8}
                  disabled={deleting}
                >
                  {deleting ? (
                    <ActivityIndicator size="small" color={colors.dangerText} />
                  ) : (
                    <Text style={styles.dangerText}>{t("goals.detail.delete")}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.scrim,
      justifyContent: "flex-end",
    },
    dismissArea: { flex: 1 },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radii.sheet,
      borderTopRightRadius: radii.sheet,
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xxxl,
    },
    grabber: {
      width: 42,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.grabber,
      alignSelf: "center",
      marginTop: 10,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
    },
    close: {
      fontSize: fontSizes.bodyLarge,
      color: colors.textMuted,
      fontWeight: "600",
    },
    hero: { alignItems: "center" },
    name: {
      fontSize: fontSizes.title,
      fontWeight: "bold",
      color: colors.text,
      textAlign: "center",
      marginTop: spacing.md,
    },
    completed: {
      fontSize: fontSizes.meta,
      fontWeight: "bold",
      color: colors.primary,
      marginTop: spacing.xs,
    },
    percent: {
      fontSize: fontSizes.heading,
      fontWeight: "bold",
      textAlign: "center",
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    amounts: {
      fontSize: fontSizes.bodyLarge,
      fontWeight: "600",
      color: colors.text,
      textAlign: "center",
      marginTop: spacing.md,
    },
    line: {
      fontSize: fontSizes.meta,
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: spacing.xs,
    },
    primary: {
      backgroundColor: colors.primary,
      borderRadius: radii.lg,
      paddingVertical: spacing.lg,
      alignItems: "center",
      marginTop: spacing.xl,
    },
    primaryText: {
      color: colors.onPrimary,
      fontSize: fontSizes.subtitle,
      fontWeight: "bold",
    },
    row: { flexDirection: "row", marginTop: spacing.sm, gap: spacing.sm },
    secondary: {
      flex: 1,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: radii.lg,
      paddingVertical: spacing.md,
      alignItems: "center",
    },
    secondaryText: {
      fontSize: fontSizes.body,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    danger: {
      borderColor: colors.dangerBorder,
      backgroundColor: colors.dangerSurface,
    },
    dangerText: {
      fontSize: fontSizes.body,
      fontWeight: "600",
      color: colors.dangerText,
    },
  });
