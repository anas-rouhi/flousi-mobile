import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Modal,
  PanResponder,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { categoryGlyph } from "../../constants/categoryIcons";
import { useLocale } from "../../context/LocaleContext";
import { useI18n } from "../../i18n";
import { getLocale } from "../../i18n/store";
import { describeApiError } from "../../services/api";
import { fetchMonthlyAnalytics } from "../../services/analytics";
import { primeCategoryCatalog } from "../../services/categories";
import { isolate, ltr } from "../../utils/bidi";
import { categoryName } from "../../utils/categories";
import { formatMonthYear } from "../../utils/date";
import { selectionFeedback, successFeedback } from "../../utils/haptics";

/** How long each slide stays up before the story moves on. */
const SLIDE_MS = 5500;
/** A press longer than this is a hold (pause), not a tap. */
const TAP_MS = 250;
/** Pull-down distance that dismisses the story. */
const DISMISS_DY = 110;

/**
 * Story palette. Fixed rather than themed: a story is a branded moment, and the
 * share card must look the same whoever receives it.
 */
const SLIDE_COLORS = {
  cashflow: "#0A5C36",
  peak: "#1E1B4B",
  categories: "#9A3412",
  savings: "#92400E",
  share: "#064E3B",
  empty: "#0A5C36",
};
const WHITE = "#FFFFFF";
const WHITE_SOFT = "rgba(255,255,255,0.78)";
const WHITE_FAINT = "rgba(255,255,255,0.28)";

/** Savings tiers for slide 4 and the share card, from the month's rate. */
function savingsTier(rate, net) {
  if (net <= 0 || rate === null || rate === undefined) {
    return { id: "comeback", glyph: "💪" };
  }
  if (rate >= 30) {
    return { id: "king", glyph: "💎" };
  }
  if (rate >= 15) {
    return { id: "pro", glyph: "🏆" };
  }
  return { id: "sprout", glyph: "🌱" };
}

/** "Saturday 12 September", in the UI language. */
function formatPeakDay(isoDate) {
  const [year, month, day] = String(isoDate).split("-").map(Number);
  if (!year || !month || !day) {
    return "";
  }
  try {
    return new Intl.DateTimeFormat(getLocale(), {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(year, month - 1, day, 12)));
  } catch {
    return `${day}/${month}/${year}`;
  }
}

/** Everything the slides show, pulled out of the analytics payload once. */
function buildStory(analytics, period) {
  const summary = analytics?.summary ?? {};
  const days = analytics?.daily_trend ?? [];
  const peak = days.reduce(
    (top, day) => ((day.expense || 0) > (top?.expense || 0) ? day : top),
    null,
  );
  const categories = [...(analytics?.categories ?? [])]
    .filter((row) => (row.spent || 0) > 0)
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 3);
  const net = summary.net_savings ?? 0;
  const rate = summary.savings_rate_percentage;
  const month = analytics?.period?.month ?? period?.month;
  const year = analytics?.period?.year ?? period?.year;

  return {
    monthLabel: formatMonthYear(month, year),
    income: summary.total_income ?? 0,
    expense: summary.total_expense ?? 0,
    incomeText: summary.total_income_formatted ?? "0",
    expenseText: summary.total_expense_formatted ?? "0",
    netText: summary.net_savings_formatted ?? "0",
    net,
    rate,
    peak: peak && peak.expense > 0 ? peak : null,
    categories,
    tier: savingsTier(rate, net),
  };
}

/**
 * FLOUSI Wrapped: the month told as a full-screen story.
 *
 * Tapping the forward half moves on and the other half goes back — "forward"
 * follows the reading direction, so in Arabic it is the left half, the same way
 * the progress bars fill from the right. Holding pauses, pulling down closes.
 *
 * All motion (progress bars, slide entrances, the pull-down) runs on the native
 * driver; the JS thread only hears about slide boundaries.
 *
 * @param {{ visible: boolean, onClose: () => void,
 *           period?: { month: number, year: number },
 *           analytics?: object }} props `analytics` skips the fetch when the
 *   caller already has the month loaded (the Analytics screen does).
 */
