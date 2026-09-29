import { categoryGlyph } from "../constants/categoryIcons";
import { categoryName } from "./categories";
import { formatCentimes } from "./money";
import { stripLtr } from "./bidi";

/**
 * The monthly report as a self-contained HTML page for expo-print.
 *
 * Everything is inline — styles, and charts as SVG — because the print
 * WebView has no network guarantee and no access to the app bundle. Colours
 * are fixed to the light brand palette: paper is white whatever the app theme.
 *
 * Amounts come from the API's `*_formatted` strings and are wrapped in
 * <bdi dir="ltr"> so "5 500,00 DH" keeps its order inside an Arabic page.
 */

const BRAND = "#0A5C36";
const MINT = "#10B981";
const RED = "#EF4444";
const INK = "#2C3E50";
const MUTED = "#7F8C8D";
const LINE = "#E4E9EC";
const FALLBACK_COLORS = ["#0A5C36", "#10B981", "#F59E0B", "#3B82F6", "#8B5CF6", "#EC4899", "#14B8A6", "#EF4444"];

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** A money string, isolated left-to-right. */
function money(formatted, centimes, currency) {
  const text = formatted || stripLtr(formatCentimes(centimes ?? 0, currency));
  return `<bdi dir="ltr">${escapeHtml(text)}</bdi>`;
}

