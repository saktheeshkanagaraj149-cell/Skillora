/**
 * Authorization via Cerbos (https://cerbos.dev). Authentication (who you are) is still the JWT in auth.js;
 * Cerbos decides what you may do, using the policies in server/cerbos/policies.
 * If Cerbos cannot be reached, every check fails closed with 503: nothing is allowed by accident.
 */
import { HTTP } from '@cerbos/http';

const cerbos = new HTTP(process.env.CERBOS_URL || 'http://localhost:3592');

export class AuthzUnavailableError extends Error {
  constructor(cause) {
    super('Permission service unavailable');
    this.name = 'AuthzUnavailableError';
    this.status = 503;
    this.cause = cause;
  }
}

/** The Cerbos principal for a request: the logged-in user, or an anonymous guest. */
export const principalOf = (user) =>
  user ? { id: user._id.toString(), roles: [user.role || 'learner'] } : { id: 'anonymous', roles: ['guest'] };

/** Resource sent to Cerbos for a path document (or a not-yet-created path). */
export const pathResource = (path) =>
  path ? { kind: 'path', id: path._id.toString(), attr: { status: path.status } } : { kind: 'path', id: 'new', attr: {} };

/**
 * Asks Cerbos which of `actions` the user may perform on `resource`.
 * Returns a function: allowed('view') -> boolean.
 */
export async function check(user, resource, actions) {
  let decision;
  try {
    decision = await cerbos.checkResource({ principal: principalOf(user), resource, actions });
  } catch (err) {
    throw new AuthzUnavailableError(err);
  }
  return (action) => decision.isAllowed(action) === true;
}

/**
 * Convenience wrapper: checks a single action and returns boolean.
 */
export async function can(user, resource, action) {
  const allowed = await check(user, resource, [action]);
  return allowed(action);
}

/** Standard 403 response body for permission denials. */
export const FORBIDDEN = { error: 'You do not have permission to do that' };

/** Express middleware for actions that don't depend on a specific document (list, create). */
export const authorize = (kind, action) => async (req, res, next) => {
  try {
    const allowed = await check(req.user, { kind, id: 'new', attr: {} }, [action]);
    if (!allowed(action)) return res.status(403).json({ error: 'You do not have permission to do that' });
    next();
  } catch (err) {
    next(err);
  }
};

export async function cerbosHealthy() {
  try {
    const { status } = await cerbos.checkHealth();
    return status === 'SERVING';
  } catch {
    return false;
  }
}
