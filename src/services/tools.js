import { Platform } from "react-native";
import api from "./api";
import { sanitizeAmountInput } from "../utils/money";

/**
 * Receipt scanning.
 *
 * NOTE ON AVAILABILITY — like the quick-add parser, this route is not on the
 * API yet. The contract below is what the scanner is wired against; until it
 * ships every call is a 404, which `isAiEndpointMissing()` (services/ai.js)
 * turns into "not available yet" plus a manual-entry way out.
 *
 *   POST /tools/scan-receipt   multipart/form-data, field `image`
 *     → { data: { amount, merchant, date, category_id, currency } }
 *
 * `amount` is the receipt total in major units (number or string), `date` is
 * "YYYY-MM-DD". Every field is optional: whatever the server could not read
 * is left for the user to fill in the transaction form.
 */

/** OCR is slower than the API's usual 8 s budget. */
const SCAN_TIMEOUT_MS = 45000;

function guessMimeType(uri, fallback = "image/jpeg") {
  const extension = String(uri).split("?")[0].split(".").pop()?.toLowerCase();
  return (
    { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", heic: "image/heic", webp: "image/webp" }[
      extension
    ] ?? fallback
  );
}

/** A "YYYY-MM-DD" that is a real day and not in the future, else null. */
function readReceiptDate(raw) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(raw ?? ""));
  if (!match) {
    return null;
  }
  const [, year, month, day] = match.map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getMonth() !== month - 1 || date.getTime() > Date.now()) {
    return null;
  }
  return date;
}

/**
 * @param {{ uri: string, mimeType?: string, fileName?: string }} image
 *   an ImagePicker asset
 * @returns {Promise<{
 *   amount: string|null,
 *   merchant: string|null,
 *   date: Date|null,
 *   categoryId: string|null,
 * }>}
 */
export async function scanReceipt(image, { signal } = {}) {
  const type = image.mimeType || guessMimeType(image.uri);
  const name = image.fileName || `receipt.${type.split("/")[1] || "jpg"}`;
  const form = new FormData();

  if (Platform.OS === "web") {
    // A browser FormData needs real bytes. The picker hands over the File it
    // read; failing that, its data:/blob: URI is fetched back into a Blob.
    const file = image.file ?? (await (await fetch(image.uri)).blob());
    form.append("image", file, name);
  } else {
    // React Native's FormData takes a { uri, name, type } file descriptor.
    form.append("image", { uri: image.uri, name, type });
  }

  const response = await api.post("/tools/scan-receipt", form, {
    signal,
    timeout: SCAN_TIMEOUT_MS,
    // A browser must write the header itself: it carries the multipart
    // boundary. Native needs it named explicitly.
    headers: { "Content-Type": Platform.OS === "web" ? undefined : "multipart/form-data" },
    // Stop axios from JSON-encoding the form.
    transformRequest: (data) => data,
  });
  const parsed = response.data?.data ?? response.data ?? {};

  const amount =
    parsed.amount === null || parsed.amount === undefined
      ? ""
      : sanitizeAmountInput(String(parsed.amount));

  return {
    amount: amount && amount !== "." ? amount : null,
    merchant: String(parsed.merchant ?? "").trim() || null,
    date: readReceiptDate(parsed.date),
    categoryId: parsed.category_id ?? null,
  };
}
