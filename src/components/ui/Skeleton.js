import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
} from "react-native";
import { radii, spacing } from "../../constants/theme";
import { useTheme } from "../../context/ThemeContext";

/**
 * Placeholder blocks that sweep while data loads.
 *
 * A skeleton beats a spinner here because the dashboard's shape is known
 * before its numbers are: the cards appear where they will actually be, so
 * nothing jumps when the figures land.
 *
 * The sweep is a translucent band moved with the native driver — no gradient
 * dependency — and it is dropped entirely when the OS asks for reduced motion,
 * leaving the blocks still.
 */
function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((value) => {
        if (active) {
          setReduced(Boolean(value));
        }
      })
      .catch(() => {});

    const subscription = AccessibilityInfo.addEventListener?.(
      "reduceMotionChanged",
      (value) => setReduced(Boolean(value)),
    );
    return () => {
      active = false;
      subscription?.remove?.();
    };
  }, []);

  return reduced;
}

export function Skeleton({ width = "100%", height = 14, radius = 6, style }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  const [boxWidth, setBoxWidth] = useState(0);

  useEffect(() => {
    if (reduced || boxWidth === 0) {
      return;
    }
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 1150,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, boxWidth, progress]);

  const bandWidth = Math.max(boxWidth * 0.45, 40);

  return (
    <View
      onLayout={({ nativeEvent }) => setBoxWidth(nativeEvent.layout.width)}
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: colors.track,
          overflow: "hidden",
        },
        style,
      ]}
    >
      {reduced || boxWidth === 0 ? null : (
        <Animated.View
          style={{
            width: bandWidth,
            height: "100%",
            backgroundColor: colors.surfaceSunken,
            opacity: 0.9,
            transform: [
              {
                translateX: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-bandWidth, boxWidth],
                }),
              },
            ],
          }}
        />
      )}
    </View>
  );
}

/** A card-shaped block, matching the real cards' radius and margin. */
export function SkeletonCard({ height = 120, style }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        style,
      ]}
    >
      <Skeleton width="45%" height={12} />
      <Skeleton width="72%" height={26} style={styles.gap} />
      <Skeleton width="34%" height={11} style={styles.gapSmall} />
      {height > 150 ? (
        <Skeleton width="100%" height={10} radius={5} style={styles.gap} />
      ) : null}
    </View>
  );
}

/** The dashboard's silhouette: hero, insight line, then three cards. */
export function DashboardSkeleton() {
  const { colors } = useTheme();
  return (
    <View
      style={styles.screen}
      accessibilityRole="progressbar"
      accessibilityLabel=""
    >
      <View style={[styles.hero, { backgroundColor: colors.primary }]}>
        <Skeleton width="50%" height={13} />
        <Skeleton width="68%" height={30} style={styles.gap} />
        <Skeleton width="40%" height={11} style={styles.gapSmall} />
      </View>
      <SkeletonCard height={70} />
      <SkeletonCard height={170} />
      <SkeletonCard height={140} />
    </View>
  );
}

/** Analytics: the cash-flow card, then the distribution list. */
export function AnalyticsSkeleton() {
  return (
    <View
      style={styles.screen}
      accessibilityRole="progressbar"
      accessibilityLabel=""
    >
      <SkeletonCard height={150} />
      <SkeletonCard height={190} />
      <SkeletonCard height={120} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { padding: spacing.lg },
  hero: {
    borderRadius: radii.xxl,
    padding: spacing.xxl,
    // Dimmed so the emerald hero reads as loading rather than as final.
    opacity: 0.55,
  },
  card: {
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    marginTop: spacing.lg,
  },
  gap: { marginTop: spacing.md },
  gapSmall: { marginTop: spacing.sm },
});
