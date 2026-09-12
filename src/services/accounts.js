import api from "./api";

/** What a brand-new user gets when they have nothing yet. */
export const DEFAULT_CASH_ACCOUNT = { name: "كاش", type: "cash" };

/**
 * GET /api/v1/accounts
 *
 * Returns the caller's live accounts (soft-deleted ones are excluded by the
 * model's default scope), newest first.
 */
export async function fetchAccounts() {
  const response = await api.get("/accounts");
  return response.data?.data ?? [];
}

/**
 * POST /api/v1/accounts
 *
 * `balance` is the opening amount in *major units* and is required by
 * StoreAccountRequest, so it is sent as a decimal string — same discipline as
 * transactions, no float ever built on the client. Currency and colour are
 * omitted deliberately: the API defaults them to the user's own
 * `preferred_currency` and the brand green.
 */
export async function createAccount({ name, type, balance = "0" }) {
  const response = await api.post("/accounts", { name, type, balance });
  return response.data?.data ?? response.data;
}

/** Creates the starter cash wallet for a user with no accounts. */
export function createDefaultCashAccount() {
  return createAccount({ ...DEFAULT_CASH_ACCOUNT, balance: "0" });
}

/**
 * Picks the account a form should start on.
 *
 * Preference order: a cash wallet (what most entries are paid from), then any
 * account in the user's primary currency, then simply the first one — so the
 * choice is never arbitrary when several accounts exist.
 */
export function pickDefaultAccount(accounts, preferredCurrency) {
  if (!accounts?.length) {
    return null;
  }

  const cash = accounts.find((account) => account.type === "cash");
  if (cash) {
    return cash;
  }

  if (preferredCurrency) {
    const matching = accounts.find(
      (account) => account.currency === preferredCurrency,
    );
    if (matching) {
      return matching;
    }
  }

  return accounts[0];
}
