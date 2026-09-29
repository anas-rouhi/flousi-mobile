import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import CashflowCard from "../components/analytics/CashflowCard";
import DirectionalIcon from "../components/ui/DirectionalIcon";
import CategoryDistribution from "../components/analytics/CategoryDistribution";
import MonthlyStoryModal from "../components/analytics/MonthlyStoryModal";
import ExportPdfModal from "../components/tools/ExportPdfModal";
import { AnalyticsSkeleton } from "../components/ui/Skeleton";
import { fontSizes, radii, spacing } from "../constants/theme";
import { useTheme, useThemedStyles } from "../context/ThemeContext";
import { describeApiError, isRetryableError } from "../services/api";
import { fetchMonthlyAnalytics } from "../services/analytics";
import { primeCategoryCatalog } from "../services/categories";
import { useI18n } from "../i18n";
import { ltr } from "../utils/bidi";
import {
  currentPeriod,
  formatMonthYear,
  isSameOrAfterPeriod as isSameOrAfter,
  shiftPeriod as shiftMonth,
} from "../utils/date";
import { tapFeedback } from "../utils/haptics";

export default function AnalyticsScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useI18n();
  const [selected, setSelected] = useState(currentPeriod);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [storyVisible, setStoryVisible] = useState(false);
  const [pdfVisible, setPdfVisible] = useState(false);

  const load = useCallback(
    async (period, { allowRetry = true } = {}) => {
      try {
        setError(null);
        const [next] = await Promise.all([
          fetchMonthlyAnalytics(period),
          primeCategoryCatalog(),
        ]);
        setAnalytics(next);
      } catch (err) {
        if (allowRetry && isRetryableError(err)) {
          await load(period, { allowRetry: false });
          return;
        }
        console.log("Analytics failed:", err.response?.data || err.message);
        setError(describeApiError(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    setLoading(true);
    load(selected);
  }, [selected, load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(selected);
  }, [load, selected]);

  // There is nothing to analyse in the future, so forward stops at this month.
  const atCurrentMonth = isSameOrAfter(selected, currentPeriod());

  const switcher = (
    <View style={styles.switcher}>
      {/* In RTL the row is reversed, so "previous" sits on the right. */}
      <TouchableOpacity
        style={styles.arrow}
        onPress={() => setSelected((current) => shiftMonth(current, -1))}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={t("analytics.prev_month")}
      >
        <DirectionalIcon glyph="›" style={styles.arrowText} />
      </TouchableOpacity>

      {/* Built on the client rather than taken from `period.label`: the
          server names the month in the account's language, not the UI's. */}
      <Text style={styles.monthLabel}>
        {formatMonthYear(selected.month, selected.year)}
      </Text>

      <TouchableOpacity
        style={[styles.arrow, atCurrentMonth && styles.arrowDisabled]}
        onPress={() => setSelected((current) => shiftMonth(current, 1))}
        disabled={atCurrentMonth}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={t("analytics.next_month")}
      >
        <DirectionalIcon glyph="‹" style={styles.arrowText} />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("analytics.title")}</Text>
        {switcher}
      </View>

      {loading ? (
        <AnalyticsSkeleton />
      ) : error && !analytics ? (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>{error}</Text>
          <TouchableOpacity
            style={styles.retry}
            onPress={() => load(selected)}
          >
            <Text style={styles.retryText}>{t("common.retry")}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
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
          {error ? <Text style={styles.staleBanner}>{error}</Text> : null}

          <TouchableOpacity
            style={styles.storyCta}
            onPress={() => {
              tapFeedback();
              setStoryVisible(true);
            }}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <Text style={styles.storyCtaGlyph}>🎬</Text>
            <View style={styles.storyCtaBody}>
              <Text style={styles.storyCtaTitle}>{t("analytics.story_cta")}</Text>
              <Text style={styles.storyCtaSub}>
                {formatMonthYear(selected.month, selected.year)}
              </Text>
            </View>
            <DirectionalIcon glyph="›" style={styles.storyCtaArrow} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.pdfCta}
            onPress={() => {
              tapFeedback();
              setPdfVisible(true);
            }}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <Text style={styles.pdfCtaText}>{t("analytics.export_pdf")}</Text>
          </TouchableOpacity>

          <CashflowCard summary={analytics?.summary} />
          <CategoryDistribution categories={analytics?.categories} />
          <DailyTrend days={analytics?.daily_trend} />
        </ScrollView>
      )}

      <MonthlyStoryModal
        visible={storyVisible}
        onClose={() => setStoryVisible(false)}
        period={selected}
        analytics={analytics}
      />

      <ExportPdfModal
        visible={pdfVisible}
        onClose={() => setPdfVisible(false)}
        initialPeriod={selected}
      />
    </SafeAreaView>
  );
}