function safeColor(color, index) {
  return /^#[0-9a-f]{3,8}$/i.test(String(color ?? "")) ? color : FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

/**
 * Daily income/expense bars as SVG. Scaled to the busiest day of either kind;
 * the x axis labels every fifth day so the month reads at a glance.
 */
function dailyChart(days) {
  const width = 680;
  const height = 170;
  const bottom = 22;
  const plot = height - bottom;
  const peak = days.reduce((max, day) => Math.max(max, day.expense || 0, day.income || 0), 0);
  if (!days.length || peak <= 0) {
    return "";
  }
  const slot = width / days.length;
  const bar = Math.max(Math.min(slot * 0.36, 9), 1.5);

  const bars = days
    .map((day, index) => {
      const x = index * slot + slot / 2;
      const expense = ((day.expense || 0) / peak) * (plot - 6);
      const income = ((day.income || 0) / peak) * (plot - 6);
      const parts = [];
      if (income > 0) {
        parts.push(
          `<rect x="${(x - bar - 0.5).toFixed(1)}" y="${(plot - income).toFixed(1)}" width="${bar.toFixed(1)}" height="${income.toFixed(1)}" rx="1.5" fill="${MINT}"/>`,
        );
      }
      if (expense > 0) {
        parts.push(
          `<rect x="${(x + 0.5).toFixed(1)}" y="${(plot - expense).toFixed(1)}" width="${bar.toFixed(1)}" height="${expense.toFixed(1)}" rx="1.5" fill="${RED}"/>`,
        );
      }
      const label =
        day.day === 1 || day.day % 5 === 0
          ? `<text x="${x.toFixed(1)}" y="${height - 6}" font-size="10" fill="${MUTED}" text-anchor="middle">${day.day}</text>`
          : "";
      return parts.join("") + label;
    })
    .join("");

  const grid = [0.25, 0.5, 0.75, 1]
    .map((ratio) => {
      const y = (plot - (plot - 6) * ratio).toFixed(1);
      return `<line x1="0" x2="${width}" y1="${y}" y2="${y}" stroke="${LINE}" stroke-width="1" stroke-dasharray="3 4"/>`;
    })
    .join("");

  // Always drawn left to right: day 1 on the left, like any calendar axis.
  return `<svg dir="ltr" viewBox="0 0 ${width} ${height}" width="100%" height="${height}" xmlns="http://www.w3.org/2000/svg">
    ${grid}
    <line x1="0" x2="${width}" y1="${plot}" y2="${plot}" stroke="${LINE}" stroke-width="1.5"/>
    ${bars}
  </svg>`;
}

/** Income vs expense as two proportional bars. */
function flowBars(summary, currency, t) {
  const income = summary?.total_income || 0;
  const expense = summary?.total_expense || 0;
  const peak = Math.max(income, expense, 1);
  const row = (label, value, formatted, color) => `
    <div class="flow-row">
      <div class="flow-label">${escapeHtml(label)}</div>
      <div class="flow-track"><div class="flow-fill" style="width:${Math.max((value / peak) * 100, value > 0 ? 2 : 0).toFixed(1)}%;background:${color}"></div></div>
      <div class="flow-value">${money(formatted, value, currency)}</div>
    </div>`;
  return (
    row(t("pdf.income"), income, summary?.total_income_formatted, MINT) +
    row(t("pdf.expenses"), expense, summary?.total_expense_formatted, RED)
  );
}

function categoryRows(categories, currency, t) {
  if (!categories.length) {
    return `<tr><td colspan="5" class="empty">${escapeHtml(t("pdf.no_expenses"))}</td></tr>`;
  }
  return categories
    .map((category, index) => {
      const color = safeColor(category.color, index);
      const share = Number(category.percentage) || 0;
      return `<tr>
        <td class="rank">${index + 1}</td>
        <td><span class="swatch" style="background:${color}"></span>${escapeHtml(categoryGlyph(category.icon) ?? "")} ${escapeHtml(categoryName(category) ?? "—")}</td>
        <td class="num">${Number(category.transactions_count) || 0}</td>
        <td class="num strong">${money(category.spent_formatted, category.spent, currency)}</td>
        <td class="share">
          <div class="share-track"><div class="share-fill" style="width:${Math.min(share, 100)}%;background:${color}"></div></div>
          <bdi dir="ltr">${share.toFixed(share % 1 ? 1 : 0)}%</bdi>
        </td>
      </tr>`;
    })
    .join("");
}

/**
 * @param {object} options
 * @param {object} options.analytics GET /analytics/monthly payload
 * @param {string} options.periodLabel "September 2026", localised
 * @param {string} options.generatedLabel date the report was produced
 * @param {string} [options.userName]
 * @param {boolean} options.rtl
 * @param {string} options.language "ar" | "fr" | "en"
 * @param {(key: string, params?: object) => string} options.t
 */
export function buildMonthlyReportHtml({ analytics, periodLabel, generatedLabel, userName, rtl, language, t }) {
  const currency = analytics?.currency || "MAD";
  const summary = analytics?.summary ?? {};
  const categories = [...(analytics?.categories ?? [])].sort((a, b) => (b.spent || 0) - (a.spent || 0));
  const days = analytics?.daily_trend ?? [];

  const net = summary.net_savings || 0;
  const rate = summary.savings_rate_percentage;
  const spendingDays = days.filter((day) => (day.expense || 0) > 0);
  const busiest = spendingDays.reduce((top, day) => (!top || day.expense > top.expense ? day : top), null);
  const averageDaily = days.length ? Math.round((summary.total_expense || 0) / days.length) : 0;
  const transactions = categories.reduce((sum, category) => sum + (Number(category.transactions_count) || 0), 0);

  const insights = [
    categories[0]
      ? t("pdf.insight_top", {
          category: escapeHtml(categoryName(categories[0]) ?? ""),
          percent: `<bdi dir="ltr">${Math.round(Number(categories[0].percentage) || 0)}%</bdi>`,
        })
      : null,
    busiest
      ? t("pdf.insight_busiest", {
          day: busiest.day,
          amount: money(busiest.expense_formatted, busiest.expense, currency),
        })
      : null,
    averageDaily > 0 ? t("pdf.insight_average", { amount: money(null, averageDaily, currency) }) : null,
    t("pdf.insight_active", { count: spendingDays.length, total: days.length || "—" }),
  ].filter(Boolean);

  const kpi = (label, value, color, sub = "") => `
    <div class="kpi">
      <div class="kpi-label">${escapeHtml(label)}</div>
      <div class="kpi-value" style="color:${color}">${value}</div>
      ${sub ? `<div class="kpi-sub">${sub}</div>` : ""}
    </div>`;

  return `<!DOCTYPE html>
<html lang="${escapeHtml(language)}" dir="${rtl ? "rtl" : "ltr"}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; font-family: -apple-system, "Segoe UI", Roboto, "Noto Sans Arabic", "Geeza Pro", Tahoma, sans-serif; color: ${INK}; font-size: 12px; background: #fff; }
  .page { padding: 0 0 28px; }
  .hero { background: linear-gradient(135deg, ${BRAND} 0%, #0E7A4A 60%, ${MINT} 130%); color: #fff; padding: 30px 36px 70px; position: relative; overflow: hidden; }
  .hero::after { content: ""; position: absolute; width: 260px; height: 260px; border-radius: 50%; background: rgba(255,255,255,0.07); top: -110px; ${rtl ? "left" : "right"}: -60px; }
  .brand { display: flex; align-items: center; gap: 10px; }
  .logo { width: 38px; height: 38px; border-radius: 11px; background: #fff; color: ${BRAND}; font-weight: 900; font-size: 20px; display: flex; align-items: center; justify-content: center; }
  .wordmark { font-size: 22px; font-weight: 900; letter-spacing: 3px; }
  .tagline { font-size: 10px; opacity: 0.8; letter-spacing: 0.5px; }
  .hero h1 { margin: 22px 0 4px; font-size: 26px; font-weight: 800; }
  .hero .period { font-size: 15px; opacity: 0.92; }
  .meta { margin-top: 10px; font-size: 10.5px; opacity: 0.8; }
  .content { padding: 0 36px; margin-top: -46px; position: relative; }
  .kpis { display: flex; gap: 10px; }
  .kpi { flex: 1; background: #fff; border-radius: 14px; padding: 14px; box-shadow: 0 4px 16px rgba(10,92,54,0.12); border: 1px solid ${LINE}; }
  .kpi-label { font-size: 10px; color: ${MUTED}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; }
  .kpi-value { font-size: 17px; font-weight: 800; margin-top: 6px; white-space: nowrap; }
  .kpi-sub { font-size: 9.5px; color: ${MUTED}; margin-top: 3px; }
  .section { margin-top: 22px; border: 1px solid ${LINE}; border-radius: 14px; padding: 16px 18px; page-break-inside: avoid; }
  .section h2 { margin: 0 0 12px; font-size: 14px; font-weight: 800; color: ${BRAND}; }
  .flow-row { display: flex; align-items: center; gap: 12px; margin-bottom: 9px; }
  .flow-label { width: 80px; font-weight: 700; }
  .flow-track { flex: 1; height: 12px; background: #F1F4F5; border-radius: 6px; overflow: hidden; }
  .flow-fill { height: 100%; border-radius: 6px; }
  .flow-value { width: 120px; text-align: ${rtl ? "left" : "right"}; font-weight: 800; }
  .legend { display: flex; gap: 16px; font-size: 10px; color: ${MUTED}; margin: 12px 0 6px; }
  .legend i { display: inline-block; width: 9px; height: 9px; border-radius: 2px; margin-${rtl ? "left" : "right"}: 5px; vertical-align: middle; }
  table { width: 100%; border-collapse: collapse; }
  th { font-size: 10px; color: ${MUTED}; text-transform: uppercase; letter-spacing: 0.4px; text-align: ${rtl ? "right" : "left"}; padding: 0 6px 8px; border-bottom: 1.5px solid ${LINE}; }
  td { padding: 9px 6px; border-bottom: 1px solid #F1F4F5; vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  .rank { color: ${MUTED}; width: 22px; }
  .num { text-align: ${rtl ? "left" : "right"}; white-space: nowrap; }
  th.num { text-align: ${rtl ? "left" : "right"}; }
  .strong { font-weight: 800; }
  .swatch { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-${rtl ? "left" : "right"}: 7px; vertical-align: middle; }
  .share { width: 130px; white-space: nowrap; }
  .share-track { display: inline-block; width: 70px; height: 7px; background: #F1F4F5; border-radius: 4px; overflow: hidden; vertical-align: middle; margin-${rtl ? "left" : "right"}: 6px; }
  .share-fill { height: 100%; border-radius: 4px; }
  .empty { text-align: center; color: ${MUTED}; padding: 18px; }
  .insights { margin: 0; padding-${rtl ? "right" : "left"}: 18px; line-height: 1.9; }
  .footer { margin: 26px 36px 0; padding-top: 12px; border-top: 1px solid ${LINE}; display: flex; justify-content: space-between; font-size: 9.5px; color: ${MUTED}; }
</style>
</head>
<body>
<div class="page">
  <div class="hero">
    <div class="brand">
      <div class="logo">F</div>
      <div>
        <div class="wordmark">FLOUSI</div>
        <div class="tagline">${escapeHtml(t("pdf.tagline"))}</div>
      </div>
    </div>
    <h1>${escapeHtml(t("pdf.report_title"))}</h1>
    <div class="period">${escapeHtml(periodLabel)}</div>
    <div class="meta">${escapeHtml(
      [userName ? t("pdf.prepared_for", { name: userName }) : null, t("pdf.generated_on", { date: generatedLabel })]
        .filter(Boolean)
        .join("  •  "),
    )}</div>
  </div>

  <div class="content">
    <div class="kpis">
      ${kpi(t("pdf.income"), money(summary.total_income_formatted, summary.total_income, currency), MINT)}
      ${kpi(t("pdf.expenses"), money(summary.total_expense_formatted, summary.total_expense, currency), RED)}
      ${kpi(t("pdf.net"), money(summary.net_savings_formatted, net, currency), net >= 0 ? BRAND : RED)}
      ${kpi(
        t("pdf.savings_rate"),
        rate === null || rate === undefined ? "—" : `<bdi dir="ltr">${Number(rate).toFixed(Number(rate) % 1 ? 1 : 0)}%</bdi>`,
        BRAND,
        escapeHtml(t("pdf.transactions_count", { count: transactions })),
      )}
    </div>

    <div class="section">
      <h2>${escapeHtml(t("pdf.cashflow"))}</h2>
      ${flowBars(summary, currency, t)}
      ${
        days.length
          ? `<div class="legend"><span><i style="background:${MINT}"></i>${escapeHtml(t("pdf.income"))}</span><span><i style="background:${RED}"></i>${escapeHtml(t("pdf.expenses"))}</span><span>${escapeHtml(t("pdf.daily_axis"))}</span></div>
             ${dailyChart(days)}`
          : ""
      }
    </div>

    <div class="section">
      <h2>${escapeHtml(t("pdf.categories"))}</h2>
      <table>
        <thead><tr>
          <th>#</th>
          <th>${escapeHtml(t("pdf.col_category"))}</th>
          <th class="num">${escapeHtml(t("pdf.col_count"))}</th>
          <th class="num">${escapeHtml(t("pdf.col_amount"))}</th>
          <th>${escapeHtml(t("pdf.col_share"))}</th>
        </tr></thead>
        <tbody>${categoryRows(categories, currency, t)}</tbody>
      </table>
    </div>

    <div class="section">
      <h2>${escapeHtml(t("pdf.highlights"))}</h2>
      <ul class="insights">${insights.map((line) => `<li>${line}</li>`).join("")}</ul>
    </div>
  </div>

  <div class="footer">
    <span>${escapeHtml(t("pdf.footer"))}</span>
    <span>FLOUSI • ${escapeHtml(currency)}</span>
  </div>
</div>
</body>
</html>`;
}
