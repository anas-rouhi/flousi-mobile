import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, TouchableOpacity } from "react-native";
import { fontSizes, radii, spacing } from "../../constants/theme";
import { useThemedStyles } from "../../context/ThemeContext";
import { useI18n } from "../../i18n";
import { tapFeedback } from "../../utils/haptics";

/**
 * "🔥 5 أيام متتالية" — the header pill that opens the badges sheet.
 *
 * The flame breathes while the streak is alive; once today is logged it also
 * gets a brighter fill, so "I kept it going" is visible at a glance. Both
 * animations run on the native driver.
 */
export default function StreakBadge({ streak, onPress }) {
  const styles = useThemedStyles(createStyles);
  const { t } = useI18n();
  const pulse = useRef(new Animated.Value(0)).current;
  const entrance = useRef(new Animated.Value(0)).current;

  const count = streak?.current ?? 0;
  const alive = count > 0;

  // Pops in once the streak has loaded — not on mount, while nothing shows.
  const loaded = Boolean(streak);
  useEffect(() => {
    if (!loaded) {
      return;
    }
    Animated.spring(entrance, {
      toValue: 1,
      friction: 6,
      tension: 80,
      useNativeDriver: true,
    }).start();
  }, [loaded, entrance]);

  useEffect(() => {
    if (!alive) {
      pulse.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [alive, pulse]);

  if (!streak) {
    return null;
  }

  const flameScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] });

  return (
    <Animated.View
      style={{
        opacity: entrance,
        transform: [{ scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
      }}
    >
      <TouchableOpacity
        style={[styles.pill, alive && styles.pillAlive, streak.loggedToday && styles.pillLit]}
        onPress={() => {
          tapFeedback();
          onPress?.();
        }}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={t("streak.a11y", { count })}
      >
        <Animated.Text style={[styles.flame, { transform: [{ scale: flameScale }] }]}>
          {alive ? "🔥" : "✨"}
        </Animated.Text>
        <Text style={[styles.label, alive && styles.labelAlive]} numberOfLines={1}>
          {alive ? t("streak.days", { count }) : t("streak.start")}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    pill: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: 4,
      borderRadius: radii.pill,
      paddingVertical: 5,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.surfaceSunken,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pillAlive: {
      backgroundColor: colors.budgetWarningSurface,
      borderColor: colors.warning,
    },
    pillLit: {
      boxShadow: `0 0 10px ${colors.warning}66`,
    },
    flame: { fontSize: 15 },
    label: {
      fontSize: fontSizes.small,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    labelAlive: { color: colors.warning },
  });
