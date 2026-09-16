import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { describeApiError, describeValidationError } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useTheme, useThemedStyles } from "../context/ThemeContext";
import { useAccounts } from "../hooks/useAccounts";
import { useI18n } from "../i18n";
import { defaultCashAccountName } from "../services/accounts";
import { fetchCategories } from "../services/categories";
import { createTransaction } from "../services/transactions";
import { formatLocalDay } from "../utils/date";
import {
  amountToCentimes,
  currencySymbol,
  formatCentimes,
  sanitizeAmountInput,
} from "../utils/money";
import { ltr } from "../utils/bidi";
import { categoryName } from "../utils/categories";
import { fixedLtrRow } from "../utils/rtl";

/** Local midnight-anchored day key, for comparing calendar days safely. */
function dayKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function addDays(date, days) {
  const copy = new Date(date.getTime());
  copy.setDate(copy.getDate() + days);
  return copy;
}

/**
 * The API rejects a future `transaction_date`. For today that means sending the
 * current instant (midnight would be fine, but noon of a past day is not "now"),
 * and for any earlier day noon local — safely inside the day in every timezone
 * the dashboard might group by.
 */
function toTransactionDate(day) {
  if (dayKey(day) === dayKey(startOfToday())) {
    return new Date().toISOString();
  }
  const noon = new Date(day.getTime());
  noon.setHours(12, 0, 0, 0);
  return noon.toISOString();
}

