import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Modal from "../../platform/Modal";
import { fontSizes, radii, spacing } from "../../constants/theme";
import { useLocale } from "../../context/LocaleContext";
import { useTheme, useThemedStyles } from "../../context/ThemeContext";
import { useI18n } from "../../i18n";
import { ltr, stripLtr } from "../../utils/bidi";
import { selectionFeedback, successFeedback, tapFeedback } from "../../utils/haptics";
import {
  amountToCentimes,
  currencySymbol,
  formatCentimes,
  sanitizeAmountInput,
} from "../../utils/money";
import { fixedLtrRow } from "../../utils/rtl";

const TIPS = [0, 5, 10, 15];
const OCCASIONS = [
  { key: "coffee", glyph: "☕" },
  { key: "dinner", glyph: "🍕" },
  { key: "outing", glyph: "🎉" },
];
const MIN_PEOPLE = 2;
const MAX_PEOPLE = 30;
const WHATSAPP_GREEN = "#25D366";

/**
 * The bill split in integer centimes. The tip is applied once to the total and
 * each share is rounded *up* to the centime, so the group never comes out short.
 */
export function splitBill(totalCentimes, tipPercent, people) {
  const grand = Math.round((totalCentimes * (100 + tipPercent)) / 100);
  const each = people > 0 ? Math.ceil(grand / people) : 0;
  return { grand, tip: grand - totalCentimes, each };
}

/** "96,25" or "96" when the share is a whole amount — for the chat message. */
function plainAmount(centimes, currency) {
  const text = stripLtr(formatCentimes(centimes, currency));
  return text.replace(/,00(?=\s)/, "");
}

/**
 * WhatsApp first; wa.me when the app scheme is not handled; the system share
 * sheet if even that fails, so the message always goes somewhere.
 */
async function sendToWhatsApp(message) {
  const text = encodeURIComponent(message);
  try {
    await Linking.openURL(`whatsapp://send?text=${text}`);
    return;
  } catch {}
  try {
    await Linking.openURL(`https://wa.me/?text=${text}`);
    return;
  } catch {}
  await Share.share({ message });
}

