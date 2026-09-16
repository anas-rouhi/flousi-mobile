import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ChangePasswordModal from "../components/settings/ChangePasswordModal";
import { Card, CardHeader } from "../components/ui/Card";
import { fontSizes, radii, spacing } from "../constants/theme";
import { useTheme, useThemedStyles } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useLocale } from "../context/LocaleContext";
import { useI18n } from "../i18n";
import {
  deleteAccount,
  describeProfileError,
  deviceTimezone,
  updateProfile,
} from "../services/profile";
import { ltr } from "../utils/bidi";

/** System / Light / Dark, in the order people expect to scan them. */
const THEME_OPTIONS = [
  { value: "system", glyph: "⚙️" },
  { value: "light", glyph: "☀️" },
  { value: "dark", glyph: "🌙" },
];

/** The currencies the app offers here; the API also accepts GBP. */
const CURRENCY_OPTIONS = ["MAD", "EUR", "USD"];

/**
 * Account settings.
 *
 * Language, currency, time zone and the password are all editable through
 * `PUT /profile`. That route does not exist on the API yet, so every write
 * here reports "not available on the server" rather than a raw failure until
 * it ships — see services/profile.js.
 *
 * Language is the exception that works regardless: it is applied and persisted
 * locally first (instant RTL flip), and the profile update is a best-effort
 * sync on top, so the UI language never depends on the network.
 */
