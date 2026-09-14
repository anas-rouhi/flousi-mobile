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
import { describeValidationError } from "../../services/api";
import { createAccount } from "../../services/accounts";
import {
  amountToCentimes,
  currencySymbol,
  formatCentimes,
  sanitizeAmountInput,
} from "../../utils/money";

/**
 * Account types the API accepts. `other` is in the enum too but is omitted
 * here — it means nothing to a user choosing where their money sits.
 */
const TYPES = [
  { value: "cash", label: "كاش", hint: "Cash" },
  { value: "bank", label: "بنك", hint: "Bank" },
  { value: "credit_card", label: "بطاقة", hint: "Carte" },
];

export default function CreateAccountModal({
  visible,
  onClose,
  onCreated,
  currency = "MAD",
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [name, setName] = useState("");
  const [type, setType] = useState("cash");
  const [balance, setBalance] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Guards against a double tap landing two accounts, and against setting
  // state after the sheet has closed.
  const submittingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

  useEffect(() => {
    if (visible) {
      setName("");
      setType("cash");
      setBalance("");
      setError(null);
    }
  }, [visible]);

  const openingCentimes = amountToCentimes(balance);

  const handleSubmit = async () => {
    if (submittingRef.current) {
      return;
    }
    if (!name.trim()) {
      setError("عفاك دخل سمية الحساب");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      // Optional in the UI, required by the API — an empty field means 0.
      // The API wants integer centimes here (unlike transactions, which take
      // major units), and `amountToCentimes` produces that without a float.
      const created = await createAccount({
        name: name.trim(),
        type,
        openingCentimes: openingCentimes,
      });
      onCreated?.(created);
      onClose?.();
    } catch (err) {
      console.log("Create account failed:", err.response?.data || err.message);
      if (mountedRef.current) {
        setError(describeValidationError(err));
      }
    } finally {
      submittingRef.current = false;
      if (mountedRef.current) {
        setSubmitting(false);
      }
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
              <Text style={styles.headerTitle}>حساب جديد</Text>
              <TouchableOpacity onPress={onClose} hitSlop={12}>
                <Text style={styles.close}>إلغاء</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.label}>السمية</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="مثلا: CIH Bank ولا كاش"
                placeholderTextColor={colors.textPlaceholder}
                maxLength={191}
                autoFocus
                editable={!submitting}
              />

              <Text style={styles.label}>النوع</Text>
              <View style={styles.types}>
                {TYPES.map((option) => {
                  const active = option.value === type;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[styles.typeTile, active && styles.typeTileActive]}
                      onPress={() => setType(option.value)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.typeLabel,
                          active && styles.typeLabelActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                      <Text style={styles.typeHint}>{option.hint}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.label}>الرصيد الحالي (اختياري)</Text>
              <View style={styles.balanceRow}>
                <TextInput
                  style={styles.balanceInput}
                  value={balance}
                  onChangeText={(text) => setBalance(sanitizeAmountInput(text))}
                  placeholder="0"
                  placeholderTextColor={colors.textPlaceholder}
                  keyboardType="decimal-pad"
                  editable={!submitting}
                />
                <Text style={styles.balanceSuffix}>
                  {currencySymbol(currency)}
                </Text>
              </View>
              {openingCentimes > 0 ? (
                <Text style={styles.balancePreview}>
                  {formatCentimes(openingCentimes, currency)}
                </Text>
              ) : null}

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.submit, submitting && styles.submitDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <Text style={styles.submitText}>صاوب الحساب</Text>
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
    flexDirection: "row-reverse",
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
    textAlign: "right",
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
    textAlign: "right",
  },

  types: { flexDirection: "row-reverse" },
  typeTile: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    marginLeft: spacing.sm,
    alignItems: "center",
  },
  typeTileActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  typeLabel: {
    fontSize: fontSizes.body,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  typeLabelActive: { color: colors.primary, fontWeight: "bold" },
  typeHint: {
    fontSize: fontSizes.caption,
    color: colors.textFaint,
    marginTop: 2,
  },

  balanceRow: { flexDirection: "row", alignItems: "center" },
  balanceInput: {
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
  balanceSuffix: {
    fontSize: fontSizes.subtitle,
    fontWeight: "600",
    color: colors.textMuted,
    marginLeft: spacing.sm,
  },
  balancePreview: {
    fontSize: fontSizes.meta,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: 6,
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
