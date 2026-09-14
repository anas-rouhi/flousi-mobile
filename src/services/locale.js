import { I18nManager } from "react-native";
import * as SecureStore from "expo-secure-store";

const LANGUAGE_KEY = "app_language";

/** Languages the API accepts, with the direction each one needs. */
export const LANGUAGES = [
  { value: "ar", label: "العربية", rtl: true },
  { value: "fr", label: "Français", rtl: false },
  { value: "en", label: "English", rtl: false },
];

export const DEFAULT_LANGUAGE = "ar";

export function isRtlLanguage(language) {
  return LANGUAGES.find((l) => l.value === language)?.rtl ?? false;
}

export async function readLanguage() {
  try {
    const saved = await SecureStore.getItemAsync(LANGUAGE_KEY);
    return LANGUAGES.some((l) => l.value === saved) ? saved : DEFAULT_LANGUAGE;
  } catch (error) {
    console.log("Language read failed:", error.message);
    return DEFAULT_LANGUAGE;
  }
}

export async function writeLanguage(language) {
  try {
    await SecureStore.setItemAsync(LANGUAGE_KEY, language);
  } catch (error) {
    console.log("Language write failed:", error.message);
  }
}

/**
 * Applies the direction a language needs.
 *
 * React Native reads the layout direction once, when the native views are
 * created — `forceRTL` therefore takes effect on the *next* start, never the
 * current one. So this reports whether the running process already matches:
 * a `false` means the tree would render the wrong way round and the app has to
 * be restarted before it looks right.
 *
 * @returns {boolean} true when the live direction already matches the language
 */
export function applyDirection(language) {
  const wantsRTL = isRtlLanguage(language);

  I18nManager.allowRTL(wantsRTL);
  I18nManager.forceRTL(wantsRTL);

  return I18nManager.isRTL === wantsRTL;
}
