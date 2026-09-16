import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { fontSizes, radii, spacing } from "../../constants/theme";
import { useTheme, useThemedStyles } from "../../context/ThemeContext";
import { useI18n } from "../../i18n";
import {
  amountToCentimes,
  currencySymbol,
  formatCentimes,
  sanitizeAmountInput,
} from "../../utils/money";
import { fixedLtrRow } from "../../utils/rtl";

/**
 * Common monthly ceilings, in centimes so no conversion happens at tap time.
 * These are the amounts that cover most households here; a chip is one tap
 * versus six keystrokes, which is the whole point of the sheet.
 */
const PRESETS = [200000, 350000, 500000, 800000];

export default function SetBudgetModal({
  visible,
  onClose,
  onSave,
  currentLimitCentimes = 0,
  currency = "MAD",
  saving = false,
  error = null,
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useI18n();
  const [amount, setAmount] = useState("");
  const [localError, setLocalError] = useState(null);
  const submittingRef = useRef(false);

  // Opening on an existing budget pre-fills it, so "edit the limit" starts from
  // the current value instead of an empty field.
  useEffect(() => {
    if (visible) {
      setLocalError(null);
      setAmount(
        currentLimitCentimes > 0
          ? String(Math.trunc(currentLimitCentimes / 100))
          : "",
      );
    }
  }, [visible, currentLimitCentimes]);

  const centimes = amountToCentimes(amount);

  const handleSave = async () => {
    if (submittingRef.current) {
      return;
    }
    if (centimes <= 0) {
      setLocalError(t("validation.amount_positive_short"));
      return;
    }

    submittingRef.current = true;
    setLocalError(null);
    try {
      await onSave?.({ limitCentimes: centimes });
    } finally {
      submittingRef.current = false;
    }
  };

  const shown = localError || error;

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
                {currentLimitCentimes > 0 ? t("budget.edit") : t("budget.set")}
              </Text>
              <TouchableOpacity onPress={onClose} hitSlop={12}>
                <Text style={styles.close}>{t("common.cancel")}</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.caption}>{t("budget.modal.caption")}</Text>

              <View style={styles.amountRow}>
                <TextInput
                  style={styles.amountInput}
                  value={amount}
                  onChangeText={(text) => setAmount(sanitizeAmountInput(text))}
                  placeholder="0"
                  placeholderTextColor={colors.textFaint}
                  keyboardType="decimal-pad"
                  autoFocus
                  editable={!saving}
                />
                <Text style={styles.amountSuffix}>
                  {currencySymbol(currency)}
                </Text>
              </View>

              <Text style={styles.label}>{t("budget.modal.presets")}</Text>
              <View style={styles.presets}>
                {PRESETS.map((preset) => {
                  const active = centimes === preset;
                  return (
                    <TouchableOpacity
                      key={preset}
                      style={[styles.preset, active && styles.presetActive]}
                      onPress={() =>
                        setAmount(String(Math.trunc(preset / 100)))
                      }
                      disabled={saving}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.presetText,
                          active && styles.presetTextActive,
                        ]}
                      >
                        {formatCentimes(preset, currency)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {shown ? <Text style={styles.error}>{shown}</Text> : null}

              <TouchableOpacity
                style={[styles.submit, saving && styles.submitDisabled]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <Text style={styles.submitText}>{t("budget.modal.save")}</Text>
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

  caption: {
    fontSize: fontSizes.meta,
    color: colors.textSecondary,
    textAlign: "auto",
  },

  amountRow: {
    // Fixed order: the figure and its currency read the same either way.
    flexDirection: fixedLtrRow(),
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.lg,
  },
  amountInput: {
    fontSize: fontSizes.amount,
    fontWeight: "bold",
    color: colors.primary,
    minWidth: 110,
    textAlign: "center",
    padding: 0,
  },
  amountSuffix: {
    fontSize: fontSizes.title,
    fontWeight: "600",
    color: colors.textMuted,
    marginStart: spacing.sm,
  },

  label: {
    fontSize: fontSizes.meta,
    fontWeight: "600",
    color: colors.textSecondary,
    textAlign: "auto",
    marginTop: spacing.xxl,
    marginBottom: spacing.sm,
  },
  presets: { flexDirection: "row", flexWrap: "wrap" },
  preset: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: 14,
    marginStart: spacing.sm,
    marginBottom: spacing.sm,
  },
  presetActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  presetText: {
    fontSize: fontSizes.meta,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  presetTextActive: { color: colors.primary, fontWeight: "bold" },

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
  submitDisabled: { opacity: 0.7 },
  submitText: {
    color: colors.onPrimary,
    fontSize: fontSizes.subtitle,
    fontWeight: "bold",
  },
});
