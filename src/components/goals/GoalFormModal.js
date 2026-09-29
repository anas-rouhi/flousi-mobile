import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import Modal from "../../platform/Modal";
import { fontSizes, radii, spacing } from "../../constants/theme";
import { useTheme, useThemedStyles } from "../../context/ThemeContext";
import { CURRENCIES, useI18n } from "../../i18n";
import { createGoal, describeGoalError, updateGoal } from "../../services/goals";
import { formatLocalDay } from "../../utils/date";
import {
  amountToCentimes,
  currencySymbol,
  formatCentimes,
  sanitizeAmountInput,
} from "../../utils/money";
import { fixedLtrRow } from "../../utils/rtl";
import DirectionalIcon from "../ui/DirectionalIcon";
import { parseGoalDate } from "./GoalCard";

const ICONS = ["🎯", "✈️", "🏠", "🚗", "🎓", "💍", "📱", "🏖️", "💰", "🕋"];
const COLORS = [
  "#0A5C36",
  "#10B981",
  "#1F6F8B",
  "#3B82F6",
  "#5B4B8A",
  "#C97B0B",
  "#EF4444",
  "#E91E63",
];
const NAME_MAX = 120;

/** 150050 => "1500.50"; whole amounts stay "15000". Integer maths only. */
function centimesToInput(centimes) {
  const value = Math.max(Math.trunc(centimes) || 0, 0);
  const units = Math.trunc(value / 100);
  const cents = value % 100;
  return cents ? `${units}.${String(cents).padStart(2, "0")}` : String(units);
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Same day `months` later, clamped to the month's end (31 Jan + 1 → 28 Feb). */
function addMonths(date, months) {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(date.getDate(), lastDay));
  return target;
}

