import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Modal from "../../platform/Modal";
import * as ImagePicker from "expo-image-picker";
import { fontSizes, radii, spacing } from "../../constants/theme";
import { useLocale } from "../../context/LocaleContext";
import { useTheme, useThemedStyles } from "../../context/ThemeContext";
import { useI18n } from "../../i18n";
import { isAiEndpointMissing } from "../../services/ai";
import { scanReceipt } from "../../services/tools";
import { isolate } from "../../utils/bidi";
import { errorFeedback, successFeedback, tapFeedback } from "../../utils/haptics";
import { amountToCentimes, formatCentimes } from "../../utils/money";

const PREVIEW_HEIGHT = 300;
/** Long enough for the laser to be seen, even when the server is instant. */
const MIN_SCAN_MS = 1400;
/** How long the read result stays up before the form takes over. */
const HANDOFF_MS = 1100;

const PICKER_OPTIONS = { mediaTypes: ["images"], quality: 0.6 };

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Photo of a receipt → an expense draft.
 *
 * stage: "choose" | "scanning" | "done" | "unclear" | "unavailable" | "error" | "denied"
 *
 * `onScanned(draft)` receives { type, amount, description, categoryId, date };
 * the parent closes this sheet and opens the transaction form with it. The
 * manual way out hands over an empty draft, so the user never hits a dead end.
 */
