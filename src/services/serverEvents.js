/**
 * A one-slot channel for "requests keep failing to reach the server".
 *
 * Same shape and reason as sessionEvents: the axios instance must be able to
 * tell the UI, but `api.js` cannot import a context without a require cycle.
 * ServerConnectProvider subscribes; before it mounts, failures go unheard.
 */
let handler = null;

export function onServerUnreachable(fn) {
  handler = fn;
  return () => {
    if (handler === fn) {
      handler = null;
    }
  };
}

export function emitServerUnreachable(context) {
  handler?.(context);
}
