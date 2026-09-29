import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { useAccounts } from "../../hooks/useAccounts";
import { useI18n } from "../../i18n";
import { contributeToGoal, describeGoalError } from "../../services/goals";
import { ltr } from "../../utils/bidi";
import {
  amountToCentimes,
  currencySymbol,
  formatCentimes,
  sanitizeAmountInput,
} from "../../utils/money";
import { fixedLtrRow } from "../../utils/rtl";

/**
 * Adds money to a goal, optionally drawn from an account.
 *
 * Only accounts in the goal's currency are offered — the API refuses the rest
 * (there is no FX source) — and its 422 is still translated in case an account
 * changed currency since the list was loaded.
 */
export default function ContributeModal({ visible, goal, onClose, onContributed }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useI18n();
  const { accounts, loading: loadingAccounts } = useAccounts({ enabled: visible });

  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (visible) {
      setAmount("");
      setAccountId(null);
      setError(null);
    }
  }, [visible]);

  const currency = goal?.currency || "MAD";
  const eligible = useMemo(
    () => accounts.filter((account) => account.currency === currency),
    [accounts, currency],
  );
  const hiddenOtherCurrencies = eligible.length < accounts.length;
  const centimes = amountToCentimes(amount);

  const handleSubmit = async () => {
    if (submittingRef.current || !goal) {
      return;
    }
    if (centimes <= 0) {
      setError(t("goals.errors.amount"));
      return;
    }

    submittingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const updated = await contributeToGoal(goal.id, {
        amountCentimes: centimes,
        accountId,
      });
      onContributed?.(updated, { fromAccount: Boolean(accountId) });
    } catch (err) {
      console.log("Contribution failed:", err.response?.data || err.message);
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
              <Text style={styles.headerTitle} numberOfLines={1}>
                {t("goals.contribute.title")}
              </Text>
              <TouchableOpacity onPress={onClose} hitSlop={12}>
                <Text style={styles.close}>{t("common.cancel")}</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {goal ? (
                <Text style={styles.goalLine} numberOfLines={1}>
                  {`${goal.icon || "🎯"} ${goal.name}`}
                </Text>
              ) : null}

              <Text style={styles.label}>{t("goals.contribute.amount")}</Text>
              <View style={styles.amountRow}>
                <TextInput
                  style={styles.amountInput}
                  value={amount}
                  onChangeText={(text) => setAmount(sanitizeAmountInput(text))}
                  placeholder="0"
                  placeholderTextColor={colors.textPlaceholder}
                  keyboardType="decimal-pad"
                  autoFocus
                  editable={!saving}
                />
                <Text style={styles.amountSuffix}>{currencySymbol(currency)}</Text>
              </View>
              {centimes > 0 ? (
                <Text style={styles.preview}>{formatCentimes(centimes, currency)}</Text>
              ) : null}

              <Text style={styles.label}>{t("goals.contribute.account")}</Text>
              {loadingAccounts && accounts.length === 0 ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.accountRow}
                >
                  <AccountChip
                    label={t("goals.contribute.no_account")}
                    active={accountId === null}
                    onPress={() => setAccountId(null)}
                  />
                  {eligible.map((account) => (
                    <AccountChip
                      key={account.id}
                      label={account.name}
                      meta={ltr(account.balance_formatted)}
                      active={account.id === accountId}
                      onPress={() => setAccountId(account.id)}
                    />
                  ))}
                </ScrollView>
              )}
              <Text style={styles.hint}>
                {accountId
                  ? t("goals.contribute.account_hint")
                  : t("goals.contribute.no_account_hint")}
              </Text>
              {hiddenOtherCurrencies ? (
                <Text style={styles.hint}>
                  {t("goals.contribute.other_currency_hint", { currency })}
                </Text>
              ) : null}

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.submit, saving && styles.submitDisabled]}
                onPress={handleSubmit}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <Text style={styles.submitText}>{t("goals.contribute.submit")}</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function AccountChip({ label, meta, active, onPress }) {
  const styles = useThemedStyles(createStyles);
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]} numberOfLines={1}>
        {label}
      </Text>
      {meta ? <Text style={styles.chipMeta}>{meta}</Text> : null}
    </TouchableOpacity>
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
      flexShrink: 1,
      fontSize: fontSizes.subtitle,
      fontWeight: "bold",
      color: colors.text,
    },
    close: {
      fontSize: fontSizes.bodyLarge,
      color: colors.textMuted,
      fontWeight: "600",
    },
    goalLine: {
      fontSize: fontSizes.bodyLarge,
      fontWeight: "600",
      color: colors.textSecondary,
      textAlign: "auto",
    },
    label: {
      fontSize: fontSizes.meta,
      fontWeight: "600",
      color: colors.textSecondary,
      textAlign: "auto",
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
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
    accountRow: { flexDirection: "row", gap: spacing.sm },
    chip: {
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingVertical: 10,
      paddingHorizontal: 14,
      minWidth: 96,
    },
    chipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    chipLabel: {
      fontSize: fontSizes.body,
      fontWeight: "600",
      color: colors.text,
      textAlign: "auto",
    },
    chipLabelActive: { color: colors.primary },
    chipMeta: {
      fontSize: fontSizes.caption,
      color: colors.textMuted,
      marginTop: 3,
      textAlign: "auto",
    },
    hint: {
      fontSize: fontSizes.small,
      color: colors.textFaint,
      marginTop: spacing.sm,
      textAlign: "auto",
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
    submitDisabled: { opacity: 0.7 },
    submitText: {
      color: colors.onPrimary,
      fontSize: fontSizes.subtitle,
      fontWeight: "bold",
    },
  });
