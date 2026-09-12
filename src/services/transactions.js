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

/**
 * GET /api/v1/transactions — paginated history, newest first.
 *
 * Supported filters: `type` (income|expense|transfer), `account_id`,
 * `category_id`, `from`/`to` dates, and `month`+`year` which are
 * `required_with` each other (a lone `month` is a 422).
 *
 * There is deliberately no text-search parameter on the API, so description
 * search is applied client-side over the pages already loaded — see
 * `useTransactions`.
 *
 * @returns {Promise<{rows: object[], page: number, lastPage: number, total: number}>}
 */
export async function fetchTransactions({
  page = 1,
  perPage = 20,
  type,
  accountId,
  categoryId,
  signal,
} = {}) {
  const response = await api.get("/transactions", {
    params: {
      page,
      per_page: perPage,
      ...(type ? { type } : {}),
      ...(accountId ? { account_id: accountId } : {}),
      ...(categoryId ? { category_id: categoryId } : {}),
    },
    signal,
  });

  const meta = response.data?.meta;
  return {
    rows: response.data?.data ?? [],
    page: meta?.current_page ?? page,
    lastPage: meta?.last_page ?? page,
    total: meta?.total ?? 0,
  };
}

/** DELETE /api/v1/transactions/{id} — 204, and reverses the account balance. */
export async function deleteTransaction(id) {
  await api.delete(`/transactions/${id}`);
}
