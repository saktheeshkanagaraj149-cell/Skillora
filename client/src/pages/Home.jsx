import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { CATEGORY_ORDER, catHue } from '../theme.js';
import { CategoryIcon, DomainIcon } from '../icons.jsx';
import { ArrowRight, Award, Compass, Footprints, Play, Search, SearchX, Sparkles, Sprout, Verified } from '../icons';

const SUGGESTIONS = ['Python', 'Arduino', 'Photography', 'Spoken English', 'Aptitude'];

function scrollBehavior() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

function DomainCard({ d }) {
  return (
    <Link to={`/d/${d.slug}`} className={`card domain-card hue-${catHue(d.category)}`}>
      <span className="icon-tile"><DomainIcon slug={d.slug} category={d.category} /></span>
      <h3>{d.name}</h3>
      <p className="muted">{d.description}</p>
      <div className="meta">
        {d.pathCount ? (
          <span className="pill count-pill">{d.pathCount} course{d.pathCount === 1 ? '' : 's'}</span>
        ) : (
          <span className="pill muted-pill">Coming soon</span>
        )}
        <span className="card-cta small">Explore <ArrowRight className="arrow" size={16} aria-hidden /></span>
      </div>
    </Link>
  );
}

function ContinueCard({ item }) {
  const pct = Math.round((100 * item.done) / item.total);
  return (
    <Link to={`/p/${item.pathId}`} className="card continue-card">
      <div className="continue-top">
        <span className="pill muted-pill with-icon"><DomainIcon slug={item.domain?.slug} size={14} /> {item.domain?.name || 'Course'}</span>
        <span className="small muted">{item.done}/{item.total} lessons</span>
      </div>
      <h3>{item.title}</h3>
      <div className="progress" aria-label={`${pct}% complete`}><div style={{ width: `${pct}%` }} /></div>
      <div className="row-between small" style={{ marginTop: '0.45rem' }}>
        <span style={{ color: 'var(--leaf-strong)', fontWeight: 700 }}>{pct}% complete</span>
        <span className="with-icon" style={{ fontWeight: 600 }}>Resume <Play size={14} aria-hidden /></span>
      </div>
    </Link>
  );
}

