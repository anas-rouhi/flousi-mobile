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
  DEFAULT_LANGUAGE,
  LANGUAGES,
  applyDirection,
  isRtlLanguage,
  readLanguage,
  writeLanguage,
} from "../services/locale";
import { setI18nLanguage } from "../i18n/store";

const LocaleContext = createContext(null);

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used inside <LocaleProvider>");
  }
  return context;
}

/**
 * Owns the app's language and, through it, its layout direction.
 *
 * The persisted language is read and its direction applied in one bootstrap
 * before anything renders — `ready` stays false until then, so the navigation
 * tree never mounts against an unknown direction and there is nothing to race.
 *
 * Direction is applied as a `direction` style on the root view (see App.js),
 * which flips layout instantly — nothing here needs a restart any more. These
 * fields are kept for the language-picker contract; they always report "no
 * restart needed".
 */
export function LocaleProvider({ children }) {
  const [language, setLanguageState] = useState(DEFAULT_LANGUAGE);
  const [ready, setReady] = useState(false);
  const [needsRestart, setNeedsRestart] = useState(false);
  const mounted = useRef(true);

  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  useEffect(() => {
    (async () => {
      const saved = await readLanguage();
      // Applied before `ready` flips, so the first render already sits in the
      // right direction whenever the process can provide it.
      const matches = applyDirection(saved);
      setI18nLanguage(saved);

      if (!mounted.current) {
        return;
      }
      setLanguageState(saved);
      setNeedsRestart(!matches);
      setReady(true);
    })();
  }, []);

  /**
   * Persists a language and reports whether the app has to restart to render
   * it. The `direction` style flips layout instantly, so this always reports
   * "no restart needed".
   */
  const setLanguage = useCallback(
    async (next) => {
      if (!LANGUAGES.some((l) => l.value === next) || next === language) {
        return { changed: false, needsRestart: false };
      }

      await writeLanguage(next);
      const matches = applyDirection(next);
      // The store is switched before the state commit below, so the re-render
      // that commit triggers already resolves `t()` in the new language.
      setI18nLanguage(next);

      if (mounted.current) {
        setLanguageState(next);
        setNeedsRestart(!matches);
      }
      return { changed: true, needsRestart: !matches };
    },
    [language],
  );

  const value = useMemo(
    () => ({
      language,
      languages: LANGUAGES,
      isRTL: isRtlLanguage(language),
      wantsRTL: isRtlLanguage(language),
      ready,
      needsRestart,
      setLanguage,
    }),
    [language, ready, needsRestart, setLanguage],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}
