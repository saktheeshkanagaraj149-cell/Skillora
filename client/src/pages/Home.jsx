import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { CATEGORY_ORDER, catEmoji, catHue } from '../theme.js';

const SUGGESTIONS = ['Python', 'Arduino', 'Photography', 'Spoken English', 'Aptitude'];

function DomainCard({ d }) {
  return (
    <Link to={`/d/${d.slug}`} className={`card domain-card hue-${catHue(d.category)}`}>
      <span className="icon-tile">{d.icon}</span>
      <h3>{d.name}</h3>
      <p className="muted">{d.description}</p>
      <div className="meta">
        {d.pathCount ? (
          <span className="pill count-pill">{d.pathCount} path{d.pathCount === 1 ? '' : 's'}</span>
        ) : (
          <span className="pill muted-pill">Coming soon</span>
        )}
        <span className="arrow">→</span>
      </div>
    </Link>
  );
}

export default function Home() {
  const { user } = useAuth();
  const [domains, setDomains] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');

  useEffect(() => {
    api('/domains').then(setDomains).catch((e) => setError(e.message));
  }, []);

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const shown = (domains || []).filter(
      (d) =>
        (cat === 'All' || (d.category || 'Other') === cat) &&
        (!needle || `${d.name} ${d.description} ${d.category}`.toLowerCase().includes(needle)),
    );
    const cats = [...CATEGORY_ORDER, ...new Set(shown.map((d) => d.category || 'Other'))].filter((c, i, a) => a.indexOf(c) === i);
    return cats.map((c) => [c, shown.filter((d) => (d.category || 'Other') === c)]).filter(([, list]) => list.length);
  }, [domains, q, cat]);

  const totalPaths = (domains || []).reduce((n, d) => n + d.pathCount, 0);
  const categories = [...new Set((domains || []).map((d) => d.category || 'Other'))];

  const search = (value) => {
    setQ(value);
    setCat('All');
    document.getElementById('explore')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <section className="hero">
        <span className="eyebrow">🌱 100% free · every skill · every country</span>
        <h1>
          Learn any skill, <em>in the right order.</em>
        </h1>
        <p className="lead">
          Skillora turns the best free videos and articles into clear step-by-step paths, from engineering to photography.
          A quick quiz after each step proves you really learned it.
        </p>
        <form className="hero-search" onSubmit={(e) => { e.preventDefault(); search(q); }}>
          <span aria-hidden>🔍</span>
          <input aria-label="Search skills" placeholder="What do you want to learn?" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn small">Search</button>
        </form>
        <div className="hero-tags">
          Popular:
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" onClick={() => search(s)}>{s}</button>
          ))}
        </div>
      </section>

      <div className="stats">
        <div className="stat"><b>{domains ? domains.length : '·'}</b><span>skill domains</span></div>
        <div className="stat"><b>{domains ? categories.length : '·'}</b><span>categories</span></div>
        <div className="stat"><b>{domains ? totalPaths : '·'}</b><span>published paths</span></div>
        <div className="stat"><b>₹0</b><span>forever, for learners</span></div>
      </div>

      <div className="section-head"><h2>How Skillora works</h2></div>
      <div className="how">
        <div className="card"><span className="step-no">1</span><div><h3>Pick a skill</h3><p>Choose from engineering, tech, business, arts, languages and life skills.</p></div></div>
        <div className="card"><span className="step-no">2</span><div><h3>Follow the path</h3><p>Each step links you to the best free videos and articles, in the right order.</p></div></div>
        <div className="card"><span className="step-no">3</span><div><h3>Prove it, earn a badge</h3><p>Pass a short quiz to finish each step. Complete the path to earn your badge.</p></div></div>
      </div>

      <div className="section-head" id="explore">
        <div>
          <h2>Explore skills</h2>
          {q && <p className="muted small" style={{ margin: '0.3rem 0 0' }}>Results for “{q}” · <button className="link" onClick={() => setQ('')}>clear</button></p>}
        </div>
        <input className="search" placeholder="Filter skills…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter skills" />
      </div>

      <div className="chips" role="tablist" aria-label="Categories">
        {['All', ...CATEGORY_ORDER.filter((c) => categories.includes(c))].map((c) => (
          <button key={c} role="tab" aria-selected={cat === c} className={`chip hue-${catHue(c)} ${cat === c ? 'active' : ''}`} onClick={() => setCat(c)}>
            {c === 'All' ? '✨' : catEmoji(c)} {c}
          </button>
        ))}
      </div>

      {error && <p className="error">Couldn't load skills: {error}</p>}
      {!domains && !error && (
        <div className="grid">{Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton" />)}</div>
      )}

      {groups.map(([c, list]) => (
        <section key={c} id={c}>
          <div className={`category-title hue-${catHue(c)}`}>
            <span className="icon-tile">{catEmoji(c)}</span>
            <h3>{c}</h3>
            <span className="count">{list.length}</span>
          </div>
          <div className="grid">{list.map((d) => <DomainCard key={d._id} d={d} />)}</div>
        </section>
      ))}

      {domains && groups.length === 0 && (
        <div className="card empty">
          <div className="big">🔎</div>
          <p>No skill matches “{q}” yet.</p>
          <button className="btn secondary small" onClick={() => { setQ(''); setCat('All'); }}>Show all skills</button>
        </div>
      )}

      {!user && (
        <section className="hero" style={{ marginTop: '3rem', textAlign: 'center' }}>
          <h2 style={{ color: '#fff', margin: '0 auto 0.6rem', fontSize: 'clamp(1.6rem,4vw,2.2rem)' }}>Start learning today. It's free.</h2>
          <p className="lead" style={{ margin: '0 auto 1.4rem' }}>Track your progress, take quizzes and collect badges.</p>
          <Link to="/register" className="btn light">Create free account</Link>
        </section>
      )}
    </>
  );
}