export default function MonthlyStoryModal({ visible, onClose, period, analytics: preloaded }) {
  const { t } = useI18n();
  const { wantsRTL } = useLocale();
  const insets = useSafeAreaInsets();

  const [analytics, setAnalytics] = useState(preloaded ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [index, setIndex] = useState(0);
  const [trackWidth, setTrackWidth] = useState(0);
  const [sharing, setSharing] = useState(false);

  const progress = useRef(new Animated.Value(0)).current;
  const enter = useRef(new Animated.Value(0)).current;
  const drag = useRef(new Animated.Value(0)).current;
  const cardRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [next] = await Promise.all([
        fetchMonthlyAnalytics(period ?? {}),
        primeCategoryCatalog(),
      ]);
      setAnalytics(next);
    } catch (err) {
      console.log("Story load failed:", err.response?.data || err.message);
      setError(describeApiError(err));
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    setIndex(0);
    drag.setValue(0);
    if (preloaded) {
      setAnalytics(preloaded);
    } else {
      load();
    }
  }, [visible, preloaded, load, drag]);

  const story = useMemo(
    () => (analytics ? buildStory(analytics, period) : null),
    [analytics, period],
  );

  const slides = useMemo(() => {
    if (!story) {
      return [];
    }
    if (story.income === 0 && story.expense === 0) {
      return ["empty"];
    }
    return ["cashflow", "peak", "categories", "savings", "share"];
  }, [story]);

  const lastIndex = slides.length - 1;
  const ready = visible && slides.length > 0;

  // ---- playback -----------------------------------------------------------

  // The PanResponder and the timer callback are created once, so everything
  // they read lives in refs.
  const indexRef = useRef(0);
  const lastRef = useRef(0);
  const rtlRef = useRef(wantsRTL);
  const pausedAt = useRef(0);
  const pressedAt = useRef(0);
  indexRef.current = index;
  lastRef.current = lastIndex;
  rtlRef.current = wantsRTL;

  const play = useCallback(
    (from = 0) => {
      Animated.timing(progress, {
        toValue: 1,
        duration: SLIDE_MS * (1 - from),
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(({ finished }) => {
        // The last slide (the share card) stays up once its bar is full.
        if (finished && indexRef.current < lastRef.current) {
          setIndex((current) => current + 1);
        }
      });
    },
    [progress],
  );

  const pause = useCallback(() => {
    progress.stopAnimation((value) => {
      pausedAt.current = value;
    });
  }, [progress]);

  const resume = useCallback(() => {
    if (pausedAt.current < 1) {
      play(pausedAt.current);
    }
  }, [play]);

  // Every slide change restarts its bar and replays its entrance.
  useEffect(() => {
    if (!ready) {
      return undefined;
    }
    progress.setValue(0);
    pausedAt.current = 0;
    enter.setValue(0);
    Animated.spring(enter, {
      toValue: 1,
      friction: 8,
      tension: 60,
      useNativeDriver: true,
    }).start();
    play(0);
    return () => progress.stopAnimation();
  }, [ready, index, play, progress, enter]);

  const close = useCallback(() => {
    progress.stopAnimation();
    onClose?.();
  }, [onClose, progress]);

  const goForward = useCallback(() => {
    selectionFeedback();
    if (indexRef.current >= lastRef.current) {
      close();
      return;
    }
    setIndex((current) => Math.min(current + 1, lastRef.current));
  }, [close]);

  const goBack = useCallback(() => {
    selectionFeedback();
    if (indexRef.current === 0) {
      // Replays the first slide rather than doing nothing.
      progress.setValue(0);
      play(0);
      return;
    }
    setIndex((current) => Math.max(current - 1, 0));
  }, [play, progress]);

  const dismiss = useCallback(() => {
    Animated.timing(drag, {
      toValue: Dimensions.get("window").height,
      duration: 220,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(() => close());
  }, [drag, close]);

  const handlers = useRef({});
  handlers.current = { pause, resume, goForward, goBack, dismiss };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 8,
      onPanResponderGrant: () => {
        pressedAt.current = Date.now();
        handlers.current.pause();
      },
      onPanResponderMove: (_, g) => {
        drag.setValue(Math.max(g.dy, 0));
      },
      onPanResponderRelease: (event, g) => {
        if (g.dy > DISMISS_DY || (g.vy > 0.9 && g.dy > 30)) {
          handlers.current.dismiss();
          return;
        }
        Animated.spring(drag, { toValue: 0, friction: 7, useNativeDriver: true }).start();

        const isTap =
          Math.abs(g.dx) < 12 && Math.abs(g.dy) < 12 && Date.now() - pressedAt.current < TAP_MS;
        if (!isTap) {
          handlers.current.resume();
          return;
        }
        const leftHalf = event.nativeEvent.pageX < Dimensions.get("window").width / 2;
        const forward = rtlRef.current ? leftHalf : !leftHalf;
        if (forward) {
          handlers.current.goForward();
        } else {
          handlers.current.goBack();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(drag, { toValue: 0, friction: 7, useNativeDriver: true }).start();
        handlers.current.resume();
      },
    }),
  ).current;

  // ---- share --------------------------------------------------------------

  const share = useCallback(async () => {
    if (!story || sharing) {
      return;
    }
    setSharing(true);
    const message = t("story.share_message", {
      month: story.monthLabel,
      income: story.incomeText,
      expense: story.expenseText,
    });
    try {
      const uri = await captureRef(cardRef, { format: "png", quality: 1, result: "tmpfile" });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          UTI: "public.png",
          dialogTitle: t("story.share"),
        });
      } else {
        await Share.share({ message });
      }
      successFeedback();
    } catch (err) {
      console.log("Story share failed:", err?.message);
      // The image is the nice version; the text still carries the story.
      await Share.share({ message }).catch(() => {});
    } finally {
      setSharing(false);
    }
  }, [story, sharing, t]);

  // ---- render -------------------------------------------------------------

  const slide = slides[index];
  const background = SLIDE_COLORS[slide] ?? SLIDE_COLORS.cashflow;
  const fillFrom = (wantsRTL ? 1 : -1) * trackWidth;

  const sheetStyle = {
    transform: [
      { translateY: drag },
      { scale: drag.interpolate({ inputRange: [0, 400], outputRange: [1, 0.92], extrapolate: "clamp" }) },
    ],
    borderRadius: 0,
  };
  const scrimOpacity = drag.interpolate({ inputRange: [0, 400], outputRange: [1, 0.2], extrapolate: "clamp" });
  const enterStyle = {
    opacity: enter,
    transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }],
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={close} statusBarTranslucent>
      <Animated.View style={[styles.scrim, { opacity: scrimOpacity }]} />
      <Animated.View
        style={[
          styles.story,
          sheetStyle,
          { backgroundColor: background, direction: wantsRTL ? "rtl" : "ltr" },
        ]}
        {...(ready ? responder.panHandlers : {})}
      >
        <Decor />

        {/* Progress bars + close */}
        <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
          <View style={styles.bars}>
            {slides.map((key, i) => (
              <View
                key={key}
                style={styles.barTrack}
                onLayout={i === 0 ? (e) => setTrackWidth(e.nativeEvent.layout.width) : undefined}
              >
                {i < index ? <View style={styles.barFill} /> : null}
                {i === index && trackWidth > 0 ? (
                  <Animated.View
                    style={[
                      styles.barFill,
                      {
                        transform: [
                          {
                            translateX: progress.interpolate({
                              inputRange: [0, 1],
                              outputRange: [fillFrom, 0],
                            }),
                          },
                        ],
                      },
                    ]}
                  />
                ) : null}
              </View>
            ))}
          </View>
          <View style={styles.topRow}>
            <Text style={styles.brand}>FLOUSI</Text>
            <Text style={styles.month}>{story?.monthLabel ?? ""}</Text>
            <TouchableOpacity onPress={close} hitSlop={14} accessibilityLabel={t("common.close")}>
              <Text style={styles.closeGlyph}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
          {loading ? (
            <ActivityIndicator color={WHITE} size="large" />
          ) : error ? (
            <View style={styles.center}>
              <Text style={styles.lead}>{error}</Text>
              <TouchableOpacity style={styles.ghostButton} onPress={load}>
                <Text style={styles.ghostText}>{t("common.retry")}</Text>
              </TouchableOpacity>
            </View>
          ) : story && slide ? (
            <Animated.View style={[styles.slide, enterStyle]} key={slide}>
              {slide === "cashflow" ? <CashflowSlide story={story} t={t} /> : null}
              {slide === "peak" ? <PeakSlide story={story} t={t} /> : null}
              {slide === "categories" ? (
                <CategoriesSlide story={story} t={t} enter={enter} wantsRTL={wantsRTL} />
              ) : null}
              {slide === "savings" ? <SavingsSlide story={story} t={t} enter={enter} /> : null}
              {slide === "share" ? (
                <ShareSlide story={story} t={t} cardRef={cardRef} sharing={sharing} onShare={share} />
              ) : null}
              {slide === "empty" ? <EmptySlide t={t} /> : null}
            </Animated.View>
          ) : null}
        </View>
      </Animated.View>
    </Modal>
  );
}

