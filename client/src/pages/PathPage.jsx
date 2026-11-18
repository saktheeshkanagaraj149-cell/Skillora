import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

const RESOURCE_ICON = { video: '▶️', article: '📄', course: '🎓', practice: '🛠️', search: '🔎' };
const resourceIcon = (r) => (r.type === 'search' && /youtube\.com/.test(r.url) ? '▶️' : RESOURCE_ICON[r.type] || '🔗');

function Quiz({ pathId, step, done, onResult }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [answers, setAnswers] = useState(() => step.quiz.map(() => null));
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!user) return navigate('/login', { state: { from: `/p/${pathId}` } });
    setBusy(true);
    setError('');
    try {
      const r = await api(`/paths/${pathId}/steps/${step._id}/complete`, { method: 'POST', body: { answers } });
      setResult(r);
      onResult(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!step.quiz.length) {
    return (
      <div className="quiz">
        <p style={{ margin: '0 0 0.8rem' }}>Finished the resources above?</p>
        <button className="btn" disabled={busy || done} onClick={submit}>
          {done ? '✓ Completed' : user ? 'Mark step as done' : 'Log in to track progress'}
        </button>
        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="quiz">
      <h4>🧠 Quick check · {step.quiz.length} questions · pass mark 60%</h4>
      {step.quiz.map((q, qi) => (
        <fieldset key={qi}>
          <legend>{qi + 1}. {q.question}</legend>
          {q.options.map((opt, oi) => {
            const r = result?.results?.[qi];
            const cls = r ? (oi === r.answer ? 'right' : answers[qi] === oi ? 'wrong' : '') : '';
            return (
              <label key={oi} className={`option ${cls}`}>
                <input
                  type="radio"
                  name={`${step._id}-${qi}`}
                  checked={answers[qi] === oi}
                  onChange={() => {
                    setResult(null);
                    setAnswers((a) => a.map((v, i) => (i === qi ? oi : v)));
                  }}
                />
                {opt}
              </label>
            );
          })}
        </fieldset>
      ))}
      <button className="btn" disabled={busy || answers.includes(null)} onClick={submit}>
        {busy ? 'Checking…' : !user ? 'Log in to submit' : done ? 'Retake quiz' : 'Submit answers'}
      </button>
      {result && (
        <div className={`result ${result.passed ? 'pass' : 'fail'}`}>
          {result.passed ? `🎉 Passed with ${result.score}%! Step complete.` : `${result.score}%. You need ${result.passMark}%. Review the step and try again.`}
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

export default function PathPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);
  const [badge, setBadge] = useState(false);

  useEffect(() => {
    api(`/paths/${id}`)
      .then((d) => {
        setData(d);
        const done = new Set((d.progress?.completedSteps || []).map(String));
        const next = d.path.steps.findIndex((s) => !done.has(String(s._id)));
        setOpen(next === -1 ? null : next);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return <div className="card empty"><div className="big">😕</div><p>{error}</p><Link to="/">← Back to all skills</Link></div>;
  if (!data) return <div className="skeleton" style={{ minHeight: 300, marginTop: '1rem' }} />;

  const { path, progress } = data;
  const doneIds = new Set((progress?.completedSteps || []).map(String));
  const pct = Math.round((100 * doneIds.size) / path.steps.length);
  const hours = path.steps.reduce((h, s) => h + (s.estimatedHours || 0), 0);
  const nextIndex = path.steps.findIndex((s) => !doneIds.has(String(s._id)));
  const finished = badge || progress?.completedAt;

  const onResult = (r) => {
    setData((d) => ({ ...d, progress: r.progress }));
    if (r.badgeEarned && !progress?.completedAt) setBadge(true);
    if (r.passed) {
      const done = new Set(r.progress.completedSteps.map(String));
      const next = path.steps.findIndex((s) => !done.has(String(s._id)));
      if (next !== -1) setTimeout(() => setOpen(next), 900);
    }
  };

  const goTo = (i) => {
    setOpen(i);
    setTimeout(() => document.getElementById(`step-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  return (
    <>
      <Link to={`/d/${path.domain.slug}`} className="back">← {path.domain.icon} {path.domain.name}</Link>
      <div className="path-layout" style={{ marginTop: '0.8rem' }}>
        <div>
          <span className={`pill level-${path.level}`}>{path.level}</span>
          <h1>{path.title}</h1>
          <p className="muted" style={{ marginTop: 0 }}>{path.description}</p>

          {finished && (
            <div className="badge-banner">
              <span className="medal">🏅</span>
              <div><strong>Badge earned!</strong><div className="muted small">You completed {path.title}. It's on your dashboard.</div></div>
            </div>
          )}

          <ol className="timeline">
            {path.steps.map((s, i) => {
              const done = doneIds.has(String(s._id));
              const isOpen = open === i;
              return (
                <li key={s._id} id={`step-${i}`} className={`${done ? 'done' : ''} ${i === nextIndex ? 'current' : ''}`}>
                  <span className="num">{done ? '✓' : i + 1}</span>
                  <div className="card step">
                    <button className="step-head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : i)}>
                      <span className="grow">{s.title}</span>
                      <span className="small muted">~{s.estimatedHours}h</span>
                      <span className="chev">▾</span>
                    </button>
                    {isOpen && (
                      <div className="step-body">
                        <p>{s.summary}</p>
                        <h4>Free resources</h4>
                        <ul className="resources">
                          {s.resources.map((r, ri) => (
                            <li key={ri}>
                              <a href={r.url} target="_blank" rel="noopener noreferrer">
                                <span className="r-icon">{resourceIcon(r)}</span>
                                <span>{r.title}</span>
                                <span className="ext">↗</span>
                              </a>
                            </li>
                          ))}
                        </ul>
                        <Quiz key={s._id} pathId={path._id} step={s} done={done} onResult={onResult} />
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        <aside className="path-side">
          <div className="card">
            <div className="ring" style={{ '--p': pct }}><div>{pct}%</div></div>
            <p className="center muted small" style={{ margin: 0 }}>{doneIds.size} of {path.steps.length} steps complete</p>
            <div className="side-facts">
              <div><b>{path.steps.length}</b><span>steps</span></div>
              <div><b>~{hours}h</b><span>total time</span></div>
            </div>
            <div style={{ marginTop: '1rem' }}>
              {!user ? (
                <Link to="/login" state={{ from: `/p/${path._id}` }} className="btn" style={{ width: '100%' }}>Log in to track progress</Link>
              ) : nextIndex !== -1 ? (
                <button className="btn" style={{ width: '100%' }} onClick={() => goTo(nextIndex)}>
                  {doneIds.size ? 'Continue' : 'Start'}: step {nextIndex + 1}
                </button>
              ) : (
                <Link to="/dashboard" className="btn secondary" style={{ width: '100%' }}>🏅 View my badges</Link>
              )}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
