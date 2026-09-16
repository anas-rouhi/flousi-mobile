import { I18nManager } from "react-native";
import * as SecureStore from "expo-secure-store";
import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  isSupportedLanguage,
} from "../i18n/languages";
import { setRTL } from "../utils/rtl";

const LANGUAGE_KEY = "app_language";

// The language list lives with the translations; re-exported so existing
// imports of the locale service keep working.
export { DEFAULT_LANGUAGE, LANGUAGES };

export function isRtlLanguage(language) {
  return LANGUAGES.find((l) => l.value === language)?.rtl ?? false;
}

export async function readLanguage() {
  try {
    const saved = await SecureStore.getItemAsync(LANGUAGE_KEY);
    return isSupportedLanguage(saved) ? saved : DEFAULT_LANGUAGE;
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
 * The app's own layout direction lives in a `direction` style on the root view
 * (see App.js), which cascade through Yoga and flips `flexDirection: "row"`,
 * `textAlign: "auto"` and `*Start`/`*End` — no native process latch involved.
 * That is deliberate: on the new architecture `I18nManager.forceRTL` from JS
 * has no effect in Expo Go, so a restart-based flip can never actually flip.
 * What stays here is the native RTL switch, which real text (bidi/glyph) needs
 * for correct shaping. The utils flag keeps components like arrows honest.
 *
 * Returns true because direction is always applied — there is nothing to wait
 * on and no restart to demand.
 */
export function applyDirection(language) {
  const wantsRTL = isRtlLanguage(language);

  I18nManager.allowRTL(true);
  I18nManager.forceRTL(wantsRTL);
  setRTL(wantsRTL);

  return true;
}
