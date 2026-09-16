import React, { useEffect, useRef, useState } from "react";
import {
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme, useThemedStyles } from "../context/ThemeContext";
import { isRetryableError, describeApiError } from "../services/api";
import { resetPassword, isDeadLinkError, fieldError } from "../services/password";
import { useI18n } from "../i18n";
import { ltr } from "../utils/bidi";

const MIN_PASSWORD = 8;

/**
 * Reached only through the reset link in the email.
 *
 * `token` and `email` arrive as route params: React Navigation's `linking`
 * config parses the deep link's query string for us, on a cold start and while
 * the app is already running alike, so this screen never touches Linking
 * itself. A link opened without them — hand-typed, or truncated by a mail
 * client — lands on the dead-link state rather than a blank form.
 */
export default function ResetPasswordScreen({ navigation, route }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useI18n();

  const token = route?.params?.token ?? null;
  const email = route?.params?.email ?? null;
  const linkIsComplete = Boolean(token && email);

  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState(null);
  const [passwordError, setPasswordError] = useState(null);
  const [deadLink, setDeadLink] = useState(!linkIsComplete);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submittingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

  // A second link can arrive while this screen is already open (the user taps
  // an older email). Treat the new params as a fresh start.
  useEffect(() => {
    if (linkIsComplete) {
      setDeadLink(false);
      setError(null);
      setPasswordError(null);
    }
  }, [token, email, linkIsComplete]);

  const handleSubmit = async () => {
    if (submittingRef.current) {
      return;
    }

    setError(null);
    setPasswordError(null);

    if (password.length < MIN_PASSWORD) {
      setPasswordError(t("validation.password_min", { min: MIN_PASSWORD }));
      return;
    }
    if (password !== confirmation) {
      setPasswordError(t("validation.passwords_mismatch"));
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    try {
      await resetPassword({
        email,
        token,
        password,
        passwordConfirmation: confirmation,
      });
      if (mountedRef.current) {
        setDone(true);
      }
    } catch (err) {
      if (!mountedRef.current) {
        return;
      }
      // A spent or expired link is reported on `email`, which the user never
      // typed — so it means the link, not the address.
      if (isDeadLinkError(err)) {
        setDeadLink(true);
      } else if (fieldError(err, "password")) {
        setPasswordError(fieldError(err, "password"));
      } else {
        setError(
          isRetryableError(err)
            ? t("auth.errors.timeout")
            : describeApiError(err),
        );
      }
    } finally {
      submittingRef.current = false;
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  if (done) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.badge, styles.badgeOk]}>
            <Text style={styles.badgeMarkOk}>✓</Text>
          </View>
          <Text style={styles.title}>{t("auth.reset.done_title")}</Text>
          <Text style={styles.body}>{t("auth.reset.done_body")}</Text>

          <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.reset({ index: 0, routes: [{ name: "Login" }] })}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>{t("auth.reset.go_to_login")}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (deadLink) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.badge, styles.badgeBad]}>
            <Text style={styles.badgeMarkBad}>!</Text>
          </View>
          <Text style={styles.title}>{t("auth.reset.dead_title")}</Text>
          <Text style={styles.body}>{t("auth.reset.dead_body")}</Text>

          <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.navigate("ForgotPassword")}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>{t("auth.reset.request_new")}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => navigation.navigate("Login")}
          >
            <Text style={styles.link}>{t("auth.reset.back_to_login")}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.brand}>FLOUSI</Text>
          <Text style={styles.title}>{t("auth.reset.title")}</Text>
          {/* An address is always left-to-right, whatever the UI language. */}
          <Text style={styles.subtitle}>{ltr(email)}</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.label}>{t("auth.reset.new_password")}</Text>
          <TextInput
            style={[styles.input, passwordError && styles.inputInvalid]}
            placeholder="••••••••"
            placeholderTextColor={colors.textFaint}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            editable={!loading}
          />

          <Text style={styles.label}>{t("auth.reset.confirm_password")}</Text>
          <TextInput
            style={[styles.input, passwordError && styles.inputInvalid]}
            placeholder="••••••••"
            placeholderTextColor={colors.textFaint}
            value={confirmation}
            onChangeText={setConfirmation}
            secureTextEntry
            autoCapitalize="none"
            editable={!loading}
            onSubmitEditing={handleSubmit}
            returnKeyType="go"
          />

          {passwordError ? (
            <Text style={styles.fieldError}>{passwordError}</Text>
          ) : (
            <Text style={styles.hint}>
              {t("validation.password_hint", { min: MIN_PASSWORD })}
            </Text>
          )}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.buttonText}>{t("auth.reset.submit")}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface },
    flex: { flex: 1 },
    content: { flexGrow: 1, justifyContent: "center", padding: 24 },

    brand: {
      fontSize: 22,
      fontWeight: "bold",
      color: colors.primary,
      letterSpacing: 3,
      textAlign: "center",
    },
    title: {
      fontSize: 24,
      fontWeight: "bold",
      color: colors.text,
      textAlign: "center",
      marginTop: 18,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: "center",
      marginTop: 6,
      marginBottom: 24,
    },
    body: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: 12,
      marginBottom: 8,
      lineHeight: 24,
    },

    badge: {
      alignSelf: "center",
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: "center",
      justifyContent: "center",
    },
    badgeOk: { backgroundColor: colors.surfaceMuted },
    badgeBad: { backgroundColor: colors.dangerSurface },
    badgeMarkOk: { fontSize: 30, color: colors.primary, fontWeight: "bold" },
    badgeMarkBad: { fontSize: 30, color: colors.dangerText, fontWeight: "bold" },

    error: {
      backgroundColor: colors.dangerSurface,
      color: colors.dangerText,
      borderRadius: 10,
      padding: 12,
      fontSize: 13,
      textAlign: "center",
      marginBottom: 16,
    },
    fieldError: {
      color: colors.dangerText,
      fontSize: 13,
      textAlign: "auto",
      marginTop: -8,
      marginBottom: 10,
    },
    hint: {
      color: colors.textFaint,
      fontSize: 12,
      textAlign: "auto",
      marginTop: -8,
      marginBottom: 10,
    },

    label: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textSecondary,
      textAlign: "auto",
      marginBottom: 6,
    },
    input: {
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: colors.text,
      textAlign: "auto",
      marginBottom: 18,
    },
    inputInvalid: { borderColor: colors.dangerBorder },

    button: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 15,
      alignItems: "center",
      marginTop: 8,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: colors.onPrimary, fontSize: 16, fontWeight: "bold" },

    linkRow: { flexDirection: "row", justifyContent: "center", marginTop: 20 },
    link: { color: colors.primary, fontSize: 14, fontWeight: "600" },
  });
