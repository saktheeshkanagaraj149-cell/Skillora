import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { DomainIcon } from '../icons.jsx';
import {
  ArrowLeft, ArrowRight, Award, Brain, Check, ChevronDown, Clock, Exam, ExternalLink, FileText, Frown, GraduationCap, Hammer,
  Link2, Lock, Modules, PartyPopper, Play, Search, Video,
} from '../icons';

const EXAM_PASS_MARK = 70;
const RESOURCE_ICON = { video: Play, article: FileText, course: GraduationCap, practice: Hammer, search: Search };
function ResourceIcon({ r }) {
  const Icon = r.type === 'search' && /youtube\.com/.test(r.url) ? Play : RESOURCE_ICON[r.type] || Link2;
  return <Icon size={16} aria-hidden />;
}

/** Consecutive lessons with the same `module` form one module. Lessons without one go into "Lessons". */
function groupModules(steps) {
  const groups = [];
  steps.forEach((s, i) => {
    const name = s.module || 'Lessons';
    const last = groups[groups.length - 1];
    if (last && last.name === name) last.items.push(i);
    else groups.push({ name, items: [i] });
  });
  return groups;
}

/** Click-to-load embed: no YouTube cookies or player weight until the learner presses play. */
function LessonVideo({ video }) {
  const [playing, setPlaying] = useState(false);
  return (
    <figure className="lesson-video">
      <div className="video-frame">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}?autoplay=1&rel=0`}
            title={video.title || 'Lesson video'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button className="video-poster" onClick={() => setPlaying(true)} aria-label={`Play video: ${video.title}`}>
            <img src={`https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`} alt="" loading="lazy" />
            <span className="play-btn"><Play size={30} /></span>
          </button>
        )}
      </div>
      {(video.title || video.channel) && (
        <figcaption className="small muted">
          {video.title}{video.channel && <> · {video.channel}</>} ·{' '}
          <a href={`https://www.youtube.com/watch?v=${video.youtubeId}`} target="_blank" rel="noopener noreferrer">Watch on YouTube</a>
        </figcaption>
      )}
    </figure>
  );
}

