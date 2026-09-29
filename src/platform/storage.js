/**
 * Key-value persistence for small secrets and preferences (token, theme,
 * language…). On iOS and Android this is the Keychain / Keystore through
 * expo-secure-store; `storage.web.js` stands in for it in the browser, where
 * expo-secure-store has no implementation at all.
 *
 * Only the three async calls the app uses are exposed, so both files keep the
 * same surface.
 */
export { getItemAsync, setItemAsync, deleteItemAsync } from "expo-secure-store";
