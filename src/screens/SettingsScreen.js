import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card, CardHeader } from "../components/ui/Card";
import { fontSizes, radii, spacing } from "../constants/theme";
import { useTheme, useThemedStyles } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useLocale } from "../context/LocaleContext";

/** System / Light / Dark, in the order people expect to scan them. */
const THEME_OPTIONS = [
  { value: "system", glyph: "⚙️", label: "النظام" },
  { value: "light", glyph: "☀️", label: "فاتح" },
  { value: "dark", glyph: "🌙", label: "غامق" },
];

const LANGUAGE_NAMES = { ar: "العربية / الدارجة", fr: "Français", en: "English" };

/**
 * Three of the rows here are read-only on purpose.
 *
 * The API exposes no way to change them: PATCH/PUT/DELETE on /me all answer
 * 405, and there is no account-deletion route. Rather than ship switches that
 * appear to work and silently do nothing, each row states what it would need.
 * They become live the moment those endpoints exist.
 */
export default function SettingsScreen() {
  const { colors, mode, scheme, setMode } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { user, signOut } = useAuth();
  const { language, languages, setLanguage, restart } = useLocale();
  const [signingOut, setSigningOut] = useState(false);

  const notAvailable = useCallback((what) => {
    Alert.alert(
      what,
      "هاد الخيار مامفعّلش حتى دابا — كيتطلب تحديث فـ السيرفر.",
      [{ text: "واخا" }],
    );
  }, []);

  const confirmSignOut = useCallback(() => {
    Alert.alert("تسجيل الخروج", "واش بصح بغيت تخرج من حسابك؟", [
      { text: "لا، بقا", style: "cancel" },
      {
        text: "خرج",
        style: "destructive",
        onPress: async () => {
          setSigningOut(true);
          try {
            await signOut();
          } catch (err) {
            console.log("Sign out failed:", err.message);
            setSigningOut(false);
            Alert.alert("خطأ", "ما قدرناش نخرجوك، عاود المحاولة");
          }
        },
      },
    ]);
  }, [signOut]);

  /**
   * React Native latches layout direction at startup, so a language change
   * cannot flip the screen live. The restart is therefore asked for, never
   * performed behind the user back.
   */
  const chooseLanguage = useCallback(
    async (option) => {
      const result = await setLanguage(option.value);
      if (!result.changed || !result.needsRestart) {
        return;
      }
      Alert.alert(
        "تبديل اللغة",
        `باش تبان ${option.label} بالاتجاه الصحيح، خاص التطبيق يتعاود يتشغل. تعاود دابا؟`,
        [
          { text: "من بعد", style: "cancel" },
          {
            text: "عاود شغّل",
            onPress: () => {
              if (!restart()) {
                Alert.alert(
                  "عاود شغّل التطبيق",
                  "سد التطبيق وحلو من جديد باش يتطبق الاتجاه الجديد.",
                );
              }
            },
          },
        ],
      );
    },
    [setLanguage, restart],
  );

  const initial = user?.name?.trim()?.[0]?.toUpperCase() || "؟";

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>الإعدادات</Text>
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
                {user?.email || "—"}
              </Text>
            </View>
          </View>
        </Card>

        {/* Preferences — values are live, editing is not */}
        <Card>
          <CardHeader title="التفضيلات" />
          <View style={styles.languages}>
            {languages.map((option) => {
              const active = option.value === language;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.mode, active && styles.modeActive]}
                  onPress={() => chooseLanguage(option)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    style={[styles.modeLabel, active && styles.modeLabelActive]}
                  >
                    {option.label}
                  </Text>
                  <Text style={styles.modeGlyphSmall}>
                    {option.rtl ? "RTL" : "LTR"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.modeHint}>
            تبديل اللغة كيتطلب إعادة تشغيل التطبيق باش يتبدل اتجاه الشاشة.
          </Text>
          <Row label="العملة" value={user?.preferred_currency || "—"} readOnly />
          <Row
            label="المنطقة الزمنية"
            value={user?.timezone || "—"}
            readOnly
            isLast
          />
        </Card>

        {/* Appearance — this one is fully live */}
        <Card>
          <CardHeader title="المظهر" />
          <View style={styles.modes}>
            {THEME_OPTIONS.map((option) => {
              const active = option.value === mode;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.mode, active && styles.modeActive]}
                  onPress={() => setMode(option.value)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={styles.modeGlyph}>{option.glyph}</Text>
                  <Text
                    style={[styles.modeLabel, active && styles.modeLabelActive]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.modeHint}>
            {mode === "system"
              ? `كيتبع الجهاز — دابا ${scheme === "dark" ? "غامق" : "فاتح"}`
              : "محدد يدويا"}
          </Text>
        </Card>

        {/* Account */}
        <Card>
          <CardHeader title="الحساب" />
          <TouchableOpacity
            style={styles.action}
            onPress={confirmSignOut}
            disabled={signingOut}
          >
            {signingOut ? (
              <ActivityIndicator size="small" color={colors.dangerText} />
            ) : (
              <Text style={styles.actionText}>تسجيل الخروج</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.action, styles.actionDanger]}
            onPress={() => notAvailable("حذف الحساب")}
          >
            <Text style={styles.actionDangerText}>حذف الحساب</Text>
          </TouchableOpacity>
        </Card>

        <Text style={styles.version}>FLOUSI • v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, hint, onPress, readOnly = false, isLast = false }) {
  const styles = useThemedStyles(createStyles);
  const Wrapper = readOnly ? View : TouchableOpacity;

  return (
    <Wrapper
      style={[styles.row, isLast && styles.rowLast]}
      onPress={readOnly ? undefined : onPress}
      activeOpacity={0.6}
    >
      <View style={styles.rowMain}>
        <Text style={styles.rowLabel}>{label}</Text>
        {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
      </View>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </Wrapper>
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
    marginStart: spacing.md,
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
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  rowLast: { borderBottomWidth: 0, paddingBottom: 0 },
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
  rowValue: {
    fontSize: fontSizes.meta,
    color: colors.textSecondary,
    fontWeight: "600",
    marginEnd: spacing.md,
  },

  action: {
    paddingVertical: spacing.md,
    alignItems: "center",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerSurface,
    marginTop: spacing.sm,
  },
  actionText: {
    fontSize: fontSizes.body,
    fontWeight: "bold",
    color: colors.dangerText,
  },
  actionDanger: {
    backgroundColor: "transparent",
    borderColor: colors.border,
  },
  actionDangerText: {
    fontSize: fontSizes.body,
    fontWeight: "600",
    color: colors.textMuted,
  },

  modes: { flexDirection: "row" },
  languages: { flexDirection: "row" },
  mode: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.md,
    marginStart: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  modeActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  modeGlyph: { fontSize: 18, marginBottom: 4 },
  modeGlyphSmall: {
    fontSize: fontSizes.caption,
    color: colors.textFaint,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  modeLabel: {
    fontSize: fontSizes.meta,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  modeLabelActive: { color: colors.primary, fontWeight: "bold" },
  modeHint: {
    fontSize: fontSizes.caption,
    color: colors.textMuted,
    textAlign: "auto",
    marginTop: spacing.sm,
  },

  version: {
    fontSize: fontSizes.small,
    color: colors.textFaint,
    textAlign: "center",
    marginTop: spacing.xl,
  },
});
