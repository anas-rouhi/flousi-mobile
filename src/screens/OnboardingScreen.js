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


/** The four pillars of the product, in pitch order. */
const FEATURES = [
  {
    key: "tracking",
    glyph: "⚡",
    // The brand accent follows the theme; the other three are one-off
    // illustration colours that read correctly on either ground.
    accentToken: "primary",
    title: "سجل مصروفك فـ أقل من 5 ثواني",
    subtitle: "Suivi ultra-rapide",
    body: "زيد المصروف بالدارجة ولا بالفرنسية بضغطة وحدة. بلا جداول، بلا تعقيد — كتب «قهوة 12 درهم» وصافي.",
  },
  {
    key: "assistant",
    glyph: "🤖",
    accent: "#1F6F8B",
    title: "مساعد ذكي كيهدر الدارجة",
    subtitle: "Assistant IA en Darija",
    body: "سولو «شحال صرفت هاد الشهر؟» ولا «فين كثر ما صرفت؟» وجاوبك بالدارجة، ويعطيك نصائح على حساب عاداتك.",
  },
  {
    key: "budget",
    glyph: "🎯",
    accent: "#C97B0B",
    title: "ميزانية وتوفير بذكاء",
    subtitle: "Budgets & épargne intelligents",
    body: "حدد سقف لكل فئة، تبّع نسبة التوفير ديالك شهر بشهر، وعرف فين ممكن تنقص قبل ما تسالي الشهر.",
  },
  {
    key: "privacy",
    glyph: "🔒",
    accent: "#5B4B8A",
    title: "معطياتك ديالك بوحدك",
    subtitle: "Confidentialité & sécurité",
    body: "الفلوس ديالك مخزنة مشفّرة، والدخول محمي بـ token على جهازك. ما كنبيعو حتى معطية لحتى شي جهة.",
  },
];

export default function OnboardingScreen({ onCreateAccount, onLogin }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
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
            الفلوس ديالك، مفهومة{"\n"}
            <Text style={styles.taglineFr}>
              Vos finances, enfin claires
            </Text>
          </Text>
          <Text style={styles.heroBody}>
            تطبيق مغربي لتتبع المصاريف والمداخيل، بالدارجة والفرنسية، مع مساعد
            ذكي كيعاونك تفهم فين مشيا فلوسك.
          </Text>
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
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={[styles.featureSubtitle, { color: accent }]}>
                  {feature.subtitle}
                </Text>
                <Text style={styles.featureText}>{feature.body}</Text>
              </View>
            </View>
            );
          })}
        </View>

        <Text style={styles.footnote}>
          مجاني للبداية • بالدارجة والفرنسية • بلا إشهارات
        </Text>
      </ScrollView>

      {/* Calls to action stay pinned below the scrolling pitch. */}
      <View style={styles.ctaBar}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={onCreateAccount}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>
            إنشاء حساب جديد • Create Account
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={onLogin}
          activeOpacity={0.7}
        >
          <Text style={styles.secondaryButtonText}>
            تسجيل الدخول • Login
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
    flexDirection: "row-reverse",
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
    marginLeft: 14,
  },
  glyph: { fontSize: 22 },
  featureBody: { flex: 1 },
  featureTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.text,
    textAlign: "right",
  },
  featureSubtitle: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 3,
    textAlign: "right",
  },
  featureText: {
    fontSize: 13,
    lineHeight: 21,
    color: colors.textSecondary,
    marginTop: 7,
    textAlign: "right",
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
