import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { fontSizes, radii, spacing } from "../../constants/theme";
import { useTheme, useThemedStyles } from "../../context/ThemeContext";
import { useI18n } from "../../i18n";
import {
  DEFAULT_API_HOST,
  getApiHost,
  normalizeHost,
  pingApi,
  setApiBaseUrl,
} from "../../services/api";

/**
 * Lets the API host be changed from the phone (dev tool).
 *
 * The new host is applied to axios and persisted before the reachability
 * check, so even an unreachable answer leaves it in place — the user may be
 * starting the backend right now. Only a reachable host closes the sheet.
 */
export default function ServerConnectModal({ visible, reason, onClose, onApplied }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useI18n();

  const [value, setValue] = useState("");
  const [activeHost, setActiveHost] = useState(getApiHost());
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    if (visible) {
      const host = getApiHost();
      setActiveHost(host);
      setValue(host);
      setError(null);
    }
  }, [visible]);

  const apply = async (input) => {
    if (busyRef.current) {
      return;
    }
    if (input !== null && !normalizeHost(input)) {
      setError(t("server.invalid"));
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const host = await setApiBaseUrl(input);
      setActiveHost(host);
      setValue(host);
      if (await pingApi()) {
        onApplied?.(host);
      } else {
        setError(t("server.still_unreachable", { host }));
      }
    } catch (err) {
      setError(t("server.invalid"));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const custom = activeHost !== DEFAULT_API_HOST;

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
                {reason === "auto" ? t("server.unreachable_title") : t("server.title")}
              </Text>
              <TouchableOpacity onPress={onClose} hitSlop={12} disabled={busy}>
                <Text style={styles.close}>{t("common.cancel")}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.body}>
              {reason === "auto" ? t("server.unreachable_body") : t("server.body")}
            </Text>

            <Text style={styles.label}>{t("server.current")}</Text>
            <Text
              style={[styles.current, reason === "auto" && styles.currentFailing]}
              selectable
            >
              {activeHost}
            </Text>

            <Text style={styles.label}>{t("server.new")}</Text>
            <TextInput
              style={styles.input}
              value={value}
              onChangeText={setValue}
              placeholder="http://192.168.1.55:8000"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              editable={!busy}
              selectTextOnFocus
              onSubmitEditing={() => apply(value)}
              returnKeyType="go"
            />
            <Text style={styles.hint}>{t("server.hint")}</Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.submit, busy && styles.submitDisabled]}
              onPress={() => apply(value)}
              disabled={busy}
              activeOpacity={0.85}
            >
              {busy ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.submitText}>{t("server.submit")}</Text>
              )}
            </TouchableOpacity>

            {custom ? (
              <TouchableOpacity
                style={styles.reset}
                onPress={() => apply(null)}
                disabled={busy}
                hitSlop={8}
              >
                <Text style={styles.resetText}>
                  {t("server.reset", { host: DEFAULT_API_HOST })}
                </Text>
              </TouchableOpacity>
            ) : null}
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
      flexShrink: 1,
      fontSize: fontSizes.subtitle,
      fontWeight: "bold",
      color: colors.text,
      marginEnd: spacing.md,
    },
    close: {
      fontSize: fontSizes.bodyLarge,
      color: colors.textMuted,
      fontWeight: "600",
    },
    body: {
      fontSize: fontSizes.meta,
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
    // URLs read left to right whatever the UI language.
    current: {
      fontSize: fontSizes.body,
      color: colors.text,
      fontWeight: "600",
      writingDirection: "ltr",
      textAlign: "left",
    },
    currentFailing: { color: colors.dangerText },
    input: {
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.lg,
      paddingHorizontal: spacing.lg,
      paddingVertical: 13,
      fontSize: fontSizes.bodyLarge,
      color: colors.text,
      writingDirection: "ltr",
      textAlign: "left",
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
    reset: { alignItems: "center", marginTop: spacing.lg },
    resetText: {
      fontSize: fontSizes.caption,
      color: colors.textMuted,
      textAlign: "center",
    },
  });
