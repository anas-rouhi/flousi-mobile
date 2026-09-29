import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Animated,
} from "react-native";
import { Alert } from "../platform/alert";
import { SafeAreaView } from "react-native-safe-area-context";
import AddTransactionModal from "../components/AddTransactionModal";
import CreateAccountModal from "../components/accounts/CreateAccountModal";
import MonthlyStoryModal from "../components/analytics/MonthlyStoryModal";
import AffordabilityModal from "../components/tools/AffordabilityModal";
import CurrencyConverterModal from "../components/tools/CurrencyConverterModal";
import ExportPdfModal from "../components/tools/ExportPdfModal";
import ReceiptScannerModal from "../components/tools/ReceiptScannerModal";
import SplitBillModal from "../components/tools/SplitBillModal";
import BadgesSheet from "../components/home/BadgesSheet";
import StreakBadge from "../components/home/StreakBadge";
import SetBudgetModal from "../components/budget/SetBudgetModal";
import AccountsCarousel from "../components/home/AccountsCarousel";
import BalanceCard from "../components/home/BalanceCard";
import BudgetCard from "../components/home/BudgetCard";
import CategoryBreakdownCard from "../components/home/CategoryBreakdownCard";
import MonthFlowCard from "../components/home/MonthFlowCard";
import PowerToolsGrid from "../components/home/PowerToolsGrid";
import QuickActionButton from "../components/home/QuickActionButton";
import RecentTransactionsList from "../components/home/RecentTransactionsList";
import SmartInsightCard from "../components/home/SmartInsightCard";
import { DashboardSkeleton } from "../components/ui/Skeleton";
import { fontSizes, radii, spacing } from "../constants/theme";
import { useTheme, useThemedStyles } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useAccounts } from "../hooks/useAccounts";
import { useBudget } from "../hooks/useBudget";
import { useStreak } from "../hooks/useStreak";
import { describeApiError, isRetryableError } from "../services/api";
import { primeCategoryCatalog } from "../services/categories";
import { fetchDashboardStats } from "../services/stats";
import { useI18n } from "../i18n";
import { isolate } from "../utils/bidi";
import { computeBadges } from "../utils/badges";
import { successFeedback, tapFeedback } from "../utils/haptics";
import { centimesOf } from "../utils/money";

/** "Anas Rouhi" => "Anas" — the greeting stays short on narrow screens. */
function firstName(user) {
  const name = user?.name?.trim();
  if (!name) {
    return null;
  }
  return name.split(/\s+/)[0];
}

/**
 * The dashboard. This file owns data loading, the toast, and which sheet is
 * open; every piece of presentation lives in `components/home/`.
 */
