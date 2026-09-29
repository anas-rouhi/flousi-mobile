import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { fontSizes, radii, spacing } from "../../constants/theme";
import { useLocale } from "../../context/LocaleContext";
import { useTheme, useThemedStyles } from "../../context/ThemeContext";
import { useI18n } from "../../i18n";
import { FX_UNITS, convert, fetchRates, peekCachedRates } from "../../services/fx";
import { ltr } from "../../utils/bidi";
import { formatLocalDay } from "../../utils/date";
import { selectionFeedback, tapFeedback } from "../../utils/haptics";
import { sanitizeAmountInput } from "../../utils/money";
import { fixedLtrRow } from "../../utils/rtl";

const UNIT_META = {
  MAD: { glyph: "🇲🇦", suffix: "DH" },
  EUR: { glyph: "🇪🇺", suffix: "€" },
  USD: { glyph: "🇺🇸", suffix: "$" },
  SAR: { glyph: "🇸🇦", suffix: "SAR" },
  GOLD: { glyph: "🥇", suffix: "g" },
};

/** Grams of gold are small numbers for everyday sums, so they get a third decimal. */
const decimalsFor = (unit) => (unit === "GOLD" ? 3 : 2);

/** A computed value as the editable field shows it: "1234.5" style, no grouping. */
function toFieldText(value, unit) {
  if (!Number.isFinite(value) || value <= 0) {
    return "";
  }
  return String(Number(value.toFixed(decimalsFor(unit))));
}

/** "12 345,67 €" — the app's money style, for read-only lines. */
function formatUnit(value, unit) {
  const fixed = (Number.isFinite(value) ? value : 0).toFixed(decimalsFor(unit));
  const [units, cents] = fixed.split(".");
  const grouped = units.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return ltr(`${grouped},${cents} ${UNIT_META[unit].suffix}`);
}

function parseField(text) {
  const value = Number(sanitizeAmountInput(text));
  return Number.isFinite(value) ? value : 0;
}