export default function SettingsScreen() {
  const { colors, mode, scheme, setMode } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { user, signOut, applyUser, forgetSession } = useAuth();
  const { setLanguage } = useLocale();
  const { t, language, languages } = useI18n();

  const [signingOut, setSigningOut] = useState(false);
  const [saving, setSaving] = useState(null); // "currency" | "timezone" | null
  const [syncNotice, setSyncNotice] = useState(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [toast, setToast] = useState(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const mounted = useRef(true);
  useEffect(() => () => {
    mounted.current = false;
  }, []);

  const showToast = useCallback(
    (message) => {
      setToast(message);
      toastOpacity.setValue(0);
      Animated.sequence([
        Animated.timing(toastOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.delay(1700),
        Animated.timing(toastOpacity, { toValue: 0, duration: 260, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished && mounted.current) {
          setToast(null);
        }
      });
    },
    [toastOpacity],
  );

  /**
   * Language applies locally first — direction is a root-view style and the
   * translation store is switched by the provider — then syncs to the account
   * so server-rendered content (category names, emails) follows. A failed sync
   * is reported without undoing the switch.
   */
  const chooseLanguage = useCallback(
    async (option) => {
      const result = await setLanguage(option.value);
      if (!result.changed) {
        return;
      }
      try {
        applyUser(await updateProfile({ preferredLanguage: option.value }));
        setSyncNotice(null);
      } catch (err) {
        console.log("Language sync failed:", err.response?.data || err.message);
        setSyncNotice(t("settings.language_sync_failed"));
      }
    },
    [setLanguage, applyUser, t],
  );

  const chooseCurrency = useCallback(
    async (code) => {
      if (code === user?.preferred_currency || saving) {
        return;
      }
      setSaving("currency");
      try {
        applyUser(await updateProfile({ preferredCurrency: code }));
        showToast(t("common.save_success"));
      } catch (err) {
        console.log("Currency update failed:", err.response?.data || err.message);
        Alert.alert(t("common.error_title"), describeProfileError(err));
      } finally {
        if (mounted.current) {
          setSaving(null);
        }
      }
    },
    [user?.preferred_currency, saving, applyUser, showToast, t],
  );

  const useDeviceTimezone = useCallback(async () => {
    const zone = deviceTimezone();
    if (!zone || zone === user?.timezone || saving) {
      return;
    }
    setSaving("timezone");
    try {
      applyUser(await updateProfile({ timezone: zone }));
      showToast(t("common.save_success"));
    } catch (err) {
      console.log("Timezone update failed:", err.response?.data || err.message);
      Alert.alert(t("common.error_title"), describeProfileError(err));
    } finally {
      if (mounted.current) {
        setSaving(null);
      }
    }
  }, [user?.timezone, saving, applyUser, showToast, t]);

  const confirmSignOut = useCallback(() => {
    Alert.alert(t("session.sign_out"), t("session.sign_out_confirm"), [
      { text: t("session.sign_out_cancel"), style: "cancel" },
      {
        text: t("session.sign_out_action"),
        style: "destructive",
        onPress: async () => {
          setSigningOut(true);
          try {
            await signOut();
          } catch (err) {
            console.log("Sign out failed:", err.message);
            setSigningOut(false);
            Alert.alert(t("common.error_title"), t("session.sign_out_failed"));
          }
        },
      },
    ]);
  }, [signOut, t]);

  /**
   * Deletion is irreversible, so it is asked twice: once stating exactly what
   * is destroyed, then a final confirmation. Only the second tap calls the API.
   */
  const runDeletion = useCallback(async () => {
    setDeleting(true);
    try {
      await deleteAccount();
      // The token died with the account: clearing the session unmounts this
      // screen and the navigator swaps in the signed-out stack by itself.
      await forgetSession();
      Alert.alert(t("settings.delete_account"), t("settings.delete_account_done"), [
        { text: t("common.ok") },
      ]);
    } catch (err) {
      console.log("Account deletion failed:", err.response?.data || err.message);
      if (mounted.current) {
        setDeleting(false);
      }
      Alert.alert(t("common.error_title"), describeProfileError(err));
    }
  }, [forgetSession, t]);

  const confirmDelete = useCallback(() => {
    Alert.alert(t("settings.delete_account"), t("settings.delete_account_body"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("settings.delete_account_continue"),
        style: "destructive",
        onPress: () => {
          Alert.alert(
            t("settings.delete_account_final_title"),
            t("settings.delete_account_final_body"),
            [
              { text: t("common.cancel"), style: "cancel" },
              {
                text: t("settings.delete_account_final_action"),
                style: "destructive",
                onPress: runDeletion,
              },
            ],
          );
        },
      },
    ]);
  }, [runDeletion, t]);

  const initial = user?.name?.trim()?.[0]?.toUpperCase() || "?";
  const timezone = user?.timezone || deviceTimezone();
  const canAdoptDeviceZone =
    Boolean(deviceTimezone()) && deviceTimezone() !== user?.timezone;

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("settings.title")}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile */}
        <Card>
          <View style={styles.profile}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <View style={styles.profileBody}>
              <Text style={styles.name} numberOfLines={1}>
                {user?.name || "—"}
              </Text>
              <Text style={styles.email} numberOfLines={1}>
                {ltr(user?.email) || "—"}
              </Text>
            </View>
          </View>
        </Card>

        {/* Preferences */}
        <Card>
          <CardHeader title={t("settings.preferences")} />
          <View style={styles.optionRow}>
            {languages.map((option) => {
              const active = option.value === language;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.option, active && styles.optionActive]}
                  onPress={() => chooseLanguage(option)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    style={[styles.optionLabel, active && styles.optionLabelActive]}
                  >
                    {option.label}
                  </Text>
                  <Text style={styles.optionMeta}>
                    {option.rtl ? "RTL" : "LTR"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.hint}>{t("settings.language_hint")}</Text>
          {syncNotice ? <Text style={styles.notice}>{syncNotice}</Text> : null}

          <Text style={styles.groupLabel}>{t("settings.currency")}</Text>
          <View style={styles.optionRow}>
            {CURRENCY_OPTIONS.map((code) => {
              const active = code === user?.preferred_currency;
              return (
                <TouchableOpacity
                  key={code}
                  style={[styles.option, active && styles.optionActive]}
                  onPress={() => chooseCurrency(code)}
                  disabled={Boolean(saving)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  {saving === "currency" && !active ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Text
                      style={[styles.optionLabel, active && styles.optionLabelActive]}
                    >
                      {code}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.hint}>{t("settings.currency_hint")}</Text>

          <View style={styles.row}>
            <View style={styles.rowMain}>
              <Text style={styles.rowLabel}>{t("settings.timezone")}</Text>
              <Text style={styles.rowHint} numberOfLines={1}>
                {ltr(timezone) || "—"}
              </Text>
            </View>
            {canAdoptDeviceZone ? (
              <TouchableOpacity
                onPress={useDeviceTimezone}
                disabled={Boolean(saving)}
                hitSlop={8}
              >
                {saving === "timezone" ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={styles.rowAction}>
                    {t("settings.timezone_device")}
                  </Text>
                )}
              </TouchableOpacity>
            ) : null}
          </View>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader title={t("settings.appearance")} />
          <View style={styles.optionRow}>
            {THEME_OPTIONS.map((option) => {
              const active = option.value === mode;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.option, active && styles.optionActive]}
                  onPress={() => setMode(option.value)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={styles.optionGlyph}>{option.glyph}</Text>
                  <Text
                    style={[styles.optionLabel, active && styles.optionLabelActive]}
                  >
                    {t(`settings.theme.${option.value}`)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.hint}>
            {mode === "system"
              ? t("settings.theme_follows", {
                  scheme: t(
                    `settings.theme.${scheme === "dark" ? "dark" : "light"}`,
                  ),
                })
              : t("settings.theme_manual")}
          </Text>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader title={t("settings.security")} />
          <TouchableOpacity
            style={styles.action}
            onPress={() => setPasswordVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.actionText}>{t("settings.change_password")}</Text>
          </TouchableOpacity>
        </Card>

        {/* Account */}
        <Card>
          <CardHeader title={t("settings.account")} />
          <TouchableOpacity
            style={[styles.action, styles.actionWarn]}
            onPress={confirmSignOut}
            disabled={signingOut || deleting}
          >
            {signingOut ? (
              <ActivityIndicator size="small" color={colors.dangerText} />
            ) : (
              <Text style={styles.actionWarnText}>{t("session.sign_out")}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.action, styles.actionDanger]}
            onPress={confirmDelete}
            disabled={deleting || signingOut}
            accessibilityRole="button"
          >
            {deleting ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <Text style={styles.actionDangerText}>
                {t("settings.delete_account")}
              </Text>
            )}
          </TouchableOpacity>
        </Card>

        <Text style={styles.version}>FLOUSI • v1.0.0</Text>
      </ScrollView>

      {toast ? (
        <Animated.View
          style={[styles.toast, { opacity: toastOpacity }]}
          pointerEvents="none"
        >
          <Text style={styles.toastText}>{toast}</Text>
        </Animated.View>
      ) : null}

      <ChangePasswordModal
        visible={passwordVisible}
        onClose={() => setPasswordVisible(false)}
        onChanged={() => {
          setPasswordVisible(false);
          showToast(t("settings.password.success"));
        }}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: spacing.xxxl },

    header: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xs,
    },
    title: {
      fontSize: fontSizes.heading,
      fontWeight: "bold",
      color: colors.text,
      textAlign: "auto",
    },

    profile: { flexDirection: "row", alignItems: "center" },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginEnd: spacing.md,
    },
    avatarText: {
      color: colors.onPrimary,
      fontSize: fontSizes.heading,
      fontWeight: "bold",
    },
    profileBody: { flex: 1 },
    name: {
      fontSize: fontSizes.subtitle,
      fontWeight: "bold",
      color: colors.text,
      textAlign: "auto",
    },
    email: {
      fontSize: fontSizes.meta,
      color: colors.textMuted,
      textAlign: "auto",
      marginTop: 2,
    },

    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: spacing.md,
      marginTop: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.divider,
    },
    rowMain: { flexShrink: 1 },
    rowLabel: {
      fontSize: fontSizes.body,
      color: colors.text,
      textAlign: "auto",
    },
    rowHint: {
      fontSize: fontSizes.caption,
      color: colors.textFaint,
      textAlign: "auto",
      marginTop: 2,
    },
    rowAction: {
      fontSize: fontSizes.meta,
      fontWeight: "600",
      color: colors.primary,
      marginStart: spacing.md,
    },

    groupLabel: {
      fontSize: fontSizes.meta,
      fontWeight: "600",
      color: colors.textSecondary,
      textAlign: "auto",
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    optionRow: { flexDirection: "row", gap: spacing.sm },
    option: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 48,
      paddingVertical: spacing.md,
      borderRadius: radii.md,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    optionActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    optionGlyph: { fontSize: 18, marginBottom: 4 },
    optionLabel: {
      fontSize: fontSizes.meta,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    optionLabelActive: { color: colors.primary, fontWeight: "bold" },
    optionMeta: {
      fontSize: fontSizes.caption,
      color: colors.textFaint,
      marginTop: 2,
      letterSpacing: 0.5,
    },

    hint: {
      fontSize: fontSizes.caption,
      color: colors.textMuted,
      textAlign: "auto",
      marginTop: spacing.sm,
    },
    notice: {
      fontSize: fontSizes.caption,
      color: colors.warning,
      textAlign: "auto",
      marginTop: spacing.xs,
    },

    action: {
      paddingVertical: spacing.md,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 48,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: spacing.sm,
    },
    actionText: {
      fontSize: fontSizes.body,
      fontWeight: "600",
      color: colors.text,
    },
    actionWarn: {
      borderColor: colors.dangerBorder,
      backgroundColor: colors.dangerSurface,
    },
    actionWarnText: {
      fontSize: fontSizes.body,
      fontWeight: "bold",
      color: colors.dangerText,
    },
    actionDanger: {
      borderColor: colors.danger,
      backgroundColor: colors.danger,
    },
    actionDangerText: {
      fontSize: fontSizes.body,
      fontWeight: "bold",
      color: colors.onPrimary,
    },

    toast: {
      position: "absolute",
      bottom: 28,
      alignSelf: "center",
      backgroundColor: colors.inverse,
      borderRadius: radii.pill,
      paddingVertical: 11,
      paddingHorizontal: 22,
    },
    toastText: {
      color: colors.onInverse,
      fontSize: fontSizes.body,
      fontWeight: "600",
    },

    version: {
      fontSize: fontSizes.small,
      color: colors.textFaint,
      textAlign: "center",
      marginTop: spacing.xl,
    },
  });
