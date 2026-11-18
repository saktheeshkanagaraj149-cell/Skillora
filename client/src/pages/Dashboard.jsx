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
  const stepsDone = (items || []).reduce((n, i) => n + i.done, 0);

  return (
    <>
      <div className="welcome">
        <div>
          <h1>Hi {user.name.split(' ')[0]} 👋</h1>
          <p className="muted" style={{ margin: 0 }}>Small steps every day add up. Keep going!</p>
        </div>
        <Link to="/" className="btn secondary small">+ Explore skills</Link>
      </div>

      <div className="stats">
        <div className="stat"><b>{items ? active.length : '·'}</b><span>paths in progress</span></div>
        <div className="stat"><b>{items ? stepsDone : '·'}</b><span>steps completed</span></div>
        <div className="stat"><b>{items ? badges.length : '·'}</b><span>badges earned</span></div>
      </div>

      {error && <p className="error">{error}</p>}
      {!items && !error && <div className="grid" style={{ marginTop: '2rem' }}>{[1, 2, 3].map((i) => <div key={i} className="skeleton" />)}</div>}

      {items && items.length === 0 && (
        <div className="card empty" style={{ marginTop: '2rem' }}>
          <div className="big">🧭</div>
          <h3>Start your first path</h3>
          <p className="muted">Pick any skill, from Python to photography, and follow it step by step.</p>
          <Link to="/" className="btn">Explore skills</Link>
        </div>
      )}

      {active.length > 0 && (
        <>
          <h2>Continue learning</h2>
          <div className="grid">
            {active.map((i) => {
              const pct = Math.round((100 * i.done) / i.total);
              return (
                <Link key={i.pathId} to={`/p/${i.pathId}`} className="card path-card">
                  <span className="small muted">{i.domain?.icon} {i.domain?.name}</span>
                  <h3>{i.title}</h3>
                  <div className="progress"><div style={{ width: `${pct}%` }} /></div>
                  <div className="row-between small muted"><span>{i.done}/{i.total} steps</span><strong style={{ color: 'var(--leaf-strong)' }}>{pct}% →</strong></div>
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
              <Link key={b.pathId} to={`/p/${b.pathId}`} className="card badge-card">
                <span className="medal">🏅</span>
                <h3>{b.title}</h3>
                <p className="small muted" style={{ margin: 0 }}>{b.domain?.icon} {b.domain?.name} · {new Date(b.completedAt).toLocaleDateString()}</p>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}
