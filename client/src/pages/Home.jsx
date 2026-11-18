import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

const CATEGORY_ORDER = ['Technology', 'Engineering', 'Science & Maths', 'Business & Career', 'Creative Arts', 'Languages', 'Life Skills'];

export default function Home() {
  const { user } = useAuth();
  const [domains, setDomains] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    api('/domains').then(setDomains).catch((e) => setError(e.message));
  }, []);

  const shown = (domains || []).filter((d) => (d.name + d.description + (d.category || '')).toLowerCase().includes(q.toLowerCase()));
  const groups = CATEGORY_ORDER.concat([...new Set(shown.map((d) => d.category || 'Other'))].filter((c) => !CATEGORY_ORDER.includes(c)))
    .map((cat) => [cat, shown.filter((d) => (d.category || 'Other') === cat)])
    .filter(([, list]) => list.length);

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
      {groups.length > 1 && (
        <div className="chips">
          {groups.map(([cat]) => (
            <a key={cat} href={`#${cat}`} className="pill">{cat}</a>
          ))}
        </div>
      )}
      {groups.map(([cat, list]) => (
        <section key={cat} id={cat}>
          <h3 className="category">{cat}</h3>
          <div className="grid">
            {list.map((d) => (
              <Link key={d._id} to={`/d/${d.slug}`} className="card domain">
                <span className="icon">{d.icon}</span>
                <h3>{d.name}</h3>
                <p className="muted">{d.description}</p>
                <span className="pill">{d.pathCount ? `${d.pathCount} path${d.pathCount === 1 ? '' : 's'}` : 'Coming soon'}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
      {domains && shown.length === 0 && <p className="muted">No domain matches “{q}”.</p>}
    </>
  );
}
