import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AddTransactionModal from "../components/AddTransactionModal";
import { useAuth } from "../context/AuthContext";
import { describeApiError, isRetryableError } from "../services/api";
import { fetchDashboardStats } from "../services/stats";
import { formatTransactionDate, monthLabel } from "../utils/date";
import { centimesOf, formatMoney, formatSignedMoney } from "../utils/money";

const BRAND = "#0A5C36";
const INCOME = "#2ECC71";
const EXPENSE = "#E74C3C";
const TOP_CATEGORIES = 5;

/** "Anas Rouhi" => "Anas" — the greeting stays short on narrow screens. */
function firstName(user) {
  const name = user?.name?.trim();
  if (!name) {
    return null;
  }
  return name.split(/\s+/)[0];
}

export default function HomeScreen() {
  const { user, signOut } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [addVisible, setAddVisible] = useState(false);
  const [toast, setToast] = useState(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  /**
   * A timed-out or dropped request gets one silent second attempt before the
   * user sees anything: the first call of a session often just waits on a cold
   * backend, and surfacing a retry screen for that is noise. Only the second
   * failure — or any real HTTP error — reaches the UI.
   */
  const load = useCallback(async ({ allowRetry = true } = {}) => {
    try {
      setError(null);
      setStats(await fetchDashboardStats());
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
  }, [load]);

  /**
   * Signing out clears the token, which flips the auth context and unmounts
   * this screen — so there is no navigation to do here, and no need to reset
   * local state either.
   */
  const confirmSignOut = useCallback(() => {
    Alert.alert("تسجيل الخروج", "واش بصح بغيت تخرج من حسابك؟", [
      { text: "لا، بقا", style: "cancel" },
      {
        text: "خرج",
        style: "destructive",
        onPress: async () => {
          setSigningOut(true);
          try {
            await signOut();
          } catch (err) {
            // signOut clears the local token even when the API call fails, so
            // reaching here means something unexpected happened.
            console.log("Sign out failed:", err.message);
            setSigningOut(false);
            Alert.alert("خطأ", "ما قدرناش نخرجوك، عاود المحاولة");
          }
        },
      },
    ]);
  }, [signOut]);

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
   * A new transaction changes balances, the month totals and the recent list at
   * once, so the whole dashboard is refetched rather than patched locally — and
   * silently, since `loading` is already false by now and the figures simply
   * swap in place.
   */
  const handleCreated = useCallback(
    (created) => {
      showToast(
        created?.type === "income" ? "تزاد المدخول ✓" : "تزاد المصروف ✓",
      );
      load();
    },
    [load, showToast],
  );

  const greeting = firstName(user);

  const header = (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text style={styles.greeting}>
          {greeting ? `أهلاً، ${greeting} 👋` : "مرحبا بيك 👋"}
        </Text>
        <Text style={styles.greetingSub}>هاد نظرة على فلوسك</Text>
      </View>
      <TouchableOpacity
        style={styles.logoutButton}
        onPress={confirmSignOut}
        disabled={signingOut}
        hitSlop={8}
      >
        {signingOut ? (
          <ActivityIndicator size="small" color="#C0392B" />
        ) : (
          <Text style={styles.logoutText}>تسجيل الخروج</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  // The header is rendered in every branch on purpose: if the dashboard cannot
  // load at all, signing out has to stay reachable.
  if (loading) {
    return (
      <SafeAreaView style={styles.screen} edges={["top"]}>
        {header}
        <View style={styles.center}>
          <ActivityIndicator size="large" color={BRAND} />
        </View>
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
            <Text style={styles.retryText}>عاود المحاولة</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currency = stats?.currency || "MAD";
  const balance = stats?.balance;
  const month = stats?.month;
  const categories = stats?.categories || [];
  const visibleCategories = showAllCategories
    ? categories
    : categories.slice(0, TOP_CATEGORIES);
  const recentTransactions = stats?.recent_transactions || [];
  const timezone = stats?.period?.timezone;

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
            colors={[BRAND]}
            tintColor={BRAND}
          />
        }
      >
        {/* A refresh that failed while older figures are still on screen. */}
        {error ? <Text style={styles.staleBanner}>{error}</Text> : null}

        {/* Total available balance */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>الرصيد الإجمالي المتوفر</Text>
          <Text style={styles.balanceValue}>{formatMoney(balance, currency)}</Text>
          <Text style={styles.balanceMeta}>
            {balance?.accounts_count || 0} حساب • {currency}
          </Text>

          {balance?.other_currencies?.length ? (
            <View style={styles.otherCurrencies}>
              <Text style={styles.otherCurrenciesLabel}>عملات أخرى</Text>
              {balance.other_currencies.map((row) => (
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

        {/* Monthly income vs expenses */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>حركة هذا الشهر</Text>
            <Text style={styles.cardHeaderMeta}>{monthLabel(stats?.period)}</Text>
          </View>

          <FlowBar income={month?.income} expenses={month?.expenses} />

          <View style={styles.flowRow}>
            <FlowFigure
              label="المدخول"
              value={formatSignedMoney(month?.income, currency, "+")}
              color={INCOME}
            />
            <FlowFigure
              label="المصاريف"
              value={formatSignedMoney(month?.expenses, currency, "-")}
              color={EXPENSE}
              align="flex-end"
            />
          </View>

          <View style={styles.netRow}>
            <Text style={styles.netLabel}>الصافي</Text>
            <Text
              style={[
                styles.netValue,
                { color: centimesOf(month?.net) < 0 ? EXPENSE : BRAND },
              ]}
            >
              {formatMoney(month?.net, currency)}
            </Text>
          </View>

          {month?.savings_rate === null || month?.savings_rate === undefined ? (
            <Text style={styles.savingsMuted}>ما كاينش مدخول هذا الشهر</Text>
          ) : (
            <Text style={styles.savings}>نسبة التوفير: {month.savings_rate}%</Text>
          )}
        </View>

        {/* Recent activity across every account */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>آخر المعاملات</Text>
            {recentTransactions.length ? (
              <Text style={styles.cardHeaderMeta}>
                {recentTransactions.length} معاملة
              </Text>
            ) : null}
          </View>

          {recentTransactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>ما كاينة حتى معاملة</Text>
              <Text style={styles.emptySubtitle}>
                زيد أول معاملة باش تبان هنا
              </Text>
            </View>
          ) : (
            recentTransactions.map((transaction, index) => (
              <TransactionRow
                key={transaction.id ?? index}
                transaction={transaction}
                timezone={timezone}
                isLast={index === recentTransactions.length - 1}
              />
            ))
          )}
        </View>

        {/* Category spending breakdown */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>المصاريف حسب الفئة</Text>
            {categories.length > TOP_CATEGORIES ? (
              <TouchableOpacity
                onPress={() => setShowAllCategories((shown) => !shown)}
              >
                <Text style={styles.link}>
                  {showAllCategories ? "أقل" : `الكل (${categories.length})`}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {categories.length === 0 ? (
            <Text style={styles.emptyText}>ما كاينش مصاريف هذا الشهر</Text>
          ) : (
            visibleCategories.map((category) => (
              <CategoryRow
                key={category.category_id ?? "uncategorized"}
                category={category}
                currency={currency}
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* Primary action: quick expense/income entry. */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setAddVisible(true)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="زيد معاملة جديدة"
      >
        <Text style={styles.fabIcon}>＋</Text>
      </TouchableOpacity>

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
        onClose={() => setAddVisible(false)}
        onCreated={handleCreated}
      />
    </SafeAreaView>
  );
}

/** Proportional income/expense bar, sized from the authoritative centimes. */
function FlowBar({ income, expenses }) {
  const incomeCentimes = centimesOf(income);
  const expenseCentimes = centimesOf(expenses);
  const total = incomeCentimes + expenseCentimes;

  if (total <= 0) {
    return <View style={styles.flowBarTrack} />;
  }

  const incomeShare = (incomeCentimes / total) * 100;

  return (
    <View style={styles.flowBarTrack}>
      <View
        style={[
          styles.flowBarSegment,
          { width: `${incomeShare}%`, backgroundColor: INCOME },
        ]}
      />
      <View
        style={[
          styles.flowBarSegment,
          { width: `${100 - incomeShare}%`, backgroundColor: EXPENSE },
        ]}
      />
    </View>
  );
}

function FlowFigure({ label, value, color, align = "flex-start" }) {
  return (
    <View style={{ alignItems: align }}>
      <Text style={styles.flowLabel}>{label}</Text>
      <Text style={[styles.flowValue, { color }]}>{value}</Text>
    </View>
  );
}

function TransactionRow({ transaction, timezone, isLast }) {
  const isExpense = transaction.type === "expense";
  const color = isExpense ? EXPENSE : INCOME;
  const category = transaction.category;

  // The list spans every account, so each row formats in its own currency
  // rather than the dashboard's primary one.
  const amount = formatSignedMoney(
    transaction,
    transaction.currency,
    isExpense ? "-" : "+",
  );

  // Description is optional; the category name is the next best label. When it
  // stands in as the title, it is dropped from the meta line to avoid repeating.
  const title = transaction.description || category?.name || "معاملة";
  const date = formatTransactionDate(transaction.transaction_date, timezone);

  const meta = [
    transaction.description ? category?.name : null,
    transaction.account?.name,
    date,
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <View style={[styles.txRow, isLast && styles.txRowLast]}>
      <View style={[styles.txStripe, { backgroundColor: color }]} />
      <View style={styles.txBody}>
        <Text style={styles.txTitle} numberOfLines={1}>
          {title}
        </Text>
        {meta ? (
          <Text style={styles.txMeta} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.txAmount, { color }]}>{amount}</Text>
    </View>
  );
}

function CategoryRow({ category, currency }) {
  // `percentage` is already computed server-side against the month's expenses.
  const share = Number.isFinite(category.percentage) ? category.percentage : 0;
  const color = category.color || "#95A5A6";

  return (
    <View style={styles.categoryRow}>
      <View style={styles.categoryHeader}>
        <View style={styles.categoryIdentity}>
          <View style={[styles.categoryDot, { backgroundColor: color }]} />
          <Text style={styles.categoryName} numberOfLines={1}>
            {category.name}
          </Text>
        </View>
        <Text style={styles.categoryAmount}>
          {formatMoney(category, currency)}
        </Text>
      </View>

      <View style={styles.categoryBarTrack}>
        <View
          style={[
            styles.categoryBarFill,
            { width: `${Math.min(share, 100)}%`, backgroundColor: color },
          ]}
        />
      </View>

      <Text style={styles.categoryMeta}>
        {share}% • {category.transactions_count} معاملة
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F8F9FA" },
  container: { flex: 1, backgroundColor: "#F8F9FA" },
  content: { padding: 16, paddingBottom: 32 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
    padding: 24,
  },

  fab: {
    position: "absolute",
    bottom: 28,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: BRAND,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  fabIcon: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "bold",
    lineHeight: 34,
  },

  toast: {
    position: "absolute",
    bottom: 100,
    alignSelf: "center",
    backgroundColor: "#2C3E50",
    borderRadius: 24,
    paddingVertical: 11,
    paddingHorizontal: 22,
  },
  toastText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },

  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: "#F8F9FA",
  },
  headerText: { flexShrink: 1 },
  greeting: {
    fontSize: 19,
    fontWeight: "bold",
    color: "#2C3E50",
    textAlign: "right",
  },
  greetingSub: {
    fontSize: 12,
    color: "#95A5A6",
    marginTop: 2,
    textAlign: "right",
  },
  logoutButton: {
    borderWidth: 1,
    borderColor: "#F5C6C1",
    backgroundColor: "#FDECEA",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 12,
    minWidth: 96,
    alignItems: "center",
  },
  logoutText: { fontSize: 13, fontWeight: "600", color: "#C0392B" },

  errorTitle: {
    fontSize: 16,
    color: "#2C3E50",
    textAlign: "center",
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: BRAND,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  retryText: { color: "#FFF", fontWeight: "bold", fontSize: 15 },
  staleBanner: {
    backgroundColor: "#FDECEA",
    color: "#C0392B",
    borderRadius: 10,
    padding: 12,
    textAlign: "center",
    marginBottom: 12,
    fontSize: 13,
  },

  balanceCard: {
    backgroundColor: BRAND,
    borderRadius: 20,
    padding: 24,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  balanceLabel: { color: "#C8E6C9", fontSize: 14, textAlign: "right" },
  balanceValue: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "bold",
    marginTop: 8,
    textAlign: "right",
  },
  balanceMeta: {
    color: "#A5D6A7",
    fontSize: 12,
    marginTop: 6,
    textAlign: "right",
  },
  otherCurrencies: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#4C8C6B",
    marginTop: 16,
    paddingTop: 12,
  },
  otherCurrenciesLabel: {
    color: "#C8E6C9",
    fontSize: 12,
    marginBottom: 6,
    textAlign: "right",
  },
  otherCurrencyRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  otherCurrencyAmount: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  otherCurrencyMeta: { color: "#A5D6A7", fontSize: 12 },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    marginTop: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  cardHeader: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  cardTitle: { fontSize: 17, fontWeight: "bold", color: "#2C3E50" },
  cardHeaderMeta: { fontSize: 13, color: "#95A5A6" },
  link: { fontSize: 13, color: BRAND, fontWeight: "600" },

  flowBarTrack: {
    flexDirection: "row-reverse",
    height: 10,
    borderRadius: 5,
    backgroundColor: "#ECF0F1",
    overflow: "hidden",
  },
  flowBarSegment: { height: "100%" },
  flowRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    marginTop: 14,
  },
  flowLabel: { fontSize: 13, color: "#7F8C8D" },
  flowValue: { fontSize: 18, fontWeight: "bold", marginTop: 4 },

  netRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#ECF0F1",
    marginTop: 16,
    paddingTop: 12,
  },
  netLabel: { fontSize: 14, color: "#7F8C8D" },
  netValue: { fontSize: 18, fontWeight: "bold" },
  savings: { fontSize: 13, color: BRAND, marginTop: 8, textAlign: "right" },
  savingsMuted: {
    fontSize: 13,
    color: "#95A5A6",
    marginTop: 8,
    textAlign: "right",
  },

  txRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ECF0F1",
  },
  txRowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  txStripe: {
    width: 4,
    alignSelf: "stretch",
    borderRadius: 2,
    marginLeft: 12,
    minHeight: 34,
  },
  txBody: { flex: 1 },
  txTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#2C3E50",
    textAlign: "right",
  },
  txMeta: {
    fontSize: 12,
    color: "#95A5A6",
    marginTop: 4,
    textAlign: "right",
  },
  txAmount: { fontSize: 15, fontWeight: "bold", marginRight: 10 },

  emptyState: { alignItems: "center", paddingVertical: 20 },
  emptyTitle: { fontSize: 15, fontWeight: "600", color: "#7F8C8D" },
  emptySubtitle: { fontSize: 13, color: "#B2BEC3", marginTop: 6 },

  categoryRow: { marginBottom: 16 },
  categoryHeader: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  categoryIdentity: {
    flexDirection: "row-reverse",
    alignItems: "center",
    flexShrink: 1,
  },
  categoryDot: { width: 10, height: 10, borderRadius: 5, marginLeft: 8 },
  categoryName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#2C3E50",
    flexShrink: 1,
  },
  categoryAmount: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#2C3E50",
    marginRight: 8,
  },
  categoryBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ECF0F1",
    overflow: "hidden",
    flexDirection: "row-reverse",
  },
  categoryBarFill: { height: "100%", borderRadius: 4 },
  categoryMeta: {
    fontSize: 12,
    color: "#95A5A6",
    marginTop: 6,
    textAlign: "right",
  },

  emptyText: { color: "#7F8C8D", textAlign: "center", marginVertical: 16 },
});
