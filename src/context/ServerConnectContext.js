import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ServerConnectModal from "../components/common/ServerConnectModal";
import { onServerUnreachable } from "../services/serverEvents";
import { useAuth } from "./AuthContext";

/** After "not now", stay quiet this long even if failures continue. */
const DISMISS_COOLDOWN_MS = 60 * 1000;

const ServerConnectContext = createContext(null);

export function useServerConnect() {
  const context = useContext(ServerConnectContext);
  if (!context) {
    throw new Error("useServerConnect must be used inside <ServerConnectProvider>");
  }
  return context;
}

/**
 * Development helper for a backend whose LAN address keeps changing.
 *
 * In dev builds, repeated network failures open ServerConnectModal so a new
 * host can be typed on the phone; Settings can open it by hand too. Once a new
 * host is applied, `epoch` is bumped — the navigator is keyed on it, so every
 * mounted screen remounts and refetches against the new server.
 */
export function ServerConnectProvider({ children }) {
  const { refreshUser } = useAuth();
  const [visible, setVisible] = useState(false);
  const [reason, setReason] = useState("manual"); // "auto" | "manual"
  const [epoch, setEpoch] = useState(0);
  const visibleRef = useRef(false);
  const quietUntil = useRef(0);

  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  useEffect(() => {
    if (!__DEV__) {
      return undefined;
    }
    return onServerUnreachable(() => {
      if (visibleRef.current || Date.now() < quietUntil.current) {
        return;
      }
      visibleRef.current = true;
      setReason("auto");
      setVisible(true);
    });
  }, []);

  const openServerSettings = useCallback(() => {
    setReason("manual");
    setVisible(true);
  }, []);

  const close = useCallback(() => {
    quietUntil.current = Date.now() + DISMISS_COOLDOWN_MS;
    setVisible(false);
  }, []);

  const handleApplied = useCallback(async () => {
    quietUntil.current = 0;
    setVisible(false);
    try {
      await refreshUser();
    } catch (error) {
      console.log("Profile refresh after host change failed:", error.message);
    }
    setEpoch((value) => value + 1);
  }, [refreshUser]);

  const value = useMemo(
    () => ({ epoch, openServerSettings }),
    [epoch, openServerSettings],
  );

  return (
    <ServerConnectContext.Provider value={value}>
      {children}
      <ServerConnectModal
        visible={visible}
        reason={reason}
        onClose={close}
        onApplied={handleApplied}
      />
    </ServerConnectContext.Provider>
  );
}
