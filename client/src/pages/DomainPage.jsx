import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { catHue } from '../theme.js';

export default function DomainPage() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null);
    setError('');
    api(`/domains/${slug}`).then(setData).catch((e) => setError(e.message));
  }, [slug]);

  if (error) return <div className="card empty"><div className="big">😕</div><p>{error}</p><Link to="/">← Back to all skills</Link></div>;
  if (!data) return <div className="skeleton" style={{ minHeight: 180, marginTop: '1rem' }} />;
  const { domain, paths } = data;

  return (
    <div className={`hue-${catHue(domain.category)}`}>
      <Link to="/" className="back">← All skills</Link>
      <header className="banner">
        <span className="icon-tile">{domain.icon}</span>
        <div className="grow">
          <span className="kicker">{domain.category}</span>
          <h1>{domain.name}</h1>
          <p>{domain.description}</p>
        </div>
      </header>

      {paths.length === 0 ? (
        <div className="card empty">
          <div className="big">🌱</div>
          <h3>Paths are being prepared</h3>
          <p className="muted">Our team is curating the best free resources for {domain.name}. Check back soon!</p>
          <Link to="/" className="btn secondary small">Explore other skills</Link>
        </div>
      ) : (
        <>
          <h2 style={{ marginTop: 0 }}>Learning paths</h2>
          <div className="grid">
            {paths.map((p) => (
              <Link key={p._id} to={`/p/${p._id}`} className="card path-card">
                <span className={`pill level-${p.level}`}>{p.level}</span>
                <h3>{p.title}</h3>
                <p className="muted small">{p.description}</p>
                <div className="facts">
                  <span>📚 {p.stepCount} steps</span>
                  <span>⏱ ~{p.hours} hours</span>
                  <span>🏅 Badge</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
