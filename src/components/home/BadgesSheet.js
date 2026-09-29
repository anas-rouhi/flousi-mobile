import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Modal from "../../platform/Modal";
import { fontSizes, radii, spacing } from "../../constants/theme";
import { useLocale } from "../../context/LocaleContext";
import { useThemedStyles } from "../../context/ThemeContext";
import { useI18n } from "../../i18n";
import { ltr } from "../../utils/bidi";

/**
 * The streak up close, and every badge — earned ones in colour, locked ones
 * faded with how far along they are.
 */
export default function BadgesSheet({ visible, onClose, streak, badges }) {
  const styles = useThemedStyles(createStyles);
  const { t } = useI18n();
  const { wantsRTL } = useLocale();
  const count = streak?.current ?? 0;
  const earned = badges.filter((badge) => badge.unlocked).length;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* A Modal is its own native root: it does not inherit App's direction. */}
      <View style={[styles.backdrop, { direction: wantsRTL ? "rtl" : "ltr" }]}>
        <TouchableOpacity style={styles.dismiss} onPress={onClose} activeOpacity={1} />
        <View style={styles.sheet}>
          <View style={styles.grabber} />

          <View style={styles.hero}>
            <Text style={styles.heroFlame}>{count > 0 ? "🔥" : "✨"}</Text>
            <Text style={styles.heroCount}>{ltr(String(count))}</Text>
            <Text style={styles.heroLabel}>
              {count > 0 ? t("streak.days_long", { count }) : t("streak.start_long")}
            </Text>
            <Text style={styles.heroHint}>
              {streak?.loggedToday || count === 0
                ? t("streak.best", { count: streak?.best ?? 0 })
                : t("streak.keep_alive")}
            </Text>
          </View>

          <View style={styles.titleRow}>
            <Text style={styles.title}>{t("badges.title")}</Text>
            <Text style={styles.meta}>{ltr(`${earned} / ${badges.length}`)}</Text>
          </View>

          <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
            {badges.map((badge) => (
              <View
                key={badge.id}
                style={[styles.badge, badge.unlocked && styles.badgeUnlocked]}
              >
                <Text style={[styles.glyph, !badge.unlocked && styles.glyphLocked]}>
                  {badge.glyph}
                </Text>
                <Text style={styles.badgeName} numberOfLines={1}>
                  {t(`badges.${badge.id}.name`)}
                </Text>
                <Text style={styles.badgeDesc} numberOfLines={2}>
                  {t(`badges.${badge.id}.desc`)}
                </Text>
                {badge.unlocked ? (
                  <Text style={styles.earned}>{t("badges.earned")}</Text>
                ) : (
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${badge.progress * 100}%` }]} />
                  </View>
                )}
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity style={styles.close} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.closeText}>{t("common.ok")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: colors.scrim, justifyContent: "flex-end" },
    dismiss: { flex: 1 },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radii.sheet,
      borderTopRightRadius: radii.sheet,
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xxl,
      maxHeight: "88%",
    },
    grabber: {
      width: 42,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.grabber,
      alignSelf: "center",
      marginTop: 10,
    },
    hero: { alignItems: "center", paddingVertical: spacing.lg },
    heroFlame: { fontSize: 40 },
    heroCount: { fontSize: 44, fontWeight: "800", color: colors.warning, marginTop: 2 },
    heroLabel: { fontSize: fontSizes.bodyLarge, fontWeight: "700", color: colors.text },
    heroHint: {
      fontSize: fontSizes.small,
      color: colors.textMuted,
      marginTop: 4,
      textAlign: "center",
    },
    titleRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.md,
    },
    title: { fontSize: fontSizes.subtitle, fontWeight: "bold", color: colors.text },
    meta: { fontSize: fontSizes.meta, color: colors.textMuted, fontWeight: "600" },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      rowGap: spacing.md,
    },
    badge: {
      width: "48%",
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
      padding: spacing.md,
      alignItems: "center",
    },
    badgeUnlocked: {
      borderColor: colors.primaryBorder,
      backgroundColor: colors.primarySoft,
    },
    glyph: { fontSize: 30 },
    glyphLocked: { opacity: 0.3 },
    badgeName: {
      fontSize: fontSizes.meta,
      fontWeight: "bold",
      color: colors.text,
      marginTop: 6,
    },
    badgeDesc: {
      fontSize: fontSizes.caption,
      color: colors.textMuted,
      textAlign: "center",
      marginTop: 2,
      minHeight: 28,
    },
    earned: {
      fontSize: fontSizes.caption,
      fontWeight: "bold",
      color: colors.primary,
      marginTop: 6,
    },
    track: {
      alignSelf: "stretch",
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.track,
      marginTop: 8,
      overflow: "hidden",
    },
    fill: { height: "100%", borderRadius: 3, backgroundColor: colors.warning },
    close: {
      backgroundColor: colors.primary,
      borderRadius: radii.lg,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: spacing.lg,
    },
    closeText: { color: colors.onPrimary, fontSize: fontSizes.bodyLarge, fontWeight: "bold" },
  });
