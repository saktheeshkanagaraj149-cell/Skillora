import { createContext, useContext, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api, tokenStore } from './api.js';
import { applyAuthFailure, authGate } from './authBehavior.js';

export const SERVER_DOWN_MESSAGE = "Can't reach the Skillora server right now. Please try again in a minute.";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [serverDown, setServerDown] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!tokenStore.get()) {
        if (!cancelled) setReady(true);
        return;
      }
      try {
        const d = await api('/auth/me');
        if (!cancelled) {
          setUser(d.user);
          setServerDown(false);
        }
      } catch (e) {
        if (cancelled) return;
        applyAuthFailure(e, {
          clearToken: () => tokenStore.set(null),
          setServerDown,
        });
      } finally {
        if (!cancelled) setReady(true);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // While the API is unreachable, retry quietly. A saved session is restored as soon as it comes back.
  useEffect(() => {
    if (!serverDown || !tokenStore.get()) return undefined;
    const timer = setInterval(async () => {
      try {
        const d = await api('/auth/me');
        setUser(d.user);
        setServerDown(false);
      } catch (e) {
        applyAuthFailure(e, {
          clearToken: () => tokenStore.set(null),
          setServerDown,
        });
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [serverDown]);

  const finish = ({ token, user }) => {
    tokenStore.set(token);
    setUser(user);
    setServerDown(false);
  };
  const login = async (email, password) => finish(await api('/auth/login', { method: 'POST', body: { email, password } }));
  const register = async (form) => finish(await api('/auth/register', { method: 'POST', body: form }));
  const logout = () => {
    tokenStore.set(null);
    setUser(null);
    setServerDown(false);
  };

  return <AuthContext.Provider value={{ user, ready, serverDown, login, register, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export function RequireAuth({ children, admin = false }) {
  const { user, ready, serverDown } = useAuth();
  const location = useLocation();
  const gate = authGate({ ready, user, serverDown });
  if (gate === 'loading') return <p className="muted center">Loading…</p>;
  // Do not send a logged-in learner to /login just because the API is temporarily down.
  if (gate === 'server-down') {
    return (
      <div className="card empty" role="alert">
        <h2>{SERVER_DOWN_MESSAGE}</h2>
        <p className="muted">Your session is saved. We'll reconnect automatically.</p>
      </div>
    );
  }
  if (gate === 'login') return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (admin && user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}