/** Shared multiple-choice block for lesson quizzes and the final exam. */
function Questions({ name, questions, answers, setAnswers, results, onChange }) {
  return questions.map((q, qi) => (
    <fieldset key={qi}>
      <legend>{qi + 1}. {q.question}</legend>
      {q.options.map((opt, oi) => {
        const r = results?.[qi];
        let cls = '';
        if (r && answers[qi] === oi) cls = r.correct ? 'right' : 'wrong';
        else if (r && r.answer === oi) cls = 'right';
        return (
          <label key={oi} className={`option ${cls}`}>
            <input
              type="radio"
              name={`${name}-${qi}`}
              checked={answers[qi] === oi}
              onChange={() => {
                onChange();
                setAnswers((a) => a.map((v, i) => (i === qi ? oi : v)));
              }}
            />
            {opt}
          </label>
        );
      })}
    </fieldset>
  ));
}

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
        <p style={{ margin: '0 0 0.8rem' }}>Finished the video and resources?</p>
        <button className="btn" disabled={busy || done} onClick={submit}>
          {done ? <><Check size={16} /> Completed</> : user ? 'Mark lesson as done' : 'Log in to track progress'}
        </button>
        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="quiz">
      <h4 className="with-icon"><Brain size={16} /> Quick check · {step.quiz.length} questions · pass mark 60%</h4>
      <Questions name={step._id} questions={step.quiz} answers={answers} setAnswers={setAnswers} results={result?.results} onChange={() => setResult(null)} />
      <button className="btn" disabled={busy || answers.includes(null)} onClick={submit}>
        {busy ? 'Checking…' : !user ? 'Log in to submit' : done ? 'Retake quiz' : 'Submit answers'}
      </button>
      {result && (
        <div className={`result ${result.passed ? 'pass' : 'fail'}`}>
          {result.passed ? <><PartyPopper size={18} /> Passed with {result.score}%! Lesson complete.</> : `${result.score}%. You need ${result.passMark}%. Review the lesson and try again.`}
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

function FinalExam({ path, unlocked, bestScore, onPassed }) {
  const [answers, setAnswers] = useState(() => path.finalExam.map(() => null));
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await api(`/paths/${path._id}/exam`, { method: 'POST', body: { answers } });
      setResult(r);
      if (r.passed) onPassed(r);
      else window.scrollTo({ top: document.getElementById('final-exam').offsetTop - 90, behavior: 'smooth' });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const wrong = result && !result.passed ? result.results.filter((r) => !r.correct).length : 0;

  return (
    <section id="final-exam" className={`card exam ${unlocked ? '' : 'locked'}`}>
      <div className="exam-head">
        <span className="exam-icon">{unlocked ? <Exam size={24} /> : <Lock size={22} />}</span>
        <div className="grow">
          <h2>Final exam</h2>
          <p className="muted small" style={{ margin: 0 }}>
            {path.finalExam.length} questions · pass mark {EXAM_PASS_MARK}% · unlimited attempts
            {bestScore != null && <> · your best: <strong>{bestScore}%</strong></>}
          </p>
        </div>
      </div>
      {!unlocked ? (
        <p className="muted" style={{ marginBottom: 0 }}>Complete every lesson to unlock the exam. Pass it to earn your certificate.</p>
      ) : (
        <div className="quiz">
          <Questions name="exam" questions={path.finalExam} answers={answers} setAnswers={setAnswers} results={result?.results} onChange={() => setResult(null)} />
          <button className="btn" disabled={busy || answers.includes(null)} onClick={submit}>{busy ? 'Grading…' : 'Submit exam'}</button>
          {result && !result.passed && (
            <div className="result fail">
              {result.score}%: {wrong} answer{wrong === 1 ? '' : 's'} marked in red. You need {result.passMark}%. Review those lessons and try again.
            </div>
          )}
          {error && <p className="error">{error}</p>}
        </div>
      )}
    </section>
  );
}

function CertificateBanner({ cert }) {
  return (
    <Link to={`/certificate/${cert.code}`} className="cert-banner">
      <span className="medal"><Award size={30} /></span>
      <div className="grow">
        <strong>Certificate earned!</strong>
        <div className="small">View, download as PDF or add it to LinkedIn · ID {cert.code}</div>
      </div>
      <ArrowRight size={20} />
    </Link>
  );
}

export default function PathPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);
  const [cert, setCert] = useState(null);

  useEffect(() => {
    setCert(null);
    api(`/paths/${id}`)
      .then((d) => {
        setData(d);
        const done = new Set((d.progress?.completedSteps || []).map(String));
        const next = d.path.steps.findIndex((s) => !done.has(String(s._id)));
        setOpen(next === -1 ? null : next);
        const allDone = next === -1 && d.progress;
        const examOk = !d.path.finalExam?.length || (d.progress?.examScore ?? 0) >= EXAM_PASS_MARK;
        if (allDone && examOk && d.path.status === 'published') api(`/paths/${id}/certificate`, { method: 'POST' }).then(setCert).catch(() => {});
      })
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return <div className="card empty"><Frown className="big-icon" size={44} aria-hidden /><p>{error}</p><Link to="/">Back to all skills</Link></div>;
  if (!data) return <div className="skeleton" style={{ minHeight: 300, marginTop: '1rem' }} />;

  const { path, progress } = data;
  const exam = path.finalExam || [];
  const doneIds = new Set((progress?.completedSteps || []).map(String));
  const pct = Math.round((100 * doneIds.size) / path.steps.length);
  const hours = path.steps.reduce((h, s) => h + (s.estimatedHours || 0), 0);
  const videos = path.steps.filter((s) => s.video?.youtubeId).length;
  const nextIndex = path.steps.findIndex((s) => !doneIds.has(String(s._id)));
  const allDone = nextIndex === -1 && Boolean(progress);
  const modules = groupModules(path.steps);
  const hasModules = path.steps.some((s) => s.module);

  const onResult = (r) => {
    setData((d) => ({ ...d, progress: r.progress }));
    if (r.badgeEarned && !exam.length) api(`/paths/${path._id}/certificate`, { method: 'POST' }).then(setCert).catch(() => {});
    if (r.passed) {
      const done = new Set(r.progress.completedSteps.map(String));
      const next = path.steps.findIndex((s) => !done.has(String(s._id)));
      if (next !== -1) setTimeout(() => setOpen(next), 900);
      else if (exam.length) setTimeout(() => document.getElementById('final-exam')?.scrollIntoView({ behavior: 'smooth' }), 900);
    }
  };

  const onExamPassed = (r) => {
    setData((d) => ({ ...d, progress: r.progress }));
    setCert(r.certificate);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goTo = (i) => {
    setOpen(i);
    setTimeout(() => document.getElementById(`step-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  return (
    <>
      <Link to={`/d/${path.domain.slug}`} className="back"><ArrowLeft size={16} /> <DomainIcon slug={path.domain.slug} size={16} /> {path.domain.name}</Link>
      <div className="path-layout" style={{ marginTop: '0.8rem' }}>
        <div>
          <span className={`pill level-${path.level}`}>{path.level}</span>
          <h1>{path.title}</h1>
          <p className="muted" style={{ marginTop: 0 }}>{path.description}</p>

          {cert ? (
            <CertificateBanner cert={cert} />
          ) : (
            progress?.completedAt && (
              <div className="badge-banner">
                <span className="medal"><Award size={30} /></span>
                <div>
                  <strong>Badge earned!</strong>
                  <div className="muted small">{exam.length ? 'Every lesson done. Pass the final exam below to get your certificate.' : `You completed ${path.title}.`}</div>
                </div>
              </div>
            )
          )}

          {modules.map((m, mi) => {
            const mDone = m.items.filter((i) => doneIds.has(String(path.steps[i]._id))).length;
            return (
              <section key={mi} className="module">
                {hasModules && (
                  <div className="module-head">
                    <span className="module-no">Module {mi + 1}</span>
                    <h2>{m.name}</h2>
                    <span className="small muted">{mDone}/{m.items.length} lessons</span>
                  </div>
                )}
                <ol className="timeline">
                  {m.items.map((i) => {
                    const s = path.steps[i];
                    const done = doneIds.has(String(s._id));
                    const isOpen = open === i;
                    return (
                      <li key={s._id} id={`step-${i}`} className={`${done ? 'done' : ''} ${i === nextIndex ? 'current' : ''}`}>
                        <span className="num">{done ? <Check size={18} strokeWidth={3} /> : i + 1}</span>
                        <div className="card step">
                          <button className="step-head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : i)}>
                            <span className="grow">{s.title}</span>
                            {s.video?.youtubeId && <Video size={16} className="muted" aria-label="Has video" />}
                            <span className="small muted">~{s.estimatedHours}h</span>
                            <ChevronDown className="chev" size={18} aria-hidden />
                          </button>
                          {isOpen && (
                            <div className="step-body">
                              {s.video?.youtubeId && <LessonVideo video={s.video} />}
                              <p>{s.summary}</p>
                              {s.resources.length > 0 && (
                                <>
                                  <h4>{s.video ? 'More free resources' : 'Free resources'}</h4>
                                  <ul className="resources">
                                    {s.resources.map((r, ri) => (
                                      <li key={ri}>
                                        <a href={r.url} target="_blank" rel="noopener noreferrer">
                                          <span className="r-icon"><ResourceIcon r={r} /></span>
                                          <span>{r.title}</span>
                                          <ExternalLink className="ext" size={15} aria-hidden />
                                        </a>
                                      </li>
                                    ))}
                                  </ul>
                                </>
                              )}
                              <Quiz key={s._id} pathId={path._id} step={s} done={done} onResult={onResult} />
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            );
          })}

          {exam.length > 0 && !cert && user && (
            <FinalExam path={path} unlocked={allDone} bestScore={progress?.examScore ?? null} onPassed={onExamPassed} />
          )}
          {exam.length > 0 && !user && (
            <section className="card exam locked">
              <div className="exam-head">
                <span className="exam-icon"><Lock size={22} /></span>
                <div><h2>Final exam and certificate</h2><p className="muted small" style={{ margin: 0 }}>Log in, finish every lesson and pass the {exam.length}-question exam to earn a verifiable certificate.</p></div>
              </div>
            </section>
          )}
        </div>

        <aside className="path-side">
          <div className="card">
            <div className="ring" style={{ '--p': pct }}><div>{pct}%</div></div>
            <p className="center muted small" style={{ margin: 0 }}>{doneIds.size} of {path.steps.length} lessons complete</p>
            <div className="side-facts">
              {hasModules && <div><b>{modules.length}</b><span><Modules size={13} /> modules</span></div>}
              <div><b>{path.steps.length}</b><span>lessons</span></div>
              {videos > 0 && <div><b>{videos}</b><span><Video size={13} /> videos</span></div>}
              <div><b>~{hours}h</b><span><Clock size={13} /> total time</span></div>
            </div>
            <p className="side-cert small">
              <Award size={16} />
              {cert ? 'Certificate earned' : exam.length ? `Certificate after the ${exam.length}-question final exam` : 'Certificate on completion'}
            </p>
            <div style={{ marginTop: '0.8rem' }}>
              {!user ? (
                <Link to="/login" state={{ from: `/p/${path._id}` }} className="btn" style={{ width: '100%' }}>Log in to track progress</Link>
              ) : nextIndex !== -1 ? (
                <button className="btn" style={{ width: '100%' }} onClick={() => goTo(nextIndex)}>
                  {doneIds.size ? 'Continue' : 'Start'}: lesson {nextIndex + 1}
                </button>
              ) : cert ? (
                <Link to={`/certificate/${cert.code}`} className="btn" style={{ width: '100%' }}><Award size={17} /> View certificate</Link>
              ) : exam.length ? (
                <button className="btn" style={{ width: '100%' }} onClick={() => document.getElementById('final-exam')?.scrollIntoView({ behavior: 'smooth' })}>
                  <Exam size={17} /> Take the final exam
                </button>
              ) : (
                <Link to="/dashboard" className="btn secondary" style={{ width: '100%' }}><Award size={17} /> View my badges</Link>
              )}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