/**
 * Daily expense bars for the month.
 *
 * The endpoint returns every day including empty ones, so the axis is complete
 * without the client filling gaps. Heights are scaled against the busiest day,
 * which keeps a quiet month readable instead of flat.
 */
function DailyTrend({ days = [] }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useI18n();
  if (!days.length) {
    return null;
  }

  const peak = days.reduce((max, day) => Math.max(max, day.expense || 0), 0);
  if (peak <= 0) {
    return null;
  }

  const busiest = days.reduce(
    (top, day) => ((day.expense || 0) > (top.expense || 0) ? day : top),
    days[0],
  );

  return (
    <View style={styles.trendCard}>
      <View style={styles.trendHead}>
        <Text style={styles.trendTitle}>{t("analytics.daily_title")}</Text>
        <Text style={styles.trendMeta}>
          {t("analytics.busiest_day", {
            day: busiest.day,
            amount: ltr(busiest.expense_formatted),
          })}
        </Text>
      </View>

      <View style={styles.bars}>
        {days.map((day) => (
          <View key={day.date ?? day.day} style={styles.barSlot}>
            <View
              style={[
                styles.bar,
                {
                  // Floor of 2% so a day with any spend is still visible.
                  height: `${Math.max((day.expense / peak) * 100, day.expense > 0 ? 2 : 0)}%`,
                  backgroundColor:
                    day.day === busiest.day ? colors.primary : colors.mint,
                },
              ]}
            />
          </View>
        ))}
      </View>

      <View style={styles.axis}>
        <Text style={styles.axisText}>{days[0]?.day}</Text>
        <Text style={styles.axisText}>{days[days.length - 1]?.day}</Text>
      </View>
    </View>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xxl,
  },

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

  switcher: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  arrow: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  arrowDisabled: { opacity: 0.3 },
  arrowText: { fontSize: 24, color: colors.text, lineHeight: 26 },
  monthLabel: {
    fontSize: fontSizes.bodyLarge,
    fontWeight: "bold",
    color: colors.text,
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
    marginBottom: spacing.md,
    fontSize: fontSizes.meta,
  },

  storyCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radii.xl,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: spacing.lg,
  },
  storyCtaGlyph: { fontSize: 26 },
  storyCtaBody: { flex: 1 },
  storyCtaTitle: {
    fontSize: fontSizes.bodyLarge,
    fontWeight: "800",
    color: colors.onPrimary,
    textAlign: "auto",
  },
  storyCtaSub: {
    fontSize: fontSizes.small,
    color: colors.onPrimaryMuted,
    textAlign: "auto",
    marginTop: 2,
  },
  storyCtaArrow: { fontSize: 24, color: colors.onPrimary },
  pdfCta: {
    alignItems: "center",
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.surface,
    paddingVertical: 12,
    marginTop: -spacing.sm,
    marginBottom: spacing.lg,
  },
  pdfCtaText: { fontSize: fontSizes.body, fontWeight: "700", color: colors.primary },

  trendCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: 18,
    marginTop: spacing.lg,
  },
  trendHead: { marginBottom: spacing.md },
  trendTitle: {
    fontSize: fontSizes.subtitle,
    fontWeight: "bold",
    color: colors.text,
    textAlign: "auto",
  },
  trendMeta: {
    fontSize: fontSizes.small,
    color: colors.textMuted,
    textAlign: "auto",
    marginTop: 2,
  },
  bars: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 90,
  },
  barSlot: {
    flex: 1,
    height: "100%",
    justifyContent: "flex-end",
    paddingHorizontal: 0.5,
  },
  bar: { width: "100%", borderRadius: 1.5, minHeight: 0 },
  axis: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  axisText: { fontSize: fontSizes.caption, color: colors.textFaint },
});
