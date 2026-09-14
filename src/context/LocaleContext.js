import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DevSettings, I18nManager } from "react-native";
import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  applyDirection,
  isRtlLanguage,
  readLanguage,
  writeLanguage,
} from "../services/locale";

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
 * Direction cannot change mid-process (React Native latches it when the native
 * views are built), so `needsRestart` reports the mismatch and the UI asks for
 * an explicit restart rather than pretending to flip.
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
   * it. The caller does the asking — this never restarts on its own.
   */
  const setLanguage = useCallback(
    async (next) => {
      if (!LANGUAGES.some((l) => l.value === next) || next === language) {
        return { changed: false, needsRestart: false };
      }

      await writeLanguage(next);
      const matches = applyDirection(next);

      if (mounted.current) {
        setLanguageState(next);
        setNeedsRestart(!matches);
      }
      return { changed: true, needsRestart: !matches };
    },
    [language],
  );

  /**
   * Reloads the JS bundle so the new direction takes hold.
   *
   * `DevSettings.reload()` exists in development builds only. In a production
   * build this returns false and the caller tells the user to reopen the app —
   * a real auto-restart there needs expo-updates, which is not a dependency.
   */
  const restart = useCallback(() => {
    if (__DEV__ && typeof DevSettings?.reload === "function") {
      DevSettings.reload();
      return true;
    }
    return false;
  }, []);

  const value = useMemo(
    () => ({
      language,
      languages: LANGUAGES,
      isRTL: I18nManager.isRTL,
      /** The direction this language wants, even if the process disagrees. */
      wantsRTL: isRtlLanguage(language),
      ready,
      needsRestart,
      setLanguage,
      restart,
    }),
    [language, ready, needsRestart, setLanguage, restart],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}
