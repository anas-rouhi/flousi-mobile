import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  AppState,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "./AuthContext";
import { useTheme, useThemedStyles } from "./ThemeContext";
import { useI18n } from "../i18n";
import {
  authenticate,
  getBiometricCapability,
  isBiometricLockEnabled,
  isUnrecoverable,
  setBiometricLockEnabled,
} from "../services/biometrics";
import { errorFeedback, successFeedback } from "../utils/haptics";

const AppLockContext = createContext(null);

export function useAppLock() {
  const context = useContext(AppLockContext);
  if (!context) {
    throw new Error("useAppLock must be used inside <AppLockProvider>");
  }
  return context;
}

/** "Face ID", "fingerprint"… — the name of the sensor, for labels. */
function unlockLabelKey(kind) {
  if (kind === "face") {
    return "lock.unlock_face";
  }
  if (kind === "fingerprint") {
    return "lock.unlock_fingerprint";
  }
  return "lock.unlock_generic";
}

/**
 * The biometric gate.
 *
 * Lives inside AuthProvider and only ever guards a signed-in session. It locks:
 *  - on a cold start that restores a stored session, and
 *  - whenever the app goes to the background.
 * A fresh sign-in is not locked: the user has just proved who they are.
 *
 * While the app is merely inactive (app switcher, notification centre) the
 * dashboard is covered without being locked, so balances never show up in the
 * task-switcher snapshot, but pulling down Control Centre does not cost a scan.
 *
 * The lock is a Modal rather than an overlay view because an open Modal (the
 * add-transaction sheet, say) is presented above the regular view tree and
 * would otherwise stay visible over a plain overlay.
 */
export function AppLockProvider({ children }) {
  const { isAuthenticated, booting, signOut, forgetSession } = useAuth();
  const { t } = useI18n();

  const [enabled, setEnabled] = useState(null); // null until read from storage
  const [capability, setCapability] = useState({
    hardware: false,
    enrolled: false,
    kind: null,
  });
  // Locked from the start: a restored session must not flash the dashboard
  // before the preference has even been read.
  const [locked, setLocked] = useState(true);
  const [covered, setCovered] = useState(false);
  const [appActive, setAppActive] = useState(AppState.currentState === "active");
  const [authenticating, setAuthenticating] = useState(false);
  const [message, setMessage] = useState(null);

  // The system prompt itself makes iOS "inactive" and can background Android
  // (device-credential screen); neither must re-lock or re-cover the app.
  const authenticatingRef = useRef(false);
  const autoPrompted = useRef(false);
  const enabledRef = useRef(false);

  useEffect(() => {
    enabledRef.current = Boolean(enabled);
  }, [enabled]);

  useEffect(() => {
    let active = true;
    Promise.all([isBiometricLockEnabled(), getBiometricCapability()]).then(
      ([storedEnabled, deviceCapability]) => {
        if (active) {
          setCapability(deviceCapability);
          setEnabled(storedEnabled);
        }
      },
    );
    return () => {
      active = false;
    };
  }, []);

  // No session (never had one, or just signed out): nothing to guard, and the
  // next sign-in starts unlocked.
  useEffect(() => {
    if (!booting && !isAuthenticated) {
      setLocked(false);
      setMessage(null);
    }
  }, [booting, isAuthenticated]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      setAppActive(next === "active");
      if (authenticatingRef.current || !enabledRef.current) {
        return;
      }
      if (next === "background") {
        autoPrompted.current = false;
        setMessage(null);
        setLocked(true);
      }
      setCovered(next !== "active");
    });
    return () => subscription.remove();
  }, []);

  const unlock = useCallback(async () => {
    if (authenticatingRef.current) {
      return;
    }
    authenticatingRef.current = true;
    setAuthenticating(true);
    setMessage(null);
    const result = await authenticate({
      promptMessage: t("lock.prompt"),
      cancelLabel: t("common.cancel"),
      fallbackLabel: t("lock.use_passcode"),
    });
    authenticatingRef.current = false;
    setAuthenticating(false);

    if (result.success) {
      successFeedback();
      setCovered(false);
      setLocked(false);
      return;
    }
    if (isUnrecoverable(result.error)) {
      errorFeedback();
      setMessage(t("lock.unavailable"));
    } else if (result.error && !String(result.error).endsWith("cancel")) {
      setMessage(t("lock.failed"));
    }
  }, [t]);

  const showLock = Boolean(enabled) && isAuthenticated && locked;
  // Before the preference is read, a restored session is hidden, not locked.
  const pending = enabled === null && isAuthenticated;
  const showCover = pending || (Boolean(enabled) && isAuthenticated && covered);

  // Prompt once per lock episode, as soon as the app is in the foreground.
  useEffect(() => {
    if (showLock && appActive && !autoPrompted.current) {
      autoPrompted.current = true;
      unlock();
    }
  }, [showLock, appActive, unlock]);

  /** Password fallback: end the session and go back to the Login screen. */
  const signInWithPassword = useCallback(async () => {
    try {
      await signOut();
    } catch {
      // Offline: the token cannot be revoked, but it can still be dropped.
      await forgetSession();
    }
  }, [signOut, forgetSession]);

  /**
   * Turns the lock on or off. Both directions require a successful scan, so
   * nobody holding an unlocked phone can switch it off, and nobody can switch
   * it on without being able to get back in.
   *
   * @returns {Promise<{ ok: boolean, reason?: "unavailable"|"failed" }>}
   */
  const changeEnabled = useCallback(
    async (next) => {
      const deviceCapability = await getBiometricCapability();
      setCapability(deviceCapability);
      if (next && (!deviceCapability.hardware || !deviceCapability.enrolled)) {
        return { ok: false, reason: "unavailable" };
      }

      authenticatingRef.current = true;
      const result = await authenticate({
        promptMessage: next ? t("lock.prompt_enable") : t("lock.prompt_disable"),
        cancelLabel: t("common.cancel"),
        fallbackLabel: t("lock.use_passcode"),
      });
      authenticatingRef.current = false;

      if (!result.success) {
        return {
          ok: false,
          reason: isUnrecoverable(result.error) ? "unavailable" : "failed",
        };
      }
      await setBiometricLockEnabled(next);
      setLocked(false);
      setEnabled(next);
      successFeedback();
      return { ok: true };
    },
    [t],
  );

  const value = useMemo(
    () => ({
      enabled: Boolean(enabled),
      capability,
      setEnabled: changeEnabled,
    }),
    [enabled, capability, changeEnabled],
  );

  return (
    <AppLockContext.Provider value={value}>
      {children}
      <Modal
        visible={showLock || showCover}
        animationType="none"
        transparent={false}
        statusBarTranslucent
        // Android back must not dismiss the lock.
        onRequestClose={() => {}}
      >
        <LockScreen
          interactive={showLock}
          authenticating={authenticating}
          message={message}
          unlockLabel={t(unlockLabelKey(capability.kind))}
          onUnlock={unlock}
          onUsePassword={signInWithPassword}
        />
      </Modal>
    </AppLockContext.Provider>
  );
}

