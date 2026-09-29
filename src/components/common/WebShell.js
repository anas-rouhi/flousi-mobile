/**
 * On iOS and Android the app fills the screen, so there is nothing to wrap.
 * `WebShell.web.js` frames it for desktop browsers.
 */
export default function WebShell({ children }) {
  return children;
}
