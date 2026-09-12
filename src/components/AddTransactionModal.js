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
import { fetchAccounts } from "../services/accounts";
import { fetchCategories } from "../services/categories";
import { createTransaction } from "../services/transactions";
import { formatLocalDay } from "../utils/date";
import {
  amountToCentimes,
  currencySymbol,
  formatCentimes,
  sanitizeAmountInput,
} from "../utils/money";

const BRAND = "#0A5C36";
const INCOME = "#2ECC71";
const EXPENSE = "#E74C3C";

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
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(null);
  const [categoryId, setCategoryId] = useState(null);
  const [description, setDescription] = useState("");
  const [day, setDay] = useState(startOfToday);

  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loadingLookups, setLoadingLookups] = useState(false);
  const [lookupError, setLookupError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const resetForm = useCallback(() => {
    setType("expense");
    setAmount("");
    setCategoryId(null);
    setDescription("");
    setDay(startOfToday());
    setError(null);
  }, []);

  /**
   * Accounts and categories are fetched once per open. Both lists are small and
   * the whole category catalogue is loaded, so flipping expense/income filters
   * locally instead of hitting the network again.
   */
  const loadLookups = useCallback(async () => {
    setLoadingLookups(true);
    setLookupError(null);
    try {
      const [accountRows, categoryRows] = await Promise.all([
        fetchAccounts(),
        fetchCategories(),
      ]);
      setAccounts(accountRows);
      setCategories(categoryRows);
      // Default to the first available account, per the quick-entry goal.
      setAccountId((current) => current ?? accountRows[0]?.id ?? null);
    } catch (err) {
      console.log("Lookup load failed:", err.response?.data || err.message);
      setLookupError(describeApiError(err));
    } finally {
      setLoadingLookups(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      resetForm();
      loadLookups();
    }
  }, [visible, resetForm, loadLookups]);

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

  const selectedAccount = accounts.find((account) => account.id === accountId);
  const currency = selectedAccount?.currency || "MAD";
  const centimes = amountToCentimes(amount);
  const isToday = dayKey(day) === dayKey(startOfToday());
  const accent = type === "expense" ? EXPENSE : INCOME;

  /** Blocking problems, in the order the user would fix them. */
  const validate = () => {
    if (centimes <= 0) {
      return "دخل مبلغ صحيح أكبر من صفر";
    }
    if (!accountId) {
      return "ختار الحساب";
    }
    if (!categoryId) {
      return "ختار الفئة";
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
              <Text style={styles.headerTitle}>معاملة جديدة</Text>
              <TouchableOpacity onPress={onClose} hitSlop={12}>
                <Text style={styles.close}>إلغاء</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Expense / Income segmented control */}
              <View style={styles.segment}>
                <SegmentButton
                  label="مصروف"
                  active={type === "expense"}
                  activeColor={EXPENSE}
                  onPress={() => setType("expense")}
                />
                <SegmentButton
                  label="مدخول"
                  active={type === "income"}
                  activeColor={INCOME}
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
                  placeholderTextColor="#D5DBDE"
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

              {lookupError ? (
                <View style={styles.lookupError}>
                  <Text style={styles.lookupErrorText}>{lookupError}</Text>
                  <TouchableOpacity onPress={loadLookups}>
                    <Text style={styles.lookupRetry}>عاود المحاولة</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {loadingLookups ? (
                <ActivityIndicator
                  color={BRAND}
                  style={styles.lookupSpinner}
                  size="small"
                />
              ) : null}

              {/* Account selector */}
              <Text style={styles.label}>الحساب</Text>
              {accounts.length === 0 && !loadingLookups ? (
                <Text style={styles.emptyHint}>
                  ما عندكش حساب. زيد حساب قبل ما تسجل معاملة.
                </Text>
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
                      meta={account.balance_formatted}
                      active={account.id === accountId}
                      activeColor={account.color || BRAND}
                      onPress={() => setAccountId(account.id)}
                    />
                  ))}
                </ScrollView>
              )}

              {/* Category selector */}
              <Text style={styles.label}>الفئة</Text>
              {typeCategories.length === 0 && !loadingLookups ? (
                <Text style={styles.emptyHint}>ما كايناش فئات لهاد النوع</Text>
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
              <Text style={styles.label}>الوصف (اختياري)</Text>
              <TextInput
                style={styles.input}
                value={description}
                onChangeText={setDescription}
                placeholder="مثلا: طاكسي لـ گليز"
                placeholderTextColor="#B2BEC3"
                maxLength={1000}
                editable={!submitting}
              />

              {/* Date — quick picks plus a day stepper, clamped to today. */}
              <Text style={styles.label}>التاريخ</Text>
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
                    اليوم
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
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitText}>
                    {type === "expense" ? "زيد المصروف" : "زيد المدخول"}
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
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        active && { borderColor: activeColor, backgroundColor: "#F4F8F6" },
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
  const color = category.color || "#95A5A6";
  return (
    <TouchableOpacity
      style={[
        styles.categoryTile,
        active && { borderColor: color, backgroundColor: "#F8F9FA" },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.categoryDot, { backgroundColor: color }]} />
      <Text
        style={[styles.categoryName, active && { color, fontWeight: "bold" }]}
        numberOfLines={1}
      >
        {category.name}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheetWrapper: { maxHeight: "92%" },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  grabber: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#DDE4E6",
    alignSelf: "center",
    marginTop: 10,
  },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: "#2C3E50" },
  close: { fontSize: 15, color: "#95A5A6", fontWeight: "600" },

  segment: {
    flexDirection: "row-reverse",
    backgroundColor: "#F1F4F5",
    borderRadius: 12,
    padding: 4,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 9,
    alignItems: "center",
  },
  segmentText: { fontSize: 15, fontWeight: "600", color: "#7F8C8D" },
  segmentTextActive: { color: "#FFFFFF", fontWeight: "bold" },

  amountRow: {
    flexDirection: "row",
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
    color: "#95A5A6",
    marginLeft: 8,
  },
  amountPreview: {
    fontSize: 13,
    color: "#95A5A6",
    textAlign: "center",
    marginTop: 4,
  },

  lookupError: {
    backgroundColor: "#FDECEA",
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
    alignItems: "center",
  },
  lookupErrorText: { color: "#C0392B", fontSize: 13, textAlign: "center" },
  lookupRetry: { color: BRAND, fontWeight: "bold", fontSize: 13, marginTop: 6 },
  lookupSpinner: { marginTop: 16 },

  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#7F8C8D",
    textAlign: "right",
    marginTop: 22,
    marginBottom: 10,
  },
  emptyHint: {
    fontSize: 13,
    color: "#B2BEC3",
    textAlign: "right",
  },

  chipRow: { flexDirection: "row-reverse", paddingLeft: 4 },
  chip: {
    borderWidth: 1.5,
    borderColor: "#E4E9EC",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginLeft: 8,
    minWidth: 104,
    alignItems: "flex-end",
  },
  chipLabel: { fontSize: 14, fontWeight: "600", color: "#2C3E50" },
  chipMeta: { fontSize: 11, color: "#95A5A6", marginTop: 3 },

  categoryGrid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
  },
  categoryTile: {
    flexDirection: "row-reverse",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#E4E9EC",
    borderRadius: 11,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginLeft: 8,
    marginBottom: 8,
  },
  categoryDot: { width: 9, height: 9, borderRadius: 5, marginLeft: 7 },
  categoryName: { fontSize: 13, color: "#2C3E50", maxWidth: 130 },

  input: {
    backgroundColor: "#F8F9FA",
    borderWidth: 1,
    borderColor: "#E4E9EC",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    color: "#2C3E50",
    textAlign: "right",
  },

  dateRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  datePick: {
    borderWidth: 1.5,
    borderColor: "#E4E9EC",
    borderRadius: 11,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  datePickActive: { borderColor: BRAND, backgroundColor: "#F4F8F6" },
  datePickText: { fontSize: 14, fontWeight: "600", color: "#7F8C8D" },
  datePickTextActive: { color: BRAND },
  stepper: {
    flexDirection: "row-reverse",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
    borderRadius: 11,
    paddingHorizontal: 6,
  },
  stepperButton: { paddingHorizontal: 12, paddingVertical: 8 },
  stepperButtonDisabled: { opacity: 0.3 },
  stepperIcon: { fontSize: 22, color: "#2C3E50", lineHeight: 24 },
  stepperLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2C3E50",
    minWidth: 92,
    textAlign: "center",
  },

  error: {
    backgroundColor: "#FDECEA",
    color: "#C0392B",
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
  submitText: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold" },
});