export default function CurrencyConverterModal({ visible, onClose, currency = "MAD" }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useI18n();
  const { wantsRTL } = useLocale();

  const [fx, setFx] = useState(null);
  const [loading, setLoading] = useState(false);
  const [top, setTop] = useState("MAD");
  const [bottom, setBottom] = useState("EUR");
  // Only the side the user is typing in holds text; the other is derived.
  const [editing, setEditing] = useState("top");
  const [text, setText] = useState("100");
  const spin = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setFx(await fetchRates());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) {
      return;
    }
    const home = FX_UNITS.includes(currency) ? currency : "MAD";
    setTop(home);
    setBottom(home === "EUR" ? "MAD" : "EUR");
    setEditing("top");
    setText("100");
    // Paint the last known rates at once, then replace them with live ones.
    peekCachedRates().then((cached) => {
      if (cached) {
        setFx((current) => current ?? cached);
      }
    });
    load();
  }, [visible, currency, load]);

  const rates = fx?.rates;
  const typed = parseField(text);
  const topText =
    editing === "top" ? text : toFieldText(convert(typed, bottom, top, rates), top);
  const bottomText =
    editing === "bottom" ? text : toFieldText(convert(typed, top, bottom, rates), bottom);
  const baseUnit = editing === "top" ? top : bottom;

  const swap = () => {
    tapFeedback();
    spin.setValue(0);
    Animated.timing(spin, { toValue: 1, duration: 280, useNativeDriver: true }).start();
    // Keep the numbers where they are on screen: the typed value follows its unit.
    setTop(bottom);
    setBottom(top);
    setEditing(editing === "top" ? "bottom" : "top");
  };

  const pickUnit = (side, unit) => {
    selectionFeedback();
    const other = side === "top" ? bottom : top;
    // Picking the unit already on the other side swaps them rather than
    // converting a currency into itself.
    if (unit === other) {
      swap();
      return;
    }
    (side === "top" ? setTop : setBottom)(unit);
  };

  const statusText = !fx
    ? t("fx.loading")
    : fx.source === "live"
      ? t("fx.status_live", { date: fx.date ? formatRatesDate(fx.date) : "" })
      : fx.source === "cache"
        ? t("fx.status_cache", { date: fx.date ? formatRatesDate(fx.date) : "" })
        : t("fx.status_fallback");

  const unitLabel = (unit) => (unit === "GOLD" ? t("fx.gold") : unit);

  const renderSide = (side, unit, value) => (
    <View style={[styles.side, editing === side && styles.sideActive]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.units}>
        {FX_UNITS.map((code) => {
          const active = code === unit;
          return (
            <TouchableOpacity
              key={code}
              style={[styles.unit, active && styles.unitActive]}
              onPress={() => pickUnit(side, code)}
              activeOpacity={0.8}
            >
              <Text style={[styles.unitText, active && styles.unitTextActive]}>
                {`${UNIT_META[code].glyph} ${unitLabel(code)}`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <View style={styles.fieldRow}>
        <TextInput
          style={styles.field}
          value={value}
          onFocus={() => {
            if (editing !== side) {
              setEditing(side);
              setText(value);
            }
          }}
          onChangeText={(next) => {
            setEditing(side);
            setText(sanitizeAmountInput(next));
          }}
          placeholder="0"
          placeholderTextColor={colors.textPlaceholder}
          keyboardType="decimal-pad"
          accessibilityLabel={unitLabel(unit)}
        />
        <Text style={styles.fieldSuffix}>{UNIT_META[unit].suffix}</Text>
      </View>
    </View>
  );

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.backdrop, { direction: wantsRTL ? "rtl" : "ltr" }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.wrapper}
        >
          <View style={styles.sheet}>
            <View style={styles.grabber} />
            <View style={styles.header}>
              <Text style={styles.title}>{t("fx.title")}</Text>
              <TouchableOpacity onPress={onClose} hitSlop={12}>
                <Text style={styles.close}>{t("common.cancel")}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.statusRow}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      fx?.source === "live"
                        ? colors.success
                        : fx?.source === "cache"
                          ? colors.warning
                          : colors.textFaint,
                  },
                ]}
              />
              <Text style={styles.status} numberOfLines={1}>
                {statusText}
              </Text>
              {loading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <TouchableOpacity onPress={load} hitSlop={10} accessibilityRole="button">
                  <Text style={styles.refresh}>{t("fx.refresh")}</Text>
                </TouchableOpacity>
              )}
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {renderSide("top", top, topText)}

              <View style={styles.swapRow}>
                <TouchableOpacity
                  style={styles.swap}
                  onPress={swap}
                  accessibilityRole="button"
                  accessibilityLabel={t("fx.swap")}
                >
                  <Animated.Text style={[styles.swapGlyph, { transform: [{ rotate }] }]}>⇅</Animated.Text>
                </TouchableOpacity>
              </View>

              {renderSide("bottom", bottom, bottomText)}

              {rates ? (
                <Text style={styles.rateLine}>
                  {`${ltr(`1 ${UNIT_META[top].suffix}`)} = ${formatUnit(convert(1, top, bottom, rates), bottom)}`}
                </Text>
              ) : null}

              {rates && typed > 0 ? (
                <View style={styles.table}>
                  <Text style={styles.tableTitle}>
                    {t("fx.everywhere", { amount: formatUnit(typed, baseUnit) })}
                  </Text>
                  {FX_UNITS.filter((code) => code !== baseUnit).map((code) => (
                    <View key={code} style={styles.tableRow}>
                      <Text style={styles.tableUnit}>
                        {`${UNIT_META[code].glyph}  ${unitLabel(code)}`}
                      </Text>
                      <Text style={styles.tableValue}>
                        {formatUnit(convert(typed, baseUnit, code, rates), code)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <Text style={styles.disclaimer}>{t("fx.disclaimer")}</Text>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/** "2026-09-28" → "Today" / "28/09/2026", in the app's language. */
function formatRatesDate(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return formatLocalDay(new Date(year, month - 1, day));
}

const createStyles = (colors) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: colors.scrim, justifyContent: "flex-end" },
    wrapper: { maxHeight: "92%" },
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
      paddingTop: 14,
    },
    title: { fontSize: 19, fontWeight: "bold", color: colors.text },
    close: { fontSize: 15, color: colors.textMuted, fontWeight: "600" },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginTop: 6,
      marginBottom: spacing.lg,
    },
    dot: { width: 8, height: 8, borderRadius: 4 },
    status: { flex: 1, fontSize: fontSizes.small, color: colors.textMuted, textAlign: "auto" },
    refresh: { fontSize: fontSizes.small, fontWeight: "700", color: colors.primary },
    side: {
      borderRadius: radii.xl,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
      paddingVertical: spacing.md,
    },
    sideActive: { borderColor: colors.primary },
    units: { gap: 6, paddingHorizontal: spacing.md },
    unit: {
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingVertical: 6,
      paddingHorizontal: 11,
    },
    unitActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    unitText: { fontSize: fontSizes.small, fontWeight: "600", color: colors.textSecondary },
    unitTextActive: { color: colors.primary },
    fieldRow: {
      flexDirection: fixedLtrRow(),
      alignItems: "center",
      paddingHorizontal: spacing.lg,
      marginTop: spacing.sm,
    },
    field: {
      flex: 1,
      fontSize: 30,
      fontWeight: "800",
      color: colors.text,
      padding: 0,
      textAlign: "left",
    },
    fieldSuffix: { fontSize: 18, fontWeight: "700", color: colors.textMuted, marginStart: 8 },
    swapRow: { alignItems: "center", marginVertical: -12, zIndex: 1 },
    swap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 4,
      borderColor: colors.surface,
    },
    swapGlyph: { fontSize: 20, fontWeight: "800", color: colors.onPrimary },
    rateLine: {
      fontSize: fontSizes.meta,
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: spacing.md,
    },
    table: {
      marginTop: spacing.lg,
      borderRadius: radii.xl,
      backgroundColor: colors.surfaceSunken,
      padding: spacing.lg,
      gap: 10,
    },
    tableTitle: {
      fontSize: fontSizes.meta,
      fontWeight: "700",
      color: colors.textSecondary,
      textAlign: "auto",
    },
    tableRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    tableUnit: { fontSize: fontSizes.body, color: colors.text, fontWeight: "600" },
    tableValue: { fontSize: fontSizes.body, color: colors.text, fontWeight: "800" },
    disclaimer: {
      fontSize: fontSizes.caption,
      color: colors.textFaint,
      textAlign: "center",
      marginTop: spacing.lg,
    },
  });
