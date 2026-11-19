/**
 * Pure auth-state decisions extracted from the React context so they can be
 * unit-tested without a DOM.
 *
 * Regression this protects: a network failure or 5xx from /auth/me must keep
 * the saved token and show the "server unreachable" state. It must never be
 * treated as a logout, and RequireAuth must not redirect to /login.
 */
export function classifyAuthFailure(error) {
  return error?.status === 401 ? 'logged-out' : 'server-down';
}

export function applyAuthFailure(error, { clearToken, setServerDown }) {
  const outcome = classifyAuthFailure(error);
  if (outcome === 'logged-out') {
    clearToken();
    setServerDown(false);
  } else {
    // Network error (status 0) or 5xx: the session is still saved, so retry.
    setServerDown(true);
  }
  return outcome;
}

export function authGate({ ready, user, serverDown }) {
  if (!ready) return 'loading';
  if (serverDown) return 'server-down';
  if (!user) return 'login';
  return 'ready';
}
