import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme, useThemedStyles } from "../context/ThemeContext";
import { isRetryableError } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { describeAuthError } from "../services/auth";
import { useI18n } from "../i18n";

// Mirrors the API's `min:8` rule so the user is told before a round trip.
const MIN_PASSWORD_LENGTH = 8;

export default function RegisterScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { signUp } = useAuth();
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // `loading` gates the button, but state commits a tick after the press —
  // this ref rejects a second tap inside that window.
  const submittingRef = useRef(false);
  // On success this screen is unmounted by the navigator while the submit
  // handler is still unwinding; the flag keeps it from setting state after that.
  const mountedRef = useRef(true);

  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

  /** Local checks only; the API remains the authority on uniqueness etc. */
  const validate = () => {
    if (!name.trim()) {
      return t("validation.name_required");
    }
    if (!email.trim()) {
      return t("validation.email_required");
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return t("validation.password_min", { min: MIN_PASSWORD_LENGTH });
    }
    if (password !== confirmation) {
      return t("validation.passwords_mismatch");
    }
    return null;
  };

  const handleRegister = async () => {
    if (submittingRef.current) {
      return;
    }

    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      // Resolves only once the token is stored and verified, so the context can
      // flip to authenticated and let the navigator swap in the dashboard.
      await signUp({
        name: name.trim(),
        email: email.trim(),
        password,
      });
    } catch (err) {
      console.log("Register error:", err.response?.data || err.message);
      if (mountedRef.current) {
        // A timed-out registration is ambiguous: the account may well have been
        // created before the response was lost. Point at login rather than
        // inviting a resubmit that would fail on the unique email rule.
        setError(
          isRetryableError(err)
            ? t("auth.errors.register_timeout")
            : describeAuthError(err),
        );
      }
    } finally {
      // Always cleared — on error the form becomes usable again immediately
      // instead of sitting on a spinner.
      submittingRef.current = false;
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

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
          <Text style={styles.title}>{t("auth.register.title")}</Text>
          <Text style={styles.subtitle}>{t("auth.register.subtitle")}</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.label}>{t("auth.register.name")}</Text>
          <TextInput
            style={styles.input}
            placeholder={t("auth.register.name_placeholder")}
            placeholderTextColor={colors.textFaint}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoComplete="name"
            editable={!loading}
          />

          <Text style={styles.label}>{t("auth.email")}</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={colors.textFaint}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            editable={!loading}
          />

          <Text style={styles.label}>{t("auth.password")}</Text>
          <TextInput
            style={styles.input}
            placeholder={t("validation.password_min_placeholder", {
              min: MIN_PASSWORD_LENGTH,
            })}
            placeholderTextColor={colors.textFaint}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password-new"
            editable={!loading}
          />

          <Text style={styles.label}>{t("auth.register.password_confirm")}</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={colors.textFaint}
            value={confirmation}
            onChangeText={setConfirmation}
            secureTextEntry
            autoComplete="password-new"
            editable={!loading}
            onSubmitEditing={handleRegister}
            returnKeyType="go"
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <View style={styles.buttonLoading}>
                <ActivityIndicator color={colors.onPrimary} />
                <Text style={styles.buttonLoadingText}>
                  {t("auth.register.submitting")}
                </Text>
              </View>
            ) : (
              <Text style={styles.buttonText}>{t("auth.register.submit")}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => navigation.navigate("Login")}
            disabled={loading}
          >
            <Text style={styles.linkMuted}>{t("auth.register.has_account")}</Text>
            <Text style={styles.link}>{t("auth.register.login_link")}</Text>
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

  error: {
    backgroundColor: colors.dangerSurface,
    color: colors.dangerText,
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    textAlign: "center",
    marginBottom: 16,
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.text,
    marginBottom: 16,
    textAlign: "auto",
  },

  button: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 6,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: colors.onPrimary, fontSize: 16, fontWeight: "bold" },
  buttonLoading: { flexDirection: "row", alignItems: "center" },
  buttonLoadingText: {
    color: colors.onPrimary,
    fontSize: 15,
    fontWeight: "600",
    marginEnd: 10,
  },

  linkRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 22,
  },
  linkMuted: { fontSize: 14, color: colors.textMuted },
  link: { fontSize: 14, color: colors.primary, fontWeight: "bold" },
});
