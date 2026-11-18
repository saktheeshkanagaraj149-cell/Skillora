import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

function useAfterAuth() {
  const navigate = useNavigate();
  const location = useLocation();
  return () => navigate(location.state?.from || '/dashboard', { replace: true });
}

export function Login() {
  const { login } = useAuth();
  const done = useAfterAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(form.email, form.password);
      done();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card form" onSubmit={submit}>
      <h1>Welcome back</h1>
      <label>Email<input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
      <label>Password<input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
      {error && <p className="error">{error}</p>}
      <button className="btn" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      <p className="muted small">New here? <Link to="/register">Create a free account</Link></p>
    </form>
  );
}

export function Register() {
  const { register } = useAuth();
  const done = useAfterAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', country: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await register(form);
      done();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card form" onSubmit={submit}>
      <h1>Join Skillora, free forever</h1>
      <label>Name<input required value={form.name} onChange={set('name')} /></label>
      <label>Email<input type="email" required value={form.email} onChange={set('email')} /></label>
      <label>Password<input type="password" required minLength={8} value={form.password} onChange={set('password')} /></label>
      <label>Country <span className="muted">(optional)</span><input value={form.country} onChange={set('country')} /></label>
      {error && <p className="error">{error}</p>}
      <button className="btn" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
      <p className="muted small">Already have an account? <Link to="/login">Log in</Link></p>
    </form>
  );
}
