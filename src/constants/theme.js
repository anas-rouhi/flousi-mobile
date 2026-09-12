/**
 * The single source of design values for the app.
 *
 * Most tokens carry the hex values the screens were already using, so adopting
 * them is a rename rather than a redesign. Two colours changed on purpose:
 * expense moved to #EF4444 and income to #10B981.
 *
 * Import the pieces you need (`colors`, `spacing`, …) rather than the default
 * bundle — it keeps call sites short and makes unused tokens obvious.
 */

export const colors = {
  // ---- brand ----
  primary: "#0A5C36", // Primary Emerald
  primaryPressed: "#074227",
  primarySoft: "#F4F8F6", // tinted surface for selected states
  primaryBorder: "#CFE3D8",
  mint: "#10B981", // Mint accent

  // ---- semantic: money direction ----
  income: "#10B981",
  expense: "#EF4444",

  // ---- semantic: budget health ----
  budgetHealthy: "#10B981", // under 80% of the limit
  budgetWarning: "#F59E0B", // 80-99%
  budgetOver: "#EF4444", // 100% or more
  budgetWarningSurface: "#FEF6E7",
  budgetOverSurface: "#FDECEA",

  // ---- semantic: feedback ----
  danger: "#EF4444",
  dangerText: "#C0392B",
  dangerSurface: "#FDECEA",
  dangerBorder: "#F5C6C1",

  // ---- surfaces ----
  background: "#F8F9FA",
  surface: "#FFFFFF",
  surfaceMuted: "#F8F9FA",
  surfaceSunken: "#F1F4F5",
  border: "#E4E9EC",
  divider: "#ECF0F1",
  track: "#ECF0F1", // unfilled portion of a progress bar
  grabber: "#DDE4E6",
  scrim: "rgba(0,0,0,0.45)",

  // ---- text ----
  text: "#2C3E50",
  textSecondary: "#7F8C8D",
  textMuted: "#95A5A6",
  textFaint: "#B2BEC3",
  textPlaceholder: "#B2BEC3",
  onPrimary: "#FFFFFF",
  onPrimaryMuted: "#C8E6C9", // legible on the emerald balance card
  onPrimaryFaint: "#A5D6A7",
  onPrimaryDivider: "#4C8C6B",

  // ---- toast / inverted surface ----
  inverse: "#2C3E50",
  onInverse: "#FFFFFF",

  /**
   * Reserved for a future dark theme. Nothing reads these yet — app.json pins
   * `userInterfaceStyle: "light"` — so treat them as a declaration of intent,
   * not as working dark mode.
   */
  dark: {
    background: "#0D1411",
    surface: "#151F1A",
    border: "#26342C",
    text: "#E6EEE8",
    textSecondary: "#B6C6BC",
  },
};

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

/** Colour for a transaction/flow direction. */
export function directionColor(type) {
  return type === "income" ? colors.income : colors.expense;
}

const theme = { colors, spacing, radii, fontSizes, shadows };
export default theme;