export default function SplitBillModal({ visible, onClose, currency = "MAD" }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useI18n();
  const { wantsRTL } = useLocale();
  const [amount, setAmount] = useState("");
  const [tip, setTip] = useState(0);
  const [people, setPeople] = useState(4);
  const [occasion, setOccasion] = useState("dinner");
  const pop = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      setAmount("");
      setTip(0);
      setPeople(4);
      setOccasion("dinner");
    }
  }, [visible]);

  const total = amountToCentimes(amount);
  const { grand, tip: tipAmount, each } = splitBill(total, tip, people);

  // The share gives a small bounce whenever it changes.
  useEffect(() => {
    if (each <= 0) {
      return;
    }
    pop.setValue(0.96);
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 160, useNativeDriver: true }).start();
  }, [each, pop]);

  const changePeople = (delta) => {
    const next = Math.min(Math.max(people + delta, MIN_PEOPLE), MAX_PEOPLE);
    if (next !== people) {
      selectionFeedback();
      setPeople(next);
    }
  };

  const occasionMeta = OCCASIONS.find((item) => item.key === occasion) ?? OCCASIONS[1];
  const share = async () => {
    if (each <= 0) {
      return;
    }
    tapFeedback();
    const currencyWord = currency === "MAD" ? t("split.dirham") : currencySymbol(currency);
    const message = t("split.whatsapp_message", {
      amount: `${plainAmount(each, currency)} ${currencyWord}`,
      occasion: t(`split.occasion.${occasion}`),
      glyph: occasionMeta.glyph,
    });
    try {
      await sendToWhatsApp(message);
      successFeedback();
    } catch (err) {
      console.log("Split share failed:", err?.message);
    }
  };

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
              <Text style={styles.title}>{t("split.title")}</Text>
              <TouchableOpacity onPress={onClose} hitSlop={12}>
                <Text style={styles.close}>{t("common.cancel")}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.subtitle}>{t("split.subtitle")}</Text>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={styles.amountRow}>
                <TextInput
                  style={styles.amountInput}
                  value={amount}
                  onChangeText={(text) => setAmount(sanitizeAmountInput(text))}
                  placeholder="0"
                  placeholderTextColor={colors.textPlaceholder}
                  keyboardType="decimal-pad"
                  autoFocus
                  accessibilityLabel={t("split.total_label")}
                />
                <Text style={styles.amountSuffix}>{currencySymbol(currency)}</Text>
              </View>

              <Text style={styles.label}>{t("split.occasion_label")}</Text>
              <View style={styles.chips}>
                {OCCASIONS.map((item) => {
                  const active = occasion === item.key;
                  return (
                    <TouchableOpacity
                      key={item.key}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => {
                        selectionFeedback();
                        setOccasion(item.key);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {`${item.glyph} ${t(`split.occasion.${item.key}`)}`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.label}>{t("split.tip_label")}</Text>
              <View style={styles.chips}>
                {TIPS.map((value) => {
                  const active = tip === value;
                  return (
                    <TouchableOpacity
                      key={value}
                      style={[styles.chip, styles.tipChip, active && styles.chipActive]}
                      onPress={() => {
                        selectionFeedback();
                        setTip(value);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {ltr(`${value}%`)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.label}>{t("split.people_label")}</Text>
              <View style={styles.stepper}>
                <TouchableOpacity
                  style={[styles.stepButton, people <= MIN_PEOPLE && styles.stepDisabled]}
                  onPress={() => changePeople(-1)}
                  disabled={people <= MIN_PEOPLE}
                  accessibilityRole="button"
                  accessibilityLabel={t("split.people_less")}
                >
                  <Text style={styles.stepGlyph}>−</Text>
                </TouchableOpacity>
                <View style={styles.stepValueWrap}>
                  <Text style={styles.stepValue}>{people}</Text>
                  <Text style={styles.stepUnit}>{"👥"}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.stepButton, people >= MAX_PEOPLE && styles.stepDisabled]}
                  onPress={() => changePeople(1)}
                  disabled={people >= MAX_PEOPLE}
                  accessibilityRole="button"
                  accessibilityLabel={t("split.people_more")}
                >
                  <Text style={styles.stepGlyph}>+</Text>
                </TouchableOpacity>
              </View>

              {each > 0 ? (
                <Animated.View style={[styles.result, { transform: [{ scale: pop }] }]}>
                  <Text style={styles.resultKicker}>{t("split.each")}</Text>
                  <Text style={styles.resultAmount}>{formatCentimes(each, currency)}</Text>
                  <Text style={styles.resultMeta}>
                    {t("split.breakdown", {
                      total: formatCentimes(grand, currency),
                      tip: formatCentimes(tipAmount, currency),
                    })}
                  </Text>
                </Animated.View>
              ) : (
                <Text style={styles.empty}>{t("split.empty")}</Text>
              )}

              <TouchableOpacity
                style={[styles.whatsapp, each <= 0 && styles.whatsappDisabled]}
                onPress={share}
                disabled={each <= 0}
                activeOpacity={0.85}
                accessibilityRole="button"
              >
                <Text style={styles.whatsappText}>{t("split.send_whatsapp")}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
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
    subtitle: {
      fontSize: fontSizes.meta,
      color: colors.textMuted,
      textAlign: "auto",
      marginTop: 4,
    },
    amountRow: {
      flexDirection: fixedLtrRow(),
      alignItems: "center",
      justifyContent: "center",
      marginTop: spacing.xl,
    },
    amountInput: {
      fontSize: fontSizes.amount,
      fontWeight: "bold",
      minWidth: 90,
      textAlign: "center",
      color: colors.text,
      padding: 0,
    },
    amountSuffix: {
      fontSize: 20,
      fontWeight: "600",
      color: colors.textMuted,
      marginStart: 8,
    },
    label: {
      fontSize: fontSizes.meta,
      fontWeight: "700",
      color: colors.textSecondary,
      textAlign: "auto",
      marginTop: spacing.xl,
      marginBottom: spacing.sm,
    },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    chip: {
      borderRadius: radii.pill,
      borderWidth: 1.5,
      borderColor: colors.border,
      paddingVertical: 8,
      paddingHorizontal: 14,
    },
    tipChip: { flex: 1, alignItems: "center", paddingHorizontal: 0 },
    chipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    chipText: { fontSize: fontSizes.meta, fontWeight: "600", color: colors.textSecondary },
    chipTextActive: { color: colors.primary },
    stepper: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.surfaceSunken,
      borderRadius: radii.lg,
      padding: 6,
    },
    stepButton: {
      width: 44,
      height: 44,
      borderRadius: radii.md,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    stepDisabled: { opacity: 0.35 },
    stepGlyph: { fontSize: 24, fontWeight: "700", color: colors.primary, lineHeight: 28 },
    stepValueWrap: { flexDirection: "row", alignItems: "center", gap: 6 },
    stepValue: { fontSize: 24, fontWeight: "800", color: colors.text },
    stepUnit: { fontSize: 18 },
    result: {
      marginTop: spacing.xxl,
      borderRadius: radii.xxl,
      backgroundColor: colors.primarySoft,
      borderWidth: 1.5,
      borderColor: colors.primaryBorder,
      padding: spacing.xl,
      alignItems: "center",
    },
    resultKicker: { fontSize: fontSizes.meta, fontWeight: "700", color: colors.textSecondary },
    resultAmount: {
      fontSize: fontSizes.display,
      fontWeight: "800",
      color: colors.primary,
      marginTop: 4,
    },
    resultMeta: {
      fontSize: fontSizes.small,
      color: colors.textMuted,
      textAlign: "center",
      marginTop: 6,
    },
    empty: {
      fontSize: fontSizes.meta,
      color: colors.textFaint,
      textAlign: "center",
      marginTop: spacing.xxl,
    },
    whatsapp: {
      marginTop: spacing.xl,
      backgroundColor: WHATSAPP_GREEN,
      borderRadius: radii.lg,
      paddingVertical: 15,
      alignItems: "center",
    },
    whatsappDisabled: { opacity: 0.4 },
    whatsappText: { color: "#FFFFFF", fontSize: fontSizes.bodyLarge, fontWeight: "800" },
  });
