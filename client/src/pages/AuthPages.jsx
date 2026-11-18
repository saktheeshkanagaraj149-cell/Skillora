import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

function AuthShell({ title, children }) {
  return (
    <div className="auth">
      <aside className="auth-art">
        <span className="brand" style={{ color: '#fff' }}><span className="brand-mark">🌱</span> Skillora</span>
        <div>
          <h2>{title}</h2>
          <ul>
            <li>✅ Step-by-step paths for 20+ skills</li>
            <li>🧠 Quizzes that prove you learned it</li>
            <li>🏅 Badges for every path you finish</li>
            <li>💸 Free forever for learners</li>
          </ul>
        </div>
        <p className="small" style={{ opacity: 0.7, margin: 0 }}>Learn any skill, in the right order.</p>
      </aside>
      {children}
    </div>
  );
}

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
    <AuthShell title="Pick up where you left off.">
    <form className="form" onSubmit={submit}>
      <h1>Welcome back</h1>
      <p className="muted" style={{ margin: 0 }}>Log in to continue learning.</p>
      <label>Email<input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
      <label>Password<input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
      {error && <p className="error">{error}</p>}
      <button className="btn" style={{ width: '100%' }} disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      <p className="muted small">New here? <Link to="/register">Create a free account</Link></p>
    </form>
    </AuthShell>
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
    <AuthShell title="Start learning any skill, free.">
    <form className="form" onSubmit={submit}>
      <h1>Create your account</h1>
      <p className="muted" style={{ margin: 0 }}>Free forever. No card needed.</p>
      <label>Name<input required value={form.name} onChange={set('name')} /></label>
      <label>Email<input type="email" required value={form.email} onChange={set('email')} /></label>
      <label>Password <span className="muted small">(min 8 characters)</span><input type="password" required minLength={8} value={form.password} onChange={set('password')} /></label>
      <label>Country <span className="muted">(optional)</span><input value={form.country} onChange={set('country')} /></label>
      {error && <p className="error">{error}</p>}
      <button className="btn" style={{ width: '100%' }} disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
      <p className="muted small">Already have an account? <Link to="/login">Log in</Link></p>
    </form>
    </AuthShell>
  );
}
