import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

export default function Home() {
  const { user } = useAuth();
  const [domains, setDomains] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    api('/domains').then(setDomains).catch((e) => setError(e.message));
  }, []);

  const shown = (domains || []).filter((d) => (d.name + d.description).toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <section className="hero">
        <h1>Learn any skill. Free. In the right order.</h1>
        <p>
          Skillora turns the best free videos and articles into a clear step-by-step path, with a quick quiz after each
          step so you know you really learned it.
        </p>
        {!user && <Link to="/register" className="btn">Start learning free</Link>}
      </section>

      <div className="row-between">
        <h2>Choose a domain</h2>
        <input className="search" placeholder="Search domains…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {error && <p className="error">{error}</p>}
      {!domains && !error && <p className="muted">Loading…</p>}
      <div className="grid">
        {shown.map((d) => (
          <Link key={d._id} to={`/d/${d.slug}`} className="card domain">
            <span className="icon">{d.icon}</span>
            <h3>{d.name}</h3>
            <p className="muted">{d.description}</p>
            <span className="pill">{d.pathCount} path{d.pathCount === 1 ? '' : 's'}</span>
          </Link>
        ))}
      </div>
      {domains && shown.length === 0 && <p className="muted">No domain matches “{q}”.</p>}
    </>
  );
}
