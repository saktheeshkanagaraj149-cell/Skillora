import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { DomainIcon } from '../icons.jsx';
import { Plus, Sparkles } from '../icons';

const resourcesToText = (rs) => rs.map((r) => `${r.title} | ${r.url}`).join('\n');
const textToResources = (t) =>
  t
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [title, url] = l.includes('|') ? l.split('|').map((s) => s.trim()) : [l, l];
      return { title: title || url, url, type: /youtube\.com\/results|google\.com\/search/.test(url) ? 'search' : 'article' };
    })
    .filter((r) => /^https?:\/\//.test(r.url));

function parseYouTubeId(input) {
  const v = String(input || '').trim();
  if (/^[\w-]{11}$/.test(v)) return v;
  const m = v.match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}
const videoToText = (v) => (v?.youtubeId ? `https://www.youtube.com/watch?v=${v.youtubeId}` : '');
const toEditable = (p) => ({ ...p, steps: p.steps.map((s) => ({ ...s, resourcesText: resourcesToText(s.resources), videoText: videoToText(s.video) })) });

function Generator({ domains, onCreated }) {
  const [form, setForm] = useState({ domainId: '', topic: '', level: 'beginner', steps: 12 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onCreated(await api('/admin/paths/generate', { method: 'POST', body: { ...form, steps: Number(form.steps) } }));
      setForm({ ...form, topic: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card form wide" onSubmit={submit}>
      <h3 className="with-icon"><Sparkles size={18} /> Generate a course with AI</h3>
      <div className="row">
        <label>Domain
          <select required value={form.domainId} onChange={set('domainId')}>
            <option value="">Choose…</option>
            {domains.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
          </select>
        </label>
        <label className="grow">Topic<input required placeholder="e.g. Arduino for absolute beginners" value={form.topic} onChange={set('topic')} /></label>
      </div>
      <div className="row">
        <label>Level
          <select value={form.level} onChange={set('level')}>
            <option>beginner</option><option>intermediate</option><option>advanced</option>
          </select>
        </label>
        <label>Lessons<input type="number" min={3} max={24} value={form.steps} onChange={set('steps')} /></label>
      </div>
      {error && <p className="error">{error}</p>}
      <button className="btn" disabled={busy}>{busy ? 'Generating… (up to ~60s)' : 'Generate draft'}</button>
    </form>
  );
}

function NewDomain({ onCreated }) {
  const [form, setForm] = useState({ name: '', icon: '📚', description: '', category: 'Technology' });
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      onCreated(await api('/domains', { method: 'POST', body: form }));
      setForm({ name: '', icon: '📚', description: '', category: form.category });
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <form className="card form wide" onSubmit={submit}>
      <h3 className="with-icon"><Plus size={18} /> Add a domain</h3>
      <div className="row">
        <label style={{ width: 80 }}>Icon<input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} /></label>
        <label className="grow">Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
      </div>
      <label>Category
        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          {['Technology','Engineering','Science & Maths','Business & Career','Creative Arts','Languages','Life Skills','Other'].map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <label>Description<input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
      {error && <p className="error">{error}</p>}
      <button className="btn secondary">Add domain</button>
    </form>
  );
}

function Editor({ id, onSaved, onDeleted, onClose }) {
  const [path, setPath] = useState(null);
  const [msg, setMsg] = useState('');
  const [building, setBuilding] = useState(false);

  useEffect(() => {
    setPath(null);
    api(`/paths/${id}`).then((d) => setPath(toEditable(d.path)));
  }, [id]);

  if (!path) return <p className="muted">Loading editor…</p>;

  const setStep = (i, patch) => setPath({ ...path, steps: path.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const moveStep = (i, dir) => {
    const steps = [...path.steps];
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    [steps[i], steps[j]] = [steps[j], steps[i]];
    setPath({ ...path, steps });
  };

  const save = async (status = path.status) => {
    const bad = path.steps.findIndex((s) => s.videoText?.trim() && !parseYouTubeId(s.videoText));
    if (bad !== -1) return setMsg(`Lesson ${bad + 1}: the video must be a YouTube link`);
    setMsg('Saving…');
    try {
      const body = {
        title: path.title,
        description: path.description,
        level: path.level,
        status,
        finalExam: path.finalExam || [],
        steps: path.steps.map(({ resourcesText, videoText, ...s }) => {
          const youtubeId = parseYouTubeId(videoText);
          const video = !youtubeId ? null : youtubeId === s.video?.youtubeId ? s.video : { youtubeId, title: '', channel: '' };
          return { ...s, video, resources: textToResources(resourcesText) };
        }),
      };
      const saved = await api(`/admin/paths/${id}`, { method: 'PUT', body });
      setPath(toEditable(saved));
      setMsg(status === 'published' ? 'Published ✓' : 'Saved ✓');
      onSaved(saved);
    } catch (e) {
      setMsg(e.message);
    }
  };

  const buildCourse = async () => {
    setBuilding(true);
    setMsg('Building course: modules, final exam and videos… (up to ~1 min)');
    try {
      const r = await api(`/admin/paths/${id}/enrich`, { method: 'POST', body: { structure: true, videos: true } });
      setPath(toEditable(r.path));
      setMsg(`Done: ${r.notes.join('; ')}. Review, then Save or Publish.`);
      onSaved(r.path);
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBuilding(false);
    }
  };

  const remove = async () => {
    // Two-click delete instead of window.confirm
    if (msg !== 'Click delete again to confirm') return setMsg('Click delete again to confirm');
    await api(`/admin/paths/${id}`, { method: 'DELETE' });
    onDeleted(id);
  };

  return (
    <div className="card editor">
      <div className="row-between">
        <h3>Edit path <span className={`pill ${path.status}`}>{path.status}</span></h3>
        <button className="link" onClick={onClose}>Close ✕</button>
      </div>
      <label>Title<input value={path.title} onChange={(e) => setPath({ ...path, title: e.target.value })} /></label>
      <label>Description<textarea rows={2} value={path.description} onChange={(e) => setPath({ ...path, description: e.target.value })} /></label>
      <div className="row">
        <label>Level
          <select value={path.level} onChange={(e) => setPath({ ...path, level: e.target.value })}>
            <option>beginner</option><option>intermediate</option><option>advanced</option>
          </select>
        </label>
        <span className="grow" />
        <button className="btn secondary small" disabled={building} onClick={buildCourse} title="Adds modules, a 10-question final exam and a YouTube video per lesson. Keeps your lessons, quizzes and resources.">
          <Sparkles size={16} /> {building ? 'Building…' : 'Build full course with AI'}
        </button>
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        {path.steps.filter((s) => s.video?.youtubeId).length}/{path.steps.length} lessons have a video · {new Set(path.steps.map((s) => s.module).filter(Boolean)).size} modules · final exam: {(path.finalExam || []).length} questions
      </p>

      {path.steps.map((s, i) => (
        <div key={s._id || i} className="edit-step">
          <div className="row-between">
            <strong>Lesson {i + 1}</strong>
            <span>
              <button className="link" onClick={() => moveStep(i, -1)}>↑</button>
              <button className="link" onClick={() => moveStep(i, 1)}>↓</button>
              <button className="link danger" onClick={() => setPath({ ...path, steps: path.steps.filter((_, j) => j !== i) })}>Remove</button>
            </span>
          </div>
          <div className="row">
            <label style={{ minWidth: 180 }}>Module<input placeholder="e.g. Getting started" value={s.module || ''} onChange={(e) => setStep(i, { module: e.target.value })} /></label>
            <label className="grow">Title<input value={s.title} onChange={(e) => setStep(i, { title: e.target.value })} /></label>
            <label style={{ width: 90 }}>Hours<input type="number" min={0} value={s.estimatedHours} onChange={(e) => setStep(i, { estimatedHours: Number(e.target.value) })} /></label>
          </div>
          <label>Summary<textarea rows={2} value={s.summary} onChange={(e) => setStep(i, { summary: e.target.value })} /></label>
          <label>Video <span className="muted small">(YouTube link{s.video?.title ? `, now: ${s.video.title}` : ''}). Leave empty for no video.</span>
            <input placeholder="https://www.youtube.com/watch?v=…" value={s.videoText || ''} onChange={(e) => setStep(i, { videoText: e.target.value })} />
          </label>
          <label>Resources <span className="muted small">(one per line: Title | https://link). Replace search links with the best free videos you find.</span>
            <textarea rows={3} value={s.resourcesText} onChange={(e) => setStep(i, { resourcesText: e.target.value })} />
          </label>
          {s.quiz.length > 0 && (
            <details>
              <summary className="small">Quiz ({s.quiz.length} questions)</summary>
              {s.quiz.map((q, qi) => (
                <div key={qi} className="small quiz-preview">
                  <span>{q.question}: <strong>{q.options[q.answer]}</strong></span>
                  <button className="link danger" onClick={() => setStep(i, { quiz: s.quiz.filter((_, k) => k !== qi) })}>remove</button>
                </div>
              ))}
            </details>
          )}
        </div>
      ))}
      <button
        className="link"
        onClick={() => setPath({ ...path, steps: [...path.steps, { module: path.steps.at(-1)?.module || '', title: 'New lesson', summary: '', estimatedHours: 1, resources: [], resourcesText: '', videoText: '', quiz: [] }] })}
      >
        + Add lesson
      </button>

      <details className="edit-step">
        <summary><strong>Final exam ({(path.finalExam || []).length} questions)</strong> <span className="muted small">pass mark 70%. Passing it earns the certificate; with no questions, the certificate is given on completion.</span></summary>
        {(path.finalExam || []).map((q, qi) => (
          <div key={qi} className="small quiz-preview">
            <span>{qi + 1}. {q.question}: <strong>{q.options[q.answer]}</strong></span>
            <button className="link danger" onClick={() => setPath({ ...path, finalExam: path.finalExam.filter((_, k) => k !== qi) })}>remove</button>
          </div>
        ))}
        {!(path.finalExam || []).length && <p className="small muted">No exam yet. Use “Build full course with AI”.</p>}
      </details>

      <div className="row">
        <button className="btn secondary" onClick={() => save()}>Save</button>
        {path.status === 'draft'
          ? <button className="btn" onClick={() => save('published')}>Publish</button>
          : <button className="btn secondary" onClick={() => save('draft')}>Unpublish</button>}
        {path.status === 'published' && <Link to={`/p/${id}`} className="link">View as learner →</Link>}
        <span className="grow" />
        <button className="link danger" onClick={remove}>Delete</button>
      </div>
      {msg && <p className="small muted">{msg}</p>}
    </div>
  );
}

export default function Admin() {
  const [domains, setDomains] = useState([]);
  const [paths, setPaths] = useState([]);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');

  const loadPaths = () => api('/admin/paths').then(setPaths).catch((e) => setError(e.message));
  useEffect(() => {
    api('/domains').then(setDomains).catch((e) => setError(e.message));
    loadPaths();
  }, []);

  return (
    <>
      <h1>Admin</h1>
      {error && <p className="error">{error}</p>}
      <div className="grid two">
        <Generator domains={domains} onCreated={(p) => { loadPaths(); setEditing(p._id); }} />
        <NewDomain onCreated={(d) => setDomains([...domains, d].sort((a, b) => a.name.localeCompare(b.name)))} />
      </div>

      {editing && (
        <Editor
          id={editing}
          onSaved={loadPaths}
          onDeleted={() => { setEditing(null); loadPaths(); }}
          onClose={() => setEditing(null)}
        />
      )}

      <h2>All courses</h2>
      <p className="small muted">To build every skill at once, run <code>npm run build:courses</code> on the server (see docs/COURSES.md).</p>
      <table className="table">
        <thead><tr><th>Course</th><th>Domain</th><th>Level</th><th>Lessons</th><th>Modules</th><th>Videos</th><th>Exam</th><th>Status</th><th>Source</th><th /></tr></thead>
        <tbody>
          {paths.map((p) => (
            <tr key={p._id}>
              <td>{p.title}</td>
              <td><span className="with-icon"><DomainIcon slug={p.domain?.slug} size={16} /> {p.domain?.name}</span></td>
              <td>{p.level}</td>
              <td>{p.steps.length}</td>
              <td>{new Set(p.steps.map((s) => s.module).filter(Boolean)).size || '–'}</td>
              <td>{p.steps.filter((s) => s.video?.youtubeId).length}/{p.steps.length}</td>
              <td>{p.finalExam?.length || '–'}</td>
              <td><span className={`pill ${p.status}`}>{p.status}</span></td>
              <td className="small muted">{p.generatedBy}</td>
              <td><button className="link" onClick={() => setEditing(p._id)}>Edit</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {paths.length === 0 && <p className="muted">No paths yet. Generate one above.</p>}
    </>
  );
}
