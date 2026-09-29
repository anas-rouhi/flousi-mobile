import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

/**
 * Face ID / Touch ID / fingerprint lock.
 *
 * The preference lives in SecureStore next to the token: it guards the same
 * data, so it gets the same protection. It is per device, not per account.
 *
 * Face ID does not work inside Expo Go on iOS — it needs a development build.
 * Expo Go still offers the device passcode, so the flow can be exercised there.
 */
const LOCK_KEY = "biometric_lock_enabled";

export async function isBiometricLockEnabled() {
  try {
    return (await SecureStore.getItemAsync(LOCK_KEY)) === "1";
  } catch {
    return false;
  }
}

export async function setBiometricLockEnabled(enabled) {
  if (enabled) {
    await SecureStore.setItemAsync(LOCK_KEY, "1");
  } else {
    await SecureStore.deleteItemAsync(LOCK_KEY);
  }
}

/**
 * What this device can do.
 *
 * `kind` names the sensor so the UI can say "Face ID" rather than a generic
 * "biometrics": "face" | "fingerprint" | "iris" | null.
 */
export async function getBiometricCapability() {
  try {
    const [hardware, enrolled, types] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
    const { AuthenticationType } = LocalAuthentication;
    const kind = types.includes(AuthenticationType.FACIAL_RECOGNITION)
      ? "face"
      : types.includes(AuthenticationType.FINGERPRINT)
        ? "fingerprint"
        : types.includes(AuthenticationType.IRIS)
          ? "iris"
          : null;
    return { hardware, enrolled, kind };
  } catch {
    return { hardware: false, enrolled: false, kind: null };
  }
}

/**
 * Prompts once. The device passcode stays available as the system fallback
 * (disableDeviceFallback: false), so a failed face or finger is not a dead end.
 *
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function authenticate({ promptMessage, cancelLabel, fallbackLabel }) {
  try {
    return await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel,
      fallbackLabel,
      disableDeviceFallback: false,
    });
  } catch (error) {
    return { success: false, error: error?.message || "unknown" };
  }
}

/** Errors that mean "nothing on this device can unlock", not "try again". */
export function isUnrecoverable(error) {
  return (
    error === "not_enrolled" ||
    error === "not_available" ||
    error === "passcode_not_set"
  );
}
