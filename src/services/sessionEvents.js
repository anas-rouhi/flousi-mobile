/**
 * A one-slot channel for "the server rejected our token".
 *
 * The axios instance has to be able to tell the auth context about a 401, but
 * `api.js` must not import the context — the context imports the services, and
 * closing that loop would be a require cycle. So the interceptor emits here and
 * AuthProvider subscribes, keeping the dependency pointing one way.
 */
let handler = null;

/**
 * Registers the single listener. Returns an unsubscribe function, so a provider
 * can clean up on unmount without clobbering a newer registration.
 */
export function onUnauthorized(fn) {
  handler = fn;
  return () => {
    if (handler === fn) {
      handler = null;
    }
  };
}

export function emitUnauthorized(context) {
  if (!handler) {
    // Before the provider mounts there is no session to tear down anyway.
    return;
  }
  handler(context);
}
