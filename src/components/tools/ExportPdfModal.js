import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Modal from "../../platform/Modal";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import DirectionalIcon from "../ui/DirectionalIcon";
import { fontSizes, radii, spacing } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { useLocale } from "../../context/LocaleContext";
import { useTheme, useThemedStyles } from "../../context/ThemeContext";
import { useI18n } from "../../i18n";
import { printHtml } from "../../platform/browserFiles";
import { describeApiError } from "../../services/api";
import { fetchMonthlyAnalytics } from "../../services/analytics";
import { primeCategoryCatalog } from "../../services/categories";
import { ltr } from "../../utils/bidi";
import {
  currentPeriod,
  formatLocalDay,
  formatMonthYear,
  isSameOrAfterPeriod,
  shiftPeriod,
} from "../../utils/date";
import { errorFeedback, selectionFeedback, successFeedback, tapFeedback } from "../../utils/haptics";
import { formatCentimes } from "../../utils/money";
import { buildMonthlyReportHtml } from "../../utils/reportHtml";

/** A4 in PostScript points. */
const A4 = { width: 595, height: 842 };

/**
 * Picks a month, previews its totals, then renders the report to a PDF and
 * hands it straight to the native share / save sheet.
 */
export default function ExportPdfModal({ visible, onClose, initialPeriod }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t, language } = useI18n();
  const { wantsRTL } = useLocale();
  const { user } = useAuth();

  const [period, setPeriod] = useState(initialPeriod ?? currentPeriod());
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const request = useRef(null);

  useEffect(() => {
    if (visible) {
      setPeriod(initialPeriod ?? currentPeriod());
    }
    // Only on open: the in-sheet switcher owns the period after that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const load = useCallback(async (target) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError(null);
    setAnalytics(null);
    try {
      const [next] = await Promise.all([
        fetchMonthlyAnalytics({ ...target, signal: controller.signal }),
        primeCategoryCatalog(),
      ]);
      if (!controller.signal.aborted) {
        setAnalytics(next);
      }
    } catch (err) {
      if (controller.signal.aborted || err?.code === "ERR_CANCELED") {
        return;
      }
      console.log("Report data failed:", err.response?.data || err.message);
      setError(describeApiError(err));
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (visible) {
      load(period);
    }
    return () => request.current?.abort();
  }, [visible, period, load]);

  const atCurrentMonth = isSameOrAfterPeriod(period, currentPeriod());
  const periodLabel = formatMonthYear(period.month, period.year);
  const currency = analytics?.currency || "MAD";
  const summary = analytics?.summary;

  const exportPdf = async () => {
    if (!analytics || exporting) {
      return;
    }
    tapFeedback();
    setExporting(true);
    try {
      const html = buildMonthlyReportHtml({
        analytics,
        periodLabel,
        generatedLabel: formatLocalDay(new Date()),
        userName: user?.name?.trim(),
        rtl: wantsRTL,
        language,
        t,
      });
      const fileTitle = t("pdf.share_title", { period: periodLabel });
      if (Platform.OS === "web") {
        // The browser's print dialog, where "Save as PDF" is the destination.
        await printHtml(html, { title: fileTitle });
        successFeedback();
        return;
      }
      const { uri } = await Print.printToFileAsync({ html, ...A4 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          UTI: "com.adobe.pdf",
          dialogTitle: fileTitle,
        });
      } else {
        // No share target (some emulators): the print dialog can still save it.
        await Print.printAsync({ uri });
      }
      successFeedback();
    } catch (err) {
      console.log("PDF export failed:", err?.message);
      errorFeedback();
      setError(t("pdf.failed"));
    } finally {
      setExporting(false);
    }
  };

  const stat = (label, centimes, formatted, color) => (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {ltr(formatted || formatCentimes(centimes ?? 0, currency))}
      </Text>
    </View>
  );

  const net = summary?.net_savings ?? 0;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.backdrop, { direction: wantsRTL ? "rtl" : "ltr" }]}>
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Text style={styles.title}>{t("pdf.title")}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Text style={styles.close}>{t("common.cancel")}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.subtitle}>{t("pdf.subtitle")}</Text>

          <View style={styles.switcher}>
            <TouchableOpacity
              style={styles.arrow}
              onPress={() => {
                selectionFeedback();
                setPeriod((current) => shiftPeriod(current, -1));
              }}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t("analytics.prev_month")}
            >
              <DirectionalIcon glyph="›" style={styles.arrowText} />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{periodLabel}</Text>
            <TouchableOpacity
              style={[styles.arrow, atCurrentMonth && styles.arrowDisabled]}
              onPress={() => {
                selectionFeedback();
                setPeriod((current) => shiftPeriod(current, 1));
              }}
              disabled={atCurrentMonth}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t("analytics.next_month")}
            >
              <DirectionalIcon glyph="‹" style={styles.arrowText} />
            </TouchableOpacity>
          </View>

          {/* A paper-like preview of what the first page will carry. */}
          <View style={styles.paper}>
            <View style={styles.paperHead}>
              <View style={styles.logo}>
                <Text style={styles.logoText}>F</Text>
              </View>
              <View style={styles.paperHeadBody}>
                <Text style={styles.paperBrand}>FLOUSI</Text>
                <Text style={styles.paperPeriod}>{periodLabel}</Text>
              </View>
              <Text style={styles.paperGlyph}>📄</Text>
            </View>

            {loading ? (
              <ActivityIndicator style={styles.paperLoading} color={colors.primary} />
            ) : analytics ? (
              <>
                <View style={styles.stats}>
                  {stat(t("pdf.income"), summary?.total_income, summary?.total_income_formatted, colors.income)}
                  {stat(t("pdf.expenses"), summary?.total_expense, summary?.total_expense_formatted, colors.expense)}
                  {stat(
                    t("pdf.net"),
                    net,
                    summary?.net_savings_formatted,
                    net >= 0 ? colors.primary : colors.expense,
                  )}
                </View>
                <Text style={styles.paperMeta}>
                  {t("pdf.preview_meta", {
                    count: analytics.categories?.length ?? 0,
                  })}
                </Text>
              </>
            ) : null}
          </View>

          {error ? (
            <TouchableOpacity onPress={() => load(period)} activeOpacity={0.8}>
              <Text style={styles.error}>{`${error} · ${t("common.retry")}`}</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={[styles.primary, (!analytics || exporting) && styles.primaryDisabled]}
            onPress={exportPdf}
            disabled={!analytics || exporting}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            {exporting ? (
              <View style={styles.primaryRow}>
                <ActivityIndicator color={colors.onPrimary} />
                <Text style={styles.primaryText}>{t("pdf.generating")}</Text>
              </View>
            ) : (
              <Text style={styles.primaryText}>
                {t(Platform.OS === "web" ? "pdf.export_web" : "pdf.export")}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: colors.scrim, justifyContent: "flex-end" },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radii.sheet,
      borderTopRightRadius: radii.sheet,
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xxl,
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
      paddingTop: 14,
    },
    title: { fontSize: 19, fontWeight: "bold", color: colors.text },
    close: { fontSize: 15, color: colors.textMuted, fontWeight: "600" },
    subtitle: {
      fontSize: fontSizes.meta,
      color: colors.textMuted,
      textAlign: "auto",
      marginTop: 4,
    },
    switcher: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.surfaceMuted,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: spacing.lg,
      paddingHorizontal: spacing.sm,
    },
    arrow: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    arrowDisabled: { opacity: 0.3 },
    arrowText: { fontSize: 24, color: colors.text, lineHeight: 26 },
    monthLabel: { fontSize: fontSizes.bodyLarge, fontWeight: "bold", color: colors.text },

    paper: {
      marginTop: spacing.lg,
      borderRadius: radii.xl,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
      overflow: "hidden",
      minHeight: 150,
    },
    paperHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      backgroundColor: "#0A5C36",
      padding: spacing.lg,
    },
    logo: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: "#FFFFFF",
      alignItems: "center",
      justifyContent: "center",
    },
    logoText: { color: "#0A5C36", fontWeight: "900", fontSize: 18 },
    paperHeadBody: { flex: 1 },
    paperBrand: { color: "#FFFFFF", fontWeight: "900", letterSpacing: 2, fontSize: 16, textAlign: "auto" },
    paperPeriod: { color: "#C8E6C9", fontSize: fontSizes.small, textAlign: "auto" },
    paperGlyph: { fontSize: 22 },
    paperLoading: { marginVertical: spacing.xxl },
    stats: { flexDirection: "row", padding: spacing.lg, gap: spacing.sm },
    stat: { flex: 1 },
    statLabel: { fontSize: fontSizes.caption, color: colors.textMuted, fontWeight: "700", textAlign: "auto" },
    statValue: { fontSize: fontSizes.body, fontWeight: "800", marginTop: 4, textAlign: "auto" },
    paperMeta: {
      fontSize: fontSizes.small,
      color: colors.textSecondary,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.lg,
      textAlign: "auto",
    },
    error: {
      backgroundColor: colors.dangerSurface,
      color: colors.dangerText,
      borderRadius: radii.sm,
      padding: spacing.md,
      textAlign: "center",
      marginTop: spacing.md,
      fontSize: fontSizes.meta,
    },
    primary: {
      marginTop: spacing.xl,
      backgroundColor: colors.primary,
      borderRadius: radii.lg,
      paddingVertical: 15,
      alignItems: "center",
    },
    primaryDisabled: { opacity: 0.5 },
    primaryRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    primaryText: { color: colors.onPrimary, fontSize: fontSizes.bodyLarge, fontWeight: "800" },
  });
