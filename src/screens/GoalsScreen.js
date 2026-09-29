import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Platform,
} from "react-native";
import { Alert } from "../platform/alert";
import { SafeAreaView } from "react-native-safe-area-context";
import ContributeModal from "../components/goals/ContributeModal";
import GoalCard from "../components/goals/GoalCard";
import GoalDetailModal from "../components/goals/GoalDetailModal";
import GoalFormModal from "../components/goals/GoalFormModal";
import { fontSizes, radii, spacing } from "../constants/theme";
import { useAuth } from "../context/AuthContext";
import { useTheme, useThemedStyles } from "../context/ThemeContext";
import { useGoals } from "../hooks/useGoals";
import { useI18n } from "../i18n";
import { isolate } from "../utils/bidi";

/** iOS may never report the dismissal; this caps how long the next sheet waits. */
const DISMISS_FALLBACK_MS = 650;

/**
 * Savings goals: the list, and the three sheets that act on a goal.
 *
 * Only one sheet is ever open. Moving from the detail sheet to "contribute" or
 * "edit" closes it first: iOS refuses to present a Modal while another is
 * still animating away, so on iOS the next sheet opens from the first one's
 * `onDismiss` (with a timer as a backstop). Android has no such limit.
 */
export default function GoalsScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useI18n();
  const { user } = useAuth();
  const { goals, loading, refreshing, error, reload, refresh, upsert, remove } =
    useGoals();

  // { type: "detail" | "form" | "contribute", goalId: string | null }
  const [sheet, setSheet] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const pendingSheet = useRef(null);
  const fallbackTimer = useRef(null);

  const [toast, setToast] = useState(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => () => clearTimeout(fallbackTimer.current), []);

  // The sheets read the live row, so a refetch behind them shows fresh numbers.
  const sheetGoal = sheet?.goalId
    ? goals.find((goal) => goal.id === sheet.goalId) ?? null
    : null;

  const openPending = useCallback(() => {
    clearTimeout(fallbackTimer.current);
    if (pendingSheet.current) {
      const next = pendingSheet.current;
      pendingSheet.current = null;
      setSheet(next);
    }
  }, []);

  /** Swaps the detail sheet for another one, safely on both platforms. */
  const switchSheet = useCallback(
    (next) => {
      if (Platform.OS !== "ios") {
        setSheet(next);
        return;
      }
      pendingSheet.current = next;
      setSheet(null);
      fallbackTimer.current = setTimeout(openPending, DISMISS_FALLBACK_MS);
    },
    [openPending],
  );

  const closeSheet = useCallback(() => {
    pendingSheet.current = null;
    setSheet(null);
  }, []);

  const showToast = useCallback(
    (message) => {
      setToast(message);
      toastOpacity.setValue(0);
      Animated.sequence([
        Animated.timing(toastOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.delay(1900),
        Animated.timing(toastOpacity, { toValue: 0, duration: 260, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) {
          setToast(null);
        }
      });
    },
    [toastOpacity],
  );

  const handleSaved = useCallback(
    (goal, { created }) => {
      upsert(goal);
      closeSheet();
      showToast(created ? t("goals.toast_created") : t("goals.toast_updated"));
    },
    [upsert, closeSheet, showToast, t],
  );

  const handleContributed = useCallback(
    (goal) => {
      upsert(goal);
      closeSheet();
      showToast(t("goals.toast_contributed"));
    },
    [upsert, closeSheet, showToast, t],
  );

  const confirmDelete = useCallback(
    (goal) => {
      Alert.alert(
        t("goals.detail.delete_title"),
        t("goals.detail.delete_body", { name: isolate(goal.name) }),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("common.delete"),
            style: "destructive",
            onPress: async () => {
              setDeleting(true);
              const result = await remove(goal.id);
              setDeleting(false);
              if (result.ok) {
                closeSheet();
                showToast(t("goals.toast_deleted"));
              } else {
                Alert.alert(
                  t("common.error_title"),
                  result.error || t("goals.detail.delete_failed"),
                );
              }
            },
          },
        ],
      );
    },
    [remove, closeSheet, showToast, t],
  );

  const header = (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text style={styles.title}>{t("goals.title")}</Text>
        {goals.length ? (
          <Text style={styles.subtitle}>
            {t("goals.count", { count: goals.length })}
          </Text>
        ) : null}
      </View>
      <TouchableOpacity
        style={styles.newButton}
        onPress={() => setSheet({ type: "form", goalId: null })}
        accessibilityRole="button"
        activeOpacity={0.85}
      >
        <Text style={styles.newButtonText}>{`＋ ${t("goals.new_goal")}`}</Text>
      </TouchableOpacity>
    </View>
  );

  let body;
  if (loading) {
    body = (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  } else if (error && goals.length === 0) {
    body = (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>{error}</Text>
        <TouchableOpacity style={styles.retry} onPress={reload}>
          <Text style={styles.retryText}>{t("common.retry")}</Text>
        </TouchableOpacity>
      </View>
    );
  } else {
    body = (
      <FlatList
        data={goals}
        keyExtractor={(goal) => goal.id}
        contentContainerStyle={[
          styles.content,
          goals.length === 0 && styles.contentEmpty,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          // A refresh that failed while older goals are still listed.
          error ? <Text style={styles.staleBanner}>{error}</Text> : null
        }
        renderItem={({ item }) => (
          <GoalCard
            goal={item}
            onPress={(goal) => setSheet({ type: "detail", goalId: goal.id })}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyGlyph}>🎯</Text>
            <Text style={styles.emptyTitle}>{t("goals.empty_title")}</Text>
            <Text style={styles.emptyBody}>{t("goals.empty_body")}</Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => setSheet({ type: "form", goalId: null })}
              activeOpacity={0.85}
            >
              <Text style={styles.emptyButtonText}>{t("goals.create_first")}</Text>
            </TouchableOpacity>
          </View>
        }
      />
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      {header}
      {body}

      {toast ? (
        <Animated.View
          style={[styles.toast, { opacity: toastOpacity }]}
          pointerEvents="none"
        >
          <Text style={styles.toastText}>{toast}</Text>
        </Animated.View>
      ) : null}

      <GoalDetailModal
        visible={sheet?.type === "detail" && Boolean(sheetGoal)}
        goal={sheetGoal}
        deleting={deleting}
        onClose={closeSheet}
        onDismiss={openPending}
        onContribute={() => switchSheet({ type: "contribute", goalId: sheet.goalId })}
        onEdit={() => switchSheet({ type: "form", goalId: sheet.goalId })}
        onDelete={() => sheetGoal && confirmDelete(sheetGoal)}
      />

      <GoalFormModal
        visible={sheet?.type === "form"}
        goal={sheetGoal}
        defaultCurrency={user?.preferred_currency}
        onClose={closeSheet}
        onSaved={handleSaved}
      />

      <ContributeModal
        visible={sheet?.type === "contribute" && Boolean(sheetGoal)}
        goal={sheetGoal}
        onClose={closeSheet}
        onContributed={handleContributed}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingTop: 0, paddingBottom: spacing.xxxl },
    contentEmpty: { flexGrow: 1 },
    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.xxl,
    },

    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xs,
    },
    headerText: { flexShrink: 1 },
    title: {
      fontSize: fontSizes.heading,
      fontWeight: "bold",
      color: colors.text,
      textAlign: "auto",
    },
    subtitle: {
      fontSize: fontSizes.small,
      color: colors.textMuted,
      marginTop: 2,
      textAlign: "auto",
    },
    newButton: {
      backgroundColor: colors.primary,
      borderRadius: radii.pill,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      marginStart: spacing.md,
    },
    newButtonText: {
      color: colors.onPrimary,
      fontSize: fontSizes.meta,
      fontWeight: "bold",
    },

    errorTitle: {
      fontSize: fontSizes.subtitle,
      color: colors.text,
      textAlign: "center",
      marginBottom: spacing.lg,
    },
    retry: {
      backgroundColor: colors.primary,
      paddingVertical: spacing.md,
      paddingHorizontal: 28,
      borderRadius: radii.lg,
    },
    retryText: {
      color: colors.onPrimary,
      fontWeight: "bold",
      fontSize: fontSizes.bodyLarge,
    },
    staleBanner: {
      backgroundColor: colors.dangerSurface,
      color: colors.dangerText,
      borderRadius: radii.sm,
      padding: spacing.md,
      textAlign: "center",
      marginTop: spacing.md,
      fontSize: fontSizes.meta,
    },

    empty: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.xxxl,
    },
    emptyGlyph: { fontSize: 44 },
    emptyTitle: {
      fontSize: fontSizes.subtitle,
      fontWeight: "bold",
      color: colors.text,
      textAlign: "center",
      marginTop: spacing.md,
    },
    emptyBody: {
      fontSize: fontSizes.meta,
      lineHeight: 21,
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    emptyButton: {
      backgroundColor: colors.primary,
      borderRadius: radii.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xxl,
      marginTop: spacing.xl,
    },
    emptyButtonText: {
      color: colors.onPrimary,
      fontSize: fontSizes.body,
      fontWeight: "bold",
    },

    toast: {
      position: "absolute",
      bottom: 40,
      alignSelf: "center",
      backgroundColor: colors.inverse,
      borderRadius: radii.pill,
      paddingVertical: 11,
      paddingHorizontal: 22,
    },
    toastText: {
      color: colors.onInverse,
      fontSize: fontSizes.body,
      fontWeight: "600",
    },
  });
