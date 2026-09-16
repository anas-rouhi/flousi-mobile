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
import { changePassword, describeProfileError } from "../../services/profile";

/** The API's own rule, checked here so a typo costs no round trip. */
const MIN_PASSWORD = 8;

/**
 * Changes the password from Settings.
 *
 * The current password is required: it is what proves the person holding the
 * unlocked phone is the account's owner. The session is deliberately kept —
 * the user has not changed identity, so signing them out would only be
 * punishment for good hygiene.
 */
export default function ChangePasswordModal({ visible, onClose, onChanged }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useI18n();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (visible) {
      setCurrent("");
      setNext("");
      setConfirmation("");
      setError(null);
    }
  }, [visible]);

  const handleSubmit = async () => {
    if (submittingRef.current) {
      return;
    }
    if (!current) {
      setError(t("validation.current_password_required"));
      return;
    }
    if (next.length < MIN_PASSWORD) {
      setError(t("validation.password_min", { min: MIN_PASSWORD }));
      return;
    }
    if (next !== confirmation) {
      setError(t("validation.passwords_mismatch"));
      return;
    }

    submittingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      await changePassword({
        currentPassword: current,
        password: next,
        passwordConfirmation: confirmation,
      });
      onChanged?.();
    } catch (err) {
      console.log("Password change failed:", err.response?.data || err.message);
      setError(describeProfileError(err));
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
              <Text style={styles.headerTitle}>{t("settings.password.title")}</Text>
              <TouchableOpacity onPress={onClose} hitSlop={12}>
                <Text style={styles.close}>{t("common.cancel")}</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.label}>{t("settings.password.current")}</Text>
              <TextInput
                style={styles.input}
                value={current}
                onChangeText={setCurrent}
                placeholder="••••••••"
                placeholderTextColor={colors.textFaint}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="current-password"
                editable={!saving}
              />

              <Text style={styles.label}>{t("settings.password.new")}</Text>
              <TextInput
                style={styles.input}
                value={next}
                onChangeText={setNext}
                placeholder={t("validation.password_min_placeholder", {
                  min: MIN_PASSWORD,
                })}
                placeholderTextColor={colors.textFaint}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password-new"
                editable={!saving}
              />

              <Text style={styles.label}>{t("settings.password.confirm")}</Text>
              <TextInput
                style={styles.input}
                value={confirmation}
                onChangeText={setConfirmation}
                placeholder="••••••••"
                placeholderTextColor={colors.textFaint}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password-new"
                editable={!saving}
                onSubmitEditing={handleSubmit}
                returnKeyType="go"
              />

              <Text style={styles.hint}>
                {t("validation.password_hint", { min: MIN_PASSWORD })}
              </Text>

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
                  <Text style={styles.submitText}>
                    {t("settings.password.submit")}
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
    hint: {
      fontSize: fontSizes.caption,
      color: colors.textFaint,
      textAlign: "auto",
      marginTop: spacing.sm,
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
