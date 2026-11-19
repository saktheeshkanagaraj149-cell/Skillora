import { createContext, useContext, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api, tokenStore } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!tokenStore.get()) return setReady(true);
    api('/auth/me')
      .then((d) => setUser(d.user))
      // Only a rejected token logs you out; a slow or restarting server (e.g. Render waking up) must not
      .catch((e) => { if (e.status === 401) tokenStore.set(null); })
      .finally(() => setReady(true));
  }, []);

  const finish = ({ token, user }) => {
    tokenStore.set(token);
    setUser(user);
  };
  const login = async (email, password) => finish(await api('/auth/login', { method: 'POST', body: { email, password } }));
  const register = async (form) => finish(await api('/auth/register', { method: 'POST', body: form }));
  const logout = () => {
    tokenStore.set(null);
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, ready, login, register, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export function RequireAuth({ children, admin = false }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <p className="muted center">Loading…</p>;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (admin && user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}
