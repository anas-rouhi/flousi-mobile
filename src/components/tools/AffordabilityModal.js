import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { fontSizes, radii, spacing } from "../../constants/theme";
import { useLocale } from "../../context/LocaleContext";
import { useTheme, useThemedStyles } from "../../context/ThemeContext";
import { useI18n } from "../../i18n";
import { ltr } from "../../utils/bidi";
import {
  dangerFeedback,
  selectionFeedback,
  successFeedback,
  warningFeedback,
} from "../../utils/haptics";
import {
  amountToCentimes,
  centimesOf,
  currencySymbol,
  formatCentimes,
  sanitizeAmountInput,
} from "../../utils/money";
import { fixedLtrRow } from "../../utils/rtl";

/** Presets, in major units. */
const PRESETS = [300, 800, 2000, 5000];

/** Formats a preset for its chip: "2 000 DH". */
function presetLabel(value, currency) {
  return `${String(value).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ${currencySymbol(currency)}`;
}

/**
 * The verdict for buying something at `price` centimes, from the month so far.
 *
 * The question it answers: after this purchase, is there still enough to cover
 * the rest of the month at the pace the user has been spending?
 *
 *  - danger: more than the balance, or what is left would not even cover the
 *    expected spending until month end.
 *  - tight: covered, but with little room — it breaks the budget, leaves less
 *    than one and a half times the expected spending, or eats over a third of
 *    the balance.
 *  - safe: none of the above.
 */
export function assessPurchase({ price, balance, monthExpenses, budget, now = new Date() }) {
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const daysLeft = Math.max(daysInMonth - dayOfMonth, 0);
  const dailyPace = monthExpenses > 0 ? monthExpenses / dayOfMonth : 0;
  const expectedRest = Math.round(dailyPace * daysLeft);
  const after = balance - price;
  const budgetLeft = budget?.hasBudget ? budget.remainingCentimes : null;
  const share = balance > 0 ? price / balance : Infinity;

  let level = "safe";
  if (price > balance || after < expectedRest) {
    level = "danger";
  } else if (
    (budgetLeft !== null && price > budgetLeft) ||
    after < expectedRest * 1.5 ||
    share > 1 / 3
  ) {
    level = "tight";
  }

  return { level, after, expectedRest, daysLeft, budgetLeft, share };
}

const VERDICT_FEEDBACK = {
  safe: successFeedback,
  tight: warningFeedback,
  danger: dangerFeedback,
};

