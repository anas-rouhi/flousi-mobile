import api from "./api";

/**
 * Name for a starter cash wallet, matching what the backend's
 * `UserRegistrationService` would have called it. New accounts on this API
 * default `preferred_language` to French, so hardcoding the Arabic name would
 * label a French user's wallet "كاش" while every other server-supplied string
 * on their screen is French.
 */
const DEFAULT_WALLET_NAMES = { ar: "كاش", fr: "Espèces", en: "Cash" };

export function defaultCashAccountName(language) {
  return DEFAULT_WALLET_NAMES[language] || DEFAULT_WALLET_NAMES.ar;
}

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
 * Note the asymmetry with transactions: `opening_balance` is an **integer in
 * centimes** (150000 = 1 500,00 DH), whereas `POST /transactions` takes its
 * amount in major units. Sending a decimal string here fails validation with
 * "The opening balance must be an integer in centimes".
 *
 * That suits the client: the amount is already computed as centimes by
 * `amountToCentimes` using digit-string math, so nothing is rounded on the way.
 *
 * Currency and colour are omitted deliberately — the API defaults them to the
 * user's own `preferred_currency` and the brand green.
 *
 * @param {{ name: string, type: string, openingCentimes?: number }} account
 */
export async function createAccount({ name, type, openingCentimes = 0 }) {
  const response = await api.post("/accounts", {
    name,
    type,
    opening_balance: Math.trunc(openingCentimes) || 0,
  });
  return response.data?.data ?? response.data;
}

/**
 * Creates a starter cash wallet.
 *
 * Registration already creates one (`UserRegistrationService::createDefaultWallet`),
 * so this is the recovery path for an account that was deleted, or for a user
 * who registered before that behaviour existed — not the normal first-run flow.
 */
export function createDefaultCashAccount(language) {
  return createAccount({
    name: defaultCashAccountName(language),
    type: "cash",
    openingCentimes: 0,
  });
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
