import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { describeApiError } from "../services/api";
import {
  createDefaultCashAccount,
  fetchAccounts,
  pickDefaultAccount,
} from "../services/accounts";

/**
 * Loads the user's accounts and keeps a sensible selection.
 *
 * Shared by the dashboard and the quick-entry sheet so both agree on what "the
 * default account" is, and so the "you have no wallet yet" recovery exists in
 * one place instead of being reimplemented per screen.
 *
 * @param {{ enabled?: boolean }} options pass `enabled: false` to hold off the
 *   request until a screen actually needs it (the modal, before it opens).
 */
export function useAccounts({ enabled = true } = {}) {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  const applyRows = useCallback(
    (rows) => {
      setAccounts(rows);
      setSelectedId((current) => {
        // Keep an explicit choice if it still exists, otherwise re-derive.
        if (current && rows.some((row) => row.id === current)) {
          return current;
        }
        return pickDefaultAccount(rows, user?.preferred_currency)?.id ?? null;
      });
    },
    [user?.preferred_currency],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      applyRows(await fetchAccounts());
    } catch (err) {
      console.log("Account load failed:", err.response?.data || err.message);
      setError(describeApiError(err));
    } finally {
      setLoading(false);
    }
  }, [applyRows]);

  useEffect(() => {
    if (enabled) {
      load();
    }
  }, [enabled, load]);

  /**
   * Creates the starter wallet and selects it, so the caller goes straight from
   * "no accounts" to a usable form without a second round trip.
   */
  const createDefaultAccount = useCallback(async () => {
    setCreating(true);
    setError(null);
    try {
      const created = await createDefaultCashAccount();
      setAccounts((current) => [created, ...current]);
      setSelectedId(created.id);
      return created;
    } catch (err) {
      console.log("Account create failed:", err.response?.data || err.message);
      setError(describeApiError(err));
      return null;
    } finally {
      setCreating(false);
    }
  }, []);

  return {
    accounts,
    selectedId,
    setSelectedId,
    selectedAccount: accounts.find((account) => account.id === selectedId) ?? null,
    isEmpty: !loading && accounts.length === 0,
    loading,
    creating,
    error,
    reload: load,
    createDefaultAccount,
  };
}