export default function AddTransactionModal({ visible, onClose, onCreated }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useI18n();
  const { user } = useAuth();
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState(null);
  const [description, setDescription] = useState("");
  const [day, setDay] = useState(startOfToday);

  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [lookupError, setLookupError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Accounts (and the default selection) come from the shared hook, which also
  // owns the "no wallet yet" recovery. It only fetches while the sheet is open.
  const {
    accounts,
    selectedId: accountId,
    setSelectedId: setAccountId,
    selectedAccount,
    isEmpty: noAccounts,
    loading: loadingAccounts,
    creating: creatingAccount,
    error: accountError,
    reload: reloadAccounts,
    createDefaultAccount,
  } = useAccounts({ enabled: visible });

  const loadingLookups = loadingAccounts || loadingCategories;

  const resetForm = useCallback(() => {
    setType("expense");
    setAmount("");
    setCategoryId(null);
    setDescription("");
    setDay(startOfToday());
    setError(null);
  }, []);

  /**
   * The whole category catalogue is loaded once per open — it is small, and
   * holding both types locally lets the expense/income switch be instant
   * instead of costing another round trip.
   */
  const loadCategories = useCallback(async () => {
    setLoadingCategories(true);
    setLookupError(null);
    try {
      setCategories(await fetchCategories());
    } catch (err) {
      console.log("Category load failed:", err.response?.data || err.message);
      setLookupError(describeApiError(err));
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      resetForm();
      loadCategories();
    }
  }, [visible, resetForm, loadCategories]);

  /** Retries whichever of the two lookups actually failed. */
  const retryLookups = useCallback(() => {
    if (lookupError) {
      loadCategories();
    }
    if (accountError) {
      reloadAccounts();
    }
  }, [lookupError, accountError, loadCategories, reloadAccounts]);

  const typeCategories = useMemo(
    () => categories.filter((category) => category.type === type),
    [categories, type],
  );

  // A category from the other type must not survive an expense/income switch.
  useEffect(() => {
    setCategoryId((current) =>
      current && typeCategories.some((c) => c.id === current) ? current : null,
    );
  }, [typeCategories]);

  const currency = selectedAccount?.currency || "MAD";
  const centimes = amountToCentimes(amount);
  const isToday = dayKey(day) === dayKey(startOfToday());
  const accent = type === "expense" ? colors.expense : colors.income;
  // The wallet is named in the account's language — that is what the server
  // would call it — so the button promises the name that will actually appear.
  const walletName = defaultCashAccountName(user?.preferred_language);

  /** Blocking problems, in the order the user would fix them. */
  const validate = () => {
    if (centimes <= 0) {
      return t("validation.amount_positive");
    }
    if (!accountId) {
      return t("validation.account_required");
    }
    if (!categoryId) {
      return t("validation.category_required");
    }
    return null;
  };

  const handleSubmit = async () => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const created = await createTransaction({
        accountId,
        categoryId,
        type,
        // The sanitized decimal string, not a float.
        amount: sanitizeAmountInput(amount),
        description,
        transactionDate: toTransactionDate(day),
      });
      onCreated?.(created);
      onClose?.();
    } catch (err) {
      console.log("Create transaction failed:", err.response?.data || err.message);
      setError(describeValidationError(err));
    } finally {
      setSubmitting(false);
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
            {/* Handle + header */}
            <View style={styles.grabber} />
            <View style={styles.header}>
              <Text style={styles.headerTitle}>
                {t("add_transaction.title")}
              </Text>
              <TouchableOpacity onPress={onClose} hitSlop={12}>
                <Text style={styles.close}>{t("common.cancel")}</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Expense / Income segmented control */}
              <View style={styles.segment}>
                <SegmentButton
                  label={t("add_transaction.types.expense")}
                  active={type === "expense"}
                  activeColor={colors.expense}
                  onPress={() => setType("expense")}
                />
                <SegmentButton
                  label={t("add_transaction.types.income")}
                  active={type === "income"}
                  activeColor={colors.income}
                  onPress={() => setType("income")}
                />
              </View>

              {/* Amount */}
              <View style={styles.amountRow}>
                <TextInput
                  style={[styles.amountInput, { color: accent }]}
                  value={amount}
                  onChangeText={(text) => setAmount(sanitizeAmountInput(text))}
                  placeholder="0"
                  placeholderTextColor={colors.textPlaceholder}
                  keyboardType="decimal-pad"
                  autoFocus
                  editable={!submitting}
                />
                <Text style={styles.amountSuffix}>{currencySymbol(currency)}</Text>
              </View>
              {centimes > 0 ? (
                <Text style={styles.amountPreview}>
                  {formatCentimes(centimes, currency)}
                </Text>
              ) : null}

              {lookupError || accountError ? (
                <View style={styles.lookupError}>
                  <Text style={styles.lookupErrorText}>
                    {lookupError || accountError}
                  </Text>
                  <TouchableOpacity onPress={retryLookups}>
                    <Text style={styles.lookupRetry}>{t("common.retry")}</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {loadingLookups ? (
                <ActivityIndicator
                  color={colors.primary}
                  style={styles.lookupSpinner}
                  size="small"
                />
              ) : null}

              {/* Account selector */}
              <Text style={styles.label}>{t("add_transaction.account")}</Text>
              {noAccounts ? (
                // A user with no wallet used to be stuck here with nothing to
                // tap. One press creates the starter cash account and selects it.
                <View style={styles.noAccount}>
                  <Text style={styles.noAccountText}>
                    {t("add_transaction.no_wallet", { name: walletName })}
                  </Text>
                  <TouchableOpacity
                    style={styles.noAccountButton}
                    onPress={createDefaultAccount}
                    disabled={creatingAccount}
                    activeOpacity={0.85}
                  >
                    {creatingAccount ? (
                      <ActivityIndicator color={colors.onPrimary} size="small" />
                    ) : (
                      <Text style={styles.noAccountButtonText}>
                        {t("add_transaction.create_wallet", { name: walletName })}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipRow}
                >
                  {accounts.map((account) => (
                    <Chip
                      key={account.id}
                      label={account.name}
                      meta={ltr(account.balance_formatted)}
                      active={account.id === accountId}
                      activeColor={account.color || colors.primary}
                      onPress={() => setAccountId(account.id)}
                    />
                  ))}
                </ScrollView>
              )}

              {/* Category selector */}
              <Text style={styles.label}>{t("add_transaction.category")}</Text>
              {typeCategories.length === 0 && !loadingLookups ? (
                <Text style={styles.emptyHint}>
                  {t("add_transaction.no_categories")}
                </Text>
              ) : (
                <View style={styles.categoryGrid}>
                  {typeCategories.map((category) => (
                    <CategoryTile
                      key={category.id}
                      category={category}
                      active={category.id === categoryId}
                      onPress={() => setCategoryId(category.id)}
                    />
                  ))}
                </View>
              )}

              {/* Description */}
              <Text style={styles.label}>{t("add_transaction.description")}</Text>
              <TextInput
                style={styles.input}
                value={description}
                onChangeText={setDescription}
                placeholder={t("add_transaction.description_placeholder")}
                placeholderTextColor={colors.textFaint}
                maxLength={1000}
                editable={!submitting}
              />

              {/* Date — quick picks plus a day stepper, clamped to today. */}
              <Text style={styles.label}>{t("add_transaction.date")}</Text>
              <View style={styles.dateRow}>
                <TouchableOpacity
                  style={[styles.datePick, isToday && styles.datePickActive]}
                  onPress={() => setDay(startOfToday())}
                >
                  <Text
                    style={[
                      styles.datePickText,
                      isToday && styles.datePickTextActive,
                    ]}
                  >
                    {t("common.today")}
                  </Text>
                </TouchableOpacity>

                <View style={styles.stepper}>
                  <TouchableOpacity
                    style={styles.stepperButton}
                    onPress={() => setDay((current) => addDays(current, -1))}
                    hitSlop={8}
                  >
                    <Text style={styles.stepperIcon}>‹</Text>
                  </TouchableOpacity>
                  <Text style={styles.stepperLabel}>
                    {formatLocalDay(day)}
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.stepperButton,
                      isToday && styles.stepperButtonDisabled,
                    ]}
                    // The API rejects future dates, so today is the ceiling.
                    disabled={isToday}
                    onPress={() => setDay((current) => addDays(current, 1))}
                    hitSlop={8}
                  >
                    <Text style={styles.stepperIcon}>›</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <TouchableOpacity
                style={[
                  styles.submit,
                  { backgroundColor: accent },
                  submitting && styles.submitDisabled,
                ]}
                onPress={handleSubmit}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <Text style={styles.submitText}>
                    {type === "expense"
                      ? t("add_transaction.submit_expense")
                      : t("add_transaction.submit_income")}
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

function SegmentButton({ label, active, activeColor, onPress }) {
  const styles = useThemedStyles(createStyles);
  return (
    <TouchableOpacity
      style={[
        styles.segmentButton,
        active && { backgroundColor: activeColor },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text
        style={[styles.segmentText, active && styles.segmentTextActive]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function Chip({ label, meta, active, activeColor, onPress }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        active && { borderColor: activeColor, backgroundColor: colors.primarySoft },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.chipLabel, active && { color: activeColor }]}>
        {label}
      </Text>
      {meta ? <Text style={styles.chipMeta}>{meta}</Text> : null}
    </TouchableOpacity>
  );
}

function CategoryTile({ category, active, onPress }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  // Subscribes the tile to language changes, so its name re-resolves.
  useI18n();
  const color = category.color || colors.textMuted;
  return (
    <TouchableOpacity
      style={[
        styles.categoryTile,
        active && { borderColor: color, backgroundColor: colors.surfaceMuted },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.categoryDot, { backgroundColor: color }]} />
      <Text
        style={[styles.categoryName, active && { color, fontWeight: "bold" }]}
        numberOfLines={1}
      >
        {categoryName(category)}
      </Text>
    </TouchableOpacity>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheetWrapper: { maxHeight: "92%" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 24,
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
  headerTitle: { fontSize: 18, fontWeight: "bold", color: colors.text },
  close: { fontSize: 15, color: colors.textMuted, fontWeight: "600" },

  segment: {
    flexDirection: "row",
    backgroundColor: colors.surfaceSunken,
    borderRadius: 12,
    padding: 4,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 9,
    alignItems: "center",
  },
  segmentText: { fontSize: 15, fontWeight: "600", color: colors.textSecondary },
  segmentTextActive: { color: colors.onPrimary, fontWeight: "bold" },

  amountRow: {
    // Fixed order: the figure and its currency read the same either way.
    flexDirection: fixedLtrRow(),
    alignItems: "center",
    justifyContent: "center",
    marginTop: 22,
  },
  amountInput: {
    fontSize: 44,
    fontWeight: "bold",
    minWidth: 90,
    textAlign: "center",
    padding: 0,
  },
  amountSuffix: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.textMuted,
    marginStart: 8,
  },
  amountPreview: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: 4,
  },

  lookupError: {
    backgroundColor: colors.dangerSurface,
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
    alignItems: "center",
  },
  lookupErrorText: { color: colors.dangerText, fontSize: 13, textAlign: "center" },
  lookupRetry: { color: colors.primary, fontWeight: "bold", fontSize: 13, marginTop: 6 },
  lookupSpinner: { marginTop: 16 },

  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
    textAlign: "auto",
    marginTop: 22,
    marginBottom: 10,
  },
  noAccount: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    padding: 14,
  },
  noAccountText: {
    fontSize: 13,
    lineHeight: 21,
    color: colors.textSecondary,
    textAlign: "auto",
    marginBottom: 12,
  },
  noAccountButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  noAccountButtonText: { color: colors.onPrimary, fontSize: 14, fontWeight: "bold" },

  emptyHint: {
    fontSize: 13,
    color: colors.textFaint,
    textAlign: "auto",
  },

  chipRow: { flexDirection: "row", paddingStart: 4 },
  chip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginStart: 8,
    minWidth: 104,
    alignItems: "flex-end",
  },
  chipLabel: { fontSize: 14, fontWeight: "600", color: colors.text },
  chipMeta: { fontSize: 11, color: colors.textMuted, marginTop: 3 },

  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  categoryTile: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 11,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginStart: 8,
    marginBottom: 8,
  },
  categoryDot: { width: 9, height: 9, borderRadius: 5, marginStart: 7 },
  categoryName: { fontSize: 13, color: colors.text, maxWidth: 130 },

  input: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    color: colors.text,
    textAlign: "auto",
  },

  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  datePick: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 11,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  datePickActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  datePickText: { fontSize: 14, fontWeight: "600", color: colors.textSecondary },
  datePickTextActive: { color: colors.primary },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 11,
    paddingHorizontal: 6,
  },
  stepperButton: { paddingHorizontal: 12, paddingVertical: 8 },
  stepperButtonDisabled: { opacity: 0.3 },
  stepperIcon: { fontSize: 22, color: colors.text, lineHeight: 24 },
  stepperLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    minWidth: 92,
    textAlign: "center",
  },

  error: {
    backgroundColor: colors.dangerSurface,
    color: colors.dangerText,
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    textAlign: "center",
    marginTop: 18,
  },

  submit: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 20,
  },
  submitDisabled: { opacity: 0.7 },
  submitText: { color: colors.onPrimary, fontSize: 16, fontWeight: "bold" },
});