// ---- slides ---------------------------------------------------------------

function CashflowSlide({ story, t }) {
  return (
    <View style={styles.center}>
      <Text style={styles.kicker}>{t("story.cashflow.kicker")}</Text>
      <Text style={styles.headline}>
        {t("story.cashflow.headline", {
          income: ltr(`+${story.incomeText}`),
          expense: ltr(story.expenseText),
        })}
      </Text>
      <View style={styles.statRow}>
        <Stat label={t("story.cashflow.in")} value={`+${story.incomeText}`} />
        <View style={styles.statDivider} />
        <Stat label={t("story.cashflow.out")} value={`-${story.expenseText}`} />
      </View>
      <Text style={styles.caption}>
        {story.net >= 0
          ? t("story.cashflow.net_positive", { amount: ltr(story.netText) })
          : t("story.cashflow.net_negative", { amount: ltr(story.netText) })}
      </Text>
    </View>
  );
}

function PeakSlide({ story, t }) {
  if (!story.peak) {
    return (
      <View style={styles.center}>
        <Text style={styles.bigGlyph}>🧘</Text>
        <Text style={styles.headline}>{t("story.peak.quiet")}</Text>
      </View>
    );
  }
  return (
    <View style={styles.center}>
      <Text style={styles.kicker}>{t("story.peak.kicker")}</Text>
      <View style={styles.dayCard}>
        <Text style={styles.dayNumber}>{ltr(String(story.peak.day))}</Text>
        <Text style={styles.dayName}>{formatPeakDay(story.peak.date)}</Text>
      </View>
      <Text style={styles.amountHuge}>{ltr(story.peak.expense_formatted)}</Text>
      <Text style={styles.caption}>{t("story.peak.caption")}</Text>
    </View>
  );
}