function LockScreen({
  interactive,
  authenticating,
  message,
  unlockLabel,
  onUnlock,
  onUsePassword,
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useI18n();

  return (
    <View style={styles.screen}>
      <Text style={styles.glyph}>🔒</Text>
      <Text style={styles.brand}>FLOUSI</Text>

      {interactive ? (
        <>
          <Text style={styles.subtitle}>{t("lock.title")}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}

          <TouchableOpacity
            style={[styles.button, authenticating && styles.buttonDisabled]}
            onPress={onUnlock}
            disabled={authenticating}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            {authenticating ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.buttonText}>{unlockLabel}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onUsePassword}
            disabled={authenticating}
            hitSlop={10}
            accessibilityRole="button"
          >
            <Text style={styles.link}>{t("lock.use_password")}</Text>
          </TouchableOpacity>
        </>
      ) : null}
    </View>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
      padding: 32,
    },
    glyph: { fontSize: 44, marginBottom: 12 },
    brand: {
      fontSize: 26,
      fontWeight: "bold",
      letterSpacing: 2,
      color: colors.primary,
    },
    subtitle: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: 10,
    },
    message: {
      fontSize: 13,
      color: colors.dangerText,
      backgroundColor: colors.dangerSurface,
      borderRadius: 10,
      padding: 12,
      textAlign: "center",
      marginTop: 20,
      alignSelf: "stretch",
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: "center",
      alignSelf: "stretch",
      marginTop: 32,
      minHeight: 52,
      justifyContent: "center",
    },
    buttonDisabled: { opacity: 0.7 },
    buttonText: { color: colors.onPrimary, fontSize: 16, fontWeight: "bold" },
    link: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: "600",
      marginTop: 20,
    },
  });
