import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Appearance } from "react-native";
import * as SecureStore from "expo-secure-store";
import { palettes } from "../constants/theme";

const THEME_KEY = "theme_mode";

/** 'system' follows the OS; the other two pin the app regardless of it. */
export const THEME_MODES = ["system", "light", "dark"];

const ThemeContext = createContext(null);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside <ThemeProvider>");
  }
  return context;
}

/**
 * Builds a StyleSheet from the active palette, memoised per (factory, palette)
 * so a re-render does not rebuild sheets and a theme switch rebuilds each one
 * exactly once.
 *
 * Every component that styles itself calls this — including small helper
 * components in the same file, which is cheaper than threading `styles` down
 * as a prop.
 *
 *   const createStyles = (colors) => StyleSheet.create({ … });
 *   const styles = useThemedStyles(createStyles);
 */
const sheetCache = new WeakMap();

export function useThemedStyles(factory) {
  const { colors } = useTheme();

  return useMemo(() => {
    let byPalette = sheetCache.get(factory);
    if (!byPalette) {
      byPalette = new WeakMap();
      sheetCache.set(factory, byPalette);
    }
    const cached = byPalette.get(colors);
    if (cached) {
      return cached;
    }
    const sheet = factory(colors);
    byPalette.set(colors, sheet);
    return sheet;
  }, [factory, colors]);
}

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState("system");
  const [systemScheme, setSystemScheme] = useState(
    () => Appearance.getColorScheme() ?? "light",
  );
  const [ready, setReady] = useState(false);
  const mounted = useRef(true);

  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  // Restore the saved choice before the first paint settles.
  useEffect(() => {
    (async () => {
      try {
        const saved = await SecureStore.getItemAsync(THEME_KEY);
        if (mounted.current && THEME_MODES.includes(saved)) {
          setModeState(saved);
        }
      } catch (error) {
        console.log("Theme mode read failed:", error.message);
      } finally {
        if (mounted.current) {
          setReady(true);
        }
      }
    })();
  }, []);

  // Track the OS setting even while pinned, so switching back to 'system'
  // lands on the right palette immediately.
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme ?? "light");
    });
    return () => subscription.remove();
  }, []);

  const setMode = useCallback(async (next) => {
    if (!THEME_MODES.includes(next)) {
      return;
    }
    // State first: the switch is instant and does not wait on storage.
    setModeState(next);
    try {
      await SecureStore.setItemAsync(THEME_KEY, next);
    } catch (error) {
      console.log("Theme mode write failed:", error.message);
    }
  }, []);

  const scheme = mode === "system" ? systemScheme : mode;

  const value = useMemo(
    () => ({
      mode,
      scheme,
      isDark: scheme === "dark",
      colors: palettes[scheme] ?? palettes.light,
      systemScheme,
      ready,
      setMode,
    }),
    [mode, scheme, systemScheme, ready, setMode],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
