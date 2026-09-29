/**
 * `Alert` with the React Native signature. Native platforms use the real one;
 * `alert.web.js` replaces it in the browser, where react-native-web's Alert is
 * a silent no-op — confirmations such as "sign out?" would never answer.
 */
export { Alert } from "react-native";