export default function HomeScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { user, signOut } = useAuth();
  const { t } = useI18n();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [signingOut, setSigningOut] = useState(false);
  const [addVisible, setAddVisible] = useState(false);
  const [accountSheetVisible, setAccountSheetVisible] = useState(false);
  const [budgetSheetVisible, setBudgetSheetVisible] = useState(false);
  const [badgesVisible, setBadgesVisible] = useState(false);
  const [affordVisible, setAffordVisible] = useState(false);
  const [storyVisible, setStoryVisible] = useState(false);
  // Power tools: "scan" | "pdf" | "split" | "fx" | null — one sheet at a time.
  const [openTool, setOpenTool] = useState(null);
  const [addDraft, setAddDraft] = useState(null);
  const handoffTimer = useRef(null);
  const [toast, setToast] = useState(null);
  const { streak, reload: reloadStreak } = useStreak();
  const toastOpacity = useRef(new Animated.Value(0)).current;

  // The carousel needs the accounts themselves, so the dashboard now loads
  // them alongside the stats instead of inferring a count from the payload.
  const {
    accounts,
    selectedId,
    setSelectedId,
    loading: loadingAccounts,
    reload: reloadAccounts,
  } = useAccounts();

  /**
   * The budget's "spent" figure is the month's expenses from the dashboard, so
   * the progress bar advances as soon as a transaction reload lands — no
   * separate budget refetch, and no stale bar after adding an expense.
   */
  const budget = useBudget({
    spentCentimes: centimesOf(stats?.month?.expenses),
  });

  /**
   * A timed-out or dropped request gets one silent second attempt before the
   * user sees anything: the first call of a session often just waits on a cold
   * backend, and surfacing a retry screen for that is noise. Only the second
   * failure — or any real HTTP error — reaches the UI.
   */
  const load = useCallback(async ({ allowRetry = true } = {}) => {
    try {
      setError(null);
      // The breakdown rows name categories by id only; the catalogue (loaded
      // once, never failing) lets them render in the UI language on arrival.
      const [nextStats] = await Promise.all([
        fetchDashboardStats(),
        primeCategoryCatalog(),
      ]);
      setStats(nextStats);
    } catch (err) {
      if (allowRetry && isRetryableError(err)) {
        console.log("Dashboard stats timed out, retrying once…");
        // Awaited, not returned: `finally` must not clear `loading` while the
        // second attempt is still in flight, or the spinner drops to an empty
        // dashboard for a moment.
        await load({ allowRetry: false });
        return;
      }
      console.log("Dashboard stats error:", err.response?.data || err.message);
      setError(describeApiError(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
    reloadAccounts();
    reloadStreak();
  }, [load, reloadAccounts, reloadStreak]);

  /** Fades a short confirmation in, holds it, then fades it back out. */
  const showToast = useCallback(
    (message) => {
      setToast(message);
      toastOpacity.setValue(0);
      Animated.sequence([
        Animated.timing(toastOpacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.delay(1900),
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 260,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          setToast(null);
        }
      });
    },
    [toastOpacity],
  );

  /**
   * A new transaction moves the balance, the month totals and the recent list
   * at once, so the dashboard is refetched rather than patched locally — and
   * silently, since `loading` is already false and the figures swap in place.
   * The accounts reload too: their balances just changed.
   */
  const handleTransactionCreated = useCallback(
    (created) => {
      successFeedback();
      showToast(
        created?.type === "income"
          ? t("home.toast_income_added")
          : t("home.toast_expense_added"),
      );
      load();
      reloadAccounts();
      // Logging today may have just extended the streak.
      reloadStreak();
    },
    [load, showToast, reloadAccounts, reloadStreak, t],
  );

  const handleAccountCreated = useCallback(
    (created) => {
      successFeedback();
      showToast(
        t("home.toast_account_added", { name: isolate(created?.name || "") }),
      );
      reloadAccounts();
      // The balance headline counts accounts, so the stats need refreshing too.
      load();
    },
    [load, showToast, reloadAccounts, t],
  );

  /**
   * Scanner → transaction form. iOS cannot present a modal while another is
   * still sliding away, so the form opens once the scanner has left.
   */
  const handleReceiptScanned = useCallback((draft) => {
    setOpenTool(null);
    setAddDraft(draft);
    clearTimeout(handoffTimer.current);
    handoffTimer.current = setTimeout(() => setAddVisible(true), 450);
  }, []);
  useEffect(() => () => clearTimeout(handoffTimer.current), []);

  /**
   * The sheet stays open when saving fails, so the error it was handed is
   * visible and the amount is not lost.
   */
  const handleBudgetSaved = useCallback(
    async ({ limitCentimes }) => {
      const saved = await budget.save({ limitCentimes });
      if (saved) {
        setBudgetSheetVisible(false);
        successFeedback();
        showToast(t("home.toast_budget_set"));
      }
      return saved;
    },
    [budget, showToast, t],
  );

  /**
   * Signing out clears the token, which flips the auth context and unmounts
   * this screen — so there is no navigation to do here.
   */
  const confirmSignOut = useCallback(() => {
    Alert.alert(t("session.sign_out"), t("session.sign_out_confirm"), [
      { text: t("session.sign_out_cancel"), style: "cancel" },
      {
        text: t("session.sign_out_action"),
        style: "destructive",
        onPress: async () => {
          setSigningOut(true);
          try {
            await signOut();
          } catch (err) {
            console.log("Sign out failed:", err.message);
            setSigningOut(false);
            Alert.alert(t("common.error_title"), t("session.sign_out_failed"));
          }
        },
      },
    ]);
  }, [signOut, t]);

  const greeting = firstName(user);
  const badges = computeBadges({ streak, stats, budget });

  const header = (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <View style={styles.greetingRow}>
          <Text style={styles.greeting}>
            {greeting
              ? t("home.greeting", { name: isolate(greeting) })
              : t("home.greeting_anonymous")}
          </Text>
          <StreakBadge streak={streak} onPress={() => setBadgesVisible(true)} />
        </View>
        <Text style={styles.greetingSub}>{t("home.greeting_sub")}</Text>
      </View>
      <TouchableOpacity
        style={styles.logoutButton}
        onPress={confirmSignOut}
        disabled={signingOut}
        hitSlop={8}
      >
        {signingOut ? (
          <ActivityIndicator size="small" color={colors.dangerText} />
        ) : (
          <Text style={styles.logoutText}>{t("session.sign_out")}</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  // The header renders in every branch on purpose: if the dashboard cannot
  // load at all, signing out has to stay reachable.
  if (loading) {
    return (
      <SafeAreaView style={styles.screen} edges={["top"]}>
        {header}
        <DashboardSkeleton />
      </SafeAreaView>
    );
  }

  if (error && !stats) {
    return (
      <SafeAreaView style={styles.screen} edges={["top"]}>
        {header}
        <View style={styles.center}>
          <Text style={styles.errorTitle}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => load()}>
            <Text style={styles.retryText}>{t("common.retry")}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currency = stats?.currency || "MAD";

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      {header}
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* A refresh that failed while older figures are still on screen. */}
        {error ? <Text style={styles.staleBanner}>{error}</Text> : null}

        <BalanceCard
          balance={stats?.balance}
          month={stats?.month}
          currency={currency}
        />

        {/* Tools: the affordability check leads, the month's story follows. */}
        <View style={styles.tools}>
          <TouchableOpacity
            style={[styles.toolChip, styles.toolChipPrimary]}
            onPress={() => {
              tapFeedback();
              setAffordVisible(true);
            }}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <Text style={styles.toolChipPrimaryText} numberOfLines={1}>
              {t("home.tools.afford")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.toolChip}
            onPress={() => {
              tapFeedback();
              setStoryVisible(true);
            }}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <Text style={styles.toolChipText} numberOfLines={1}>
              {t("home.tools.story")}
            </Text>
          </TouchableOpacity>
        </View>

        <SmartInsightCard stats={stats} budget={budget} currency={currency} />

        <PowerToolsGrid onOpen={setOpenTool} />

        <BudgetCard
          hasBudget={budget.hasBudget}
          limitCentimes={budget.limitCentimes}
          spentCentimes={budget.spentCentimes}
          remainingCentimes={budget.remainingCentimes}
          percentage={budget.percentage}
          state={budget.state}
          period={budget.period ?? stats?.period}
          currency={budget.currency ?? currency}
          loading={budget.loading}
          onSetBudget={() => setBudgetSheetVisible(true)}
        />

        <AccountsCarousel
          accounts={accounts}
          loading={loadingAccounts}
          selectedId={selectedId}
          onSelect={(account) => setSelectedId(account.id)}
          onAddAccount={() => setAccountSheetVisible(true)}
        />

        <MonthFlowCard
          month={stats?.month}
          period={stats?.period}
          currency={currency}
        />

        <RecentTransactionsList
          transactions={stats?.recent_transactions}
          timezone={stats?.period?.timezone}
        />

        <CategoryBreakdownCard
          categories={stats?.categories}
          currency={currency}
        />
      </ScrollView>

      <QuickActionButton onPress={() => setAddVisible(true)} />

      {toast ? (
        <Animated.View
          style={[styles.toast, { opacity: toastOpacity }]}
          pointerEvents="none"
        >
          <Text style={styles.toastText}>{toast}</Text>
        </Animated.View>
      ) : null}

      <AddTransactionModal
        visible={addVisible}
        onClose={() => {
          setAddVisible(false);
          setAddDraft(null);
        }}
        onCreated={handleTransactionCreated}
        draft={addDraft}
      />

      <CreateAccountModal
        visible={accountSheetVisible}
        onClose={() => setAccountSheetVisible(false)}
        onCreated={handleAccountCreated}
        currency={currency}
      />

      <SetBudgetModal
        visible={budgetSheetVisible}
        onClose={() => setBudgetSheetVisible(false)}
        onSave={handleBudgetSaved}
        currentLimitCentimes={budget.limitCentimes}
        currency={budget.currency ?? currency}
        saving={budget.saving}
        error={budget.error}
      />

      <BadgesSheet
        visible={badgesVisible}
        onClose={() => setBadgesVisible(false)}
        streak={streak}
        badges={badges}
      />

      <AffordabilityModal
        visible={affordVisible}
        onClose={() => setAffordVisible(false)}
        stats={stats}
        budget={budget}
        currency={currency}
      />

      <MonthlyStoryModal visible={storyVisible} onClose={() => setStoryVisible(false)} />

      <ReceiptScannerModal
        visible={openTool === "scan"}
        onClose={() => setOpenTool(null)}
        onScanned={handleReceiptScanned}
        currency={currency}
      />
      <ExportPdfModal visible={openTool === "pdf"} onClose={() => setOpenTool(null)} />
      <SplitBillModal
        visible={openTool === "split"}
        onClose={() => setOpenTool(null)}
        currency={currency}
      />
      <CurrencyConverterModal
        visible={openTool === "fx"}
        onClose={() => setOpenTool(null)}
        currency={currency}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
    padding: spacing.xxl,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
  },
  headerText: { flexShrink: 1 },
  greetingRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  tools: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  toolChip: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
  },
  toolChipPrimary: {
    flex: 1.3,
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  toolChipText: {
    fontSize: fontSizes.body,
    fontWeight: "700",
    color: colors.primary,
  },
  toolChipPrimaryText: {
    fontSize: fontSizes.body,
    fontWeight: "800",
    color: colors.onPrimary,
  },
  greeting: {
    fontSize: fontSizes.title,
    fontWeight: "bold",
    color: colors.text,
    textAlign: "auto",
  },
  greetingSub: {
    fontSize: fontSizes.small,
    color: colors.textMuted,
    marginTop: 2,
    textAlign: "auto",
  },
  logoutButton: {
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerSurface,
    borderRadius: radii.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginEnd: spacing.md,
    minWidth: 96,
    alignItems: "center",
  },
  logoutText: {
    fontSize: fontSizes.meta,
    fontWeight: "600",
    color: colors.dangerText,
  },

  errorTitle: {
    fontSize: fontSizes.subtitle,
    color: colors.text,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  retryButton: {
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
    marginBottom: spacing.md,
    fontSize: fontSizes.meta,
  },

  toast: {
    position: "absolute",
    bottom: 100,
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
