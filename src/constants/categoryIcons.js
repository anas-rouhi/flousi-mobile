/**
 * Category glyphs.
 *
 * The backend seeds Lucide icon names (`utensils`, `heart-pulse`, …), but no
 * Lucide font is installed and `@expo/vector-icons` is not a dependency, so
 * those names resolve to nothing. Rather than ship a blank square, each seeded
 * name maps to an emoji — real iconography with no new dependency and no font
 * loading on first paint.
 *
 * Keys match `CategorySeeder`. When a category arrives with an unknown icon the
 * fallback keeps the row readable instead of collapsing it.
 */
const GLYPHS = {
  // expense
  utensils: "🍽️",
  coffee: "☕",
  bus: "🚌",
  "shopping-bag": "🛍️",
  "file-text": "🧾",
  home: "🏠",
  "heart-pulse": "🩺",
  "graduation-cap": "🎓",
  wifi: "📶",
  users: "👨‍👩‍👧",
  "hand-heart": "🤲",
  ellipsis: "📦",

  // income
  wallet: "💰",
  briefcase: "💼",
  laptop: "💻",
  "trending-up": "📈",
  gift: "🎁",
  "plus-circle": "➕",

  // uncategorised fallback used by DashboardStatsService
  "help-circle": "❓",
};

const FALLBACK = "🏷️";

export function categoryGlyph(icon) {
  if (!icon) {
    return FALLBACK;
  }
  return GLYPHS[icon] || FALLBACK;
}

export default GLYPHS;
