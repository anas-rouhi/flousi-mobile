import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme, useThemedStyles } from "../context/ThemeContext";
import { useI18n } from "../i18n";

/**
 * The four pillars of the product, in pitch order. Copy lives in the
 * dictionaries under `onboarding.features.<key>`.
 */
const FEATURES = [
  {
    key: "tracking",
    glyph: "⚡",
    // The brand accent follows the theme; the other three are one-off
    // illustration colours that read correctly on either ground.
    accentToken: "primary",
  },
  { key: "assistant", glyph: "🤖", accent: "#1F6F8B" },
  { key: "budget", glyph: "🎯", accent: "#C97B0B" },
  { key: "privacy", glyph: "🔒", accent: "#5B4B8A" },
];

export default function OnboardingScreen({ onCreateAccount, onLogin }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useI18n();
  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>F</Text>
          </View>
          <Text style={styles.brand}>FLOUSI</Text>
          <Text style={styles.tagline}>
            {t("onboarding.tagline")}
            {"\n"}
            <Text style={styles.taglineFr}>
              {t("onboarding.tagline_secondary")}
            </Text>
          </Text>
          <Text style={styles.heroBody}>{t("onboarding.hero_body")}</Text>
        </View>

        {/* Feature detail */}
        <View style={styles.features}>
          {FEATURES.map((feature) => {
            const accent = feature.accentToken
              ? colors[feature.accentToken]
              : feature.accent;
            return (
            <View key={feature.key} style={styles.featureCard}>
              <View
                style={[styles.glyphCircle, { backgroundColor: accent }]}
              >
                <Text style={styles.glyph}>{feature.glyph}</Text>
              </View>
              <View style={styles.featureBody}>
                <Text style={styles.featureTitle}>
                  {t(`onboarding.features.${feature.key}.title`)}
                </Text>
                <Text style={[styles.featureSubtitle, { color: accent }]}>
                  {t(`onboarding.features.${feature.key}.subtitle`)}
                </Text>
                <Text style={styles.featureText}>
                  {t(`onboarding.features.${feature.key}.body`)}
                </Text>
              </View>
            </View>
            );
          })}
        </View>

        <Text style={styles.footnote}>{t("onboarding.footnote")}</Text>
      </ScrollView>

      {/* Calls to action stay pinned below the scrolling pitch. */}
      <View style={styles.ctaBar}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={onCreateAccount}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>
            {t("onboarding.create_account")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={onLogin}
          activeOpacity={0.7}
        >
          <Text style={styles.secondaryButtonText}>
            {t("onboarding.login")}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  content: { paddingBottom: 24 },

  hero: {
    alignItems: "center",
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 28,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: { color: colors.onPrimary, fontSize: 32, fontWeight: "bold" },
  brand: {
    fontSize: 26,
    fontWeight: "bold",
    color: colors.primary,
    letterSpacing: 3,
    marginTop: 14,
  },
  tagline: {
    fontSize: 19,
    fontWeight: "600",
    color: colors.text,
    textAlign: "center",
    marginTop: 10,
    lineHeight: 28,
  },
  taglineFr: { fontSize: 14, fontWeight: "500", color: colors.textMuted },
  heroBody: {
    fontSize: 14,
    lineHeight: 23,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 14,
  },

  features: { paddingHorizontal: 20 },
  featureCard: {
    flexDirection: "row",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  glyphCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginStart: 14,
  },
  glyph: { fontSize: 22 },
  featureBody: { flex: 1 },
  featureTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.text,
    textAlign: "auto",
  },
  featureSubtitle: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 3,
    textAlign: "auto",
  },
  featureText: {
    fontSize: 13,
    lineHeight: 21,
    color: colors.textSecondary,
    marginTop: 7,
    textAlign: "auto",
  },

  footnote: {
    fontSize: 12,
    color: colors.textFaint,
    textAlign: "center",
    marginTop: 8,
  },

  ctaBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    backgroundColor: colors.surface,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryButtonText: { color: colors.onPrimary, fontSize: 15, fontWeight: "bold" },
  secondaryButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  secondaryButtonText: { color: colors.primary, fontSize: 15, fontWeight: "bold" },
});