export default function ReceiptScannerModal({ visible, onClose, onScanned, currency = "MAD" }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useI18n();
  const { wantsRTL } = useLocale();
  const [stage, setStage] = useState("choose");
  const [image, setImage] = useState(null);
  const [result, setResult] = useState(null);

  const laser = useRef(new Animated.Value(0)).current;
  const laserLoop = useRef(null);
  const request = useRef(null);
  const handoffTimer = useRef(null);

  const stopWork = useCallback(() => {
    request.current?.abort();
    request.current = null;
    clearTimeout(handoffTimer.current);
    laserLoop.current?.stop();
  }, []);

  useEffect(() => {
    if (visible) {
      setStage("choose");
      setImage(null);
      setResult(null);
    } else {
      stopWork();
    }
  }, [visible, stopWork]);
  useEffect(() => stopWork, [stopWork]);

  const startLaser = useCallback(() => {
    laser.setValue(0);
    laserLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(laser, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(laser, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    laserLoop.current.start();
  }, [laser]);

  const handOff = useCallback(
    (draft) => {
      onScanned?.({ type: "expense", amount: null, description: null, categoryId: null, date: null, ...draft });
    },
    [onScanned],
  );

  const scan = useCallback(
    async (asset) => {
      stopWork();
      setImage(asset);
      setResult(null);
      setStage("scanning");
      startLaser();

      const controller = new AbortController();
      request.current = controller;
      try {
        const [parsed] = await Promise.all([
          scanReceipt(asset, { signal: controller.signal }),
          wait(MIN_SCAN_MS),
        ]);
        if (controller.signal.aborted) {
          return;
        }
        laserLoop.current?.stop();
        setResult(parsed);
        if (!parsed.amount) {
          errorFeedback();
          setStage("unclear");
          return;
        }
        successFeedback();
        setStage("done");
        handoffTimer.current = setTimeout(
          () =>
            handOff({
              amount: parsed.amount,
              description: parsed.merchant,
              categoryId: parsed.categoryId,
              date: parsed.date,
            }),
          HANDOFF_MS,
        );
      } catch (err) {
        if (controller.signal.aborted || err?.code === "ERR_CANCELED") {
          return;
        }
        laserLoop.current?.stop();
        console.log("Receipt scan failed:", err.response?.data || err.message);
        errorFeedback();
        setStage(isAiEndpointMissing(err) ? "unavailable" : "error");
      }
    },
    [stopWork, startLaser, handOff],
  );

  const pick = useCallback(
    async (source) => {
      tapFeedback();
      try {
        // In a browser both pickers are a file input (the camera one hints
        // `capture` to phones), so there is no native permission to ask for.
        if (source === "camera" && Platform.OS !== "web") {
          const permission = await ImagePicker.requestCameraPermissionsAsync();
          if (!permission.granted) {
            setStage("denied");
            return;
          }
        }
        const picked =
          source === "camera"
            ? await ImagePicker.launchCameraAsync(PICKER_OPTIONS)
            : await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);
        const asset = picked.canceled ? null : picked.assets?.[0];
        if (asset?.uri) {
          scan(asset);
        }
      } catch (err) {
        console.log("Receipt pick failed:", err?.message);
        setStage("error");
      }
    },
    [scan],
  );

  const laserY = laser.interpolate({ inputRange: [0, 1], outputRange: [0, PREVIEW_HEIGHT - 3] });
  const scanning = stage === "scanning";

  const renderPreview = () => (
    <View style={styles.preview}>
      {image ? <Image source={{ uri: image.uri }} style={styles.image} resizeMode="cover" /> : null}
      <View style={[styles.shade, !scanning && styles.shadeLight]} />
      {/* Viewfinder corners */}
      <View style={[styles.corner, styles.cornerTL]} />
      <View style={[styles.corner, styles.cornerTR]} />
      <View style={[styles.corner, styles.cornerBL]} />
      <View style={[styles.corner, styles.cornerBR]} />
      {scanning ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.laserTrack, { transform: [{ translateY: laserY }] }]}
        >
          <View style={[styles.laser, { boxShadow: `0 0 18px 5px ${colors.mint}` }]} />
        </Animated.View>
      ) : null}
      {scanning ? (
        <View style={styles.scanLabelWrap}>
          <Text style={styles.scanLabel}>{t("scanner.scanning")}</Text>
        </View>
      ) : null}
    </View>
  );

  const renderBody = () => {
    switch (stage) {
      case "choose":
        return (
          <>
            <View style={styles.hero}>
              <Text style={styles.heroGlyph}>🧾</Text>
              <Text style={styles.heroText}>{t("scanner.hint")}</Text>
            </View>
            <TouchableOpacity style={styles.primary} onPress={() => pick("camera")} activeOpacity={0.85}>
              <Text style={styles.primaryText}>{t("scanner.camera")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondary} onPress={() => pick("library")} activeOpacity={0.85}>
              <Text style={styles.secondaryText}>{t("scanner.library")}</Text>
            </TouchableOpacity>
          </>
        );

      case "scanning":
        return renderPreview();

      case "done":
        return (
          <>
            {renderPreview()}
            <View style={styles.resultCard}>
              <Text style={styles.resultCheck}>✅</Text>
              {result?.merchant ? <Text style={styles.resultMerchant}>{isolate(result.merchant)}</Text> : null}
              <Text style={styles.resultAmount}>
                {formatCentimes(amountToCentimes(result?.amount), currency)}
              </Text>
              <Text style={styles.resultHint}>{t("scanner.opening_form")}</Text>
            </View>
          </>
        );

      case "denied":
        return (
          <Notice
            glyph="📷"
            title={t("scanner.denied_title")}
            body={t("scanner.denied_body")}
            primary={{ label: t("scanner.open_settings"), onPress: () => Linking.openSettings() }}
            secondary={{ label: t("scanner.library"), onPress: () => pick("library") }}
            styles={styles}
          />
        );

      default: {
        // unclear / unavailable / error: always offer the manual form.
        const manual = {
          label: t("scanner.manual"),
          onPress: () => handOff({ description: result?.merchant ?? null }),
        };
        const retry =
          stage === "error" && image
            ? { label: t("common.retry"), onPress: () => scan(image) }
            : { label: t("scanner.another"), onPress: () => setStage("choose") };
        return (
          <>
            {image ? renderPreview() : null}
            <Notice
              glyph={stage === "unavailable" ? "🛠️" : "🤔"}
              title={t(`scanner.${stage}_title`)}
              body={t(`scanner.${stage}_body`)}
              primary={manual}
              secondary={retry}
              styles={styles}
            />
          </>
        );
      }
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.backdrop, { direction: wantsRTL ? "rtl" : "ltr" }]}>
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Text style={styles.title}>{t("scanner.title")}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Text style={styles.close}>{t("common.cancel")}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.subtitle}>{t("scanner.subtitle")}</Text>
          <View style={styles.body}>{renderBody()}</View>
        </View>
      </View>
    </Modal>
  );
}

