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
import { requestPasswordReset } from "../services/password";
import { useI18n } from "../i18n";

/**
 * Asks for an email and nothing else.
 *
 * The confirmation text is the same whether or not the address has an account,
 * because the API answers the same either way — telling the user "no such
 * account" here would turn the screen into a way of testing which emails are
 * registered.
 */
export default function ForgotPasswordScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useI18n();

  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  // Same guards as Login: reject a second tap before `loading` commits, and
  // never set state after the navigator has unmounted this screen.
  const submittingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

  const handleSubmit = async () => {
    if (submittingRef.current) {
      return;
    }

    const address = email.trim();
    if (!address) {
      setError(t("validation.email_required_own"));
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      await requestPasswordReset(address);
      if (mountedRef.current) {
        setSent(true);
      }
    } catch (err) {
      if (mountedRef.current) {
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

  if (sent) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.badge}>
            <Text style={styles.badgeMark}>✉</Text>
          </View>
          <Text style={styles.title}>{t("auth.forgot.sent_title")}</Text>
          <Text style={styles.body}>{t("auth.forgot.sent_body")}</Text>
          <Text style={styles.hint}>{t("auth.forgot.sent_hint")}</Text>

          <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.navigate("Login")}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>
              {t("auth.forgot.back_to_login")}
            </Text>
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
          <Text style={styles.title}>{t("auth.forgot.title")}</Text>
          <Text style={styles.subtitle}>{t("auth.forgot.subtitle")}</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

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
            onSubmitEditing={handleSubmit}
            returnKeyType="send"
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.buttonText}>{t("auth.forgot.submit")}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => navigation.goBack()}
            disabled={loading}
          >
            <Text style={styles.link}>{t("auth.forgot.back_to_login")}</Text>
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
      lineHeight: 21,
    },
    body: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: 12,
      lineHeight: 24,
    },
    hint: {
      fontSize: 13,
      color: colors.textFaint,
      textAlign: "center",
      marginTop: 14,
      marginBottom: 8,
      lineHeight: 20,
    },

    badge: {
      alignSelf: "center",
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    badgeMark: { fontSize: 28, color: colors.primary },

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
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: colors.text,
      textAlign: "auto",
      marginBottom: 18,
    },

    button: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 15,
      alignItems: "center",
      marginTop: 8,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: colors.onPrimary, fontSize: 16, fontWeight: "bold" },

    linkRow: {
      flexDirection: "row",
      justifyContent: "center",
      marginTop: 20,
    },
    link: { color: colors.primary, fontSize: 14, fontWeight: "600" },
  });
