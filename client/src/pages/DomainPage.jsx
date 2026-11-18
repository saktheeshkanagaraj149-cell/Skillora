import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';

export default function DomainPage() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null);
    api(`/domains/${slug}`).then(setData).catch((e) => setError(e.message));
  }, [slug]);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Loading…</p>;
  const { domain, paths } = data;

  return (
    <>
      <Link to="/" className="muted">← All domains</Link>
      <h1>{domain.icon} {domain.name}</h1>
      <p className="muted">{domain.description}</p>

      {paths.length === 0 ? (
        <div className="card">
          <p>No learning paths here yet. They're coming soon!</p>
        </div>
      ) : (
        <div className="grid">
          {paths.map((p) => (
            <Link key={p._id} to={`/p/${p._id}`} className="card">
              <span className={`pill level-${p.level}`}>{p.level}</span>
              <h3>{p.title}</h3>
              <p className="muted">{p.description}</p>
              <p className="small muted">{p.stepCount} steps · ~{p.hours} hours</p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
