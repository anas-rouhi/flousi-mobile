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
import { colors, fontSizes, radii, spacing } from "../constants/theme";
import { useAuth } from "../context/AuthContext";

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
  const { user, signOut } = useAuth();
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
          <Row
            label="اللغة"
            value={LANGUAGE_NAMES[user?.preferred_language] || user?.preferred_language || "—"}
            hint="التبديل كيتطلب endpoint فـ السيرفر"
            onPress={() => notAvailable("تبديل اللغة")}
          />
          <Row label="العملة" value={user?.preferred_currency || "—"} readOnly />
          <Row label="المنطقة الزمنية" value={user?.timezone || "—"} readOnly />
          <Row
            label="الوضع الليلي"
            value="مطفي"
            hint="الثيم الداكن مازال ما تصاوبش"
            onPress={() => notAvailable("الوضع الليلي")}
            isLast
          />
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

const styles = StyleSheet.create({
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
    textAlign: "right",
  },

  profile: { flexDirection: "row-reverse", alignItems: "center" },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: spacing.md,
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
    textAlign: "right",
  },
  email: {
    fontSize: fontSizes.meta,
    color: colors.textMuted,
    textAlign: "right",
    marginTop: 2,
  },

  row: {
    flexDirection: "row-reverse",
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
    textAlign: "right",
  },
  rowHint: {
    fontSize: fontSizes.caption,
    color: colors.textFaint,
    textAlign: "right",
    marginTop: 2,
  },
  rowValue: {
    fontSize: fontSizes.meta,
    color: colors.textSecondary,
    fontWeight: "600",
    marginRight: spacing.md,
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

  version: {
    fontSize: fontSizes.small,
    color: colors.textFaint,
    textAlign: "center",
    marginTop: spacing.xl,
  },
});
