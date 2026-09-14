/**
 * The single source of design values for the app.
 *
 * Colours come in two palettes with identical keys, so a component reads
 * `colors.surface` and gets the right value for the active theme. Everything
 * else (spacing, radii, type scale) is theme-independent and stays flat.
 *
 * Components must not import `lightColors`/`darkColors` directly — they use
 * `useTheme()` / `useThemedStyles()` from context/ThemeContext, which re-render
 * when the theme changes.
 */

const BRAND_EMERALD = "#0A5C36";
/** Lightened so the brand still reads as the brand on a dark ground. */
const BRAND_EMERALD_LIGHT = "#34A97B";
const MINT = "#10B981";

export const lightColors = {
  // ---- brand ----
  primary: BRAND_EMERALD,
  primaryPressed: "#074227",
  primarySoft: "#F4F8F6",
  primaryBorder: "#CFE3D8",
  mint: MINT,

  // ---- semantic: money direction ----
  income: MINT,
  expense: "#EF4444",
  transfer: "#3B82F6",

  // ---- semantic: feedback ----
  danger: "#EF4444",
  dangerText: "#C0392B",
  dangerSurface: "#FDECEA",
  dangerBorder: "#F5C6C1",
  success: MINT,
  warning: "#F59E0B",

  // ---- navigation ----
  tabActive: BRAND_EMERALD,
  tabInactive: "#94A3B8",
  tabBar: "#FFFFFF",

  // ---- budget health ----
  budgetHealthy: MINT,
  budgetWarning: "#F59E0B",
  budgetOver: "#EF4444",
  budgetWarningSurface: "#FEF6E7",
  budgetOverSurface: "#FDECEA",

  // ---- surfaces ----
  background: "#F8F9FA",
  surface: "#FFFFFF",
  surfaceMuted: "#F8F9FA",
  surfaceSunken: "#F1F4F5",
  border: "#E4E9EC",
  divider: "#ECF0F1",
  track: "#ECF0F1",
  grabber: "#DDE4E6",
  scrim: "rgba(0,0,0,0.45)",

  // ---- text ----
  text: "#2C3E50",
  textSecondary: "#7F8C8D",
  textMuted: "#95A5A6",
  textFaint: "#B2BEC3",
  textPlaceholder: "#B2BEC3",
  onPrimary: "#FFFFFF",
  onPrimaryMuted: "#C8E6C9",
  onPrimaryFaint: "#A5D6A7",
  onPrimaryDivider: "#4C8C6B",

  // ---- inverted surface (toasts) ----
  inverse: "#2C3E50",
  onInverse: "#FFFFFF",

  isDark: false,
};

/**
 * Dark palette.
 *
 * Not a naive inversion: surfaces step *up* in lightness to signal elevation,
 * the semantic hues are lightened so they stay legible without glowing, and the
 * emerald brand is replaced by a lighter tint that survives a dark ground. The
 * `onPrimary*` keys are unchanged because the balance hero keeps the deep
 * emerald in both themes.
 */
export const darkColors = {
  primary: BRAND_EMERALD_LIGHT,
  primaryPressed: "#2A8C64",
  primarySoft: "#16251E",
  primaryBorder: "#2C4A3B",
  mint: "#34D399",

  income: "#34D399",
  expense: "#F87171",
  transfer: "#60A5FA",

  danger: "#F87171",
  dangerText: "#FCA5A5",
  dangerSurface: "#2A1615",
  dangerBorder: "#4C2422",
  success: "#34D399",
  warning: "#FBBF24",

  tabActive: BRAND_EMERALD_LIGHT,
  tabInactive: "#64748B",
  tabBar: "#131C18",

  budgetHealthy: "#34D399",
  budgetWarning: "#FBBF24",
  budgetOver: "#F87171",
  budgetWarningSurface: "#2A2213",
  budgetOverSurface: "#2A1615",

  background: "#0D1411",
  surface: "#151F1A",
  surfaceMuted: "#1A2620",
  surfaceSunken: "#1E2B24",
  border: "#26342C",
  divider: "#223029",
  track: "#223029",
  grabber: "#33453B",
  scrim: "rgba(0,0,0,0.6)",

  text: "#E6EEE8",
  textSecondary: "#A9BCB1",
  textMuted: "#8A9D92",
  textFaint: "#6B7F75",
  textPlaceholder: "#6B7F75",

  /**
   * Dark mode inverts what sits on the brand. `primary` is lightened here so it
   * reads as text on a dark ground, which makes it too light to carry white
   * text as a fill — white on it is only 2.95:1. So anything painted on the
   * brand uses dark ink instead.
   */
  onPrimary: "#06231A",
  onPrimaryMuted: "#0E3D2C",
  onPrimaryFaint: "#17503B",
  onPrimaryDivider: "#6FC4A0",

  inverse: "#E6EEE8",
  onInverse: "#0D1411",

  isDark: true,
};

export const palettes = { light: lightColors, dark: darkColors };

/**
 * The light palette, for the few places that read a colour outside a React
 * component. Components must use `useTheme()` instead.
 */
export const colors = lightColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const radii = {
  sm: 8,
  md: 11,
  lg: 14,
  xl: 16,
  xxl: 20,
  sheet: 24,
  pill: 999,
};

export const fontSizes = {
  caption: 11,
  small: 12,
  meta: 13,
  body: 14,
  bodyLarge: 15,
  subtitle: 17,
  title: 19,
  heading: 21,
  display: 34,
  amount: 44,
};

export const shadows = {
  /** Subtle lift for content cards. */
  card: {
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  /** Stronger lift for the balance hero. */
  raised: {
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  /** Floating action button. */
  floating: {
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
};

/** Colour for a transaction/flow direction, in the supplied palette. */
export function directionColor(type, palette = lightColors) {
  return type === "income" ? palette.income : palette.expense;
}

const theme = { colors: lightColors, spacing, radii, fontSizes, shadows };
export default theme;