function Notice({ glyph, title, body, primary, secondary, styles }) {
  return (
    <View style={styles.notice}>
      <Text style={styles.noticeGlyph}>{glyph}</Text>
      <Text style={styles.noticeTitle}>{title}</Text>
      <Text style={styles.noticeBody}>{body}</Text>
      <TouchableOpacity style={styles.primary} onPress={primary.onPress} activeOpacity={0.85}>
        <Text style={styles.primaryText}>{primary.label}</Text>
      </TouchableOpacity>
      {secondary ? (
        <TouchableOpacity style={styles.secondary} onPress={secondary.onPress} activeOpacity={0.85}>
          <Text style={styles.secondaryText}>{secondary.label}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const CORNER = 26;

const createStyles = (colors) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: colors.scrim, justifyContent: "flex-end" },
    sheet: {
      maxHeight: "94%",
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
    body: { marginTop: spacing.lg },

    hero: {
      height: 190,
      borderRadius: radii.xxl,
      borderWidth: 2,
      borderStyle: "dashed",
      borderColor: colors.primaryBorder,
      backgroundColor: colors.primarySoft,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.xl,
      marginBottom: spacing.lg,
    },
    heroGlyph: { fontSize: 54 },
    heroText: {
      fontSize: fontSizes.meta,
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: spacing.md,
      lineHeight: 19,
    },

    preview: {
      height: PREVIEW_HEIGHT,
      borderRadius: radii.xxl,
      overflow: "hidden",
      backgroundColor: "#0B1410",
    },
    image: { ...StyleSheet.absoluteFillObject },
    shade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(4,20,12,0.45)" },
    shadeLight: { backgroundColor: "rgba(4,20,12,0.15)" },
    corner: { position: "absolute", width: CORNER, height: CORNER, borderColor: colors.mint },
    cornerTL: { top: 14, left: 14, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 },
    cornerTR: { top: 14, right: 14, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 },
    cornerBL: { bottom: 14, left: 14, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8 },
    cornerBR: {
      bottom: 14,
      right: 14,
      borderBottomWidth: 3,
      borderRightWidth: 3,
      borderBottomRightRadius: 8,
    },
    laserTrack: { position: "absolute", top: 0, left: 10, right: 10 },
    laser: { height: 3, borderRadius: 2, backgroundColor: colors.mint },
    scanLabelWrap: {
      position: "absolute",
      bottom: 22,
      alignSelf: "center",
      backgroundColor: "rgba(0,0,0,0.55)",
      borderRadius: radii.pill,
      paddingVertical: 6,
      paddingHorizontal: 14,
    },
    scanLabel: { color: "#FFFFFF", fontSize: fontSizes.meta, fontWeight: "700" },

    resultCard: {
      marginTop: spacing.lg,
      borderRadius: radii.xxl,
      backgroundColor: colors.primarySoft,
      borderWidth: 1.5,
      borderColor: colors.primaryBorder,
      padding: spacing.lg,
      alignItems: "center",
    },
    resultCheck: { fontSize: 26 },
    resultMerchant: {
      fontSize: fontSizes.bodyLarge,
      fontWeight: "700",
      color: colors.text,
      marginTop: 6,
    },
    resultAmount: { fontSize: 30, fontWeight: "800", color: colors.expense, marginTop: 4 },
    resultHint: { fontSize: fontSizes.small, color: colors.textMuted, marginTop: 6 },

    notice: { alignItems: "stretch", marginTop: spacing.lg },
    noticeGlyph: { fontSize: 34, textAlign: "center" },
    noticeTitle: {
      fontSize: fontSizes.subtitle,
      fontWeight: "800",
      color: colors.text,
      textAlign: "center",
      marginTop: spacing.sm,
    },
    noticeBody: {
      fontSize: fontSizes.meta,
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: 6,
      marginBottom: spacing.lg,
      lineHeight: 19,
    },

    primary: {
      backgroundColor: colors.primary,
      borderRadius: radii.lg,
      paddingVertical: 15,
      alignItems: "center",
    },
    primaryText: { color: colors.onPrimary, fontSize: fontSizes.bodyLarge, fontWeight: "800" },
    secondary: {
      marginTop: spacing.sm,
      borderRadius: radii.lg,
      borderWidth: 1.5,
      borderColor: colors.primaryBorder,
      paddingVertical: 14,
      alignItems: "center",
    },
    secondaryText: { color: colors.primary, fontSize: fontSizes.bodyLarge, fontWeight: "700" },
  });
