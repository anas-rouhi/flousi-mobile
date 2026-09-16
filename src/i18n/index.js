import { useMemo } from "react";
import { useLocale } from "../context/LocaleContext";
import { languageConfig } from "./languages";
import { t } from "./store";

export { t, getLanguage, getLocale, setI18nLanguage } from "./store";
export {
  CURRENCIES,
  LANGUAGES,
  DEFAULT_LANGUAGE,
  isSupportedLanguage,
  languageConfig,
} from "./languages";

/**
 * Translation hook for components.
 *
 * The language comes from LocaleContext — the one source of truth — so calling
 * this subscribes the component to language changes: switching language
 * re-renders it, and `t()` (already pointed at the new dictionary by the
 * provider) resolves the new text.
 */
export function useI18n() {
  const { language, languages } = useLocale();
  return useMemo(
    () => ({ t, language, languages, current: languageConfig(language) }),
    [language, languages],
  );
}
