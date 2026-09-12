import api from "./api";

/**
 * POST /api/v1/transactions
 *
 * `amount` goes over the wire as a major-unit decimal *string* ("15.50") —
 * that is what StoreTransactionRequest validates, and it converts to centimes
 * server-side. Sending a string keeps the client out of float arithmetic
 * entirely; never pass a Number built by multiplying here.
 *
 * @param {{
 *   accountId: string,
 *   categoryId: string|null,
 *   type: "expense"|"income",
 *   amount: string,
 *   description?: string|null,
 *   transactionDate?: string|null,
 * }} entry
 */
export async function createTransaction({
  accountId,
  categoryId,
  type,
  amount,
  description,
  transactionDate,
}) {
  const response = await api.post("/transactions", {
    account_id: accountId,
    category_id: categoryId ?? null,
    type,
    amount,
    description: description?.trim() ? description.trim() : null,
    transaction_date: transactionDate ?? null,
    source: "manual",
  });

  // JsonResource wraps the created row in `data`.
  return response.data?.data ?? response.data;
}
