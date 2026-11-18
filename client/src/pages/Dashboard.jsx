import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

export default function Dashboard() {
  const { user } = useAuth();
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/me/progress').then(setItems).catch((e) => setError(e.message));
  }, []);

  const badges = (items || []).filter((i) => i.completedAt);
  const active = (items || []).filter((i) => !i.completedAt);

  return (
    <>
      <h1>Hi {user.name.split(' ')[0]} 👋</h1>
      {error && <p className="error">{error}</p>}
      {!items && !error && <p className="muted">Loading…</p>}

      {items && items.length === 0 && (
        <div className="card">
          <p>You haven't started a path yet.</p>
          <Link to="/" className="btn">Explore domains</Link>
        </div>
      )}

      {active.length > 0 && (
        <>
          <h2>Continue learning</h2>
          <div className="grid">
            {active.map((i) => {
              const pct = Math.round((100 * i.done) / i.total);
              return (
                <Link key={i.pathId} to={`/p/${i.pathId}`} className="card">
                  <span className="small muted">{i.domain?.icon} {i.domain?.name}</span>
                  <h3>{i.title}</h3>
                  <div className="progress"><div style={{ width: `${pct}%` }} /></div>
                  <p className="small muted">{i.done}/{i.total} steps · {pct}%</p>
                </Link>
              );
            })}
          </div>
        </>
      )}

      {badges.length > 0 && (
        <>
          <h2>Your badges</h2>
          <div className="grid">
            {badges.map((b) => (
              <Link key={b.pathId} to={`/p/${b.pathId}`} className="card badge">
                <span className="icon">🏅</span>
                <h3>{b.title}</h3>
                <p className="small muted">{b.domain?.name} · earned {new Date(b.completedAt).toLocaleDateString()}</p>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}