export default function AffordabilityModal({ visible, onClose, stats, budget, currency = "MAD" }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useI18n();
  const { wantsRTL } = useLocale();
  const [amount, setAmount] = useState("");

  const glow = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const lastLevel = useRef(null);
  const hapticTimer = useRef(null);

  useEffect(() => {
    if (visible) {
      setAmount("");
      lastLevel.current = null;
      glow.setValue(0);
    }
    return () => clearTimeout(hapticTimer.current);
  }, [visible, glow]);

  const price = amountToCentimes(amount);
  const balance = centimesOf(stats?.balance);
  const monthExpenses = centimesOf(stats?.month?.expenses);

  const verdict = useMemo(
    () => (price > 0 ? assessPurchase({ price, balance, monthExpenses, budget }) : null),
    [price, balance, monthExpenses, budget],
  );
  const level = verdict?.level ?? null;

  /**
   * The card pops and glows when the verdict changes — not on every keystroke
   * — and the haptic waits for typing to settle so a user entering "5000"
   * does not feel four verdicts go by.
   */
  useEffect(() => {
    if (level === lastLevel.current) {
      return;
    }
    lastLevel.current = level;
    Animated.timing(glow, {
      toValue: level ? 1 : 0,
      duration: 260,
      useNativeDriver: true,
    }).start();
    if (!level) {
      return;
    }
    pop.setValue(0.94);
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 140, useNativeDriver: true }).start();

    clearTimeout(hapticTimer.current);
    hapticTimer.current = setTimeout(() => VERDICT_FEEDBACK[level]?.(), 250);
  }, [level, glow, pop]);

  const tone = {
    safe: { color: colors.success, surface: colors.primarySoft },
    tight: { color: colors.warning, surface: colors.budgetWarningSurface },
    danger: { color: colors.danger, surface: colors.budgetOverSurface },
  }[level ?? "safe"];

  const reasons = verdict
    ? [
        t("afford.after", { amount: formatCentimes(verdict.after, currency) }),
        verdict.expectedRest > 0
          ? t("afford.expected_rest", {
              amount: formatCentimes(verdict.expectedRest, currency),
              count: verdict.daysLeft,
            })
          : null,
        verdict.budgetLeft !== null
          ? verdict.budgetLeft > 0
            ? t("afford.budget_left", { amount: formatCentimes(verdict.budgetLeft, currency) })
            : t("afford.budget_over")
          : null,
        Number.isFinite(verdict.share)
          ? t("afford.share", { percent: ltr(`${Math.round(verdict.share * 100)}%`) })
          : null,
      ].filter(Boolean)
    : [];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.backdrop, { direction: wantsRTL ? "rtl" : "ltr" }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.wrapper}
        >
          <View style={styles.sheet}>
            <View style={styles.grabber} />
            <View style={styles.header}>
              <Text style={styles.title}>{t("afford.title")}</Text>
              <TouchableOpacity onPress={onClose} hitSlop={12}>
                <Text style={styles.close}>{t("common.cancel")}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.subtitle}>{t("afford.subtitle")}</Text>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={styles.amountRow}>
                <TextInput
                  style={[styles.amountInput, level && { color: tone.color }]}
                  value={amount}
                  onChangeText={(text) => setAmount(sanitizeAmountInput(text))}
                  placeholder="0"
                  placeholderTextColor={colors.textPlaceholder}
                  keyboardType="decimal-pad"
                  autoFocus
                  accessibilityLabel={t("afford.amount_label")}
                />
                <Text style={styles.amountSuffix}>{currencySymbol(currency)}</Text>
              </View>

              <View style={styles.presets}>
                {PRESETS.map((value) => {
                  const active = price === value * 100;
                  return (
                    <TouchableOpacity
                      key={value}
                      style={[styles.preset, active && styles.presetActive]}
                      onPress={() => {
                        selectionFeedback();
                        setAmount(String(value));
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.presetText, active && styles.presetTextActive]}>
                        {ltr(presetLabel(value, currency))}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {verdict ? (
                <Animated.View style={[styles.verdictWrap, { transform: [{ scale: pop }] }]}>
                  {/* The glow is its own layer so only opacity animates —
                      a shadow colour change cannot run on the native driver. */}
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.glow,
                      { opacity: glow, boxShadow: `0 0 28px 4px ${tone.color}` },
                    ]}
                  />
                  <View style={[styles.verdict, { borderColor: tone.color, backgroundColor: tone.surface }]}>
                    <Text style={styles.verdictGlyph}>
                      {level === "safe" ? "🟢" : level === "tight" ? "🟡" : "🔴"}
                    </Text>
                    <Text style={[styles.verdictTitle, { color: tone.color }]}>
                      {t(`afford.verdict.${level}`)}
                    </Text>
                    <Text style={styles.verdictBody}>{t(`afford.explain.${level}`)}</Text>
                    <View style={styles.reasons}>
                      {reasons.map((line) => (
                        <Text key={line} style={styles.reason}>
                          {`• ${line}`}
                        </Text>
                      ))}
                    </View>
                  </View>
                </Animated.View>
              ) : (
                <Text style={styles.empty}>{t("afford.empty")}</Text>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: colors.scrim, justifyContent: "flex-end" },
    wrapper: { maxHeight: "92%" },
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
    amountRow: {
      flexDirection: fixedLtrRow(),
      alignItems: "center",
      justifyContent: "center",
      marginTop: spacing.xxl,
    },
    amountInput: {
      fontSize: fontSizes.amount,
      fontWeight: "bold",
      minWidth: 90,
      textAlign: "center",
      color: colors.text,
      padding: 0,
    },
    amountSuffix: {
      fontSize: 20,
      fontWeight: "600",
      color: colors.textMuted,
      marginStart: 8,
    },
    presets: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: spacing.sm,
      marginTop: spacing.xl,
    },
    preset: {
      borderRadius: radii.pill,
      borderWidth: 1.5,
      borderColor: colors.border,
      paddingVertical: 8,
      paddingHorizontal: 14,
    },
    presetActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    presetText: { fontSize: fontSizes.meta, fontWeight: "600", color: colors.textSecondary },
    presetTextActive: { color: colors.primary },
    verdictWrap: { marginTop: spacing.xxl, marginHorizontal: 4, marginBottom: spacing.sm },
    glow: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: radii.xxl,
    },
    verdict: {
      borderRadius: radii.xxl,
      borderWidth: 2,
      padding: spacing.xl,
      alignItems: "center",
    },
    verdictGlyph: { fontSize: 32 },
    verdictTitle: {
      fontSize: 22,
      fontWeight: "800",
      textAlign: "center",
      marginTop: spacing.sm,
    },
    verdictBody: {
      fontSize: fontSizes.body,
      color: colors.text,
      textAlign: "center",
      marginTop: spacing.sm,
      lineHeight: 21,
    },
    reasons: { alignSelf: "stretch", marginTop: spacing.md, gap: 4 },
    reason: {
      fontSize: fontSizes.meta,
      color: colors.textSecondary,
      textAlign: "auto",
      lineHeight: 20,
    },
    empty: {
      fontSize: fontSizes.meta,
      color: colors.textFaint,
      textAlign: "center",
      marginTop: spacing.xxl,
    },
  });