/** Local calendar day as the API's "YYYY-MM-DD". */
function toApiDate(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Create or edit a savings goal. Passing `goal` switches to edit mode and
 * pre-fills every field from it.
 *
 * The deadline is stepped a month at a time rather than picked from a calendar
 * (no date-picker dependency is installed); the API only requires it to be
 * after today, which the "back" step enforces.
 */
export default function GoalFormModal({
  visible,
  goal = null,
  defaultCurrency = "MAD",
  onClose,
  onSaved,
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useI18n();
  const editing = Boolean(goal);

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [targetDate, setTargetDate] = useState(null);
  const [icon, setIcon] = useState(ICONS[0]);
  const [color, setColor] = useState(COLORS[0]);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const submittingRef = useRef(false);

  // Keyed on the goal's id, not the object: the list behind the sheet refetches
  // on focus, and a fresh copy of the same goal must not wipe what is typed.
  const goalId = goal?.id ?? null;
  useEffect(() => {
    if (!visible) {
      return;
    }
    setError(null);
    setName(goal?.name ?? "");
    setAmount(goal ? centimesToInput(goal.target_amount) : "");
    setCurrency(
      goal?.currency ??
        (CURRENCIES.includes(defaultCurrency) ? defaultCurrency : "MAD"),
    );
    setTargetDate(parseGoalDate(goal?.target_date));
    setIcon(goal?.icon || ICONS[0]);
    setColor(goal?.color || COLORS[0]);
  }, [visible, goalId]);

  const centimes = amountToCentimes(amount);
  const today = startOfToday();
  const canStepBack = targetDate ? addMonths(targetDate, -1) > today : false;

  const stepDate = (delta) => {
    setTargetDate((current) => {
      if (!current) {
        return delta > 0 ? addMonths(today, 1) : null;
      }
      const next = addMonths(current, delta);
      return next > today ? next : current;
    });
  };

  const handleSave = async () => {
    if (submittingRef.current) {
      return;
    }
    if (!name.trim() || name.trim().length > NAME_MAX) {
      setError(t("goals.errors.name"));
      return;
    }
    if (centimes <= 0) {
      setError(t("goals.errors.target_amount"));
      return;
    }

    submittingRef.current = true;
    setSaving(true);
    setError(null);
    const payload = {
      name: name.trim(),
      targetCentimes: centimes,
      currency,
      targetDate: targetDate ? toApiDate(targetDate) : null,
      icon,
      color,
    };
    try {
      const saved = editing
        ? await updateGoal(goal.id, payload)
        : await createGoal(payload);
      onSaved?.(saved, { created: !editing });
    } catch (err) {
      console.log("Goal save failed:", err.response?.data || err.message);
      setError(describeGoalError(err));
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.sheetWrapper}
        >
          <View style={styles.sheet}>
            <View style={styles.grabber} />
            <View style={styles.header}>
              <Text style={styles.headerTitle}>
                {editing ? t("goals.form.edit_title") : t("goals.form.create_title")}
              </Text>
              <TouchableOpacity onPress={onClose} hitSlop={12}>
                <Text style={styles.close}>{t("common.cancel")}</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.label}>{t("goals.form.name")}</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder={t("goals.form.name_placeholder")}
                placeholderTextColor={colors.textPlaceholder}
                maxLength={NAME_MAX}
                editable={!saving}
              />

              <Text style={styles.label}>{t("goals.form.target_amount")}</Text>
              <View style={styles.amountRow}>
                <TextInput
                  style={styles.amountInput}
                  value={amount}
                  onChangeText={(text) => setAmount(sanitizeAmountInput(text))}
                  placeholder="0"
                  placeholderTextColor={colors.textPlaceholder}
                  keyboardType="decimal-pad"
                  editable={!saving}
                />
                <Text style={styles.amountSuffix}>{currencySymbol(currency)}</Text>
              </View>
              {centimes > 0 ? (
                <Text style={styles.preview}>{formatCentimes(centimes, currency)}</Text>
              ) : null}

              <Text style={styles.label}>{t("goals.form.currency")}</Text>
              <View style={styles.chips}>
                {CURRENCIES.map((code) => {
                  const active = code === currency;
                  return (
                    <TouchableOpacity
                      key={code}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setCurrency(code)}
                      disabled={saving}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {`${code} · ${currencySymbol(code)}`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.label}>{t("goals.form.target_date")}</Text>
              <View style={styles.dateRow}>
                <TouchableOpacity
                  style={[styles.chip, !targetDate && styles.chipActive]}
                  onPress={() => setTargetDate(null)}
                  disabled={saving}
                >
                  <Text style={[styles.chipText, !targetDate && styles.chipTextActive]}>
                    {t("goals.form.no_date")}
                  </Text>
                </TouchableOpacity>

                <View style={styles.stepper}>
                  <TouchableOpacity
                    style={[styles.stepperButton, !canStepBack && styles.disabled]}
                    onPress={() => stepDate(-1)}
                    disabled={!canStepBack || saving}
                    hitSlop={8}
                  >
                    <DirectionalIcon glyph="‹" style={styles.stepperIcon} />
                  </TouchableOpacity>
                  <Text style={styles.stepperLabel}>
                    {targetDate ? formatLocalDay(targetDate) : "—"}
                  </Text>
                  <TouchableOpacity
                    style={styles.stepperButton}
                    onPress={() => stepDate(1)}
                    disabled={saving}
                    hitSlop={8}
                  >
                    <DirectionalIcon glyph="›" style={styles.stepperIcon} />
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.label}>{t("goals.form.icon")}</Text>
              <View style={styles.chips}>
                {ICONS.map((glyph) => (
                  <TouchableOpacity
                    key={glyph}
                    style={[styles.iconTile, glyph === icon && styles.chipActive]}
                    onPress={() => setIcon(glyph)}
                    disabled={saving}
                  >
                    <Text style={styles.iconGlyph}>{glyph}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>{t("goals.form.color")}</Text>
              <View style={styles.chips}>
                {COLORS.map((swatch) => (
                  <TouchableOpacity
                    key={swatch}
                    style={[
                      styles.swatch,
                      { backgroundColor: swatch },
                      swatch === color && { borderColor: colors.text },
                    ]}
                    onPress={() => setColor(swatch)}
                    disabled={saving}
                    accessibilityRole="button"
                    accessibilityState={{ selected: swatch === color }}
                  />
                ))}
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.submit, saving && styles.disabled]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <Text style={styles.submitText}>
                    {editing ? t("goals.form.save") : t("goals.form.create")}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
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
    sheetWrapper: { maxHeight: "92%" },
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
      paddingVertical: 14,
    },
    headerTitle: {
      fontSize: fontSizes.subtitle,
      fontWeight: "bold",
      color: colors.text,
    },
    close: {
      fontSize: fontSizes.bodyLarge,
      color: colors.textMuted,
      fontWeight: "600",
    },
    label: {
      fontSize: fontSizes.meta,
      fontWeight: "600",
      color: colors.textSecondary,
      textAlign: "auto",
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    input: {
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.lg,
      paddingHorizontal: spacing.lg,
      paddingVertical: 13,
      fontSize: fontSizes.bodyLarge,
      color: colors.text,
      textAlign: "auto",
    },
    amountRow: { flexDirection: fixedLtrRow(), alignItems: "center" },
    amountInput: {
      flex: 1,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.lg,
      paddingHorizontal: spacing.lg,
      paddingVertical: 13,
      fontSize: fontSizes.title,
      fontWeight: "600",
      color: colors.text,
      textAlign: "center",
    },
    amountSuffix: {
      fontSize: fontSizes.subtitle,
      fontWeight: "600",
      color: colors.textMuted,
      marginStart: spacing.sm,
    },
    preview: {
      fontSize: fontSizes.meta,
      color: colors.textMuted,
      textAlign: "center",
      marginTop: 6,
    },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    chip: {
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: 12,
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
    dateRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.sm,
    },
    stepper: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surfaceMuted,
      borderRadius: 11,
      paddingHorizontal: 6,
    },
    stepperButton: { paddingHorizontal: 12, paddingVertical: 8 },
    stepperIcon: { fontSize: 22, color: colors.text, lineHeight: 24 },
    stepperLabel: {
      fontSize: fontSizes.body,
      fontWeight: "600",
      color: colors.text,
      minWidth: 110,
      textAlign: "center",
    },
    iconTile: {
      width: 46,
      height: 46,
      borderRadius: radii.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    iconGlyph: { fontSize: 22 },
    swatch: {
      width: 34,
      height: 34,
      borderRadius: 17,
      borderWidth: 3,
      borderColor: "transparent",
    },
    error: {
      backgroundColor: colors.dangerSurface,
      color: colors.dangerText,
      borderRadius: radii.sm,
      padding: spacing.md,
      fontSize: fontSizes.meta,
      textAlign: "center",
      marginTop: spacing.lg,
    },
    submit: {
      backgroundColor: colors.primary,
      borderRadius: radii.lg,
      paddingVertical: spacing.lg,
      alignItems: "center",
      marginTop: spacing.xl,
    },
    disabled: { opacity: 0.4 },
    submitText: {
      color: colors.onPrimary,
      fontSize: fontSizes.subtitle,
      fontWeight: "bold",
    },
  });
