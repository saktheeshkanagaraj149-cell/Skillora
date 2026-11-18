import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

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
      <button className="btn" disabled={busy || done} onClick={submit}>
        {done ? '✓ Completed' : 'Mark as done'}
      </button>
    );
  }

  return (
    <div className="quiz">
      <h4>Quick check: {step.quiz.length} questions</h4>
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
        {busy ? 'Checking…' : done ? 'Retake quiz' : 'Submit answers'}
      </button>
      {result && (
        <p className={result.passed ? 'success' : 'error'}>
          {result.passed ? `Passed with ${result.score}%! Step complete.` : `${result.score}%: you need ${result.passMark}%. Review the step and try again.`}
        </p>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

export default function PathPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(0);
  const [badge, setBadge] = useState(false);

  useEffect(() => {
    api(`/paths/${id}`).then(setData).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Loading…</p>;

  const { path, progress } = data;
  const doneIds = new Set((progress?.completedSteps || []).map(String));
  const pct = Math.round((100 * doneIds.size) / path.steps.length);

  const onResult = (r) => {
    setData((d) => ({ ...d, progress: r.progress }));
    if (r.badgeEarned && !progress?.completedAt) setBadge(true);
  };

  return (
    <>
      <Link to={`/d/${path.domain.slug}`} className="muted">← {path.domain.icon} {path.domain.name}</Link>
      <h1>{path.title}</h1>
      <p className="muted">{path.description}</p>
      <div className="progress"><div style={{ width: `${pct}%` }} /></div>
      <p className="small muted">{doneIds.size} of {path.steps.length} steps done · {pct}%</p>

      {(badge || progress?.completedAt) && (
        <div className="card badge">🏅 <strong>Badge earned!</strong> You completed {path.title}.</div>
      )}

      <ol className="steps">
        {path.steps.map((s, i) => {
          const done = doneIds.has(String(s._id));
          return (
            <li key={s._id} className={`card step ${done ? 'done' : ''}`}>
              <button className="step-head" onClick={() => setOpen(open === i ? -1 : i)}>
                <span className="num">{done ? '✓' : i + 1}</span>
                <span className="grow">{s.title}</span>
                <span className="small muted">~{s.estimatedHours}h</span>
              </button>
              {open === i && (
                <div className="step-body">
                  <p>{s.summary}</p>
                  <h4>Free resources</h4>
                  <ul>
                    {s.resources.map((r, ri) => (
                      <li key={ri}>
                        <a href={r.url} target="_blank" rel="noopener noreferrer">{r.title}</a>
                      </li>
                    ))}
                  </ul>
                  <Quiz key={s._id} pathId={path._id} step={s} done={done} onResult={onResult} />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}
