import jwt from 'jsonwebtoken';
import { User } from './models.js';

const secret = () => {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET is not set');
  return s;
};

export const signToken = (user) =>
  jwt.sign({ sub: user._id.toString(), role: user.role }, secret(), { expiresIn: '7d' });

export const publicUser = (u) => ({ id: u._id, name: u.name, email: u.email, role: u.role, country: u.country });

/** Attaches req.user when a valid Bearer token is present; never rejects. */
export async function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    try {
      const { sub } = jwt.verify(header.slice(7), secret());
      req.user = await User.findById(sub);
    } catch {
      /* invalid token: treat as anonymous */
    }
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please log in' });
  next();
}

// What a logged-in user may do is decided by Cerbos policies: see authz.js and server/cerbos/policies.
