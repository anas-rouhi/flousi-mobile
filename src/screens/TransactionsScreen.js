import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Alert } from "../platform/alert";
import { SafeAreaView } from "react-native-safe-area-context";
import AddTransactionModal from "../components/AddTransactionModal";
import QuickActionButton from "../components/home/QuickActionButton";
import TransactionListItem from "../components/transactions/TransactionListItem";
import { fontSizes, radii, spacing } from "../constants/theme";
import { useTheme, useThemedStyles } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useTransactions } from "../hooks/useTransactions";
import { useI18n } from "../i18n";
import { isolate, joinMeta } from "../utils/bidi";
import { categoryName } from "../utils/categories";
import {
  destructiveFeedback,
  successFeedback,
} from "../utils/haptics";
import { formatTransactionDate, zonedDayKey } from "../utils/date";
import { formatMoney } from "../utils/money";

/**
 * Server-side filters; `null` means no type parameter at all. Labels are
 * resolved from `transactions.filters.<key>` at render.
 */
const FILTERS = [
  { key: "all", type: null },
  { key: "expense", type: "expense" },
  { key: "income", type: "income" },
  { key: "transfer", type: "transfer" },
];

export default function TransactionsScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { user } = useAuth();
  const { t, language } = useI18n();
  const [filter, setFilter] = useState(FILTERS[0]);
  const [addVisible, setAddVisible] = useState(false);

  const {
    transactions,
    query,
    setQuery,
    clearSearch,
    activeTerm,
    isSearching,
    pending,
    total,
    loading,
    refreshing,
    loadingMore,
    hasMore,
    error,
    deletingId,
    refresh,
    loadMore,
    remove,
  } = useTransactions({ type: filter.type });

  const timezone = user?.timezone;

  /** Day-grouped sections for the list, in the order the API returned. */
  const sections = useMemo(() => {
    const byDay = new Map();

    for (const transaction of transactions) {
      const key = zonedDayKey(transaction.transaction_date, timezone) ?? "—";
      if (!byDay.has(key)) {
        byDay.set(key, {
          key,
          title: formatTransactionDate(transaction.transaction_date, timezone),
          data: [],
        });
      }
      byDay.get(key).data.push(transaction);
    }

    return [...byDay.values()];
    // `language` is a dependency so the day headings are re-labelled on a
    // language switch — the rows themselves have not changed.
  }, [transactions, timezone, language]);

  const confirmDelete = useCallback(
    (transaction) => {
      const label =
        transaction.description ||
        categoryName(transaction.category, transaction.category_id) ||
        "";
      Alert.alert(
        t("transactions.delete_title"),
        `${isolate(label)}\n${formatMoney(transaction, transaction.currency)}\n\n${t("transactions.delete_note")}`,
        [
          { text: t("common.no"), style: "cancel" },
          {
            text: t("common.delete"),
            style: "destructive",
            onPress: async () => {
              // On the commit, not the prompt: the buzz confirms the record is
              // actually being destroyed.
              destructiveFeedback();
              const ok = await remove(transaction.id);
              if (ok) {
                successFeedback();
              } else {
                Alert.alert(
                  t("common.error_title"),
                  t("transactions.delete_failed"),
                );
              }
            },
          },
        ],
      );
    },
    [remove, t],
  );

  const header = (
    <View style={styles.header}>
      <Text style={styles.title}>{t("transactions.title")}</Text>
      <Text style={styles.subtitle}>
        {joinMeta([
          t("common.transactions_count", { count: total }),
          filter.type ? t(`transactions.filters.${filter.key}`) : null,
        ])}
      </Text>
    </View>
  );

  const controls = (
    <View>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          placeholder={t("transactions.search_placeholder")}
          placeholderTextColor={colors.textPlaceholder}
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCorrect={false}
        />
        {/* Android has no clearButtonMode, so the control is explicit. */}
        {query.length > 0 ? (
          <TouchableOpacity
            style={styles.clear}
            onPress={clearSearch}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t("transactions.clear_search")}
          >
            <Text style={styles.clearText}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.chips}>
        {FILTERS.map((option) => {
          const active = option.key === filter.key;
          return (
            <TouchableOpacity
              key={option.key}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setFilter(option)}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {t(`transactions.filters.${option.key}`)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      {header}

      <SectionList
        sections={sections}
        keyExtractor={(item, index) => item.id ?? String(index)}
        ListHeaderComponent={controls}
        contentContainerStyle={styles.content}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.dayHeading}>{section.title}</Text>
        )}
        renderItem={({ item, index, section }) => (
          <View style={styles.card}>
            <TransactionListItem
              transaction={item}
              onPress={confirmDelete}
              deleting={deletingId === item.id}
              isLast={index === section.data.length - 1}
            />
          </View>
        )}
        ListEmptyComponent={
          // `pending` covers the gap between a keystroke and its response, so
          // an in-flight search never renders as "nothing found".
          pending ? (
            <ActivityIndicator
              color={colors.primary}
              size="large"
              style={styles.spinner}
            />
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>
                {activeTerm
                  ? t("transactions.no_results", { term: isolate(activeTerm) })
                  : t("transactions.empty_title")}
              </Text>
              <Text style={styles.emptySubtitle}>
                {activeTerm
                  ? t("transactions.no_results_hint")
                  : t("transactions.empty_hint")}
              </Text>
            </View>
          )
        }
        // Paging now applies to the filtered set, so it stays on during search.
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator color={colors.primary} style={styles.spinner} />
          ) : hasMore ? (
            <TouchableOpacity style={styles.more} onPress={loadMore}>
              <Text style={styles.moreText}>{t("common.load_more")}</Text>
            </TouchableOpacity>
          ) : null
        }
      />

      <QuickActionButton onPress={() => setAddVisible(true)} />

      <AddTransactionModal
        visible={addVisible}
        onClose={() => setAddVisible(false)}
        onCreated={() => {
          successFeedback();
          refresh();
        }}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 96 },

  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
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

  searchRow: { position: "relative", justifyContent: "center" },
  search: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingStart: 40,
    paddingVertical: spacing.md,
    fontSize: fontSizes.body,
    color: colors.text,
    textAlign: "auto",
  },
  clear: {
    position: "absolute",
    start: spacing.md,
    padding: spacing.xs,
  },
  clearText: { fontSize: fontSizes.body, color: colors.textMuted },

  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: spacing.md,
  },
  chip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingVertical: 7,
    paddingHorizontal: 14,
    marginStart: spacing.sm,
    marginBottom: spacing.sm,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  chipText: {
    fontSize: fontSizes.meta,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  chipTextActive: { color: colors.primary, fontWeight: "bold" },

  error: {
    backgroundColor: colors.dangerSurface,
    color: colors.dangerText,
    borderRadius: radii.sm,
    padding: spacing.md,
    fontSize: fontSizes.meta,
    textAlign: "center",
    marginBottom: spacing.sm,
  },

  dayHeading: {
    fontSize: fontSizes.small,
    fontWeight: "700",
    color: colors.textMuted,
    textAlign: "auto",
    marginTop: spacing.lg,
    marginBottom: 6,
  },
  card: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
  },

  spinner: { marginVertical: spacing.xl },
  more: {
    alignSelf: "center",
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.primaryBorder,
  },
  moreText: {
    color: colors.primary,
    fontWeight: "bold",
    fontSize: fontSizes.meta,
  },

  empty: { alignItems: "center", paddingVertical: spacing.xxxl },
  emptyTitle: {
    fontSize: fontSizes.bodyLarge,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  emptySubtitle: {
    fontSize: fontSizes.meta,
    color: colors.textFaint,
    marginTop: 6,
    textAlign: "center",
  },
});