function CategoriesSlide({ story, t, enter, wantsRTL }) {
  if (!story.categories.length) {
    return (
      <View style={styles.center}>
        <Text style={styles.bigGlyph}>🌿</Text>
        <Text style={styles.headline}>{t("story.categories.none")}</Text>
      </View>
    );
  }
  const [top] = story.categories;
  return (
    <View style={styles.center}>
      <Text style={styles.kicker}>{t("story.categories.kicker")}</Text>
      <Text style={styles.bigGlyph}>{categoryGlyph(top.icon)}</Text>
      <Text style={styles.headline}>
        {t("story.categories.headline", {
          category: isolate(categoryName(top)),
          percent: ltr(`${Math.round(top.percentage ?? 0)}%`),
        })}
      </Text>
      <View style={styles.catList}>
        {story.categories.map((row) => (
          <View key={row.id ?? row.name} style={styles.catRow}>
            <View style={styles.catHead}>
              <Text style={styles.catName} numberOfLines={1}>
                {`${categoryGlyph(row.icon)} ${categoryName(row)}`}
              </Text>
              <Text style={styles.catAmount}>{ltr(row.spent_formatted)}</Text>
            </View>
            <View style={styles.catTrack}>
              {/* Grows from the start edge; scaleX keeps it on the native driver. */}
              <Animated.View
                style={[
                  styles.catFill,
                  {
                    width: `${Math.max(row.percentage ?? 0, 3)}%`,
                    backgroundColor: row.color || WHITE,
                    transformOrigin: wantsRTL ? "right" : "left",
                    transform: [{ scaleX: enter }],
                  },
                ]}
              />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function SavingsSlide({ story, t, enter }) {
  const spin = enter.interpolate({ inputRange: [0, 1], outputRange: ["-25deg", "0deg"] });
  const grow = enter.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  return (
    <View style={styles.center}>
      <Text style={styles.kicker}>{t("story.savings.kicker")}</Text>
      <Animated.View style={[styles.medal, { transform: [{ scale: grow }, { rotate: spin }] }]}>
        <Text style={styles.medalGlyph}>{story.tier.glyph}</Text>
      </Animated.View>
      <Text style={styles.headline}>{t(`story.savings.tier.${story.tier.id}`)}</Text>
      {story.net > 0 ? (
        <Text style={styles.caption}>
          {story.rate !== null && story.rate !== undefined
            ? t("story.savings.rate", {
                amount: ltr(story.netText),
                rate: ltr(`${Math.round(story.rate)}%`),
              })
            : t("story.savings.amount", { amount: ltr(story.netText) })}
        </Text>
      ) : (
        <Text style={styles.caption}>{t("story.savings.comeback_hint")}</Text>
      )}
    </View>
  );
}

function ShareSlide({ story, t, cardRef, sharing, onShare }) {
  const [top] = story.categories;
  return (
    <View style={styles.center}>
      {/* The captured image: self-contained, with its own background. */}
      <View ref={cardRef} collapsable={false} style={styles.shareCard}>
        <Decor small />
        <Text style={styles.shareBrand}>FLOUSI</Text>
        <Text style={styles.shareMonth}>{story.monthLabel}</Text>
        <Text style={styles.shareGlyph}>{story.tier.glyph}</Text>
        <Text style={styles.shareTier}>{t(`story.savings.tier.${story.tier.id}`)}</Text>
        <View style={styles.shareStats}>
          <Stat label={t("story.cashflow.in")} value={`+${story.incomeText}`} compact />
          <View style={styles.statDivider} />
          <Stat label={t("story.cashflow.out")} value={`-${story.expenseText}`} compact />
        </View>
        {top ? (
          <Text style={styles.shareLine} numberOfLines={1}>
            {t("story.share_top", { category: isolate(`${categoryGlyph(top.icon)} ${categoryName(top)}`) })}
          </Text>
        ) : null}
        <Text style={styles.shareFooter}>{t("story.share_footer")}</Text>
      </View>

      <TouchableOpacity
        style={styles.shareButton}
        onPress={onShare}
        disabled={sharing}
        activeOpacity={0.85}
        accessibilityRole="button"
      >
        {sharing ? (
          <ActivityIndicator color={SLIDE_COLORS.share} />
        ) : (
          <Text style={styles.shareButtonText}>{t("story.share")}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

function EmptySlide({ t }) {
  return (
    <View style={styles.center}>
      <Text style={styles.bigGlyph}>📖</Text>
      <Text style={styles.headline}>{t("story.empty")}</Text>
      <Text style={styles.caption}>{t("story.empty_hint")}</Text>
    </View>
  );
}

function Stat({ label, value, compact }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, compact && styles.statValueCompact]} numberOfLines={1} adjustsFontSizeToFit>
        {ltr(value)}
      </Text>
    </View>
  );
}

/** Soft circles behind the content — depth without an image or gradient lib. */
function Decor({ small }) {
  const k = small ? 0.5 : 1;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.orb, { width: 320 * k, height: 320 * k, top: -90 * k, end: -110 * k }]} />
      <View style={[styles.orb, { width: 240 * k, height: 240 * k, bottom: -60 * k, start: -90 * k }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "#000" },
  story: { flex: 1, overflow: "hidden" },
  orb: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.07)",
  },

  top: { paddingHorizontal: 12 },
  bars: { flexDirection: "row", gap: 4 },
  barTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: WHITE_FAINT,
    overflow: "hidden",
  },
  barFill: { ...StyleSheet.absoluteFillObject, backgroundColor: WHITE, borderRadius: 2 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingHorizontal: 4,
  },
  brand: { color: WHITE, fontWeight: "900", letterSpacing: 2, fontSize: 15 },
  month: { color: WHITE_SOFT, fontSize: 13, fontWeight: "600" },
  closeGlyph: { color: WHITE, fontSize: 20, fontWeight: "600" },

  body: { flex: 1, justifyContent: "center", paddingHorizontal: 28 },
  slide: { flex: 1, justifyContent: "center" },
  center: { alignItems: "center", justifyContent: "center" },

  kicker: {
    color: WHITE_SOFT,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    textAlign: "center",
    marginBottom: 14,
  },
  headline: {
    color: WHITE,
    fontSize: 27,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 40,
  },
  lead: { color: WHITE, fontSize: 17, textAlign: "center", lineHeight: 26 },
  caption: {
    color: WHITE_SOFT,
    fontSize: 15,
    textAlign: "center",
    marginTop: 18,
    lineHeight: 23,
  },
  bigGlyph: { fontSize: 64, marginBottom: 12 },
  amountHuge: { color: WHITE, fontSize: 40, fontWeight: "900", marginTop: 20 },

  statRow: {
    flexDirection: "row",
    alignSelf: "stretch",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 10,
    marginTop: 28,
  },
  stat: { flex: 1, alignItems: "center", paddingHorizontal: 6 },
  statLabel: { color: WHITE_SOFT, fontSize: 12, fontWeight: "600" },
  statValue: { color: WHITE, fontSize: 20, fontWeight: "800", marginTop: 6 },
  statValueCompact: { fontSize: 16 },
  statDivider: { width: 1, backgroundColor: WHITE_FAINT },

  dayCard: {
    width: 170,
    height: 170,
    borderRadius: 28,
    backgroundColor: WHITE,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
  },
  dayNumber: { fontSize: 72, fontWeight: "900", color: SLIDE_COLORS.peak },
  dayName: { fontSize: 14, fontWeight: "700", color: "#4338CA", marginTop: -4 },

  catList: { alignSelf: "stretch", marginTop: 28, gap: 16 },
  catRow: {},
  catHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  catName: { color: WHITE, fontSize: 15, fontWeight: "700", flexShrink: 1 },
  catAmount: { color: WHITE_SOFT, fontSize: 13, fontWeight: "600" },
  catTrack: { height: 10, borderRadius: 5, backgroundColor: WHITE_FAINT, overflow: "hidden" },
  catFill: { height: "100%", borderRadius: 5 },

  medal: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 3,
    borderColor: "#FCD34D",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
    boxShadow: "0 0 36px rgba(252,211,77,0.55)",
  },
  medalGlyph: { fontSize: 72 },

  shareCard: {
    alignSelf: "stretch",
    borderRadius: 28,
    backgroundColor: SLIDE_COLORS.cashflow,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    paddingVertical: 26,
    paddingHorizontal: 20,
    alignItems: "center",
    overflow: "hidden",
  },
  shareBrand: { color: WHITE, fontWeight: "900", fontSize: 22, letterSpacing: 4 },
  shareMonth: { color: WHITE_SOFT, fontSize: 13, fontWeight: "600", marginTop: 2 },
  shareGlyph: { fontSize: 54, marginTop: 18 },
  shareTier: { color: WHITE, fontSize: 20, fontWeight: "800", textAlign: "center", marginTop: 6 },
  shareStats: {
    flexDirection: "row",
    alignSelf: "stretch",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 18,
  },
  shareLine: { color: WHITE, fontSize: 14, fontWeight: "600", marginTop: 14 },
  shareFooter: { color: WHITE_SOFT, fontSize: 12, marginTop: 16, letterSpacing: 0.5 },
  shareButton: {
    alignSelf: "stretch",
    backgroundColor: WHITE,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 22,
    minHeight: 54,
    justifyContent: "center",
  },
  shareButtonText: { color: SLIDE_COLORS.share, fontSize: 17, fontWeight: "800" },

  ghostButton: {
    borderWidth: 1.5,
    borderColor: WHITE,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 28,
    marginTop: 18,
  },
  ghostText: { color: WHITE, fontWeight: "700", fontSize: 15 },
});