export default function Home() {
  const { user } = useAuth();
  const [domains, setDomains] = useState(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(null);
  const [certs, setCerts] = useState([]);
  const [personalError, setPersonalError] = useState('');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');

  useEffect(() => {
    api('/domains').then(setDomains).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!user) {
      setProgress(null);
      setCerts([]);
      setPersonalError('');
      return;
    }
    let cancelled = false;
    Promise.all([api('/me/progress'), api('/me/certificates')])
      .then(([p, c]) => {
        if (cancelled) return;
        setProgress(p || []);
        setCerts(c || []);
      })
      .catch((e) => { if (!cancelled) setPersonalError(e.message); });
    return () => { cancelled = true; };
  }, [user]);

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
  const active = (progress || []).filter((i) => !i.completedAt).sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  const completed = (progress || []).filter((i) => i.completedAt);

  const search = (value) => {
    setQ(value);
    setCat('All');
    document.getElementById('explore')?.scrollIntoView({ behavior: scrollBehavior() });
  };

  return (
    <>
      {user ? (
        <section className="hero hero-personal">
          <span className="eyebrow"><Sparkles size={15} aria-hidden /> Your learning pathway</span>
          <h1>Welcome back, <em>{user.name.split(' ')[0]}</em>.</h1>
          <p className="lead">
            Pick up where you left off, track your progress, and keep moving toward your next certificate.
          </p>
          <div className="personal-hero-actions">
            {active[0] ? (
              <Link to={`/p/${active[0].pathId}`} className="btn"><Play size={17} aria-hidden /> Continue: {active[0].title}</Link>
            ) : (
              <a href="#explore" className="btn" onClick={(e) => { e.preventDefault(); document.getElementById('explore')?.scrollIntoView({ behavior: scrollBehavior() }); }}><Compass size={17} aria-hidden /> Find your next course</a>
            )}
            <Link to="/dashboard" className="btn secondary light-outline">Open my learning</Link>
          </div>
          <div className="stats personal-stats">
            <div className="stat"><b>{progress ? active.length : '·'}</b><span>in progress</span></div>
            <div className="stat"><b>{progress ? completed.length : '·'}</b><span>courses completed</span></div>
            <div className="stat"><b>{progress ? certs.length : '·'}</b><span>certificates</span></div>
            <div className="stat"><b>{progress ? (progress || []).reduce((n, i) => n + i.done, 0) : '·'}</b><span>lessons finished</span></div>
          </div>
          {personalError && <p className="error" role="alert" style={{ color: '#fecaca' }}>{personalError}</p>}
          {!progress && !personalError && <p className="small" style={{ color: '#d7e8df', margin: '0.8rem 0 0' }}>Loading your progress…</p>}
          {progress && active.length === 0 && (
            <div className="personal-empty card">
              <h3>Ready for your next step?</h3>
              <p className="muted">You don’t have a course in progress yet. Explore a skill below and start a pathway.</p>
            </div>
          )}
          {active.length > 0 && (
            <div className="continue-grid" aria-label="Continue learning">
              {active.slice(0, 3).map((item) => <ContinueCard key={item.pathId} item={item} />)}
            </div>
          )}
        </section>
      ) : (
        <>
          <section className="hero hero-guest">
            <span className="eyebrow"><Sprout size={15} aria-hidden /> 100% free · every skill · every country</span>
            <h1>
              Learn any skill, <em>in the right order.</em>
            </h1>
            <p className="lead">
              Skillora turns the best free videos and articles into structured courses with video lessons, quizzes and a free certificate, from engineering to photography.
              A quick quiz after each step proves you really learned it.
            </p>
            <form className="hero-search" onSubmit={(e) => { e.preventDefault(); search(q); }}>
              <Search size={20} color="#6b7a73" aria-hidden />
              <input aria-label="Search skills" placeholder="What do you want to learn?" value={q} onChange={(e) => setQ(e.target.value)} />
              <button className="btn small" type="submit">Search</button>
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
            <div className="stat"><b>{domains ? totalPaths : '·'}</b><span>published courses</span></div>
            <div className="stat"><b>₹0</b><span>forever, for learners</span></div>
          </div>

          <div className="section-head"><h2>How Skillora works</h2></div>
          <div className="how pathway-how">
            <div className="card"><span className="step-no"><Compass size={18} aria-hidden /></span><div><h3>Pick a skill</h3><p>Choose from engineering, tech, business, arts, languages and life skills.</p></div></div>
            <div className="card"><span className="step-no"><Footprints size={18} aria-hidden /></span><div><h3>Follow the pathway</h3><p>Learn in order with curated videos, articles and checkpoints for each lesson.</p></div></div>
            <div className="card"><span className="step-no"><Award size={18} aria-hidden /></span><div><h3>Prove it, earn a certificate</h3><p>Pass quizzes and the final exam to earn a verifiable certificate.</p></div></div>
          </div>
        </>
      )}

      <div className="section-head" id="explore">
        <div>
          <h2>{user ? 'Explore more skills' : 'Explore skills'}</h2>
          {q && <p className="muted small" style={{ margin: '0.3rem 0 0' }}>Results for “{q}” · <button className="link" type="button" onClick={() => setQ('')}>clear</button></p>}
        </div>
        <input className="search" placeholder="Filter skills…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter skills" />
      </div>

      <div className="chips" role="tablist" aria-label="Categories">
        {['All', ...CATEGORY_ORDER.filter((c) => categories.includes(c))].map((c) => (
          <button key={c} type="button" role="tab" aria-selected={cat === c} className={`chip hue-${catHue(c)} ${cat === c ? 'active' : ''}`} onClick={() => setCat(c)}>
            <CategoryIcon category={c} size={16} /> {c}
          </button>
        ))}
      </div>

      {error && <p className="error" role="alert">Couldn't load skills: {error}</p>}
      {!domains && !error && (
        <div className="grid">{Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton" />)}</div>
      )}

      {groups.map(([c, list]) => (
        <section key={c} id={c}>
          <div className={`category-title hue-${catHue(c)}`}>
            <span className="icon-tile"><CategoryIcon category={c} /></span>
            <h3>{c}</h3>
            <span className="count">{list.length} skill{list.length === 1 ? '' : 's'}</span>
          </div>
          <div className="grid">{list.map((d) => <DomainCard key={d._id} d={d} />)}</div>
        </section>
      ))}

      {domains && groups.length === 0 && (
        <div className="card empty">
          <SearchX className="big-icon" size={44} aria-hidden />
          <p>No skill matches “{q}” yet.</p>
          <button className="btn secondary small" type="button" onClick={() => { setQ(''); setCat('All'); }}>Show all skills</button>
        </div>
      )}

      {!user && (
        <section className="hero hero-cta" style={{ marginTop: '3rem', textAlign: 'center' }}>
          <h2 style={{ color: '#fff', margin: '0 auto 0.6rem', fontSize: 'clamp(1.6rem,4vw,2.2rem)' }}>Start learning today. It's free.</h2>
          <p className="lead" style={{ margin: '0 auto 1.4rem' }}>Track your progress, take quizzes and earn a verifiable certificate.</p>
          <Link to="/register" className="btn light">Create free account</Link>
        </section>
      )}
      {user && certs.length > 0 && (
        <section className="card trust-strip" style={{ marginTop: '2rem' }}>
          <Verified size={22} aria-hidden />
          <div className="grow">
            <strong>You’ve earned {certs.length} certificate{certs.length === 1 ? '' : 's'}.</strong>
            <p className="small muted" style={{ margin: 0 }}>Each certificate is verifiable by its unique ID and shareable link.</p>
          </div>
          <Link to="/dashboard" className="btn secondary small">View certificates</Link>
        </section>
      )}
    </>
  );
}
